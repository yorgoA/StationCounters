#!/usr/bin/env node
/**
 * Restore Customers rows from a known-good snapshot, then append region column.
 * This is used to undo accidental field mutations while keeping region rollout.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const SNAPSHOT_PATH = resolve(
  projectRoot,
  ".db-snapshots/2026-04-30T09-03-07-927Z-region-backfill-before.json"
);

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

function normalizeRegion(raw) {
  return String(raw || "").trim().toUpperCase() === "PRINTANIA" ? "PRINTANIA" : "MRAH_GHANEM";
}

async function main() {
  loadEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(projectRoot, "station-490108-55c52b942e8e.json");
  const creds = JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
  const rows = snapshot?.sheets?.Customers?.rows || [];

  const header = [
    "customerId",
    "fullName",
    "phone",
    "area",
    "building",
    "floor",
    "apartmentNumber",
    "subscribedAmpere",
    "billingType",
    "fixedDiscountAmount",
    "status",
    "notes",
    "createdAt",
    "freeReason",
    "fixedDiscountPercent",
    "isMonitor",
    "linkedCustomerId",
    "monitorCategory",
    "fixedMonthlyPrice",
    "region",
  ];

  const values = [
    header,
    ...rows.map((r) => [
      String(r[0] ?? ""),
      String(r[1] ?? ""),
      String(r[2] ?? ""),
      String(r[3] ?? ""),
      String(r[4] ?? ""),
      String(r[5] ?? ""),
      String(r[6] ?? ""),
      String(r[7] ?? ""),
      String(r[8] ?? ""),
      String(r[9] ?? ""),
      String(r[10] ?? ""),
      String(r[11] ?? ""),
      String(r[12] ?? ""),
      String(r[13] ?? ""),
      String(r[14] ?? ""),
      String(r[15] ?? ""),
      String(r[16] ?? ""),
      String(r[17] ?? ""),
      String(r[18] ?? ""),
      normalizeRegion(r[19]),
    ]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Customers!A1",
    valueInputOption: "RAW",
    requestBody: { values },
  });

  console.log(`Restored ${rows.length} Customers rows and applied region column.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
