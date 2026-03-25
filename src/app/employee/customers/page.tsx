export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { getAllBills, getAllCustomers, getAmperePrices } from "@/lib/google-sheets";
import AddCustomerForm from "./AddCustomerForm";
import CustomerSearchWithPaidByMonth from "./CustomerSearchWithPaidByMonth";

export default async function EmployeeCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string }>;
}) {
  const params = await searchParams;
  const [customers, bills, ampereTiers] = await Promise.all([getAllCustomers(), getAllBills(), getAmperePrices()]);
  const showAddForm = params.action === "add";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
        {!showAddForm && (
          <Link
            href="/employee/customers?action=add"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Add Customer
          </Link>
        )}
      </div>

      {showAddForm && (
        <div className="mb-8">
          <AddCustomerForm ampereTiers={ampereTiers} allCustomers={customers} />
        </div>
      )}

      <div className="mb-4">
        <Suspense fallback={<div className="h-10 bg-slate-100 rounded animate-pulse" />}>
          <CustomerSearchWithPaidByMonth
            initialCustomers={customers}
            bills={bills}
            customerLinkPath="/employee/customers"
            showFreeFilter
          />
        </Suspense>
      </div>
    </div>
  );
}
