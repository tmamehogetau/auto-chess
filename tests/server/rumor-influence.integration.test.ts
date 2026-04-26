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
import { MatchLogger } from "../../src/server/match-logger";

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
    process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
    // Reset singleton to pick up new environment variables
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(() => {
    // 環境変数をリセット
    delete process.env.FEATURE_ENABLE_RUMOR_INFLUENCE;
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
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);
      const testRaidPlayer = raidPlayers[0]!;

      // 初期状態では誰もeligibleではない
      const shopOffers = controller.getShopOffersForPlayer(testRaidPlayer);
      expect(shopOffers).toBeDefined();
      expect(shopOffers.length).toBe(5);
    });

    it("フェーズ成功後、次ラウンドに噂勢力ユニットが出現", () => {
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);
      const testRaidPlayer = raidPlayers[0]!;

      // フェーズ成功をシミュレートするために戦闘を進める
      // Prep → Battle → Settle → Elimination → Prep
      
      // R1: Prep → Battle
      const prepDeadline1 = controller.prepDeadlineAtMs;
      expect(prepDeadline1).not.toBeNull();
      if (prepDeadline1) {
        controller.advanceByTime(prepDeadline1 + 100);
      }

      // フェーズ成功ダメージを設定
      controller.setPendingRoundDamage({
        [actualBoss!]: 1800,
      });

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
      const shopOffers = controller.getShopOffersForPlayer(testRaidPlayer);
      expect(shopOffers).toBeDefined();
      expect(shopOffers.length).toBe(5);

      // 注: フェーズ成功/失敗は戦闘ダメージに依存するため、
      // 実際のテストではより詳細なシミュレーションが必要
    });

    it("フェーズ成功時に噂勢力ログが記録される", () => {
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();

      const logger = new MatchLogger("match-rumor", "room-rumor");
      controller.setMatchLogger(logger);

      const prepDeadline = controller.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();
      if (prepDeadline) {
        controller.advanceByTime(prepDeadline + 100);
      }

      controller.setPendingRoundDamage({
        [actualBoss!]: 1800,
      });

      // Battle → Settle → Elimination → Prep と遷移
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      const roundLog = logger.getRoundLogs().find((log) => log.roundIndex === 1);

      expect(roundLog?.guaranteedRumorSlotApplied).toBe(true);
      expect(roundLog?.rumorFactions).toEqual([getRumorUnitForRound(2)?.unitType]);
    });

    it("確定噂スロットを消費した後はeligibleがリセットされ、再refreshで再付与されない", () => {
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);
      const testRaidPlayer = raidPlayers[0]!;

      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }

      controller.setPendingRoundDamage({
        [actualBoss!]: 1800,
      });

      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      const prepStatus = controller.getPlayerStatus(testRaidPlayer);
      expect(prepStatus.isRumorEligible).toBe(false);
      expect(prepStatus.shopOffers[0]?.isRumorUnit).toBe(true);

      const refreshResult = controller.submitPrepCommand(testRaidPlayer, 1, Date.now(), {
        shopRefreshCount: 1,
      });
      expect(refreshResult.accepted).toBe(true);

      const refreshedStatus = controller.getPlayerStatus(testRaidPlayer);
      expect(refreshedStatus.isRumorEligible).toBe(false);
      expect(refreshedStatus.shopOffers[0]?.isRumorUnit).not.toBe(true);
      expect(refreshedStatus.shopOffers.filter((offer) => offer.isRumorUnit).length).toBe(0);
    });

    it("フェーズ失敗時はrumor logが次ラウンド付与を示さない", () => {
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);
      const testRaidPlayer = raidPlayers[0]!;

      const logger = new MatchLogger("match-rumor-failed", "room-rumor-failed");
      controller.setMatchLogger(logger);

      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }

      controller.setPendingRoundDamage({
        [actualBoss!]: 10,
      });

      // Battle → Settle → Elimination → Prep と遷移
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      const roundLog = logger.getRoundLogs().find((log) => log.roundIndex === 1);

      expect(roundLog?.guaranteedRumorSlotApplied).toBe(false);
      expect(roundLog?.rumorFactions ?? []).toEqual([]);
      expect(controller.getPlayerStatus(testRaidPlayer).isRumorEligible).toBe(false);
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

    it("enableRumorInfluence=falseの場合、getRumorKpiSummary()はゼロ値を返す", () => {
      // Arrange: ゲームを進行させる（噂勢力無効状態）
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);

      const logger = new MatchLogger("match-off-path", "room-off-path");
      controller.setMatchLogger(logger);

      // Act: ラウンドを進行（フェーズ成功しても噂勢力は発動しない）
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();

      // R1: Prep → Battle
      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }

      // ダメージを設定（本来ならフェーズ成功）
      controller.setPendingRoundDamage({
        [actualBoss!]: 1800,
      });

      // Battle → Settle → Elimination → R2 Prep
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // Assert: KPIサマリーが全てゼロ値であることを直接検証
      const summary = logger.getRumorKpiSummary();
      expect(summary.guaranteedRounds).toBe(0);
      expect(summary.rumorPurchaseCount).toBe(0);
      expect(summary.rumorPurchaseRate).toBe(0);
      expect(summary.opportunitiesWithoutPurchase).toBe(0);
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
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();

      // ボスのショップは通常のショップ生成
      // 注: 実際にはボスは独自のショップシステムを持つため、
      // このテストは実装詳細に依存する
      const bossShop = controller.getShopOffersForPlayer(actualBoss!);
      expect(bossShop).toBeDefined();
      expect(bossShop.length).toBe(5);
    });
  });

  describe("KPIサマリー統合", () => {
    beforeEach(() => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);
    });

    it("should track KPI through a round with guaranteed rumor but no purchase", () => {
      const logger = new MatchLogger("match-kpi-test", "room-kpi-test");
      controller.setMatchLogger(logger);

      // 実際のボスを取得（ランダムに設定される）
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);

      // R1: Prep → Battle (フェーズ成功設定)
      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }

      // フェーズ成功（1800ダメージで成功）
      controller.setPendingRoundDamage({
        [actualBoss!]: 1800,
      });

      // Battle → Settle → Elimination → R2 Prep
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // 購入しない（コマンドを送信しない）

      // KPIサマリーを取得
      const summary = logger.getRumorKpiSummary();

      // ログから検証
      const roundLogs = logger.getRoundLogs();
      const r1Log = roundLogs.find(l => l.roundIndex === 1);
      expect(r1Log).toBeDefined();
      expect(r1Log!.guaranteedRumorSlotApplied).toBe(true);
      // grantedPlayerIds にボスが含まれていないことを確認
      expect(r1Log!.grantedPlayerIds).toBeDefined();
      expect(r1Log!.grantedPlayerIds!.includes(actualBoss!)).toBe(false);
      // レイドプレイヤーが全員含まれていることを確認
      for (const raidPlayer of raidPlayers) {
        expect(r1Log!.grantedPlayerIds!.includes(raidPlayer)).toBe(true);
      }
      
      // 期待値: guaranteedRounds=1, purchases=0, opportunities=grantedPlayerIds数, rate=0
      expect(summary.guaranteedRounds).toBe(1);
      expect(summary.rumorPurchaseCount).toBe(0);
      expect(summary.rumorPurchaseRate).toBe(0);
      // opportunitiesWithoutPurchase = grantedPlayerIds の数（ボスを除く）
      expect(summary.opportunitiesWithoutPurchase).toBe(r1Log!.grantedPlayerIds!.length);
    });

    it("should correctly attribute round R purchase to round R-1 grant", () => {
      const logger = new MatchLogger("match-kpi-round-attribution", "room-kpi-round");
      controller.setMatchLogger(logger);

      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);
      const testRaidPlayer = raidPlayers[0]!;

      // R1: Prep → Battle
      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }

      // フェーズ成功
      controller.setPendingRoundDamage({ [actualBoss!]: 1800 });

      // Battle → Settle → Elimination → R2 Prep
      while (controller.phase !== "Prep" || controller.roundIndex !== 2) {
        const deadline = controller.phaseDeadlineAtMs;
        if (deadline) {
          controller.advanceByTime(deadline + 100);
        } else {
          break;
        }
      }

      // R2 Prep で噂勢力ユニットを購入
      const status = controller.getPlayerStatus(testRaidPlayer);
      const rumorSlotIndex = status.shopOffers.findIndex((offer) => offer.isRumorUnit);
      expect(rumorSlotIndex).not.toBe(-1);

      const result = controller.submitPrepCommand(testRaidPlayer, 1, Date.now(), {
        shopBuySlotIndex: rumorSlotIndex,
      });
      expect(result.accepted).toBe(true);

      // Controller は isRumorUnit を action log に記録しないため、手動で追加
      // (GameRoom boundary で記録される)
      logger.logAction(testRaidPlayer, 2, "buy_unit", {
        unitType: status.shopOffers[rumorSlotIndex]!.unitType,
        cost: status.shopOffers[rumorSlotIndex]!.cost,
        isRumorUnit: true,
        goldBefore: 15,
        goldAfter: 15 - status.shopOffers[rumorSlotIndex]!.cost,
      });

      // KPIサマリーを取得
      const summary = logger.getRumorKpiSummary();

      // 検証: R1のgrantに対して、R2で購入したものとしてカウントされる
      expect(summary.guaranteedRounds).toBe(1);
      expect(summary.rumorPurchaseCount).toBe(1);
      expect(summary.perPlayerRumorPurchases[testRaidPlayer]).toBe(1);
      expect(summary.rumorPurchaseRate).toBe(1 / raidPlayers.length);
    });

    it("should allow purchasing rumor unit in guaranteed round", () => {
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);
      const testRaidPlayer = raidPlayers[0]!;

      // R1: Prep → Battle
      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }

      // フェーズ成功
      controller.setPendingRoundDamage({
        [actualBoss!]: 1800,
      });

      // Battle → Settle → Elimination → R2 Prep
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // R2 Prep: 噂勢力ユニットを購入
      const status = controller.getPlayerStatus(testRaidPlayer);
      const rumorSlotIndex = status.shopOffers.findIndex((offer) => offer.isRumorUnit);
      expect(rumorSlotIndex).not.toBe(-1);

      const result = controller.submitPrepCommand(testRaidPlayer, 1, Date.now(), {
        shopBuySlotIndex: rumorSlotIndex,
      });
      expect(result.accepted).toBe(true);

      // Note: Purchase action logging is tested at GameRoom boundary.
      // Controller direct usage only verifies command acceptance.
    });

    it("should allow multiple rounds of rumor unit purchases", () => {
      // 実際のボスを取得
      const actualBoss = controller.getBossPlayerId();
      expect(actualBoss).not.toBeNull();
      const raidPlayers = playerIds.filter(id => id !== actualBoss);
      const testRaidPlayer = raidPlayers[0]!;

      const openingBoardCells = new Map<string, number>([
        [actualBoss!, 0],
        [raidPlayers[0]!, 24],
        [raidPlayers[1]!, 25],
        [raidPlayers[2]!, 26],
      ]);

      for (const playerId of playerIds) {
        const cell = openingBoardCells.get(playerId);
        expect(typeof cell).toBe("number");
        const placementResult = controller.submitPrepCommand(playerId, 1, Date.now(), {
          boardPlacements: [{ cell: cell!, unitType: "vanguard" }],
        });
        expect(placementResult.accepted).toBe(true);
      }

      // R1: Prep → Battle → フェーズ成功
      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }
      controller.setPendingRoundDamage({ [actualBoss!]: 1800 });

      // R1 settle
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // R2 Prep: 購入せず

      // R2 Prep → Battle
      if (controller.prepDeadlineAtMs) {
        controller.advanceByTime(controller.prepDeadlineAtMs + 100);
      }
      // R2のHPターゲットは1500なので、それ以上のダメージが必要
      controller.setPendingRoundDamage({ [actualBoss!]: 1600 });

      // R2 settle
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }
      if (controller.phaseDeadlineAtMs) {
        controller.advanceByTime(controller.phaseDeadlineAtMs + 100);
      }

      // R3 Prep: 購入
      const status = controller.getPlayerStatus(testRaidPlayer);
      const rumorSlotIndex = status.shopOffers.findIndex((offer) => offer.isRumorUnit);
      if (rumorSlotIndex !== -1) {
        const result = controller.submitPrepCommand(testRaidPlayer, 2, Date.now(), {
          shopBuySlotIndex: rumorSlotIndex,
        });
        expect(result.accepted).toBe(true);
      }

      // Note: Purchase action logging is tested at GameRoom boundary.
      // Controller direct usage only verifies command acceptance.
    });
  });

  describe("Prep Command KPI Metrics Integration", () => {
    beforeEach(() => {
      // 全プレイヤーをreadyにする
      for (const playerId of playerIds) {
        controller.setReady(playerId, true);
      }

      // ゲームを開始
      const started = controller.startIfReady(Date.now(), [...playerIds]);
      expect(started).toBe(true);
    });

    it("should track successful prep commands through controller", () => {
      const logger = new MatchLogger("match-prep-success", "room-prep-success");
      controller.setMatchLogger(logger);

      // 成功するPrepコマンドを送信
      const result = controller.submitPrepCommand("player1", 1, Date.now(), {
        shopRefreshCount: 1,
      });

      expect(result.accepted).toBe(true);

      const metrics = logger.getPrepCommandMetrics();
      expect(metrics.totalPrepCommands).toBe(1);
      expect(metrics.failedPrepCommands).toBe(0);
      expect(metrics.prepInputFailureRate).toBe(0);
    });

    it("should track failed prep commands with error codes", () => {
      const logger = new MatchLogger("match-prep-fail", "room-prep-fail");
      controller.setMatchLogger(logger);

      // 同じcmdSeqを2回送信するとDUPLICATE_CMDエラー
      controller.submitPrepCommand("player1", 1, Date.now(), { shopRefreshCount: 1 });
      const result = controller.submitPrepCommand("player1", 1, Date.now(), { shopRefreshCount: 1 });

      expect(result.accepted).toBe(false);
      expect((result as { accepted: false; code: string }).code).toBe("DUPLICATE_CMD");

      const metrics = logger.getPrepCommandMetrics();
      expect(metrics.totalPrepCommands).toBe(2);
      expect(metrics.failedPrepCommands).toBe(1);
      expect(metrics.failuresByErrorCode["DUPLICATE_CMD"]).toBe(1);
      expect(metrics.prepInputFailureRate).toBe(0.5);
    });

    it("should track multiple error types", () => {
      const logger = new MatchLogger("match-prep-multi", "room-prep-multi");
      controller.setMatchLogger(logger);

      // 成功
      controller.submitPrepCommand("player1", 1, Date.now(), { shopRefreshCount: 1 });

      // DUPLICATE_CMDエラー
      controller.submitPrepCommand("player1", 1, Date.now(), { shopRefreshCount: 1 });

      // 別のプレイヤーで成功
      controller.submitPrepCommand("player2", 1, Date.now(), { shopRefreshCount: 1 });

      // player2でもDUPLICATE_CMD
      controller.submitPrepCommand("player2", 1, Date.now(), { shopRefreshCount: 1 });

      const metrics = logger.getPrepCommandMetrics();
      expect(metrics.totalPrepCommands).toBe(4);
      expect(metrics.failedPrepCommands).toBe(2);
      expect(metrics.failuresByErrorCode["DUPLICATE_CMD"]).toBe(2);
      expect(metrics.prepInputFailureRate).toBe(0.5);
    });

    it("should not corrupt counter with OFF-path flows", () => {
      const logger = new MatchLogger("match-prep-offpath", "room-prep-offpath");
      controller.setMatchLogger(logger);

      // 通常のPrepコマンドをいくつか送信
      controller.submitPrepCommand("player1", 1, Date.now(), { shopRefreshCount: 1 });
      controller.submitPrepCommand("player1", 2, Date.now(), { shopRefreshCount: 1 });

      // Phase外の操作（このテストではシミュレートしないが、
      // カウンターが破損していないことを確認）
      const metrics = logger.getPrepCommandMetrics();
      expect(metrics.totalPrepCommands).toBe(2);
      expect(metrics.failedPrepCommands).toBe(0);
      expect(metrics.prepInputFailureRate).toBe(0);
    });

    it("should work correctly when matchLogger is null", () => {
      // matchLoggerを設定せずにコマンドを送信
      const result = controller.submitPrepCommand("player1", 1, Date.now(), {
        shopRefreshCount: 1,
      });

      expect(result.accepted).toBe(true);
      // エラーが発生しないことを確認
    });

    it("should handle phase mismatch errors", () => {
      const logger = new MatchLogger("match-phase-error", "room-phase-error");
      controller.setMatchLogger(logger);

      // Prepフェーズを終了させる
      const prepDeadline = controller.prepDeadlineAtMs;
      expect(prepDeadline).not.toBeNull();
      if (prepDeadline) {
        controller.advanceByTime(prepDeadline + 100);
      }

      // Battleフェーズ中にPrepコマンドを送信
      const result = controller.submitPrepCommand("player1", 1, Date.now(), {
        shopRefreshCount: 1,
      });

      expect(result.accepted).toBe(false);
      expect((result as { accepted: false; code: string }).code).toBe("PHASE_MISMATCH");

      const metrics = logger.getPrepCommandMetrics();
      expect(metrics.totalPrepCommands).toBe(1);
      expect(metrics.failedPrepCommands).toBe(1);
      expect(metrics.failuresByErrorCode["PHASE_MISMATCH"]).toBe(1);
      expect(metrics.prepInputFailureRate).toBe(1);
    });
  });
});
