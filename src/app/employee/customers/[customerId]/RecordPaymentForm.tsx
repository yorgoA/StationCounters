"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPaymentAction } from "@/app/actions/payment";
import type { Bill } from "@/types";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function RecordPaymentForm({
  customerId,
  bills,
}: {
  customerId: string;
  bills: Bill[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/receipt/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.url) setReceiptUrl(data.url);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const billId = data.get("billId") as string;
    if (!billId) {
      setError("Please select a bill");
      setLoading(false);
      return;
    }

    if (!receiptUrl) {
      setError("Receipt is required. Please upload a photo.");
      setLoading(false);
      return;
    }

    const result = await createPaymentAction({
      billId,
      customerId,
      paymentDate: (data.get("paymentDate") as string) || formatDate(new Date()),
      amountPaid: Number(data.get("amountPaid")) || 0,
      receiptImageUrl: receiptUrl,
      paymentMethod: (data.get("paymentMethod") as string) || "CASH",
      note: (data.get("note") as string) || "",
      enteredByRole: "employee",
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReceiptUrl("");
    form.reset();
    router.refresh();
  }

  if (bills.length === 0) {
    return <p className="text-slate-500 text-sm">No unpaid bills. Create a reading first.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Bill (Month)</label>
        <select name="billId" required className="input">
          {bills.map((b) => (
            <option key={b.billId} value={b.billId}>
              {b.monthKey} – Due: {b.remainingDue.toLocaleString()}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
        <input
          name="paymentDate"
          type="date"
          defaultValue={formatDate(new Date())}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Amount Paid *</label>
        <input name="amountPaid" type="number" step="0.01" required className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
        <select name="paymentMethod" className="input" required>
          <option value="CASH">Cash</option>
          <option value="WISH">Wish</option>
          <option value="CARD">Card</option>
          <option value="TRANSFER">Transfer</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Receipt *</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleReceiptUpload}
          className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
        />
        {receiptUrl && <p className="text-xs text-green-600 mt-1">✓ Receipt uploaded</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
        <input name="note" className="input" placeholder="Optional" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading || !receiptUrl} className="btn-primary">
        {loading ? "Recording..." : "Record Payment"}
      </button>
    </form>
  );
}
