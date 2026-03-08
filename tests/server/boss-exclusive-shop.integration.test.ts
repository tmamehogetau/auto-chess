/**
 * ボス専用ショップ（Boss Exclusive Shop）統合テスト
 * Phase2 P1-3: ボス専用ショップ
 * 
 * ボスプレイヤー専用の2枠ショップ。
 * 紅魔館ユニット（美鈴、咲夜、パチュリー）のみが出現。
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { MatchRoomController } from "../../src/server/match-room-controller";
import { SCARLET_MANSION_UNITS, getScarletMansionUnitById } from "../../src/data/scarlet-mansion-units";
import { FeatureFlagService } from "../../src/server/feature-flag-service";

describe("Boss Exclusive Shop Integration", () => {
  let controller: MatchRoomController;
  const playerIds = ["player1", "player2", "player3", "player4"] as const;

  beforeAll(() => {
    // Feature Flagを有効にする
    process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
    // Reset singleton to pick up new environment variables
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(() => {
    // 環境変数をリセット
    delete process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP;
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

  describe("紅魔館ユニット定義", () => {
    it("SCARLET_MANSION_UNITSが定義されている", () => {
      expect(SCARLET_MANSION_UNITS).toBeDefined();
      expect(SCARLET_MANSION_UNITS.length).toBe(3);
    });

    it("美鈴（2G）が定義されている", () => {
      const unit = getScarletMansionUnitById("meiling");
      expect(unit).toBeDefined();
      expect(unit?.displayName).toBe("紅美鈴");
      expect(unit?.cost).toBe(2);
      expect(unit?.unitType).toBe("vanguard");
    });

    it("咲夜（3G）が定義されている", () => {
      const unit = getScarletMansionUnitById("sakuya");
      expect(unit).toBeDefined();
      expect(unit?.displayName).toBe("十六夜咲夜");
      expect(unit?.cost).toBe(3);
      expect(unit?.unitType).toBe("assassin");
    });

    it("パチュリー（4G）が定義されている", () => {
      const unit = getScarletMansionUnitById("patchouli");
      expect(unit).toBeDefined();
      expect(unit?.displayName).toBe("パチュリー・ノーレッジ");
      expect(unit?.cost).toBe(4);
      expect(unit?.unitType).toBe("mage");
    });
  });

  describe("ボスプレイヤー設定", () => {
    beforeEach(() => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);
    });

    it("ゲーム開始時にボスが設定される", () => {
      const bossId = controller.getBossPlayerId();
      expect(bossId).not.toBeNull();
      expect(playerIds).toContain(bossId);
    });

    it("ボスプレイヤー識別が正しく機能する", () => {
      const bossId = controller.getBossPlayerId();
      expect(bossId).not.toBeNull();

      for (const playerId of playerIds) {
        const isBoss = controller.isBossPlayer(playerId);
        if (playerId === bossId) {
          expect(isBoss).toBe(true);
        } else {
          expect(isBoss).toBe(false);
        }
      }
    });
  });

  describe("ボス専用ショップ", () => {
    beforeEach(() => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);
    });

    it("ボスは専用ショップを持つ（2枠）", () => {
      const bossId = controller.getBossPlayerId();
      expect(bossId).not.toBeNull();

      if (bossId) {
        const bossShop = controller.getBossShopOffersForPlayer(bossId);
        expect(bossShop).toBeDefined();
        expect(bossShop.length).toBe(2);
      }
    });

    it("レイドプレイヤーはボスショップを持たない", () => {
      const bossId = controller.getBossPlayerId();
      expect(bossId).not.toBeNull();

      for (const playerId of playerIds) {
        if (playerId !== bossId) {
          const bossShop = controller.getBossShopOffersForPlayer(playerId);
          expect(bossShop).toEqual([]);
        }
      }
    });

    it("ボスショップには紅魔館ユニットのみが出現", () => {
      const bossId = controller.getBossPlayerId();
      expect(bossId).not.toBeNull();

      if (bossId) {
        const bossShop = controller.getBossShopOffersForPlayer(bossId);
        expect(bossShop.length).toBe(2);

        // 全てのオファーが紅魔館ユニットのunitTypeを持つ
        const validUnitTypes = SCARLET_MANSION_UNITS.map((u) => u.unitType);
        for (const offer of bossShop) {
          expect(validUnitTypes).toContain(offer.unitType);
          // コストは2-4の範囲
          expect(offer.cost).toBeGreaterThanOrEqual(2);
          expect(offer.cost).toBeLessThanOrEqual(4);
        }
      }
    });

    it("ボスは通常ショップ（5枠）も持つ", () => {
      const bossId = controller.getBossPlayerId();
      expect(bossId).not.toBeNull();

      if (bossId) {
        const regularShop = controller.getShopOffersForPlayer(bossId);
        expect(regularShop).toBeDefined();
        expect(regularShop.length).toBe(5);
      }
    });

    it("ボスショップ購入は専用レーンだけを消費して通常ショップ金額を汚染しない", () => {
      const bossId = controller.getBossPlayerId();
      expect(bossId).not.toBeNull();

      if (!bossId) {
        return;
      }

      const goldBefore = controller.getPlayerStatus(bossId).gold;
      const regularShopBefore = controller.getShopOffersForPlayer(bossId);
      const bossShopBefore = controller.getBossShopOffersForPlayer(bossId);
      const targetOffer = bossShopBefore[0];

      expect(targetOffer).toBeDefined();

      const result = controller.submitPrepCommand(bossId, 1, Date.now(), {
        bossShopBuySlotIndex: 0,
      });

      expect(result.accepted).toBe(true);

      const bossStatusAfter = controller.getPlayerStatus(bossId);
      expect(bossStatusAfter.gold).toBe(goldBefore - (targetOffer?.cost ?? 0));
      expect(controller.getShopOffersForPlayer(bossId)).toEqual(regularShopBefore);
      expect(controller.getBossShopOffersForPlayer(bossId)[0]?.purchased).toBe(true);
      expect(bossStatusAfter.bossShopOffers.length).toBe(2);
      expect(bossStatusAfter.shopOffers).toEqual(regularShopBefore);
    });
  });

  describe("Feature Flag無効時の動作", () => {
    beforeEach(() => {
      // Feature Flagを無効にする
      delete process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP;
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
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
      (FeatureFlagService as any).instance = undefined;
    });

    it("enableBossExclusiveShop=falseの場合、ボスショップは空", () => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);

      // ボスショップは全プレイヤーで空
      for (const playerId of playerIds) {
        const bossShop = controller.getBossShopOffersForPlayer(playerId);
        expect(bossShop).toEqual([]);
      }
    });
  });
});
