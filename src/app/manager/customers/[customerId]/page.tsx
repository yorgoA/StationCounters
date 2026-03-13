export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerById, getBillsByCustomer, getAllPayments, getAmperePrices } from "@/lib/google-sheets";
import EditCustomerForm from "./EditCustomerForm";
import BillingHistoryWithEdit from "./BillingHistoryWithEdit";

export default async function ManagerCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const [customer, bills, allPayments, ampereTiers] = await Promise.all([
    getCustomerById(customerId),
    getBillsByCustomer(customerId),
    getAllPayments(),
    getAmperePrices(),
  ]);

  if (!customer) notFound();

  const payments = allPayments.filter((p) => p.customerId === customerId);

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
              {customer.subscribedAmpere}A • {customer.billingType} • Discount: {customer.fixedDiscountAmount > 0
                ? `${customer.fixedDiscountAmount.toLocaleString()} LBP`
                : customer.fixedDiscountPercent > 0
                ? `${customer.fixedDiscountPercent}%`
                : "—"}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-1">Edit Customer (Manager)</h2>
            <p className="text-xs text-slate-500 mb-4">Set billing type (Free, Ampere, kWh), subscribed Ampere, discount.</p>
            <EditCustomerForm customer={customer} ampereTiers={ampereTiers} />
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="font-semibold text-slate-800 mb-4">Billing History</h2>
            <p className="text-xs text-slate-500 mb-2">
              Use &quot;Edit reading&quot; to correct counter values when an employee made an error.
            </p>
            <BillingHistoryWithEdit bills={bills} />
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
