#!/usr/bin/env node
/**
 * Fix legacy old-total mapping for Printania:
 * - Move Chahid's legacy Feb bill from monitor counter customer to main customer.
 * - Add missing Halim Farah legacy Feb bill to Printania customer.
 *
 * Usage:
 *   node scripts/fix-printania-old-total-mapping.mjs
 *   node scripts/fix-printania-old-total-mapping.mjs --apply
 */

import { readFileSync } from "fs";
import { resolve, isAbsolute } from "path";
import { google } from "googleapis";

const projectRoot = process.cwd();
const USD_RATE = 89700;
const FEB_KEY = "2026-02";

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

function generateId(prefix = "bill") {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

function parseArgs() {
  return { apply: process.argv.includes("--apply") };
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
  const { apply } = parseArgs();
  const { sheets, spreadsheetId } = await getSheetsClient();
  const [customersRes, billsRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Customers!A:T" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Bills!A:U" }),
  ]);

  const cRows = customersRes.data.values || [];
  const bRows = billsRes.data.values || [];
  const ch = cRows[0] || [];
  const bh = bRows[0] || [];
  const ci = (n) => ch.findIndex((h) => String(h || "").trim() === n);
  const bi = (n) => bh.findIndex((h) => String(h || "").trim() === n);

  const customers = cRows.slice(1).map((r) => ({
    customerId: String(r[ci("customerId")] || "").trim(),
    fullName: String(r[ci("fullName")] || "").trim(),
    region: String(r[ci("region")] || "MRAH_GHANEM").trim().toUpperCase(),
    isMonitor: String(r[ci("isMonitor")] || "").trim().toUpperCase() === "TRUE" || String(r[ci("isMonitor")] || "").trim() === "1",
  }));

  const bills = bRows.slice(1).map((r, idx) => ({
    sheetRow: idx + 2,
    row: r,
    billId: String(r[bi("billId")] || "").trim(),
    customerId: String(r[bi("customerId")] || "").trim(),
    monthKey: String(r[bi("monthKey")] || "").trim(),
    totalDue: Number(r[bi("totalDue")] || 0) || 0,
  }));

  const findCustomer = (name, region, isMonitor) =>
    customers.find(
      (c) =>
        normalizeName(c.fullName) === normalizeName(name) &&
        c.region === region &&
        c.isMonitor === isMonitor
    );

  const halimPrintania = findCustomer("halim farah", "PRINTANIA", false);
  const chahidCounter = findCustomer("chahid abou samra counter", "PRINTANIA", true);
  const chahidMain = findCustomer("chahid abu samra", "PRINTANIA", false);

  if (!halimPrintania) throw new Error("Could not find Printania customer: halim farah");
  if (!chahidCounter) throw new Error("Could not find monitor customer: chahid abou samra counter");
  if (!chahidMain) throw new Error("Could not find main customer: Chahid Abu Samra");

  const existingHalimFeb = bills.find((b) => b.customerId === halimPrintania.customerId && b.monthKey === FEB_KEY);
  const chahidCounterFeb = bills.find(
    (b) =>
      b.customerId === chahidCounter.customerId &&
      b.monthKey === FEB_KEY &&
      b.totalDue === 50 * USD_RATE
  );
  const existingChahidMainFeb = bills.find((b) => b.customerId === chahidMain.customerId && b.monthKey === FEB_KEY);

  const actions = [];

  if (!existingHalimFeb) {
    const now = new Date().toISOString();
    actions.push({
      type: "append_bill",
      customerId: halimPrintania.customerId,
      fullName: halimPrintania.fullName,
      totalDue: 40 * USD_RATE,
      row: [
        generateId("bill"),
        halimPrintania.customerId,
        FEB_KEY,
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        String(40 * USD_RATE),
        "0",
        String(40 * USD_RATE),
        "UNPAID",
        now,
        now,
        "BOTH",
        "0",
        "0",
      ],
    });
  }

  if (chahidCounterFeb && !existingChahidMainFeb) {
    const updated = [...chahidCounterFeb.row];
    updated[bi("customerId")] = chahidMain.customerId;
    actions.push({
      type: "reassign_bill_customer",
      billId: chahidCounterFeb.billId,
      fromCustomerId: chahidCounter.customerId,
      toCustomerId: chahidMain.customerId,
      fromName: chahidCounter.fullName,
      toName: chahidMain.fullName,
      sheetRow: chahidCounterFeb.sheetRow,
      row: updated,
    });
  }

  if (apply) {
    for (const action of actions) {
      if (action.type === "append_bill") {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Bills!A:A",
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [action.row] },
        });
      } else if (action.type === "reassign_bill_customer") {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Bills!A${action.sheetRow}:U${action.sheetRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [action.row] },
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        actions,
        count: actions.length,
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
