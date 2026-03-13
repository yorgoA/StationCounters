export const dynamic = "force-dynamic";

import { getAllCustomers } from "@/lib/google-sheets";
import { getAllBills } from "@/lib/google-sheets";
import { getAllPayments } from "@/lib/google-sheets";
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
  const [customers, bills, payments] = await Promise.all([
    getAllCustomers(),
    getAllBills(),
    getAllPayments(),
  ]);

  const monthKey = getCurrentMonthKey();
  const monthBills = bills.filter((b) => b.monthKey === monthKey);

  const totalBilled = monthBills.reduce((s, b) => s + b.totalDue, 0);
  const totalCollected = monthBills.reduce((s, b) => s + b.totalPaid, 0);
  const totalUnpaid = monthBills.reduce((s, b) => s + b.remainingDue, 0);

  const unpaidCustomers = monthBills.filter((b) => b.remainingDue > 0);
  const partialPayments = monthBills.filter((b) => b.paymentStatus === "PARTIAL");

  const monthPayments = payments.filter((p) =>
    p.paymentDate.startsWith(monthKey)
  );

  const activeCustomers = customers.filter((c) => c.status === "ACTIVE");
  const customersWithReadings = new Set(monthBills.map((b) => b.customerId));
  const customersWithoutReading = activeCustomers.filter(
    (c) => !customersWithReadings.has(c.customerId)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Manager Dashboard</h1>
      <p className="text-slate-500 mb-8">
        Overview for {monthKey}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total Customers</p>
          <p className="text-2xl font-bold text-slate-800">{customers.length}</p>
          <p className="text-xs text-slate-400 mt-1">{activeCustomers.length} active</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Billed This Month</p>
          <p className="text-2xl font-bold text-slate-800">{totalBilled.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Collected This Month</p>
          <p className="text-2xl font-bold text-green-600">{totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Unpaid This Month</p>
          <p className="text-2xl font-bold text-amber-600">{totalUnpaid.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Unpaid Customers</p>
          <p className="text-2xl font-bold text-slate-800">{unpaidCustomers.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Partial Payments</p>
          <p className="text-2xl font-bold text-slate-800">{partialPayments.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Missing {formatMonthKey(monthKey)}</p>
          <p className="text-2xl font-bold text-slate-800">{customersWithoutReading.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Latest Payments</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {monthPayments.slice(0, 10).map((p) => (
              <div
                key={p.paymentId}
                className="flex justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <span className="text-slate-700 truncate">{p.customerId}</span>
                <span className="font-medium text-slate-800">{p.amountPaid.toLocaleString()}</span>
              </div>
            ))}
            {monthPayments.length === 0 && (
              <p className="text-slate-500 py-4">No payments this month</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Unpaid Customers</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {unpaidCustomers.slice(0, 10).map((b) => {
              const cust = customers.find((c) => c.customerId === b.customerId);
              return (
                <Link
                  key={b.billId}
                  href={`/manager/customers/${b.customerId}`}
                  className="flex justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded px-2 -mx-2"
                >
                  <span className="text-slate-700 truncate">{cust?.fullName || b.customerId}</span>
                  <span className="font-medium text-amber-600">{b.remainingDue.toLocaleString()}</span>
                </Link>
              );
            })}
            {unpaidCustomers.length === 0 && (
              <p className="text-slate-500 py-4">All paid</p>
            )}
          </div>
        </div>
      </div>

      {customersWithoutReading.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">
            Customers Missing {formatMonthKey(monthKey)} Reading
          </h2>
          <ul className="space-y-1 text-slate-600">
            {customersWithoutReading.map((c) => (
              <li key={c.customerId}>
                <Link
                  href={`/manager/customers/${c.customerId}`}
                  className="hover:text-primary-600"
                >
                  {c.fullName} – {c.area} {c.building}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
