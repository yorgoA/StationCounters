export const dynamic = "force-dynamic";

import { getAllCustomers, getAllBills } from "@/lib/google-sheets";
import UnpaidBillsTable from "./UnpaidBillsTable";

export default async function EmployeePaymentsPage() {
  const [customers, bills] = await Promise.all([getAllCustomers(), getAllBills()]);
  const monitorCustomerIds = new Set(customers.filter((c) => c.isMonitor).map((c) => c.customerId));
  const unpaidBills = bills.filter((b) => b.remainingDue > 0 && !monitorCustomerIds.has(b.customerId));
  const activeCustomerIds = new Set(
    customers.filter((c) => c.status === "ACTIVE").map((c) => c.customerId)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Record Payment</h1>
      <p className="text-slate-600 mb-6">
        Select a customer with unpaid balance to record a payment.
      </p>
      <UnpaidBillsTable
        unpaidBills={unpaidBills}
        customers={customers}
        activeCustomerIds={activeCustomerIds}
      />
    </div>
  );
}
