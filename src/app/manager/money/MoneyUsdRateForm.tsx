"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettingsAction } from "@/app/actions/settings";

export default function MoneyUsdRateForm({ initialUsdRate }: { initialUsdRate: number }) {
  const router = useRouter();
  const [usdRate, setUsdRate] = useState(String(initialUsdRate || 89700));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const parsed = parseFloat(usdRate) || 0;
    const result = await updateSettingsAction({ usdRate: parsed > 0 ? parsed : 89700 });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">USD rate (LBP)</label>
        <input
          type="number"
          step="0.01"
          value={usdRate}
          onChange={(e) => setUsdRate(e.target.value)}
          className="input w-40"
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save USD rate"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

