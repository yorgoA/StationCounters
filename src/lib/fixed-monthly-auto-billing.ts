import { calcBillFromReadings } from "@/lib/billing";
import {
  createBill,
  getAllBills,
  getBillingHistoryByCustomer,
  getAllCustomers,
  getAmperePrices,
  getBillingProfileForMonth,
  getKwhPriceForMonth,
  upsertBillingHistoryEntry,
} from "@/lib/google-sheets";
import { generateId } from "@/lib/id";
import type { Bill, Customer, CustomerBillingHistory } from "@/types";

type EnsureResult = { created: number };

const CHECK_TTL_MS = 60_000;
const recentChecks = new Map<string, number>();
const inflightChecks = new Map<string, Promise<EnsureResult>>();

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function latestCounterForCustomer(bills: Bill[], customerId: string): number {
  const latest = bills
    .filter((b) => b.customerId === customerId)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];
  return latest?.currentCounter ?? 0;
}

function isEligibleFixedMonthly(customer: Customer): boolean {
  return customer.status === "ACTIVE" && !customer.isMonitor;
}

export async function ensureFixedMonthlyBillsForMonth(monthKey: string): Promise<EnsureResult> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return { created: 0 };
  // Safety: auto-generate only for current month to avoid recreating
  // historical/future bills when managers browse other months.
  if (monthKey !== getCurrentMonthKey()) return { created: 0 };

  const now = Date.now();
  const checkedAt = recentChecks.get(monthKey) ?? 0;
  if (now - checkedAt < CHECK_TTL_MS) return { created: 0 };

  const inflight = inflightChecks.get(monthKey);
  if (inflight) return inflight;

  const run = (async (): Promise<EnsureResult> => {
    const [customers, bills, kwhPrice, ampereTiers] = await Promise.all([
      getAllCustomers(),
      getAllBills(),
      getKwhPriceForMonth(monthKey),
      getAmperePrices(),
    ]);

    const existingForMonth = new Set(
      bills.filter((b) => b.monthKey === monthKey).map((b) => b.customerId)
    );

    const fixedMonthlyCustomers = customers.filter(isEligibleFixedMonthly);
    let created = 0;

    // Sequential writes are safer for Sheets API quotas.
    for (const customer of fixedMonthlyCustomers) {
      if (existingForMonth.has(customer.customerId)) continue;
      const profile = await getBillingProfileForMonth(customer.customerId, monthKey);
      if (!profile) continue;
      const effectiveBillingType = profile.isMonitor ? "FREE" : profile.billingType;
      if (effectiveBillingType !== "FIXED_MONTHLY") continue;

      const previousCounter = latestCounterForCustomer(bills, customer.customerId);
      const previousUnpaid = getPreviousUnpaidBalance(
        bills.filter((b) => b.customerId === customer.customerId),
        monthKey
      );

      const calc = calcBillFromReadings(
        customer.customerId,
        monthKey,
        previousCounter,
        previousCounter,
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

      await createBill(bill);
      const history = await getBillingHistoryByCustomer(customer.customerId);
      if (!history.some((h) => h.monthKey === monthKey)) {
        const snapshotEntry: CustomerBillingHistory = {
          entryId: `cbh_${customer.customerId}_${monthKey}`,
          customerId: customer.customerId,
          monthKey,
          billingType: profile.billingType,
          subscribedAmpere: profile.subscribedAmpere,
          fixedMonthlyPrice: profile.fixedMonthlyPrice,
          fixedDiscountAmount: profile.fixedDiscountAmount,
          fixedDiscountPercent: profile.fixedDiscountPercent,
          isMonitor: profile.isMonitor,
          reason: "Auto-snapshot at bill creation",
          updatedByRole: "manager",
          updatedAt: new Date().toISOString(),
        };
        await upsertBillingHistoryEntry(snapshotEntry);
      }
      created++;
      existingForMonth.add(customer.customerId);
      bills.push(bill);
    }

    recentChecks.set(monthKey, Date.now());
    return { created };
  })();

  inflightChecks.set(monthKey, run);
  try {
    return await run;
  } finally {
    inflightChecks.delete(monthKey);
  }
}

