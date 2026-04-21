import { describe, expect, test } from "vitest";

import {
  parseAutoDelayMs,
  parseAutoFillBots,
  parseAutoFlag,
  parseBoardUnitToken,
  parsePlacementsSpec,
  formatCombatLogForDisplay,
  formatSynergyDisplay,
  displayBattleResult,
  displaySynergies,
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

describe("parseBoardUnitToken", () => {
  test("cell:unitTypeはunitLevel=1として解析する", () => {
    expect(parseBoardUnitToken("0:vanguard")).toEqual({
      cell: 0,
      unitType: "vanguard",
      unitLevel: 1,
    });
  });

  test("cell:unitType:unitLevelを正しく解析する", () => {
    expect(parseBoardUnitToken("7:assassin:3")).toEqual({
      cell: 7,
      unitType: "assassin",
      unitLevel: 3,
    });
  });

  test("cell:unitType:unitLevel:subを正しく解析する", () => {
    expect(parseBoardUnitToken("0:vanguard:1:sub")).toEqual({
      cell: 0,
      unitType: "vanguard",
      unitLevel: 1,
      subUnitActive: true,
    });
  });

  test("不正フォーマットはnullを返す", () => {
    expect(parseBoardUnitToken("vanguard:2")).toBeNull();
    expect(parseBoardUnitToken("0:vanguard:sub")).toBeNull();
    expect(parseBoardUnitToken("8:vanguard:2")).toBeNull();
    expect(parseBoardUnitToken("0:vanguard:0")).toBeNull();
    expect(parseBoardUnitToken("")).toBeNull();
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

describe("parseAutoFillBots", () => {
  test("0から3までの範囲を返す", () => {
    expect(parseAutoFillBots("0")).toBe(0);
    expect(parseAutoFillBots("1")).toBe(1);
    expect(parseAutoFillBots("3")).toBe(3);
  });

  test("未指定や不正値は0に丸める", () => {
    expect(parseAutoFillBots("")).toBe(0);
    expect(parseAutoFillBots("abc")).toBe(0);
    expect(parseAutoFillBots("-1")).toBe(0);
    expect(parseAutoFillBots(undefined)).toBe(0);
  });

  test("上限を超える値は3に丸める", () => {
    expect(parseAutoFillBots("5")).toBe(3);
  });
});

describe("formatCombatLogForDisplay", () => {
  test("戦闘ログを改行で結合する", () => {
    const combatLog = [
      "Battle started",
      "Left units: 3",
      "Right units: 3",
      "Battle ended: Left wins",
    ];
    const result = formatCombatLogForDisplay(combatLog);
    expect(result).toBe("Battle started\nLeft units: 3\nRight units: 3\nBattle ended: Left wins");
  });

  test("空のログは空文字列を返す", () => {
    expect(formatCombatLogForDisplay([])).toBe("");
  });
});

describe("formatSynergyDisplay", () => {
  test("シナジー情報をフォーマットする", () => {
    const synergyDetails = {
      countsByType: { vanguard: 3, ranger: 2, mage: 0, assassin: 1 },
      activeTiers: { vanguard: 1, ranger: 0, mage: 0, assassin: 0 },
    };
    const result = formatSynergyDisplay(synergyDetails);
    expect(result).toContain("vanguard: 3体 ★");
    expect(result).toContain("ranger: 2体 ");
    expect(result).toContain("assassin: 1体 ");
    expect(result).not.toContain("mage");
  });

  test("全てのシナジーが0の場合は空を返す", () => {
    const synergyDetails = {
      countsByType: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
      activeTiers: { vanguard: 0, ranger: 0, mage: 0, assassin: 0 },
    };
    expect(formatSynergyDisplay(synergyDetails)).toBe("");
  });
});

describe("displayBattleResult", () => {
  test("戦闘結果を表示用にフォーマットする", () => {
    const result = {
      winner: "left" as const,
      leftSurvivors: [
        { id: "left-vanguard-0", type: "vanguard", hp: 50, maxHp: 80 },
      ],
      rightSurvivors: [],
      combatLog: ["Battle started", "Left Vanguard attacks Right Ranger"],
      durationMs: 1500,
    };
    const formatted = displayBattleResult(result);
    expect(formatted).toContain("=== Battle Result ===");
    expect(formatted).toContain("Winner: left");
    expect(formatted).toContain("Survivors: 1 vs 0");
    expect(formatted).toContain("=== Combat Log ===");
    expect(formatted).toContain("Battle started");
  });

  test("戦闘ログが20行以上の場合は最後の20行のみ表示", () => {
    const longLog = Array.from({ length: 25 }, (_, i) => `Log line ${i + 1}`);
    const result = {
      winner: "right" as const,
      leftSurvivors: [],
      rightSurvivors: [{ id: "right-ranger-0", type: "ranger", hp: 30, maxHp: 50 }],
      combatLog: longLog,
      durationMs: 1000,
    };
    const formatted = displayBattleResult(result);
    // 正規表現で行頭の"Log line 1"のみチェック（"Log line 10"などにマッチしないように）
    expect(formatted).not.toMatch(/^Log line 1$/m);
    expect(formatted).toContain("Log line 6"); // 最後の20行の最初
    expect(formatted).toContain("Log line 25");
  });
});

describe("displaySynergies", () => {
  test("配置からシナジー情報を表示する", () => {
    const placements = [
      { unitType: "vanguard" },
      { unitType: "vanguard" },
      { unitType: "vanguard" },
      { unitType: "ranger" },
      { unitType: "ranger" },
    ];
    const result = displaySynergies(placements);
    expect(result).toContain("Active Synergies:");
    expect(result).toContain("vanguard: 3体 ★");
    expect(result).not.toContain("ranger"); // 2体なのでアクティブではない
  });

  test("9体のシナジーはTier3になる", () => {
    const placements = Array.from({ length: 9 }, () => ({ unitType: "vanguard" }));
    const result = displaySynergies(placements);
    expect(result).toContain("vanguard: 9体 ★★★");
  });

  test("6体のシナジーはTier2になる", () => {
    const placements = Array.from({ length: 6 }, () => ({ unitType: "ranger" }));
    const result = displaySynergies(placements);
    expect(result).toContain("ranger: 6体 ★★");
  });

  test("空の配置はActive Synergiesのみ返す", () => {
    const result = displaySynergies([]);
    expect(result).toBe("Active Synergies:");
  });
});
