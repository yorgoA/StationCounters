#!/usr/bin/env node
/**
 * Add/fill Customers.region without touching existing numeric fields.
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

  // Column T (index 19) = region
  const T_IDX = 19;
  const needsTHeader =
    !header[T_IDX] ||
    header[T_IDX].toString().toLowerCase().replace(/\s/g, "") !== "region";
  const tValues = [];
  if (needsTHeader) tValues.push(["region"]);
  let changed = needsTHeader ? 1 : 0;
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const current = String(row[T_IDX] ?? "").trim().toUpperCase();
    const normalized = current === "PRINTANIA" ? "PRINTANIA" : "MRAH_GHANEM";
    if (normalized !== current) changed++;
    tValues.push([normalized]);
  }
  const tStartRow = needsTHeader ? 1 : 2;
  const tRange = `Customers!T${tStartRow}:T${tStartRow + tValues.length - 1}`;

  console.log("\n=== Update Sheets Columns ===\n");
  console.log("Customers: column T (region)");
  console.log("Rows to update:", changed);
  if (needsTHeader) console.log("Will add header 'region' in T1");
  console.log("Range:", tRange);
  console.log("");

  if (dryRun) {
    console.log("[DRY RUN] No changes written. Run without --dry-run to apply.\n");
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: tRange,
    valueInputOption: "RAW",
    requestBody: { values: tValues },
  });
  console.log("✓ Updated Customers column T (region)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
