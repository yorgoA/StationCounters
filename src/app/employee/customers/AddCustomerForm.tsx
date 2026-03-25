"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomerAction } from "@/app/actions/customer";
import { MONITOR_CATEGORIES } from "@/types";
import type { AmperePriceTier, BillingType, Customer } from "@/types";

function getDiscountValues(
  amount: number,
  percent: number
): { fixedDiscountAmount: number; fixedDiscountPercent: number } {
  if (amount > 0) return { fixedDiscountAmount: amount, fixedDiscountPercent: 0 };
  if (percent > 0) return { fixedDiscountAmount: 0, fixedDiscountPercent: percent };
  return { fixedDiscountAmount: 0, fixedDiscountPercent: 0 };
}

export default function AddCustomerForm({
  basePath = "/employee/customers",
  ampereTiers,
  allCustomers = [],
}: {
  basePath?: string;
  ampereTiers: AmperePriceTier[];
  allCustomers?: Customer[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("BOTH");
  const [monitorChecked, setMonitorChecked] = useState(false);
  const [linkedCustomerIds, setLinkedCustomerIds] = useState<string[]>([]);
  const [monitorCategory, setMonitorCategory] = useState("");

  const linkableCustomers = allCustomers.filter((c) => !c.isMonitor);

  const showSubscribedAmpere = !monitorChecked && billingType !== "FIXED_MONTHLY";
  const showFixedDiscountFields = !monitorChecked && billingType !== "FIXED_MONTHLY";
  const showFixedMonthlyPrice = billingType === "FIXED_MONTHLY" && !monitorChecked;

  function toggleLinked(id: string) {
    setLinkedCustomerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    const discountAmt = Number(data.get("fixedDiscountAmount")) || 0;
    const discountPct = Number(data.get("fixedDiscountPercent")) || 0;
    const discount = getDiscountValues(discountAmt, discountPct);

    const result = await createCustomerAction({
      fullName: data.get("fullName") as string,
      phone: data.get("phone") as string,
      area: data.get("boxNumber") as string,
      building: data.get("building") as string,
      floor: data.get("floor") as string,
      apartmentNumber: data.get("apartmentNumber") as string,
      subscribedAmpere: Number(data.get("subscribedAmpere")) || 0,
      billingType: (data.get("billingType") as BillingType) || "BOTH",
      fixedMonthlyPrice: Number(data.get("fixedMonthlyPrice")) || 0,
      ...discount,
      status: "ACTIVE",
      notes: (data.get("notes") as string) || "",
      isMonitor: monitorChecked,
      linkedCustomerIds: monitorChecked ? linkedCustomerIds : undefined,
      monitorCategory: monitorChecked ? (monitorCategory.trim() || undefined) : undefined,
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
        {showSubscribedAmpere && (
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
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Type</label>
          <select
            name="billingType"
            className="input"
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as BillingType)}
          >
            <option value="FREE">Free (no charge)</option>
            <option value="AMPERE_ONLY">Ampere Only</option>
            <option value="KWH_ONLY">kWh Only</option>
            <option value="BOTH">Both</option>
            <option value="FIXED_MONTHLY">Fixed monthly (ma2touua)</option>
          </select>
        </div>
        {showFixedMonthlyPrice && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Fixed monthly price (LBP / month)
            </label>
            <input name="fixedMonthlyPrice" type="number" step="0.01" required className="input" defaultValue={0} />
          </div>
        )}

        <div className="md:col-span-2 border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
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
            <span className="text-sm font-medium text-slate-700">
              Monitor (track usage, excluded from collection)
            </span>
          </label>

          {monitorChecked && (
            <>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Linked customers (required, can select multiple) *
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                  {linkableCustomers.map((c) => (
                    <label
                      key={c.customerId}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                    >
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
                  {linkableCustomers.length === 0 && (
                    <p className="text-sm text-slate-500">No linkable customers found.</p>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Customers whose meters this monitor tracks. At least one required.
                </p>
              </div>
            </>
          )}
        </div>
        {showFixedDiscountFields && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fixed Discount (LBP)
              </label>
              <input
                name="fixedDiscountAmount"
                type="number"
                step="0.01"
                defaultValue={0}
                placeholder="e.g. 5000"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fixed Discount (%)
              </label>
              <input
                name="fixedDiscountPercent"
                type="number"
                step="0.01"
                min={0}
                max={100}
                defaultValue={0}
                placeholder="e.g. 10"
                className="input"
              />
            </div>
          </>
        )}
        <div className="md:col-span-2">
          <p className="text-xs text-slate-500">Use fixed amount (LBP) or percentage, not both.</p>
          {billingType === "FIXED_MONTHLY" && !monitorChecked && (
            <p className="text-xs text-amber-600 mt-1">Discounts are ignored for fixed monthly customers.</p>
          )}
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
