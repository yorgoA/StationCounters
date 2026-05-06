#!/usr/bin/env node
/**
 * Fix Printania monitor customers imported as FREE billing type.
 * Monitors should be represented by isMonitor=true with normal billingType.
 *
 * Usage:
 *   node scripts/fix-printania-monitors.mjs
 *   node scripts/fix-printania-monitors.mjs --apply
 */

import { readFileSync } from "fs";
import { dirname, isAbsolute, resolve } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

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

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWorksheetRows(worksheetPath) {
  const lines = readFileSync(worksheetPath, "utf-8").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.toLowerCase().includes("client name;building;discount as value;free;subscription type;amps;counter previous;counter now")
  );
  if (headerIndex < 0) throw new Error(`Worksheet header not found in ${worksheetPath}`);

  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const parts = line.split(";").map((x) => x.trim());
    const clientName = parts[0] || "";
    if (!clientName) continue;
    rows.push({
      clientName,
      freeField: parts[3] || "",
      subscriptionTypeRaw: parts[4] || "",
    });
  }
  return rows;
}

function desiredBillingType(subscriptionTypeRaw) {
  const subscription = String(subscriptionTypeRaw || "").toLowerCase();
  if (subscription.includes("fixed")) return "AMPERE_ONLY";
  return "BOTH";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const worksheetArgIndex = args.indexOf("--worksheet");
  const worksheet =
    worksheetArgIndex >= 0 && args[worksheetArgIndex + 1]
      ? args[worksheetArgIndex + 1]
      : "Worksheet-Table 1.csv";
  return {
    worksheet,
    apply: args.includes("--apply"),
  };
}

async function getSheetsClient() {
  loadEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./station-490108-55c52b942e8e.json";
  const credFullPath = isAbsolute(credPath) ? credPath : resolve(projectRoot, credPath);
  const creds = JSON.parse(readFileSync(credFullPath, "utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
  };
}

async function main() {
  const { worksheet, apply } = parseArgs();
  const worksheetPath = isAbsolute(worksheet) ? worksheet : resolve(projectRoot, worksheet);
  const sourceRows = parseWorksheetRows(worksheetPath);

  const monitorByName = new Map();
  for (const row of sourceRows) {
    if (!String(row.freeField || "").toLowerCase().includes("monitor for")) continue;
    monitorByName.set(normalizeName(row.clientName), desiredBillingType(row.subscriptionTypeRaw));
  }

  const { sheets, spreadsheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:T" });
  const rows = res.data.values || [];
  const header = rows[0] || [];
  const data = rows.slice(1);

  const col = (name) => header.findIndex((h) => String(h || "").trim() === name);
  const idxCustomerId = col("customerId");
  const idxFullName = col("fullName");
  const idxBillingType = col("billingType");
  const idxFreeReason = col("freeReason");
  const idxIsMonitor = col("isMonitor");
  const idxRegion = col("region");

  const toUpdate = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const region = String(row[idxRegion] || "").trim().toUpperCase();
    const isMonitor = String(row[idxIsMonitor] || "").trim().toUpperCase() === "TRUE" || String(row[idxIsMonitor] || "").trim() === "1";
    if (region !== "PRINTANIA" || !isMonitor) continue;

    const nameNorm = normalizeName(row[idxFullName] || "");
    const nextBillingType = monitorByName.get(nameNorm);
    if (!nextBillingType) continue;

    const currentBillingType = String(row[idxBillingType] || "").trim().toUpperCase();
    const currentFreeReason = String(row[idxFreeReason] || "").trim();
    const nextFreeReason = "";
    if (currentBillingType === nextBillingType && currentFreeReason === nextFreeReason) continue;

    const nextRow = [...row];
    nextRow[idxBillingType] = nextBillingType;
    nextRow[idxFreeReason] = nextFreeReason;
    toUpdate.push({
      sheetRowIndex: i + 2,
      customerId: String(row[idxCustomerId] || "").trim(),
      fullName: String(row[idxFullName] || "").trim(),
      currentBillingType,
      nextBillingType,
      currentFreeReason,
      nextFreeReason,
      nextRow,
    });
  }

  if (apply) {
    for (const item of toUpdate) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Customers!A${item.sheetRowIndex}:T${item.sheetRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [item.nextRow] },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        updates: toUpdate.map((x) => ({
          customerId: x.customerId,
          fullName: x.fullName,
          currentBillingType: x.currentBillingType,
          nextBillingType: x.nextBillingType,
          currentFreeReason: x.currentFreeReason,
          nextFreeReason: x.nextFreeReason,
        })),
        count: toUpdate.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
