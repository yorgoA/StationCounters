export const dynamic = "force-dynamic";

import { getAllCustomers, getAllBills, getKwhPriceForMonth } from "@/lib/google-sheets";
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
  const monthKwhPrice = await getKwhPriceForMonth(monthKey);
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

  type LinkedRef = {
    customerId: string;
    fullName: string;
    area: string;
    building: string;
    billedKwh: number;
    includedKwh: number;
  };

  type MonitorRow = {
    customerId: string;
    fullName: string;
    area: string;
    building: string;
    monitorCategory: string;
    links: LinkedRef[];
    monitorKwh: number;
    linkedIncludedKwh: number;
    matchKwh: number;
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
      const fixedMonthlyPrice = cust?.fixedMonthlyPrice ?? 0;
      const includedKwh =
        monthKwhPrice > 0 ? fixedMonthlyPrice / monthKwhPrice : 0;
      return {
        customerId: id,
        fullName: cust?.fullName ?? id,
        area: cust?.area ?? "",
        building: cust?.building ?? "",
        billedKwh: b?.usageKwh ?? 0,
        includedKwh,
      };
    });
    const linkedIncludedKwh = links.reduce((s, l) => s + l.includedKwh, 0);
    const firstLinkedBill = ids[0] ? billByCustomer.get(ids[0]) : null;
    const effectiveMonitorBill = monitorBill ?? firstLinkedBill;
    const monitorKwh = effectiveMonitorBill?.usageKwh ?? 0;
    return {
      customerId: m.customerId,
      fullName: m.fullName,
      area: m.area,
      building: m.building,
      monitorCategory: m.monitorCategory ?? "",
      links,
      monitorKwh,
      linkedIncludedKwh,
      matchKwh: monitorKwh - linkedIncludedKwh,
    };
  });

  const totalMonitorKwh = rows.reduce((s, r) => s + r.monitorKwh, 0);
  const totalLinkedIncludedKwh = rows.reduce((s, r) => s + r.linkedIncludedKwh, 0);
  const totalMatchKwh = rows.reduce((s, r) => s + r.matchKwh, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Monitors</h1>
          <p className="text-slate-500 mt-1">
            Compare monitor usage vs linked fixed-plan kWh allowance for theft detection.
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
                {totalLinkedIncludedKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
              </p>
              <p className="text-sm text-slate-600">
                From fixed monthly / {monthKwhPrice.toLocaleString()} LBP per kWh
              </p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Match (monitor - linked)</p>
              <p
                className={`text-xl font-bold ${
                  totalMatchKwh > 0 ? "text-red-600" : totalMatchKwh < 0 ? "text-green-600" : "text-slate-800"
                }`}
              >
                {totalMatchKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
              </p>
            </div>
          </div>

          <MonitorsTable rows={rows} monthKwhPrice={monthKwhPrice} />
        </>
      )}
    </div>
  );
}
