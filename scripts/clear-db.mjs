/**
 * Clear all customer data from Google Sheets.
 * Keeps: AmperePrices, Settings (kwhPrice, currency)
 * Removes: Customers, Bills, Payments
 *
 * Run: npm run clear-db
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  try {
    const envPath = resolve(projectRoot, ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.warn("Could not load .env.local");
  }
}

loadEnv();

async function main() {
  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "./station-490108-55c52b942e8e.json";
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID in .env.local");
    process.exit(1);
  }

  const credFullPath = credPath.startsWith("/")
    ? credPath
    : resolve(projectRoot, credPath);
  const creds = JSON.parse(readFileSync(credFullPath, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const SHEETS_TO_CLEAR = ["Customers", "Bills", "Payments"];

  for (const sheetName of SHEETS_TO_CLEAR) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });
      const rows = res.data.values || [];
      if (rows.length <= 1) {
        console.log(`${sheetName}: already empty or header only`);
        continue;
      }
      // Clear all rows except header (row 1)
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A2:Z`,
      });
      console.log(`${sheetName}: cleared ${rows.length - 1} data rows`);
    } catch (err) {
      console.warn(`${sheetName}: ${err.message}`);
    }
  }

  console.log("Done. AmperePrices and Settings (kwhPrice, currency) were kept.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
