"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "@/app/actions/customer";
import type { AmperePriceTier, Customer, BillingType } from "@/types";

export default function EditCustomerForm({
  customer,
  ampereTiers,
}: {
  customer: Customer;
  ampereTiers: AmperePriceTier[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subscribedAmpere, setSubscribedAmpere] = useState(customer.subscribedAmpere);
  const [billingType, setBillingType] = useState<BillingType>(customer.billingType);
  const [fixedDiscountAmount, setFixedDiscountAmount] = useState(
    String(customer.fixedDiscountAmount)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updateCustomerAction({
      ...customer,
      subscribedAmpere,
      billingType,
      fixedDiscountAmount: parseFloat(fixedDiscountAmount) || 0,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Subscribed Ampere</label>
        <select
          value={subscribedAmpere}
          onChange={(e) => setSubscribedAmpere(Number(e.target.value))}
          className="input"
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
        <select
          value={billingType}
          onChange={(e) => setBillingType(e.target.value as BillingType)}
          className="input"
        >
          <option value="FREE">Free (no charge)</option>
          <option value="AMPERE_ONLY">Ampere Only</option>
          <option value="KWH_ONLY">kWh Only</option>
          <option value="BOTH">Both</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Fixed Discount (LBP)</label>
        <input
          type="number"
          step="0.01"
          value={fixedDiscountAmount}
          onChange={(e) => setFixedDiscountAmount(e.target.value)}
          placeholder="e.g. 5000"
          className="input"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
