export const dynamic = "force-dynamic";

import { getAllBills, getAllCustomers } from "@/lib/google-sheets";
import FreeCustomersList from "./FreeCustomersList";
import FreeCustomersMonthSelect from "./FreeCustomersMonthSelect";

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

export default async function ManagerFreeCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const [customers, bills] = await Promise.all([getAllCustomers(), getAllBills()]);
  const freeCustomers = customers.filter((c) => c.billingType === "FREE" && !c.isMonitor);
  const freeCustomerIds = new Set(freeCustomers.map((c) => c.customerId));
  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const currentKey = getCurrentMonthKey();
  const previousKey = getPreviousMonthKey();
  const allMonths = new Set([...billMonths, currentKey, previousKey]);
  const months = Array.from(allMonths).sort().reverse();
  const monthKey = params.month || getPreviousMonthKey();
  const totalFreeKwh = bills
    .filter((b) => b.monthKey === monthKey && freeCustomerIds.has(b.customerId))
    .reduce((s, b) => s + b.usageKwh, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Free Customers</h1>
          <p className="text-slate-500 mt-1">
            Manage customers who are exempt from charges. Uncheck to remove from free list.
            Add a reason for tracking.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Month</label>
          <FreeCustomersMonthSelect months={months} currentMonth={monthKey} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5 mb-8 max-w-md">
        <p className="text-sm text-slate-500">
          Total kWh used by free customers ({formatMonthKey(monthKey)})
        </p>
        <p className="text-2xl font-bold text-slate-800">
          {totalFreeKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
        </p>
      </div>

      <FreeCustomersList customers={freeCustomers} />
    </div>
  );
}
