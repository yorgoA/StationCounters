/**
 * Google Sheets service - server-side only.
 * Uses 60s cache to reduce API quota usage (Read requests per minute).
 */

import { unstable_cache } from "next/cache";
import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";
import {
  rowToAmperePriceTier,
  rowToBill,
  rowToCustomer,
  rowToPayment,
  rowToSettings,
  amperePriceTierToRow,
  billToRow,
  customerToRow,
  paymentToRow,
  settingsToRow,
} from "./sheets-utils";
import type { AmperePriceTier, Bill, Customer, Payment, Settings } from "@/types";

const SHEET_NAMES = {
  AMPERE_PRICES: "AmperePrices",
  CUSTOMERS: "Customers",
  BILLS: "Bills",
  PAYMENTS: "Payments",
  SETTINGS: "Settings",
} as const;

const DEFAULT_AMPERE_PRICES: AmperePriceTier[] = [
  { amp: 3, price: 231000 },
  { amp: 4, price: 308000 },
  { amp: 5, price: 385000 },
  { amp: 6, price: 462000 },
  { amp: 7, price: 539000 },
  { amp: 10, price: 685000 },
  { amp: 15, price: 985000 },
  { amp: 16, price: 1062000 },
  { amp: 20, price: 1285000 },
  { amp: 25, price: 1585000 },
  { amp: 30, price: 1885000 },
  { amp: 32, price: 2039000 },
  { amp: 40, price: 2485000 },
  { amp: 48, price: 3016000 },
  { amp: 60, price: 3685000 },
  { amp: 63, price: 3865000 },
  { amp: 75, price: 4585000 },
  { amp: 120, price: 7285000 },
  { amp: 150, price: 9085000 },
  { amp: 180, price: 10885000 },
];

async function getSheets() {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_ID environment variable is required");
  }
  return { sheets, spreadsheetId };
}

const CACHE_SECONDS = 60; // Reduces quota: max 1 read per sheet per minute

async function getRangeUncached(sheetName: string, range?: string): Promise<string[][]> {
  const { sheets, spreadsheetId } = await getSheets();
  const fullRange = range ? `${sheetName}!${range}` : sheetName;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });
  return (res.data.values || []) as string[][];
}

function getRange(sheetName: string, range?: string): Promise<string[][]> {
  return unstable_cache(
    () => getRangeUncached(sheetName, range),
    [`sheets-${sheetName}-${range ?? "full"}`],
    { revalidate: CACHE_SECONDS }
  )();
}

async function appendRow(sheetName: string, values: string[]) {
  const { sheets, spreadsheetId } = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function updateRow(sheetName: string, rowIndex: number, values: string[]) {
  const { sheets, spreadsheetId } = await getSheets();
  const range = `${sheetName}!A${rowIndex}:${String.fromCharCode(65 + values.length - 1)}${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

// -----------------------------------------------------------------------------
// CUSTOMERS
// -----------------------------------------------------------------------------

export async function getAllCustomers(): Promise<Customer[]> {
  const rows = await getRange(SHEET_NAMES.CUSTOMERS);
  if (rows.length < 2) return []; // header + data
  const dataRows = rows.slice(1);
  return dataRows.map(rowToCustomer).filter((c) => c.customerId);
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const customers = await getAllCustomers();
  return customers.find((c) => c.customerId === customerId) ?? null;
}

export async function createCustomer(customer: Customer): Promise<void> {
  await appendRow(SHEET_NAMES.CUSTOMERS, customerToRow(customer));
}

export async function updateCustomer(customer: Customer): Promise<void> {
  const rows = await getRange(SHEET_NAMES.CUSTOMERS, "A:Q");
  const custId = String(customer.customerId || "").trim();
  const idx = rows.findIndex(
    (r, i) => i > 0 && String(r[0] ?? "").trim() === custId
  );
  if (idx === -1) throw new Error(`Customer not found: ${custId}`);
  await updateRow(SHEET_NAMES.CUSTOMERS, idx + 1, customerToRow(customer));
}

// -----------------------------------------------------------------------------
// BILLS
// -----------------------------------------------------------------------------

export async function getAllBills(): Promise<Bill[]> {
  const rows = await getRange(SHEET_NAMES.BILLS);
  if (rows.length < 2) return [];
  return rows.slice(1).map(rowToBill).filter((b) => b.billId);
}

export async function getBillsByCustomer(customerId: string): Promise<Bill[]> {
  const bills = await getAllBills();
  return bills.filter((b) => b.customerId === customerId);
}

export async function getBillsByMonth(monthKey: string): Promise<Bill[]> {
  const bills = await getAllBills();
  return bills.filter((b) => b.monthKey === monthKey);
}

export async function getBillByCustomerAndMonth(
  customerId: string,
  monthKey: string
): Promise<Bill | null> {
  const bills = await getAllBills();
  return bills.find((b) => b.customerId === customerId && b.monthKey === monthKey) ?? null;
}

export async function createBill(bill: Bill): Promise<void> {
  await appendRow(SHEET_NAMES.BILLS, billToRow(bill));
}

export async function updateBill(bill: Bill): Promise<void> {
  const rows = await getRange(SHEET_NAMES.BILLS);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === bill.billId);
  if (idx === -1) throw new Error("Bill not found");
  await updateRow(SHEET_NAMES.BILLS, idx + 1, billToRow(bill));
}

// -----------------------------------------------------------------------------
// PAYMENTS
// -----------------------------------------------------------------------------

export async function getAllPayments(): Promise<Payment[]> {
  const rows = await getRange(SHEET_NAMES.PAYMENTS);
  if (rows.length < 2) return [];
  return rows.slice(1).map(rowToPayment).filter((p) => p.paymentId);
}

export async function getPaymentsByBill(billId: string): Promise<Payment[]> {
  const payments = await getAllPayments();
  return payments.filter((p) => p.billId === billId);
}

export async function createPayment(payment: Payment): Promise<void> {
  await appendRow(SHEET_NAMES.PAYMENTS, paymentToRow(payment));
}

// -----------------------------------------------------------------------------
// SETTINGS
// -----------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const rows = await getRange(SHEET_NAMES.SETTINGS);
  if (rows.length < 2) {
    return {
      kwhPrice: 0,
      currency: "LBP",
      updatedAt: new Date().toISOString(),
    };
  }
  return rowToSettings(rows[1]);
}

export async function getAmperePrices(): Promise<AmperePriceTier[]> {
  try {
    const rows = await getRange(SHEET_NAMES.AMPERE_PRICES);
    if (rows.length < 2) return DEFAULT_AMPERE_PRICES;
    return rows.slice(1).map(rowToAmperePriceTier).filter((t) => t.amp > 0);
  } catch {
    return DEFAULT_AMPERE_PRICES;
  }
}

export async function updateAmperePrices(tiers: AmperePriceTier[]): Promise<void> {
  const { sheets, spreadsheetId } = await getSheets();

  // Create AmperePrices sheet if it doesn't exist
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hasSheet = meta.data.sheets?.some(
    (s) => s.properties?.title === SHEET_NAMES.AMPERE_PRICES
  );
  if (!hasSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: SHEET_NAMES.AMPERE_PRICES },
            },
          },
        ],
      },
    });
  }

  const values = [["amp", "price"], ...tiers.map(amperePriceTierToRow)];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.AMPERE_PRICES}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function updateSettings(settings: Settings): Promise<void> {
  const rows = await getRange(SHEET_NAMES.SETTINGS);
  if (rows.length < 2) {
    await appendRow(SHEET_NAMES.SETTINGS, settingsToRow(settings));
  } else {
    await updateRow(SHEET_NAMES.SETTINGS, 2, settingsToRow(settings));
  }
}
