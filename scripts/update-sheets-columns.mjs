#!/usr/bin/env node
/**
 * Add new columns to Google Sheets without removing or overwriting existing data.
 * Only fills empty cells in new columns (e.g. isMonitor in Customers).
 *
 * Usage: node scripts/update-sheets-columns.mjs [--dry-run]
 *   --dry-run: show what would be updated, don't write
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

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID in .env.local");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const customersRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Customers!A:Z",
  });
  const rows = customersRes.data.values || [];
  const header = rows[0] || [];
  const dataRows = rows.slice(1);

  if (dataRows.length === 0) {
    console.log("No data rows in Customers. Nothing to update.\n");
    return;
  }

  // Column O (index 14) = fixedDiscountPercent header (if missing)
  const O_IDX = 14;
  const needsOHeader = !header[O_IDX] || String(header[O_IDX]).trim() === "";
  if (needsOHeader && !dryRun) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Customers!O1",
      valueInputOption: "RAW",
      requestBody: { values: [["fixedDiscountPercent"]] },
    });
    console.log("✓ Added header fixedDiscountPercent in column O");
  }

  // Column P (index 15) = isMonitor
  const P_IDX = 15;
  const needsHeader = !header[P_IDX] || header[P_IDX].toString().toLowerCase() !== "ismonitor";

  const pValues = [];
  let pChanged = 0;

  if (needsHeader) {
    pValues.push(["isMonitor"]);
    pChanged++;
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const current = row[P_IDX];
    const isEmpty = current === undefined || current === null || String(current).trim() === "";
    if (isEmpty) {
      pValues.push(["false"]);
      pChanged++;
    } else {
      pValues.push([String(current).trim()]); // preserve existing
    }
  }

  const startRow = needsHeader ? 1 : 2; // 1-based: row 1 = header, row 2 = first data
  const range = `Customers!P${startRow}:P${startRow + pValues.length - 1}`;

  console.log("\n=== Update Sheets Columns ===\n");
  if (needsOHeader) {
    console.log("Will add header 'fixedDiscountPercent' in column O");
  }
  console.log("Customers: column P (isMonitor)");
  console.log("Rows to update:", pChanged, "of", dataRows.length + (needsHeader ? 1 : 0));
  if (needsHeader) console.log("Will add header 'isMonitor' in P1");
  console.log("Range:", range);
  console.log("");

  if (dryRun) {
    console.log("[DRY RUN] No changes written. Run without --dry-run to apply.\n");
    return;
  }

  if (pValues.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: pValues },
    });
    console.log("✓ Updated Customers column P (isMonitor)");
  }

  // Column Q (index 16) = linkedCustomerId
  const Q_IDX = 16;
  const needsQHeader = !header[Q_IDX] || header[Q_IDX].toString().toLowerCase().replace(/\s/g, "") !== "linkedcustomerid";
  const qValues = [];
  if (needsQHeader) qValues.push(["linkedCustomerId"]);
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const current = row[Q_IDX];
    qValues.push([current !== undefined && current !== null && String(current).trim() ? String(current).trim() : ""]);
  }
  const qStartRow = needsQHeader ? 1 : 2;
  const qRange = `Customers!Q${qStartRow}:Q${qStartRow + qValues.length - 1}`;
  if (qValues.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: qRange,
      valueInputOption: "RAW",
      requestBody: { values: qValues },
    });
    console.log("✓ Updated Customers column Q (linkedCustomerId)");
  }

  // Column R (index 17) = monitorCategory
  const R_IDX = 17;
  const needsRHeader = !header[R_IDX] || header[R_IDX].toString().toLowerCase().replace(/\s/g, "") !== "monitorcategory";
  const rValues = [];
  if (needsRHeader) rValues.push(["monitorCategory"]);
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const current = row[R_IDX];
    rValues.push([current !== undefined && current !== null && String(current).trim() ? String(current).trim() : ""]);
  }
  const rStartRow = needsRHeader ? 1 : 2;
  const rRange = `Customers!R${rStartRow}:R${rStartRow + rValues.length - 1}`;
  if (rValues.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: rRange,
      valueInputOption: "RAW",
      requestBody: { values: rValues },
    });
    console.log("✓ Updated Customers column R (monitorCategory)");
  }

  // Column S (index 18) = fixedMonthlyPrice
  const S_IDX = 18;
  const needsSHeader =
    !header[S_IDX] ||
    header[S_IDX].toString().toLowerCase().replace(/\s/g, "") !== "fixedmonthlyprice";
  const sValues = [];
  if (needsSHeader) sValues.push(["fixedMonthlyPrice"]);
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const current = row[S_IDX];
    const isEmpty = current === undefined || current === null || String(current).trim() === "";
    if (isEmpty) {
      sValues.push(["0"]);
    } else {
      sValues.push([String(current).trim()]);
    }
  }
  const sStartRow = needsSHeader ? 1 : 2;
  const sRange = `Customers!S${sStartRow}:S${sStartRow + sValues.length - 1}`;
  if (sValues.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sRange,
      valueInputOption: "RAW",
      requestBody: { values: sValues },
    });
    console.log("✓ Updated Customers column S (fixedMonthlyPrice)");
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
