export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { getAllCustomers, getAmperePrices } from "@/lib/google-sheets";
import AddCustomerForm from "@/app/employee/customers/AddCustomerForm";
import CustomerSearch from "@/app/employee/customers/CustomerSearch";

export default async function ManagerCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const params = await searchParams;
  const [customers, ampereTiers] = await Promise.all([getAllCustomers(), getAmperePrices()]);
  const showAddForm = params.action === "add";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
        {!showAddForm && (
          <Link
            href="/manager/customers?action=add"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Add Customer
          </Link>
        )}
      </div>

      {showAddForm && (
        <div className="mb-8">
          <AddCustomerForm basePath="/manager/customers" ampereTiers={ampereTiers} />
        </div>
      )}

      <div className="mb-4">
        <Suspense fallback={<div className="h-10 bg-slate-100 rounded animate-pulse" />}>
          <CustomerSearch initialCustomers={customers} customerLinkPath="/manager/customers" />
        </Suspense>
      </div>
    </div>
  );
}
