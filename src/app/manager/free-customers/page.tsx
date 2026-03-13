export const dynamic = "force-dynamic";

import { getAllCustomers } from "@/lib/google-sheets";
import FreeCustomersList from "./FreeCustomersList";

export default async function ManagerFreeCustomersPage() {
  const customers = await getAllCustomers();
  const freeCustomers = customers.filter((c) => c.billingType === "FREE");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Free Customers</h1>
      <p className="text-slate-500 mb-8">
        Manage customers who are exempt from charges. Uncheck to remove from free list. Add a reason for tracking.
      </p>

      <FreeCustomersList customers={freeCustomers} />
    </div>
  );
}
