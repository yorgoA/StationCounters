#!/usr/bin/env node
/**
 * Output dashboard numbers for a month (same logic as Manager Dashboard).
 * Usage: node scripts/dashboard-check.mjs [YYYY-MM]
 * Example: node scripts/dashboard-check.mjs 2026-02
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  try {
    const c = readFileSync(resolve(projectRoot, ".env.local"), "utf-8");
    for (const line of c.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch (e) {}
}

loadEnv();

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const credPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(projectRoot, "station-490108-55c52b942e8e.json");

function parseBill(r) {
  return {
    billId: r[0],
    customerId: r[1],
    monthKey: r[2],
    usageKwh: parseFloat(r[5] || "0") || 0,
    ampereCharge: parseFloat(r[8] || "0") || 0,
    consumptionCharge: parseFloat(r[9] || "0") || 0,
    totalDue: parseFloat(r[12] || "0") || 0,
    totalPaid: parseFloat(r[13] || "0") || 0,
    remainingDue: parseFloat(r[14] || "0") || 0,
  };
}

function parseCustomer(r) {
  return {
    customerId: r[0],
    status: (r[10] || "ACTIVE").toUpperCase(),
    billingType: (r[8] || "").toUpperCase(),
    isMonitor: r[15] === "true" || r[15] === "1",
  };
}

async function main() {
  const monthKey = process.argv[2] || null;
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    console.error("Usage: node scripts/dashboard-check.mjs YYYY-MM");
    process.exit(1);
  }

  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [billsRes, customersRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:Z" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:Z" }),
  ]);

  const billRows = (billsRes.data.values || []).slice(1);
  const customerRows = (customersRes.data.values || []).slice(1);

  const bills = billRows.map((r) => parseBill(r)).filter((b) => b.monthKey);
  const customers = customerRows.map((r) => parseCustomer(r)).filter((c) => c.customerId);

  const freeIds = new Set(customers.filter((c) => c.billingType === "FREE").map((c) => c.customerId));
  const monitorIds = new Set(customers.filter((c) => c.isMonitor).map((c) => c.customerId));
  const excludedIds = new Set([...freeIds, ...monitorIds]);
  const monthBills = bills.filter((b) => b.monthKey === monthKey);
  const payingBills = monthBills.filter((b) => !excludedIds.has(b.customerId));
  const allPayingBills = bills.filter((b) => !excludedIds.has(b.customerId));
  const previousPayingBills = allPayingBills.filter((b) => b.monthKey < monthKey && b.remainingDue > 0);

  const totalBilled = payingBills.reduce((s, b) => s + b.totalDue, 0);
  const totalCollected = payingBills.reduce((s, b) => s + b.totalPaid, 0);
  const unpaidThisMonth = payingBills.reduce((s, b) => s + b.remainingDue, 0);
  const unpaidPreviousMonths = previousPayingBills.reduce((s, b) => s + b.remainingDue, 0);
  const totalAmpereBilled = payingBills.reduce((s, b) => s + b.ampereCharge, 0);
  const totalConsumptionBilled = payingBills.reduce((s, b) => s + b.consumptionCharge, 0);
  const totalKwhPaying = payingBills.reduce((s, b) => s + b.usageKwh, 0);
  const totalKwhAllTime = bills.reduce((s, b) => s + b.usageKwh, 0);
  const unpaidCount = payingBills.filter((b) => b.remainingDue > 0).length;

  console.log("\n=== Dashboard numbers for", monthKey, "===\n");
  console.log("Total Billed:        ", totalBilled.toLocaleString(), "LBP");
  console.log("Collected:           ", totalCollected.toLocaleString(), "LBP");
  console.log("Unpaid This Month:   ", unpaidThisMonth.toLocaleString(), "LBP");
  console.log("Unpaid Previous:     ", unpaidPreviousMonths.toLocaleString(), "LBP");
  console.log("Total Unpaid:        ", (unpaidThisMonth + unpaidPreviousMonths).toLocaleString(), "LBP");
  console.log("Unpaid count:        ", unpaidCount);
  console.log("");
  console.log("From Ampere:         ", totalAmpereBilled.toLocaleString(), "LBP");
  console.log("From Consumption:    ", totalConsumptionBilled.toLocaleString(), "LBP");
  console.log("kWh (paying):        ", totalKwhPaying.toLocaleString());
  console.log("Total kWh (all time):", totalKwhAllTime.toLocaleString());
  console.log("\nCompare these with the dashboard. Values come from the Bills sheet.\n");
  console.log("NOTE: Discounts in the Customers sheet affect only NEW bills (Record Reading).");
  console.log("Existing bills keep their stored totalDue/ampereCharge/consumptionCharge.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
