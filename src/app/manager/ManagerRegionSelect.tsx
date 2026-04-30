"use client";

import { useRouter } from "next/navigation";
import { formatRegion, REGION_FILTER_OPTIONS, type RegionFilter } from "@/lib/region";

export default function ManagerRegionSelect({
  basePath,
  month,
  currentRegion,
}: {
  basePath: string;
  month?: string;
  currentRegion: RegionFilter;
}) {
  const router = useRouter();
  return (
    <select
      value={currentRegion}
      onChange={(e) => {
        const region = e.target.value as RegionFilter;
        const query = month ? `month=${month}&region=${region}` : `region=${region}`;
        router.push(`${basePath}?${query}`);
        router.refresh();
      }}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
    >
      {REGION_FILTER_OPTIONS.map((region) => (
        <option key={region} value={region}>
          {formatRegion(region)}
        </option>
      ))}
    </select>
  );
}
