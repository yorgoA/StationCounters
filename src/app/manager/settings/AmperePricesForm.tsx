"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAmperePricesAction } from "@/app/actions/settings";
import type { AmperePriceTier } from "@/types";

export default function AmperePricesForm({ initialTiers }: { initialTiers: AmperePriceTier[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tiers, setTiers] = useState<AmperePriceTier[]>(
    initialTiers.length > 0 ? initialTiers : [{ amp: 3, price: 231000 }]
  );

  function addRow() {
    setTiers([...tiers, { amp: 0, price: 0 }]);
  }

  function removeRow(i: number) {
    setTiers(tiers.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: "amp" | "price", value: number) {
    const next = [...tiers];
    next[i] = { ...next[i], [field]: value };
    setTiers(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const valid = tiers
      .map((t) => ({ amp: Math.round(t.amp), price: Math.round(t.price) }))
      .filter((t) => t.amp > 0 && t.price >= 0)
      .sort((a, b) => a.amp - b.amp);
    if (valid.length === 0) {
      setError("Add at least one tier with amp > 0 and price ≥ 0.");
      setLoading(false);
      return;
    }
    const result = await updateAmperePricesAction(valid);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Amp (A)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Price (LBP)</th>
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tiers.map((t, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={t.amp || ""}
                    onChange={(e) => updateRow(i, "amp", Number(e.target.value) || 0)}
                    className="input w-20"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={t.price || ""}
                    onChange={(e) => updateRow(i, "price", Number(e.target.value) || 0)}
                    className="input w-32"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-slate-400 hover:text-red-600 text-sm"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
        >
          + Add tier
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save Ampere Prices"}
      </button>
    </form>
  );
}
