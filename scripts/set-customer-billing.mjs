#!/usr/bin/env node
/**
 * Manually set a customer's billingType and/or isMonitor in the sheet.
 * Usage: node scripts/set-customer-billing.mjs <customerId> <billingType> [--monitor] [--link customerId]
 * Example: node scripts/set-customer-billing.mjs cust_xxx BOTH
 * Example: node scripts/set-customer-billing.mjs cust_xxx BOTH --monitor --link cust_yyy
 */
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
  const args = process.argv.slice(2);
  const customerId = args[0];
  const billingType = args[1] || "BOTH";
  const monitor = args.includes("--monitor");
  const linkIdx = args.indexOf("--link");
  const linkedCustomerId = linkIdx >= 0 ? args[linkIdx + 1] : null;

  if (!customerId || !["FREE", "BOTH", "KWH_ONLY", "AMPERE_ONLY"].includes(billingType)) {
    console.error("Usage: node scripts/set-customer-billing.mjs <customerId> <FREE|BOTH|KWH_ONLY|AMPERE_ONLY> [--monitor] [--link customerId]");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(resolve(projectRoot, credPath), "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Customers!A:Q",
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r, i) => i > 0 && String(r[0] ?? "").trim() === customerId.trim());
  if (idx === -1) {
    console.error("Customer not found:", customerId);
    process.exit(1);
  }

  const rowNum = idx + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Customers!I${rowNum}`,
    valueInputOption: "RAW",
    requestBody: { values: [[billingType]] },
  });
  if (billingType === "FREE") {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Customers!N${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [[""]] },
    });
  }
  if (monitor) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Customers!P${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [["true"]] },
    });
    if (linkedCustomerId) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Customers!Q${rowNum}`,
        valueInputOption: "RAW",
        requestBody: { values: [[linkedCustomerId]] },
      });
    }
  }
  console.log("Updated", customerId, "billingType=", billingType, monitor ? "isMonitor=true" : "", linkedCustomerId ? "linked=" + linkedCustomerId : "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
