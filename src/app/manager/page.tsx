export const dynamic = "force-dynamic";

import {
  getAllCustomers,
  getAllBills,
  getKwhPriceForMonth,
  getSettings,
} from "@/lib/google-sheets";
import { ensureFixedMonthlyBillsForMonth } from "@/lib/fixed-monthly-auto-billing";
import Link from "next/link";
import DashboardMonthSelect from "./DashboardMonthSelect";

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

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = params.month || getPreviousMonthKey();
  await ensureFixedMonthlyBillsForMonth(monthKey);

  const [customers, bills, settings, monthKwhPrice] = await Promise.all([
    getAllCustomers(),
    getAllBills(),
    getSettings(),
    getKwhPriceForMonth(monthKey),
  ]);
  const monthBills = bills.filter((b) => b.monthKey === monthKey);

  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const currentKey = getCurrentMonthKey();
  const previousKey = getPreviousMonthKey();
  const allMonths = new Set([...billMonths, currentKey, previousKey]);
  const months = Array.from(allMonths).sort().reverse();

  const monitorIds = new Set(
    customers.filter((c) => c.isMonitor).map((c) => c.customerId)
  );
  const freeIds = new Set(customers.filter((c) => c.billingType === "FREE").map((c) => c.customerId));
  const excludedIds = new Set(
    Array.from(freeIds).concat(Array.from(monitorIds))
  );

  const currentPayingBills = monthBills.filter((b) => !excludedIds.has(b.customerId));
  const previousPayingBills = bills.filter(
    (b) => b.monthKey < monthKey && !excludedIds.has(b.customerId) && b.remainingDue > 0
  );

  const totalToBePaid = currentPayingBills.reduce((s, b) => s + b.totalDue, 0);
  const collected = currentPayingBills.reduce((s, b) => s + b.totalPaid, 0);
  const unpaidTotal = currentPayingBills.reduce((s, b) => s + b.remainingDue, 0);
  const previousUnpaid = previousPayingBills.reduce((s, b) => s + b.remainingDue, 0);
  const totalOwed = totalToBePaid + previousUnpaid;
  const payingKwh = currentPayingBills.reduce((s, b) => s + b.usageKwh, 0);
  const freeKwh = monthBills
    .filter((b) => freeIds.has(b.customerId) && !monitorIds.has(b.customerId))
    .reduce((s, b) => s + b.usageKwh, 0);
  const kwhPrice = monthKwhPrice > 0 ? monthKwhPrice : settings.kwhPrice;
  const billByCustomer = new Map(monthBills.map((b) => [b.customerId, b]));
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
      const linked = customers.find((x) => x.customerId === linkedId);
      if (!linked) return acc;
      if (linked.billingType !== "FIXED_MONTHLY" || linked.isMonitor) return acc;
      return acc + (kwhPrice > 0 ? linked.fixedMonthlyPrice / kwhPrice : 0);
    }, 0);
    return sum + Math.max(0, monitorUsage - included);
  }, 0);
  const totalCustomers = customers.filter((c) => !c.isMonitor);
  const activeCustomers = totalCustomers.filter((c) => c.status === "ACTIVE");
  const monitorCount = customers.filter((c) => c.isMonitor).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Manager Home
          </h1>
          <p className="text-slate-500 mt-1">
            High-level overview for {formatMonthKey(monthKey)}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            View month
          </label>
          <DashboardMonthSelect months={months} currentMonth={monthKey} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total customers</p>
          <p className="text-2xl font-bold text-slate-800 break-words leading-tight">
            {totalCustomers.length.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {activeCustomers.length} active · {totalCustomers.length - activeCustomers.length} inactive ·{" "}
            {monitorCount} monitors
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total to be paid</p>
          <p className="text-2xl font-bold text-slate-800 break-words leading-tight">
            {totalToBePaid.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="text-2xl font-bold text-green-600 break-words leading-tight">
            {collected.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Unpaid total</p>
          <p className="text-2xl font-bold text-amber-600 break-words leading-tight">
            {unpaidTotal.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Previous unpaid</p>
          <p className="text-2xl font-bold text-slate-800 break-words leading-tight">
            {previousUnpaid.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total owed</p>
          <p className="text-2xl font-bold text-rose-600 break-words leading-tight">
            {totalOwed.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4">Quick insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Paying kWh</p>
            <p className="text-xl font-bold text-slate-800">{payingKwh.toLocaleString()} kWh</p>
          </div>
          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Free customers kWh</p>
            <p className="text-xl font-bold text-slate-800">{freeKwh.toLocaleString()} kWh</p>
          </div>
          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Monitor excess (red match)</p>
            <p className="text-xl font-bold text-rose-600">
              {monitorExcessKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/manager/money?month=${monthKey}`} className="text-primary-600 font-medium hover:underline">
            Open Money Dashboard →
          </Link>
          <Link href={`/manager/kwh?month=${monthKey}`} className="text-primary-600 font-medium hover:underline">
            Open kWh Dashboard →
          </Link>
          <Link href={`/manager/monitors?month=${monthKey}`} className="text-primary-600 font-medium hover:underline">
            Open Monitors →
          </Link>
        </div>
      </div>
    </div>
  );
}
