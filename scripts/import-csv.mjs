/**
 * Import customers and bills from CSV into Google Sheets.
 *
 * CSV format (FILE 2.csv style):
 *   Client Name, BOX NUMBER, BUILDING NAME, Subscription Type, Amps,
 *   Counter Previous, Counter Now, Paid till now, Total Price
 *
 * Total Price = what they need to pay; Paid till now = what they paid.
 * If (Total Price - Paid till now) = 0 → PAID.
 *
 * Usage:
 *   npm run import-csv -- 2025-02                    # FILE.csv, February 2025
 *   npm run import-csv -- "FILE 2.csv" 2025-02       # custom file + month
 *   npm run import-csv -- "FILE 2.csv" 2025-02 --clear  # clear Customers/Bills/Payments first, then import (fixes double imports)
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

// Parse CLI args: [filePath?, month?] [, --clear]
function getArgs() {
  const a = process.argv[2];
  const b = process.argv[3];
  const clearFirst = process.argv.includes("--clear");
  let csvFile = "FILE.csv";
  let monthKey = process.env.IMPORT_MONTH;
  if (a && a.endsWith(".csv")) {
    csvFile = a;
    if (b && /^\d{4}-\d{2}$/.test(b)) monthKey = b;
  } else if (a && /^\d{4}-\d{2}$/.test(a)) {
    monthKey = a;
  }
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return { csvFile, monthKey, clearFirst };
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

function getAmperePriceForTier(subscribedAmpere, tiers) {
  if (!tiers?.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.amp - b.amp);
  const exact = sorted.find((t) => t.amp === subscribedAmpere);
  if (exact) return exact.price;
  const lower = sorted.filter((t) => t.amp <= subscribedAmpere);
  return lower.length > 0 ? lower[lower.length - 1].price : sorted[0].price;
}

function csvRowToCustomerAndBill(row, monthKey) {
  // New format: Client Name, BOX NUMBER, BUILDING NAME, Subscription Type, Amps,
  //             Counter Previous, Counter Now, Paid till now, Total Price
  const [clientName, boxNumber, building, subscriptionType, amps, counterPrev, counterNow, paidTillNow, totalPrice] = row;
  const name = (clientName || "").trim();
  const buildingStr = (building || "").trim();
  const boxNumberStr = String(boxNumber || "").trim();
  if (!name) return null;

  const billingType =
    (subscriptionType || "").toLowerCase().includes("fixed") ? "AMPERE_ONLY" : "BOTH";
  const subscribedAmpere = parseFloat(String(amps || "0").replace(/\D/g, "")) || 0;
  const prevCounter = parseFloat(String(counterPrev || "0").replace(/,/g, "")) || 0;
  const currCounter = parseFloat(String(counterNow || "0").replace(/,/g, "")) || 0;

  const customerId = generateId("cust");
  const now = new Date().toISOString();

  const totalDue = parseAmount(totalPrice);
  const totalPaid = parseAmount(paidTillNow);
  const remainingDue = Math.max(0, totalDue - totalPaid);
  const paymentStatus = remainingDue <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID";
  const usageKwh = Math.max(0, currCounter - prevCounter);

  const customer = {
    customerId,
    fullName: name,
    phone: "",
    area: boxNumberStr,
    building: buildingStr,
    floor: "",
    apartmentNumber: "",
    subscribedAmpere: subscribedAmpere || 10,
    billingType,
    fixedDiscountAmount: 0,
    status: "ACTIVE",
    notes: "",
    createdAt: now,
    freeReason: "",
  };

  // Split into ampereCharge/consumptionCharge is applied later using Settings & AmperePrices
  const bill = {
    billId: generateId("bill"),
    customerId,
    monthKey,
    previousCounter: prevCounter,
    currentCounter: currCounter,
    usageKwh,
    amperePriceSnapshot: 0,
    kwhPriceSnapshot: 0,
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
    _billingType: billingType,
    _subscribedAmpere: subscribedAmpere || 10,
  };

  return { customer, bill };
}

function applyAmpereConsumptionSplit(bills, customers, kwhPrice, ampereTiers) {
  const hasPricing = kwhPrice > 0 || ampereTiers.length > 0;
  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    const c = customers[i];
    const billingType = b._billingType ?? c.billingType ?? "BOTH";
    const subscribedAmpere = b._subscribedAmpere ?? c.subscribedAmpere ?? 10;
    const totalDue = b.totalDue;
    const usageKwh = b.usageKwh;

    const ampPrice = getAmperePriceForTier(subscribedAmpere, ampereTiers);
    b.amperePriceSnapshot = ampPrice;
    b.kwhPriceSnapshot = kwhPrice;

    // AMPERE_ONLY: entire total is ampere charge
    if (billingType === "AMPERE_ONLY") {
      b.ampereCharge = totalDue;
      b.consumptionCharge = 0;
    } else if (hasPricing && kwhPrice > 0) {
      // BOTH: split by usage * kwhPrice for consumption, rest for ampere
      const consumptionCharge = Math.round(usageKwh * kwhPrice);
      b.consumptionCharge = Math.min(consumptionCharge, totalDue);
      b.ampereCharge = Math.max(0, totalDue - b.consumptionCharge);
    }
    // else: keep original (ampereCharge=0, consumptionCharge=totalDue) when no pricing

    delete b._billingType;
    delete b._subscribedAmpere;
  }
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
    c.freeReason ?? "",
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
  const { csvFile, monthKey, clearFirst } = getArgs();
  const csvPath = resolve(projectRoot, csvFile);
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

  for (let i = 0; i < dataLines.length; i++) {
    const row = parseCSVLine(dataLines[i]);
    const parsed = csvRowToCustomerAndBill(row, monthKey);
    if (!parsed) continue;

    const { customer, bill } = parsed;
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

  // Fetch Settings and AmperePrices to split totalDue into ampereCharge + consumptionCharge
  let kwhPrice = 0;
  let ampereTiers = [];
  try {
    const [settingsRes, ampsRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: "Settings!A:Z" }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: "AmperePrices!A:Z" }),
    ]);
    const settingsRows = settingsRes.data.values || [];
    const ampsRows = ampsRes.data.values || [];
    if (settingsRows.length >= 2) {
      const s = settingsRows[1];
      kwhPrice = parseFloat(String(s[1] || s[0] || "0")) || 0;
    }
    if (ampsRows.length >= 2) {
      ampereTiers = ampsRows.slice(1).map((r) => ({
        amp: parseFloat(r[0] || "0") || 0,
        price: parseFloat(r[1] || "0") || 0,
      })).filter((t) => t.amp > 0);
    }
    console.log(`Using kwhPrice=${kwhPrice}, ${ampereTiers.length} ampere tiers`);
  } catch (e) {
    console.warn("Could not fetch Settings/AmperePrices, using ampereCharge=0 for all:", e.message);
  }

  applyAmpereConsumptionSplit(bills, customers, kwhPrice, ampereTiers);

  if (clearFirst) {
    console.log("Clearing Customers, Bills, Payments...");
    for (const sheetName of ["Customers", "Bills", "Payments"]) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`,
        });
        const rows = res.data.values || [];
        if (rows.length > 1) {
          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${sheetName}!A2:Z`,
          });
          console.log(`  Cleared ${sheetName} (${rows.length - 1} rows)`);
        }
      } catch (err) {
        console.warn(`  ${sheetName}: ${err.message}`);
      }
    }
  }

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
    "freeReason",
  ];

  const values = [headerRow, ...customers.map(customerToRow)];

  console.log("Uploading to Google Sheets (Customers tab)...");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Customers!A:A",
  });
  const existingRows = clearFirst ? 0 : (res.data.values || []).length;

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
  const existingBillsRows = clearFirst ? 0 : (billsRes.data.values || []).length;

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
