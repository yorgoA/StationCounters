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
  const isFree = customer.billingType === "FREE";
  const [freeChecked, setFreeChecked] = useState(isFree);
  const [freeReason, setFreeReason] = useState(customer.freeReason ?? "");
  const [billingType, setBillingType] = useState<BillingType>(
    ["FREE", "AMPERE_ONLY", "KWH_ONLY", "BOTH"].includes(customer.billingType)
      ? isFree ? "BOTH" : customer.billingType
      : "BOTH"
  );
  const [fixedDiscountAmount, setFixedDiscountAmount] = useState(
    String(customer.fixedDiscountAmount || "")
  );
  const [fixedDiscountPercent, setFixedDiscountPercent] = useState(
    String(customer.fixedDiscountPercent || "")
  );

  const effectiveBillingType = freeChecked ? "FREE" : billingType;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const amt = parseFloat(fixedDiscountAmount) || 0;
    const pct = parseFloat(fixedDiscountPercent) || 0;
    const useAmount = amt > 0;
    const result = await updateCustomerAction({
      ...customer,
      subscribedAmpere,
      billingType: effectiveBillingType,
      fixedDiscountAmount: useAmount ? amt : 0,
      fixedDiscountPercent: useAmount ? 0 : pct,
      freeReason: freeChecked ? freeReason : "",
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={freeChecked}
            onChange={(e) => setFreeChecked(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">Free customer (no charge)</span>
        </label>
        {freeChecked && (
          <div className="mt-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <input
              type="text"
              value={freeReason}
              onChange={(e) => setFreeReason(e.target.value)}
              placeholder="e.g. Family, Employee"
              className="input"
            />
          </div>
        )}
      </div>
      {!freeChecked && (
        <>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Type</label>
          <select
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as BillingType)}
            className="input"
          >
            <option value="AMPERE_ONLY">Ampere Only</option>
            <option value="KWH_ONLY">kWh Only</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fixed Discount (LBP)
          </label>
          <input
            type="number"
            step="0.01"
            value={fixedDiscountAmount}
            onChange={(e) => {
              setFixedDiscountAmount(e.target.value);
              if (e.target.value && parseFloat(e.target.value) > 0) setFixedDiscountPercent("");
            }}
            placeholder="e.g. 5000"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fixed Discount (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={fixedDiscountPercent}
            onChange={(e) => {
              setFixedDiscountPercent(e.target.value);
              if (e.target.value && parseFloat(e.target.value) > 0) setFixedDiscountAmount("");
            }}
            placeholder="e.g. 10"
            className="input"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">Use one or the other (amount or percentage), not both.</p>
        </>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
