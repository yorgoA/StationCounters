export const dynamic = "force-dynamic";

import { unstable_noStore } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCustomerById,
  getBillsByCustomer,
  getAllPayments,
  getBillingHistoryByCustomer,
  getBillingChangeLogsByCustomer,
  getPaymentsByBillIds,
} from "@/lib/google-sheets";
import BillingHistoryWithEdit from "./BillingHistoryWithEdit";
import MonthlyBillingProfilePanel from "./MonthlyBillingProfilePanel";

export default async function ManagerCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  unstable_noStore();
  const { customerId } = await params;
  const [customer, bills, allPayments, billingHistory, billingLogs] = await Promise.all([
    getCustomerById(customerId),
    getBillsByCustomer(customerId),
    getAllPayments(),
    getBillingHistoryByCustomer(customerId),
    getBillingChangeLogsByCustomer(customerId),
  ]);

  if (!customer) notFound();

  const sortedBills = [...bills].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  const payments = allPayments.filter((p) => p.customerId === customerId);
  const billPayments = await getPaymentsByBillIds(sortedBills.map((b) => b.billId));
  const totalBilled = sortedBills.reduce((s, b) => s + b.totalDue, 0);
  const totalReceived = sortedBills.reduce((s, b) => s + b.totalPaid, 0);
  const outstanding = sortedBills.reduce((s, b) => s + b.remainingDue, 0);
  const overpaidCredit = sortedBills.reduce((s, b) => s + Math.max(0, b.totalPaid - b.totalDue), 0);

  return (
    <div>
      <div className="mb-6">
        <Link href="/manager/customers" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Customers
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h1 className="text-xl font-bold text-slate-800">{customer.fullName}</h1>
            <p className="text-slate-600 mt-1">{customer.phone}</p>
            <p className="text-slate-500 text-sm mt-2">
              {customer.area} • {customer.building} • Floor {customer.floor} • Apt {customer.apartmentNumber}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {customer.subscribedAmpere}A • {customer.billingType} • {customer.status} • Discount: {customer.fixedDiscountAmount > 0
                ? `${customer.fixedDiscountAmount.toLocaleString()} LBP`
                : customer.fixedDiscountPercent > 0
                ? `${customer.fixedDiscountPercent}%`
                : "—"}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-1">Customer details</h2>
            <p className="text-xs text-slate-500 mb-4">
              Read-only summary. Open edit mode only when you want to change customer settings.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
              <p className="text-slate-700">Billing type: <span className="font-medium">{customer.billingType}</span></p>
              <p className="text-slate-700">Status: <span className="font-medium">{customer.status}</span></p>
              {customer.billingType === "FIXED_MONTHLY" ? (
                <p className="text-slate-700">Plan: <span className="font-medium">Fixed monthly (ma2touua)</span></p>
              ) : (
                <p className="text-slate-700">Ampere: <span className="font-medium">{customer.subscribedAmpere}A</span></p>
              )}
              <p className="text-slate-700">Fixed monthly: <span className="font-medium">{(customer.fixedMonthlyPrice ?? 0).toLocaleString()}</span></p>
            </div>
            <div className="rounded border border-slate-200 p-4">
              <MonthlyBillingProfilePanel
                customer={customer}
                billingHistory={billingHistory}
                bills={sortedBills}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-semibold text-slate-800 mb-4">Billing History</h2>
            <p className="text-xs text-slate-500 mb-2">
              Use &quot;Edit reading&quot; to correct counter values when an employee made an error.
            </p>
            <BillingHistoryWithEdit bills={sortedBills} payments={billPayments} />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-semibold text-slate-800 mb-4">Reconciliation summary</h2>
            <div className="space-y-1 text-sm">
              <p className="text-slate-700">Lifetime billed: <span className="font-semibold">{totalBilled.toLocaleString()}</span></p>
              <p className="text-slate-700">Lifetime received: <span className="font-semibold">{totalReceived.toLocaleString()}</span></p>
              <p className="text-slate-700">Outstanding: <span className="font-semibold text-amber-700">{outstanding.toLocaleString()}</span></p>
              <p className="text-slate-700">Overpaid credit: <span className="font-semibold text-indigo-700">{overpaidCredit.toLocaleString()}</span></p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-semibold text-slate-800 mb-4">Month profile history</h2>
            <div className="space-y-2 max-h-56 overflow-y-auto text-sm">
              {billingHistory.map((h) => (
                <div key={h.entryId} className="border-b border-slate-100 pb-2">
                  <p className="font-medium text-slate-800">{h.monthKey} • {h.billingType}</p>
                  <p className="text-slate-600">
                    {h.subscribedAmpere}A • Fixed {h.fixedMonthlyPrice.toLocaleString()} • Disc {h.fixedDiscountAmount.toLocaleString()} / {h.fixedDiscountPercent}%
                  </p>
                  <p className="text-xs text-slate-500">{h.reason || "No reason"} • {h.updatedAt}</p>
                </div>
              ))}
              {billingHistory.length === 0 && <p className="text-slate-500">No month overrides yet.</p>}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Audit log</h2>
            <div className="space-y-2 max-h-56 overflow-y-auto text-sm">
              {billingLogs.slice(0, 30).map((l) => (
                <div key={l.logId} className="border-b border-slate-100 pb-2">
                  <p className="font-medium text-slate-800">{l.monthKey} • {l.updatedByRole}</p>
                  <p className="text-slate-600">{l.reason || "No reason"}</p>
                  <p className="text-xs text-slate-500">{l.updatedAt}</p>
                </div>
              ))}
              {billingLogs.length === 0 && <p className="text-slate-500">No audit logs yet.</p>}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Recent Payments</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {payments.slice(0, 5).map((p) => (
                <div key={p.paymentId} className="py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-700">{p.paymentDate}</span> –{" "}
                  <span className="font-medium">{p.amountPaid.toLocaleString()}</span>
                  {p.receiptImageUrl && (
                    <a
                      href={p.receiptImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-primary-600 hover:underline text-xs"
                    >
                      Receipt
                    </a>
                  )}
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-slate-500 py-4">No payments yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
