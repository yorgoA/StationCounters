"use client";

import { useRouter } from "next/navigation";

export default function BillsMonthSelect({
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
      onChange={(e) => router.push(`/manager/bills?month=${e.target.value}`)}
      className="input max-w-xs"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
