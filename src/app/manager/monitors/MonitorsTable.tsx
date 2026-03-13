"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
  links: LinkedRef[];
  monitorKwh: number;
  linkedKwh: number;
  linkedAmp: number;
};

export default function MonitorsTable({ rows }: { rows: MonitorRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const lower = q.toLowerCase();
    return rows.filter((r) => {
      const linkNames = r.links.map((l) => l.fullName).join(" ");
      const linkAreas = r.links.map((l) => l.area).join(" ");
      const linkBuildings = r.links.map((l) => l.building).join(" ");
      return (
        r.fullName.toLowerCase().includes(lower) ||
        linkNames.toLowerCase().includes(lower) ||
        (r.area && r.area.toLowerCase().includes(lower)) ||
        (r.building && r.building.toLowerCase().includes(lower)) ||
        linkAreas.toLowerCase().includes(lower) ||
        linkBuildings.toLowerCase().includes(lower)
      );
    });
  }, [rows, q]);

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by monitor name, linked customer, area, building..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {q && (
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
            {q ? "No monitors match your search." : "No monitors."}
          </div>
        )}
      </div>
    </>
  );
}
