import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  MatchLogger,
} from "../../src/server/match-logger";

describe("MatchLogger - P1 Feature Logs", () => {
  let logger: MatchLogger;
  const matchId = "test-match-001";
  const roomId = "test-room-001";

  beforeEach(() => {
    logger = new MatchLogger(matchId, roomId);
    // プレイヤーを登録
    logger.registerPlayer("player-1");
    logger.registerPlayer("player-2");
  });

  describe("logSpellEffect", () => {
    it("スペル効果ログを正しく記録すること", () => {
      logger.logSpellEffect(
        1,
        "spell-fireball",
        "ファイアボール",
        "damage",
        "all",
        10,
        10,
      );

      const logs = logger.getSpellEffectLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0]!;
      expect(log.matchId).toBe(matchId);
      expect(log.roundIndex).toBe(1);
      expect(log.declaredSpellId).toBe("spell-fireball");
      expect(log.spellName).toBe("ファイアボール");
      expect(log.effectType).toBe("damage");
      expect(log.target).toBe("all");
      expect(log.value).toBe(10);
      expect(log.actualEffect).toBe(10);
      expect(log.timestamp).toBeGreaterThan(0);
    });

    it("複数のスペル効果ログを記録すること", () => {
      logger.logSpellEffect(1, "spell-1", "スペル1", "damage", "boss", 5, 5);
      logger.logSpellEffect(2, "spell-2", "スペル2", "heal", "raid", 8, 8);
      logger.logSpellEffect(3, "spell-3", "スペル3", "buff", "all", 1.5, 1.5);

      const logs = logger.getSpellEffectLogs();
      expect(logs).toHaveLength(3);
    });
  });

  describe("logBossShop", () => {
    it("ボスショップログを正しく記録すること", () => {
      const offers = [
        { unitType: "unit-a", cost: 3, isRumorUnit: false },
        { unitType: "unit-b", cost: 4, isRumorUnit: true },
      ];
      const purchased = {
        slotIndex: 0,
        unitType: "unit-a",
        cost: 3,
      };

      logger.logBossShop(1, "player-1", offers, purchased);

      const logs = logger.getBossShopLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0]!;
      expect(log.matchId).toBe(matchId);
      expect(log.roundIndex).toBe(1);
      expect(log.playerId).toBe("player-1");
      expect(log.offers).toHaveLength(2);
      expect(log.offers[0]!.unitType).toBe("unit-a");
      expect(log.purchased).toEqual(purchased);
      expect(log.timestamp).toBeGreaterThan(0);
    });

    it("購入なしのボスショップログを記録すること", () => {
      const offers = [
        { unitType: "unit-a", cost: 3 },
        { unitType: "unit-b", cost: 4 },
      ];

      logger.logBossShop(1, "player-1", offers);

      const logs = logger.getBossShopLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.purchased).toBeUndefined();
    });

    it("複数のボスショップログを記録すること", () => {
      logger.logBossShop(1, "player-1", [{ unitType: "unit-a", cost: 3 }]);
      logger.logBossShop(2, "player-1", [{ unitType: "unit-b", cost: 4 }]);

      const logs = logger.getBossShopLogs();
      expect(logs).toHaveLength(2);
    });

    it("入力参照の変更が記録済みログに影響しないこと", () => {
      const offers = [
        { unitType: "unit-a", cost: 3, isRumorUnit: false },
      ];
      const purchased = { slotIndex: 0, unitType: "unit-a", cost: 3 };

      logger.logBossShop(1, "player-1", offers, purchased);

      // Modify input after logging
      offers[0]!.unitType = "modified-unit";
      offers[0]!.cost = 999;
      (purchased as { slotIndex: number }).slotIndex = 999;

      // Verify recorded log is unchanged
      const logs = logger.getBossShopLogs();
      expect(logs[0]!.offers[0]!.unitType).toBe("unit-a");
      expect(logs[0]!.offers[0]!.cost).toBe(3);
      expect(logs[0]!.purchased!.slotIndex).toBe(0);
    });
  });

  describe("logSynergyActivation", () => {
    it("シナジー発動ログを正しく記録すること", () => {
      const effects = [
        { type: "attackBonus", value: 10 },
        { type: "defenseBonus", value: 5 },
      ];

      logger.logSynergyActivation(
        1,
        "player-1",
        "scarletMansion",
        3,
        effects,
      );

      const logs = logger.getSynergyActivationLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0]!;
      expect(log.matchId).toBe(matchId);
      expect(log.roundIndex).toBe(1);
      expect(log.playerId).toBe("player-1");
      expect(log.synergyType).toBe("scarletMansion");
      expect(log.unitCount).toBe(3);
      expect(log.effects).toHaveLength(2);
      expect(log.effects[0]!.type).toBe("attackBonus");
      expect(log.timestamp).toBeGreaterThan(0);
    });

    it("空の効果配列でシナジー発動ログを記録すること", () => {
      logger.logSynergyActivation(1, "player-1", "vanguard", 3, []);

      const logs = logger.getSynergyActivationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.effects).toHaveLength(0);
    });

    it("複数のシナジー発動ログを記録すること", () => {
      logger.logSynergyActivation(1, "player-1", "type-a", 3, [{ type: "bonus", value: 10 }]);
      logger.logSynergyActivation(1, "player-1", "type-b", 6, [{ type: "bonus", value: 20 }]);

      const logs = logger.getSynergyActivationLogs();
      expect(logs).toHaveLength(2);
    });

    it("入力参照の変更が記録済みログに影響しないこと", () => {
      const effects = [
        { type: "attackBonus", value: 10 },
        { type: "defenseBonus", value: 5 },
      ];

      logger.logSynergyActivation(1, "player-1", "scarletMansion", 3, effects);

      // Modify input after logging
      effects[0]!.type = "modifiedType";
      effects[0]!.value = 999;
      effects.push({ type: "newEffect", value: 100 });

      // Verify recorded log is unchanged
      const logs = logger.getSynergyActivationLogs();
      expect(logs[0]!.effects).toHaveLength(2);
      expect(logs[0]!.effects[0]!.type).toBe("attackBonus");
      expect(logs[0]!.effects[0]!.value).toBe(10);
    });
  });

  describe("logHpChange", () => {
    it("HP減少ログを正しく記録すること", () => {
      logger.logHpChange(1, "player-1", 100, 90, "battle");

      const logs = logger.getHpChangeLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0]!;
      expect(log.matchId).toBe(matchId);
      expect(log.roundIndex).toBe(1);
      expect(log.playerId).toBe("player-1");
      expect(log.hpBefore).toBe(100);
      expect(log.hpAfter).toBe(90);
      expect(log.hpChange).toBe(-10);
      expect(log.reason).toBe("battle");
    });

    it("HP増加ログを正しく記録すること", () => {
      logger.logHpChange(1, "player-1", 80, 100, "spell");

      const logs = logger.getHpChangeLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.hpChange).toBe(20);
    });

    it("複数のHP変化ログを記録すること", () => {
      logger.logHpChange(1, "player-1", 100, 90, "battle");
      logger.logHpChange(1, "player-1", 90, 85, "spell");
      logger.logHpChange(1, "player-2", 100, 95, "battle");

      const logs = logger.getHpChangeLogs();
      expect(logs).toHaveLength(3);
    });

    it("reasonに'other'を指定できること", () => {
      logger.logHpChange(1, "player-1", 100, 50, "other");

      const logs = logger.getHpChangeLogs();
      expect(logs[0]!.reason).toBe("other");
      expect(logs[0]!.hpChange).toBe(-50);
    });
  });

  describe("getters", () => {
    it("ゲッターが正しくデータを返すこと", () => {
      // 各種ログを記録
      logger.logSpellEffect(1, "spell-1", "スペル1", "damage", "all", 10, 10);
      logger.logBossShop(1, "player-1", [{ unitType: "unit-a", cost: 3 }]);
      logger.logSynergyActivation(1, "player-1", "type-a", 3, [{ type: "bonus", value: 10 }]);
      logger.logHpChange(1, "player-1", 100, 90, "battle");

      // ゲッターのテスト
      expect(logger.getSpellEffectLogs()).toHaveLength(1);
      expect(logger.getBossShopLogs()).toHaveLength(1);
      expect(logger.getSynergyActivationLogs()).toHaveLength(1);
      expect(logger.getHpChangeLogs()).toHaveLength(1);
    });

    it("ゲッターが配列のコピーを返すこと", () => {
      logger.logSpellEffect(1, "spell-1", "スペル1", "damage", "all", 10, 10);

      const logs1 = logger.getSpellEffectLogs();
      const logs2 = logger.getSpellEffectLogs();

      // 配列は別のインスタンスであることを確認
      expect(logs1).not.toBe(logs2);

      // 内容は同じ
      expect(logs1).toEqual(logs2);
    });

    it("should defensively copy boss shop logs offers array", () => {
      const offers = [
        { unitType: "unit-a", cost: 3, isRumorUnit: false },
        { unitType: "unit-b", cost: 4, isRumorUnit: true },
      ];
      logger.logBossShop(1, "player-1", offers, { slotIndex: 0, unitType: "unit-a", cost: 3 });

      const logs = logger.getBossShopLogs();
      const logsAgain = logger.getBossShopLogs();

      // Same content
      expect(logs[0]!.offers).toEqual(offers);

      // Different array and object instances
      expect(logs[0]!.offers).not.toBe(logsAgain[0]!.offers);
      expect(logs[0]!.offers[0]).not.toBe(logsAgain[0]!.offers[0]);

      // Modifying returned offers should not affect internal state
      logs[0]!.offers.push({ unitType: "modified", cost: 99 });
      const freshLogs = logger.getBossShopLogs();
      expect(freshLogs[0]!.offers).toHaveLength(2);
    });

    it("should defensively copy boss shop logs purchased object", () => {
      const purchased = { slotIndex: 0, unitType: "unit-a", cost: 3 };
      logger.logBossShop(1, "player-1", [{ unitType: "unit-a", cost: 3 }], purchased);

      const logs = logger.getBossShopLogs();

      // Modifying returned purchased should not affect internal state
      logs[0]!.purchased!.slotIndex = 999;
      const freshLogs = logger.getBossShopLogs();
      expect(freshLogs[0]!.purchased!.slotIndex).toBe(0);
    });

    it("should defensively copy synergy activation logs effects array", () => {
      const effects = [
        { type: "attackBonus", value: 10 },
        { type: "defenseBonus", value: 5 },
      ];
      logger.logSynergyActivation(1, "player-1", "scarletMansion", 3, effects);

      const logs = logger.getSynergyActivationLogs();
      const logsAgain = logger.getSynergyActivationLogs();

      // Same content
      expect(logs[0]!.effects).toEqual(effects);

      // Different array and object instances
      expect(logs[0]!.effects).not.toBe(logsAgain[0]!.effects);
      expect(logs[0]!.effects[0]).not.toBe(logsAgain[0]!.effects[0]);

      // Modifying returned effects should not affect internal state
      logs[0]!.effects.push({ type: "modified", value: 999 });
      const freshLogs = logger.getSynergyActivationLogs();
      expect(freshLogs[0]!.effects).toHaveLength(2);
    });

    it("should defensively copy spell effect logs", () => {
      logger.logSpellEffect(1, "spell-1", "スペル1", "damage", "all", 10, 10);

      const logs = logger.getSpellEffectLogs();
      const logsAgain = logger.getSpellEffectLogs();

      // Different array instances
      expect(logs).not.toBe(logsAgain);
      // Different object instances
      expect(logs[0]).not.toBe(logsAgain[0]);

      // Modifying returned log should not affect internal state
      logs[0]!.spellName = "modified";
      logs[0]!.value = 999;
      const freshLogs = logger.getSpellEffectLogs();
      expect(freshLogs[0]!.spellName).toBe("スペル1");
      expect(freshLogs[0]!.value).toBe(10);
    });

    it("should defensively copy HP change logs", () => {
      logger.logHpChange(1, "player-1", 100, 90, "battle");

      const logs = logger.getHpChangeLogs();
      const logsAgain = logger.getHpChangeLogs();

      // Different array instances
      expect(logs).not.toBe(logsAgain);
      // Different object instances
      expect(logs[0]).not.toBe(logsAgain[0]);

      // Modifying returned log should not affect internal state
      logs[0]!.hpBefore = 999;
      logs[0]!.hpAfter = 888;
      const freshLogs = logger.getHpChangeLogs();
      expect(freshLogs[0]!.hpBefore).toBe(100);
      expect(freshLogs[0]!.hpAfter).toBe(90);
    });
  });

  describe("integration", () => {
    it("既存のログ機能と一緒に動作すること", () => {
      // 既存の機能を使用
      logger.logRoundTransition("Prep", 1, Date.now());
      logger.updatePlayerHp("player-1", 90);

      // 新機能を使用
      logger.logSpellEffect(1, "spell-1", "スペル1", "damage", "all", 10, 10);
      logger.logHpChange(1, "player-1", 100, 90, "spell");

      // 両方のログが取得できることを確認
      expect(logger.getRoundLogs()).toHaveLength(1);
      expect(logger.getSpellEffectLogs()).toHaveLength(1);
      expect(logger.getHpChangeLogs()).toHaveLength(1);
    });
  });

  describe("updateFinalUnits", () => {
    it("入力配列の変更が記録済みユニットに影響しないこと", () => {
      const boardUnits = [
        { unitType: "vanguard", starLevel: 1, cell: 0, items: ["item1"] },
      ];
      const benchUnits = [
        { unitType: "ranger", starLevel: 2, benchIndex: 0, items: ["item2", "item3"] },
      ];

      logger.updateFinalUnits("player-1", boardUnits, benchUnits);

      // Modify input after recording
      boardUnits[0]!.unitType = "modified";
      boardUnits[0]!.items.push("newItem");
      benchUnits[0]!.starLevel = 99;

      // Verify generateSummary returns unchanged data
      const summary = logger.generateSummary(null, ["player-1", "player-2"], 5, {
        enableHeroSystem: false,
        enableSharedPool: false,
        enableSpellCard: false,
        enableRumorInfluence: false,
        enableBossExclusiveShop: false,
      });

      const player = summary.players.find((p) => p.playerId === "player-1")!;
      expect(player.finalBoardUnits[0]!.unitType).toBe("vanguard");
      expect(player.finalBoardUnits[0]!.items).toEqual(["item1"]);
      expect(player.finalBenchUnits[0]!.starLevel).toBe(2);
    });
  });

  describe("generateSummary", () => {
    it("should defensively copy final units in summary", () => {
      const boardUnits = [
        { unitType: "vanguard", starLevel: 1, cell: 0, items: ["item1"] },
      ];
      const benchUnits: { unitType: string; starLevel: number; benchIndex: number; items: string[] }[] = [];

      logger.updateFinalUnits("player-1", boardUnits, benchUnits);

      const summary1 = logger.generateSummary(null, ["player-1", "player-2"], 5, {
        enableHeroSystem: false,
        enableSharedPool: false,
        enableSpellCard: false,
        enableRumorInfluence: false,
        enableBossExclusiveShop: false,
      });
      const summary2 = logger.generateSummary(null, ["player-1", "player-2"], 5, {
        enableHeroSystem: false,
        enableSharedPool: false,
        enableSpellCard: false,
        enableRumorInfluence: false,
        enableBossExclusiveShop: false,
      });

      const player1 = summary1.players.find((p) => p.playerId === "player-1")!;
      const player2 = summary2.players.find((p) => p.playerId === "player-1")!;

      // Different array instances
      expect(player1.finalBoardUnits).not.toBe(player2.finalBoardUnits);
      // Different object instances
      expect(player1.finalBoardUnits[0]).not.toBe(player2.finalBoardUnits[0]);
      // Different items array instances
      expect(player1.finalBoardUnits[0]!.items).not.toBe(player2.finalBoardUnits[0]!.items);

      // Modifying returned summary should not affect internal state
      player1.finalBoardUnits[0]!.unitType = "modified";
      player1.finalBoardUnits[0]!.items.push("newItem");

      const summary3 = logger.generateSummary(null, ["player-1", "player-2"], 5, {
        enableHeroSystem: false,
        enableSharedPool: false,
        enableSpellCard: false,
        enableRumorInfluence: false,
        enableBossExclusiveShop: false,
      });
      const player3 = summary3.players.find((p) => p.playerId === "player-1")!;
      expect(player3.finalBoardUnits[0]!.unitType).toBe("vanguard");
      expect(player3.finalBoardUnits[0]!.items).toEqual(["item1"]);
    });
  });

  describe("getActionLogs", () => {
    it("should return action logs with defensive copy", () => {
      logger.logAction("player-1", 1, "buy_unit", {
        unitType: "vanguard",
        cost: 3,
        goldBefore: 10,
        goldAfter: 7,
      });

      const logs1 = logger.getActionLogs();
      const logs2 = logger.getActionLogs();

      // Should return same content
      expect(logs1).toHaveLength(1);
      expect(logs1[0]!.actionType).toBe("buy_unit");
      expect(logs1[0]!.details.unitType).toBe("vanguard");

      // Should be different instances (defensive copy)
      expect(logs1).not.toBe(logs2);
      expect(logs1[0]).not.toBe(logs2[0]);
      expect(logs1[0]!.details).not.toBe(logs2[0]!.details);
    });

    it("should not allow modification of internal state through returned logs", () => {
      logger.logAction("player-1", 1, "buy_unit", {
        unitType: "vanguard",
        cost: 3,
        goldBefore: 10,
        goldAfter: 7,
      });

      const logs = logger.getActionLogs();

      // Modify the returned log and its details
      logs[0]!.details.unitType = "modified";
      logs[0]!.details.isRumorUnit = true;

      // Get logs again - should not reflect the modification
      const logsAgain = logger.getActionLogs();
      expect(logsAgain[0]!.details.unitType).toBe("vanguard");
      expect(logsAgain[0]!.details.isRumorUnit).toBeUndefined();
    });

    it("should include isRumorUnit flag in action log details when provided", () => {
      logger.logAction("player-1", 1, "buy_unit", {
        unitType: "reimu",
        cost: 4,
        isRumorUnit: true,
        goldBefore: 10,
        goldAfter: 6,
      });

      const logs = logger.getActionLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.details.isRumorUnit).toBe(true);
    });

    it("should not include isRumorUnit flag when not provided", () => {
      logger.logAction("player-1", 1, "buy_unit", {
        unitType: "vanguard",
        cost: 3,
        goldBefore: 10,
        goldAfter: 7,
      });

      const logs = logger.getActionLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.details.isRumorUnit).toBeUndefined();
    });

    it("should defensively copy benchIndices in merge action logs", () => {
      logger.logAction("player-1", 1, "merge", {
        unitType: "vanguard",
        starLevel: 2,
        benchIndices: [0, 1, 2],
        goldBefore: 10,
        goldAfter: 10,
      });

      const logs = logger.getActionLogs();
      const logsAgain = logger.getActionLogs();

      // Same content
      expect(logs[0]!.details.benchIndices).toEqual([0, 1, 2]);

      // Different array instances
      expect(logs[0]!.details.benchIndices).not.toBe(logsAgain[0]!.details.benchIndices);

      // Modifying returned array should not affect internal state
      logs[0]!.details.benchIndices!.push(999);
      const freshLogs = logger.getActionLogs();
      expect(freshLogs[0]!.details.benchIndices).toEqual([0, 1, 2]);
    });

    it("should defensively copy boardCells in merge action logs", () => {
      logger.logAction("player-1", 1, "merge", {
        unitType: "ranger",
        starLevel: 3,
        boardCells: [5, 10, 15],
        goldBefore: 10,
        goldAfter: 10,
      });

      const logs = logger.getActionLogs();

      // Modifying returned array should not affect internal state
      logs[0]!.details.boardCells!.push(999);
      const freshLogs = logger.getActionLogs();
      expect(freshLogs[0]!.details.boardCells).toEqual([5, 10, 15]);
    });

    it("入力参照の変更が記録済みログに影響しないこと", () => {
      const details = {
        unitType: "vanguard",
        cost: 3,
        goldBefore: 10,
        goldAfter: 7,
      };

      logger.logAction("player-1", 1, "buy_unit", details);

      // Modify input after logging
      (details as { unitType: string }).unitType = "modified";
      (details as { cost: number }).cost = 999;

      // Verify recorded log is unchanged
      const logs = logger.getActionLogs();
      expect(logs[0]!.details.unitType).toBe("vanguard");
      expect(logs[0]!.details.cost).toBe(3);
    });

    it("logAction後に元のbenchIndicesを変更しても内部ログが変わらない", () => {
      const benchIndices = [0, 1, 2];
      const details = {
        unitType: "vanguard",
        starLevel: 2,
        benchIndices,
        goldBefore: 10,
        goldAfter: 10,
      };

      logger.logAction("player-1", 1, "merge", details);

      // Modify original array after logging
      benchIndices.push(999);
      benchIndices[0] = 888;

      // Verify internal log is unchanged
      const logs = logger.getActionLogs();
      expect(logs[0]!.details.benchIndices).toEqual([0, 1, 2]);
    });

    it("logAction後に元のboardCellsを変更しても内部ログが変わらない", () => {
      const boardCells = [5, 10, 15];
      const details = {
        unitType: "ranger",
        starLevel: 3,
        boardCells,
        goldBefore: 10,
        goldAfter: 10,
      };

      logger.logAction("player-1", 1, "merge", details);

      // Modify original array after logging
      boardCells.push(999);
      boardCells[0] = 888;

      // Verify internal log is unchanged
      const logs = logger.getActionLogs();
      expect(logs[0]!.details.boardCells).toEqual([5, 10, 15]);
    });
  });

  describe("outputRumorKpiSummary", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should emit structured rumor KPI report without changing existing summary output", () => {
      // Setup: Create round with guaranteed rumor slot and a rumor unit purchase
      // grant round 1, purchase in round 2 (next Prep)
      logger.logRumorInfluence(1, ["rumor-faction-1"], true, ["player-1"]);
      logger.logAction("player-1", 2, "buy_unit", {
        unitType: "reimu",
        cost: 4,
        isRumorUnit: true,
        goldBefore: 10,
        goldAfter: 6,
      });

      // Execute the new method
      logger.outputRumorKpiSummary();

      // Verify the output structure
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(output).toEqual({
        type: "rumor_kpi_summary",
        data: expect.objectContaining({
          guaranteedRounds: 1,
          rumorPurchaseCount: 1,
        }),
      });
    });

    it("should maintain existing outputSummary semantics", () => {
      // Setup: Create a complete match scenario
      logger.logRumorInfluence(1, ["rumor-faction-1"], true);
      logger.logAction("player-1", 1, "buy_unit", {
        unitType: "vanguard",
        cost: 3,
        goldBefore: 10,
        goldAfter: 7,
      });

      const featureFlags = {
        enableHeroSystem: false,
        enableSharedPool: false,
        enableSpellCard: false,
        enableRumorInfluence: true,
        enableBossExclusiveShop: false,
      };

      // Execute outputSummary
      logger.outputSummary("player-1", ["player-1", "player-2"], 5, featureFlags);

      // Verify the output structure is unchanged
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(output).toEqual({
        type: "match_summary",
        data: expect.objectContaining({
          matchId: "test-match-001",
          roomId: "test-room-001",
          winner: "player-1",
          ranking: ["player-1", "player-2"],
          totalRounds: 5,
          featureFlags,
        }),
      });
    });
  });
});
