/**
 * ゲームプレイ KPI テスト
 * 
 * Test Strategy:
 * - 純粋ヘルパー関数の独立したテスト
 * - 最小限のテストデータで明確な意味を持たせる
 * - エッジケース（空の入力、無効な状態）をカバー
 */

import { describe, it, expect } from "vitest";
import {
  calculateR8CompletionRate,
  buildTop1CompositionSignature,
  type GameplayKpiSummary,
  buildGameplayKpiSummary,
} from "../../../src/server/analytics/gameplay-kpi";
import type {
  MatchSummaryLog,
  PlayerMatchSummary,
} from "../../../src/server/match-logger";

// ============================================
// Test Fixtures
// ============================================

/** プレイヤーサマリー作成ヘルパー */
function playerSummary(
  playerId: string,
  rank: number,
  roundsSurvived: number,
  finalBoardUnits: PlayerMatchSummary["finalBoardUnits"],
): PlayerMatchSummary {
  return {
    playerId,
    rank,
    finalHp: rank === 1 ? 100 : 0,
    maxHp: 100,
    totalGoldEarned: 50,
    totalGoldSpent: 40,
    unitsPurchased: 10,
    unitsSold: 2,
    roundsSurvived,
    battleWins: 5,
    battleLosses: 3,
    selectedHeroId: null,
    finalBoardUnits: finalBoardUnits.map((u) => ({ ...u, items: [...u.items] })),
    finalBenchUnits: [],
  };
}

/** マッチサマリーログ作成ヘルパー
 * @param explicitWinner - 明示的に指定するwinner。undefinedの場合はランク1のプレイヤーが自動選択される
 */
function matchSummary(
  totalRounds: number,
  players: PlayerMatchSummary[],
  explicitWinner: string | null | undefined = undefined,
): MatchSummaryLog {
  const winner = explicitWinner !== undefined
    ? explicitWinner
    : (players.find((p) => p.rank === 1)?.playerId ?? null);

  return {
    matchId: "m1",
    roomId: "r1",
    timestamp: Date.now(),
    startTime: Date.now() - 60000,
    durationMs: 60000,
    winner,
    ranking: players.sort((a, b) => a.rank - b.rank).map((p) => p.playerId),
    totalRounds,
    players: players.map((p) => ({
      ...p,
      finalBoardUnits: p.finalBoardUnits.map((u) => ({ ...u, items: [...u.items] })),
      finalBenchUnits: p.finalBenchUnits.map((u) => ({ ...u, items: [...u.items] })),
    })),
    featureFlags: {
      enableHeroSystem: false,
      enableSharedPool: false,
      enablePerUnitSharedPool: false,
      enableSpellCard: false,
      enableRumorInfluence: false,
      enableBossExclusiveShop: false,
    },
  };
}

// ============================================
// Tests: calculateR8CompletionRate
// ============================================

describe("calculateR8CompletionRate", () => {
  it("returns 1.0 when roundsSurvived >= 8 (R8到達)", () => {
    expect(calculateR8CompletionRate(8, 8)).toBe(1.0);
    expect(calculateR8CompletionRate(10, 10)).toBe(1.0);
    expect(calculateR8CompletionRate(12, 10)).toBe(1.0); // exceeds total
  });

  it("returns 0.0 when roundsSurvived < 8 (R8未到達)", () => {
    expect(calculateR8CompletionRate(7, 10)).toBe(0.0);
    expect(calculateR8CompletionRate(5, 8)).toBe(0.0);
    expect(calculateR8CompletionRate(0, 5)).toBe(0.0);
    expect(calculateR8CompletionRate(3, 3)).toBe(0.0); // survivor but < 8
  });

  it("ignores totalRounds (uses roundsSurvived only)", () => {
    // W6-2: R8到達はラウンド8以上生存かどうか（総ラウンド数に依存しない）
    expect(calculateR8CompletionRate(8, 5)).toBe(1.0); // 8 rounds even if match ended at 5
    expect(calculateR8CompletionRate(7, 12)).toBe(0.0); // 7 rounds even if match continued to 12
  });
});

// ============================================
// Tests: buildTop1CompositionSignature
// ============================================

describe("buildTop1CompositionSignature", () => {
  it("returns signature from top-ranked player's board units", () => {
    const players = [
      playerSummary("p2", 2, 5, [
        { unitType: "loser-unit", starLevel: 1, cell: 0, items: [] },
      ]),
      playerSummary("p1", 1, 8, [
        { unitType: "vanguard", starLevel: 2, cell: 0, items: [] },
        { unitType: "ranger", starLevel: 1, cell: 1, items: [] },
      ]),
    ];
    const summary = matchSummary(8, players, "p1");

    const signature = buildTop1CompositionSignature(summary);

    expect(signature).toEqual([
      { unitType: "vanguard", starLevel: 2 },
      { unitType: "ranger", starLevel: 1 },
    ]);
  });

  it("returns empty array when no players exist", () => {
    const summary = matchSummary(8, [], null);
    const signature = buildTop1CompositionSignature(summary);
    expect(signature).toEqual([]);
  });

  it("returns empty array when top player has no board units", () => {
    const players = [
      playerSummary("p1", 1, 8, []),
      playerSummary("p2", 2, 5, [
        { unitType: "has-units", starLevel: 1, cell: 0, items: [] },
      ]),
    ];
    const summary = matchSummary(8, players, "p1");

    const signature = buildTop1CompositionSignature(summary);

    expect(signature).toEqual([]);
  });

  it("returns empty array when winner is null", () => {
    const players = [
      playerSummary("p1", 1, 8, [
        { unitType: "vanguard", starLevel: 2, cell: 0, items: [] },
      ]),
    ];
    const summary = matchSummary(8, players, null);

    const signature = buildTop1CompositionSignature(summary);

    expect(signature).toEqual([]);
  });

  it("sorts units by cell ascending for deterministic order", () => {
    const players = [
      playerSummary("p1", 1, 8, [
        { unitType: "middle", starLevel: 1, cell: 5, items: [] },
        { unitType: "first", starLevel: 3, cell: 2, items: [] },
        { unitType: "last", starLevel: 2, cell: 8, items: [] },
      ]),
    ];
    const summary = matchSummary(8, players, "p1");

    const signature = buildTop1CompositionSignature(summary);

    // cell昇順: 2 → 5 → 8
    expect(signature).toEqual([
      { unitType: "first", starLevel: 3 },
      { unitType: "middle", starLevel: 1 },
      { unitType: "last", starLevel: 2 },
    ]);
  });

  it("filters out items from signature (only unitType and starLevel)", () => {
    const players = [
      playerSummary("p1", 1, 8, [
        { unitType: "vanguard", starLevel: 2, cell: 0, items: ["sword", "shield"] },
      ]),
    ];
    const summary = matchSummary(8, players, "p1");

    const signature = buildTop1CompositionSignature(summary);

    expect(signature).toEqual([{ unitType: "vanguard", starLevel: 2 }]);
    // Verify items are not present
    expect((signature[0] as unknown as Record<string, unknown>).items).toBeUndefined();
  });

  it("finds winner by winner field, not just rank 1", () => {
    // Edge case: ranking order might differ from winner
    const players = [
      playerSummary("p1", 1, 8, [
        { unitType: "rank1-unit", starLevel: 1, cell: 0, items: [] },
      ]),
      playerSummary("p2", 2, 8, [
        { unitType: "actual-winner-unit", starLevel: 2, cell: 0, items: [] },
      ]),
    ];
    // Winner is p2 even though p1 is rank 1 in this scenario
    const summary = matchSummary(8, players, "p2");

    const signature = buildTop1CompositionSignature(summary);

    expect(signature).toEqual([{ unitType: "actual-winner-unit", starLevel: 2 }]);
  });
});

// ============================================
// Tests: buildGameplayKpiSummary
// ============================================

describe("buildGameplayKpiSummary", () => {
  it("calculates r8CompletionRate and counts for aggregation (R8到達バイナリ)", () => {
    const players = [
      playerSummary("p1", 1, 8, [{ unitType: "a", starLevel: 1, cell: 0, items: [] }]),
      playerSummary("p2", 2, 5, [{ unitType: "b", starLevel: 1, cell: 0, items: [] }]),
      playerSummary("p3", 3, 3, [{ unitType: "c", starLevel: 1, cell: 0, items: [] }]),
    ];
    const summary = matchSummary(8, players, "p1");

    const kpi = buildGameplayKpiSummary(summary);

    // W6-2: 集計用カウント
    expect(kpi.playersSurvivedR8).toBe(1); // Only p1 survived 8+ rounds
    expect(kpi.totalPlayers).toBe(3);
    // マッチ単位のR8完走率
    expect(kpi.r8CompletionRate).toBeCloseTo(1 / 3, 3);
  });

  it("includes top1CompositionSignature as string for aggregation", () => {
    const players = [
      playerSummary("p1", 1, 8, [
        { unitType: "vanguard", starLevel: 3, cell: 0, items: [] },
        { unitType: "ranger", starLevel: 2, cell: 1, items: [] },
      ]),
      playerSummary("p2", 2, 5, [{ unitType: "other", starLevel: 1, cell: 0, items: [] }]),
    ];
    const summary = matchSummary(8, players, "p1");

    const kpi = buildGameplayKpiSummary(summary);

    // W6-2: 集計用文字列形式
    expect(kpi.top1CompositionSignature).toBe("vanguard:3,ranger:2");
  });

  it("handles empty match gracefully", () => {
    const summary = matchSummary(0, [], null);

    const kpi = buildGameplayKpiSummary(summary);

    expect(kpi.playersSurvivedR8).toBe(0);
    expect(kpi.totalPlayers).toBe(0);
    expect(kpi.r8CompletionRate).toBe(0);
    expect(kpi.top1CompositionSignature).toBe("");
    expect(kpi.totalRounds).toBe(0);
    expect(kpi.playerCount).toBe(0);
    expect(kpi.failedPrepCommands).toBe(0);
    expect(kpi.totalPrepCommands).toBe(0);
  });

  it("preserves totalRounds and playerCount", () => {
    const players = [
      playerSummary("p1", 1, 10, [{ unitType: "a", starLevel: 1, cell: 0, items: [] }]),
      playerSummary("p2", 2, 7, [{ unitType: "b", starLevel: 1, cell: 0, items: [] }]),
    ];
    const summary = matchSummary(10, players, "p1");

    const kpi = buildGameplayKpiSummary(summary);

    expect(kpi.totalRounds).toBe(10);
    expect(kpi.playerCount).toBe(2);
  });

  it("handles single player match", () => {
    const players = [
      playerSummary("solo", 1, 5, [
        { unitType: "only", starLevel: 2, cell: 0, items: [] },
      ]),
    ];
    const summary = matchSummary(5, players, "solo");

    const kpi = buildGameplayKpiSummary(summary);

    // 5 rounds < 8, so R8 not reached
    expect(kpi.playersSurvivedR8).toBe(0);
    expect(kpi.totalPlayers).toBe(1);
    expect(kpi.r8CompletionRate).toBe(0);
    expect(kpi.top1CompositionSignature).toBe("only:2");
    expect(kpi.playerCount).toBe(1);
  });
});
