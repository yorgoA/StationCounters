export const dynamic = "force-dynamic";

import Link from "next/link";
import { ensureFixedMonthlyBillsForMonth } from "@/lib/fixed-monthly-auto-billing";
import { getAmperePriceForTier } from "@/lib/billing";
import {
  getAllBills,
  getAllCustomers,
  getAmperePrices,
  getKwhPriceForMonth,
  getSettings,
} from "@/lib/google-sheets";
import type { BillingType } from "@/types";
import MoneyMonthSelect from "./MoneyMonthSelect";
import MoneyUsdRateForm from "./MoneyUsdRateForm";
import UnpaidCustomersDownloadButton from "./UnpaidCustomersDownloadButton";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const prev = m === 0 ? new Date(y - 1, 11) : new Date(y, m - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function monthOrder(monthKey: string): number | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(monthKey || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return year * 100 + month;
}

function isBeforeMonth(left: string, right: string): boolean {
  const l = monthOrder(left);
  const r = monthOrder(right);
  if (l === null || r === null) return false;
  return l < r;
}

function usdOf(lbp: number, usdRate: number): string {
  if (!(usdRate > 0)) return "—";
  return (lbp / usdRate).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isExcludedFromCollection(
  bill: { billingTypeSnapshot?: string; customerId: string; totalDue: number },
  customer: { billingType: string; isMonitor?: boolean } | undefined
): boolean {
  if (customer?.isMonitor) return true;
  if (bill.billingTypeSnapshot === "FREE") return true;
  // Legacy bills may not have snapshots; classify by bill value, not current customer type.
  if (!bill.billingTypeSnapshot && !(bill.totalDue > 0)) return true;
  return false;
}

export default async function ManagerMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = params.month || getPreviousMonthKey();
  await ensureFixedMonthlyBillsForMonth(monthKey);

  const [customers, bills, ampereTiers, monthKwhPrice, settings] = await Promise.all([
    getAllCustomers(),
    getAllBills(),
    getAmperePrices(),
    getKwhPriceForMonth(monthKey),
    getSettings(),
  ]);
  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const months = Array.from(
    new Set([...billMonths, getCurrentMonthKey(), getPreviousMonthKey()])
  ).sort().reverse();

  const monitorIds = new Set(customers.filter((c) => c.isMonitor).map((c) => c.customerId));
  const customerMap = new Map(customers.map((c) => [c.customerId, c]));

  const monthPayingBills = bills.filter(
    (b) => b.monthKey === monthKey && !isExcludedFromCollection(b, customerMap.get(b.customerId))
  );
  const previousPayingBills = bills.filter(
    (b) => {
      if (!isBeforeMonth(b.monthKey, monthKey)) return false;
      if (isExcludedFromCollection(b, customerMap.get(b.customerId))) return false;
      if (!(b.remainingDue > 0)) return false;
      return true;
    }
  );
  const effectiveKwhPrice = monthKwhPrice > 0 ? monthKwhPrice : settings.kwhPrice;
  const freeNonMonitorIds = new Set(
    customers
      .filter((c) => c.billingType === "FREE" && !c.isMonitor)
      .map((c) => c.customerId)
  );
  const monthFreeBills = bills.filter(
    (b) => b.monthKey === monthKey && freeNonMonitorIds.has(b.customerId)
  );
  const freeLostFromAmpere = monthFreeBills.reduce((sum, b) => {
    const customer = customerMap.get(b.customerId);
    if (!customer) return sum;
    return sum + getAmperePriceForTier(customer.subscribedAmpere, ampereTiers);
  }, 0);
  const freeLostFromConsumption = monthFreeBills.reduce(
    (sum, b) => sum + Math.round(b.usageKwh * effectiveKwhPrice),
    0
  );
  const freeLostTotal = freeLostFromAmpere + freeLostFromConsumption;
  const billByCustomer = new Map(bills.filter((b) => b.monthKey === monthKey).map((b) => [b.customerId, b]));
  const monitorRows = customers.filter((c) => c.isMonitor);
  const monitorExcessKwh = monitorRows.reduce((sum, monitor) => {
    const links = monitor.linkedCustomerIds?.length
      ? monitor.linkedCustomerIds
      : monitor.linkedCustomerId
        ? [monitor.linkedCustomerId]
        : [];
    if (links.length === 0) return sum;
    const monitorBill = billByCustomer.get(monitor.customerId);
    const firstLinkedBill = billByCustomer.get(links[0]);
    const monitorUsage = (monitorBill ?? firstLinkedBill)?.usageKwh ?? 0;
    const included = links.reduce((acc, linkedId) => {
      const linked = customerMap.get(linkedId);
      if (!linked) return acc;
      if (linked.billingType !== "FIXED_MONTHLY" || linked.isMonitor) return acc;
      return acc + (effectiveKwhPrice > 0 ? linked.fixedMonthlyPrice / effectiveKwhPrice : 0);
    }, 0);
    return sum + Math.max(0, monitorUsage - included);
  }, 0);
  const monitorExcessLost = Math.round(monitorExcessKwh * effectiveKwhPrice);
  const usdRate = settings.usdRate > 0 ? settings.usdRate : 89700;

  const totalToBePaid = monthPayingBills.reduce((s, b) => s + b.totalDue, 0);
  const totalCollected = monthPayingBills.reduce((s, b) => s + b.totalPaid, 0);
  const unpaidTotal = monthPayingBills.reduce((s, b) => s + b.remainingDue, 0);
  const previousUnpaid = previousPayingBills.reduce((s, b) => s + b.remainingDue, 0);
  const unpaidRows = monthPayingBills
    .filter((b) => b.remainingDue > 0)
    .map((b) => ({
      billId: b.billId,
      customerId: b.customerId,
      customerName: customerMap.get(b.customerId)?.fullName || b.customerId,
      unpaid: b.remainingDue,
    }))
    .sort((a, b) => b.unpaid - a.unpaid);

  const byBillingType: Record<BillingType, number> = {
    BOTH: 0,
    KWH_ONLY: 0,
    AMPERE_ONLY: 0,
    FIXED_MONTHLY: 0,
    FREE: 0,
  };
  for (const b of monthPayingBills) {
    const t = (b.billingTypeSnapshot ||
      customerMap.get(b.customerId)?.billingType ||
      "BOTH") as BillingType;
    byBillingType[t] = (byBillingType[t] || 0) + b.totalDue;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Money Dashboard</h1>
          <p className="text-slate-500 mt-1">Financial view for {formatMonthKey(monthKey)}.</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <MoneyUsdRateForm initialUsdRate={usdRate} />
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Month</label>
            <MoneyMonthSelect months={months} currentMonth={monthKey} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total to be paid</p>
          <p className="text-2xl font-bold text-slate-800">{totalToBePaid.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">${usdOf(totalToBePaid, usdRate)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">{totalCollected.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">${usdOf(totalCollected, usdRate)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Unpaid total</p>
          <p className="text-2xl font-bold text-amber-600">{unpaidTotal.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">${usdOf(unpaidTotal, usdRate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Previous unpaid</p>
          <p className="text-2xl font-bold text-slate-800">{previousUnpaid.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">${usdOf(previousUnpaid, usdRate)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Lost from free (excl. monitors)</p>
          <p className="text-2xl font-bold text-rose-600">{freeLostTotal.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">${usdOf(freeLostTotal, usdRate)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Lost from monitor excess (red)</p>
          <p className="text-2xl font-bold text-rose-600">{monitorExcessLost.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">
            {monitorExcessKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh red match
          </p>
          <p className="text-xs text-slate-500">${usdOf(monitorExcessLost, usdRate)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Total to be paid breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Both</p>
            <p className="text-xl font-bold text-slate-800">
              {byBillingType.BOTH.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-500 mt-1">${usdOf(byBillingType.BOTH, usdRate)}</p>
          </div>
          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-500">kWh only</p>
            <p className="text-xl font-bold text-slate-800">
              {byBillingType.KWH_ONLY.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-500 mt-1">${usdOf(byBillingType.KWH_ONLY, usdRate)}</p>
          </div>
          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Ampere only</p>
            <p className="text-xl font-bold text-slate-800">
              {byBillingType.AMPERE_ONLY.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-500 mt-1">${usdOf(byBillingType.AMPERE_ONLY, usdRate)}</p>
          </div>
          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Fixed monthly</p>
            <p className="text-xl font-bold text-slate-800">
              {byBillingType.FIXED_MONTHLY.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-500 mt-1">${usdOf(byBillingType.FIXED_MONTHLY, usdRate)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">Unpaid customers</h2>
          {unpaidRows.length > 0 ? (
            <UnpaidCustomersDownloadButton monthKey={monthKey} rows={unpaidRows} />
          ) : null}
        </div>
        {unpaidRows.length === 0 ? (
          <p className="text-slate-500">No unpaid bills this month.</p>
        ) : (
          <div className="space-y-2">
            {unpaidRows.map((r) => (
              <Link
                key={r.billId}
                href={`/manager/customers/${r.customerId}`}
                className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="text-slate-800">{r.customerName}</span>
                <span className="font-medium text-amber-700">
                  {r.unpaid.toLocaleString()} LBP
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

