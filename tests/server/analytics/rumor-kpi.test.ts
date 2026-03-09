/**
 * 噂勢力 KPI サマリーテスト
 * 
 * Test Strategy:
 * - 各メトリクスを独立してテスト
 * - テストデータは意味が明確な最小構成
 * - 重複セットアップはヘルパーで共通化
 * 
 * Key behavior:
 * - opportunity key は (grantRoundIndex, playerId)
 * - rumor purchase は next Prep (round R+1) で記録される
 * - grantRoundIndex = action.roundIndex - 1 で正規化して結びつける
 * - ボスは grantedPlayerIds に含まれないため分母に入らない
 */

import { describe, it, expect } from "vitest";
import {
  buildRumorKpiSummary,
  type RumorKpiSummary,
} from "../../../src/server/analytics/rumor-kpi";
import type {
  RoundSummaryLog,
  PlayerActionLog,
} from "../../../src/server/match-logger";

// ============================================
// Test Fixtures
// ============================================

/** シンプルなバトル作成 */
function battle(
  roundIndex: number,
  left: string,
  right: string,
): RoundSummaryLog["battles"][0] {
  return {
    matchId: "m1",
    roundIndex,
    battleIndex: 0,
    leftPlayerId: left,
    rightPlayerId: right,
    winner: "draw",
    leftDamageDealt: 0,
    rightDamageDealt: 0,
    leftSurvivors: 0,
    rightSurvivors: 0,
  };
}

/** ラウンドログ作成 - guaranteed=true版（grantedPlayerIds付き） */
function guaranteedRound(
  roundIndex: number,
  participants: [string, string][],
  grantedPlayerIds?: string[],
): RoundSummaryLog {
  return {
    matchId: "m1",
    roundIndex,
    phase: "Battle",
    timestamp: 0,
    durationMs: 0,
    battles: participants.map(([l, r], i) => ({
      matchId: "m1",
      roundIndex,
      battleIndex: i,
      leftPlayerId: l,
      rightPlayerId: r,
      winner: "draw",
      leftDamageDealt: 0,
      rightDamageDealt: 0,
      leftSurvivors: 0,
      rightSurvivors: 0,
    })),
    eliminations: [],
    guaranteedRumorSlotApplied: true,
    rumorFactions: ["vanguard"],
    grantedPlayerIds: grantedPlayerIds ?? participants.flat(),
  };
}

/** ラウンドログ作成 - guaranteed=false版 */
function normalRound(
  roundIndex: number,
  participants: [string, string][],
): RoundSummaryLog {
  const base = guaranteedRound(roundIndex, participants);
  return {
    ...base,
    guaranteedRumorSlotApplied: false,
    rumorFactions: [],
    // grantedPlayerIds は明示的に設定しない（undefined）
  };
}

/** 噂勢力購入アクション作成
 * 
 * grant round R の opportunity を使った購入は、
 * next Prep (round R+1) で記録される
 */
function rumorBuy(
  roundIndex: number,
  playerId: string,
): PlayerActionLog {
  return {
    matchId: "m1",
    roomId: "r1",
    roundIndex,
    playerId,
    actionType: "buy_unit",
    timestamp: 0,
    details: { unitType: "vanguard", cost: 3, isRumorUnit: true, goldBefore: 10, goldAfter: 7 },
  };
}

/** 通常購入アクション作成 */
function normalBuy(
  roundIndex: number,
  playerId: string,
): PlayerActionLog {
  return {
    ...rumorBuy(roundIndex, playerId),
    details: { unitType: "vanguard", cost: 3, isRumorUnit: false, goldBefore: 10, goldAfter: 7 },
  };
}

// ============================================
// Tests
// ============================================

describe("buildRumorKpiSummary", () => {
  describe("guaranteedRounds (global count)", () => {
    it("counts only rounds with guaranteedRumorSlotApplied=true", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]]),
        normalRound(2, [["a", "b"]]),
        guaranteedRound(3, [["a", "b"]]),
      ], []);

      expect(summary.guaranteedRounds).toBe(2);
    });

    it("returns 0 when no guaranteed rounds", () => {
      const summary = buildRumorKpiSummary([
        normalRound(1, [["a", "b"]]),
      ], []);

      expect(summary.guaranteedRounds).toBe(0);
    });
  });

  describe("perPlayerGuaranteedRounds", () => {
    it("counts guaranteed rounds using grantedPlayerIds", () => {
      // R1: guaranteed, granted to ["a", "b"] (boss "c" excluded)
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"], ["c", "d"]], ["a", "b"]),
      ], []);

      expect(summary.perPlayerGuaranteedRounds).toEqual({
        a: 1,
        b: 1,
        c: 0, // not in grantedPlayerIds
        d: 0, // not in grantedPlayerIds
      });
    });

    it("excludes boss from guaranteed rounds", () => {
      // R1: guaranteed, participants include boss, but grantedPlayerIds excludes boss
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["boss", "raid1"], ["raid2", "raid3"]], ["raid1", "raid2", "raid3"]),
      ], []);

      expect(summary.perPlayerGuaranteedRounds).toEqual({
        boss: 0, // boss excluded
        raid1: 1,
        raid2: 1,
        raid3: 1,
      });
    });

    it("returns 0 for players who never in grantedPlayerIds", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [rumorBuy(2, "c")]); // c never granted

      expect(summary.perPlayerGuaranteedRounds).toEqual({
        a: 1,
        b: 1,
        c: 0,
      });
    });
  });

  describe("rumorPurchaseCount", () => {
    it("counts buy_unit with isRumorUnit=true", () => {
      // grant round 1 → purchase recorded in round 2
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"), // grant round 1, purchase round 2
        rumorBuy(2, "b"), // grant round 1, purchase round 2
      ]);

      expect(summary.rumorPurchaseCount).toBe(2);
    });

    it("excludes non-rumor purchases", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"),
        normalBuy(2, "b"),
      ]);

      expect(summary.rumorPurchaseCount).toBe(1);
    });

    it("deduplicates multiple buys by same player in same opportunity", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"), // grant round 1
        rumorBuy(2, "a"), // duplicate - ignored
      ]);

      expect(summary.rumorPurchaseCount).toBe(1);
    });

    it("normalizes action roundIndex to grantRoundIndex (action.roundIndex - 1)", () => {
      // grant round 1, purchase in round 2 → matched as grant round 1
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"), // grant round 1 (2-1=1)
      ]);

      expect(summary.rumorPurchaseCount).toBe(1);
      expect(summary.opportunitiesWithoutPurchase).toBe(1); // b didn't purchase
    });

    it("ignores purchases without corresponding opportunity", () => {
      // purchase in round 2, but no grant in round 1
      const summary = buildRumorKpiSummary([
        normalRound(1, [["a", "b"]]), // not guaranteed
      ], [
        rumorBuy(2, "a"), // no matching grant opportunity
      ]);

      expect(summary.rumorPurchaseCount).toBe(0);
    });
  });

  describe("perPlayerRumorPurchases", () => {
    it("counts unique opportunity purchases per player", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
        guaranteedRound(2, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"), // grant round 1
        rumorBuy(3, "a"), // grant round 2
        rumorBuy(2, "b"), // grant round 1
      ]);

      expect(summary.perPlayerRumorPurchases).toEqual({
        a: 2,
        b: 1,
      });
    });
  });

  describe("opportunitiesWithoutPurchase", () => {
    it("counts opportunities with guaranteed grant but no purchase", () => {
      // R1: guaranteed, granted to ["a", "b"]
      // Only a purchased (in round 2)
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"), // grant round 1
      ]);

      // Opportunities: (R1,a), (R1,b) = 2
      // Purchases: (R1,a) = 1
      // Without purchase: 1
      expect(summary.opportunitiesWithoutPurchase).toBe(1);
    });

    it("returns 0 when all opportunities have purchases", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"),
        rumorBuy(2, "b"),
      ]);

      expect(summary.opportunitiesWithoutPurchase).toBe(0);
    });

    it("excludes non-guaranteed rounds", () => {
      const summary = buildRumorKpiSummary([
        normalRound(1, [["a", "b"]]), // not guaranteed
      ], []);

      expect(summary.opportunitiesWithoutPurchase).toBe(0);
    });
  });

  describe("rumorPurchaseRate (opportunity-based)", () => {
    it("calculates rate as purchases / total opportunities", () => {
      // R1: guaranteed, granted to ["a", "b"]
      // R2: guaranteed, granted to ["a", "b"]
      // 1 purchase out of 4 opportunities
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
        guaranteedRound(2, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"), // grant round 1
      ]);

      expect(summary.rumorPurchaseRate).toBe(0.25); // 1/4
    });

    it("returns 1.0 when all opportunities have purchases", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["a", "b"]], ["a", "b"]),
      ], [
        rumorBuy(2, "a"),
        rumorBuy(2, "b"),
      ]);

      expect(summary.rumorPurchaseRate).toBe(1);
    });

    it("returns 0 when no opportunities", () => {
      const summary = buildRumorKpiSummary([
        normalRound(1, [["a", "b"]]),
      ], []);

      expect(summary.rumorPurchaseRate).toBe(0);
    });
  });

  describe("end-to-end scenarios", () => {
    it("complex scenario with multiple rounds and purchases", () => {
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["p1", "p2"], ["p3", "p4"]], ["p1", "p2", "p3", "p4"]), // 4 opportunities
        guaranteedRound(2, [["p1", "p2"]], ["p1", "p2"]), // 2 opportunities
        normalRound(3, [["p3", "p4"]]), // 0 opportunities (not guaranteed)
      ], [
        rumorBuy(2, "p1"), // grant round 1
        rumorBuy(2, "p1"), // duplicate - ignored
        rumorBuy(3, "p2"), // grant round 2
        normalBuy(2, "p3"), // non-rumor - ignored
      ]);

      expect(summary.guaranteedRounds).toBe(2);
      expect(summary.perPlayerGuaranteedRounds).toEqual({
        p1: 2, p2: 2, p3: 1, p4: 1,
      });
      expect(summary.rumorPurchaseCount).toBe(2);
      expect(summary.perPlayerRumorPurchases).toEqual({
        p1: 1, p2: 1, p3: 0, p4: 0,
      });
      expect(summary.opportunitiesWithoutPurchase).toBe(4); // 6 opportunities - 2 purchases
      expect(summary.rumorPurchaseRate).toBe(2 / 6); // purchases / total opportunities
    });

    it("boss is excluded from opportunities and denominator", () => {
      // boss "b", raids ["r1", "r2", "r3"]
      // grantedPlayerIds excludes boss
      const summary = buildRumorKpiSummary([
        guaranteedRound(1, [["b", "r1"], ["r2", "r3"]], ["r1", "r2", "r3"]),
      ], [
        rumorBuy(2, "r1"),
        rumorBuy(2, "r2"),
      ]);

      expect(summary.perPlayerGuaranteedRounds).toEqual({
        b: 0, // boss excluded
        r1: 1,
        r2: 1,
        r3: 1,
      });
      expect(summary.rumorPurchaseCount).toBe(2);
      expect(summary.opportunitiesWithoutPurchase).toBe(1); // r3 didn't purchase
      expect(summary.rumorPurchaseRate).toBe(2 / 3); // 2 purchases / 3 opportunities
    });
  });
});
