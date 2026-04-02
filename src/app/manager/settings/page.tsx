export const dynamic = "force-dynamic";

import { getSettings, getAmperePrices, getMonthlyTariffs } from "@/lib/google-sheets";
import SettingsForm from "./SettingsForm";
import AmperePricesForm from "./AmperePricesForm";

export default async function ManagerSettingsPage() {
  const [settings, amperePrices, monthlyTariffs] = await Promise.all([
    getSettings(),
    getAmperePrices(),
    getMonthlyTariffs(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Settings</h1>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Ampere Prices (LBP)</h2>
          <p className="text-sm text-slate-500 mb-4">
            Each amperage tier has a fixed price. Used for AMPERE_ONLY and BOTH billing types.
          </p>
          <AmperePricesForm initialTiers={amperePrices} />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Other Settings</h2>
          <p className="text-sm text-slate-500 mb-4">
            Set a monthly kWh tariff by month. Global kWh price is fallback for months with
            no monthly tariff.
          </p>
          <SettingsForm initialSettings={settings} monthlyTariffs={monthlyTariffs} />
        </div>
      </div>
    </div>
  );
}
