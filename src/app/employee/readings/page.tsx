export const dynamic = "force-dynamic";

import { getAllCustomers } from "@/lib/google-sheets";
import ReadingsByBox from "./ReadingsByBox";

export default async function EmployeeReadingsPage() {
  const customers = await getAllCustomers();
  const activeCustomers = customers.filter((c) => c.status === "ACTIVE");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Record Meter Reading</h1>
      <p className="text-slate-600 mb-6">
        Select a box number, then choose a customer to record their meter reading.
      </p>
      <ReadingsByBox customers={activeCustomers} />
    </div>
  );
}
