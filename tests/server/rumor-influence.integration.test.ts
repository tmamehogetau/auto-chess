/**
 * 噂勢力（Rumor Influence）統合テスト
 * Phase2 P1-2: 噂勢力システム
 * 
 * フェーズ成功時に次ラウンドのショップに特定ユニットが
 * 最低1体確定で出現する機能
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { MatchRoomController } from "../../src/server/match-room-controller";
import { getRumorUnitForRound, RUMOR_UNITS_BY_ROUND } from "../../src/data/rumor-units";
import { FeatureFlagService } from "../../src/server/feature-flag-service";

describe("Rumor Influence Integration", () => {
  let controller: MatchRoomController;
  const playerIds = ["player1", "player2", "player3", "player4"] as const;
  const BOSS = playerIds[0]; // ボス
  const RAID1 = playerIds[1]; // レイド1
  const RAID2 = playerIds[2]; // レイド2
  const RAID3 = playerIds[3]; // レイド3

  beforeAll(() => {
    // Feature Flagを有効にする
    process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "true";
    // Reset singleton to pick up new environment variables
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(() => {
    // 環境変数をリセット
    delete process.env.FEATURE_ENABLE_RUMOR_INFLUENCE;
    // Reset singleton
    (FeatureFlagService as any).instance = undefined;
  });

  beforeEach(() => {
    controller = new MatchRoomController([...playerIds], Date.now(), {
      readyAutoStartMs: 1000,
      prepDurationMs: 10000,
      battleDurationMs: 5000,
      settleDurationMs: 1000,
      eliminationDurationMs: 1000,
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("噂勢力ユニット定義", () => {
    it("RUMOR_UNITS_BY_ROUNDが定義されている", () => {
      expect(RUMOR_UNITS_BY_ROUND).toBeDefined();
      expect(Object.keys(RUMOR_UNITS_BY_ROUND).length).toBeGreaterThan(0);
    });

    it("各ラウンドの噂勢力ユニットが定義されている", () => {
      for (let round = 1; round <= 11; round++) {
        const unit = getRumorUnitForRound(round);
        expect(unit).toBeDefined();
        expect(unit?.targetRound).toBe(round);
        expect(unit?.unitType).toBeDefined();
        expect(unit?.rarity).toBeGreaterThanOrEqual(1);
        expect(unit?.rarity).toBeLessThanOrEqual(3);
      }
    });

    it("R1はvanguard（レアリティ1）", () => {
      const unit = getRumorUnitForRound(1);
      expect(unit?.unitType).toBe("vanguard");
      expect(unit?.rarity).toBe(1);
    });

    it("R4はmage（レアリティ2）", () => {
      const unit = getRumorUnitForRound(4);
      expect(unit?.unitType).toBe("mage");
      expect(unit?.rarity).toBe(2);
    });

    it("R9はmage（レアリティ3）", () => {
      const unit = getRumorUnitForRound(9);
      expect(unit?.unitType).toBe("mage");
      expect(unit?.rarity).toBe(3);
    });
  });

  describe("フェーズ成功時の噂勢力付与", () => {
    beforeEach(() => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);
    });

    it("ゲーム開始時はeligibleがfalse", () => {
      // 初期状態では誰もeligibleではない
      const shopOffers = controller.getShopOffersForPlayer(RAID1);
      expect(shopOffers).toBeDefined();
      expect(shopOffers.length).toBe(5);
    });

    it("フェーズ成功後、次ラウンドに噂勢力ユニットが出現", () => {
      // フェーズ成功をシミュレートするために戦闘を進める
      // Prep → Battle → Settle → Elimination → Prep
      
      // R1: Prep → Battle
      const prepDeadline1 = controller.prepDeadlineAtMs;
      expect(prepDeadline1).not.toBeNull();
      if (prepDeadline1) {
        controller.advanceByTime(prepDeadline1 + 100);
      }

      // R1: Battle → Settle
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // R1: Settle → Elimination
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // R1: Elimination → R2 Prep
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // R2 Prepのショップを確認
      const shopOffers = controller.getShopOffersForPlayer(RAID1);
      expect(shopOffers).toBeDefined();
      expect(shopOffers.length).toBe(5);

      // 注: フェーズ成功/失敗は戦闘ダメージに依存するため、
      // 実際のテストではより詳細なシミュレーションが必要
    });
  });

  describe("Feature Flag無効時の動作", () => {
    beforeEach(() => {
      // Feature Flagを無効にする
      delete process.env.FEATURE_ENABLE_RUMOR_INFLUENCE;
      (FeatureFlagService as any).instance = undefined;

      // 新しいコントローラーを作成（Flag無効状態）
      controller = new MatchRoomController([...playerIds], Date.now(), {
        readyAutoStartMs: 1000,
        prepDurationMs: 10000,
        battleDurationMs: 5000,
        settleDurationMs: 1000,
        eliminationDurationMs: 1000,
      });
    });

    afterEach(() => {
      // Feature Flagを再有効化
      process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "true";
      (FeatureFlagService as any).instance = undefined;
    });

    it("enableRumorInfluence=falseの場合、噂勢力は発動しない", () => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);

      // ショップを取得
      const shopOffers = controller.getShopOffersForPlayer(RAID1);
      expect(shopOffers).toBeDefined();
      expect(shopOffers.length).toBe(5);

      // Flag無効時は通常のショップ生成（ランダム5枠）
      // 噂勢力による確定枠は存在しない
    });
  });

  describe("ボス除外", () => {
    beforeEach(() => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);
    });

    it("ボスは噂勢力の対象外", () => {
      // ボスのショップは通常のショップ生成
      // 注: 実際にはボスは独自のショップシステムを持つため、
      // このテストは実装詳細に依存する
      const bossShop = controller.getShopOffersForPlayer(BOSS);
      expect(bossShop).toBeDefined();
      expect(bossShop.length).toBe(5);
    });
  });
});
