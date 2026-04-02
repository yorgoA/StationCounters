"use client";

import { useRouter } from "next/navigation";

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function MoneyMonthSelect({
  months,
  currentMonth,
}: {
  months: string[];
  currentMonth: string;
}) {
  const router = useRouter();
  return (
    <select
      value={currentMonth}
      onChange={(e) => {
        router.push(`/manager/money?month=${e.target.value}`);
        router.refresh();
      }}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {formatMonthKey(m)}
        </option>
      ))}
    </select>
  );
}

