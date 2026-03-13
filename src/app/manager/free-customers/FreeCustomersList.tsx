"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateFreeCustomerAction } from "@/app/actions/customer";
import type { Customer } from "@/types";

export default function FreeCustomersList({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(search)) ||
        (c.area && c.area.toLowerCase().includes(q)) ||
        (c.building && c.building.toLowerCase().includes(q)) ||
        (c.apartmentNumber && c.apartmentNumber.toLowerCase().includes(q))
    );
  }, [customers, search]);

  async function handleUncheck(customerId: string) {
    setUpdating(customerId);
    const result = await updateFreeCustomerAction({
      customerId,
      billingType: "BOTH",
    });
    setUpdating(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReasonSave(customer: Customer, reason: string) {
    setUpdating(customer.customerId);
    const result = await updateFreeCustomerAction({
      customerId: customer.customerId,
      billingType: "FREE",
      freeReason: reason.trim() || undefined,
    });
    setUpdating(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  if (customers.length === 0) {
    return (
      <p className="text-slate-500 py-12 text-center">
        No free customers. Mark customers as Free from their profile (Edit Customer → Billing Type).
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, box, building..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {search && (
          <p className="text-xs text-slate-500 mt-1">
            {filtered.length} of {customers.length} free customers
          </p>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-10">
              Free
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
              Customer
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
              Box • Building
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
              Reason
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {filtered.map((c) => (
            <tr key={c.customerId} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked
                  onChange={() => handleUncheck(c.customerId)}
                  disabled={!!updating}
                  className="rounded border-slate-300"
                />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/manager/free-customers/${c.customerId}`}
                  className="font-medium text-slate-800 hover:text-primary-600"
                >
                  {c.fullName}
                </Link>
                {c.phone && (
                  <p className="text-xs text-slate-500">{c.phone}</p>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600 text-sm">
                {c.area} • {c.building}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Reason (e.g. Family, Employee)"
                    defaultValue={c.freeReason ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (c.freeReason ?? "")) {
                        handleReasonSave(c, v);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/manager/free-customers/${c.customerId}`}
                  className="text-primary-600 hover:text-primary-700 text-sm"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {filtered.length === 0 && search && (
        <p className="text-slate-500 py-8 text-center">
          No free customers match &quot;{search}&quot;
        </p>
      )}
    </div>
  );
}
