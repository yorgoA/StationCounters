#!/usr/bin/env node
/**
 * Update bills for a specific month to a new kWh price.
 *
 * What it does:
 * - updates kwhPriceSnapshot
 * - recalculates consumptionCharge / discountApplied / totalDue
 * - preserves totalPaid
 * - recalculates remainingDue + paymentStatus
 * - upserts MonthlyTariffs row for that month
 *
 * Usage:
 *   npm run set-month-kwh -- --month 2026-03 --kwh 45000 --dry-run
 *   npm run set-month-kwh -- --month 2026-03 --kwh 45000
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

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
      // ignore
    }
  }
}

function arg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return String(process.argv[idx + 1] || "").trim();
}

function normalizeBillingType(raw) {
  const t = (raw ?? "").trim().toUpperCase();
  if (
    t === "AMPERE_ONLY" ||
    t === "KWH_ONLY" ||
    t === "BOTH" ||
    t === "FREE" ||
    t === "FIXED_MONTHLY"
  ) {
    return t;
  }
  return "BOTH";
}

function calcPaymentStatus(totalPaid, remainingDue) {
  if (remainingDue <= 0) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  return "UNPAID";
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

function calcBillFromReadings(
  previousCounter,
  currentCounter,
  subscribedAmpere,
  billingType,
  fixedMonthlyPrice,
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
      totalDue: 0,
      previousUnpaidBalance: 0,
    };
  }

  if (billingType === "FIXED_MONTHLY") {
    const totalDue = fixedMonthlyPrice + previousUnpaidBalance;
    return {
      usageKwh,
      amperePriceSnapshot: getAmperePriceForTier(subscribedAmpere, ampereTiers),
      kwhPriceSnapshot: kwhPrice,
      ampereCharge: 0,
      consumptionCharge: 0,
      discountApplied: 0,
      totalDue,
      previousUnpaidBalance,
    };
  }

  const ampereCharge =
    billingType === "AMPERE_ONLY" || billingType === "BOTH"
      ? getAmperePriceForTier(subscribedAmpere, ampereTiers)
      : 0;
  const consumptionCharge =
    billingType === "KWH_ONLY" || billingType === "BOTH" ? Math.round(usageKwh * kwhPrice) : 0;
  const totalBefore = ampereCharge + consumptionCharge + previousUnpaidBalance;
  let discountApplied = 0;
  if (fixedDiscountAmount > 0) {
    discountApplied = Math.min(fixedDiscountAmount, totalBefore);
  } else if (fixedDiscountPercent > 0) {
    discountApplied = Math.min(
      Math.round(totalBefore * (fixedDiscountPercent / 100)),
      totalBefore
    );
  }
  const totalDue = Math.max(0, totalBefore - discountApplied);
  return {
    usageKwh,
    amperePriceSnapshot: getAmperePriceForTier(subscribedAmpere, ampereTiers),
    kwhPriceSnapshot: kwhPrice,
    ampereCharge,
    consumptionCharge,
    discountApplied,
    totalDue,
    previousUnpaidBalance,
  };
}

function findServiceAccountJsonInProjectRoot(projectRootPath) {
  const skip = new Set(["package.json", "package-lock.json", "tsconfig.json", "vercel.json"]);
  for (const name of readdirSync(projectRootPath)) {
    if (!name.endsWith(".json") || skip.has(name)) continue;
    const full = resolve(projectRootPath, name);
    try {
      const j = JSON.parse(readFileSync(full, "utf-8"));
      if (j && j.type === "service_account" && typeof j.private_key === "string") return full;
    } catch {
      // ignore
    }
  }
  return null;
}

function loadCredentials(projectRootPath) {
  const tryFile = (p) => {
    if (!p) return null;
    const fullPath = isAbsolute(p) ? p : resolve(projectRootPath, p);
    if (!existsSync(fullPath)) return null;
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  };

  const discovered = findServiceAccountJsonInProjectRoot(projectRootPath);
  const fromPath =
    tryFile(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    tryFile(resolve(projectRootPath, "service-account.json")) ||
    (discovered ? tryFile(discovered) : null);
  if (fromPath) return fromPath;

  const jsonStr = process.env.GOOGLE_CREDENTIALS_JSON;
  if (jsonStr && jsonStr.trim()) return JSON.parse(jsonStr);
  throw new Error("No Google credentials found.");
}

async function ensureMonthlyTariffsSheet(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hasSheet = meta.data.sheets?.some(
    (s) => s.properties?.title === "MonthlyTariffs"
  );
  if (!hasSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: "MonthlyTariffs" } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "MonthlyTariffs!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["monthKey", "kwhPrice", "updatedAt"]] },
    });
  }
}

async function main() {
  loadEnv();
  const monthKey = arg("--month");
  const newKwhPrice = Number(arg("--kwh"));
  const dryRun = process.argv.includes("--dry-run");

  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("Invalid --month. Use YYYY-MM");
  }
  if (!Number.isFinite(newKwhPrice) || newKwhPrice < 0) {
    throw new Error("Invalid --kwh. Provide a non-negative number");
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

  const credentials = loadCredentials(projectRoot);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [billsRes, customersRes, ampRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:R" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:S" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "AmperePrices!A:B" }).catch(() => ({ data: { values: [] } })),
  ]);

  const billRows = (billsRes.data.values || []).slice(1);
  const customerRows = (customersRes.data.values || []).slice(1);
  const ampRows = (ampRes.data.values || []).slice(1);

  const ampereTiers = ampRows
    .map((r) => ({ amp: parseFloat(r[0] || "0") || 0, price: parseFloat(r[1] || "0") || 0 }))
    .filter((t) => t.amp > 0);

  const customerMap = new Map();
  for (const r of customerRows) {
    customerMap.set(String(r[0] || "").trim(), {
      subscribedAmpere: parseFloat(r[7] || "0") || 0,
      billingType: normalizeBillingType(r[8]),
      fixedDiscountAmount: parseFloat(r[9] || "0") || 0,
      fixedDiscountPercent: parseFloat(r[14] || "0") || 0,
      fixedMonthlyPrice: parseFloat(r[18] || "0") || 0,
      isMonitor: r[15] === "true" || r[15] === "1",
    });
  }

  const updatedRowsByIndex = new Map();
  let changed = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < billRows.length; i++) {
    const r = [...billRows[i]];
    while (r.length < 18) r.push("");
    if (String(r[2] || "").trim() !== monthKey) continue;

    const customerId = String(r[1] || "").trim();
    const cust = customerMap.get(customerId);
    if (!cust) continue;

    const billingType = cust.isMonitor ? "FREE" : cust.billingType;
    const previousCounter = parseFloat(r[3] || "0") || 0;
    const currentCounter = parseFloat(r[4] || "0") || 0;
    const totalPaid = parseFloat(r[13] || "0") || 0;
    const previousUnpaidBalance = parseFloat(r[11] || "0") || 0;

    const calc = calcBillFromReadings(
      previousCounter,
      currentCounter,
      cust.subscribedAmpere,
      billingType,
      cust.fixedMonthlyPrice,
      cust.fixedDiscountAmount,
      cust.fixedDiscountPercent,
      ampereTiers,
      newKwhPrice,
      previousUnpaidBalance
    );

    const newRemainingDue = Math.max(0, calc.totalDue - totalPaid);
    const newPaymentStatus = calcPaymentStatus(totalPaid, newRemainingDue);

    const oldTotal = parseFloat(r[12] || "0") || 0;
    const oldKwhSnapshot = parseFloat(r[7] || "0") || 0;
    if (Math.abs(oldTotal - calc.totalDue) > 0.5 || Math.abs(oldKwhSnapshot - newKwhPrice) > 0.5) {
      changed++;
    }

    r[5] = String(calc.usageKwh);
    r[6] = String(calc.amperePriceSnapshot);
    r[7] = String(calc.kwhPriceSnapshot);
    r[8] = String(calc.ampereCharge);
    r[9] = String(calc.consumptionCharge);
    r[10] = String(calc.discountApplied);
    r[11] = String(calc.previousUnpaidBalance);
    r[12] = String(calc.totalDue);
    r[14] = String(newRemainingDue);
    r[15] = newPaymentStatus;
    r[17] = now;

    updatedRowsByIndex.set(i, r);
  }

  console.log(`Month: ${monthKey}`);
  console.log(`New kWh price: ${newKwhPrice}`);
  console.log(`Rows to touch: ${updatedRowsByIndex.size}`);
  console.log(`Rows materially changed: ${changed}`);

  if (dryRun) {
    console.log("[DRY RUN] no sheet writes.");
    return;
  }

  // Single bulk write to avoid Sheets "write requests per minute" quota.
  const finalRows = billRows.map((row, idx) => {
    const existing = [...row];
    while (existing.length < 18) existing.push("");
    return updatedRowsByIndex.get(idx) || existing;
  });
  if (finalRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Bills!A2:R${finalRows.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: finalRows },
    });
  }

  await ensureMonthlyTariffsSheet(sheets, spreadsheetId);
  const tariffRows = (
    await sheets.spreadsheets.values.get({ spreadsheetId, range: "MonthlyTariffs!A:C" })
  ).data.values || [];
  const idx = tariffRows.findIndex((r, i) => i > 0 && String(r[0] || "").trim() === monthKey);
  const tariffRow = [monthKey, String(Math.round(newKwhPrice)), now];
  if (idx === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "MonthlyTariffs!A:A",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [tariffRow] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `MonthlyTariffs!A${idx + 1}:C${idx + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [tariffRow] },
    });
  }

  console.log("✓ Bills updated and MonthlyTariffs upserted.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

