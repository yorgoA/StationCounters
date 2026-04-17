"use client";

import { useState } from "react";
import type { Bill, Payment } from "@/types";
import EditBillForm from "./EditBillForm";
import { useRouter } from "next/navigation";
import { deleteBillAction } from "@/app/actions/bill";

export default function BillingHistoryWithEdit({
  bills,
  payments,
}: {
  bills: Bill[];
  payments: Payment[];
}) {
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const editingBill = bills.find((b) => b.billId === editingBillId);
  const router = useRouter();
  const [error, setError] = useState<string>("");

  async function handleDeleteBill(billId: string) {
    const ok = window.confirm("Delete this bill? Any linked payments will also be removed.");
    if (!ok) return;

    setError("");
    const result = await deleteBillAction({ billId });
    if (result.error) {
      setError(result.error);
      return;
    }

    setEditingBillId(null);
    router.refresh();
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {bills.map((b) => (
        <div key={b.billId} className="py-2 border-b border-slate-100 text-sm">
          {editingBillId === b.billId && editingBill ? (
            <EditBillForm
              bill={editingBill}
              onCancel={() => setEditingBillId(null)}
            />
          ) : (
            <div className="space-y-2">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-slate-800 font-semibold">{b.monthKey}</p>
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                      b.paymentStatus === "PAID"
                        ? "bg-green-100 text-green-800"
                        : b.paymentStatus === "PARTIAL"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {b.paymentStatus}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                  <p className="break-words">Type: {b.billingTypeSnapshot || "—"}</p>
                  <p className="break-words">Due: {b.totalDue.toLocaleString()}</p>
                  <p className="break-words">Paid: {b.totalPaid.toLocaleString()}</p>
                  <p className="break-words">
                    Carry-in: {b.previousUnpaidBalance.toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Paid {b.totalPaid.toLocaleString()} / {b.totalDue.toLocaleString()}
                </p>
                <p className="text-slate-600 font-medium">
                  {b.remainingDue > 0 ? (
                    <span className="text-amber-600">{b.remainingDue.toLocaleString()} due</span>
                  ) : (
                    <span className="text-green-600">Paid</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedBillId((prev) => (prev === b.billId ? null : b.billId))
                  }
                  className="text-xs text-slate-600 hover:text-slate-800"
                >
                  Payments
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBillId(b.billId)}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Edit reading
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBill(b.billId)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
              {expandedBillId === b.billId && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  {payments.filter((p) => p.billId === b.billId).length === 0 ? (
                    <p className="text-xs text-slate-500">No payments for this bill.</p>
                  ) : (
                    <div className="space-y-1">
                      {payments
                        .filter((p) => p.billId === b.billId)
                        .sort((a, z) => z.paymentDate.localeCompare(a.paymentDate))
                        .map((p) => (
                          <div key={p.paymentId} className="text-xs text-slate-700">
                            {p.paymentDate} • {p.amountPaid.toLocaleString()} • {p.paymentMethod || "—"}
                            {p.receiptImageUrl ? (
                              <a
                                href={p.receiptImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-primary-600 hover:underline"
                              >
                                Receipt
                              </a>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {bills.length === 0 && (
        <p className="text-slate-500 py-4">No bills yet</p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
