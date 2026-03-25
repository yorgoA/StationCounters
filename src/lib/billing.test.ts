import { describe, expect, it } from "vitest";
import type { AmperePriceTier, BillingType } from "@/types";
import {
  calcBillFromReadings,
  calcEffectiveDiscount,
  calcPaymentStatus,
  calcTotalAfterDiscount,
  calcTotalBeforeDiscount,
  calcUsageKwh,
  getAmperePriceForTier,
} from "./billing";

describe("billing calculations (QA)", () => {
  it("calcUsageKwh clamps negative usage to 0", () => {
    // Given a meter that "went backwards"
    expect(calcUsageKwh(100, 90)).toBe(0);
    // When meter increases
    expect(calcUsageKwh(100, 130)).toBe(30);
  });

  it("getAmperePriceForTier uses nearest lower tier (and sorts input)", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 5, price: 500 },
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
    ];

    // Exact match
    expect(getAmperePriceForTier(4, tiers)).toBe(400);
    // Nearest lower tier <= subscribedAmpere
    expect(getAmperePriceForTier(6, tiers)).toBe(500);
    // Below minimum tier => lowest tier price
    expect(getAmperePriceForTier(2, tiers)).toBe(300);
  });

  it("getAmperePriceForTier returns 0 when tiers are empty", () => {
    expect(getAmperePriceForTier(10, [])).toBe(0);
  });

  it("calcEffectiveDiscount: fixed amount takes precedence over percent", () => {
    const totalBefore = 1000;
    expect(calcEffectiveDiscount(totalBefore, 200, 50)).toBe(200);
  });

  it("calcEffectiveDiscount: percent is rounded and clamped to total", () => {
    expect(calcEffectiveDiscount(1000, 0, 10)).toBe(100); // round(1000 * 0.1)
    expect(calcEffectiveDiscount(1000, 0, 200)).toBe(1000); // clamp to total
  });

  it("calcTotalAfterDiscount never returns negative totals", () => {
    expect(calcTotalAfterDiscount(100, 250, 0)).toBe(0);
  });

  it("calcPaymentStatus: PAID wins when remainingDue <= 0", () => {
    expect(calcPaymentStatus(0, -1)).toBe("PAID");
    expect(calcPaymentStatus(100, 0)).toBe("PAID");
  });

  it("calcPaymentStatus: PARTIAL when some paid but still due", () => {
    expect(calcPaymentStatus(10, 50)).toBe("PARTIAL");
  });

  it("calcPaymentStatus: UNPAID when no paid and still due", () => {
    expect(calcPaymentStatus(0, 50)).toBe("UNPAID");
  });

  it("calcTotalBeforeDiscount sums charges + previous unpaid balance", () => {
    expect(calcTotalBeforeDiscount(100, 200, 50)).toBe(350);
  });

  it("calcBillFromReadings (FREE) always results in a $0 bill (discount ignores previous balance)", () => {
    const tiers: AmperePriceTier[] = [{ amp: 3, price: 300 }];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      3,
      "FREE",
      999,
      123,
      50,
      tiers,
      10,
      500
    );

    expect(bill.usageKwh).toBe(30);
    expect(bill.previousUnpaidBalance).toBe(0); // FREE ignores previous balance
    expect(bill.totalDue).toBe(0);
    expect(bill.remainingDue).toBe(0);
    expect(bill.paymentStatus).toBe("PAID");
    expect(bill.discountApplied).toBe(0);
  });

  it("calcBillFromReadings (FIXED_MONTHLY) ignores discounts and uses fixed price + previous balance", () => {
    const tiers: AmperePriceTier[] = [{ amp: 10, price: 999 }];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      10,
      "FIXED_MONTHLY",
      500,
      300, // should be ignored
      50, // should be ignored
      tiers,
      10, // irrelevant for FIXED_MONTHLY
      100 // previous unpaid balance
    );

    expect(bill.ampereCharge).toBe(0);
    expect(bill.consumptionCharge).toBe(0);
    expect(bill.discountApplied).toBe(0);
    expect(bill.totalDue).toBe(600);
    expect(bill.remainingDue).toBe(600);
    expect(bill.paymentStatus).toBe("UNPAID");
  });

  it("calcBillFromReadings (BOTH) applies ampere + kWh, then fixed discount", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
      { amp: 5, price: 500 },
    ];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      4,
      "BOTH" as BillingType,
      0,
      100, // fixed discount amount
      0,
      tiers,
      10, // kWh price
      50 // previous unpaid balance
    );

    // usageKwh = 30
    // ampereCharge = 400
    // consumptionCharge = round(30 * 10) = 300
    // totalBefore = 400 + 300 + 50 = 750
    // discount = 100 => totalDue = 650
    expect(bill.usageKwh).toBe(30);
    expect(bill.ampereCharge).toBe(400);
    expect(bill.consumptionCharge).toBe(300);
    expect(bill.discountApplied).toBe(100);
    expect(bill.totalDue).toBe(650);
    expect(bill.remainingDue).toBe(650);
    expect(bill.paymentStatus).toBe("UNPAID");
  });

  it("calcBillFromReadings (KWH_ONLY) uses only kWh and applies fixed percent discount", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
      { amp: 5, price: 500 },
    ];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      4,
      "KWH_ONLY" as BillingType,
      0,
      0, // fixed discount amount
      10, // fixed percent discount
      tiers,
      10, // kWh price
      50 // previous unpaid balance
    );

    // usageKwh = 30
    // ampereCharge = 0
    // consumptionCharge = round(30 * 10) = 300
    // totalBefore = 0 + 300 + 50 = 350
    // discount = round(350 * 0.1) = 35
    expect(bill.ampereCharge).toBe(0);
    expect(bill.consumptionCharge).toBe(300);
    expect(bill.discountApplied).toBe(35);
    expect(bill.totalDue).toBe(315);
    expect(bill.paymentStatus).toBe("UNPAID");
  });

  it("calcBillFromReadings (AMPERE_ONLY) uses only ampere tier and fixed amount discount", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
      { amp: 5, price: 500 },
    ];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      5,
      "AMPERE_ONLY" as BillingType,
      0,
      100, // fixed amount discount
      0,
      tiers,
      999, // irrelevant for AMPERE_ONLY
      0
    );

    expect(bill.usageKwh).toBe(30);
    expect(bill.ampereCharge).toBe(500);
    expect(bill.consumptionCharge).toBe(0);
    expect(bill.discountApplied).toBe(100);
    expect(bill.totalDue).toBe(400);
    expect(bill.paymentStatus).toBe("UNPAID");
  });
});

import { describe, expect, it } from "vitest";
import type { AmperePriceTier, BillingType } from "@/types";
import {
  calcBillFromReadings,
  calcEffectiveDiscount,
  calcPaymentStatus,
  calcTotalAfterDiscount,
  calcTotalBeforeDiscount,
  calcUsageKwh,
  getAmperePriceForTier,
} from "./billing";

describe("billing calculations", () => {
  it("calcUsageKwh clamps negative usage to 0", () => {
    expect(calcUsageKwh(100, 90)).toBe(0);
    expect(calcUsageKwh(100, 130)).toBe(30);
  });

  it("getAmperePriceForTier uses nearest lower tier (and sorts input)", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 5, price: 500 },
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
    ];

    expect(getAmperePriceForTier(4, tiers)).toBe(400); // exact match
    expect(getAmperePriceForTier(6, tiers)).toBe(500); // nearest lower (<= 6)
    expect(getAmperePriceForTier(2, tiers)).toBe(300); // below min => lowest tier price
  });

  it("getAmperePriceForTier returns 0 when tiers are empty", () => {
    expect(getAmperePriceForTier(10, [])).toBe(0);
  });

  it("calcEffectiveDiscount: fixed amount takes precedence over percent", () => {
    const totalBefore = 1000;
    const fixedAmount = 200;
    const fixedPercent = 50;

    // fixed amount (200) should win even though 50% would be larger
    expect(calcEffectiveDiscount(totalBefore, fixedAmount, fixedPercent)).toBe(200);
  });

  it("calcEffectiveDiscount: percent is rounded and clamped", () => {
    expect(calcEffectiveDiscount(1000, 0, 10)).toBe(100); // round(1000 * 0.1)
    expect(calcEffectiveDiscount(1000, 0, 200)).toBe(1000); // clamp to total
  });

  it("calcTotalAfterDiscount never returns negative totals", () => {
    expect(calcTotalAfterDiscount(100, 250, 0)).toBe(0);
  });

  it("calcPaymentStatus", () => {
    expect(calcPaymentStatus(0, -1)).toBe("PAID");
    expect(calcPaymentStatus(10, 50)).toBe("PARTIAL");
    expect(calcPaymentStatus(0, 50)).toBe("UNPAID");
  });

  it("calcTotalBeforeDiscount sums charges + previous unpaid balance", () => {
    expect(calcTotalBeforeDiscount(100, 200, 50)).toBe(350);
  });

  it("calcBillFromReadings (FREE) always results in a $0 bill", () => {
    const tiers: AmperePriceTier[] = [{ amp: 3, price: 300 }];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      3,
      "FREE",
      999,
      123,
      50,
      tiers,
      10,
      500
    );

    expect(bill.usageKwh).toBe(30);
    expect(bill.ampereCharge).toBe(0);
    expect(bill.consumptionCharge).toBe(0);
    expect(bill.previousUnpaidBalance).toBe(0); // FREE ignores previous balance
    expect(bill.totalDue).toBe(0);
    expect(bill.remainingDue).toBe(0);
    expect(bill.paymentStatus).toBe("PAID");
    expect(bill.discountApplied).toBe(0);
  });

  it("calcBillFromReadings (FIXED_MONTHLY) ignores discounts and uses fixed price + previous balance", () => {
    const tiers: AmperePriceTier[] = [{ amp: 10, price: 999 }];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      10,
      "FIXED_MONTHLY",
      500,
      300, // should be ignored
      50, // should be ignored
      tiers,
      10,
      100
    );

    expect(bill.ampereCharge).toBe(0);
    expect(bill.consumptionCharge).toBe(0);
    expect(bill.discountApplied).toBe(0);
    expect(bill.totalDue).toBe(600);
    expect(bill.remainingDue).toBe(600);
    expect(bill.paymentStatus).toBe("UNPAID");
  });

  it("calcBillFromReadings (BOTH) applies ampere + kWh, then fixed discount", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
      { amp: 5, price: 500 },
    ];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      4,
      "BOTH" as BillingType,
      0,
      100, // fixed discount amount
      0,
      tiers,
      10, // kWh price
      50 // previous unpaid balance
    );

    // usageKwh = 30
    // ampereCharge = 400
    // consumptionCharge = round(30 * 10) = 300
    // totalBefore = 400 + 300 + 50 = 750
    // discount = 100 => totalDue = 650
    expect(bill.usageKwh).toBe(30);
    expect(bill.ampereCharge).toBe(400);
    expect(bill.consumptionCharge).toBe(300);
    expect(bill.discountApplied).toBe(100);
    expect(bill.totalDue).toBe(650);
    expect(bill.remainingDue).toBe(650);
    expect(bill.paymentStatus).toBe("UNPAID");
  });

  it("calcBillFromReadings (KWH_ONLY) uses only kWh and applies fixed percent discount", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
      { amp: 5, price: 500 },
    ];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      4,
      "KWH_ONLY" as BillingType,
      0,
      0,
      10, // 10% percent discount
      tiers,
      10, // kWh price
      50 // previous unpaid balance
    );

    // usageKwh = 30
    // ampereCharge = 0
    // consumptionCharge = round(30 * 10) = 300
    // totalBefore = 0 + 300 + 50 = 350
    // discount = round(350 * 0.1) = 35
    // totalDue = 315
    expect(bill.ampereCharge).toBe(0);
    expect(bill.consumptionCharge).toBe(300);
    expect(bill.discountApplied).toBe(35);
    expect(bill.totalDue).toBe(315);
    expect(bill.paymentStatus).toBe("UNPAID");
  });

  it("calcBillFromReadings (AMPERE_ONLY) uses only ampere tier and fixed amount discount", () => {
    const tiers: AmperePriceTier[] = [
      { amp: 3, price: 300 },
      { amp: 4, price: 400 },
      { amp: 5, price: 500 },
    ];

    const bill = calcBillFromReadings(
      "c1",
      "2026-03",
      100,
      130,
      5,
      "AMPERE_ONLY" as BillingType,
      0,
      100, // fixed amount discount
      0,
      tiers,
      999, // irrelevant for AMPERE_ONLY
      0
    );

    expect(bill.usageKwh).toBe(30);
    expect(bill.ampereCharge).toBe(500);
    expect(bill.consumptionCharge).toBe(0);
    expect(bill.discountApplied).toBe(100);
    expect(bill.totalDue).toBe(400);
    expect(bill.paymentStatus).toBe("UNPAID");
  });
});

