#!/usr/bin/env node
/**
 * Recalculate every bill row from current Settings, AmperePrices, and Customers
 * (same logic as create bill / manager “save reading”). Preserves totalPaid per bill.
 *
 * Run from project root with .env.local configured (GOOGLE_SHEETS_ID + credentials).
 *
 *   node scripts/recalculate-all-bills.mjs --dry-run    # preview only
 *   node scripts/recalculate-all-bills.mjs              # write to Bills sheet
 *
 * Or: npm run recalculate-bills -- --dry-run
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

/** Same pattern as other scripts; later files override. */
function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    try {
      const c = readFileSync(resolve(projectRoot, name), "utf-8");
      for (let line of c.split("\n")) {
        line = line.replace(/\r$/, "");
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const m = trimmed.match(/^([^=]+)=(.*)$/);
        if (!m) continue;
        const key = m[1].trim();
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    } catch {
      /* file missing */
    }
  }
}

loadEnv();

/** Pick a Google service account JSON in the project root (e.g. station-123-abc.json). */
function findServiceAccountJsonInProjectRoot(projectRootPath) {
  const skip = new Set([
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.tsbuildinfo",
    "vercel.json",
    "components.json",
  ]);
  try {
    for (const name of readdirSync(projectRootPath)) {
      if (!name.endsWith(".json") || skip.has(name)) continue;
      const full = resolve(projectRootPath, name);
      try {
        const j = JSON.parse(readFileSync(full, "utf-8"));
        if (j && j.type === "service_account" && typeof j.private_key === "string") {
          return full;
        }
      } catch {
        /* not JSON or wrong shape */
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeBillingType(raw) {
  const t = (raw ?? "").trim().toUpperCase();
  if (t === "AMPERE_ONLY" || t === "KWH_ONLY" || t === "BOTH" || t === "FREE") return t;
  return "BOTH";
}

function calcUsageKwh(previousCounter, currentCounter) {
  return Math.max(0, currentCounter - previousCounter);
}

function getAmperePriceForTier(subscribedAmpere, tiers) {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.amp - b.amp);
  const exact = sorted.find((t) => t.amp === subscribedAmpere);
  if (exact) return exact.price;
  const lower = sorted.filter((t) => t.amp <= subscribedAmpere);
  return lower.length > 0 ? lower[lower.length - 1].price : sorted[0].price;
}

function calcAmpereCharge(subscribedAmpere, tiers, billingType) {
  if (billingType === "FREE") return 0;
  if (billingType === "AMPERE_ONLY" || billingType === "BOTH") {
    return getAmperePriceForTier(subscribedAmpere, tiers);
  }
  return 0;
}

function calcConsumptionCharge(usageKwh, kwhPrice, billingType) {
  if (billingType === "FREE") return 0;
  if (billingType === "KWH_ONLY" || billingType === "BOTH") {
    return Math.round(usageKwh * kwhPrice);
  }
  return 0;
}

function calcTotalBeforeDiscount(ampereCharge, consumptionCharge, previousUnpaidBalance) {
  return ampereCharge + consumptionCharge + previousUnpaidBalance;
}

function calcEffectiveDiscount(totalBeforeDiscount, fixedDiscountAmount, fixedDiscountPercent) {
  if (fixedDiscountAmount > 0) return Math.min(fixedDiscountAmount, totalBeforeDiscount);
  if (fixedDiscountPercent > 0) {
    const byPercent = Math.round(totalBeforeDiscount * (fixedDiscountPercent / 100));
    return Math.min(byPercent, totalBeforeDiscount);
  }
  return 0;
}

function calcTotalAfterDiscount(totalBeforeDiscount, fixedDiscountAmount, fixedDiscountPercent) {
  const discount = calcEffectiveDiscount(
    totalBeforeDiscount,
    fixedDiscountAmount,
    fixedDiscountPercent
  );
  return Math.max(0, totalBeforeDiscount - discount);
}

function calcPaymentStatus(totalPaid, remainingDue) {
  if (remainingDue <= 0) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  return "UNPAID";
}

function calcBillFromReadings(
  customerId,
  monthKey,
  previousCounter,
  currentCounter,
  subscribedAmpere,
  billingType,
  fixedDiscountAmount,
  fixedDiscountPercent,
  ampereTiers,
  kwhPrice,
  previousUnpaidBalance
) {
  const usageKwh = calcUsageKwh(previousCounter, currentCounter);
  if (billingType === "FREE") {
    return {
      usageKwh,
      amperePriceSnapshot: 0,
      kwhPriceSnapshot: kwhPrice,
      ampereCharge: 0,
      consumptionCharge: 0,
      discountApplied: 0,
      previousUnpaidBalance: 0,
      totalDue: 0,
      remainingDue: 0,
      paymentStatus: "PAID",
    };
  }
  const ampereCharge = calcAmpereCharge(subscribedAmpere, ampereTiers, billingType);
  const consumptionCharge = calcConsumptionCharge(usageKwh, kwhPrice, billingType);
  const totalBeforeDiscount = calcTotalBeforeDiscount(
    ampereCharge,
    consumptionCharge,
    previousUnpaidBalance
  );
  const discountApplied = calcEffectiveDiscount(
    totalBeforeDiscount,
    fixedDiscountAmount,
    fixedDiscountPercent
  );
  const totalDue = calcTotalAfterDiscount(
    totalBeforeDiscount,
    fixedDiscountAmount,
    fixedDiscountPercent
  );
  const amperePriceSnapshot = getAmperePriceForTier(subscribedAmpere, ampereTiers);
  return {
    usageKwh,
    amperePriceSnapshot,
    kwhPriceSnapshot: kwhPrice,
    ampereCharge,
    consumptionCharge,
    discountApplied,
    previousUnpaidBalance,
    totalDue,
    remainingDue: totalDue,
    paymentStatus: calcPaymentStatus(0, totalDue),
  };
}

function getPreviousUnpaidBalance(bills) {
  const unpaid = bills
    .filter((b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL")
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return unpaid[0]?.remainingDue ?? 0;
}

function loadCredentials(projectRootPath) {
  const tryFile = (p) => {
    if (!p) return null;
    const fullPath = isAbsolute(p) ? p : resolve(projectRootPath, p);
    if (!existsSync(fullPath)) return null;
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  };

  // 1) Path from env  2) common filenames  3) any *service* / station-* style JSON in repo root
  const discovered = findServiceAccountJsonInProjectRoot(projectRootPath);
  const fromPath =
    tryFile(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    tryFile(resolve(projectRootPath, "service-account.json")) ||
    tryFile(resolve(projectRootPath, "credentials.json")) ||
    (discovered ? tryFile(discovered) : null);

  if (fromPath) return fromPath;

  const jsonStr = process.env.GOOGLE_CREDENTIALS_JSON;
  if (jsonStr && jsonStr.trim().length > 0) {
    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error(
        "GOOGLE_CREDENTIALS_JSON is set but is not valid JSON. Remove it locally and either add " +
          "GOOGLE_APPLICATION_CREDENTIALS=./your-key.json or place your Google service account JSON file in the project root (same folder as package.json)."
      );
    }
  }

  throw new Error(
    "No Google credentials found. Download a service account key from Google Cloud, save it in this folder (e.g. service-account.json), " +
      "and set GOOGLE_APPLICATION_CREDENTIALS=./service-account.json in .env.local. " +
      "If the JSON file is already in the project root with another name, the script will auto-detect it when it looks like a service account key."
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID (set in .env.local)");
    process.exit(1);
  }

  const credentials = loadCredentials(projectRoot);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [billsRes, settingsRes, customersRes, ampRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:R" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Settings!A:Z" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:R" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "AmperePrices!A:B" }).catch(() => ({ data: { values: [] } })),
  ]);

  const header = (billsRes.data.values || [])[0];
  const billRows = (billsRes.data.values || []).slice(1);

  const settingsRow = (settingsRes.data.values || [])[1];
  const rSettings = settingsRow || [];
  const kwhIdx = rSettings.length >= 4 ? 1 : 0;
  const kwhPrice = parseFloat(String(rSettings[kwhIdx] || "0")) || 0;

  const ampRows = (ampRes.data.values || []).slice(1);
  let ampereTiers =
    ampRows.length > 0
      ? ampRows
          .map((row) => ({
            amp: parseFloat(row[0] || "0") || 0,
            price: parseFloat(row[1] || "0") || 0,
          }))
          .filter((t) => t.amp > 0)
      : [];

  if (ampereTiers.length === 0) {
    ampereTiers = [
      { amp: 3, price: 231000 },
      { amp: 4, price: 308000 },
      { amp: 5, price: 385000 },
      { amp: 6, price: 462000 },
      { amp: 7, price: 539000 },
      { amp: 10, price: 685000 },
      { amp: 15, price: 985000 },
      { amp: 16, price: 1062000 },
      { amp: 20, price: 1285000 },
      { amp: 25, price: 1585000 },
      { amp: 30, price: 1885000 },
      { amp: 32, price: 2039000 },
      { amp: 40, price: 2485000 },
      { amp: 48, price: 3016000 },
      { amp: 60, price: 3685000 },
      { amp: 63, price: 3865000 },
      { amp: 75, price: 4585000 },
      { amp: 120, price: 7285000 },
      { amp: 150, price: 9085000 },
      { amp: 180, price: 10885000 },
    ];
    console.warn("AmperePrices sheet empty — using built-in default tiers (same as app fallback).\n");
  }

  const customerRows = (customersRes.data.values || []).slice(1);
  const customerMap = new Map();
  for (const r of customerRows) {
    if (!r[0]) continue;
    customerMap.set(String(r[0]).trim(), {
      subscribedAmpere: parseFloat(r[7] || "0") || 0,
      billingType: normalizeBillingType(r[8]),
      fixedDiscountAmount: parseFloat(r[9] || "0") || 0,
      fixedDiscountPercent: parseFloat(r[14] || "0") || 0,
    });
  }

  /** @type {Map<string, object>} */
  const working = new Map();
  for (const r of billRows) {
    const billId = String(r[0] || "").trim();
    if (!billId) continue;
    working.set(billId, {
      billId,
      customerId: String(r[1] || "").trim(),
      monthKey: String(r[2] || "").trim(),
      previousCounter: parseFloat(r[3] || "0") || 0,
      currentCounter: parseFloat(r[4] || "0") || 0,
      totalPaid: parseFloat(r[13] || "0") || 0,
      paymentStatus: String(r[15] || "UNPAID").trim(),
      remainingDue: parseFloat(r[14] || "0") || 0,
      rawRow: r,
    });
  }

  const byCustomer = new Map();
  for (const b of working.values()) {
    if (!b.customerId) continue;
    if (!byCustomer.has(b.customerId)) byCustomer.set(b.customerId, []);
    byCustomer.get(b.customerId).push(b);
  }

  for (const [, list] of byCustomer) {
    list.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }

  const now = new Date().toISOString();
  let changeCount = 0;

  // Oldest month first per customer; after each bill, update working so "previous unpaid" uses fresh remainingDue.
  for (const [, list] of byCustomer) {
    for (const b of list) {
      const cust =
        customerMap.get(b.customerId) || {
          subscribedAmpere: 0,
          billingType: "BOTH",
          fixedDiscountAmount: 0,
          fixedDiscountPercent: 0,
        };

      const others = list
        .filter((x) => x.billId !== b.billId)
        .map((x) => working.get(x.billId));
      const previousUnpaid = getPreviousUnpaidBalance(others);

      const calc = calcBillFromReadings(
        b.customerId,
        b.monthKey,
        b.previousCounter,
        b.currentCounter,
        cust.subscribedAmpere,
        cust.billingType,
        cust.fixedDiscountAmount,
        cust.fixedDiscountPercent,
        ampereTiers,
        kwhPrice,
        previousUnpaid
      );

      const totalPaid = b.totalPaid;
      const newRemainingDue = Math.max(0, calc.totalDue - totalPaid);
      const newPaymentStatus = calcPaymentStatus(totalPaid, newRemainingDue);

      b._calc = calc;
      b._newRemainingDue = newRemainingDue;
      b._newPaymentStatus = newPaymentStatus;
      b._totalPaid = totalPaid;

      b.remainingDue = newRemainingDue;
      b.paymentStatus = newPaymentStatus;
      working.set(b.billId, b);

      const r = b.rawRow;
      const oldTotal = parseFloat(r[12] || "0") || 0;
      const oldRem = parseFloat(r[14] || "0") || 0;
      if (
        Math.abs(oldTotal - calc.totalDue) > 0.5 ||
        Math.abs(oldRem - newRemainingDue) > 0.5
      ) {
        changeCount++;
      }
    }
  }

  const newSheetRows = [];
  for (const r of billRows) {
    const billId = String(r[0] || "").trim();
    const b = working.get(billId);
    if (!b || !b._calc) {
      const row = [...r];
      while (row.length < 18) row.push("");
      newSheetRows.push(row);
      continue;
    }

    const calc = b._calc;
    const totalPaid = b._totalPaid;
    const newRemainingDue = b._newRemainingDue;
    const newPaymentStatus = b._newPaymentStatus;
    const createdAt = r[16] || "";

    const row = [
      billId,
      b.customerId,
      b.monthKey,
      String(b.previousCounter),
      String(b.currentCounter),
      String(calc.usageKwh),
      String(calc.amperePriceSnapshot),
      String(calc.kwhPriceSnapshot),
      String(calc.ampereCharge),
      String(calc.consumptionCharge),
      String(calc.discountApplied),
      String(calc.previousUnpaidBalance),
      String(calc.totalDue),
      String(totalPaid),
      String(newRemainingDue),
      newPaymentStatus,
      createdAt,
      now,
    ];
    newSheetRows.push(row);
  }

  console.log("\n=== Recalculate all bills ===\n");
  if (header) console.log("Header:", header.slice(0, 6).join(" | "), "...");
  console.log("Settings kwhPrice:", kwhPrice);
  console.log("Ampere tiers:", ampereTiers.length);
  console.log("Bill rows:", billRows.length);
  console.log("Rows with total/remaining change (approx):", changeCount);
  console.log("");

  if (dryRun) {
    console.log("[DRY RUN] No changes written. Run without --dry-run to apply.\n");
    return;
  }

  if (billRows.length === 0) {
    console.log("No bill rows.\n");
    return;
  }

  const range = `Bills!A2:R${1 + billRows.length}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: newSheetRows },
  });

  console.log("✓ Bills sheet updated.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
