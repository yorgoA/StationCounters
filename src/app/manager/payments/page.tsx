export const dynamic = "force-dynamic";

import { getAllPayments, getAllCustomers } from "@/lib/google-sheets";
import { customerMatchesRegion, formatRegion, parseRegionFilter } from "@/lib/region";
import ManagerRegionSelect from "../ManagerRegionSelect";

export default async function ManagerPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const params = await searchParams;
  const regionFilter = parseRegionFilter(params.region);
  const [payments, customers] = await Promise.all([
    getAllPayments(),
    getAllCustomers(),
  ]);
  const filteredCustomers = customers.filter((c) => customerMatchesRegion(c, regionFilter));
  const allowedCustomerIds = new Set(filteredCustomers.map((c) => c.customerId));
  const customerMap = new Map(filteredCustomers.map((c) => [c.customerId, c]));
  const sorted = [...payments]
    .filter((p) => allowedCustomerIds.has(p.customerId))
    .sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payments</h1>
          <p className="text-slate-500 mt-1">Region: {formatRegion(regionFilter)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Region</label>
          <ManagerRegionSelect basePath="/manager/payments" currentRegion={regionFilter} />
        </div>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sorted.map((p) => {
              const cust = customerMap.get(p.customerId);
              return (
                <tr key={p.paymentId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{p.paymentDate}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {cust?.fullName || p.customerId}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    {p.amountPaid.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.paymentMethod}</td>
                  <td className="px-4 py-3">
                    {p.receiptImageUrl ? (
                      <a
                        href={p.receiptImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="text-center text-slate-500 py-12">No payments yet</p>
        )}
      </div>
    </div>
  );
}
