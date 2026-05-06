#!/usr/bin/env node
/**
 * Import Printania customers from worksheet CSV and optional legacy balances CSV.
 *
 * Default behavior is dry-run. Use --apply to write to Google Sheets.
 *
 * Usage:
 *   node scripts/import-printania.mjs
 *   node scripts/import-printania.mjs --apply
 *   node scripts/import-printania.mjs --worksheet "Worksheet-Table 1.csv" --balances "old total-Table 1.csv"
 *   node scripts/import-printania.mjs --month=2026-04 --legacy-month=2026-02 --apply
 */

import { readFileSync } from "fs";
import { dirname, isAbsolute, resolve } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  for (const envName of [".env.local", ".env"]) {
    try {
      const content = readFileSync(resolve(projectRoot, envName), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, fallback = "") => {
    const hit = args.find((x) => x.startsWith(`${flag}=`));
    if (hit) return hit.slice(flag.length + 1);
    const i = args.indexOf(flag);
    if (i >= 0 && args[i + 1]) return args[i + 1];
    return fallback;
  };

  return {
    worksheet: get("--worksheet", "Worksheet-Table 1.csv"),
    balances: get("--balances", "old total-Table 1.csv"),
    monthKey: get("--month", "2026-04"),
    legacyMonthKey: get("--legacy-month", "2026-02"),
    apply: args.includes("--apply"),
  };
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumeric(value) {
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseUsdFromLegacy(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return 0;
  const normalized = trimmed
    .replace(/US\$/gi, "")
    .replace(/\u202f/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function generateId(prefix = "id") {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function findBestMatch(normalizedName, keyMap) {
  const exact = keyMap.get(normalizedName);
  if (exact) return exact;
  let best = { distance: Number.POSITIVE_INFINITY, id: "" };
  for (const [k, id] of keyMap.entries()) {
    if (!k) continue;
    if (k.includes(normalizedName) || normalizedName.includes(k)) {
      return id;
    }
    const d = levenshtein(normalizedName, k);
    if (d < best.distance) best = { distance: d, id };
  }
  return best.distance <= 3 ? best.id : "";
}

function getAmperePriceForTier(subscribedAmpere, tiers) {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.amp - b.amp);
  const exact = sorted.find((t) => t.amp === subscribedAmpere);
  if (exact) return exact.price;
  const lower = sorted.filter((t) => t.amp <= subscribedAmpere);
  return lower.length > 0 ? lower[lower.length - 1].price : sorted[0].price;
}

function parseWorksheetRows(worksheetPath) {
  const lines = readFileSync(worksheetPath, "utf-8").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.toLowerCase().includes("client name;building;discount as value;free;subscription type;amps;counter previous;counter now")
  );
  if (headerIndex < 0) {
    throw new Error(`Worksheet header not found in ${worksheetPath}`);
  }

  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const parts = line.split(";").map((x) => x.trim());
    const clientName = parts[0] || "";
    if (!clientName) continue;
    rows.push({
      clientName,
      box: parts[1] || "",
      discountValue: parseNumeric(parts[2] || "0"),
      freeField: parts[3] || "",
      subscriptionTypeRaw: parts[4] || "",
      amps: parseNumeric(parts[5] || "0"),
      counterPrevious: parseNumeric(parts[6] || "0"),
      counterNow: parseNumeric(parts[7] || "0"),
    });
  }
  return rows;
}

function parseLegacyRows(legacyPath) {
  const lines = readFileSync(legacyPath, "utf-8").split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(2)) {
    if (!line.trim()) continue;
    const parts = line.split(";").map((x) => x.trim());
    const name = parts[0] || "";
    const usd = parseUsdFromLegacy(parts[1] || "");
    if (!name || usd <= 0) continue;
    rows.push({ name, usd });
  }
  return rows;
}

function detectBillingType(subscriptionTypeRaw, freeField) {
  const subscription = String(subscriptionTypeRaw || "").toLowerCase();
  const freeRaw = String(freeField || "").toLowerCase();
  const isMonitor = freeRaw.includes("monitor for");
  const isFree = freeRaw === "free" || freeRaw.includes("free");

  if (isMonitor) return "FREE";
  if (isFree) return "FREE";
  if (subscription.includes("fixed")) return "AMPERE_ONLY";
  return "BOTH";
}

function parseMonitorTarget(freeField) {
  const value = String(freeField || "").trim();
  const m = value.match(/monitor\s+for\s+(.+)$/i);
  if (!m) return "";
  return String(m[1] || "").trim();
}

function customerToRow(c) {
  return [
    c.customerId,
    c.fullName,
    c.phone,
    c.area,
    c.building,
    c.floor,
    c.apartmentNumber,
    String(c.subscribedAmpere),
    c.billingType,
    String(c.fixedDiscountAmount),
    c.status,
    c.notes,
    c.createdAt,
    c.freeReason,
    String(c.fixedDiscountPercent),
    c.isMonitor ? "true" : "false",
    (c.linkedCustomerIds && c.linkedCustomerIds.length > 0) ? c.linkedCustomerIds.join(",") : "",
    c.monitorCategory,
    String(c.fixedMonthlyPrice),
    c.region,
  ];
}

function billToRow(b) {
  return [
    b.billId,
    b.customerId,
    b.monthKey,
    String(b.previousCounter),
    String(b.currentCounter),
    String(b.usageKwh),
    String(b.amperePriceSnapshot),
    String(b.kwhPriceSnapshot),
    String(b.ampereCharge),
    String(b.consumptionCharge),
    String(b.discountApplied),
    String(b.previousUnpaidBalance),
    String(b.totalDue),
    String(b.totalPaid),
    String(b.remainingDue),
    b.paymentStatus,
    b.createdAt,
    b.updatedAt,
    b.billingTypeSnapshot || "",
    String(b.subscribedAmpereSnapshot || 0),
    String(b.fixedMonthlyPriceSnapshot || 0),
  ];
}

function monthLooksValid(monthKey) {
  return /^\d{4}-\d{2}$/.test(monthKey || "");
}

async function getSheetsClient() {
  loadEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./station-490108-55c52b942e8e.json";
  const credFullPath = isAbsolute(credPath) ? credPath : resolve(projectRoot, credPath);
  const creds = JSON.parse(readFileSync(credFullPath, "utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
  };
}

function mapRowByHeader(header, row) {
  const out = {};
  for (let i = 0; i < header.length; i++) out[String(header[i] || "").trim()] = row[i] || "";
  return out;
}

async function main() {
  const { worksheet, balances, monthKey, legacyMonthKey, apply } = parseArgs();
  if (!monthLooksValid(monthKey) || !monthLooksValid(legacyMonthKey)) {
    throw new Error("Month keys must be in YYYY-MM format.");
  }

  const worksheetPath = isAbsolute(worksheet) ? worksheet : resolve(projectRoot, worksheet);
  const balancesPath = isAbsolute(balances) ? balances : resolve(projectRoot, balances);

  const worksheetRows = parseWorksheetRows(worksheetPath);
  const legacyRows = parseLegacyRows(balancesPath);
  const { sheets, spreadsheetId } = await getSheetsClient();

  const [customersRes, billsRes, settingsRes, ampereRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:T" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:Z" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Settings!A:Z" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "AmperePrices!A:Z" }),
  ]);

  const customerValues = customersRes.data.values || [];
  const billValues = billsRes.data.values || [];
  const customerHeader = customerValues[0] || [];
  const billHeader = billValues[0] || [];
  const customers = customerValues.slice(1).map((row) => mapRowByHeader(customerHeader, row));
  const bills = billValues.slice(1).map((row) => mapRowByHeader(billHeader, row));

  const settingsRow = (settingsRes.data.values || [])[1] || [];
  const kwhPrice = parseNumeric(settingsRow[1] || settingsRow[0] || "0");
  const usdRate = parseNumeric(settingsRow[4] || "89700") || 89700;
  const ampereTiers = (ampereRes.data.values || [])
    .slice(1)
    .map((r) => ({ amp: parseNumeric(r[0] || "0"), price: parseNumeric(r[1] || "0") }))
    .filter((t) => t.amp > 0);

  const existingByNameAndRegion = new Map();
  for (const c of customers) {
    const name = normalizeName(c.fullName || c["fullName"]);
    const region = String(c.region || "MRAH_GHANEM").trim().toUpperCase();
    if (!name) continue;
    existingByNameAndRegion.set(`${name}::${region}`, c);
  }

  const existingBillsByCustomerMonth = new Set(
    bills.map((b) => `${String(b.customerId || "").trim()}::${String(b.monthKey || "").trim()}`)
  );

  const now = new Date().toISOString();
  const stagingRows = worksheetRows.map((r) => {
    const nameNorm = normalizeName(r.clientName);
    const freeRaw = String(r.freeField || "").trim();
    const isMonitor = freeRaw.toLowerCase().includes("monitor for");
    const monitorTargetName = parseMonitorTarget(r.freeField);
    const billingType = detectBillingType(r.subscriptionTypeRaw, r.freeField);
    const key = `${nameNorm}::PRINTANIA`;
    const existing = existingByNameAndRegion.get(key);
    const customerId = existing ? String(existing.customerId || "").trim() : generateId("cust");
    const subscribedAmpere = Math.max(0, Math.round(r.amps || 0));
    const previousCounter = Math.max(0, r.counterPrevious || 0);
    const currentCounter = Math.max(0, r.counterNow || 0);
    const usageKwh = Math.max(0, currentCounter - previousCounter);
    const amperePriceSnapshot = getAmperePriceForTier(subscribedAmpere, ampereTiers);
    const fixedDiscountAmount = Math.max(0, Math.round(r.discountValue || 0));

    let ampereCharge = 0;
    let consumptionCharge = 0;
    let discountApplied = 0;
    let totalDue = 0;
    if (billingType === "BOTH") {
      ampereCharge = amperePriceSnapshot;
      consumptionCharge = Math.round(usageKwh * kwhPrice);
      const base = ampereCharge + consumptionCharge;
      discountApplied = Math.min(base, fixedDiscountAmount);
      totalDue = Math.max(0, base - discountApplied);
    } else if (billingType === "AMPERE_ONLY") {
      ampereCharge = amperePriceSnapshot;
      const base = ampereCharge;
      discountApplied = Math.min(base, fixedDiscountAmount);
      totalDue = Math.max(0, base - discountApplied);
    }

    return {
      raw: r,
      nameNorm,
      customerId,
      existed: Boolean(existing),
      isMonitor,
      monitorTargetName,
      customer: {
        customerId,
        fullName: r.clientName.trim(),
        phone: "",
        area: r.box,
        building: r.box,
        floor: "",
        apartmentNumber: "",
        subscribedAmpere,
        billingType,
        fixedDiscountAmount,
        fixedDiscountPercent: 0,
        status: "ACTIVE",
        notes: "",
        createdAt: existing ? String(existing.createdAt || now) : now,
        freeReason: isMonitor ? "monitor" : (billingType === "FREE" ? "free" : ""),
        isMonitor,
        linkedCustomerIds: [],
        monitorCategory: isMonitor ? "theftcontroller" : "",
        fixedMonthlyPrice: 0,
        region: "PRINTANIA",
      },
      aprilBill: {
        billId: generateId("bill"),
        customerId,
        monthKey,
        previousCounter,
        currentCounter,
        usageKwh,
        amperePriceSnapshot,
        kwhPriceSnapshot: kwhPrice,
        ampereCharge: billingType === "FREE" ? 0 : ampereCharge,
        consumptionCharge: billingType === "FREE" ? 0 : consumptionCharge,
        discountApplied: billingType === "FREE" ? 0 : discountApplied,
        previousUnpaidBalance: 0,
        totalDue: billingType === "FREE" ? 0 : totalDue,
        totalPaid: 0,
        remainingDue: billingType === "FREE" ? 0 : totalDue,
        paymentStatus: (billingType === "FREE" || totalDue <= 0) ? "PAID" : "UNPAID",
        createdAt: now,
        updatedAt: now,
        billingTypeSnapshot: billingType,
        subscribedAmpereSnapshot: subscribedAmpere,
        fixedMonthlyPriceSnapshot: 0,
      },
    };
  });

  const allCustomerRefs = new Map();
  for (const c of customers) {
    const id = String(c.customerId || "").trim();
    const nameNorm = normalizeName(c.fullName || "");
    if (id && nameNorm) allCustomerRefs.set(nameNorm, id);
  }
  for (const s of stagingRows) {
    if (s.nameNorm) allCustomerRefs.set(s.nameNorm, s.customerId);
  }
  for (const s of stagingRows) {
    if (!s.isMonitor || !s.monitorTargetName) continue;
    const targetId = findBestMatch(normalizeName(s.monitorTargetName), allCustomerRefs);
    if (targetId) s.customer.linkedCustomerIds = [targetId];
  }

  const customersToAppend = stagingRows
    .filter((s) => !s.existed)
    .map((s) => customerToRow(s.customer));

  const aprilBillsToAppend = stagingRows
    .filter((s) => !existingBillsByCustomerMonth.has(`${s.customerId}::${monthKey}`))
    .map((s) => billToRow(s.aprilBill));

  const customerIdByNorm = new Map();
  for (const s of stagingRows) customerIdByNorm.set(s.nameNorm, s.customerId);
  for (const c of customers) customerIdByNorm.set(normalizeName(c.fullName || ""), String(c.customerId || ""));

  const legacyUnresolved = [];
  const legacyBillsToAppend = [];
  for (const row of legacyRows) {
    const normalized = normalizeName(row.name);
    const customerId = findBestMatch(normalized, customerIdByNorm);
    if (!customerId) {
      legacyUnresolved.push({ name: row.name, usd: row.usd });
      continue;
    }
    const key = `${customerId}::${legacyMonthKey}`;
    if (existingBillsByCustomerMonth.has(key)) continue;

    const totalDue = Math.max(0, Math.round(row.usd * usdRate));
    if (totalDue <= 0) continue;
    legacyBillsToAppend.push(
      billToRow({
        billId: generateId("bill"),
        customerId,
        monthKey: legacyMonthKey,
        previousCounter: 0,
        currentCounter: 0,
        usageKwh: 0,
        amperePriceSnapshot: 0,
        kwhPriceSnapshot: kwhPrice,
        ampereCharge: 0,
        consumptionCharge: 0,
        discountApplied: 0,
        previousUnpaidBalance: 0,
        totalDue,
        totalPaid: 0,
        remainingDue: totalDue,
        paymentStatus: "UNPAID",
        createdAt: now,
        updatedAt: now,
        billingTypeSnapshot: "BOTH",
        subscribedAmpereSnapshot: 0,
        fixedMonthlyPriceSnapshot: 0,
      })
    );
  }

  if (apply) {
    if (customersToAppend.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Customers!A:A",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: customersToAppend },
      });
    }
    const allBillsToAppend = [...aprilBillsToAppend, ...legacyBillsToAppend];
    if (allBillsToAppend.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Bills!A:A",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: allBillsToAppend },
      });
    }
  }

  const linkedMonitors = stagingRows.filter((s) => s.isMonitor && s.customer.linkedCustomerIds.length > 0).length;
  const unlinkedMonitors = stagingRows.filter((s) => s.isMonitor && s.customer.linkedCustomerIds.length === 0).map((s) => ({
    monitorName: s.customer.fullName,
    targetName: s.monitorTargetName,
  }));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        monthKey,
        legacyMonthKey,
        worksheetRows: worksheetRows.length,
        legacyRows: legacyRows.length,
        usdRate,
        kwhPrice,
        counts: {
          customersNew: customersToAppend.length,
          customersExistingSkipped: stagingRows.length - customersToAppend.length,
          aprilBillsToCreate: aprilBillsToAppend.length,
          legacyBillsToCreate: legacyBillsToAppend.length,
          monitorsLinked: linkedMonitors,
          monitorsUnlinked: unlinkedMonitors.length,
          legacyUnresolved: legacyUnresolved.length,
        },
        monitorsUnlinked: unlinkedMonitors.slice(0, 20),
        legacyUnresolved: legacyUnresolved.slice(0, 50),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
