"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "@/app/actions/customer";
import type { AmperePriceTier, Customer, BillingType } from "@/types";
import { MONITOR_CATEGORIES } from "@/types";

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
  const [fixedMonthlyPrice, setFixedMonthlyPrice] = useState<number>(customer.fixedMonthlyPrice ?? 0);
  const [billingType, setBillingType] = useState<BillingType>(
    ["FREE", "AMPERE_ONLY", "KWH_ONLY", "BOTH", "FIXED_MONTHLY"].includes(customer.billingType)
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
  const initialLinked =
    (customer.linkedCustomerIds && customer.linkedCustomerIds.length > 0)
      ? customer.linkedCustomerIds
      : (customer.linkedCustomerId ? [customer.linkedCustomerId] : []);
  const [linkedCustomerIds, setLinkedCustomerIds] = useState<string[]>(initialLinked);
  const [monitorCategory, setMonitorCategory] = useState(customer.monitorCategory ?? "");

  const effectiveBillingType = freeChecked ? "FREE" : billingType;
  const showMonitorOption =
    effectiveBillingType === "AMPERE_ONLY" ||
    effectiveBillingType === "KWH_ONLY" ||
    effectiveBillingType === "BOTH" ||
    effectiveBillingType === "FIXED_MONTHLY";

  const showSubscribedAmpere = !monitorChecked && billingType !== "FIXED_MONTHLY";
  const showFixedDiscountFields = !monitorChecked && billingType !== "FIXED_MONTHLY";

  const linkableCustomers = allCustomers.filter(
    (c) => c.customerId !== customer.customerId && !c.isMonitor
  );

  function toggleLinked(id: string) {
    setLinkedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (showMonitorOption && monitorChecked && linkedCustomerIds.length === 0) {
      setError("Monitor requires at least one linked customer.");
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
      fixedMonthlyPrice: effectiveBillingType === "FIXED_MONTHLY" ? fixedMonthlyPrice : 0,
      fixedDiscountAmount: useAmount ? amt : 0,
      fixedDiscountPercent: useAmount ? 0 : pct,
      freeReason: freeChecked ? freeReason : "",
      status: activeChecked ? "ACTIVE" : "INACTIVE",
      isMonitor: showMonitorOption && monitorChecked,
      linkedCustomerIds: showMonitorOption && monitorChecked ? linkedCustomerIds : undefined,
      monitorCategory: showMonitorOption && monitorChecked ? (monitorCategory.trim() || undefined) : undefined,
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
      {showSubscribedAmpere && (
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
      )}
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
            onChange={(e) => setBillingType(e.target.value as BillingType)}
            className="input"
          >
            <option value="AMPERE_ONLY">Ampere Only</option>
            <option value="KWH_ONLY">kWh Only</option>
            <option value="BOTH">Both</option>
            <option value="FIXED_MONTHLY">Fixed monthly (ma2touua)</option>
          </select>
        </div>
        {billingType === "FIXED_MONTHLY" && !monitorChecked && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Fixed monthly price (LBP / month)
            </label>
            <input
              type="number"
              step="0.01"
              value={fixedMonthlyPrice}
              onChange={(e) => setFixedMonthlyPrice(Number(e.target.value) || 0)}
              required
              className="input"
            />
          </div>
        )}
        {showMonitorOption && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={monitorChecked}
                onChange={(e) => {
                  setMonitorChecked(e.target.checked);
                  if (!e.target.checked) {
                    setLinkedCustomerIds([]);
                    setMonitorCategory("");
                  }
                }}
                className="rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Monitor (track usage, excluded from collection)</span>
            </label>
            {monitorChecked && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={monitorCategory}
                    onChange={(e) => setMonitorCategory(e.target.value)}
                    className="input"
                  >
                    <option value="">— Select category —</option>
                    {MONITOR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-0.5">Filter monitors by category on the Monitors page.</p>
                </div>
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked customers (required, can select multiple) *</label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                  {linkableCustomers.map((c) => (
                    <label key={c.customerId} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={linkedCustomerIds.includes(c.customerId)}
                        onChange={() => toggleLinked(c.customerId)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm">
                        {c.fullName} • {c.area} {c.building}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Customers whose meters this monitor tracks. At least one required.
                </p>
                </div>
              </div>
            )}
          </div>
        )}
      {showFixedDiscountFields && (
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
                if (e.target.value && parseFloat(e.target.value) > 0)
                  setFixedDiscountPercent("");
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
                if (e.target.value && parseFloat(e.target.value) > 0)
                  setFixedDiscountAmount("");
              }}
              placeholder="e.g. 10"
              className="input"
            />
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500">Use one or the other (amount or percentage), not both.</p>
      {billingType === "FIXED_MONTHLY" && !freeChecked && !monitorChecked && (
        <p className="text-xs text-amber-600">
          Discounts are ignored for fixed monthly customers.
        </p>
      )}
        </>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
