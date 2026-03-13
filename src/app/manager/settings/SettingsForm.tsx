"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettingsAction } from "@/app/actions/settings";
import type { Settings } from "@/types";

export default function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [kwhPrice, setKwhPrice] = useState(String(initialSettings.kwhPrice));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updateSettingsAction({
      kwhPrice: parseFloat(kwhPrice) || 0,
      currency: "LBP",
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Price per kWh</label>
        <input
          type="number"
          step="0.01"
          value={kwhPrice}
          onChange={(e) => setKwhPrice(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
        <p className="py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700">LBP (Lebanese Pounds)</p>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
