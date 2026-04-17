"use client";

import { useRouter } from "next/navigation";

export default function BillsMonthSelect({
  months,
  currentMonth,
  currentStatus,
}: {
  months: string[];
  currentMonth: string;
  currentStatus: "all" | "paid" | "unpaid";
}) {
  const router = useRouter();

  const buildUrl = (month: string, status: "all" | "paid" | "unpaid") => {
    const qs = new URLSearchParams();
    qs.set("month", month);
    if (status !== "all") {
      qs.set("status", status);
    }
    return `/manager/bills?${qs.toString()}`;
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Filter by month</label>
        <select
          value={currentMonth}
          onChange={(e) =>
            router.push(buildUrl(e.target.value, currentStatus))
          }
          className="input w-full max-w-xs"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Filter by status</label>
        <select
          value={currentStatus}
          onChange={(e) =>
            router.push(
              buildUrl(currentMonth, e.target.value as "all" | "paid" | "unpaid")
            )
          }
          className="input w-full max-w-xs"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>
    </div>
  );
}
