/**
 * Import customers and bills from FILE.csv into Google Sheets.
 *
 * Specify the month for the readings (format: YYYY-MM):
 *   npm run import-csv -- 2025-02     (February 2025)
 *   IMPORT_MONTH=2025-03 npm run import-csv
 *
 * If not specified, uses current month.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Load .env.local
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
    console.warn("Could not load .env.local, using process env");
  }
}

loadEnv();

// Month for the imported readings: from CLI arg, env var, or current month
function getMonthKey() {
  const arg = process.argv[2];
  if (arg && /^\d{4}-\d{2}$/.test(arg)) return arg;
  const env = process.env.IMPORT_MONTH;
  if (env && /^\d{4}-\d{2}$/.test(env)) return env;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
      if (c === "\n") break;
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

function generateId(prefix = "cust") {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

function parseAmount(str) {
  if (!str || typeof str !== "string") return 0;
  const num = str.replace(/[^0-9]/g, "");
  return parseInt(num, 10) || 0;
}

function csvRowToCustomerAndBill(row, monthKey) {
  const [clientName, customIdentifier, building, subscriptionType, totalPrice, amps, counterBasePrice, counterPrev, counterNow, diff, totalPayments] = row;
  const name = (clientName || "").trim();
  const buildingStr = (building || "").trim();
  if (!name) return null;

  // Parse area from building: "AA - 82 MADI" -> area="AA", or use full building
  const area = buildingStr ? buildingStr.split(/\s*-\s*/)[0]?.trim() || buildingStr : "";

  const billingType =
    (subscriptionType || "").toLowerCase().includes("fixed") ? "AMPERE_ONLY" : "BOTH";
  const subscribedAmpere = parseFloat(String(amps || "0").replace(/\D/g, "")) || 0;

  let customerId = (customIdentifier || "").trim();
  if (customerId) {
    customerId = customerId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
    if (!customerId || /^_+$/.test(customerId)) customerId = generateId("cust");
  } else {
    customerId = generateId("cust");
  }

  const now = new Date().toISOString();
  const totalDue = parseAmount(totalPrice);
  const totalPaid = parseAmount(totalPayments);
  const remainingDue = Math.max(0, totalDue - totalPaid);
  const paymentStatus = remainingDue <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID";
  const prevCounter = parseFloat(String(counterPrev || "0").replace(/,/g, "")) || 0;
  const currCounter = parseFloat(String(counterNow || "0").replace(/,/g, "")) || 0;
  const usageKwh = parseFloat(String(diff || "0").replace(/,/g, "")) || 0;
  const basePrice = parseAmount(counterBasePrice) || 0;

  const customer = {
    customerId,
    fullName: name,
    phone: "",
    area: area || buildingStr,
    building: buildingStr,
    floor: "",
    apartmentNumber: "",
    subscribedAmpere: subscribedAmpere || 10,
    billingType,
    fixedDiscountAmount: 0,
    status: "ACTIVE",
    notes: customIdentifier ? `Imported ID: ${customIdentifier}` : "",
    createdAt: now,
  };

  const bill = {
    billId: generateId("bill"),
    customerId,
    monthKey,
    previousCounter: prevCounter,
    currentCounter: currCounter,
    usageKwh,
    amperePriceSnapshot: 0,
    kwhPriceSnapshot: basePrice || 0,
    ampereCharge: 0,
    consumptionCharge: totalDue,
    discountApplied: 0,
    previousUnpaidBalance: 0,
    totalDue,
    totalPaid,
    remainingDue,
    paymentStatus,
    createdAt: now,
    updatedAt: now,
  };

  return { customer, bill };
}

function customerToRow(c) {
  return [
    c.customerId,
    c.fullName,
    c.phone,
    c.area,
    c.building,
    c.floor,
    c.apartmentNumber,
    String(c.subscribedAmpere),
    c.billingType,
    String(c.fixedDiscountAmount),
    c.status,
    c.notes,
    c.createdAt,
  ];
}

function billToRow(b) {
  return [
    b.billId,
    b.customerId,
    b.monthKey,
    String(b.previousCounter),
    String(b.currentCounter),
    String(b.usageKwh),
    String(b.amperePriceSnapshot),
    String(b.kwhPriceSnapshot),
    String(b.ampereCharge),
    String(b.consumptionCharge),
    String(b.discountApplied),
    String(b.previousUnpaidBalance),
    String(b.totalDue),
    String(b.totalPaid),
    String(b.remainingDue),
    b.paymentStatus,
    b.createdAt,
    b.updatedAt,
  ];
}

async function main() {
  const monthKey = getMonthKey();
  const csvPath = resolve(projectRoot, "FILE.csv");
  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "./station-490108-55c52b942e8e.json";
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (!spreadsheetId) {
    console.error("Missing GOOGLE_SHEETS_ID in .env.local");
    process.exit(1);
  }

  console.log("Reading CSV...");
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  // Skip empty first row and header row
  const dataLines = lines.slice(2);
  const customers = [];
  const bills = [];
  const seenIds = new Set();

  for (let i = 0; i < dataLines.length; i++) {
    const row = parseCSVLine(dataLines[i]);
    const parsed = csvRowToCustomerAndBill(row, monthKey);
    if (!parsed) continue;

    const { customer, bill } = parsed;

    // Ensure unique customerId
    let cid = customer.customerId;
    if (seenIds.has(cid)) {
      cid = generateId("cust");
    }
    seenIds.add(cid);
    customer.customerId = cid;
    bill.customerId = cid;

    customers.push(customer);
    bills.push(bill);
  }

  console.log(`Parsed ${customers.length} customers and ${bills.length} ${monthKey} bills.`);

  // Auth
  const credFullPath = credPath.startsWith("/")
    ? credPath
    : resolve(projectRoot, credPath);
  const creds = JSON.parse(readFileSync(credFullPath, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Batch append (Sheets API allows up to ~10MB per request; 400 rows is fine)
  const headerRow = [
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
  ];

  const values = [headerRow, ...customers.map(customerToRow)];

  console.log("Uploading to Google Sheets (Customers tab)...");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Customers!A:A",
  });
  const existingRows = (res.data.values || []).length;

  if (existingRows === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Customers!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    console.log(`Imported ${customers.length} customers.`);
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Customers!A:A",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: values.slice(1) },
    });
    console.log(`Appended ${customers.length} customers to existing sheet.`);
  }

  // Bills
  const billHeaderRow = [
    "billId", "customerId", "monthKey", "previousCounter", "currentCounter",
    "usageKwh", "amperePriceSnapshot", "kwhPriceSnapshot", "ampereCharge",
    "consumptionCharge", "discountApplied", "previousUnpaidBalance",
    "totalDue", "totalPaid", "remainingDue", "paymentStatus", "createdAt", "updatedAt",
  ];
  const billValues = [billHeaderRow, ...bills.map(billToRow)];

  const billsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Bills!A:A",
  });
  const existingBillsRows = (billsRes.data.values || []).length;

  if (existingBillsRows === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Bills!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: billValues },
    });
    console.log(`Imported ${bills.length} ${monthKey} bills.`);
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Bills!A:A",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: billValues.slice(1) },
    });
    console.log(`Appended ${bills.length} ${monthKey} bills to existing sheet.`);
  }

  console.log("Done. Amounts are in L.L. (LBP) from the CSV.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
