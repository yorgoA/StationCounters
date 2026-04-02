"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMonthlyTariffAction, updateSettingsAction } from "@/app/actions/settings";
import type { MonthlyTariff, Settings } from "@/types";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function SettingsForm({
  initialSettings,
  monthlyTariffs,
}: {
  initialSettings: Settings;
  monthlyTariffs: MonthlyTariff[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [kwhPrice, setKwhPrice] = useState(String(initialSettings.kwhPrice));
  const [fallbackKwhPrice, setFallbackKwhPrice] = useState(String(initialSettings.kwhPrice));

  const sortedTariffs = [...monthlyTariffs].sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  async function handleMonthlyTariffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updateMonthlyTariffAction({
      monthKey,
      kwhPrice: parseFloat(kwhPrice) || 0,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleFallbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updateSettingsAction({
      kwhPrice: parseFloat(fallbackKwhPrice) || 0,
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
    <div className="space-y-8">
      <form onSubmit={handleMonthlyTariffSubmit} className="space-y-4">
        <h3 className="font-medium text-slate-800">Monthly kWh tariff</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="input"
            />
          </div>
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
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Monthly Tariff"}
        </button>
      </form>

      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Saved monthly tariffs</h4>
        <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-left">kWh Price (LBP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTariffs.length > 0 ? (
                sortedTariffs.map((t) => (
                  <tr key={t.monthKey}>
                    <td className="px-3 py-2">{t.monthKey}</td>
                    <td className="px-3 py-2">{t.kwhPrice.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-2 text-slate-500" colSpan={2}>
                    No monthly tariffs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={handleFallbackSubmit} className="space-y-4">
        <h3 className="font-medium text-slate-800">Fallback (global) kWh price</h3>
        <p className="text-sm text-slate-500">
          Used only if a month has no monthly tariff entry.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fallback Price per kWh</label>
          <input
            type="number"
            step="0.01"
            value={fallbackKwhPrice}
            onChange={(e) => setFallbackKwhPrice(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
          <p className="py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            LBP (Lebanese Pounds)
          </p>
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Fallback Settings"}
        </button>
      </form>
    </div>
  );
}
