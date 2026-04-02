"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBillAction } from "@/app/actions/bill";
import type { Customer } from "@/types";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function RecordReadingForm({
  customerId,
  customer,
  previousCounter = null,
  initialMonthKey,
}: {
  customerId: string;
  customer: Customer;
  previousCounter?: number | null;
  initialMonthKey?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [monthKey, setMonthKey] = useState(initialMonthKey || getCurrentMonthKey());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await createBillAction({
      customerId,
      monthKey,
      previousCounter: Number(data.get("previousCounter")) || 0,
      currentCounter: Number(data.get("currentCounter")) || 0,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {customer.billingType === "FREE" && (
        <p className="text-sm text-sky-600 bg-sky-50 px-3 py-2 rounded-lg">
          Free customer: bill will be 0 LBP. Counter readings are still recorded.
        </p>
      )}
      {customer.billingType === "AMPERE_ONLY" && (
        <p className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
          Ampere-only customers are not charged for kWh, but we still record counter readings to monitor for anomalies.
        </p>
      )}
      {customer.billingType === "FIXED_MONTHLY" && (
        <p className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
          Fixed monthly customers: bill total is the fixed monthly price (LBP / month). We still record readings
          for monitoring and kWh reference.
        </p>
      )}
      <p className="text-sm text-slate-500">
        Select the month for these readings. You cannot change a reading after submitting—contact the manager for corrections.
      </p>
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Previous Counter {previousCounter != null ? "(from last reading)" : "(new customer—enter first reading)"}
        </label>
        {previousCounter != null ? (
          <input
            name="previousCounter"
            type="number"
            step="0.01"
            readOnly
            value={previousCounter}
            className="input bg-slate-50"
          />
        ) : (
          <input
            name="previousCounter"
            type="number"
            step="0.01"
            required
            className="input"
            placeholder="e.g. 0"
          />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Current Counter</label>
        <input name="currentCounter" type="number" step="0.01" required className="input" placeholder="e.g. 12450" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating..." : "Create Bill"}
      </button>
    </form>
  );
}
