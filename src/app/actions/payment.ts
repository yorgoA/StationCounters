"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  createPayment as dbCreatePayment,
  getAllBills,
  updateBill as dbUpdateBill,
} from "@/lib/google-sheets";
import { generateId } from "@/lib/id";
import { calcPaymentStatus } from "@/lib/billing";
import type { Bill, CreatePaymentInput, Payment } from "@/types";

async function getBillByIdInternal(billId: string): Promise<Bill | null> {
  const bills = await getAllBills();
  return bills.find((b) => b.billId === billId) ?? null;
}

export async function createPaymentAction(input: CreatePaymentInput) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return { error: "Unauthorized" };
  }

  if (!input.receiptImageUrl?.trim()) {
    return { error: "Receipt is required" };
  }

  const bill = await getBillByIdInternal(input.billId);
  if (!bill) {
    return { error: "Bill not found" };
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
    receiptImageUrl: input.receiptImageUrl ?? "",
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
    revalidatePath("/employee");
    revalidatePath("/manager");
    revalidatePath("/employee/payments");
    revalidatePath(`/employee/payments/${input.customerId}`);
    revalidatePath(`/employee/customers/${input.customerId}`);
    revalidatePath(`/manager/customers/${input.customerId}`);
    return { success: true, paymentId: payment.paymentId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}
