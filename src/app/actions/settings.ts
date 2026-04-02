"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  getSettings as dbGetSettings,
  getMonthlyTariffs as dbGetMonthlyTariffs,
  updateSettings as dbUpdateSettings,
  updateAmperePrices as dbUpdateAmperePrices,
  upsertMonthlyTariff as dbUpsertMonthlyTariff,
} from "@/lib/google-sheets";
import type { AmperePriceTier, Settings } from "@/types";

export async function updateSettingsAction(
  settings: Partial<Pick<Settings, "kwhPrice" | "currency" | "usdRate">>
) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can update settings" };
  }

  try {
    const current = await dbGetSettings();
    const updated: Settings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    await dbUpdateSettings(updated);
    revalidatePath("/manager");
    revalidatePath("/manager/settings");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update settings",
    };
  }
}

export async function updateAmperePricesAction(tiers: AmperePriceTier[]) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can update settings" };
  }

  try {
    await dbUpdateAmperePrices(tiers);
    revalidatePath("/manager");
    revalidatePath("/manager/settings");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update ampere prices",
    };
  }
}

export async function updateMonthlyTariffAction(input: {
  monthKey: string;
  kwhPrice: number;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can update settings" };
  }

  const monthKey = String(input.monthKey || "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return { error: "Month must be in YYYY-MM format" };
  }

  try {
    await dbUpsertMonthlyTariff(monthKey, input.kwhPrice);
    revalidatePath("/manager");
    revalidatePath("/manager/settings");
    return { success: true as const };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update monthly tariff",
    };
  }
}

export async function getMonthlyTariffsAction() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "manager") {
    return { error: "Only manager can view settings" };
  }
  try {
    const tariffs = await dbGetMonthlyTariffs();
    return { success: true as const, tariffs };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to load monthly tariffs",
    };
  }
}
