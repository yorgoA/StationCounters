"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerBasicAction } from "@/app/actions/customer";
import type { Customer } from "@/types";

export default function EditCustomerBasicForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(customer.phone);
  const [area, setArea] = useState(customer.area);
  const [building, setBuilding] = useState(customer.building);
  const [status, setStatus] = useState<Customer["status"]>(customer.status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updateCustomerBasicAction({
      customerId: customer.customerId,
      phone,
      area,
      building,
      status,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
        <input
          type="text"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Building</label>
        <input
          type="text"
          value={building}
          onChange={(e) => setBuilding(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Customer["status"])}
          className="input"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
