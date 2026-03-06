import { describe, it, expect, beforeEach } from "vitest";
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
});
