export const dynamic = "force-dynamic";

import { getAllBills, getAllCustomers } from "@/lib/google-sheets";
import ReadingsByBox from "./ReadingsByBox";
import EmployeeReadingsMonthSelect from "./EmployeeReadingsMonthSelect";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function EmployeeReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const [customers, bills] = await Promise.all([getAllCustomers(), getAllBills()]);
  const activeCustomers = customers.filter((c) => c.status === "ACTIVE");
  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const currentMonth = getCurrentMonthKey();
  const months = Array.from(new Set([...billMonths, currentMonth])).sort().reverse();
  const monthKey = params.month || currentMonth;
  const alreadyRecordedIds = new Set(
    bills.filter((b) => b.monthKey === monthKey).map((b) => b.customerId)
  );
  const pendingCustomers = activeCustomers.filter(
    (c) => !alreadyRecordedIds.has(c.customerId)
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Record Meter Reading</h1>
          <p className="text-slate-600 mt-1">
            Select a month and box number, then choose a customer. Customers already recorded
            for that month are hidden.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Month</label>
          <EmployeeReadingsMonthSelect months={months} currentMonth={monthKey} />
        </div>
      </div>
      <ReadingsByBox customers={pendingCustomers} monthKey={monthKey} />
    </div>
  );
}
