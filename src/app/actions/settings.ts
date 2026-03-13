"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  getSettings as dbGetSettings,
  updateSettings as dbUpdateSettings,
  updateAmperePrices as dbUpdateAmperePrices,
} from "@/lib/google-sheets";
import type { AmperePriceTier, Settings } from "@/types";

export async function updateSettingsAction(settings: Partial<Pick<Settings, "kwhPrice" | "currency">>) {
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
