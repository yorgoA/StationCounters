"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  getBillByCustomerAndMonth,
  createBill as dbCreateBill,
  updateBill as dbUpdateBill,
  getBillsByCustomer,
  getAllBills,
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
} from "@/lib/billing";
import type { Bill, CreateBillInput } from "@/types";

export interface UpdateBillReadingsInput {
  billId: string;
  previousCounter: number;
  currentCounter: number;
}

function getPreviousUnpaidBalance(bills: Bill[]): number {
  const unpaid = bills
    .filter((b) => b.paymentStatus === "UNPAID" || b.paymentStatus === "PARTIAL")
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

  const [kwhPrice, ampereTiers] = await Promise.all([
    getKwhPriceForMonth(input.monthKey),
    getAmperePrices(),
  ]);
  const bills = await getBillsByCustomer(input.customerId);
  const previousUnpaid = getPreviousUnpaidBalance(bills);
  const effectiveBillingType = customer.isMonitor ? "FREE" : customer.billingType;

  const calc = calcBillFromReadings(
    input.customerId,
    input.monthKey,
    input.previousCounter,
    input.currentCounter,
    customer.subscribedAmpere,
    effectiveBillingType,
    customer.fixedMonthlyPrice ?? 0,
    customer.fixedDiscountAmount ?? 0,
    customer.fixedDiscountPercent ?? 0,
    ampereTiers,
    kwhPrice,
    previousUnpaid
  );

  const bill: Bill = {
    ...calc,
    billId: generateId("bill"),
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

  const customer = await getCustomerById(bill.customerId);
  if (!customer) return { error: "Customer not found" };

  const [kwhPrice, ampereTiers] = await Promise.all([
    getKwhPriceForMonth(bill.monthKey),
    getAmperePrices(),
  ]);
  const bills = await getBillsByCustomer(bill.customerId);
  const previousUnpaid = getPreviousUnpaidBalance(
    bills.filter((b) => b.billId !== input.billId)
  );
  const effectiveBillingType = customer.isMonitor ? "FREE" : customer.billingType;

  const calc = calcBillFromReadings(
    bill.customerId,
    bill.monthKey,
    input.previousCounter,
    input.currentCounter,
    customer.subscribedAmpere,
    effectiveBillingType,
    customer.fixedMonthlyPrice ?? 0,
    customer.fixedDiscountAmount ?? 0,
    customer.fixedDiscountPercent ?? 0,
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
