"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Bill, Customer } from "@/types";

export default function UnpaidBillsTable({
  unpaidBills,
  customers,
  activeCustomerIds,
}: {
  unpaidBills: Bill[];
  customers: Customer[];
  activeCustomerIds: Set<string>;
}) {
  const [q, setQ] = useState("");

  const filteredBills = useMemo(() => {
    const activeUnpaid = unpaidBills.filter((b) => activeCustomerIds.has(b.customerId));
    if (!q.trim()) return activeUnpaid;
    const lower = q.toLowerCase();
    return activeUnpaid.filter((b) => {
      const cust = customers.find((c) => c.customerId === b.customerId);
      if (!cust) return false;
      return (
        cust.fullName.toLowerCase().includes(lower) ||
        (cust.phone && cust.phone.includes(q)) ||
        (cust.area && cust.area.toLowerCase().includes(lower)) ||
        (cust.building && cust.building.toLowerCase().includes(lower)) ||
        b.monthKey.includes(q)
      );
    });
  }, [unpaidBills, customers, activeCustomerIds, q]);

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name, phone, box, building, month..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Month
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Due
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredBills.map((b) => {
              const cust = customers.find((c) => c.customerId === b.customerId);
              if (!cust) return null;
              return (
                <tr key={b.billId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800 font-medium">{cust.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{b.monthKey}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {b.remainingDue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/employee/payments/${b.customerId}`}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Record Payment →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredBills.length === 0 && (
          <p className="text-center text-slate-500 py-12">
            {unpaidBills.filter((b) => activeCustomerIds.has(b.customerId)).length === 0
              ? "No unpaid bills"
              : "No matching customers"}
          </p>
        )}
      </div>
    </>
  );
}
