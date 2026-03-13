export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAllCustomers, getAmperePrices } from "@/lib/google-sheets";
import AddCustomerForm from "@/app/employee/customers/AddCustomerForm";

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

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Box Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {customers.map((c) => (
              <tr key={c.customerId} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800 font-medium">{c.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                <td className="px-4 py-3 text-slate-600">{c.area}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                      c.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/manager/customers/${c.customerId}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="text-center text-slate-500 py-12">No customers</p>
        )}
      </div>
    </div>
  );
}
