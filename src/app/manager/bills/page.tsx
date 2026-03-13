export const dynamic = "force-dynamic";

import { getAllBills, getAllCustomers } from "@/lib/google-sheets";
import BillsMonthSelect from "./BillsMonthSelect";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ManagerBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthKey = params.month || getCurrentMonthKey();
  const [bills, customers] = await Promise.all([getAllBills(), getAllCustomers()]);
  const monthBills = bills.filter((b) => b.monthKey === monthKey);

  const months = Array.from(new Set(bills.map((b) => b.monthKey))).sort().reverse();
  if (months.length === 0) months.push(monthKey);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Bills</h1>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Filter by month</label>
        <BillsMonthSelect months={months} currentMonth={monthKey} />
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usage</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total Due</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Paid</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Remaining</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {monthBills.map((b) => {
              const cust = customers.find((c) => c.customerId === b.customerId);
              return (
                <tr key={b.billId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {cust?.fullName || b.customerId}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.usageKwh} kWh</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {b.totalDue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {b.totalPaid.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {b.remainingDue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
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
              );
            })}
          </tbody>
        </table>
        {monthBills.length === 0 && (
          <p className="text-center text-slate-500 py-12">No bills for {monthKey}</p>
        )}
      </div>
    </div>
  );
}
