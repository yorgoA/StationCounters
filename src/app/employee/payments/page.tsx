export const dynamic = "force-dynamic";

import { getAllCustomers, getAllBills } from "@/lib/google-sheets";
import { customerMatchesRegion, parseRegionFilter } from "@/lib/region";
import ManagerRegionSelect from "@/app/manager/ManagerRegionSelect";
import UnpaidBillsTable from "./UnpaidBillsTable";

export default async function EmployeePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const params = await searchParams;
  const regionFilter = parseRegionFilter(params.region);
  const [customers, bills] = await Promise.all([getAllCustomers(), getAllBills()]);
  const filteredCustomers = customers.filter((c) => customerMatchesRegion(c, regionFilter));
  const allowedCustomerIds = new Set(filteredCustomers.map((c) => c.customerId));
  const monitorCustomerIds = new Set(filteredCustomers.filter((c) => c.isMonitor).map((c) => c.customerId));
  const unpaidBills = bills.filter(
    (b) =>
      b.remainingDue > 0 &&
      allowedCustomerIds.has(b.customerId) &&
      !monitorCustomerIds.has(b.customerId)
  );
  const activeCustomerIds = new Set(
    filteredCustomers.filter((c) => c.status === "ACTIVE").map((c) => c.customerId)
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Record Payment</h1>
          <p className="text-slate-600 mt-1">
            Select a customer with unpaid balance to record a payment.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Region</label>
          <ManagerRegionSelect basePath="/employee/payments" currentRegion={regionFilter} />
        </div>
      </div>
      <UnpaidBillsTable
        unpaidBills={unpaidBills}
        customers={filteredCustomers}
        activeCustomerIds={activeCustomerIds}
        region={regionFilter}
      />
    </div>
  );
}
