import { describe, expect, test } from "vitest";

import {
  calculateSpecialUnitUpgradeCost,
  getSpecialUnitCombatMultiplier,
  getSpecialUnitUpgradeCost,
  upgradeSpecialUnitLevel,
} from "../../src/server/special-unit-level-config";

describe("special-unit-level-config", () => {
  test("default主人公のレベルアップコストは spec の段階表を使う", () => {
    expect(getSpecialUnitUpgradeCost(0)).toBeNull();
    expect(getSpecialUnitUpgradeCost(1)).toBe(2);
    expect(getSpecialUnitUpgradeCost(2)).toBe(2);
    expect(getSpecialUnitUpgradeCost(3)).toBe(3);
    expect(getSpecialUnitUpgradeCost(4)).toBe(4);
    expect(getSpecialUnitUpgradeCost(5)).toBe(6);
    expect(getSpecialUnitUpgradeCost(6)).toBe(9);
    expect(getSpecialUnitUpgradeCost(7)).toBeNull();
  });

  test("女苑は各段階で通常主人公より 1G 重い例外コストを使う", () => {
    expect(getSpecialUnitUpgradeCost(1, "jyoon")).toBe(3);
    expect(getSpecialUnitUpgradeCost(2, "jyoon")).toBe(3);
    expect(getSpecialUnitUpgradeCost(3, "jyoon")).toBe(4);
    expect(getSpecialUnitUpgradeCost(4, "jyoon")).toBe(5);
    expect(getSpecialUnitUpgradeCost(5, "jyoon")).toBe(7);
    expect(getSpecialUnitUpgradeCost(6, "jyoon")).toBe(10);
    expect(getSpecialUnitUpgradeCost(7, "jyoon")).toBeNull();
  });

  test("複数回強化コストは段階コストを順番に合算する", () => {
    expect(calculateSpecialUnitUpgradeCost(1, 3)).toBe(7);
    expect(calculateSpecialUnitUpgradeCost(4, 3)).toBe(19);
    expect(calculateSpecialUnitUpgradeCost(1, 6)).toBe(26);
  });

  test("女苑の複数回強化コストも専用テーブルで合算する", () => {
    expect(calculateSpecialUnitUpgradeCost(1, 3, "jyoon")).toBe(10);
    expect(calculateSpecialUnitUpgradeCost(4, 3, "jyoon")).toBe(22);
    expect(calculateSpecialUnitUpgradeCost(1, 6, "jyoon")).toBe(32);
  });

  test("default主人公の combat multiplier は spec の後半重めカーブを使う", () => {
    expect(getSpecialUnitCombatMultiplier(1)).toBe(1);
    expect(getSpecialUnitCombatMultiplier(2)).toBe(1.15);
    expect(getSpecialUnitCombatMultiplier(3)).toBe(1.3);
    expect(getSpecialUnitCombatMultiplier(4)).toBe(1.55);
    expect(getSpecialUnitCombatMultiplier(5)).toBe(1.95);
    expect(getSpecialUnitCombatMultiplier(6)).toBe(2.4);
    expect(getSpecialUnitCombatMultiplier(7)).toBe(3);
    expect(getSpecialUnitCombatMultiplier(99)).toBe(1);
  });

  test("女苑は専用の高伸び combat multiplier を使う", () => {
    expect(getSpecialUnitCombatMultiplier(1, "jyoon")).toBe(1);
    expect(getSpecialUnitCombatMultiplier(2, "jyoon")).toBe(1.2);
    expect(getSpecialUnitCombatMultiplier(3, "jyoon")).toBe(1.4);
    expect(getSpecialUnitCombatMultiplier(4, "jyoon")).toBe(1.75);
    expect(getSpecialUnitCombatMultiplier(5, "jyoon")).toBe(2.25);
    expect(getSpecialUnitCombatMultiplier(6, "jyoon")).toBe(2.85);
    expect(getSpecialUnitCombatMultiplier(7, "jyoon")).toBe(3.6);
    expect(getSpecialUnitCombatMultiplier(99, "jyoon")).toBe(1);
  });

  test("special unit level は Lv7 cap を超えない範囲だけ進められる", () => {
    expect(upgradeSpecialUnitLevel(1, 3)).toBe(4);
    expect(upgradeSpecialUnitLevel(4, 3)).toBe(7);
    expect(upgradeSpecialUnitLevel(6, 2)).toBeNull();
    expect(upgradeSpecialUnitLevel(0, 1)).toBeNull();
  });
});
