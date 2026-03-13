#!/usr/bin/env node
/**
 * Inspect bills: compare consumptionCharge vs usageKwh × kwhPrice.
 * Usage: node scripts/inspect-bills.mjs [monthKey]
 * Example: node scripts/inspect-bills.mjs 2026-02
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  try {
    const content = readFileSync(resolve(projectRoot, ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        process.env[key] = val;
      }
    }
  } catch (e) {
    console.warn("Could not load .env.local");
  }
}

loadEnv();

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const credPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(projectRoot, "station-490108-55c52b942e8e.json");

async function main() {
  const monthFilter = process.argv[2] || null;
  if (monthFilter && !/^\d{4}-\d{2}$/.test(monthFilter)) {
    console.error("Usage: node scripts/inspect-bills.mjs [YYYY-MM]");
    process.exit(1);
  }

  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID in .env.local");
    process.exit(1);
  }

  const creds = JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [billsRes, settingsRes, customersRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:Z" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Settings!A:Z" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:Z" }),
  ]);

  const billRows = (billsRes.data.values || []).slice(1);
  const settingsRow = (settingsRes.data.values || [])[1];
  const customerRows = (customersRes.data.values || []).slice(1);

  const kwhPriceFromSettings = settingsRow
    ? parseFloat(String(settingsRow[1] || settingsRow[0] || "0")) || 0
    : 0;

  const customerMap = new Map();
  for (const r of customerRows) {
    if (r[0]) customerMap.set(r[0], { fullName: r[1] || "", area: r[3] || "", billingType: r[8] || "" });
  }

  const bills = billRows.map((r, i) => ({
    row: i + 2,
    billId: r[0],
    customerId: r[1],
    monthKey: r[2],
    usageKwh: parseFloat(r[5] || "0") || 0,
    kwhPriceSnapshot: parseFloat(r[7] || "0") || 0,
    consumptionCharge: parseFloat(r[9] || "0") || 0,
  })).filter((b) => b.monthKey && (monthFilter ? b.monthKey === monthFilter : true));

  const withUsage = bills.filter((b) => b.usageKwh > 0);
  const FREE_IDS = new Set(
    customerRows.filter((r) => (r[8] || "").toUpperCase() === "FREE").map((r) => r[0])
  );

  const payingWithUsage = withUsage.filter((b) => !FREE_IDS.has(b.customerId));

  console.log("\n=== Bills inspection ===\n");
  console.log("Settings kwhPrice:", kwhPriceFromSettings);
  console.log("Month filter:", monthFilter || "all");
  console.log("Bills with usageKwh > 0:", withUsage.length, "(paying:", payingWithUsage.length, ")");
  console.log("");

  let totalConsumptionCharge = 0;
  let totalUsageKwh = 0;
  let totalExpectedBySnapshot = 0;
  let totalExpectedBySettings = 0;
  const discrepancies = [];

  for (const b of payingWithUsage) {
    const price = b.kwhPriceSnapshot > 0 ? b.kwhPriceSnapshot : kwhPriceFromSettings;
    const expectedBySnapshot = Math.round(b.usageKwh * (b.kwhPriceSnapshot || price));
    const expectedBySettings = Math.round(b.usageKwh * kwhPriceFromSettings);
    totalConsumptionCharge += b.consumptionCharge;
    totalUsageKwh += b.usageKwh;
    totalExpectedBySnapshot += expectedBySnapshot;
    totalExpectedBySettings += expectedBySettings;

    const diff = b.consumptionCharge - expectedBySettings;
    if (Math.abs(diff) > 1) {
      const cust = customerMap.get(b.customerId) || {};
      discrepancies.push({
        ...b,
        custName: cust.fullName,
        area: cust.area,
        expected: expectedBySettings,
        diff,
      });
    }
  }

  console.log("--- Totals (paying, usage > 0) ---");
  console.log("Sum consumptionCharge:", totalConsumptionCharge.toLocaleString(), "LBP");
  console.log("Sum usageKwh:", totalUsageKwh.toLocaleString());
  console.log("Expected (usageKwh × Settings kwhPrice):", totalExpectedBySettings.toLocaleString(), "LBP");
  console.log("Expected (usageKwh × avg if all 33268):", Math.round(totalUsageKwh * 33268).toLocaleString(), "LBP");
  console.log("Difference:", (totalConsumptionCharge - totalExpectedBySettings).toLocaleString(), "LBP");
  console.log("");

  if (discrepancies.length > 0) {
    console.log(`--- ${discrepancies.length} bills where consumptionCharge ≠ usageKwh × ${kwhPriceFromSettings} ---\n`);
    const byDiff = [...discrepancies].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    for (const d of byDiff.slice(0, 15)) {
      console.log(
        `  ${d.monthKey} | ${(d.custName || d.customerId).slice(0, 25).padEnd(25)} | ` +
        `usage: ${d.usageKwh} | kwhSnapshot: ${d.kwhPriceSnapshot} | ` +
        `consumptionCharge: ${d.consumptionCharge.toLocaleString()} | ` +
        `expected: ${d.expected.toLocaleString()} | diff: ${d.diff.toLocaleString()}`
      );
    }
    if (byDiff.length > 15) {
      console.log(`  ... and ${byDiff.length - 15} more`);
    }
  } else if (payingWithUsage.length > 0) {
    console.log("All bills match usageKwh × kwhPrice.");
  }

  const snapshotZeros = payingWithUsage.filter((b) => b.kwhPriceSnapshot === 0);
  if (snapshotZeros.length > 0) {
    console.log("\n--- kwhPriceSnapshot = 0 ---");
    console.log(`${snapshotZeros.length} paying bills have kwhPriceSnapshot = 0`);
  }

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
