import { describe, expect, it } from "vitest";
import {
  rowToBill,
  rowToCustomerBillingHistory,
  billingHistoryToProfile,
} from "@/lib/sheets-utils";

describe("sheets-utils snapshots", () => {
  it("parses legacy bill row with snapshot defaults", () => {
    const legacy = [
      "bill_1",
      "cust_1",
      "2026-03",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "100",
      "0",
      "100",
      "UNPAID",
      "2026-03-01",
      "2026-03-01",
    ];
    const b = rowToBill(legacy);
    expect(b.billingTypeSnapshot).toBe("BOTH");
    expect(b.subscribedAmpereSnapshot).toBe(0);
    expect(b.fixedMonthlyPriceSnapshot).toBe(0);
  });

  it("maps billing history row into monthly profile", () => {
    const row = [
      "entry_1",
      "cust_1",
      "2026-04",
      "FIXED_MONTHLY",
      "10",
      "9000000",
      "0",
      "0",
      "false",
      "switch in april",
      "manager",
      "2026-04-01T00:00:00.000Z",
    ];
    const hist = rowToCustomerBillingHistory(row);
    const profile = billingHistoryToProfile(hist);
    expect(profile.monthKey).toBe("2026-04");
    expect(profile.billingType).toBe("FIXED_MONTHLY");
    expect(profile.fixedMonthlyPrice).toBe(9000000);
    expect(profile.isMonitor).toBe(false);
  });
});

