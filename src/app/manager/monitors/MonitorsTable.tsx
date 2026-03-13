"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MONITOR_CATEGORIES } from "@/types";

type LinkedRef = {
  customerId: string;
  fullName: string;
  area: string;
  building: string;
  kwh: number;
  amp: number;
};

type MonitorRow = {
  customerId: string;
  fullName: string;
  area: string;
  building: string;
  monitorCategory: string;
  links: LinkedRef[];
  monitorKwh: number;
  linkedKwh: number;
  linkedAmp: number;
};

export default function MonitorsTable({ rows }: { rows: MonitorRow[] }) {
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const filtered = useMemo(() => {
    let list = rows;
    if (categoryFilter) {
      list = list.filter((r) => r.monitorCategory === categoryFilter);
    }
    if (!q.trim()) return list;
    const lower = q.toLowerCase();
    return rows.filter((r) => {
      const linkNames = r.links.map((l) => l.fullName).join(" ");
      const linkAreas = r.links.map((l) => l.area).join(" ");
      const linkBuildings = r.links.map((l) => l.building).join(" ");
      return (
        r.fullName.toLowerCase().includes(lower) ||
        (r.monitorCategory && r.monitorCategory.toLowerCase().includes(lower)) ||
        linkNames.toLowerCase().includes(lower) ||
        (r.area && r.area.toLowerCase().includes(lower)) ||
        (r.building && r.building.toLowerCase().includes(lower)) ||
        linkAreas.toLowerCase().includes(lower) ||
        linkBuildings.toLowerCase().includes(lower)
      );
    });
  }, [rows, q, categoryFilter]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All categories</option>
          {MONITOR_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search by monitor name, linked customer, area, building..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-64 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {(q || categoryFilter) && (
          <p className="text-xs text-slate-500 mt-1">
            {filtered.length} of {rows.length} monitors
          </p>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Monitor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Linked to
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Monitor kWh
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Linked kWh
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Linked Amp
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Match
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((r) => {
                const match = r.monitorKwh === r.linkedKwh;
                return (
                  <tr key={r.customerId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/manager/customers/${r.customerId}`}
                        className="text-primary-600 hover:underline font-medium"
                      >
                        {r.fullName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {r.area} {r.building}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {r.monitorCategory ? (
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {r.monitorCategory}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.links.length > 0 ? (
                        <div className="space-y-1">
                          {r.links.map((l) => (
                            <div key={l.customerId}>
                              <Link
                                href={`/manager/customers/${l.customerId}`}
                                className="text-primary-600 hover:underline"
                              >
                                {l.fullName}
                              </Link>
                              <span className="text-slate-500 text-xs ml-1">
                                {l.kwh.toLocaleString()} kWh
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {r.monitorKwh.toLocaleString()} kWh
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {r.linkedKwh.toLocaleString()} kWh
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {r.linkedAmp.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {match ? (
                        <span className="text-green-600 text-sm">✓</span>
                      ) : (
                        <span className="text-amber-600 text-sm">
                          {(r.monitorKwh - r.linkedKwh).toLocaleString()} kWh
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-slate-500">
            {q || categoryFilter ? "No monitors match your filters." : "No monitors."}
          </div>
        )}
      </div>
    </>
  );
}
