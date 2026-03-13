export const dynamic = "force-dynamic";

import { getAllCustomers, getAllBills, getSettings, getAmperePrices } from "@/lib/google-sheets";
import { getAmperePriceForTier } from "@/lib/billing";
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
  const [customers, bills, settings, ampereTiers] = await Promise.all([
    getAllCustomers(),
    getAllBills(),
    getSettings(),
    getAmperePrices(),
  ]);

  // Default to previous month (billing period - you collect for Feb during March)
  const monthKey = params.month || getPreviousMonthKey();
  const monthBills = bills.filter((b) => b.monthKey === monthKey);

  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const currentKey = getCurrentMonthKey();
  const previousKey = getPreviousMonthKey();
  const allMonths = new Set([...billMonths, currentKey, previousKey]);
  const months = Array.from(allMonths).sort().reverse();

  const freeCustomerIds = new Set(
    customers.filter((c) => c.billingType === "FREE").map((c) => c.customerId)
  );
  const allPayingBills = bills.filter((b) => !freeCustomerIds.has(b.customerId));
  const payingBills = monthBills.filter((b) => !freeCustomerIds.has(b.customerId));
  const previousPayingBills = allPayingBills.filter(
    (b) => b.monthKey < monthKey && b.remainingDue > 0
  );

  const totalBilled = payingBills.reduce((s, b) => s + b.totalDue, 0);
  const totalCollected = payingBills.reduce((s, b) => s + b.totalPaid, 0);
  const unpaidThisMonth = payingBills.reduce((s, b) => s + b.remainingDue, 0);
  const unpaidPreviousMonths = previousPayingBills.reduce(
    (s, b) => s + b.remainingDue,
    0
  );
  const totalUnpaid = unpaidThisMonth + unpaidPreviousMonths;

  const totalAmpereBilled = payingBills.reduce((s, b) => s + b.ampereCharge, 0);
  const freeBillsThisMonth = monthBills.filter((b) => freeCustomerIds.has(b.customerId));
  const customerMap = new Map(customers.map((c) => [c.customerId, c]));
  const ampereExpectedInclFree =
    totalAmpereBilled +
    freeBillsThisMonth.reduce((s, b) => {
      const cust = customerMap.get(b.customerId);
      if (!cust) return s;
      return s + getAmperePriceForTier(cust.subscribedAmpere, ampereTiers);
    }, 0);
  const totalConsumptionBilled = payingBills.reduce(
    (s, b) => s + b.consumptionCharge,
    0
  );
  const totalKwhPaying = payingBills.reduce((s, b) => s + b.usageKwh, 0);
  const totalKwhInclFree = monthBills.reduce((s, b) => s + b.usageKwh, 0);
  const totalKwhAllTime = bills.reduce((s, b) => s + b.usageKwh, 0);
  const kwhPrice = settings.kwhPrice || 0;
  const consumptionExpectedInclFree =
    kwhPrice > 0 ? Math.round(totalKwhInclFree * kwhPrice) : 0;

  const unpaidThisMonthList = payingBills.filter((b) => b.remainingDue > 0);
  const unpaidByPreviousMonth = previousPayingBills.reduce(
    (acc, b) => {
      const list = acc.get(b.monthKey) ?? [];
      list.push(b);
      acc.set(b.monthKey, list);
      return acc;
    },
    new Map<string, typeof previousPayingBills>()
  );

  const activeCustomers = customers.filter((c) => c.status === "ACTIVE");
  const payingActiveCustomers = activeCustomers.filter(
    (c) => c.billingType !== "FREE"
  );
  const freeCustomers = customers.filter((c) => c.billingType === "FREE");
  const customersWithReadings = new Set(monthBills.map((b) => b.customerId));
  const customersWithoutReading = payingActiveCustomers.filter(
    (c) => !customersWithReadings.has(c.customerId)
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Manager Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Overview for {formatMonthKey(monthKey)}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            View month
          </label>
          <DashboardMonthSelect months={months} currentMonth={monthKey} />
        </div>
      </div>

      {/* Top row: counts and money */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total Customers</p>
          <p className="text-2xl font-bold text-slate-800">{customers.length}</p>
          <p className="text-xs text-slate-400 mt-1">
            {activeCustomers.length} active · {customers.length - activeCustomers.length} inactive
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total Billed</p>
          <p className="text-2xl font-bold text-slate-800">
            {totalBilled.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Billed for {formatMonthKey(monthKey)} (LBP)
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">
            {totalCollected.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            LBP received for {formatMonthKey(monthKey)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Unpaid Total</p>
          <p className="text-2xl font-bold text-amber-600">
            {totalUnpaid.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {unpaidThisMonth.toLocaleString()} this month · {unpaidPreviousMonths.toLocaleString()} previous
          </p>
        </div>
      </div>

      {/* Revenue breakdown: With free (paying only) */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4">
          With Free ({formatMonthKey(monthKey)}) — Paying only
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-slate-500">From Ampere</p>
            <p className="text-xl font-bold text-slate-800">
              {totalAmpereBilled.toLocaleString()} LBP
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">From Consumption (kWh)</p>
            <p className="text-xl font-bold text-slate-800">
              {totalConsumptionBilled.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {totalKwhPaying.toLocaleString()} kWh
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Billed</p>
            <p className="text-xl font-bold text-slate-800">
              {totalBilled.toLocaleString()} LBP
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Total kWh (all time)</p>
            <p className="text-xl font-bold text-slate-800">
              {totalKwhAllTime.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
            </p>
          </div>
        </div>
      </div>

      {/* Revenue breakdown: If free charged */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4">
          If Free Charged ({formatMonthKey(monthKey)}) — All customers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-slate-500">From Ampere</p>
            <p className="text-xl font-bold text-slate-800">
              {ampereExpectedInclFree.toLocaleString()} LBP
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">From Consumption (kWh)</p>
            <p className="text-xl font-bold text-slate-800">
              {consumptionExpectedInclFree.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {totalKwhInclFree.toLocaleString()} kWh
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Total (hypothetical)</p>
            <p className="text-xl font-bold text-slate-800">
              {(ampereExpectedInclFree + consumptionExpectedInclFree).toLocaleString()} LBP
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Total kWh (all time)</p>
            <p className="text-xl font-bold text-slate-800">
              {totalKwhAllTime.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
            </p>
          </div>
        </div>
      </div>

      {/* Unpaid breakdown: this month + previous months */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4">Unpaid Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-medium text-slate-700 mb-2">
              Unpaid {formatMonthKey(monthKey)}
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              {unpaidThisMonthList.length} customer
              {unpaidThisMonthList.length !== 1 ? "s" : ""} ·{" "}
              {unpaidThisMonth.toLocaleString()} LBP
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {unpaidThisMonthList.slice(0, 15).map((b) => {
                const cust = customers.find((c) => c.customerId === b.customerId);
                return (
                  <Link
                    key={b.billId}
                    href={`/manager/customers/${b.customerId}`}
                    className="flex justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded px-2 -mx-2"
                  >
                    <span className="text-slate-700 truncate">
                      {cust?.fullName || b.customerId}
                    </span>
                    <span className="font-medium text-amber-600">
                      {b.remainingDue.toLocaleString()} LBP
                    </span>
                  </Link>
                );
              })}
              {unpaidThisMonthList.length === 0 && (
                <p className="text-slate-500 py-4">All paid for this month.</p>
              )}
              {unpaidThisMonthList.length > 15 && (
                <p className="text-sm text-slate-400">
                  <Link
                    href={`/manager/reports/${monthKey}/unpaid`}
                    className="text-primary-600 hover:underline"
                  >
                    View all {unpaidThisMonthList.length}
                  </Link>
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-medium text-slate-700 mb-2">
              Unpaid Previous Months
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              {unpaidPreviousMonths > 0
                ? `${unpaidPreviousMonths.toLocaleString()} LBP total`
                : "No previous unpaid balance."}
            </p>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {Array.from(unpaidByPreviousMonth.entries())
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([mKey, billList]) => {
                  const sum = billList.reduce((s, b) => s + b.remainingDue, 0);
                  return (
                    <div key={mKey} className="border-b border-slate-100 pb-2 last:border-0">
                      <Link
                        href={`/manager/reports/${mKey}/unpaid`}
                        className="font-medium text-slate-700 hover:text-primary-600"
                      >
                        {formatMonthKey(mKey)}
                      </Link>
                      <span className="text-amber-600 ml-2 font-medium">
                        {sum.toLocaleString()} LBP
                      </span>
                      <span className="text-slate-400 text-sm ml-2">
                        ({billList.length} customer{billList.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                  );
                })}
              {unpaidByPreviousMonth.size === 0 && (
                <p className="text-slate-500 py-4">None.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Missing meter readings */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4">
          Missing Meter Readings
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Paying customers with no meter reading for {formatMonthKey(monthKey)}.
        </p>
        {customersWithoutReading.length > 0 ? (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {customersWithoutReading.map((c) => (
              <li key={c.customerId}>
                <Link
                  href={`/manager/customers/${c.customerId}`}
                  className="text-slate-700 hover:text-primary-600"
                >
                  {c.fullName} – {c.area} {c.building}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">All paying customers have readings.</p>
        )}
      </div>
    </div>
  );
}
