"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "@/app/actions/customer";
import type { AmperePriceTier, Customer, BillingType } from "@/types";

export default function EditCustomerForm({
  customer,
  ampereTiers,
  allCustomers,
}: {
  customer: Customer;
  ampereTiers: AmperePriceTier[];
  allCustomers: Customer[];
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
  const [activeChecked, setActiveChecked] = useState(customer.status === "ACTIVE");
  const [monitorChecked, setMonitorChecked] = useState(customer.isMonitor ?? false);
  const [linkedCustomerId, setLinkedCustomerId] = useState(customer.linkedCustomerId ?? "");

  const effectiveBillingType = freeChecked ? "FREE" : billingType;
  const showMonitorOption = effectiveBillingType === "KWH_ONLY" || effectiveBillingType === "BOTH";

  const linkableCustomers = allCustomers.filter(
    (c) => c.customerId !== customer.customerId && (c.billingType === "AMPERE_ONLY" || c.billingType === "BOTH")
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (showMonitorOption && monitorChecked && !linkedCustomerId.trim()) {
      setError("Monitor requires a linked customer. Select one from the dropdown.");
      return;
    }
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
      status: activeChecked ? "ACTIVE" : "INACTIVE",
      isMonitor: showMonitorOption && monitorChecked,
      linkedCustomerId: showMonitorOption && monitorChecked ? linkedCustomerId.trim() || undefined : undefined,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      alert(result.error);
      return;
    }
    window.location.reload();
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
            checked={activeChecked}
            onChange={(e) => setActiveChecked(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">Active customer</span>
        </label>
        <p className="text-xs text-slate-500 mt-0.5">Inactive customers are excluded from Record Reading and Missing readings. Past bills remain.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Customer type</label>
        <select
          value={freeChecked ? "FREE" : "PAYING"}
          onChange={(e) => {
            const isFree = e.target.value === "FREE";
            setFreeChecked(isFree);
            if (!isFree) setBillingType(billingType || "BOTH");
          }}
          className="input"
        >
          <option value="FREE">Free (no charge)</option>
          <option value="PAYING">Paying</option>
        </select>
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
            onChange={(e) => {
              setBillingType(e.target.value as BillingType);
              const val = e.target.value as BillingType;
              if (val !== "KWH_ONLY" && val !== "BOTH") {
                setMonitorChecked(false);
                setLinkedCustomerId("");
              }
            }}
            className="input"
          >
            <option value="AMPERE_ONLY">Ampere Only</option>
            <option value="KWH_ONLY">kWh Only</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        {showMonitorOption && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={monitorChecked}
                onChange={(e) => {
                  setMonitorChecked(e.target.checked);
                  if (!e.target.checked) setLinkedCustomerId("");
                }}
                className="rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Monitor (track usage, excluded from collection)</span>
            </label>
            {monitorChecked && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked customer (required) *</label>
                <select
                  value={linkedCustomerId}
                  onChange={(e) => setLinkedCustomerId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">— Select customer —</option>
                  {linkableCustomers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName} • {c.area} {c.building}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Ampere customer whose line/meter this monitor uses.</p>
              </div>
            )}
          </div>
        )}
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
