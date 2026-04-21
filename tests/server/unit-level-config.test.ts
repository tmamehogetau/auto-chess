import { describe, expect, test } from "vitest";

import {
  calculateSellValue,
  getMinimumPurchaseCountForUnitLevel,
  getUnitLevelCombatMultiplier,
  getUnitLevelForPurchaseCount,
} from "../../src/server/unit-level-config";

describe("unit-level-config", () => {
  test("purchase count は Lv7 cap 付きで unitLevel に変換される", () => {
    expect(getUnitLevelForPurchaseCount(0)).toBe(1);
    expect(getUnitLevelForPurchaseCount(1)).toBe(1);
    expect(getUnitLevelForPurchaseCount(2)).toBe(2);
    expect(getUnitLevelForPurchaseCount(4)).toBe(4);
    expect(getUnitLevelForPurchaseCount(7)).toBe(7);
    expect(getUnitLevelForPurchaseCount(99)).toBe(7);
  });

  test("unitLevel から最小 purchase count を逆算できる", () => {
    expect(getMinimumPurchaseCountForUnitLevel(0)).toBe(1);
    expect(getMinimumPurchaseCountForUnitLevel(1)).toBe(1);
    expect(getMinimumPurchaseCountForUnitLevel(4)).toBe(4);
    expect(getMinimumPurchaseCountForUnitLevel(7)).toBe(7);
    expect(getMinimumPurchaseCountForUnitLevel(99)).toBe(7);
  });

  test("combat multiplier は progression spec の倍率表を使う", () => {
    expect(getUnitLevelCombatMultiplier(1)).toBe(1);
    expect(getUnitLevelCombatMultiplier(2)).toBe(1.15);
    expect(getUnitLevelCombatMultiplier(3)).toBe(1.3);
    expect(getUnitLevelCombatMultiplier(4)).toBe(1.7);
    expect(getUnitLevelCombatMultiplier(5)).toBe(2.1);
    expect(getUnitLevelCombatMultiplier(6)).toBe(2.5);
    expect(getUnitLevelCombatMultiplier(7)).toBe(3);
    expect(getUnitLevelCombatMultiplier(99)).toBe(3);
  });

  test("sell value は Lv4/Lv7 でも旧 4回/7回 bucket の経済感を維持する", () => {
    expect(calculateSellValue(2, "mage", 1, 1)).toBe(1);
    expect(calculateSellValue(8, "mage", 4, 4)).toBe(3);
    expect(calculateSellValue(10, "mage", 5, 5)).toBe(3);
    expect(calculateSellValue(14, "mage", 7, 7)).toBe(6);
  });
});
