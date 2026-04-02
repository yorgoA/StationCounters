#!/usr/bin/env node
/**
 * Verify month kWh metrics against Google Sheets source data.
 *
 * Metrics:
 * - payingKwh
 * - freeCustomersKwh
 * - monitorExcessKwh (red match)
 * - totalKwhProduced = paying + free + monitorExcess
 *
 * Usage:
 *   node scripts/check-kwh-metrics.mjs --month 2026-03
 *   npm run check-kwh-metrics -- --month 2026-03
 */

import { existsSync, readFileSync, readdirSync } from "fs";
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
      // ignore missing env file
    }
  }
}

function arg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return String(process.argv[idx + 1] || "").trim();
}

function normalizeBillingType(raw) {
  const t = String(raw || "").trim().toUpperCase();
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

function parseBillingTypeSnapshot(raw) {
  const t = String(raw || "").trim().toUpperCase();
  if (
    t === "AMPERE_ONLY" ||
    t === "KWH_ONLY" ||
    t === "BOTH" ||
    t === "FREE" ||
    t === "FIXED_MONTHLY"
  ) {
    return t;
  }
  return undefined;
}

function parseLinkedCustomerIds(val) {
  if (!val || !String(val).trim()) return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
      // ignore non-credentials json
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

function isExcludedFromCollection(bill, customer) {
  if (customer?.isMonitor) return true;
  if (bill.billingTypeSnapshot === "FREE") return true;
  if (!bill.billingTypeSnapshot && !(bill.totalDue > 0)) return true;
  return false;
}

async function main() {
  loadEnv();
  const monthKey = arg("--month", "");
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("Invalid --month. Use YYYY-MM (example: 2026-03)");
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

  const credentials = loadCredentials(projectRoot);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [billsRes, customersRes, settingsRes, tariffsRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:U" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:S" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Settings!A:E" }).catch(() => ({ data: { values: [] } })),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "MonthlyTariffs!A:C" }).catch(() => ({ data: { values: [] } })),
  ]);

  const billRows = (billsRes.data.values || []).slice(1);
  const customerRows = (customersRes.data.values || []).slice(1);
  const settingsRows = (settingsRes.data.values || []).slice(1);
  const tariffRows = (tariffsRes.data.values || []).slice(1);

  const customers = customerRows.map((r) => ({
    customerId: String(r[0] || "").trim(),
    billingType: normalizeBillingType(r[8]),
    fixedMonthlyPrice: parseFloat(r[18] || "0") || 0,
    isMonitor: r[15] === "true" || r[15] === "1",
    linkedCustomerId: String(r[16] || "").trim() || undefined,
    linkedCustomerIds: parseLinkedCustomerIds(r[16]),
  }));

  const bills = billRows.map((r) => ({
    billId: String(r[0] || "").trim(),
    customerId: String(r[1] || "").trim(),
    monthKey: String(r[2] || "").trim(),
    usageKwh: parseFloat(r[5] || "0") || 0,
    totalDue: parseFloat(r[12] || "0") || 0,
    billingTypeSnapshot: parseBillingTypeSnapshot(r[18]),
  }));

  const customerMap = new Map(customers.map((c) => [c.customerId, c]));
  const monthBills = bills.filter((b) => b.monthKey === monthKey);
  const billByCustomer = new Map(monthBills.map((b) => [b.customerId, b]));

  const settings = settingsRows[0] || [];
  const fallbackKwh = parseFloat(settings[1] || "0") || 0;
  const tariff = tariffRows.find((r) => String(r[0] || "").trim() === monthKey);
  const kwhPrice = tariff ? parseFloat(tariff[1] || "0") || 0 : fallbackKwh;

  const freeIds = new Set(
    customers.filter((c) => c.billingType === "FREE" && !c.isMonitor).map((c) => c.customerId)
  );
  const monitorRows = customers.filter((c) => c.isMonitor);

  const payingBills = monthBills.filter((b) => !isExcludedFromCollection(b, customerMap.get(b.customerId)));
  const payingKwh = payingBills.reduce((s, b) => s + b.usageKwh, 0);

  const freeBills = monthBills.filter((b) => freeIds.has(b.customerId));
  const freeCustomersKwh = freeBills.reduce((s, b) => s + b.usageKwh, 0);

  const monitorExcessKwh = monitorRows.reduce((sum, monitor) => {
    const links = monitor.linkedCustomerIds?.length
      ? monitor.linkedCustomerIds
      : monitor.linkedCustomerId
        ? [monitor.linkedCustomerId]
        : [];
    if (links.length === 0) return sum;

    const monitorBill = billByCustomer.get(monitor.customerId);
    const firstLinkedBill = billByCustomer.get(links[0]);
    const monitorUsage = (monitorBill ?? firstLinkedBill)?.usageKwh ?? 0;

    const included = links.reduce((acc, linkedId) => {
      const linked = customerMap.get(linkedId);
      if (!linked) return acc;
      if (linked.billingType !== "FIXED_MONTHLY" || linked.isMonitor) return acc;
      return acc + (kwhPrice > 0 ? linked.fixedMonthlyPrice / kwhPrice : 0);
    }, 0);

    return sum + Math.max(0, monitorUsage - included);
  }, 0);

  const totalKwhProduced = payingKwh + freeCustomersKwh + monitorExcessKwh;

  console.log(`\nMonth: ${monthKey}`);
  console.log(`kWh price used: ${kwhPrice.toLocaleString()} LBP`);
  console.log("");
  console.log(`payingKwh:         ${payingKwh.toLocaleString(undefined, { maximumFractionDigits: 3 })} kWh`);
  console.log(`freeCustomersKwh:  ${freeCustomersKwh.toLocaleString(undefined, { maximumFractionDigits: 3 })} kWh`);
  console.log(`monitorExcessKwh:  ${monitorExcessKwh.toLocaleString(undefined, { maximumFractionDigits: 3 })} kWh`);
  console.log("------------------------------------------------------------");
  console.log(`totalKwhProduced:  ${totalKwhProduced.toLocaleString(undefined, { maximumFractionDigits: 3 })} kWh`);
  console.log("");
  console.log(`Counts -> monthBills: ${monthBills.length}, payingBills: ${payingBills.length}, freeBills: ${freeBills.length}, monitors: ${monitorRows.length}`);
  console.log(`Reference month now: ${getCurrentMonthKey()}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

