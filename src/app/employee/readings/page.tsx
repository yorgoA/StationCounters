export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAllCustomers } from "@/lib/google-sheets";

export default async function EmployeeReadingsPage() {
  const customers = await getAllCustomers();
  const activeCustomers = customers.filter((c) => c.status === "ACTIVE");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Record Meter Reading</h1>
      <p className="text-slate-600 mb-6">
        Select a customer to record their monthly meter reading.
      </p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Area</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {activeCustomers.map((c) => (
              <tr key={c.customerId} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800 font-medium">{c.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                <td className="px-4 py-3 text-slate-600">{c.area}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/employee/readings/${c.customerId}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Record Reading →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activeCustomers.length === 0 && (
          <p className="text-center text-slate-500 py-12">No active customers</p>
        )}
      </div>
    </div>
  );
}
