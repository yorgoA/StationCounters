/**
 * Billing calculation logic.
 * Ampere charge uses tiered pricing: each amperage (3A, 4A, 5A...) has a fixed price.
 */

import type { AmperePriceTier, Bill, BillingType, PaymentStatus } from "@/types";

export function calcUsageKwh(previousCounter: number, currentCounter: number): number {
  return Math.max(0, currentCounter - previousCounter);
}

/** Look up the price for a given amperage tier. Uses exact match, or nearest lower tier. */
export function getAmperePriceForTier(
  subscribedAmpere: number,
  tiers: AmperePriceTier[]
): number {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.amp - b.amp);
  const exact = sorted.find((t) => t.amp === subscribedAmpere);
  if (exact) return exact.price;
  // Use highest tier <= subscribedAmpere, or lowest tier if below min
  const lower = sorted.filter((t) => t.amp <= subscribedAmpere);
  return lower.length > 0 ? lower[lower.length - 1].price : sorted[0].price;
}

export function calcAmpereCharge(
  subscribedAmpere: number,
  tiers: AmperePriceTier[],
  billingType: BillingType
): number {
  if (billingType === "FREE") return 0;
  if (billingType === "AMPERE_ONLY" || billingType === "BOTH") {
    return getAmperePriceForTier(subscribedAmpere, tiers);
  }
  return 0;
}

export function calcConsumptionCharge(
  usageKwh: number,
  kwhPrice: number,
  billingType: BillingType
): number {
  if (billingType === "FREE") return 0;
  if (billingType === "KWH_ONLY" || billingType === "BOTH") {
    return usageKwh * kwhPrice;
  }
  return 0;
}

export function calcTotalBeforeDiscount(
  ampereCharge: number,
  consumptionCharge: number,
  previousUnpaidBalance: number
): number {
  return ampereCharge + consumptionCharge + previousUnpaidBalance;
}

export function calcTotalAfterDiscount(
  totalBeforeDiscount: number,
  fixedDiscountAmount: number
): number {
  const total = totalBeforeDiscount - fixedDiscountAmount;
  return Math.max(0, total); // Never negative
}

export function calcPaymentStatus(
  totalPaid: number,
  remainingDue: number
): PaymentStatus {
  if (remainingDue <= 0) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  return "UNPAID";
}

export function calcBillFromReadings(
  customerId: string,
  monthKey: string,
  previousCounter: number,
  currentCounter: number,
  subscribedAmpere: number,
  billingType: BillingType,
  fixedDiscountAmount: number,
  ampereTiers: AmperePriceTier[],
  kwhPrice: number,
  previousUnpaidBalance: number
): Omit<Bill, "billId" | "createdAt" | "updatedAt"> {
  const usageKwh = calcUsageKwh(previousCounter, currentCounter);
  // Free customers: bill is always 0
  if (billingType === "FREE") {
    return {
      customerId,
      monthKey,
      previousCounter,
      currentCounter,
      usageKwh,
      amperePriceSnapshot: 0,
      kwhPriceSnapshot: kwhPrice,
      ampereCharge: 0,
      consumptionCharge: 0,
      discountApplied: 0,
      previousUnpaidBalance: 0,
      totalDue: 0,
      totalPaid: 0,
      remainingDue: 0,
      paymentStatus: "PAID",
    };
  }
  const ampereCharge = calcAmpereCharge(subscribedAmpere, ampereTiers, billingType);
  const consumptionCharge = calcConsumptionCharge(usageKwh, kwhPrice, billingType);
  const totalBeforeDiscount = calcTotalBeforeDiscount(
    ampereCharge,
    consumptionCharge,
    previousUnpaidBalance
  );
  const discountApplied = Math.min(fixedDiscountAmount, totalBeforeDiscount);
  const totalDue = calcTotalAfterDiscount(totalBeforeDiscount, fixedDiscountAmount);
  const totalPaid = 0;
  const remainingDue = totalDue;
  const paymentStatus = calcPaymentStatus(totalPaid, remainingDue);
  const amperePriceSnapshot = getAmperePriceForTier(subscribedAmpere, ampereTiers);

  return {
    customerId,
    monthKey,
    previousCounter,
    currentCounter,
    usageKwh,
    amperePriceSnapshot,
    kwhPriceSnapshot: kwhPrice,
    ampereCharge,
    consumptionCharge,
    discountApplied,
    previousUnpaidBalance,
    totalDue,
    totalPaid,
    remainingDue,
    paymentStatus,
  };
}
