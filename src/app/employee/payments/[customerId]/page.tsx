export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerById, getBillsByCustomer } from "@/lib/google-sheets";
import RecordPaymentForm from "../../customers/[customerId]/RecordPaymentForm";

export default async function EmployeeRecordPaymentPage({
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

  const unpaidBills = bills.filter((b) => b.remainingDue > 0);

  return (
    <div>
      <div className="mb-6">
        <Link href="/employee/payments" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Record Payment
        </Link>
      </div>
      <div className="max-w-md">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-800 mb-2">{customer.fullName}</h1>
          <p className="text-slate-500 text-sm mb-6">
            {customer.area} • {customer.building}
          </p>
          <h2 className="font-semibold text-slate-800 mb-4">Record Payment</h2>
          <RecordPaymentForm customerId={customerId} bills={unpaidBills} />
        </div>
      </div>
    </div>
  );
}
