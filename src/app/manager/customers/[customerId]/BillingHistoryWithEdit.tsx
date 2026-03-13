"use client";

import { useState } from "react";
import type { Bill } from "@/types";
import EditBillForm from "./EditBillForm";

export default function BillingHistoryWithEdit({ bills }: { bills: Bill[] }) {
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const editingBill = bills.find((b) => b.billId === editingBillId);

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
              </div>
            </div>
          )}
        </div>
      ))}
      {bills.length === 0 && (
        <p className="text-slate-500 py-4">No bills yet</p>
      )}
    </div>
  );
}
