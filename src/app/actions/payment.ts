"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  createPayment as dbCreatePayment,
  getCustomerById,
  getAllBills,
  getBillsByCustomer,
  updateBill as dbUpdateBill,
} from "@/lib/google-sheets";
import { generateId } from "@/lib/id";
import { calcPaymentStatus } from "@/lib/billing";
import { inferReceiptImageMime } from "@/lib/receipt-image";
import { uploadReceiptImage } from "@/lib/receipt-upload";
import type { Bill, CreatePaymentInput, Payment } from "@/types";

async function getBillByIdInternal(billId: string): Promise<Bill | null> {
  const bills = await getAllBills();
  return bills.find((b) => b.billId === billId) ?? null;
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

async function recalculateCustomerBillsFromMonth(
  customerId: string,
  fromMonthKey: string
): Promise<void> {
  const allBills = (await getBillsByCustomer(customerId)).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );
  const targetBills = allBills.filter((b) => b.monthKey >= fromMonthKey);

  for (const bill of targetBills) {
    const previousUnpaid = getPreviousUnpaidBalance(
      allBills.filter((b) => b.billId !== bill.billId),
      bill.monthKey
    );
    const baseDue = getBillBaseDue(bill);
    const totalDue = bill.billingTypeSnapshot === "FREE" ? 0 : baseDue + previousUnpaid;
    const newRemainingDue = Math.max(0, totalDue - bill.totalPaid);
    const newPaymentStatus = calcPaymentStatus(bill.totalPaid, newRemainingDue);
    const updated: Bill = {
      ...bill,
      previousUnpaidBalance: previousUnpaid,
      totalDue,
      remainingDue: newRemainingDue,
      paymentStatus: newPaymentStatus,
      updatedAt: new Date().toISOString(),
    };
    await dbUpdateBill(updated);
    const idx = allBills.findIndex((b) => b.billId === bill.billId);
    if (idx >= 0) allBills[idx] = updated;
  }
}

function getBillBaseDue(bill: Bill): number {
  if (bill.billingTypeSnapshot === "FREE") return 0;

  if (bill.billingTypeSnapshot === "FIXED_MONTHLY") {
    if ((bill.fixedMonthlyPriceSnapshot ?? 0) > 0) {
      return bill.fixedMonthlyPriceSnapshot ?? 0;
    }
  }

  const meteredBase = bill.ampereCharge + bill.consumptionCharge - bill.discountApplied;
  if (meteredBase > 0) return meteredBase;

  // Legacy rows may not have snapshot/type fields; preserve their original base component.
  return Math.max(0, bill.totalDue - bill.previousUnpaidBalance);
}

async function persistPayment(input: CreatePaymentInput & { receiptImageUrl: string }) {
  const bill = await getBillByIdInternal(input.billId);
  if (!bill) {
    return { error: "Bill not found" as const };
  }

  const newTotalPaid = bill.totalPaid + input.amountPaid;
  const newRemainingDue = Math.max(0, bill.totalDue - newTotalPaid);
  const newStatus = calcPaymentStatus(newTotalPaid, newRemainingDue);

  const payment: Payment = {
    paymentId: generateId("pay"),
    billId: input.billId,
    customerId: input.customerId,
    paymentDate: input.paymentDate,
    amountPaid: input.amountPaid,
    receiptImageUrl: input.receiptImageUrl,
    paymentMethod: input.paymentMethod ?? "CASH",
    note: input.note ?? "",
    enteredByRole: input.enteredByRole,
    createdAt: new Date().toISOString(),
  };

  const updatedBill: Bill = {
    ...bill,
    totalPaid: newTotalPaid,
    remainingDue: newRemainingDue,
    paymentStatus: newStatus,
    updatedAt: new Date().toISOString(),
  };

  try {
    await dbCreatePayment(payment);
    await dbUpdateBill(updatedBill);
    // Payment on an earlier month changes carry-in for later months.
    await recalculateCustomerBillsFromMonth(input.customerId, bill.monthKey);
    revalidatePath("/employee");
    revalidatePath("/manager");
    revalidatePath("/employee/payments");
    revalidatePath(`/employee/payments/${input.customerId}`);
    revalidatePath(`/employee/customers/${input.customerId}`);
    revalidatePath(`/manager/customers/${input.customerId}`);
    return { success: true as const, paymentId: payment.paymentId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}

/** Record payment: uploads receipt from FormData only when this runs (on submit). */
export async function recordPaymentAction(formData: FormData) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return { error: "Unauthorized" };
  }

  const billId = (formData.get("billId") as string)?.trim();
  const customerId = (formData.get("customerId") as string)?.trim();
  const paymentDate = (formData.get("paymentDate") as string)?.trim() || "";
  const amountRaw = formData.get("amountPaid");
  const amountPaid =
    typeof amountRaw === "string" ? Number(amountRaw) : Number(amountRaw);
  const paymentMethod = (formData.get("paymentMethod") as string)?.trim() || "CASH";
  const note = (formData.get("note") as string)?.trim() || "";

  if (!billId) {
    return { error: "Please select a bill" };
  }
  if (!customerId) {
    return { error: "Missing customer" };
  }
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return { error: "Enter a valid amount" };
  }

  const customer = await getCustomerById(customerId);
  if (!customer) {
    return { error: "Customer not found" };
  }
  if (customer.isMonitor) {
    return { error: "Monitor accounts cannot receive payments." };
  }

  const file = formData.get("receipt");
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Receipt is required. Choose a photo before recording payment." };
  }

  // Upload receipt first. If this throws or fails, we return early — never write payment/bill rows.
  let receiptImageUrl: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = inferReceiptImageMime(file);
    const uploaded = await uploadReceiptImage(buffer, mimeType);
    receiptImageUrl = uploaded.webViewLink;
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : "Could not upload receipt. Check your connection and try again.";
    return { error: `${detail} Payment was not saved.` };
  }

  return persistPayment({
    billId,
    customerId,
    paymentDate,
    amountPaid,
    receiptImageUrl,
    paymentMethod,
    note,
    enteredByRole: "employee",
  });
}
