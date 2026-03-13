export const dynamic = "force-dynamic";

import { getAllCustomers } from "@/lib/google-sheets";
import { getAllBills } from "@/lib/google-sheets";
import Link from "next/link";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function ManagerDashboardPage() {
  const [customers, bills] = await Promise.all([
    getAllCustomers(),
    getAllBills(),
  ]);

  const monthKey = getCurrentMonthKey();
  const monthBills = bills.filter((b) => b.monthKey === monthKey);

  const totalBilled = monthBills.reduce((s, b) => s + b.totalDue, 0);
  const totalCollected = monthBills.reduce((s, b) => s + b.totalPaid, 0);
  const totalUnpaid = monthBills.reduce((s, b) => s + b.remainingDue, 0);

  const totalAmpereBilled = monthBills.reduce((s, b) => s + b.ampereCharge, 0);
  const totalConsumptionBilled = monthBills.reduce(
    (s, b) => s + b.consumptionCharge,
    0
  );
  const totalKwh = monthBills.reduce((s, b) => s + b.usageKwh, 0);

  const unpaidCustomers = monthBills.filter((b) => b.remainingDue > 0);

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
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Manager Dashboard
      </h1>
      <p className="text-slate-500 mb-8">
        Overview for {formatMonthKey(monthKey)}
      </p>

      {/* Top row: counts and money */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total Customers</p>
          <p className="text-2xl font-bold text-slate-800">{customers.length}</p>
          <p className="text-xs text-slate-400 mt-1">
            {payingActiveCustomers.length} paying · {freeCustomers.length} free
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total Billed</p>
          <p className="text-2xl font-bold text-slate-800">
            {totalBilled.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">Invoiced this month (LBP)</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">
            {totalCollected.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">LBP received this month</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Unpaid</p>
          <p className="text-2xl font-bold text-amber-600">
            {totalUnpaid.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {unpaidCustomers.length} customer
            {unpaidCustomers.length !== 1 ? "s" : ""} with balance
          </p>
        </div>
      </div>

      {/* Revenue breakdown: Ampere vs Consumption */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4">
          Revenue Breakdown (This Month)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-slate-500">From Ampere</p>
            <p className="text-xl font-bold text-slate-800">
              {totalAmpereBilled.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Fixed subscription charges
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">From Consumption (kWh)</p>
            <p className="text-xl font-bold text-slate-800">
              {totalConsumptionBilled.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {totalKwh.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}{" "}
              kWh sold
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Billed</p>
            <p className="text-xl font-bold text-slate-800">
              {totalBilled.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ampere + Consumption
            </p>
          </div>
        </div>
      </div>

      {/* Missing meter readings + Unpaid list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">
            Missing Meter Readings
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Paying customers with no counter reading recorded for this month.
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

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Unpaid Customers</h2>
          <p className="text-sm text-slate-500 mb-4">
            {unpaidCustomers.length} with remaining balance (includes partial
            payments).
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {unpaidCustomers.slice(0, 20).map((b) => {
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
            {unpaidCustomers.length === 0 && (
              <p className="text-slate-500 py-4">All paid.</p>
            )}
            {unpaidCustomers.length > 20 && (
              <p className="text-sm text-slate-400 pt-2">
                …and {unpaidCustomers.length - 20} more. See{" "}
                <Link
                  href={`/manager/reports/${monthKey}/unpaid`}
                  className="text-primary-600 hover:underline"
                >
                  full list
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
