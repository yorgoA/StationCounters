"use client";

import { useEffect, useState } from "react";
import { upsertCustomerBillingProfileForMonthAction } from "@/app/actions/bill";
import type { Bill, BillingType, Customer, CustomerBillingHistory } from "@/types";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyBillingProfileForm({
  customer,
  billingHistory,
  bills,
}: {
  customer: Customer;
  billingHistory: CustomerBillingHistory[];
  bills: Bill[];
}) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [billingType, setBillingType] = useState<BillingType>("BOTH");
  const [subscribedAmpere, setSubscribedAmpere] = useState(0);
  const [fixedMonthlyPrice, setFixedMonthlyPrice] = useState(0);
  const [fixedDiscountAmount, setFixedDiscountAmount] = useState(0);
  const [fixedDiscountPercent, setFixedDiscountPercent] = useState(0);
  const [isMonitor, setIsMonitor] = useState(false);
  const [previousCounter, setPreviousCounter] = useState(0);
  const [currentCounter, setCurrentCounter] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function applyForMonth(nextMonthKey: string) {
    const existing = billingHistory.find((h) => h.monthKey === nextMonthKey);
    const monthBill = bills.find((b) => b.monthKey === nextMonthKey);
    if (existing) {
      setBillingType(existing.billingType);
      setSubscribedAmpere(existing.subscribedAmpere ?? 0);
      setFixedMonthlyPrice(existing.fixedMonthlyPrice ?? 0);
      setFixedDiscountAmount(existing.fixedDiscountAmount ?? 0);
      setFixedDiscountPercent(existing.fixedDiscountPercent ?? 0);
      setIsMonitor(existing.isMonitor === true);
      setPreviousCounter(monthBill?.previousCounter ?? 0);
      setCurrentCounter(monthBill?.currentCounter ?? 0);
      return;
    }
    // No record for that month: start with zeros to avoid accidental carry-over edits.
    setBillingType("BOTH");
    setSubscribedAmpere(0);
    setFixedMonthlyPrice(0);
    setFixedDiscountAmount(0);
    setFixedDiscountPercent(0);
    setIsMonitor(false);
    setPreviousCounter(monthBill?.previousCounter ?? 0);
    setCurrentCounter(monthBill?.currentCounter ?? 0);
  }

  // Initialize once with current selected month.
  useEffect(() => {
    applyForMonth(monthKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await upsertCustomerBillingProfileForMonthAction({
      customerId: customer.customerId,
      monthKey,
      billingType,
      subscribedAmpere,
      fixedMonthlyPrice,
      fixedDiscountAmount,
      fixedDiscountPercent,
      isMonitor,
      previousCounter,
      currentCounter,
      reason,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => {
              const next = e.target.value;
              setMonthKey(next);
              applyForMonth(next);
            }}
            required
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Type</label>
          <select
            value={billingType}
            onChange={(e) => {
              const nextType = e.target.value as BillingType;
              setBillingType(nextType);
              if (nextType === "FIXED_MONTHLY") {
                setSubscribedAmpere(0);
                setFixedDiscountAmount(0);
                setFixedDiscountPercent(0);
              }
            }}
            className="input"
          >
            <option value="FREE">Free</option>
            <option value="AMPERE_ONLY">Ampere Only</option>
            <option value="KWH_ONLY">kWh Only</option>
            <option value="BOTH">Both</option>
            <option value="FIXED_MONTHLY">Fixed Monthly</option>
          </select>
        </div>
        {billingType !== "FIXED_MONTHLY" &&
          billingType !== "KWH_ONLY" &&
          billingType !== "FREE" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subscribed Ampere
            </label>
            <input
              type="number"
              value={subscribedAmpere}
              onChange={(e) => setSubscribedAmpere(Number(e.target.value) || 0)}
              className="input"
            />
          </div>
        )}
      </div>
      {billingType === "FIXED_MONTHLY" ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fixed Monthly Price
          </label>
          <input
            type="number"
            step="0.01"
            value={fixedMonthlyPrice}
            onChange={(e) => setFixedMonthlyPrice(Number(e.target.value) || 0)}
            className="input"
          />
        </div>
      ) : billingType === "FREE" ? (
        <p className="text-xs text-slate-500">
          This month will be billed as free (total due = 0). Add a reason below.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount</label>
            <input
              type="number"
              step="0.01"
              value={fixedDiscountAmount}
              onChange={(e) => setFixedDiscountAmount(Number(e.target.value) || 0)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Discount Percent
            </label>
            <input
              type="number"
              step="0.01"
              value={fixedDiscountPercent}
              onChange={(e) => setFixedDiscountPercent(Number(e.target.value) || 0)}
              className="input"
            />
          </div>
        </div>
      )}
      {(billingType === "KWH_ONLY" || billingType === "BOTH") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Previous counter
            </label>
            <input
              type="number"
              step="0.01"
              value={previousCounter}
              onChange={(e) => setPreviousCounter(Number(e.target.value) || 0)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current counter
            </label>
            <input
              type="number"
              step="0.01"
              value={currentCounter}
              onChange={(e) => setCurrentCounter(Number(e.target.value) || 0)}
              className="input"
              required
            />
          </div>
        </div>
      )}
      {billingType === "KWH_ONLY" && (
        <p className="text-xs text-slate-500">
          Subscribed ampere is not used for kWh-only monthly profile.
        </p>
      )}
      {billingType === "BOTH" && (
        <p className="text-xs text-slate-500">
          BOTH needs counters for kWh part; ampere is added from subscribed tier.
        </p>
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isMonitor}
          onChange={(e) => setIsMonitor(e.target.checked)}
          className="rounded border-slate-300"
        />
        <span className="text-sm text-slate-700">Monitor in this month</span>
      </label>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this month profile changed"
          className="input"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save month profile"}
      </button>
    </form>
  );
}

