"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBillReadingsAction } from "@/app/actions/bill";
import type { Bill } from "@/types";

export default function EditBillForm({
  bill,
  onCancel,
}: {
  bill: Bill;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previousCounter, setPreviousCounter] = useState(String(bill.previousCounter));
  const [currentCounter, setCurrentCounter] = useState(String(bill.currentCounter));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updateBillReadingsAction({
      billId: bill.billId,
      previousCounter: parseFloat(previousCounter) || 0,
      currentCounter: parseFloat(currentCounter) || 0,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onCancel();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
      <p className="text-sm text-slate-600 font-medium">{bill.monthKey} – Correct reading</p>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Previous counter</label>
          <input
            type="number"
            step="0.01"
            value={previousCounter}
            onChange={(e) => setPreviousCounter(e.target.value)}
            className="input w-28"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Current counter</label>
          <input
            type="number"
            step="0.01"
            value={currentCounter}
            onChange={(e) => setCurrentCounter(e.target.value)}
            className="input w-28"
          />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm py-1.5 px-3">
          {loading ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-600 hover:text-slate-800">
          Cancel
        </button>
      </div>
    </form>
  );
}
