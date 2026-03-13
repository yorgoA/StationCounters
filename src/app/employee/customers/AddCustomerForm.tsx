"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomerAction } from "@/app/actions/customer";
import type { AmperePriceTier, BillingType } from "@/types";

export default function AddCustomerForm({
  basePath = "/employee/customers",
  ampereTiers,
}: {
  basePath?: string;
  ampereTiers: AmperePriceTier[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await createCustomerAction({
      fullName: data.get("fullName") as string,
      phone: data.get("phone") as string,
      area: data.get("boxNumber") as string,
      building: data.get("building") as string,
      floor: data.get("floor") as string,
      apartmentNumber: data.get("apartmentNumber") as string,
      subscribedAmpere: Number(data.get("subscribedAmpere")) || 0,
      billingType: (data.get("billingType") as BillingType) || "BOTH",
      fixedDiscountAmount: Number(data.get("fixedDiscountAmount")) || 0,
      status: "ACTIVE",
      notes: (data.get("notes") as string) || "",
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    form.reset();
    router.refresh();
    router.push(`${basePath}/${result.customerId}`);
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Add New Customer</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
          <input name="fullName" required className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
          <input name="phone" required className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Box Number *</label>
          <input name="boxNumber" required className="input" placeholder="e.g. 82" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Building *</label>
          <input name="building" required className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Floor</label>
          <input name="floor" className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Apartment</label>
          <input name="apartmentNumber" className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subscribed Ampere *</label>
          <select
            name="subscribedAmpere"
            required
            className="input"
            defaultValue={ampereTiers.find((t) => t.amp === 10)?.amp ?? ampereTiers[0]?.amp}
          >
            {ampereTiers.map((t) => (
              <option key={t.amp} value={t.amp}>
                {t.amp}A
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Type</label>
          <select name="billingType" className="input" defaultValue="BOTH">
            <option value="AMPERE_ONLY">Ampere Only</option>
            <option value="KWH_ONLY">kWh Only</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fixed Discount (LBP)</label>
          <input name="fixedDiscountAmount" type="number" step="0.01" defaultValue={0} placeholder="e.g. 5000" className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea name="notes" rows={2} className="input" />
        </div>
        {error && <p className="md:col-span-2 text-red-600 text-sm">{error}</p>}
        <div className="md:col-span-2 flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Creating..." : "Add Customer"}
          </button>
          <button
            type="button"
            onClick={() => router.push(basePath)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
