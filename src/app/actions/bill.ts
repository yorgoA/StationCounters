"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  appendBillingChangeLog,
  getBillByCustomerAndMonth,
  getBillingProfileForMonth,
  getBillingHistoryByCustomer,
  upsertBillingHistoryEntry,
  getBillingChangeLogsByCustomer,
  createBill as dbCreateBill,
  updateBill as dbUpdateBill,
  getBillsByCustomer,
  getAllBills,
  getPaymentsByBillIds,
  getKwhPriceForMonth,
  getAmperePrices,
  getCustomerById,
  deleteBillById,
  deletePaymentsByBillId,
} from "@/lib/google-sheets";
import { generateId } from "@/lib/id";
import {
  calcBillFromReadings,
  calcPaymentStatus,
  getAmperePriceForTier,
} from "@/lib/billing";
import type { Bill, BillingChangeLog, BillingProfileForMonth, CreateBillInput, CustomerBillingHistory } from "@/types";

export interface UpdateBillReadingsInput {
  billId: string;
  previousCounter: number;
  currentCounter: number;
}

function getPreviousUnpaidBalance(bills: Bill[], monthKey: string): number {
  const unpaid = bills
    .filter(
      (b) =>
        (b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL") &&
        b.monthKey < monthKey
    )
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return unpaid[0]?.remainingDue ?? 0;
}

export async function createBillAction(input: CreateBillInput) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return { error: "Unauthorized" };
  }

  const existing = await getBillByCustomerAndMonth(input.customerId, input.monthKey);
  if (existing) {
    return { error: "A bill already exists for this customer and month." };
  }

  const customer = await getCustomerById(input.customerId);
  if (!customer) {
    return { error: "Customer not found" };
  }

  const [profile, kwhPrice, ampereTiers] = await Promise.all([
    getBillingProfileForMonth(input.customerId, input.monthKey),
    getKwhPriceForMonth(input.monthKey),
    getAmperePrices(),
  ]);
  if (!profile) return { error: "Customer billing profile not found" };
  const bills = await getBillsByCustomer(input.customerId);
  const previousUnpaid = getPreviousUnpaidBalance(bills, input.monthKey);
  const effectiveBillingType = profile.isMonitor ? "FREE" : profile.billingType;

  const calc = calcBillFromReadings(
    input.customerId,
    input.monthKey,
    input.previousCounter,
    input.currentCounter,
    profile.subscribedAmpere,
    effectiveBillingType,
    profile.fixedMonthlyPrice ?? 0,
    profile.fixedDiscountAmount ?? 0,
    profile.fixedDiscountPercent ?? 0,
    ampereTiers,
    kwhPrice,
    previousUnpaid
  );

  const bill: Bill = {
    ...calc,
    billId: generateId("bill"),
    billingTypeSnapshot: effectiveBillingType,
    subscribedAmpereSnapshot: profile.subscribedAmpere,
    fixedMonthlyPriceSnapshot: profile.fixedMonthlyPrice,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await dbCreateBill(bill);
    revalidatePath("/employee");
    revalidatePath("/manager");
    revalidatePath("/employee/readings");
    revalidatePath(`/employee/readings/${input.customerId}`);
    revalidatePath(`/employee/customers/${input.customerId}`);
    revalidatePath(`/manager/customers/${input.customerId}`);
    return { success: true, billId: bill.billId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create bill",
    };
  }
}

export async function updateBillReadingsAction(input: UpdateBillReadingsInput) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can edit bill readings" };
  }

  const allBills = await getAllBills();
  const bill = allBills.find((b) => b.billId === input.billId);
  if (!bill) return { error: "Bill not found" };

  const [profile, kwhPrice, ampereTiers] = await Promise.all([
    getBillingProfileForMonth(bill.customerId, bill.monthKey),
    getKwhPriceForMonth(bill.monthKey),
    getAmperePrices(),
  ]);
  if (!profile) return { error: "Customer billing profile not found" };
  const bills = await getBillsByCustomer(bill.customerId);
  const previousUnpaid = getPreviousUnpaidBalance(
    bills.filter((b) => b.billId !== input.billId),
    bill.monthKey
  );
  const effectiveBillingType = profile.isMonitor ? "FREE" : profile.billingType;

  const calc = calcBillFromReadings(
    bill.customerId,
    bill.monthKey,
    input.previousCounter,
    input.currentCounter,
    profile.subscribedAmpere,
    effectiveBillingType,
    profile.fixedMonthlyPrice ?? 0,
    profile.fixedDiscountAmount ?? 0,
    profile.fixedDiscountPercent ?? 0,
    ampereTiers,
    kwhPrice,
    previousUnpaid
  );

  // Preserve payments: totalPaid stays, recalc remainingDue and status
  const newRemainingDue = Math.max(0, calc.totalDue - bill.totalPaid);
  const newPaymentStatus = calcPaymentStatus(bill.totalPaid, newRemainingDue);

  const updated: Bill = {
    ...bill,
    previousCounter: input.previousCounter,
    currentCounter: input.currentCounter,
    usageKwh: calc.usageKwh,
    amperePriceSnapshot: calc.amperePriceSnapshot,
    kwhPriceSnapshot: calc.kwhPriceSnapshot,
    ampereCharge: calc.ampereCharge,
    consumptionCharge: calc.consumptionCharge,
    discountApplied: calc.discountApplied,
    previousUnpaidBalance: calc.previousUnpaidBalance,
    totalDue: calc.totalDue,
    totalPaid: bill.totalPaid, // keep existing payments
    remainingDue: newRemainingDue,
    paymentStatus: newPaymentStatus,
    billingTypeSnapshot: effectiveBillingType,
    subscribedAmpereSnapshot: profile.subscribedAmpere,
    fixedMonthlyPriceSnapshot: profile.fixedMonthlyPrice,
    updatedAt: new Date().toISOString(),
  };

  try {
    await dbUpdateBill(updated);
    revalidatePath("/employee");
    revalidatePath("/manager");
    revalidatePath(`/manager/customers/${bill.customerId}`);
    revalidatePath("/manager/bills");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update bill",
    };
  }
}

export async function deleteBillAction(input: { billId: string }) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can delete bills" };
  }

  const allBills = await getAllBills();
  const bill = allBills.find((b) => b.billId === input.billId);
  if (!bill) {
    return { error: "Bill not found" };
  }

  try {
    // Remove linked payments first to prevent orphan payment rows.
    await deletePaymentsByBillId(input.billId);
    await deleteBillById(input.billId);

    revalidatePath("/employee");
    revalidatePath("/manager");
    revalidatePath("/manager/bills");
    revalidatePath(`/manager/customers/${bill.customerId}`);
    revalidatePath(`/employee/customers/${bill.customerId}`);
    return { success: true as const };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete bill",
    };
  }
}

export async function upsertFixedMonthlyBillForMonthAction(input: {
  customerId: string;
  monthKey: string;
  amount: number;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can set fixed monthly by month" };
  }

  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) {
    return { error: "Invalid month format. Use YYYY-MM." };
  }
  if (!(input.amount >= 0)) {
    return { error: "Amount must be 0 or greater." };
  }

  const customer = await getCustomerById(input.customerId);
  if (!customer) return { error: "Customer not found" };
  if (customer.isMonitor || customer.billingType !== "FIXED_MONTHLY") {
    return { error: "This action is only for non-monitor fixed monthly customers." };
  }

  const [existingBill, kwhPrice, ampereTiers] = await Promise.all([
    getBillByCustomerAndMonth(input.customerId, input.monthKey),
    getKwhPriceForMonth(input.monthKey),
    getAmperePrices(),
  ]);

  if (existingBill) {
    const newRemainingDue = Math.max(0, input.amount - existingBill.totalPaid);
    const newPaymentStatus = calcPaymentStatus(existingBill.totalPaid, newRemainingDue);
    const updated: Bill = {
      ...existingBill,
      totalDue: input.amount,
      remainingDue: newRemainingDue,
      paymentStatus: newPaymentStatus,
      // Keep this month isolated from carry-over confusion.
      previousUnpaidBalance: 0,
      ampereCharge: 0,
      consumptionCharge: 0,
      discountApplied: 0,
      billingTypeSnapshot: "FIXED_MONTHLY",
      subscribedAmpereSnapshot: customer.subscribedAmpere,
      fixedMonthlyPriceSnapshot: input.amount,
      updatedAt: new Date().toISOString(),
    };
    await dbUpdateBill(updated);
  } else {
    const now = new Date().toISOString();
    const bill: Bill = {
      billId: generateId("bill"),
      customerId: input.customerId,
      monthKey: input.monthKey,
      previousCounter: 0,
      currentCounter: 0,
      usageKwh: 0,
      amperePriceSnapshot: getAmperePriceForTier(customer.subscribedAmpere, ampereTiers),
      kwhPriceSnapshot: kwhPrice,
      ampereCharge: 0,
      consumptionCharge: 0,
      discountApplied: 0,
      previousUnpaidBalance: 0,
      totalDue: input.amount,
      totalPaid: 0,
      remainingDue: input.amount,
      paymentStatus: input.amount > 0 ? "UNPAID" : "PAID",
      billingTypeSnapshot: "FIXED_MONTHLY",
      subscribedAmpereSnapshot: customer.subscribedAmpere,
      fixedMonthlyPriceSnapshot: input.amount,
      createdAt: now,
      updatedAt: now,
    };
    await dbCreateBill(bill);
  }

  revalidatePath("/manager");
  revalidatePath("/manager/bills");
  revalidatePath(`/manager/customers/${input.customerId}`);
  return { success: true as const };
}

export async function upsertCustomerBillingProfileForMonthAction(input: {
  customerId: string;
  monthKey: string;
  billingType: BillingProfileForMonth["billingType"];
  subscribedAmpere: number;
  fixedMonthlyPrice: number;
  fixedDiscountAmount: number;
  fixedDiscountPercent: number;
  isMonitor: boolean;
  reason?: string;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can set billing profile by month" };
  }
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) {
    return { error: "Invalid month format. Use YYYY-MM." };
  }
  const current = await getBillingProfileForMonth(input.customerId, input.monthKey);
  if (!current) return { error: "Customer not found" };

  const entry: CustomerBillingHistory = {
    entryId: `cbh_${input.customerId}_${input.monthKey}`,
    customerId: input.customerId,
    monthKey: input.monthKey,
    billingType: input.billingType,
    subscribedAmpere: input.subscribedAmpere,
    fixedMonthlyPrice: input.fixedMonthlyPrice,
    fixedDiscountAmount: input.fixedDiscountAmount,
    fixedDiscountPercent: input.fixedDiscountPercent,
    isMonitor: input.isMonitor,
    reason: input.reason || "",
    updatedByRole: "manager",
    updatedAt: new Date().toISOString(),
  };
  await upsertBillingHistoryEntry(entry);

  const log: BillingChangeLog = {
    logId: `bcl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    customerId: input.customerId,
    monthKey: input.monthKey,
    oldProfileJson: JSON.stringify(current),
    newProfileJson: JSON.stringify(entry),
    reason: input.reason || "",
    updatedByRole: "manager",
    updatedAt: new Date().toISOString(),
  };
  await appendBillingChangeLog(log);

  // If a bill already exists for this month, immediately align it to the new profile.
  const existingBill = await getBillByCustomerAndMonth(input.customerId, input.monthKey);
  if (existingBill) {
    const [kwhPrice, ampereTiers, bills] = await Promise.all([
      getKwhPriceForMonth(input.monthKey),
      getAmperePrices(),
      getBillsByCustomer(input.customerId),
    ]);
    const previousUnpaid = getPreviousUnpaidBalance(
      bills.filter((b) => b.billId !== existingBill.billId),
      existingBill.monthKey
    );
    const effectiveBillingType = input.isMonitor ? "FREE" : input.billingType;
    const calc = calcBillFromReadings(
      existingBill.customerId,
      existingBill.monthKey,
      existingBill.previousCounter,
      existingBill.currentCounter,
      input.subscribedAmpere,
      effectiveBillingType,
      input.fixedMonthlyPrice,
      input.fixedDiscountAmount,
      input.fixedDiscountPercent,
      ampereTiers,
      kwhPrice,
      previousUnpaid
    );
    const newRemainingDue = Math.max(0, calc.totalDue - existingBill.totalPaid);
    const newPaymentStatus = calcPaymentStatus(existingBill.totalPaid, newRemainingDue);
    const updatedBill: Bill = {
      ...existingBill,
      usageKwh: calc.usageKwh,
      amperePriceSnapshot: calc.amperePriceSnapshot,
      kwhPriceSnapshot: calc.kwhPriceSnapshot,
      ampereCharge: calc.ampereCharge,
      consumptionCharge: calc.consumptionCharge,
      discountApplied: calc.discountApplied,
      previousUnpaidBalance: calc.previousUnpaidBalance,
      totalDue: calc.totalDue,
      remainingDue: newRemainingDue,
      paymentStatus: newPaymentStatus,
      billingTypeSnapshot: effectiveBillingType,
      subscribedAmpereSnapshot: input.subscribedAmpere,
      fixedMonthlyPriceSnapshot: input.fixedMonthlyPrice,
      updatedAt: new Date().toISOString(),
    };
    await dbUpdateBill(updatedBill);
  }

  revalidatePath("/manager");
  revalidatePath("/manager/bills");
  revalidatePath(`/manager/customers/${input.customerId}`);
  return { success: true as const };
}

export async function getCustomerLedgerAction(input: { customerId: string }) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can access ledger" };
  }
  const bills = (await getBillsByCustomer(input.customerId)).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey)
  );
  const payments = await getPaymentsByBillIds(bills.map((b) => b.billId));
  const paymentByBill = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = paymentByBill.get(p.billId) ?? [];
    list.push(p);
    paymentByBill.set(p.billId, list);
  }
  const history = await getBillingHistoryByCustomer(input.customerId);
  const logs = await getBillingChangeLogsByCustomer(input.customerId);
  return {
    bills,
    payments,
    paymentByBill: Object.fromEntries(paymentByBill.entries()),
    history,
    logs,
  };
}
