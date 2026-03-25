"use client";

import { useState } from "react";
import type { Bill } from "@/types";
import EditBillForm from "./EditBillForm";
import { useRouter } from "next/navigation";
import { deleteBillAction } from "@/app/actions/bill";

export default function BillingHistoryWithEdit({ bills }: { bills: Bill[] }) {
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
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
            <div className="flex justify-between items-center">
              <span className="text-slate-700">{b.monthKey}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-600">
                  {b.remainingDue > 0 ? (
                    <span className="text-amber-600">{b.remainingDue.toLocaleString()} due</span>
                  ) : (
                    <span className="text-green-600">Paid</span>
                  )}
                </span>
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
