import { describe, expect, test } from "vitest";

import {
  DEFAULT_UNIT_EFFECT_SET_ID,
  UNIT_EFFECT_TABLE,
  VALID_UNIT_TYPES,
  getUnitEffectTable,
  isUnitEffectSetId,
} from "../../../src/server/combat/unit-effect-definitions";

describe("unit-effect-definitions", () => {
  test("4ユニット分の効果テーブルが定義されている", () => {
    expect(Object.keys(UNIT_EFFECT_TABLE).sort()).toEqual([
      "assassin",
      "mage",
      "ranger",
      "vanguard",
    ]);
  });

  test("VALID_UNIT_TYPESが効果テーブルと一致する", () => {
    expect(Array.from(VALID_UNIT_TYPES).sort()).toEqual(
      Object.keys(UNIT_EFFECT_TABLE).sort(),
    );
  });

  test("デフォルトセットはset1である", () => {
    expect(DEFAULT_UNIT_EFFECT_SET_ID).toBe("set1");
  });

  test("set2はrangerスキル条件がset1と異なる", () => {
    const set1Table = getUnitEffectTable("set1");
    const set2Table = getUnitEffectTable("set2");

    expect(set1Table.ranger.skill?.activation).toBe("all-back-with-mage-spotter");
    expect(set2Table.ranger.skill?.activation).toBe("all-back");
  });

  test("isUnitEffectSetIdは有効なセットIDのみtrueを返す", () => {
    expect(isUnitEffectSetId("set1")).toBe(true);
    expect(isUnitEffectSetId("set2")).toBe(true);
    expect(isUnitEffectSetId("set3")).toBe(false);
    expect(isUnitEffectSetId(undefined)).toBe(false);
  });
});
