export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerById, getBillsByCustomer } from "@/lib/google-sheets";
import EditCustomerBasicForm from "./EditCustomerBasicForm";

export default async function EmployeeCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const [customer, bills] = await Promise.all([
    getCustomerById(customerId),
    getBillsByCustomer(customerId),
  ]);

  if (!customer) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link href="/employee/customers" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Customers
        </Link>
      </div>
      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-800">{customer.fullName}</h1>
          <p className="text-slate-600 mt-1">{customer.phone}</p>
          <p className="text-slate-500 text-sm mt-2">
            {customer.area} • {customer.building} • Floor {customer.floor} • Apt {customer.apartmentNumber}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {customer.subscribedAmpere}A • {customer.billingType} • Discount: {customer.fixedDiscountAmount} LBP •{" "}
            <span className={customer.status === "ACTIVE" ? "text-green-600" : "text-slate-500"}>{customer.status}</span>
          </p>
          <details className="mt-4 pt-4 border-t border-slate-100">
            <summary className="text-sm font-medium text-slate-700 cursor-pointer hover:text-primary-600">
              Edit Phone, Area, Building, Status
            </summary>
            <div className="mt-4">
              <EditCustomerBasicForm customer={customer} />
            </div>
          </details>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Recent Bills</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Month</th>
                  <th className="pb-2">Usage</th>
                  <th className="pb-2">Total Due</th>
                  <th className="pb-2">Paid</th>
                  <th className="pb-2">Remaining</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.slice(0, 6).map((b) => (
                  <tr key={b.billId} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{b.monthKey}</td>
                    <td className="py-2 text-slate-600">{b.usageKwh} kWh</td>
                    <td className="py-2 text-slate-600">{b.totalDue.toLocaleString()}</td>
                    <td className="py-2 text-slate-600">{b.totalPaid.toLocaleString()}</td>
                    <td className="py-2 text-slate-600">{b.remainingDue.toLocaleString()}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          b.paymentStatus === "PAID"
                            ? "bg-green-100 text-green-800"
                            : b.paymentStatus === "PARTIAL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bills.length === 0 && <p className="text-slate-500 py-4 text-sm">No bills yet</p>}
        </div>
      </div>
    </div>
  );
}
