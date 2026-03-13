export const dynamic = "force-dynamic";

import { getAllCustomers, getAllBills } from "@/lib/google-sheets";
import MonitorsMonthSelect from "./MonitorsMonthSelect";
import MonitorsTable from "./MonitorsTable";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const prev = m === 0 ? new Date(y - 1, 11) : new Date(y, m - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function MonitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const [customers, bills] = await Promise.all([
    getAllCustomers(),
    getAllBills(),
  ]);

  const monthKey = params.month || getPreviousMonthKey();
  const monthBills = bills.filter((b) => b.monthKey === monthKey);

  const billMonths = Array.from(new Set(bills.map((b) => b.monthKey)));
  const currentKey = getCurrentMonthKey();
  const previousKey = getPreviousMonthKey();
  const allMonths = new Set([
    ...Array.from(billMonths),
    currentKey,
    previousKey,
  ]);
  const months = Array.from(allMonths).sort().reverse();

  const monitors = customers.filter((c) => c.isMonitor);
  const customerMap = new Map(customers.map((c) => [c.customerId, c]));
  const billByCustomer = new Map(monthBills.map((b) => [b.customerId, b]));

  type LinkedRef = { customerId: string; fullName: string; area: string; building: string; kwh: number; amp: number };

  type MonitorRow = {
    customerId: string;
    fullName: string;
    area: string;
    building: string;
    monitorCategory: string;
    links: LinkedRef[];
    monitorKwh: number;
    linkedKwh: number;
    linkedAmp: number;
  };

  const rows: MonitorRow[] = monitors.map((m) => {
    const ids = (m.linkedCustomerIds?.length
      ? m.linkedCustomerIds
      : m.linkedCustomerId
        ? [m.linkedCustomerId]
        : []) as string[];
    const monitorBill = billByCustomer.get(m.customerId);
    const links: LinkedRef[] = ids.map((id) => {
      const cust = customerMap.get(id);
      const b = billByCustomer.get(id);
      return {
        customerId: id,
        fullName: cust?.fullName ?? id,
        area: cust?.area ?? "",
        building: cust?.building ?? "",
        kwh: b?.usageKwh ?? 0,
        amp: b?.ampereCharge ?? 0,
      };
    });
    const linkedKwh = links.reduce((s, l) => s + l.kwh, 0);
    const linkedAmp = links.reduce((s, l) => s + l.amp, 0);
    const firstLinkedBill = ids[0] ? billByCustomer.get(ids[0]) : null;
    const effectiveMonitorBill = monitorBill ?? firstLinkedBill;
    return {
      customerId: m.customerId,
      fullName: m.fullName,
      area: m.area,
      building: m.building,
      monitorCategory: m.monitorCategory ?? "",
      links,
      monitorKwh: effectiveMonitorBill?.usageKwh ?? 0,
      linkedKwh,
      linkedAmp,
    };
  });

  const totalMonitorKwh = rows.reduce((s, r) => s + r.monitorKwh, 0);
  const totalLinkedKwh = rows.reduce((s, r) => s + r.linkedKwh, 0);
  const totalLinkedAmp = rows.reduce((s, r) => s + r.linkedAmp, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Monitors</h1>
          <p className="text-slate-500 mt-1">
            Track usage per monitor vs linked customer for theft detection. Monitors can be on any customer type.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Month
          </label>
          <MonitorsMonthSelect months={months} currentMonth={monthKey} />
        </div>
      </div>

      {monitors.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
          No monitors configured. Edit a customer and enable &quot;Monitor&quot; with a linked customer.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Monitors count</p>
              <p className="text-2xl font-bold text-slate-800">{monitors.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Monitor total ({formatMonthKey(monthKey)})</p>
              <p className="text-xl font-bold text-slate-800">
                {totalMonitorKwh.toLocaleString()} kWh
              </p>
              <p className="text-xs text-slate-500">Monitors track kWh only (no amp)</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Linked total</p>
              <p className="text-xl font-bold text-slate-800">
                {totalLinkedKwh.toLocaleString()} kWh
              </p>
              <p className="text-sm text-slate-600">{totalLinkedAmp.toLocaleString()} LBP amp</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Match (kWh only)</p>
              <p className="text-xl font-bold text-slate-800">
                {totalMonitorKwh === totalLinkedKwh ? "✓ Equal" : "≠ Diff"}
              </p>
              {totalMonitorKwh !== totalLinkedKwh && (
                <p className="text-xs text-amber-600">
                  kWh: {(totalMonitorKwh - totalLinkedKwh).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <MonitorsTable rows={rows} />
        </>
      )}
    </div>
  );
}
