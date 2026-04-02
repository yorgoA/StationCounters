/**
 * Row mapping utilities: convert between Google Sheets rows and typed entities.
 */

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

/** Sheet cells often have trailing spaces; strict equality in billing would skip BOTH ampere + kWh. */
export function normalizeBillingType(raw: string | undefined): BillingType {
  const t = (raw ?? "").trim().toUpperCase();
  if (
    t === "AMPERE_ONLY" ||
    t === "KWH_ONLY" ||
    t === "BOTH" ||
    t === "FREE" ||
    t === "FIXED_MONTHLY"
  ) {
    return t;
  }
  return "BOTH";
}

function parseBillingTypeSnapshot(raw: string | undefined): BillingType | undefined {
  const t = (raw ?? "").trim().toUpperCase();
  if (
    t === "AMPERE_ONLY" ||
    t === "KWH_ONLY" ||
    t === "BOTH" ||
    t === "FREE" ||
    t === "FIXED_MONTHLY"
  ) {
    return t;
  }
  return undefined;
}

export function rowToCustomer(row: string[]): Customer {
  const r = row as unknown as string[];
  return {
    customerId: r[0] || "",
    fullName: r[1] || "",
    phone: r[2] || "",
    area: r[3] || "",
    building: r[4] || "",
    floor: r[5] || "",
    apartmentNumber: r[6] || "",
    subscribedAmpere: parseFloat(r[7] || "0") || 0,
    billingType: normalizeBillingType(r[8]),
    fixedDiscountAmount: parseFloat(r[9] || "0") || 0,
    fixedDiscountPercent: parseFloat(r[14] || "0") || 0,
    fixedMonthlyPrice: parseFloat(r[18] || "0") || 0,
    status: (r[10] || "ACTIVE") as Customer["status"],
    notes: r[11] || "",
    createdAt: r[12] || new Date().toISOString(),
    freeReason: r[13] || "",
    isMonitor: r[15] === "true" || r[15] === "1",
    linkedCustomerId: r[16] || undefined,
    linkedCustomerIds: parseLinkedCustomerIds(r[16]),
    monitorCategory: r[17]?.trim() || undefined,
  };
}

function parseLinkedCustomerIds(val: string | undefined): string[] {
  if (!val || !val.trim()) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export function customerToRow(c: Customer): string[] {
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
    String(c.fixedDiscountPercent ?? 0),
    c.isMonitor ? "true" : "false",
    (c.linkedCustomerIds && c.linkedCustomerIds.length > 0)
      ? c.linkedCustomerIds.join(",")
      : (c.linkedCustomerId ?? ""),
    c.monitorCategory ?? "",
    String(c.fixedMonthlyPrice ?? 0),
  ];
}

export function rowToBill(row: string[]): Bill {
  const r = row as unknown as string[];
  return {
    billId: r[0] || "",
    customerId: r[1] || "",
    monthKey: r[2] || "",
    previousCounter: parseFloat(r[3] || "0") || 0,
    currentCounter: parseFloat(r[4] || "0") || 0,
    usageKwh: parseFloat(r[5] || "0") || 0,
    amperePriceSnapshot: parseFloat(r[6] || "0") || 0,
    kwhPriceSnapshot: parseFloat(r[7] || "0") || 0,
    ampereCharge: parseFloat(r[8] || "0") || 0,
    consumptionCharge: parseFloat(r[9] || "0") || 0,
    discountApplied: parseFloat(r[10] || "0") || 0,
    previousUnpaidBalance: parseFloat(r[11] || "0") || 0,
    totalDue: parseFloat(r[12] || "0") || 0,
    totalPaid: parseFloat(r[13] || "0") || 0,
    remainingDue: parseFloat(r[14] || "0") || 0,
    paymentStatus: (r[15] || "UNPAID") as Bill["paymentStatus"],
    createdAt: r[16] || "",
    updatedAt: r[17] || "",
    billingTypeSnapshot: parseBillingTypeSnapshot(r[18]),
    subscribedAmpereSnapshot: parseFloat(r[19] || "0") || 0,
    fixedMonthlyPriceSnapshot: parseFloat(r[20] || "0") || 0,
  };
}

export function billToRow(b: Bill): string[] {
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
    b.billingTypeSnapshot ?? "",
    String(b.subscribedAmpereSnapshot ?? 0),
    String(b.fixedMonthlyPriceSnapshot ?? 0),
  ];
}

export function rowToPayment(row: string[]): Payment {
  const r = row as unknown as string[];
  return {
    paymentId: r[0] || "",
    billId: r[1] || "",
    customerId: r[2] || "",
    paymentDate: r[3] || "",
    amountPaid: parseFloat(r[4] || "0") || 0,
    receiptImageUrl: r[5] || "",
    paymentMethod: r[6] || "",
    note: r[7] || "",
    enteredByRole: (r[8] || "employee") as Payment["enteredByRole"],
    createdAt: r[9] || "",
  };
}

export function paymentToRow(p: Payment): string[] {
  return [
    p.paymentId,
    p.billId,
    p.customerId,
    p.paymentDate,
    String(p.amountPaid),
    p.receiptImageUrl || "",
    p.paymentMethod || "",
    p.note || "",
    p.enteredByRole,
    p.createdAt,
  ];
}

export function rowToSettings(row: string[]): Settings {
  const r = row as unknown as string[];
  // Support old 4-col (amperePrice, kwhPrice, currency, updatedAt) and new 3-col
  const kwhIdx = r.length >= 4 ? 1 : 0;
  const currIdx = r.length >= 4 ? 2 : 1;
  const updIdx = r.length >= 4 ? 3 : 2;
  const usdIdx = r.length >= 5 ? 4 : -1;
  return {
    kwhPrice: parseFloat(r[kwhIdx] || "0") || 0,
    currency: r[currIdx] || "LBP",
    usdRate: usdIdx >= 0 ? parseFloat(r[usdIdx] || "0") || 89700 : 89700,
    updatedAt: r[updIdx] || "",
  };
}

export function settingsToRow(s: Settings): string[] {
  // Sheet columns: Ampere Price (A, deprecated), Kwh Price (B), Currency (C), Updated At (D), USD Rate (E)
  return ["", String(s.kwhPrice), s.currency, s.updatedAt, String(s.usdRate ?? 89700)];
}

export function rowToAmperePriceTier(row: string[]): AmperePriceTier {
  const r = row as unknown as string[];
  return {
    amp: parseFloat(r[0] || "0") || 0,
    price: parseFloat(r[1] || "0") || 0,
  };
}

export function amperePriceTierToRow(t: AmperePriceTier): string[] {
  return [String(t.amp), String(t.price)];
}

export function rowToMonthlyTariff(row: string[]): MonthlyTariff {
  const r = row as unknown as string[];
  return {
    monthKey: String(r[0] || "").trim(),
    kwhPrice: parseFloat(r[1] || "0") || 0,
    updatedAt: r[2] || "",
  };
}

export function monthlyTariffToRow(t: MonthlyTariff): string[] {
  return [t.monthKey, String(t.kwhPrice), t.updatedAt];
}

export function rowToCustomerBillingHistory(row: string[]): CustomerBillingHistory {
  const r = row as unknown as string[];
  return {
    entryId: String(r[0] || "").trim(),
    customerId: String(r[1] || "").trim(),
    monthKey: String(r[2] || "").trim(),
    billingType: normalizeBillingType(r[3]),
    subscribedAmpere: parseFloat(r[4] || "0") || 0,
    fixedMonthlyPrice: parseFloat(r[5] || "0") || 0,
    fixedDiscountAmount: parseFloat(r[6] || "0") || 0,
    fixedDiscountPercent: parseFloat(r[7] || "0") || 0,
    isMonitor: r[8] === "true" || r[8] === "1",
    reason: r[9] || "",
    updatedByRole: (r[10] || "manager") as CustomerBillingHistory["updatedByRole"],
    updatedAt: r[11] || "",
  };
}

export function customerBillingHistoryToRow(e: CustomerBillingHistory): string[] {
  return [
    e.entryId,
    e.customerId,
    e.monthKey,
    e.billingType,
    String(e.subscribedAmpere),
    String(e.fixedMonthlyPrice),
    String(e.fixedDiscountAmount),
    String(e.fixedDiscountPercent),
    e.isMonitor ? "true" : "false",
    e.reason || "",
    e.updatedByRole,
    e.updatedAt,
  ];
}

export function rowToBillingChangeLog(row: string[]): BillingChangeLog {
  const r = row as unknown as string[];
  return {
    logId: String(r[0] || "").trim(),
    customerId: String(r[1] || "").trim(),
    monthKey: String(r[2] || "").trim(),
    oldProfileJson: r[3] || "",
    newProfileJson: r[4] || "",
    reason: r[5] || "",
    updatedByRole: (r[6] || "manager") as BillingChangeLog["updatedByRole"],
    updatedAt: r[7] || "",
  };
}

export function billingChangeLogToRow(log: BillingChangeLog): string[] {
  return [
    log.logId,
    log.customerId,
    log.monthKey,
    log.oldProfileJson,
    log.newProfileJson,
    log.reason || "",
    log.updatedByRole,
    log.updatedAt,
  ];
}

export function billingHistoryToProfile(entry: CustomerBillingHistory): BillingProfileForMonth {
  return {
    customerId: entry.customerId,
    monthKey: entry.monthKey,
    billingType: entry.billingType,
    subscribedAmpere: entry.subscribedAmpere,
    fixedMonthlyPrice: entry.fixedMonthlyPrice,
    fixedDiscountAmount: entry.fixedDiscountAmount,
    fixedDiscountPercent: entry.fixedDiscountPercent,
    isMonitor: entry.isMonitor,
  };
}
