"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMonitorLinksAction } from "@/app/actions/customer";
import { MONITOR_CATEGORIES } from "@/types";
import type { Customer } from "@/types";

export default function MonitorLinksForm({
  monitorCustomerId,
  initialLinkedCustomerIds,
  initialMonitorCategory,
  allCustomers,
}: {
  monitorCustomerId: string;
  initialLinkedCustomerIds: string[];
  initialMonitorCategory: string;
  allCustomers: Customer[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkedCustomerIds, setLinkedCustomerIds] = useState<string[]>(initialLinkedCustomerIds);
  const [monitorCategory, setMonitorCategory] = useState(initialMonitorCategory);

  const linkableCustomers = useMemo(
    () => allCustomers.filter((c) => !c.isMonitor),
    [allCustomers]
  );

  function toggleLinked(id: string) {
    setLinkedCustomerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (linkedCustomerIds.length === 0) {
      setError("Monitor requires at least one linked customer.");
      return;
    }
    setLoading(true);
    const result = await updateMonitorLinksAction({
      customerId: monitorCustomerId,
      linkedCustomerIds,
      monitorCategory: monitorCategory.trim() || undefined,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select value={monitorCategory} onChange={(e) => setMonitorCategory(e.target.value)} className="input">
            <option value="">— Select category —</option>
            {MONITOR_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Linked customers (required, can select multiple) *
          </label>
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
            {linkableCustomers.map((c) => (
              <label
                key={c.customerId}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={linkedCustomerIds.includes(c.customerId)}
                  onChange={() => toggleLinked(c.customerId)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">
                  {c.fullName} • {c.area} {c.building}
                </span>
              </label>
            ))}
            {linkableCustomers.length === 0 && (
              <p className="text-sm text-slate-500">No linkable customers found.</p>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Customers whose meters this monitor tracks.</p>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save monitor links"}
      </button>
    </form>
  );
}

