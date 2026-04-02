"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertFixedMonthlyBillForMonthAction } from "@/app/actions/bill";

function defaultMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FixedMonthlyMonthForm({
  customerId,
}: {
  customerId: string;
}) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(defaultMonthKey());
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await upsertFixedMonthlyBillForMonthAction({
      customerId,
      monthKey,
      amount: parseFloat(amount) || 0,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-slate-500">
        Set a custom fixed monthly bill for one month only. It updates that month without changing
        other months.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount (LBP)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            required
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Saving..." : "Save for Month"}
      </button>
    </form>
  );
}

