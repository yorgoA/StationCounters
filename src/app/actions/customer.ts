"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  createCustomer as dbCreateCustomer,
  updateCustomer as dbUpdateCustomer,
  getCustomerById,
} from "@/lib/google-sheets";
import { generateId } from "@/lib/id";
import type { CreateCustomerInput, Customer } from "@/types";

export async function createCustomerAction(input: CreateCustomerInput) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return { error: "Unauthorized" };
  }

  if (input.isMonitor && (!input.linkedCustomerIds || input.linkedCustomerIds.length === 0)) {
    return { error: "Monitor requires at least one linked customer." };
  }

  const customer: Customer = {
    customerId: generateId("cust"),
    fullName: input.fullName,
    phone: input.phone,
    area: input.area,
    building: input.building,
    floor: input.floor,
    apartmentNumber: input.apartmentNumber,
    subscribedAmpere: input.subscribedAmpere,
    billingType: input.billingType,
    fixedMonthlyPrice: input.fixedMonthlyPrice ?? 0,
    fixedDiscountAmount: input.fixedDiscountAmount ?? 0,
    fixedDiscountPercent: input.fixedDiscountPercent ?? 0,
    isMonitor: input.isMonitor ?? false,
    linkedCustomerIds: input.isMonitor ? input.linkedCustomerIds ?? [] : undefined,
    monitorCategory: input.isMonitor ? input.monitorCategory?.trim() || undefined : undefined,
    status: input.status ?? "ACTIVE",
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  };

  try {
    await dbCreateCustomer(customer);
    revalidatePath("/employee");
    revalidatePath("/manager");
    revalidatePath("/employee/customers");
    revalidatePath("/manager/customers");
    return { success: true, customerId: customer.customerId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create customer",
    };
  }
}

export async function updateCustomerBasicAction(input: {
  customerId: string;
  phone: string;
  area: string;
  building: string;
  status: Customer["status"];
}) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return { error: "Unauthorized" };
  }

  const existing = await getCustomerById(input.customerId);
  if (!existing) return { error: "Customer not found" };

  const updated: Customer = {
    ...existing,
    phone: input.phone,
    area: input.area,
    building: input.building,
    status: input.status,
  };

  try {
    await dbUpdateCustomer(updated);
    revalidatePath("/employee");
    revalidatePath("/manager");
    revalidatePath("/employee/customers");
    revalidatePath("/manager/customers");
    revalidatePath(`/employee/customers/${input.customerId}`);
    revalidatePath(`/manager/customers/${input.customerId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update customer",
    };
  }
}

export async function updateCustomerAction(customer: Customer) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can update customers" };
  }

  try {
    await dbUpdateCustomer(customer);
    revalidatePath("/manager");
    revalidatePath("/manager/customers");
    revalidatePath("/manager/free-customers");
    revalidatePath(`/manager/customers/${customer.customerId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update customer",
    };
  }
}

export async function updateFreeCustomerAction(input: {
  customerId: string;
  billingType: "FREE" | "BOTH";
  freeReason?: string;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can update free customers" };
  }

  const existing = await getCustomerById(input.customerId);
  if (!existing) return { error: "Customer not found" };

  const updated: Customer = {
    ...existing,
    billingType: input.billingType,
    freeReason: input.billingType === "FREE" ? (input.freeReason ?? existing.freeReason ?? "") : "",
  };

  try {
    await dbUpdateCustomer(updated);
    revalidatePath("/manager");
    revalidatePath("/manager/customers");
    revalidatePath("/manager/free-customers");
    revalidatePath(`/manager/customers/${input.customerId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update",
    };
  }
}

export async function updateMonitorLinksAction(input: {
  customerId: string;
  linkedCustomerIds: string[];
  monitorCategory?: string;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return { error: "Unauthorized" };
  }

  const existing = await getCustomerById(input.customerId);
  if (!existing) return { error: "Customer not found" };
  if (!existing.isMonitor) return { error: "This customer is not a monitor" };

  const ids = (input.linkedCustomerIds || []).map((s) => String(s).trim()).filter(Boolean);
  if (ids.length === 0) return { error: "Monitor requires at least one linked customer." };

  const updated: Customer = {
    ...existing,
    linkedCustomerIds: ids,
    linkedCustomerId: undefined,
    monitorCategory: input.monitorCategory?.trim() || undefined,
  };

  try {
    await dbUpdateCustomer(updated);
    revalidatePath("/employee/customers");
    revalidatePath("/manager/customers");
    revalidatePath(`/employee/customers/${input.customerId}`);
    revalidatePath(`/manager/customers/${input.customerId}`);
    return { success: true as const };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update monitor links",
    };
  }
}
