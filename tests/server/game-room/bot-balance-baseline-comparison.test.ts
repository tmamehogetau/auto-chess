import { describe, expect, test } from "vitest";

import {
  buildBotBalanceBaselineVariantComparison,
  buildBotBalanceBaselineVariantComparisonMarkdown,
} from "./bot-balance-baseline-comparison";
import type { BotBalanceBaselineSummary } from "./bot-balance-baseline-human-report";

const createSummary = (
  optimizationVariant: BotBalanceBaselineSummary["optimizationVariant"],
  overrides: {
    bossWinRate: number;
    averageRounds: number;
    boardRefitSamples?: number;
    boardRefitRecommended?: number;
    boardRefitCommitted?: number;
    bossBoardRefitSamples?: number;
    bossBoardRefitRecommended?: number;
    raidBoardRefitSamples?: number;
    raidBoardRefitRecommended?: number;
    okinaSamples?: number;
    okinaRecommended?: number;
    bossAssetValue?: number;
    raidAssetValue?: number;
    bossNormalShopSpend?: number;
    raidNormalShopSpend?: number;
    highCostOffers?: number;
    highCostPurchases?: number;
  },
): BotBalanceBaselineSummary => ({
  requestedMatchCount: 100,
  chunkSize: 5,
  parallelism: 12,
  portOffsetBase: 10_000,
  bossPolicy: "strength",
  raidPolicies: ["strength", "strength", "strength"],
  optimizationVariant,
  helperConfigs: [
    { wantsBoss: true, policy: "strength" },
    { wantsBoss: false, policy: "strength" },
    { wantsBoss: false, policy: "strength" },
    { wantsBoss: false, policy: "strength" },
  ],
  chunkCount: 20,
  outputDir: `C:\\tmp\\${optimizationVariant}`,
  failures: [],
  chunks: [],
  aggregate: ({
    completedMatches: 100,
    abortedMatches: 0,
    bossWins: Math.round(overrides.bossWinRate * 100),
    raidWins: 100 - Math.round(overrides.bossWinRate * 100),
    bossWinRate: overrides.bossWinRate,
    raidWinRate: 1 - overrides.bossWinRate,
    averageRounds: overrides.averageRounds,
    boardRefitDecisionRoundMetrics: [{
      roundIndex: 6,
      samples: overrides.boardRefitSamples ?? 0,
      boardFullSamples: overrides.boardRefitSamples ?? 0,
      attemptSamples: overrides.boardRefitSamples ?? 0,
      recommendedReplacementSamples: overrides.boardRefitRecommended ?? 0,
      committedSamples: overrides.boardRefitCommitted ?? 0,
      futureCandidateKeptCount: 0,
      averageBenchPressure: 0,
      averageReplacementScore: null,
      p25ReplacementScore: null,
      p50ReplacementScore: null,
      p75ReplacementScore: null,
      mostFrequentIncomingUnitId: null,
      mostFrequentIncomingUnitName: null,
      mostFrequentIncomingSamples: 0,
      mostFrequentOutgoingUnitId: null,
      mostFrequentOutgoingUnitName: null,
      mostFrequentOutgoingSamples: 0,
    }],
    boardRefitDecisionRoleMetrics: [
      {
        role: "boss",
        samples: overrides.bossBoardRefitSamples ?? 0,
        boardFullSamples: overrides.bossBoardRefitSamples ?? 0,
        attemptSamples: overrides.bossBoardRefitSamples ?? 0,
        recommendedReplacementSamples: overrides.bossBoardRefitRecommended ?? 0,
        committedSamples: 0,
        futureCandidateKeptCount: 0,
        averageBenchPressure: 0,
        averageReplacementScore: null,
        p25ReplacementScore: null,
        p50ReplacementScore: null,
        p75ReplacementScore: null,
        mostFrequentIncomingUnitId: null,
        mostFrequentIncomingUnitName: null,
        mostFrequentIncomingSamples: 0,
        mostFrequentOutgoingUnitId: null,
        mostFrequentOutgoingUnitName: null,
        mostFrequentOutgoingSamples: 0,
      },
      {
        role: "raid",
        samples: overrides.raidBoardRefitSamples ?? 0,
        boardFullSamples: overrides.raidBoardRefitSamples ?? 0,
        attemptSamples: overrides.raidBoardRefitSamples ?? 0,
        recommendedReplacementSamples: overrides.raidBoardRefitRecommended ?? 0,
        committedSamples: 0,
        futureCandidateKeptCount: 0,
        averageBenchPressure: 0,
        averageReplacementScore: null,
        p25ReplacementScore: null,
        p50ReplacementScore: null,
        p75ReplacementScore: null,
        mostFrequentIncomingUnitId: null,
        mostFrequentIncomingUnitName: null,
        mostFrequentIncomingSamples: 0,
        mostFrequentOutgoingUnitId: null,
        mostFrequentOutgoingUnitName: null,
        mostFrequentOutgoingSamples: 0,
      },
    ],
    okinaHeroSubDecisionRoundMetrics: [{
      roundIndex: 4,
      samples: overrides.okinaSamples ?? 0,
      actionRecommendedSamples: overrides.okinaRecommended ?? 0,
      noCandidateSamples: 0,
      frontValuePreferredSamples: 0,
      currentHostKeptSamples: 0,
      averageCandidateCount: 0,
      averageFrontEquivalentValue: 0,
      averageBestHostGain: null,
      averageBestHostCurrentPowerScore: null,
      averageBestHostFutureValueScore: null,
      averageBestHostTransitionReadinessScore: null,
      averageBestHostProtectionScore: null,
      averageBestToFrontRatio: null,
      mostFrequentBestHostUnitId: null,
      mostFrequentBestHostUnitName: null,
      mostFrequentBestHostSamples: 0,
    }],
    finalPlayerBoardMetrics: [
      {
        label: "P1",
        role: "boss",
        matchesPresent: 100,
        averageDeployedUnitCount: 6,
        averageDeployedAssetValue: overrides.bossAssetValue ?? 0,
        averageSpecialUnitCount: 1,
        averageStandardUnitCount: 5,
      },
      {
        label: "P2",
        role: "raid",
        matchesPresent: 100,
        averageDeployedUnitCount: 3,
        averageDeployedAssetValue: overrides.raidAssetValue ?? 0,
        averageSpecialUnitCount: 1,
        averageStandardUnitCount: 2,
      },
    ],
    playerEconomyBreakdowns: {
      P1: {
        fixedPrepIncome: 0,
        raidPhaseSuccessBonusIncome: 0,
        sellIncome: 0,
        specialEconomyIncome: 0,
        normalShopSpend: overrides.bossNormalShopSpend ?? 0,
        bossShopSpend: 0,
        refreshSpend: 0,
        specialUnitUpgradeSpend: 0,
        otherSpend: 0,
        loggedGoldGain: 0,
        loggedGoldSpent: 0,
        finalUnusedGold: 0,
      },
      P2: {
        fixedPrepIncome: 0,
        raidPhaseSuccessBonusIncome: 0,
        sellIncome: 0,
        specialEconomyIncome: 0,
        normalShopSpend: overrides.raidNormalShopSpend ?? 0,
        bossShopSpend: 0,
        refreshSpend: 0,
        specialUnitUpgradeSpend: 0,
        otherSpend: 0,
        loggedGoldGain: 0,
        loggedGoldSpent: 0,
        finalUnusedGold: 0,
      },
    },
    highCostSummary: {
      offerObservationCount: overrides.highCostOffers ?? 0,
      offerMatchCount: 0,
      purchaseCount: overrides.highCostPurchases ?? 0,
      purchaseMatchCount: 0,
      finalBoardCopies: 0,
      finalBoardMatchCount: 0,
      finalBoardAdoptionRate: 0,
    },
  } as unknown) as BotBalanceBaselineSummary["aggregate"],
});

describe("bot balance baseline comparison", () => {
  test("compares optimization variants against the full baseline", () => {
    const comparison = buildBotBalanceBaselineVariantComparison([
      createSummary("full", {
        bossWinRate: 0.4,
        averageRounds: 11.5,
        boardRefitSamples: 20,
        boardRefitRecommended: 5,
        boardRefitCommitted: 2,
        bossBoardRefitSamples: 12,
        bossBoardRefitRecommended: 6,
        raidBoardRefitSamples: 8,
        raidBoardRefitRecommended: 1,
        okinaSamples: 10,
        okinaRecommended: 4,
        bossAssetValue: 24,
        raidAssetValue: 13,
        bossNormalShopSpend: 12,
        raidNormalShopSpend: 30,
        highCostOffers: 10,
        highCostPurchases: 3,
      }),
      createSummary("raid-optimization-off", {
        bossWinRate: 0.27,
        averageRounds: 11.9,
        boardRefitSamples: 4,
        boardRefitRecommended: 0,
        bossAssetValue: 21,
        raidAssetValue: 10,
      }),
      createSummary("boss-optimization-off", {
        bossWinRate: 0.36,
        averageRounds: 11.55,
        boardRefitSamples: 8,
        boardRefitRecommended: 1,
        bossAssetValue: 22,
        raidAssetValue: 12,
      }),
    ], { historicalBossWinRate: 0.56 });

    expect(comparison.variants).toEqual([
      expect.objectContaining({
        optimizationVariant: "full",
        bossWinRateDelta: 0,
        historicalBossWinRateDelta: -0.16,
        boardRefitRecommendationRate: 0.25,
        boardRefitCommitRate: 0.1,
        bossBoardRefitRecommendationRate: 0.5,
        raidBoardRefitRecommendationRate: 0.125,
        okinaActionRecommendationRate: 0.4,
        bossAverageDeployedAssetValue: 24,
        raidAverageDeployedAssetValue: 13,
        highCostPurchaseRate: 0.3,
        bossNormalShopSpend: 12,
        raidNormalShopSpend: 30,
      }),
      expect.objectContaining({
        optimizationVariant: "raid-optimization-off",
        bossWinRateDelta: -0.13,
        averageRoundsDelta: 0.4,
      }),
      expect.objectContaining({
        optimizationVariant: "boss-optimization-off",
        bossWinRateDelta: -0.04,
        averageRoundsDelta: 0.05,
      }),
    ]);
    expect(comparison.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "current_full_below_historical_baseline" }),
      expect.objectContaining({ code: "raid_optimization_not_primary" }),
      expect.objectContaining({ code: "boss_optimization_not_primary" }),
    ]));
  });

  test("renders markdown with variant deltas and signals", () => {
    const markdown = buildBotBalanceBaselineVariantComparisonMarkdown(
      buildBotBalanceBaselineVariantComparison([
        createSummary("full", { bossWinRate: 0.4, averageRounds: 11.5 }),
        createSummary("raid-optimization-off", { bossWinRate: 0.27, averageRounds: 11.9 }),
      ], { historicalBossWinRate: 0.56 }),
    );

    expect(markdown).toContain("# Bot Balance Baseline Variant Comparison");
    expect(markdown).toContain("Boss refit recommend");
    expect(markdown).toContain("Raid refit recommend");
    expect(markdown).toContain("| full | 100 | 0 | 40.0% | +0.0pt | -16.0pt | 11.5 | +0 |");
    expect(markdown).toContain("| raid-optimization-off | 100 | 0 | 27.0% | -13.0pt | -29.0pt | 11.9 | +0.4 |");
    expect(markdown).toContain("raid_optimization_not_primary");
  });
});
