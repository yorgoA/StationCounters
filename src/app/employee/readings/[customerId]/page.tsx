export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerById, getBillsByCustomer } from "@/lib/google-sheets";
import RecordReadingForm from "../../customers/[customerId]/RecordReadingForm";

export default async function EmployeeRecordReadingPage({
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

  const latestBill = bills.sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];
  const previousCounter = latestBill?.currentCounter ?? null;

  return (
    <div>
      <div className="mb-6">
        <Link href="/employee/readings" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Record Reading
        </Link>
      </div>
      <div className="max-w-md">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-800 mb-2">{customer.fullName}</h1>
          <p className="text-slate-500 text-sm mb-6">
            {customer.area} • {customer.building}
          </p>
          <h2 className="font-semibold text-slate-800 mb-4">Record Meter Reading</h2>
          <RecordReadingForm
            customerId={customerId}
            customer={customer}
            previousCounter={previousCounter}
          />
        </div>
      </div>
    </div>
  );
}
