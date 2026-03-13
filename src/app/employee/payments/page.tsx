export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAllCustomers, getAllBills } from "@/lib/google-sheets";

export default async function EmployeePaymentsPage() {
  const [customers, bills] = await Promise.all([getAllCustomers(), getAllBills()]);
  const unpaidBills = bills.filter((b) => b.remainingDue > 0);
  const activeCustomers = customers.filter((c) => c.status === "ACTIVE");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Record Payment</h1>
      <p className="text-slate-600 mb-6">
        Select a customer with unpaid balance to record a payment.
      </p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Month</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Due</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {unpaidBills.map((b) => {
              const cust = customers.find((c) => c.customerId === b.customerId);
              if (!cust || cust.status !== "ACTIVE") return null;
              return (
                <tr key={b.billId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800 font-medium">{cust.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{b.monthKey}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {b.remainingDue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/employee/payments/${b.customerId}`}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Record Payment →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {unpaidBills.filter((b) =>
          activeCustomers.some((c) => c.customerId === b.customerId)
        ).length === 0 && (
          <p className="text-center text-slate-500 py-12">No unpaid bills</p>
        )}
      </div>
    </div>
  );
}
