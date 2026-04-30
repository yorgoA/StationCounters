import type { Customer, Region } from "@/types";

export const REGION_OPTIONS: Region[] = ["MRAH_GHANEM", "PRINTANIA"];
export const REGION_FILTER_OPTIONS = ["ALL", ...REGION_OPTIONS] as const;
export type RegionFilter = (typeof REGION_FILTER_OPTIONS)[number];

export function formatRegion(region: Region | RegionFilter): string {
  if (region === "MRAH_GHANEM") return "Mrah Ghanem";
  if (region === "PRINTANIA") return "Printania";
  return "All regions";
}

export function parseRegionFilter(raw: string | undefined): RegionFilter {
  if (raw === "MRAH_GHANEM" || raw === "PRINTANIA") return raw;
  return "ALL";
}

export function customerMatchesRegion(customer: Customer, filter: RegionFilter): boolean {
  if (filter === "ALL") return true;
  return customer.region === filter;
}
