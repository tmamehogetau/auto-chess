import { describe, expect, test } from "vitest";

import {
  parseAutoDelayMs,
  parseAutoFlag,
  parsePlacementsSpec,
} from "../../src/client/manual-check-utils.js";

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

describe("parseAutoFlag", () => {
  test("1またはtrueをtrueとして扱う", () => {
    expect(parseAutoFlag("1")).toBe(true);
    expect(parseAutoFlag("true")).toBe(true);
    expect(parseAutoFlag(" TRUE ")).toBe(true);
  });

  test("それ以外はfalse", () => {
    expect(parseAutoFlag("0")).toBe(false);
    expect(parseAutoFlag("false")).toBe(false);
    expect(parseAutoFlag(undefined)).toBe(false);
    expect(parseAutoFlag(null)).toBe(false);
  });
});

describe("parseAutoDelayMs", () => {
  test("有効な遅延値を返す", () => {
    expect(parseAutoDelayMs("0")).toBe(0);
    expect(parseAutoDelayMs("250")).toBe(250);
    expect(parseAutoDelayMs("30000")).toBe(30000);
  });

  test("未指定や不正値はデフォルト300ms", () => {
    expect(parseAutoDelayMs("")).toBe(300);
    expect(parseAutoDelayMs("abc")).toBe(300);
    expect(parseAutoDelayMs("-1")).toBe(300);
    expect(parseAutoDelayMs(undefined)).toBe(300);
  });

  test("上限を超える値は30000msに丸める", () => {
    expect(parseAutoDelayMs("50000")).toBe(30000);
  });
});
