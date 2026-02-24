import { describe, expect, test } from "vitest";

import { parsePlacementsSpec } from "../../src/client/manual-check-utils.js";

describe("parsePlacementsSpec", () => {
  test("valid specを正規化してcell昇順で返す", () => {
    const placements = parsePlacementsSpec("5:ranger,0:vanguard,4:mage");

    expect(placements).toEqual([
      { cell: 0, unitType: "vanguard" },
      { cell: 4, unitType: "mage" },
      { cell: 5, unitType: "ranger" },
    ]);
  });

  test("空specは空配列を返す", () => {
    expect(parsePlacementsSpec("")).toEqual([]);
    expect(parsePlacementsSpec("   ")).toEqual([]);
  });

  test("duplicate cellはエラー", () => {
    expect(() => parsePlacementsSpec("0:vanguard,0:ranger")).toThrow("duplicate cell");
  });

  test("cell範囲外はエラー", () => {
    expect(() => parsePlacementsSpec("8:vanguard")).toThrow("cell must be integer 0-7");
  });

  test("未知unitTypeはエラー", () => {
    expect(() => parsePlacementsSpec("0:healer")).toThrow("invalid unitType");
  });

  test("9体以上はエラー", () => {
    expect(() =>
      parsePlacementsSpec(
        "0:vanguard,1:vanguard,2:vanguard,3:vanguard,4:ranger,5:ranger,6:mage,7:assassin,0:mage",
      ),
    ).toThrow("placements must be <= 8");
  });
});
