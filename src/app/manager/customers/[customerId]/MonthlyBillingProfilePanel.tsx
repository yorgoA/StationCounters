"use client";

import { useState } from "react";
import type { Bill, Customer, CustomerBillingHistory } from "@/types";
import MonthlyBillingProfileForm from "./MonthlyBillingProfileForm";

export default function MonthlyBillingProfilePanel({
  customer,
  billingHistory,
  bills,
}: {
  customer: Customer;
  billingHistory: CustomerBillingHistory[];
  bills: Bill[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-800 mb-1">Monthly billing profile</h3>
          <p className="text-xs text-slate-500">
            Customer base details are read-only. Use edit to apply month-specific changes.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Close edit" : "Edit monthly profile"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Current billing type</p>
          <p className="text-2xl font-bold text-slate-800">{customer.billingType}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Current subscribed ampere</p>
          <p className="text-2xl font-bold text-slate-800">{customer.subscribedAmpere}A</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Current fixed monthly</p>
          <p className="text-2xl font-bold text-slate-800">
            {(customer.fixedMonthlyPrice ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Month profile overrides</p>
          <p className="text-2xl font-bold text-slate-800">{billingHistory.length}</p>
        </div>
      </div>

      {editing && (
        <MonthlyBillingProfileForm
          customer={customer}
          billingHistory={billingHistory}
          bills={bills}
        />
      )}
    </div>
  );
}

