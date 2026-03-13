#!/usr/bin/env node
/**
 * Verify Customers sheet structure and test a customer update.
 * Run: node scripts/verify-sheet-structure.mjs [customerId]
 * Example: node scripts/verify-sheet-structure.mjs cust_xxx
 *
 * This checks: header columns, finds the customer row, and shows current billingType.
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

const EXPECTED_HEADERS = [
  "customerId", "fullName", "phone", "area", "building", "floor", "apartmentNumber",
  "subscribedAmpere", "billingType", "fixedDiscountAmount", "status", "notes",
  "createdAt", "freeReason", "fixedDiscountPercent", "isMonitor", "linkedCustomerId",
];

async function main() {
  const customerId = process.argv[2];
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(projectRoot, "station-490108-55c52b942e8e.json");

  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Customers!A1:Q500",
  });
  const rows = res.data.values || [];
  const header = (rows[0] || []).map((h) => String(h || "").trim());
  const dataRows = rows.slice(1);

  console.log("\n=== Customers sheet structure ===\n");
  console.log("Expected column I (index 8) = billingType");
  console.log("Your header at I:", header[8] || "(empty)");
  console.log("");
  console.log("Expected headers:", EXPECTED_HEADERS.slice(0, 10).join(", "), "...");
  console.log("Your headers:   ", header.slice(0, 10).join(", "), "...");
  console.log("");

  const missing = [];
  for (let i = 0; i < Math.min(17, EXPECTED_HEADERS.length); i++) {
    const exp = EXPECTED_HEADERS[i].toLowerCase();
    const got = (header[i] || "").toLowerCase();
    if (got !== exp && (i < 15 || (header[i] || "").trim() === "")) {
      missing.push(`Col ${String.fromCharCode(65 + i)}: expected "${EXPECTED_HEADERS[i]}", got "${header[i] || ""}"`);
    }
  }
  if (missing.length > 0) {
    console.log("⚠ Structure mismatch:");
    missing.forEach((m) => console.log("  ", m));
    console.log("");
    console.log("Fix: Add column headers in Row 1 to match the order above.");
    console.log("Or run: npm run update-sheets");
    console.log("");
    return;
  }

  if (!customerId) {
    console.log("Pass a customerId to test: node scripts/verify-sheet-structure.mjs cust_xxx\n");
    return;
  }

  const idx = dataRows.findIndex(
    (r) => String(r[0] ?? "").trim() === String(customerId).trim()
  );
  if (idx === -1) {
    console.log("Customer not found:", customerId);
    console.log("First 3 customerIds:", dataRows.slice(0, 3).map((r) => r[0]));
    console.log("");
    return;
  }

  const row = dataRows[idx];
  const rowNum = idx + 2;
  console.log("Found customer at row", rowNum);
  console.log("  customerId:", row[0]);
  console.log("  fullName:", row[1]);
  console.log("  billingType (col I):", row[8] || "(empty)");
  console.log("  Col P (isMonitor):", row[15] ?? "(empty)");
  console.log("  Col Q (linkedCustomerId):", row[16] ?? "(empty)");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
