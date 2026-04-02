/**
 * Google Sheets service - server-side only.
 * Reads are not cached: a previous 60s unstable_cache caused wrong bill totals
 * (create bill used stale kWh price / ampere tiers until cache expired; manager
 * "save reading" looked like a fix because it re-read fresh data).
 */

import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";
import {
  rowToAmperePriceTier,
  rowToBillingChangeLog,
  rowToBill,
  rowToCustomerBillingHistory,
  rowToCustomer,
  rowToPayment,
  rowToSettings,
  amperePriceTierToRow,
  billingChangeLogToRow,
  billingHistoryToProfile,
  billToRow,
  customerBillingHistoryToRow,
  customerToRow,
  monthlyTariffToRow,
  paymentToRow,
  rowToMonthlyTariff,
  settingsToRow,
} from "./sheets-utils";
import type {
  AmperePriceTier,
  BillingChangeLog,
  BillingProfileForMonth,
  Bill,
  BillingType,
  CustomerBillingHistory,
  Customer,
  MonthlyTariff,
  Payment,
  Settings,
} from "@/types";

const SHEET_NAMES = {
  AMPERE_PRICES: "AmperePrices",
  CUSTOMERS: "Customers",
  BILLS: "Bills",
  PAYMENTS: "Payments",
  SETTINGS: "Settings",
  MONTHLY_TARIFFS: "MonthlyTariffs",
  CUSTOMER_BILLING_HISTORY: "CustomerBillingHistory",
  BILLING_CHANGE_LOG: "BillingChangeLog",
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

type RangeCacheEntry = {
  expiresAt: number;
  values: string[][];
};

// Keep this cache very short to reduce quota spikes in dev/re-render bursts
// without re-introducing stale business logic behavior.
const RANGE_CACHE_TTL_MS = 1500;
const rangeCache = new Map<string, RangeCacheEntry>();
const inflightRangeReads = new Map<string, Promise<string[][]>>();

async function getRange(
  sheetName: string,
  range?: string,
  options?: { bypassCache?: boolean }
): Promise<string[][]> {
  const fullRange = range ? `${sheetName}!${range}` : sheetName;
  const cacheKey = fullRange;
  const now = Date.now();
  const bypassCache = options?.bypassCache === true;

  if (!bypassCache) {
    const cached = rangeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.values;
    }

    const inflight = inflightRangeReads.get(cacheKey);
    if (inflight) {
      return inflight;
    }
  }

  const run = (async () => {
    const { sheets, spreadsheetId } = await getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
    });
    const values = (res.data.values || []) as string[][];
    if (!bypassCache) {
      rangeCache.set(cacheKey, {
        values,
        expiresAt: Date.now() + RANGE_CACHE_TTL_MS,
      });
    }
    return values;
  })();

  if (!bypassCache) {
    inflightRangeReads.set(cacheKey, run);
    try {
      return await run;
    } finally {
      inflightRangeReads.delete(cacheKey);
    }
  }

  return run;
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

async function ensureSheetWithHeader(sheetName: string, headers: string[]) {
  const { sheets, spreadsheetId } = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hasSheet = meta.data.sheets?.some((s) => s.properties?.title === sheetName);
  if (!hasSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
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

export async function getPaymentsByBillIds(billIds: string[]): Promise<Payment[]> {
  const ids = new Set(billIds.map((x) => String(x).trim()).filter(Boolean));
  if (ids.size === 0) return [];
  const payments = await getAllPayments();
  return payments.filter((p) => ids.has(p.billId));
}

export async function createPayment(payment: Payment): Promise<void> {
  await appendRow(SHEET_NAMES.PAYMENTS, paymentToRow(payment));
}

// -----------------------------------------------------------------------------
// DELETION (Bills + linked Payments)
// -----------------------------------------------------------------------------

async function getSheetIdByTitle(sheetTitle: string): Promise<number> {
  const { sheets, spreadsheetId } = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId !== "number") {
    throw new Error(`Sheet not found: ${sheetTitle}`);
  }
  return sheetId;
}

async function deleteRowsByIndices(sheetTitle: string, rowIndices0Based: number[]) {
  if (rowIndices0Based.length === 0) return;
  const { sheets, spreadsheetId } = await getSheets();
  const sheetId = await getSheetIdByTitle(sheetTitle);

  const sorted = [...rowIndices0Based].sort((a, b) => b - a);
  const requests = sorted.map((startIndex) => ({
    deleteDimension: {
      range: { sheetId, dimension: "ROWS", startIndex, endIndex: startIndex + 1 },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

export async function deletePaymentsByBillId(billId: string): Promise<void> {
  const rows = await getRange(SHEET_NAMES.PAYMENTS);
  if (rows.length < 2) return;

  // values are 1-based in sheets; getRange returns an array where index 0 is row 1 (header).
  const rowIndices0Based = rows
    .map((r, i) => (i > 0 && r[1] === billId ? i : -1))
    .filter((i) => i >= 0);

  await deleteRowsByIndices(SHEET_NAMES.PAYMENTS, rowIndices0Based);
}

export async function deleteBillById(billId: string): Promise<void> {
  const rows = await getRange(SHEET_NAMES.BILLS);
  if (rows.length < 2) throw new Error("Bill not found");

  const idx = rows.findIndex((r, i) => i > 0 && r[0] === billId);
  if (idx === -1) throw new Error("Bill not found");

  await deleteRowsByIndices(SHEET_NAMES.BILLS, [idx]);
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
      usdRate: 89700,
      updatedAt: new Date().toISOString(),
    };
  }
  return rowToSettings(rows[1]);
}

export async function getMonthlyTariffs(): Promise<MonthlyTariff[]> {
  try {
    const rows = await getRange(SHEET_NAMES.MONTHLY_TARIFFS);
    if (rows.length < 2) return [];
    return rows.slice(1).map(rowToMonthlyTariff).filter((t) => t.monthKey);
  } catch {
    // sheet may not exist yet
    return [];
  }
}

export async function getKwhPriceForMonth(monthKey: string): Promise<number> {
  const tariffs = await getMonthlyTariffs();
  const exact = tariffs.find((t) => t.monthKey === monthKey);
  if (exact) return exact.kwhPrice;
  const settings = await getSettings();
  return settings.kwhPrice || 0;
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

export async function upsertMonthlyTariff(monthKey: string, kwhPrice: number): Promise<void> {
  const { sheets, spreadsheetId } = await getSheets();
  const cleanMonthKey = String(monthKey || "").trim();
  if (!cleanMonthKey) throw new Error("monthKey is required (YYYY-MM)");

  // Create MonthlyTariffs sheet if it doesn't exist
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hasSheet = meta.data.sheets?.some(
    (s) => s.properties?.title === SHEET_NAMES.MONTHLY_TARIFFS
  );
  if (!hasSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: SHEET_NAMES.MONTHLY_TARIFFS },
            },
          },
        ],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.MONTHLY_TARIFFS}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["monthKey", "kwhPrice", "updatedAt"]] },
    });
  }

  const rows = await getRange(SHEET_NAMES.MONTHLY_TARIFFS, "A:C");
  const idx = rows.findIndex(
    (r, i) => i > 0 && String(r[0] ?? "").trim() === cleanMonthKey
  );
  const row = monthlyTariffToRow({
    monthKey: cleanMonthKey,
    kwhPrice: Math.round(Number(kwhPrice) || 0),
    updatedAt: new Date().toISOString(),
  });
  if (idx === -1) {
    await appendRow(SHEET_NAMES.MONTHLY_TARIFFS, row);
  } else {
    await updateRow(SHEET_NAMES.MONTHLY_TARIFFS, idx + 1, row);
  }
}

export async function getBillingHistoryByCustomer(
  customerId: string
): Promise<CustomerBillingHistory[]> {
  try {
    const rows = await getRange(SHEET_NAMES.CUSTOMER_BILLING_HISTORY);
    if (rows.length < 2) return [];
    return rows
      .slice(1)
      .map(rowToCustomerBillingHistory)
      .filter((r) => r.customerId === customerId && r.monthKey)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  } catch {
    return [];
  }
}

export async function upsertBillingHistoryEntry(entry: CustomerBillingHistory): Promise<void> {
  await ensureSheetWithHeader(SHEET_NAMES.CUSTOMER_BILLING_HISTORY, [
    "entryId",
    "customerId",
    "monthKey",
    "billingType",
    "subscribedAmpere",
    "fixedMonthlyPrice",
    "fixedDiscountAmount",
    "fixedDiscountPercent",
    "isMonitor",
    "reason",
    "updatedByRole",
    "updatedAt",
  ]);
  const rows = await getRange(SHEET_NAMES.CUSTOMER_BILLING_HISTORY, "A:L");
  const idx = rows.findIndex(
    (r, i) =>
      i > 0 &&
      String(r[1] || "").trim() === entry.customerId &&
      String(r[2] || "").trim() === entry.monthKey
  );
  const row = customerBillingHistoryToRow(entry);
  if (idx === -1) {
    await appendRow(SHEET_NAMES.CUSTOMER_BILLING_HISTORY, row);
  } else {
    await updateRow(SHEET_NAMES.CUSTOMER_BILLING_HISTORY, idx + 1, row);
  }
}

export async function getBillingProfileForMonth(
  customerId: string,
  monthKey: string
): Promise<BillingProfileForMonth | null> {
  const customer = await getCustomerById(customerId);
  if (!customer) return null;
  const history = await getBillingHistoryByCustomer(customerId);
  const match = history.find((x) => x.monthKey === monthKey);
  if (match) {
    return billingHistoryToProfile(match);
  }
  return {
    customerId,
    monthKey,
    billingType: (customer.billingType || "BOTH") as BillingType,
    subscribedAmpere: customer.subscribedAmpere,
    fixedMonthlyPrice: customer.fixedMonthlyPrice ?? 0,
    fixedDiscountAmount: customer.fixedDiscountAmount ?? 0,
    fixedDiscountPercent: customer.fixedDiscountPercent ?? 0,
    isMonitor: customer.isMonitor === true,
  };
}

export async function appendBillingChangeLog(log: BillingChangeLog): Promise<void> {
  await ensureSheetWithHeader(SHEET_NAMES.BILLING_CHANGE_LOG, [
    "logId",
    "customerId",
    "monthKey",
    "oldProfileJson",
    "newProfileJson",
    "reason",
    "updatedByRole",
    "updatedAt",
  ]);
  await appendRow(SHEET_NAMES.BILLING_CHANGE_LOG, billingChangeLogToRow(log));
}

export async function getBillingChangeLogsByCustomer(
  customerId: string
): Promise<BillingChangeLog[]> {
  try {
    const rows = await getRange(SHEET_NAMES.BILLING_CHANGE_LOG);
    if (rows.length < 2) return [];
    return rows
      .slice(1)
      .map(rowToBillingChangeLog)
      .filter((x) => x.customerId === customerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}
