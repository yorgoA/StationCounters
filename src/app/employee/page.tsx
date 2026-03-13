import Link from "next/link";

export const dynamic = "force-dynamic";
import { getAllCustomers } from "@/lib/google-sheets";

export default async function EmployeeHomePage() {
  const customers = await getAllCustomers();
  const customersExclMonitors = customers.filter((c) => !c.isMonitor);
  const activeCount = customersExclMonitors.filter((c) => c.status === "ACTIVE").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Employee Home</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/employee/customers"
          className="bg-white rounded-lg border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-slate-800">Customers</h3>
          <p className="text-2xl font-bold text-primary-600 mt-1">
            {customersExclMonitors.length} total
          </p>
          <p className="text-sm text-slate-500 mt-1">{activeCount} active</p>
        </Link>
        <Link
          href="/employee/readings"
          className="bg-white rounded-lg border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-slate-800">Record Reading</h3>
          <p className="text-sm text-slate-500 mt-1">
            Add monthly meter readings
          </p>
        </Link>
        <Link
          href="/employee/payments"
          className="bg-white rounded-lg border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-slate-800">Record Payment</h3>
          <p className="text-sm text-slate-500 mt-1">
            Record payments and receipts
          </p>
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/employee/customers?action=add"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Add Customer
          </Link>
          <Link
            href="/employee/readings"
            className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Record Reading
          </Link>
          <Link
            href="/employee/payments"
            className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Record Payment
          </Link>
        </div>
      </div>
    </div>
  );
}
