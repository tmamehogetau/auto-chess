/**
 * SpellCardHandler Unit Tests
 * Task 10: Extract spell card handling from match-room-controller
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SpellCardHandler } from "../../../src/server/match-room-controller/spell-card-handler";
import { type SpellCard, type SpellEffect } from "../../../src/data/spell-cards";
import type { MatchLogger } from "../../../src/server/match-logger";

// Mock the spell-cards module
vi.mock("../../../src/data/spell-cards", () => ({
  getAvailableSpellsForRound: vi.fn((roundIndex: number) => {
    if (roundIndex >= 1 && roundIndex <= 4) {
      return [
        {
          id: "instant-1",
          name: "紅符「スカーレットシュート」",
          description: "レイドメンバー全員に50ダメージを与える",
          roundRange: [1, 4],
          category: "instantLaser",
          effect: { type: "damage", target: "raid", value: 50 },
        },
        {
          id: "area-1",
          name: "紅符「不夜城レッド」",
          description: "レイドメンバー全員に40ダメージを与える",
          roundRange: [1, 4],
          category: "areaAttack",
          effect: { type: "damage", target: "raid", value: 40 },
        },
      ];
    }
    if (roundIndex >= 5 && roundIndex <= 8) {
      return [
        {
          id: "instant-2",
          name: "必殺「ハートブレイク」",
          description: "レイドメンバー全員に65ダメージを与える",
          roundRange: [5, 8],
          category: "instantLaser",
          effect: { type: "damage", target: "raid", value: 65 },
        },
      ];
    }
    return [];
  }),
  getSpellCardSetForRound: vi.fn((roundIndex: number) => {
    if (roundIndex >= 1 && roundIndex <= 4) {
      return [
        {
          id: "instant-1",
          name: "紅符「スカーレットシュート」",
          description: "レイドメンバー全員に50ダメージを与える",
          roundRange: [1, 4],
          category: "instantLaser",
          effect: { type: "damage", target: "raid", value: 50 },
        },
        {
          id: "area-1",
          name: "紅符「不夜城レッド」",
          description: "レイドメンバー全員に40ダメージを与える",
          roundRange: [1, 4],
          category: "areaAttack",
          effect: { type: "damage", target: "raid", value: 40 },
        },
        {
          id: "rush-1",
          name: "夜符「デーモンキングクレイドル」",
          description: "レイドメンバー全員に45ダメージを与える",
          roundRange: [1, 4],
          category: "rush",
          effect: { type: "damage", target: "raid", value: 45 },
        },
      ];
    }
    if (roundIndex >= 5 && roundIndex <= 8) {
      return [
        {
          id: "instant-2",
          name: "必殺「ハートブレイク」",
          description: "レイドメンバー全員に65ダメージを与える",
          roundRange: [5, 8],
          category: "instantLaser",
          effect: { type: "damage", target: "raid", value: 65 },
        },
      ];
    }
    if (roundIndex === 12) {
      return [
        {
          id: "last-word",
          name: "「紅色の幻想郷」",
          description: "レイドメンバー全員に100ダメージを与える",
          roundRange: [12, 12],
          category: "lastWord",
          effect: { type: "damage", target: "raid", value: 100 },
        },
      ];
    }
    return [];
  }),
}));

describe("SpellCardHandler", () => {
  let handler: SpellCardHandler;
  let mockLogger: MatchLogger;

  const createMockLogger = (): MatchLogger =>
    ({
      logSpellEffect: vi.fn(),
      logHpChange: vi.fn(),
    }) as unknown as MatchLogger;

  const createMockSpell = (overrides: Partial<SpellCard> = {}): SpellCard => ({
    id: "test-spell",
    name: "テストスペル",
    description: "テスト用スペル",
    roundRange: [1, 4],
    category: "instantLaser",
    effect: { type: "damage", target: "raid", value: 50 },
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = createMockLogger();
    handler = new SpellCardHandler({
      enableSpellCard: true,
      matchLogger: mockLogger,
    });
  });

  describe("constructor", () => {
    it("初期状態ではdeclaredSpellはnull", () => {
      expect(handler.getDeclaredSpell()).toBeNull();
    });

    it("初期状態ではusedSpellIdsは空配列", () => {
      expect(handler.getUsedSpellIds()).toEqual([]);
    });

    it("初期状態ではcombatModifiersは空のMap", () => {
      expect(handler.getCombatModifiersForPlayer("player1")).toBeNull();
    });

    it("feature flagが無効な場合でもハンドラは作成できる", () => {
      const disabledHandler = new SpellCardHandler({
        enableSpellCard: false,
        matchLogger: mockLogger,
      });
      expect(disabledHandler.getDeclaredSpell()).toBeNull();
    });

    it("setMatchLoggerでロガーを更新できる", () => {
      // Create handler without logger (simulating constructor-time capture)
      const handlerWithoutLogger = new SpellCardHandler({
        enableSpellCard: true,
        matchLogger: null,
      });

      // Set logger after construction
      const newMockLogger = createMockLogger();
      handlerWithoutLogger.setMatchLogger(newMockLogger);

      // Declare and apply spell to trigger logging
      handlerWithoutLogger.declareSpell(1);
      const playerHps = new Map<string, number>([
        ["boss", 100],
        ["player1", 100],
      ]);

      handlerWithoutLogger.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["boss", "player1"],
        bossPlayerId: "boss",
      });

      // Verify the new logger was called
      expect(newMockLogger.logSpellEffect).toHaveBeenCalled();
    });
  });

  describe("declareSpell", () => {
    it("有効なスペルがある場合、最初のスペルを宣言する", () => {
      handler.declareSpell(1);
      const spell = handler.getDeclaredSpell();
      expect(spell).not.toBeNull();
      expect(spell?.id).toBe("instant-1");
    });

    it("スペルがないラウンドではnullを設定する", () => {
      handler.declareSpell(100);
      expect(handler.getDeclaredSpell()).toBeNull();
    });

    it("feature flagが無効な場合、何もしない", () => {
      const disabledHandler = new SpellCardHandler({
        enableSpellCard: false,
        matchLogger: mockLogger,
      });
      disabledHandler.declareSpell(1);
      expect(disabledHandler.getDeclaredSpell()).toBeNull();
    });

    it("複数回呼ばれると最新のスペルで上書きされる", () => {
      handler.declareSpell(1);
      expect(handler.getDeclaredSpell()?.id).toBe("instant-1");

      // R5-8のスペルを宣言
      handler.declareSpell(5);
      expect(handler.getDeclaredSpell()?.id).toBe("instant-2");
    });

    it("ラウンド帯ごとに対応するスペルを宣言する", () => {
      handler.declareSpell(1);
      expect(handler.getDeclaredSpellId()).toBe("instant-1");

      handler.declareSpell(5);
      expect(handler.getDeclaredSpellId()).toBe("instant-2");

      handler.declareSpell(12);
      expect(handler.getDeclaredSpellId()).toBe("last-word");
    });

    it("同じラウンド帯ではラウンドごとに未使用スペルを順に宣言し、使い切るとnullになる", () => {
      handler.declareSpell(1);
      expect(handler.getDeclaredSpellId()).toBe("instant-1");

      handler.declareSpell(2);
      expect(handler.getDeclaredSpellId()).toBe("area-1");

      handler.declareSpell(3);
      expect(handler.getDeclaredSpellId()).toBe("rush-1");

      handler.declareSpell(4);
      expect(handler.getDeclaredSpellId()).toBeNull();
    });
  });

  describe("declareSpellById", () => {
    it("有効なスペルIDを宣言できる", () => {
      const result = handler.declareSpellById(1, "instant-1");
      expect(result).toBe(true);
      expect(handler.getDeclaredSpell()?.id).toBe("instant-1");
    });

    it("無効なスペルIDはfalseを返す", () => {
      const result = handler.declareSpellById(1, "invalid-spell");
      expect(result).toBe(false);
      expect(handler.getDeclaredSpell()).toBeNull();
    });

    it("feature flagが無効な場合はfalseを返す", () => {
      const disabledHandler = new SpellCardHandler({
        enableSpellCard: false,
        matchLogger: mockLogger,
      });
      const result = disabledHandler.declareSpellById(1, "instant-1");
      expect(result).toBe(false);
    });

    it("ラウンド範囲外のスペルIDはfalseを返す", () => {
      const result = handler.declareSpellById(5, "instant-1"); // instant-1はR1-4のみ
      expect(result).toBe(false);
    });

    it("使用済みスペルIDは再宣言できない", () => {
      expect(handler.declareSpellById(1, "instant-1")).toBe(true);
      expect(handler.declareSpellById(1, "instant-1")).toBe(false);
    });

    it("ID指定済みの同一ラウンドは自動宣言で上書きしない", () => {
      expect(handler.declareSpellById(1, "area-1")).toBe(true);

      handler.declareSpell(1);

      expect(handler.getDeclaredSpellId()).toBe("area-1");
    });
  });

  describe("getDeclaredSpellId", () => {
    it("宣言済みスペルのIDを取得できる", () => {
      handler.declareSpell(1);
      expect(handler.getDeclaredSpellId()).toBe("instant-1");
    });

    it("未宣言の場合はnullを返す", () => {
      expect(handler.getDeclaredSpellId()).toBeNull();
    });
  });

  describe("applySpellEffect - damage", () => {
    it("raid target damageは全プレイヤーにダメージを与える", () => {
      const spell = createMockSpell({
        id: "damage-raid",
        effect: { type: "damage", target: "raid", value: 30 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([
        ["player1", 100],
        ["player2", 100],
        ["player3", 100],
      ]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1", "player2", "player3"],
        bossPlayerId: "player1",
      });

      expect(playerHps.get("player2")).toBe(70);
      expect(playerHps.get("player3")).toBe(70);
      expect(playerHps.get("player1")).toBe(100); // bossは除外
    });

    it("boss target damageはボスのみにダメージを与える", () => {
      const spell = createMockSpell({
        id: "damage-boss",
        effect: { type: "damage", target: "boss", value: 30 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([
        ["player1", 100],
        ["player2", 100],
      ]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1", "player2"],
        bossPlayerId: "player1",
      });

      expect(playerHps.get("player1")).toBe(70);
      expect(playerHps.get("player2")).toBe(100);
    });

    it("all target damageは全員にダメージを与える", () => {
      const spell = createMockSpell({
        id: "damage-all",
        effect: { type: "damage", target: "all", value: 20 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([
        ["player1", 100],
        ["player2", 100],
      ]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1", "player2"],
        bossPlayerId: "player1",
      });

      expect(playerHps.get("player1")).toBe(80);
      expect(playerHps.get("player2")).toBe(80);
    });

    it("ダメージ適用後、スペルIDがusedSpellIdsに追加される", () => {
      const spell = createMockSpell({ id: "test-damage" });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([["player1", 100]]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(handler.getUsedSpellIds()).toContain("test-damage");
    });

    it("同じスペルを複数回適用してもusedSpellIdsに重複しない", () => {
      const spell = createMockSpell({ id: "test-damage" });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([["player1", 100]]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      handler.setDeclaredSpell(spell);
      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(handler.getUsedSpellIds().filter((id) => id === "test-damage").length).toBe(1);
    });

    it("spell loggerにログが記録される", () => {
      const spell = createMockSpell({
        id: "logged-spell",
        name: "ログ用スペル",
        effect: { type: "damage", target: "raid", value: 50 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([["player1", 100]]);

      handler.applySpellEffect({
        roundIndex: 3,
        playerHps,
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(mockLogger.logSpellEffect).toHaveBeenCalledWith(
        3,
        "logged-spell",
        "ログ用スペル",
        "damage",
        "raid",
        50,
        50
      );
    });
  });

  describe("applySpellEffect - heal", () => {
    it("raid target healは全プレイヤーを回復する（上限100）", () => {
      const spell = createMockSpell({
        id: "heal-raid",
        effect: { type: "heal", target: "raid", value: 30 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([
        ["player1", 100],
        ["player2", 50],
        ["player3", 80],
      ]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1", "player2", "player3"],
        bossPlayerId: "player1",
      });

      expect(playerHps.get("player1")).toBe(100); // 上限
      expect(playerHps.get("player2")).toBe(80);
      expect(playerHps.get("player3")).toBe(100); // 上限
    });

    it("boss target healはボスのみ回復する", () => {
      const spell = createMockSpell({
        id: "heal-boss",
        effect: { type: "heal", target: "boss", value: 20 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([
        ["player1", 50],
        ["player2", 50],
      ]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1", "player2"],
        bossPlayerId: "player1",
      });

      expect(playerHps.get("player1")).toBe(70);
      expect(playerHps.get("player2")).toBe(50);
    });
  });

  describe("applySpellEffect - feature flag", () => {
    it("feature flagが無効な場合、何もしない", () => {
      const disabledHandler = new SpellCardHandler({
        enableSpellCard: false,
        matchLogger: mockLogger,
      });

      const spell = createMockSpell({
        id: "disabled-spell",
        effect: { type: "damage", target: "all", value: 50 },
      });
      disabledHandler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([["player1", 100]]);

      disabledHandler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(playerHps.get("player1")).toBe(100); // 変化なし
    });

    it("declaredSpellがnullの場合、何もしない", () => {
      const playerHps: Map<string, number> = new Map([["player1", 100]]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(playerHps.get("player1")).toBe(100);
    });
  });

  describe("applyPreBattleSpellEffect", () => {
    it("buff spellはcombatModifiersに倍率を設定する", () => {
      const spell = createMockSpell({
        id: "buff-attack",
        effect: { type: "buff", target: "raid", value: 1.25, buffStat: "attack" },
      });
      handler.setDeclaredSpell(spell);

      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1", "player2"],
        bossPlayerId: "player1",
      });

      const player1Mod = handler.getCombatModifiersForPlayer("player1");
      const player2Mod = handler.getCombatModifiersForPlayer("player2");

      expect(player1Mod).toBeNull(); // bossは除外
      expect(player2Mod).toEqual({
        attackMultiplier: 1.25,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 1,
      });
    });

    it("debuff spellはcombatModifiersに倍率を設定する", () => {
      const spell = createMockSpell({
        id: "debuff-speed",
        effect: { type: "debuff", target: "boss", value: 0.7, buffStat: "attackSpeed" },
      });
      handler.setDeclaredSpell(spell);

      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1", "player2"],
        bossPlayerId: "player1",
      });

      const player1Mod = handler.getCombatModifiersForPlayer("player1");
      const player2Mod = handler.getCombatModifiersForPlayer("player2");

      expect(player1Mod).toEqual({
        attackMultiplier: 1,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 0.7,
      });
      expect(player2Mod).toBeNull();
    });

    it("all targetは全プレイヤーに適用", () => {
      const spell = createMockSpell({
        id: "buff-all",
        effect: { type: "buff", target: "all", value: 1.5, buffStat: "defense" },
      });
      handler.setDeclaredSpell(spell);

      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1", "player2"],
        bossPlayerId: "player1",
      });

      const player1Mod = handler.getCombatModifiersForPlayer("player1");
      const player2Mod = handler.getCombatModifiersForPlayer("player2");

      expect(player1Mod?.defenseMultiplier).toBe(1.5);
      expect(player2Mod?.defenseMultiplier).toBe(1.5);
    });

    it("複数回適用すると前回の値が上書きされる", () => {
      // 1回目の適用
      const spell1 = createMockSpell({
        id: "buff-attack-1",
        effect: { type: "buff", target: "all", value: 1.5, buffStat: "attack" },
      });
      handler.setDeclaredSpell(spell1);
      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(handler.getCombatModifiersForPlayer("player1")?.attackMultiplier).toBe(1.5);

      // 2回目の適用（前回の値を上書き）
      const spell2 = createMockSpell({
        id: "buff-attack-2",
        effect: { type: "buff", target: "all", value: 2.0, buffStat: "attack" },
      });
      handler.setDeclaredSpell(spell2);
      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      // 前回の値がクリアされて新しい値になる
      const mod = handler.getCombatModifiersForPlayer("player1");
      expect(mod?.attackMultiplier).toBe(2.0);
    });

    it("feature flagが無効な場合、何もしない", () => {
      const disabledHandler = new SpellCardHandler({
        enableSpellCard: false,
        matchLogger: mockLogger,
      });

      const spell = createMockSpell({
        id: "buff-disabled",
        effect: { type: "buff", target: "all", value: 2.0, buffStat: "attack" },
      });
      disabledHandler.setDeclaredSpell(spell);

      disabledHandler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(disabledHandler.getCombatModifiersForPlayer("player1")).toBeNull();
    });

    it("clearCombatModifiersでmodifiersがクリアされる", () => {
      const spell = createMockSpell({
        id: "buff-clear",
        effect: { type: "buff", target: "all", value: 1.5, buffStat: "attack" },
      });
      handler.setDeclaredSpell(spell);

      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(handler.getCombatModifiersForPlayer("player1")).not.toBeNull();

      handler.clearCombatModifiers();

      expect(handler.getCombatModifiersForPlayer("player1")).toBeNull();
    });
  });

  describe("clearDeclaredSpell", () => {
    it("宣言中のスペルをクリアできる", () => {
      handler.declareSpell(1);
      expect(handler.getDeclaredSpell()).not.toBeNull();

      handler.clearDeclaredSpell();
      expect(handler.getDeclaredSpell()).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("bossPlayerIdがnullの場合、boss targetは無視される", () => {
      const spell = createMockSpell({
        id: "boss-spell",
        effect: { type: "damage", target: "boss", value: 50 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([
        ["player1", 100],
        ["player2", 100],
      ]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: ["player1", "player2"],
        bossPlayerId: null,
      });

      // bossがいないので誰もダメージを受けない
      expect(playerHps.get("player1")).toBe(100);
      expect(playerHps.get("player2")).toBe(100);
    });

    it("alivePlayerIdsが空の場合、raid targetは無視される", () => {
      const spell = createMockSpell({
        id: "raid-spell",
        effect: { type: "damage", target: "raid", value: 50 },
      });
      handler.setDeclaredSpell(spell);

      const playerHps: Map<string, number> = new Map([["player1", 100]]);

      handler.applySpellEffect({
        roundIndex: 1,
        playerHps,
        alivePlayerIds: [],
        bossPlayerId: null,
      });

      expect(playerHps.get("player1")).toBe(100);
    });

    it("buff/debuff以外のeffect typeではcombatModifiersは設定されない", () => {
      const spell = createMockSpell({
        id: "damage-spell",
        effect: { type: "damage", target: "all", value: 50 },
      });
      handler.setDeclaredSpell(spell);

      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(handler.getCombatModifiersForPlayer("player1")).toBeNull();
    });

    it("buffStatが未設定のbuff/debuffは無視される", () => {
      const spell = createMockSpell({
        id: "invalid-buff",
        effect: { type: "buff", target: "all", value: 1.5 }, // buffStatなし
      });
      handler.setDeclaredSpell(spell);

      handler.applyPreBattleSpellEffect({
        alivePlayerIds: ["player1"],
        bossPlayerId: null,
      });

      expect(handler.getCombatModifiersForPlayer("player1")).toBeNull();
    });
  });
});
