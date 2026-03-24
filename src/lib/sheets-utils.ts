/**
 * Row mapping utilities: convert between Google Sheets rows and typed entities.
 */

import type { AmperePriceTier, Bill, BillingType, Customer, Payment, Settings } from "@/types";

/** Sheet cells often have trailing spaces; strict equality in billing would skip BOTH ampere + kWh. */
export function normalizeBillingType(raw: string | undefined): BillingType {
  const t = (raw ?? "").trim().toUpperCase();
  if (t === "AMPERE_ONLY" || t === "KWH_ONLY" || t === "BOTH" || t === "FREE") {
    return t;
  }
  return "BOTH";
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
  return {
    kwhPrice: parseFloat(r[kwhIdx] || "0") || 0,
    currency: r[currIdx] || "LBP",
    updatedAt: r[updIdx] || "",
  };
}

export function settingsToRow(s: Settings): string[] {
  // Sheet columns: Ampere Price (A, deprecated), Kwh Price (B), Currency (C), Updated At (D)
  return ["", String(s.kwhPrice), s.currency, s.updatedAt];
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
