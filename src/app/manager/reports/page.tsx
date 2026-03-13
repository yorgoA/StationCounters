export const dynamic = "force-dynamic";

import { getAllBills } from "@/lib/google-sheets";
import { getAllPayments } from "@/lib/google-sheets";

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function ManagerReportsPage() {
  const [bills, payments] = await Promise.all([getAllBills(), getAllPayments()]);

  // Group bills by monthKey
  const monthBills = new Map<string, typeof bills>();
  for (const b of bills) {
    const list = monthBills.get(b.monthKey) ?? [];
    list.push(b);
    monthBills.set(b.monthKey, list);
  }

  // Group payments by month (paymentDate format: YYYY-MM-DD)
  const monthPayments = new Map<string, typeof payments>();
  for (const p of payments) {
    if (!p.paymentDate || p.paymentDate.length < 7) continue;
    const monthKey = p.paymentDate.slice(0, 7);
    const list = monthPayments.get(monthKey) ?? [];
    list.push(p);
    monthPayments.set(monthKey, list);
  }

  const allMonths = new Set([
    ...Array.from(monthBills.keys()),
    ...Array.from(monthPayments.keys()),
  ]);
  const sortedMonths = Array.from(allMonths).sort().reverse();

  const rows = sortedMonths.map((monthKey) => {
    const monthBillsList = monthBills.get(monthKey) ?? [];
    const monthPaymentsList = monthPayments.get(monthKey) ?? [];

    const totalBilled = monthBillsList.reduce((s, b) => s + b.totalDue, 0);
    const totalCollected = monthPaymentsList.reduce((s, p) => s + p.amountPaid, 0);
    const totalKwh = monthBillsList.reduce((s, b) => s + b.usageKwh, 0);
    const billCount = monthBillsList.length;

    return {
      monthKey,
      label: formatMonthKey(monthKey),
      totalBilled,
      totalCollected,
      totalKwh,
      billCount,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Monthly Reports</h1>
      <p className="text-slate-500 mb-8">
        Historical overview: money collected and kWh consumed per month.
      </p>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Month
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Bills
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Billed (LBP)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Collected (LBP)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                kWh
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.monthKey} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800 font-medium">{r.label}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.billCount}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {r.totalBilled.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium text-green-600">
                  {r.totalCollected.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {r.totalKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-slate-500 py-12">No data yet</p>
        )}
      </div>
    </div>
  );
}
