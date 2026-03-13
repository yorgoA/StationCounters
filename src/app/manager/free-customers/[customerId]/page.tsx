export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCustomerById,
  getBillsByCustomer,
  getSettings,
  getAmperePrices,
} from "@/lib/google-sheets";
import { getAmperePriceForTier } from "@/lib/billing";

function formatMonthKey(key: string) {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[parseInt(m || "1", 10) - 1];
  return `${month} ${y}`;
}

export default async function FreeCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const [customer, bills, settings, ampereTiers] = await Promise.all([
    getCustomerById(customerId),
    getBillsByCustomer(customerId),
    getSettings(),
    getAmperePrices(),
  ]);

  if (!customer || customer.billingType !== "FREE") notFound();

  const kwhPrice = settings.kwhPrice || 0;
  const totalKwh = bills.reduce((s, b) => s + b.usageKwh, 0);
  const amountWaived = bills.reduce((s, b) => {
    const consumption = b.usageKwh * kwhPrice;
    const ampere = getAmperePriceForTier(customer.subscribedAmpere, ampereTiers);
    return s + consumption + ampere;
  }, 0);
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/manager/free-customers"
          className="text-primary-600 hover:text-primary-700 text-sm"
        >
          ← Back to Free Customers
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-800">{customer.fullName}</h1>
          <p className="text-slate-600 text-sm mt-1">
            Free Customer • {customer.status}
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Amperes</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {customer.subscribedAmpere}A
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total kWh</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {totalKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {bills.length} bill{bills.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Discount</p>
            <p className="text-lg font-semibold text-emerald-600 mt-1">100% (Free)</p>
            {customer.freeReason && (
              <p className="text-sm text-slate-600 mt-0.5">{customer.freeReason}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Amount Waived
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {amountWaived.toLocaleString()} LBP
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Would have paid if charged
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
            <p>
              <span className="text-slate-500">Phone:</span> {customer.phone || "—"}
            </p>
            <p>
              <span className="text-slate-500">Box:</span> {customer.area || "—"}
            </p>
            <p>
              <span className="text-slate-500">Building:</span> {customer.building || "—"}
            </p>
            <p>
              <span className="text-slate-500">Floor / Apt:</span> {customer.floor || "—"} /{" "}
              {customer.apartmentNumber || "—"}
            </p>
          </div>
        </div>
      </div>

      {bills.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <h2 className="px-6 py-4 font-semibold text-slate-800 border-b border-slate-200">
            Usage by Month
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Month
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    kWh
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    Would have paid
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[...bills]
                  .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
                  .map((b) => {
                    const consumption = b.usageKwh * kwhPrice;
                    const ampere = getAmperePriceForTier(
                      customer.subscribedAmpere,
                      ampereTiers
                    );
                    const wouldPay = consumption + ampere;
                    return (
                      <tr key={b.billId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">
                          {formatMonthKey(b.monthKey)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {b.usageKwh.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium">
                          {wouldPay.toLocaleString()} LBP
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Link
          href={`/manager/customers/${customerId}`}
          className="text-primary-600 hover:text-primary-700 text-sm"
        >
          Edit customer →
        </Link>
      </div>
    </div>
  );
}
