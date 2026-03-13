#!/usr/bin/env node
/**
 * Recalculate consumptionCharge for all bills using Settings kwhPrice.
 * Fixes bills that were imported with wrong rates (e.g. kwhPrice=0).
 *
 * For each PAYING bill: consumptionCharge = usageKwh × kwhPrice (for KWH_ONLY/BOTH).
 * Then recalculates: discountApplied, totalDue, remainingDue, paymentStatus.
 * FREE customers: no change (consumptionCharge stays 0).
 *
 * Usage: node scripts/fix-bills-consumption.mjs [--dry-run]
 *   --dry-run: show what would change, don't write to Sheets
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

function calcConsumptionCharge(usageKwh, kwhPrice, billingType) {
  if (billingType === "FREE") return 0;
  if (billingType === "KWH_ONLY" || billingType === "BOTH") {
    return Math.round(usageKwh * kwhPrice);
  }
  return 0;
}

function calcEffectiveDiscount(totalBeforeDiscount, fixedDiscountAmount, fixedDiscountPercent) {
  if (fixedDiscountAmount > 0) return Math.min(fixedDiscountAmount, totalBeforeDiscount);
  if (fixedDiscountPercent > 0) {
    const byPercent = Math.round(totalBeforeDiscount * (fixedDiscountPercent / 100));
    return Math.min(byPercent, totalBeforeDiscount);
  }
  return 0;
}

function calcPaymentStatus(totalPaid, remainingDue) {
  if (remainingDue <= 0) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  return "UNPAID";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID in .env.local");
    process.exit(1);
  }

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(projectRoot, "station-490108-55c52b942e8e.json");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [billsRes, settingsRes, customersRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:R" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Settings!A:Z" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:Z" }),
  ]);

  const billRows = (billsRes.data.values || []).slice(1);
  const settingsRow = (settingsRes.data.values || [])[1];
  const customerRows = (customersRes.data.values || []).slice(1);

  const kwhPrice = settingsRow
    ? parseFloat(String(settingsRow[1] || settingsRow[0] || "0")) || 0
    : 0;

  if (kwhPrice <= 0) {
    console.error("Settings kwhPrice is 0 or missing. Cannot fix bills.");
    process.exit(1);
  }

  const customerMap = new Map();
  for (const r of customerRows) {
    if (!r[0]) continue;
    customerMap.set(r[0], {
      billingType: (r[8] || "BOTH").toUpperCase(),
      fixedDiscountAmount: parseFloat(r[9] || "0") || 0,
      fixedDiscountPercent: parseFloat(r[14] || "0") || 0,
    });
  }

  let updatedCount = 0;
  let changedRows = [];
  const newRows = [];

  for (let i = 0; i < billRows.length; i++) {
    const r = billRows[i];
    const rowNum = i + 2; // 1-based, + header
    const customerId = r[1] || "";
    const cust = customerMap.get(customerId) || {
      billingType: "BOTH",
      fixedDiscountAmount: 0,
      fixedDiscountPercent: 0,
    };

    const usageKwh = parseFloat(r[5] || "0") || 0;
    const ampereCharge = parseFloat(r[8] || "0") || 0;
    const previousUnpaidBalance = parseFloat(r[11] || "0") || 0;
    const totalPaid = parseFloat(r[13] || "0") || 0;

    const oldConsumptionCharge = parseFloat(r[9] || "0") || 0;
    const oldKwhSnapshot = parseFloat(r[7] || "0") || 0;
    const oldTotalDue = parseFloat(r[12] || "0") || 0;
    const oldRemainingDue = parseFloat(r[14] || "0") || 0;

    const newConsumptionCharge = calcConsumptionCharge(
      usageKwh,
      kwhPrice,
      cust.billingType
    );
    const totalBeforeDiscount =
      ampereCharge + newConsumptionCharge + previousUnpaidBalance;
    const discountApplied = calcEffectiveDiscount(
      totalBeforeDiscount,
      cust.fixedDiscountAmount,
      cust.fixedDiscountPercent
    );
    const newTotalDue = Math.max(0, totalBeforeDiscount - discountApplied);
    const newRemainingDue = Math.max(0, newTotalDue - totalPaid);
    const newPaymentStatus = calcPaymentStatus(totalPaid, newRemainingDue);

    const changed =
      Math.abs(oldConsumptionCharge - newConsumptionCharge) > 1 ||
      Math.abs(oldTotalDue - newTotalDue) > 1;

    if (changed) {
      updatedCount++;
      changedRows.push({
        row: rowNum,
        customerId,
        monthKey: r[2],
        usageKwh,
        oldConsumptionCharge,
        newConsumptionCharge,
        oldTotalDue,
        newTotalDue,
      });
    }

    const newRow = [...r];
    while (newRow.length < 18) newRow.push("");
    newRow[7] = String(kwhPrice); // kwhPriceSnapshot
    newRow[9] = String(newConsumptionCharge); // consumptionCharge
    newRow[10] = String(discountApplied); // discountApplied
    newRow[12] = String(newTotalDue); // totalDue
    newRow[14] = String(newRemainingDue); // remainingDue
    newRow[15] = newPaymentStatus; // paymentStatus
    newRow[17] = new Date().toISOString(); // updatedAt
    newRows.push(newRow);
  }

  console.log("\n=== Fix bills consumption ===\n");
  console.log("Settings kwhPrice:", kwhPrice);
  console.log("Bills to process:", billRows.length);
  console.log("Bills with changes:", updatedCount);
  console.log("");

  if (changedRows.length > 0) {
    console.log("Sample changes (first 10):");
    for (const c of changedRows.slice(0, 10)) {
      console.log(
        `  Row ${c.row} | ${c.monthKey} | ${c.customerId.slice(0, 20)} | ` +
          `usage: ${c.usageKwh} kWh | consumptionCharge: ${c.oldConsumptionCharge.toLocaleString()} → ${c.newConsumptionCharge.toLocaleString()} | ` +
          `totalDue: ${c.oldTotalDue.toLocaleString()} → ${c.newTotalDue.toLocaleString()}`
      );
    }
    if (changedRows.length > 10) {
      console.log(`  ... and ${changedRows.length - 10} more`);
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes written. Run without --dry-run to apply.\n");
    return;
  }

  if (billRows.length === 0) {
    console.log("No bills to update.\n");
    return;
  }

  const range = `Bills!A2:R${1 + billRows.length}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: newRows },
  });

  console.log("\n✓ Updated Bills sheet.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
