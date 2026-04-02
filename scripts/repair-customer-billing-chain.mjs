#!/usr/bin/env node
/**
 * Repair one customer's monthly bill chain using month profile history.
 *
 * Usage:
 *   node scripts/repair-customer-billing-chain.mjs --customerId cust_xxx --from 2026-01 --dry-run
 *   node scripts/repair-customer-billing-chain.mjs --customerId cust_xxx --from 2026-01
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    try {
      const c = readFileSync(resolve(projectRoot, name), "utf-8");
      for (const line of c.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}
loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const customerId = args[args.indexOf("--customerId") + 1];
  const from = args.includes("--from") ? args[args.indexOf("--from") + 1] : "0000-00";
  const dryRun = args.includes("--dry-run");
  if (!customerId) {
    throw new Error("Missing --customerId");
  }
  return { customerId, from, dryRun };
}

function calcPaymentStatus(totalPaid, remainingDue) {
  if (remainingDue <= 0) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  return "UNPAID";
}

async function main() {
  const { customerId, from, dryRun } = parseArgs();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(projectRoot, "station-490108-55c52b942e8e.json");

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [billsRes, customersRes, histRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:U" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:S" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "CustomerBillingHistory!A:L" }).catch(() => ({ data: { values: [] } })),
  ]);

  const allBills = (billsRes.data.values || []).slice(1);
  const allCustomers = (customersRes.data.values || []).slice(1);
  const allHistory = (histRes.data.values || []).slice(1);

  const cRow = allCustomers.find((r) => String(r[0] || "").trim() === customerId);
  if (!cRow) throw new Error(`Customer not found: ${customerId}`);

  const customerFallback = {
    billingType: String(cRow[8] || "BOTH").trim(),
    subscribedAmpere: parseFloat(cRow[7] || "0") || 0,
    fixedMonthlyPrice: parseFloat(cRow[18] || "0") || 0,
    fixedDiscountAmount: parseFloat(cRow[9] || "0") || 0,
    fixedDiscountPercent: parseFloat(cRow[14] || "0") || 0,
    isMonitor: cRow[15] === "true" || cRow[15] === "1",
  };

  const historyMap = new Map(
    allHistory
      .filter((r) => String(r[1] || "").trim() === customerId)
      .map((r) => [
        String(r[2] || "").trim(),
        {
          billingType: String(r[3] || customerFallback.billingType).trim(),
          subscribedAmpere: parseFloat(r[4] || String(customerFallback.subscribedAmpere)) || 0,
          fixedMonthlyPrice: parseFloat(r[5] || String(customerFallback.fixedMonthlyPrice)) || 0,
          fixedDiscountAmount: parseFloat(r[6] || String(customerFallback.fixedDiscountAmount)) || 0,
          fixedDiscountPercent: parseFloat(r[7] || String(customerFallback.fixedDiscountPercent)) || 0,
          isMonitor: r[8] === "true" || r[8] === "1",
        },
      ])
  );

  const customerBills = allBills
    .map((r, idx) => ({ r, rowNum: idx + 2 }))
    .filter(({ r }) => String(r[1] || "").trim() === customerId)
    .filter(({ r }) => String(r[2] || "") >= from)
    .sort((a, b) => String(a.r[2]).localeCompare(String(b.r[2])));

  let previousRemaining = 0;
  let changed = 0;
  const updates = [];

  for (const { r, rowNum } of customerBills) {
    const monthKey = String(r[2] || "");
    const profile = historyMap.get(monthKey) || customerFallback;
    const paid = parseFloat(r[13] || "0") || 0;

    let totalDue = parseFloat(r[12] || "0") || 0;
    if (profile.isMonitor || profile.billingType === "FREE") {
      totalDue = 0;
    } else if (profile.billingType === "FIXED_MONTHLY") {
      totalDue = profile.fixedMonthlyPrice + previousRemaining;
    } else {
      const ampereCharge = parseFloat(r[8] || "0") || 0;
      const consumptionCharge = parseFloat(r[9] || "0") || 0;
      totalDue = ampereCharge + consumptionCharge + previousRemaining - (parseFloat(r[10] || "0") || 0);
    }

    const remaining = Math.max(0, totalDue - paid);
    const status = calcPaymentStatus(paid, remaining);
    const billingTypeSnapshot = profile.isMonitor ? "FREE" : profile.billingType;
    const subscribedAmpereSnapshot = profile.subscribedAmpere;
    const fixedMonthlyPriceSnapshot = profile.fixedMonthlyPrice;

    const oldTotal = parseFloat(r[12] || "0") || 0;
    const oldRemaining = parseFloat(r[14] || "0") || 0;
    const oldPrevUnpaid = parseFloat(r[11] || "0") || 0;
    if (
      Math.abs(oldTotal - totalDue) > 0.5 ||
      Math.abs(oldRemaining - remaining) > 0.5 ||
      Math.abs(oldPrevUnpaid - previousRemaining) > 0.5
    ) {
      changed++;
    }

    updates.push({
      rowNum,
      values: [
        String(previousRemaining), // L previousUnpaidBalance
        String(totalDue), // M totalDue
        String(remaining), // O remainingDue
        status, // P paymentStatus
        billingTypeSnapshot, // S billingTypeSnapshot
        String(subscribedAmpereSnapshot), // T
        String(fixedMonthlyPriceSnapshot), // U
      ],
      monthKey,
      totalDue,
      remaining,
      status,
    });

    previousRemaining = remaining;
  }

  console.log(`Customer: ${customerId}`);
  console.log(`Bills considered: ${customerBills.length}`);
  console.log(`Rows changed (approx): ${changed}`);
  console.log("Preview:");
  for (const x of updates.slice(0, 12)) {
    console.log(`  ${x.monthKey} -> totalDue ${x.totalDue.toLocaleString()} | remaining ${x.remaining.toLocaleString()} | ${x.status}`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes written.");
    return;
  }

  const data = updates.map((u) => ({
    range: `Bills!L${u.rowNum}:U${u.rowNum}`,
    // L..U => prevUnpaid, totalDue, totalPaid, remainingDue, paymentStatus, createdAt, updatedAt, typeSnap, ampSnap, fixedSnap
    values: [[u.values[0], u.values[1], "", u.values[2], u.values[3], "", "", u.values[4], u.values[5], u.values[6]]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });

  console.log("Applied updates.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

