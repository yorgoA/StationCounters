"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Customer } from "@/types";

export default function ReadingsByBox({
  customers,
  monthKey,
  readingsLinkPath = "/employee/readings",
}: {
  customers: Customer[];
  monthKey: string;
  readingsLinkPath?: string;
}) {
  const [boxFilter, setBoxFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const uniqueBoxes = useMemo(() => {
    const set = new Set(customers.map((c) => c.area || "").filter((a) => a !== ""));
    const arr = Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    const hasNoBox = customers.some((c) => !c.area?.trim());
    if (hasNoBox) arr.push("(No box)");
    return arr;
  }, [customers]);

  const filteredByBox = useMemo(() => {
    if (showAll) return customers;
    if (!boxFilter) return [];
    if (boxFilter === "(No box)")
      return customers.filter((c) => !c.area?.trim());
    return customers.filter((c) => c.area === boxFilter);
  }, [customers, boxFilter, showAll]);

  return (
    <>
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Box Number
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              showAll
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {showAll ? "Showing all customers" : "Show all customers"}
          </button>
          <select
            value={boxFilter}
            onChange={(e) => {
              setBoxFilter(e.target.value);
              setShowAll(false);
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
          >
            <option value="">Select a box...</option>
            {uniqueBoxes.map((box) => (
              <option key={box} value={box}>
                {box === "(No box)" ? box : `Box ${box}`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="min-w-[480px] w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Building
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Box Number
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredByBox.map((c) => (
              <tr key={c.customerId} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800 font-medium">{c.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{c.building || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.area || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${readingsLinkPath}/${c.customerId}?month=${monthKey}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Record Reading →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredByBox.length === 0 && (
          <p className="text-center text-slate-500 py-12">
            {!showAll && !boxFilter
              ? "Select a box number above to see customers"
              : "No customers in this box"}
          </p>
        )}
      </div>
    </>
  );
}
