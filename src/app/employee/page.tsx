import Link from "next/link";

export const dynamic = "force-dynamic";
import { getAllCustomers } from "@/lib/google-sheets";
import { customerMatchesRegion, formatRegion, parseRegionFilter } from "@/lib/region";
import ManagerRegionSelect from "@/app/manager/ManagerRegionSelect";

export default async function EmployeeHomePage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const params = await searchParams;
  const regionFilter = parseRegionFilter(params.region ?? "PRINTANIA");
  const customers = await getAllCustomers();
  const customersExclMonitors = customers.filter(
    (c) => !c.isMonitor && customerMatchesRegion(c, regionFilter)
  );
  const activeCount = customersExclMonitors.filter((c) => c.status === "ACTIVE").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Home</h1>
          <p className="text-slate-500 mt-1">Region: {formatRegion(regionFilter)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Region</label>
          <ManagerRegionSelect basePath="/employee" currentRegion={regionFilter} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href={`/employee/customers?region=${regionFilter}`}
          className="bg-white rounded-lg border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-slate-800">Customers</h3>
          <p className="text-2xl font-bold text-primary-600 mt-1">
            {customersExclMonitors.length} total
          </p>
          <p className="text-sm text-slate-500 mt-1">{activeCount} active</p>
        </Link>
        <Link
          href={`/employee/readings?region=${regionFilter}`}
          className="bg-white rounded-lg border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-slate-800">Record Reading</h3>
          <p className="text-sm text-slate-500 mt-1">
            Add monthly meter readings
          </p>
        </Link>
        <Link
          href={`/employee/payments?region=${regionFilter}`}
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
            href={`/employee/customers?action=add&region=${regionFilter}`}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Add Customer
          </Link>
          <Link
            href={`/employee/readings?region=${regionFilter}`}
            className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Record Reading
          </Link>
          <Link
            href={`/employee/payments?region=${regionFilter}`}
            className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Record Payment
          </Link>
        </div>
      </div>
    </div>
  );
}
