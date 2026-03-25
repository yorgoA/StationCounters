"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Bill, Customer } from "@/types";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function CustomerSearchWithPaidFilter({
  initialCustomers,
  bills,
  customerLinkPath = "/manager/customers",
}: {
  initialCustomers: Customer[];
  bills: Bill[];
  customerLinkPath?: string;
}) {
  const months = Array.from(new Set(bills.map((b) => b.monthKey))).sort().reverse();
  const defaultMonthKey =
    months.includes(getCurrentMonthKey()) ? getCurrentMonthKey() : months[0] ?? getCurrentMonthKey();

  const [q, setQ] = useState("");
  const [paidOnly, setPaidOnly] = useState(false);
  const [monthKey, setMonthKey] = useState(defaultMonthKey);
  const [boxFilter, setBoxFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");

  const billByCustomerAndMonth = useMemo(() => {
    const map = new Map<string, Bill>();
    for (const b of bills) {
      map.set(`${b.customerId}|${b.monthKey}`, b);
    }
    return map;
  }, [bills]);

  const uniqueBoxes = useMemo(() => {
    const set = new Set(initialCustomers.map((c) => c.area).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [initialCustomers]);

  const uniqueBuildings = useMemo(() => {
    const set = new Set(initialCustomers.map((c) => c.building).filter(Boolean));
    return Array.from(set).sort();
  }, [initialCustomers]);

  const isPaidForSelectedMonth = (c: Customer) => {
    if (c.billingType === "FREE") return false;
    if (c.isMonitor) return false;
    const bill = billByCustomerAndMonth.get(`${c.customerId}|${monthKey}`);
    return bill?.paymentStatus === "PAID";
  };

  const filtered = useMemo(() => {
    let list = initialCustomers;

    if (paidOnly) {
      list = list.filter((c) => isPaidForSelectedMonth(c));
    }
    if (boxFilter) list = list.filter((c) => c.area === boxFilter);
    if (buildingFilter) list = list.filter((c) => c.building === buildingFilter);
    if (!q.trim()) return list;

    const lower = q.toLowerCase();
    return list.filter((c) => {
      return (
        c.fullName.toLowerCase().includes(lower) ||
        (c.phone && c.phone.includes(q)) ||
        (c.area && c.area.toLowerCase().includes(lower)) ||
        (c.building && c.building.toLowerCase().includes(lower))
      );
    });
  }, [initialCustomers, paidOnly, monthKey, q, boxFilter, buildingFilter, billByCustomerAndMonth]);

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

        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={paidOnly}
              onChange={(e) => setPaidOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            Paid only
          </label>
          <select
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            disabled={!paidOnly}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          >
            {months.length === 0 ? (
              <option value={getCurrentMonthKey()}>{getCurrentMonthKey()}</option>
            ) : (
              months.map((m) => <option key={m} value={m}>{m}</option>)
            )}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto mt-4">
        <table className="min-w-[640px] w-full divide-y divide-slate-200">
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
                  <div className="flex flex-wrap gap-1">
                    {c.billingType === "FREE" && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-sky-100 text-sky-800">
                        Free
                      </span>
                    )}
                    {c.isMonitor && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800">
                        Monitor
                      </span>
                    )}
                    {c.billingType !== "FREE" && !c.isMonitor && <span className="text-slate-500 text-xs">—</span>}
                  </div>
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
            {q.trim() || boxFilter || buildingFilter || paidOnly ? "No customers match your filters" : "No customers yet"}
          </p>
        )}
      </div>
    </>
  );
}

