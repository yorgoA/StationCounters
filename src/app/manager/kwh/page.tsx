export const dynamic = "force-dynamic";

import { ensureFixedMonthlyBillsForMonth } from "@/lib/fixed-monthly-auto-billing";
import {
  getAllBills,
  getAllCustomers,
  getKwhPriceForMonth,
  getSettings,
} from "@/lib/google-sheets";
import KwhMonthSelect from "./KwhMonthSelect";

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

function monthKeyFromDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isExcludedFromCollection(
  bill: { billingTypeSnapshot?: string; totalDue: number },
  customer: { billingType: string; isMonitor?: boolean } | undefined
): boolean {
  if (customer?.isMonitor) return true;
  if (bill.billingTypeSnapshot === "FREE") return true;
  if (!bill.billingTypeSnapshot && !(bill.totalDue > 0)) return true;
  return false;
}

export default async function ManagerKwhPage({
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
  const kwhPrice = monthKwhPrice > 0 ? monthKwhPrice : settings.kwhPrice;

  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const months = Array.from(
    new Set([...billMonths, getCurrentMonthKey(), getPreviousMonthKey()])
  ).sort().reverse();

  const monthBills = bills.filter((b) => b.monthKey === monthKey);
  const customerMap = new Map(customers.map((c) => [c.customerId, c]));
  const activeCustomers = customers.filter((c) => c.status === "ACTIVE");
  const monitorIds = new Set(activeCustomers.filter((c) => c.isMonitor).map((c) => c.customerId));
  const payingBills = monthBills.filter((b) => !isExcludedFromCollection(b, customerMap.get(b.customerId)));
  const freeBills = monthBills.filter((b) => {
    const customer = customerMap.get(b.customerId);
    return !customer?.isMonitor && isExcludedFromCollection(b, customer);
  });

  const payingKwh = payingBills.reduce((s, b) => s + b.usageKwh, 0);
  const fromAmpere = payingBills.reduce((s, b) => s + b.ampereCharge, 0);
  const fromConsumption = payingBills.reduce((s, b) => s + b.consumptionCharge, 0);
  const fromFixedMonthly = payingBills.reduce((s, b) => {
    const customer = customerMap.get(b.customerId);
    return customer?.billingType === "FIXED_MONTHLY" ? s + b.totalDue : s;
  }, 0);

  const freeKwh = freeBills.reduce((s, b) => s + b.usageKwh, 0);
  const billByCustomer = new Map(monthBills.map((b) => [b.customerId, b]));
  const monitorRows = activeCustomers.filter((c) => c.isMonitor);
  const monitorRedMatchKwh = monitorRows.reduce((sum, monitor) => {
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
  const ifFreeChargedKwh = freeKwh + monitorRedMatchKwh;

  const customersWithReading = new Set(monthBills.map((b) => b.customerId));
  const missingReadings = activeCustomers.filter((c) => {
    if (customersWithReading.has(c.customerId)) return false;
    const createdMonth = monthKeyFromDate(c.createdAt);
    if (createdMonth && createdMonth > monthKey) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">kWh Dashboard</h1>
          <p className="text-slate-500 mt-1">Usage view for {formatMonthKey(monthKey)}.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Month</label>
          <KwhMonthSelect months={months} currentMonth={monthKey} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Paying kWh (month)</p>
          <p className="text-2xl font-bold text-slate-800">{payingKwh.toLocaleString()} kWh</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">From Ampere (LBP)</p>
          <p className="text-2xl font-bold text-slate-800">{fromAmpere.toLocaleString()} LBP</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">From Consumption (LBP)</p>
          <p className="text-2xl font-bold text-slate-800">
            {fromConsumption.toLocaleString()} LBP
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">From Fixed Monthly (LBP)</p>
          <p className="text-2xl font-bold text-slate-800">
            {fromFixedMonthly.toLocaleString()} LBP
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Free customers kWh</p>
          <p className="text-2xl font-bold text-slate-800">{freeKwh.toLocaleString()} kWh</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Monitor red match kWh</p>
          <p className="text-2xl font-bold text-rose-600">
            {monitorRedMatchKwh.toLocaleString()} kWh
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">If free charged kWh</p>
          <p className="text-2xl font-bold text-slate-800">
            {ifFreeChargedKwh.toLocaleString()} kWh
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-2">Missing meter readings</h2>
        <p className="text-sm text-slate-500 mb-4">
          Active customers with no bill for the selected month.
        </p>
        <p className="text-lg font-semibold text-amber-700 mb-3">
          {missingReadings.length.toLocaleString()} customers
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {missingReadings.slice(0, 24).map((c) => (
            <div key={c.customerId} className="rounded border border-slate-200 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{c.fullName}</span>
              <span className="text-slate-500">
                {" "}
                - {c.area} {c.building}
              </span>
            </div>
          ))}
        </div>
        {missingReadings.length > 24 && (
          <p className="mt-3 text-sm text-slate-500">
            Showing 24 of {missingReadings.length.toLocaleString()} missing customers.
          </p>
        )}
      </div>
    </div>
  );
}

