export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAllBills, getAllCustomers } from "@/lib/google-sheets";
import { notFound } from "next/navigation";
import PrintMonthlyBillsButton from "./PrintMonthlyBillsButton";

const BILLS_PER_PAGE = 2; // 2 bills per A4 page = A5 each when cut. Use 3 for smaller bills.

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function BillCard({
  customer,
  bill,
  monthLabel,
}: {
  customer: { fullName: string; phone: string; area: string; building: string; floor: string; apartmentNumber: string };
  bill: {
    monthKey: string;
    previousCounter: number;
    currentCounter: number;
    usageKwh: number;
    ampereCharge: number;
    consumptionCharge: number;
    previousUnpaidBalance: number;
    discountApplied: number;
    totalDue: number;
    totalPaid: number;
    remainingDue: number;
  };
  monthLabel: string;
}) {
  return (
    <div className="bill-card border border-slate-300 rounded p-4 text-sm">
      <h2 className="font-bold text-slate-800 text-base mb-2">
        Electricity Bill – {monthLabel}
      </h2>
      <p className="font-semibold text-slate-800">{customer.fullName}</p>
      {customer.phone && <p className="text-slate-600">{customer.phone}</p>}
      <p className="text-slate-600">
        Box {customer.area} • {customer.building}
        {customer.floor && ` • Floor ${customer.floor}`}
        {customer.apartmentNumber && ` • Apt ${customer.apartmentNumber}`}
      </p>
      <div className="mt-2 space-y-0.5 text-slate-700">
        <div className="flex justify-between">
          <span>Meter:</span>
          <span>{bill.previousCounter} → {bill.currentCounter} ({bill.usageKwh} kWh)</span>
        </div>
        {bill.ampereCharge > 0 && (
          <div className="flex justify-between">
            <span>Ampere:</span>
            <span>{bill.ampereCharge.toLocaleString()} LBP</span>
          </div>
        )}
        {bill.consumptionCharge > 0 && (
          <div className="flex justify-between">
            <span>Consumption:</span>
            <span>{bill.consumptionCharge.toLocaleString()} LBP</span>
          </div>
        )}
        {bill.previousUnpaidBalance > 0 && (
          <div className="flex justify-between">
            <span>Previous unpaid:</span>
            <span>{bill.previousUnpaidBalance.toLocaleString()} LBP</span>
          </div>
        )}
        {bill.discountApplied > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount:</span>
            <span>-{bill.discountApplied.toLocaleString()} LBP</span>
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between font-bold">
        <span>Total due</span>
        <span>{bill.totalDue.toLocaleString()} LBP</span>
      </div>
      {bill.totalPaid > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Paid</span>
          <span>{bill.totalPaid.toLocaleString()} LBP</span>
        </div>
      )}
      {bill.remainingDue > 0 && (
        <div className="flex justify-between font-medium text-amber-700">
          <span>Remaining</span>
          <span>{bill.remainingDue.toLocaleString()} LBP</span>
        </div>
      )}
      {bill.remainingDue <= 0 && <p className="text-green-600 font-medium">Paid</p>}
    </div>
  );
}

export default async function PrintMonthlyBillsPage({
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

  const monthBills = bills
    .filter((b) => b.monthKey === monthKey)
    .sort((a, b) => {
      const custA = customers.find((c) => c.customerId === a.customerId);
      const custB = customers.find((c) => c.customerId === b.customerId);
      const nameA = custA?.fullName ?? a.customerId;
      const nameB = custB?.fullName ?? b.customerId;
      return nameA.localeCompare(nameB);
    });

  const customerMap = new Map(customers.map((c) => [c.customerId, c]));
  const monthLabel = formatMonthKey(monthKey);

  const pages: typeof monthBills[] = [];
  for (let i = 0; i < monthBills.length; i += BILLS_PER_PAGE) {
    pages.push(monthBills.slice(i, i + BILLS_PER_PAGE));
  }

  return (
    <div className="print-monthly-bills">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Link href="/manager/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
        <PrintMonthlyBillsButton />
      </div>
      <p className="text-slate-500 text-sm mb-4 print:hidden">
        {monthBills.length} bills • 2 per page • Print or Save as PDF, then cut and distribute.
      </p>

      <div className="print-bills-pages space-y-8">
        {pages.map((pageBills, pageIdx) => (
          <div
            key={pageIdx}
            className="print-page flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200 shadow-sm"
            style={{ pageBreakAfter: pageIdx < pages.length - 1 ? "always" : "auto" }}
          >
            {pageBills.map((bill) => {
              const customer = customerMap.get(bill.customerId);
              if (!customer) return null;
              return (
                <BillCard
                  key={bill.billId}
                  customer={customer}
                  bill={bill}
                  monthLabel={monthLabel}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
