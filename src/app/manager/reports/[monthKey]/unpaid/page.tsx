export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAllBills, getAllCustomers } from "@/lib/google-sheets";
import { notFound } from "next/navigation";

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function UnpaidByMonthPage({
  params,
}: {
  params: Promise<{ monthKey: string }>;
}) {
  const { monthKey } = await params;
  if (!/^\d{4}-\d{2}$/.test(monthKey)) notFound();

  const [bills, customers] = await Promise.all([
    getAllBills(),
    getAllCustomers(),
  ]);

  const monthBills = bills.filter((b) => b.monthKey === monthKey);
  const unpaidBills = monthBills.filter((b) => b.remainingDue > 0);
  const customerMap = new Map(customers.map((c) => [c.customerId, c]));

  const totalUnpaid = unpaidBills.reduce((s, b) => s + b.remainingDue, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/manager/reports"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Reports
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">
            Unpaid – {formatMonthKey(monthKey)}
          </h1>
          <p className="mt-1 text-slate-500">
            {unpaidBills.length} customer{unpaidBills.length !== 1 ? "s" : ""}{" "}
            with remaining balance • {totalUnpaid.toLocaleString()} LBP total
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Box • Building
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Billed (LBP)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Paid (LBP)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Remaining (LBP)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {unpaidBills.map((b) => {
              const cust = customerMap.get(b.customerId);
              return (
                <tr key={b.billId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/manager/customers/${b.customerId}`}
                      className="font-medium text-slate-800 hover:text-primary-600"
                    >
                      {cust?.fullName || b.customerId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {cust?.area || "—"} • {cust?.building || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {b.totalDue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {b.totalPaid.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {b.remainingDue.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {unpaidBills.length === 0 && (
          <p className="py-12 text-center text-slate-500">
            All customers paid for {formatMonthKey(monthKey)}.
          </p>
        )}
      </div>
    </div>
  );
}
