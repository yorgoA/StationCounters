"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Customer } from "@/types";

export default function CustomerSearch({
  initialCustomers,
  customerLinkPath = "/employee/customers",
  showFreeFilter = false,
}: {
  initialCustomers: Customer[];
  customerLinkPath?: string;
  showFreeFilter?: boolean;
}) {
  const [q, setQ] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [boxFilter, setBoxFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");

  const uniqueBoxes = useMemo(() => {
    const set = new Set(initialCustomers.map((c) => c.area).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [initialCustomers]);
  const uniqueBuildings = useMemo(() => {
    const set = new Set(initialCustomers.map((c) => c.building).filter(Boolean));
    return Array.from(set).sort();
  }, [initialCustomers]);

  const filtered = useMemo(() => {
    let list = initialCustomers;
    if (freeOnly) list = list.filter((c) => c.billingType === "FREE");
    if (boxFilter) list = list.filter((c) => c.area === boxFilter);
    if (buildingFilter) list = list.filter((c) => c.building === buildingFilter);
    if (!q.trim()) return list;
    const lower = q.toLowerCase();
    return list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(lower) ||
        (c.phone && c.phone.includes(q)) ||
        (c.area && c.area.toLowerCase().includes(lower)) ||
        (c.building && c.building.toLowerCase().includes(lower))
    );
  }, [initialCustomers, q, freeOnly, boxFilter, buildingFilter]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          placeholder="Search by name, phone..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={boxFilter}
          onChange={(e) => setBoxFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All boxes</option>
          {uniqueBoxes.map((box) => (
            <option key={box} value={box}>
              Box {box}
            </option>
          ))}
        </select>
        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All buildings</option>
          {uniqueBuildings.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {showFreeFilter && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(e) => setFreeOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            Free customers only
          </label>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-4">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Box Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Building</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Billing</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((c) => (
              <tr key={c.customerId} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800 font-medium">{c.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                <td className="px-4 py-3 text-slate-600">{c.area}</td>
                <td className="px-4 py-3 text-slate-600">{c.building}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                      c.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.billingType === "FREE" ? (
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-sky-100 text-sky-800">
                      Free
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${customerLinkPath}/${c.customerId}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-slate-500 py-12">
            {q.trim() || boxFilter || buildingFilter || freeOnly
              ? "No customers match your filters"
              : "No customers yet"}
          </p>
        )}
      </div>
    </>
  );
}
