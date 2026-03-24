"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction } from "@/app/actions/payment";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setReceiptError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (!file) {
      setReceiptFile(null);
      return;
    }
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearReceipt() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setReceiptFile(null);
    setReceiptError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resolveReceiptFile(form: HTMLFormElement): File | null {
    const fd = new FormData(form);
    const fromForm = fd.get("receipt");
    if (fromForm instanceof File && fromForm.size > 0) return fromForm;
    if (receiptFile && receiptFile.size > 0) return receiptFile;
    const fromRef = fileInputRef.current?.files?.[0];
    if (fromRef && fromRef.size > 0) return fromRef;
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const receipt = resolveReceiptFile(form);
    if (!receipt) {
      setError("Receipt is required. Choose a photo.");
      return;
    }
    const data = new FormData(form);
    data.set("receipt", receipt);

    setLoading(true);
    try {
      const result = await recordPaymentAction(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      clearReceipt();
      form.reset();
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Something went wrong. Your payment was not saved. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (bills.length === 0) {
    return <p className="text-slate-500 text-sm">No unpaid bills. Create a reading first.</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-busy={loading}
    >
      <input type="hidden" name="customerId" value={customerId} />
      {loading && (
        <div
          className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"
            aria-hidden
          />
          <span>Uploading receipt and saving payment… This may take a few seconds.</span>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Bill (Month)</label>
        <select name="billId" required disabled={loading} className="input disabled:opacity-60">
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
          disabled={loading}
          className="input disabled:opacity-60"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Amount Paid *</label>
        <input
          name="amountPaid"
          type="number"
          step="0.01"
          required
          disabled={loading}
          className="input disabled:opacity-60"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
        <select name="paymentMethod" className="input disabled:opacity-60" required disabled={loading}>
          <option value="CASH">Cash</option>
          <option value="WISH">Wish</option>
          <option value="CARD">Card</option>
          <option value="TRANSFER">Transfer</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="payment-receipt"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Receipt *
        </label>
        <input
          id="payment-receipt"
          ref={fileInputRef}
          name="receipt"
          type="file"
          accept="image/*"
          onChange={handleReceiptChange}
          disabled={loading}
          className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-60"
        />
        {receiptFile && !receiptError && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-600">Ready to upload when you record payment.</p>
            <button
              type="button"
              onClick={clearReceipt}
              disabled={loading}
              className="text-xs text-red-600 underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Receipt preview"
            className="mt-2 max-h-40 rounded-lg border border-slate-200 object-contain"
          />
        )}
        {receiptError && <p className="text-xs text-red-600 mt-1">{receiptError}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
        <input name="note" className="input disabled:opacity-60" placeholder="Optional" disabled={loading} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-70"
      >
        {loading && (
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
            aria-hidden
          />
        )}
        {loading ? "Working…" : "Record Payment"}
      </button>
    </form>
  );
}
