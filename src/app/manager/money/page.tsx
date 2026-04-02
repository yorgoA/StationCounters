export const dynamic = "force-dynamic";

import Link from "next/link";
import { ensureFixedMonthlyBillsForMonth } from "@/lib/fixed-monthly-auto-billing";
import { getAllBills, getAllCustomers } from "@/lib/google-sheets";
import MoneyMonthSelect from "./MoneyMonthSelect";

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

export default async function ManagerMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = params.month || getPreviousMonthKey();
  await ensureFixedMonthlyBillsForMonth(monthKey);

  const [customers, bills] = await Promise.all([getAllCustomers(), getAllBills()]);
  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const months = Array.from(
    new Set([...billMonths, getCurrentMonthKey(), getPreviousMonthKey()])
  ).sort().reverse();

  const monitorIds = new Set(customers.filter((c) => c.isMonitor).map((c) => c.customerId));
  const freeIds = new Set(customers.filter((c) => c.billingType === "FREE").map((c) => c.customerId));
  const excludedIds = new Set(
    Array.from(monitorIds).concat(Array.from(freeIds))
  );
  const customerMap = new Map(customers.map((c) => [c.customerId, c]));

  const monthPayingBills = bills.filter(
    (b) => b.monthKey === monthKey && !excludedIds.has(b.customerId)
  );
  const previousPayingBills = bills.filter(
    (b) => b.monthKey < monthKey && !excludedIds.has(b.customerId) && b.remainingDue > 0
  );

  const totalToBePaid = monthPayingBills.reduce((s, b) => s + b.totalDue, 0);
  const totalCollected = monthPayingBills.reduce((s, b) => s + b.totalPaid, 0);
  const unpaidTotal = monthPayingBills.reduce((s, b) => s + b.remainingDue, 0);
  const previousUnpaid = previousPayingBills.reduce((s, b) => s + b.remainingDue, 0);
  const totalOverpaid = monthPayingBills.reduce(
    (s, b) => s + Math.max(0, b.totalPaid - b.totalDue),
    0
  );
  const overpaidRows = monthPayingBills
    .filter((b) => b.totalPaid > b.totalDue)
    .map((b) => ({
      billId: b.billId,
      customerId: b.customerId,
      customerName: customerMap.get(b.customerId)?.fullName || b.customerId,
      overpaid: b.totalPaid - b.totalDue,
    }))
    .sort((a, b) => b.overpaid - a.overpaid);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Money Dashboard</h1>
          <p className="text-slate-500 mt-1">Financial view for {formatMonthKey(monthKey)}.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Month</label>
          <MoneyMonthSelect months={months} currentMonth={monthKey} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Total to be paid</p>
          <p className="text-2xl font-bold text-slate-800">{totalToBePaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">{totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Unpaid total</p>
          <p className="text-2xl font-bold text-amber-600">{unpaidTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Previous unpaid</p>
          <p className="text-2xl font-bold text-slate-800">{previousUnpaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Overpaid</p>
          <p className="text-2xl font-bold text-indigo-600">{totalOverpaid.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Overpaid customers</h2>
        {overpaidRows.length === 0 ? (
          <p className="text-slate-500">No overpaid bills this month.</p>
        ) : (
          <div className="space-y-2">
            {overpaidRows.map((r) => (
              <Link
                key={r.billId}
                href={`/manager/customers/${r.customerId}`}
                className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="text-slate-800">{r.customerName}</span>
                <span className="font-medium text-indigo-700">
                  {r.overpaid.toLocaleString()} LBP
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

