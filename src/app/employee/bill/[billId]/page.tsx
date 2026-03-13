export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllBills, getAllCustomers } from "@/lib/google-sheets";
import PrintBillButton from "./PrintBillButton";

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function BillPrintPage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const { billId } = await params;
  const [bills, customers] = await Promise.all([
    getAllBills(),
    getAllCustomers(),
  ]);

  const bill = bills.find((b) => b.billId === billId);
  if (!bill) notFound();

  const customer = customers.find((c) => c.customerId === bill.customerId);
  if (!customer) notFound();

  return (
    <div className="bill-print-content">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Link
          href={`/employee/customers/${customer.customerId}`}
          className="text-primary-600 hover:text-primary-700 text-sm"
        >
          ← Back to customer
        </Link>
        <PrintBillButton />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-8 max-w-lg print:border-0 print:shadow-none print:p-0">
        <h1 className="text-xl font-bold text-slate-800 mb-6 print:text-lg">
          Electricity Bill – {formatMonthKey(bill.monthKey)}
        </h1>

        <div className="space-y-4 text-slate-700 text-sm">
          <div>
            <p className="font-semibold text-slate-800">{customer.fullName}</p>
            <p>{customer.phone}</p>
            <p>
              Box {customer.area} • {customer.building}
              {customer.floor && ` • Floor ${customer.floor}`}
              {customer.apartmentNumber && ` • Apt ${customer.apartmentNumber}`}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
            <div className="flex justify-between">
              <span>Meter reading (previous)</span>
              <span>{bill.previousCounter}</span>
            </div>
            <div className="flex justify-between">
              <span>Meter reading (current)</span>
              <span>{bill.currentCounter}</span>
            </div>
            <div className="flex justify-between">
              <span>Usage (kWh)</span>
              <span>{bill.usageKwh}</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
            {bill.ampereCharge > 0 && (
              <div className="flex justify-between">
                <span>Ampere charge</span>
                <span>{bill.ampereCharge.toLocaleString()} LBP</span>
              </div>
            )}
            {bill.consumptionCharge > 0 && (
              <div className="flex justify-between">
                <span>Consumption charge</span>
                <span>{bill.consumptionCharge.toLocaleString()} LBP</span>
              </div>
            )}
            {bill.previousUnpaidBalance > 0 && (
              <div className="flex justify-between">
                <span>Previous unpaid balance</span>
                <span>{bill.previousUnpaidBalance.toLocaleString()} LBP</span>
              </div>
            )}
            {bill.discountApplied > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{bill.discountApplied.toLocaleString()} LBP</span>
              </div>
            )}
          </div>

          <div className="border-t-2 border-slate-300 pt-4 mt-4 flex justify-between font-bold text-base">
            <span>Total due</span>
            <span>{bill.totalDue.toLocaleString()} LBP</span>
          </div>

          {bill.totalPaid > 0 && (
            <div className="flex justify-between">
              <span>Amount paid</span>
              <span className="text-green-600">{bill.totalPaid.toLocaleString()} LBP</span>
            </div>
          )}
          {bill.remainingDue > 0 && (
            <div className="flex justify-between font-medium text-amber-700">
              <span>Remaining due</span>
              <span>{bill.remainingDue.toLocaleString()} LBP</span>
            </div>
          )}
          {bill.remainingDue <= 0 && (
            <p className="text-green-600 font-medium pt-2">Paid</p>
          )}
        </div>
      </div>
    </div>
  );
}
