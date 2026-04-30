"use client";

import { useRouter } from "next/navigation";

export default function BillsMonthSelect({
  months,
  currentMonth,
  currentStatus,
  currentRegion,
}: {
  months: string[];
  currentMonth: string;
  currentStatus: "all" | "paid" | "partial" | "unpaid";
  currentRegion: "ALL" | "MRAH_GHANEM" | "PRINTANIA";
}) {
  const router = useRouter();

  const buildUrl = (
    month: string,
    status: "all" | "paid" | "partial" | "unpaid",
    region: "ALL" | "MRAH_GHANEM" | "PRINTANIA"
  ) => {
    const qs = new URLSearchParams();
    qs.set("month", month);
    if (region !== "ALL") {
      qs.set("region", region);
    }
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
            router.push(buildUrl(e.target.value, currentStatus, currentRegion))
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
              buildUrl(
                currentMonth,
                e.target.value as "all" | "paid" | "partial" | "unpaid",
                currentRegion
              )
            )
          }
          className="input w-full max-w-xs"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Filter by region</label>
        <select
          value={currentRegion}
          onChange={(e) =>
            router.push(
              buildUrl(
                currentMonth,
                currentStatus,
                e.target.value as "ALL" | "MRAH_GHANEM" | "PRINTANIA"
              )
            )
          }
          className="input w-full max-w-xs"
        >
          <option value="ALL">All regions</option>
          <option value="MRAH_GHANEM">Mrah Ghanem</option>
          <option value="PRINTANIA">Printania</option>
        </select>
      </div>
    </div>
  );
}
