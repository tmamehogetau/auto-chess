import { describe, expect, test } from "vitest";

import type { BotOnlyBaselineAggregateReport } from "./bot-balance-baseline-aggregate";
import { buildBotBalanceBaselineAnalysis } from "./bot-balance-baseline-analysis";
import {
  buildBotBalanceBaselineJapaneseJson,
  buildBotBalanceBaselineJapaneseMarkdown,
  buildBotBalanceBaselineRoundDetailsJapaneseMarkdown,
  type BotBalanceBaselineSummary,
} from "./bot-balance-baseline-human-report";

function createSampleAggregate(): BotOnlyBaselineAggregateReport {
  return {
    metadata: {
      mode: "custom",
      timeScale: 0.01,
      timings: {
        readyAutoStartMs: 200,
        prepDurationMs: 900,
        battleDurationMs: 800,
        settleDurationMs: 20,
        eliminationDurationMs: 10,
        selectionTimeoutMs: 200,
      },
    },
    requestedMatchCount: 10,
    completedMatches: 9,
    abortedMatches: 1,
    bossWins: 8,
    raidWins: 1,
    bossWinRate: 8 / 9,
    raidWinRate: 1 / 9,
    averageRounds: 11.5,
    minRounds: 8,
    maxRounds: 12,
    averageRemainingRaidPlayers: 2.5,
    battleMetrics: {
      totalBattles: 9,
      averageBossSurvivorsAtBattleEnd: 1.4,
      averageRaidSurvivorsAtBattleEnd: 2.1,
      bothSidesSurvivedRate: 7 / 9,
      bossWipedRate: 1 / 9,
      raidWipedRate: 2 / 9,
      endReasonCounts: {
        annihilation: 2,
        mutual_annihilation: 0,
        timeout_hp_lead: 5,
        timeout_hp_tie: 1,
        phase_hp_depleted: 1,
        boss_defeated: 0,
        forced: 0,
        unexpected: 0,
      },
    },
    roundHistogram: {
      "8": 1,
      "11": 2,
      "12": 6,
    },
    roundDetails: [{
      matchIndex: 0,
      matchWinnerRole: "boss",
      totalRounds: 12,
      roundIndex: 1,
      battleEndTimeMs: 57,
      phaseHpTarget: 600,
      phaseDamageDealt: 600,
      phaseCompletionRate: 1,
      phaseHpPowerIndex: 800 / 57,
      phaseResult: "failed",
      allRaidPlayersWipedOut: true,
      raidPlayersWipedOut: 3,
      raidPlayersEliminatedAfterRound: 0,
      bossSurvivors: 1,
      raidSurvivors: 0,
      bossTotalDamage: 240,
      raidTotalDamage: 600,
      raidPhaseContributionDamage: 600,
      battleEndReasons: ["phase_hp_depleted"],
      battleWinnerRoles: ["raid"],
      raidPlayerConsequences: [{
        playerId: "raid-a",
        label: "P2",
        role: "raid",
        battleStartUnitCount: 3,
        playerWipedOut: true,
        remainingLivesBefore: 2,
        remainingLivesAfter: 1,
        eliminatedAfter: false,
      }],
      bossBodyFocus: {
        unitId: "remilia",
        unitName: "レミリア",
        cell: 2,
        x: 2,
        y: 0,
        unitLevel: 1,
        damageTaken: 600,
        directPhaseDamage: 600,
        firstDamageAtMs: null,
        defeated: false,
        finalHp: 1200,
      },
      topBossUnits: [{
        playerId: "boss-1",
        label: "P1",
        unitId: "remilia",
        unitName: "レミリア",
        side: "boss",
        totalDamage: 240,
        phaseContributionDamage: 0,
        finalHp: 1200,
        alive: true,
        unitLevel: 1,
      }],
      topRaidUnits: [{
        playerId: "raid-a",
        label: "P2",
        unitId: "marisa",
        unitName: "霧雨魔理沙",
        side: "raid",
        totalDamage: 600,
        phaseContributionDamage: 600,
        finalHp: 0,
        alive: false,
        unitLevel: 1,
      }],
    }],
    playerMetrics: {
      P1: {
        averagePlacement: 1.8,
        firstPlaceRate: 0.3,
        averageRemainingHp: 100,
        averageRemainingLives: 2.1,
        averageFinalGold: 8.4,
        averageGoldEarned: 1.2,
        averageGoldSpent: 13.7,
        averagePurchaseCount: 5.6,
        averageRefreshCount: 2.4,
        averageSellCount: 0.2,
      },
      P2: {
        averagePlacement: 2.2,
        firstPlaceRate: 0.2,
        averageRemainingHp: 95,
        averageRemainingLives: 1.9,
        averageFinalGold: 4.7,
        averageGoldEarned: 0.5,
        averageGoldSpent: 15.1,
        averagePurchaseCount: 6.1,
        averageRefreshCount: 3.3,
        averageSellCount: 0.1,
      },
    },
    bossBattleUnitMetrics: [
      {
        unitId: "patchouli",
        unitType: "mage",
        unitName: "パチュリー・ノーレッジ",
        battleAppearances: 12,
        matchesPresent: 9,
        averageunitLevel: 1.4,
        maxUnitLevel: 4,
        level4ReachRate: 1 / 9,
        level7ReachRate: 0,
        averageDamagePerBattle: 420.5,
        averageDamagePerMatch: 5606.67,
        activeBattleRate: 0.9,
        averageAttackCountPerBattle: 4.2,
        averageBasicSkillActivationsPerBattle: 1.1,
        averageHitCountPerBattle: 3.5,
        averageDamageTakenPerBattle: 180.4,
        averageFirstAttackMs: 145.6,
        averageLifetimeMs: 770.2,
        zeroDamageBattleRate: 0.05,
        survivalRate: 0.95,
        ownerWinRate: 0.66,
        adoptionRate: 1,
      },
    ],
    raidBattleUnitMetrics: [
      {
        unitId: "rin",
        unitType: "rin",
        unitName: "火焔猫燐",
        battleAppearances: 18,
        matchesPresent: 9,
        averageunitLevel: 2.2,
        maxUnitLevel: 7,
        level4ReachRate: 4 / 9,
        level7ReachRate: 1 / 9,
        averageDamagePerBattle: 120.5,
        averageDamagePerMatch: 2410,
        activeBattleRate: 0.75,
        averageAttackCountPerBattle: 2.1,
        averageBasicSkillActivationsPerBattle: 0.6,
        averagePairSkillActivationsPerBattle: 0.2,
        averageHitCountPerBattle: 1.4,
        averageDamageTakenPerBattle: 220.3,
        averageFirstAttackMs: 240.8,
        averageLifetimeMs: 610.5,
        zeroDamageBattleRate: 0.2,
        survivalRate: 0.8,
        ownerWinRate: 0.4,
        adoptionRate: 1,
        subUnitBattleAppearances: 7,
        subUnitMatchesPresent: 5,
        subUnitAdoptionRate: 5 / 9,
      },
    ],
    finalBoardUnitMetrics: [
      {
        unitId: "momoyo",
        unitType: "vanguard",
        unitName: "姫虫百々世",
        totalCopies: 30,
        matchesPresent: 9,
        averageCopiesPerMatch: 3.33,
        adoptionRate: 1,
      },
    ],
    topDamageUnits: [
      {
        unitId: "marisa",
        unitName: "魔理沙",
        side: "raid",
        totalDamage: 120000,
        appearances: 8,
        averageDamagePerMatch: 13333.33,
      },
    ],
    highCostSummary: {
      offerObservationCount: 7,
      offerMatchCount: 5,
      purchaseCount: 3,
      purchaseMatchCount: 2,
      finalBoardCopies: 2,
      finalBoardMatchCount: 2,
      finalBoardAdoptionRate: 2 / 9,
    },
    highCostOfferMetrics: [
      {
        unitId: "junko",
        unitName: "純狐",
        unitType: "vanguard",
        role: "raid",
        source: "shop",
        cost: 4,
        observationCount: 4,
        matchesPresent: 3,
        offeredMatchRate: 3 / 9,
      },
    ],
    shopOfferMetrics: [
      {
        unitId: "patchouli",
        unitName: "パチュリー・ノーレッジ",
        unitType: "mage",
        role: "boss",
        source: "bossShop",
        cost: 4,
        observationCount: 12,
        matchesPresent: 9,
        offeredMatchRate: 1,
        purchaseCount: 5,
        purchaseMatchCount: 5,
        purchaseRate: 5 / 12,
        finalBoardCopies: 4,
        finalBoardMatchCount: 4,
        finalBoardAdoptionRate: 4 / 9,
      },
    ],
    rangeDamageEfficiencyMetrics: [
      {
        side: "boss",
        rangeBand: "range_1",
        battleAppearances: 6,
        totalDamage: 360,
        totalTheoreticalBaseDamage: 600,
        normalizedDamageEfficiency: 0.6,
        totalAttackCount: 9,
        totalTheoreticalAttackCount: 12,
        attackOpportunityUtilization: 0.75,
        averageDamagePerBattle: 60,
        averageFirstAttackMs: 210,
        firstAttackSamples: 5,
        zeroDamageBattleRate: 1 / 6,
      },
      {
        side: "boss",
        rangeBand: "range_2_plus",
        battleAppearances: 4,
        totalDamage: 520,
        totalTheoreticalBaseDamage: 400,
        normalizedDamageEfficiency: 1.3,
        totalAttackCount: 8,
        totalTheoreticalAttackCount: 10,
        attackOpportunityUtilization: 0.8,
        averageDamagePerBattle: 130,
        averageFirstAttackMs: 140,
        firstAttackSamples: 4,
        zeroDamageBattleRate: 0,
      },
      {
        side: "raid",
        rangeBand: "range_1",
        battleAppearances: 7,
        totalDamage: 490,
        totalTheoreticalBaseDamage: 700,
        normalizedDamageEfficiency: 0.7,
        totalAttackCount: 11,
        totalTheoreticalAttackCount: 14,
        attackOpportunityUtilization: 11 / 14,
        averageDamagePerBattle: 70,
        averageFirstAttackMs: 240.8,
        firstAttackSamples: 6,
        zeroDamageBattleRate: 1 / 7,
      },
      {
        side: "raid",
        rangeBand: "range_2_plus",
        battleAppearances: 5,
        totalDamage: 650,
        totalTheoreticalBaseDamage: 500,
        normalizedDamageEfficiency: 1.3,
        totalAttackCount: 10,
        totalTheoreticalAttackCount: 12.5,
        attackOpportunityUtilization: 0.8,
        averageDamagePerBattle: 130,
        averageFirstAttackMs: 150.5,
        firstAttackSamples: 5,
        zeroDamageBattleRate: 0,
      },
    ],
    rangeActionDiagnosticsMetrics: [
      {
        side: "boss",
        rangeBand: "range_1",
        battleAppearances: 6,
        movedBattleRate: 5 / 6,
        averageMoveCountPerBattle: 1.8,
        averageFirstMoveMs: 80,
        firstMoveSamples: 5,
        averageMoveToFirstAttackMs: 130,
        moveToFirstAttackSamples: 4,
        repositionBattleRate: 2 / 6,
        averageRepositionMoveCountPerBattle: 0.5,
        reachedAttackRangeBattleRate: 4 / 6,
        noAttackDespiteReachingRangeBattleRate: 1 / 6,
        noAttackWithoutReachingRangeBattleRate: 0,
        averageInitialNearestEnemyDistance: 4.5,
        averageBestNearestEnemyDistance: 1.5,
        averageDistanceClosed: 3,
        noAttackBattleRate: 1 / 6,
        movedNoAttackBattleRate: 1 / 6,
        attackedNoHitBattleRate: 0,
        lateSingleAttackBattleRate: 1 / 6,
        moveTargetDiagnosticSampleCount: 4,
        suboptimalMoveTargetRate: 0.5,
        averageExcessApproachSteps: 1.75,
        averageOutsideAttackRangeBeforeFirstAttackMs: 220,
        averageInAttackRangeBeforeFirstAttackMs: 130,
        averageAfterFirstAttackMs: 410,
        averageFirstReachedAttackRangeAtMs: 180,
        firstReachedAttackRangeSamples: 4,
        averageLeftLateralMovesPerBattle: 0,
        averageRightLateralMovesPerBattle: 0,
        firstLateralMoveLeftRate: null,
        firstLateralMoveRightRate: null,
        firstLateralMoveSamples: 0,
        sharedPursuitMoveSampleCount: 0,
        contestedPursuitMoveRate: null,
        plannedApproachGroupMoveSampleCount: 0,
        averagePlannedApproachGroupCompetitorCount: null,
        averagePlannedApproachGroupAssignedCount: null,
        oversubscribedPlannedApproachGroupRate: null,
        plannedApproachBattleCount: 0,
        plannedApproachMoveSampleCount: 0,
        plannedApproachStillOpenRate: null,
        usedPlannedApproachRate: null,
        plannedApproachPathBlockedRate: null,
        plannedApproachFirstAttackRate: null,
        plannedApproachMatchedFirstAttackTargetRate: null,
        plannedApproachReachedRangeWithoutAttackRate: null,
        plannedApproachNoReachNoAttackRate: null,
        plannedApproachNoAttackTargetDiedBeforeBattleEndRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate: null,
      },
      {
        side: "raid",
        rangeBand: "range_2_plus",
        battleAppearances: 5,
        movedBattleRate: 0.2,
        averageMoveCountPerBattle: 0.4,
        averageFirstMoveMs: 40,
        firstMoveSamples: 1,
        averageMoveToFirstAttackMs: 90,
        moveToFirstAttackSamples: 1,
        repositionBattleRate: 0,
        averageRepositionMoveCountPerBattle: 0,
        reachedAttackRangeBattleRate: 1,
        noAttackDespiteReachingRangeBattleRate: 0,
        noAttackWithoutReachingRangeBattleRate: 0,
        averageInitialNearestEnemyDistance: 3,
        averageBestNearestEnemyDistance: 2,
        averageDistanceClosed: 1,
        noAttackBattleRate: 0,
        movedNoAttackBattleRate: 0,
        attackedNoHitBattleRate: 0,
        lateSingleAttackBattleRate: 1 / 5,
        moveTargetDiagnosticSampleCount: 1,
        suboptimalMoveTargetRate: 0,
        averageExcessApproachSteps: 0,
        averageOutsideAttackRangeBeforeFirstAttackMs: 40,
        averageInAttackRangeBeforeFirstAttackMs: 90,
        averageAfterFirstAttackMs: 260,
        averageFirstReachedAttackRangeAtMs: 40,
        firstReachedAttackRangeSamples: 5,
        averageLeftLateralMovesPerBattle: 0,
        averageRightLateralMovesPerBattle: 0,
        firstLateralMoveLeftRate: null,
        firstLateralMoveRightRate: null,
        firstLateralMoveSamples: 0,
        sharedPursuitMoveSampleCount: 0,
        contestedPursuitMoveRate: null,
        plannedApproachGroupMoveSampleCount: 0,
        averagePlannedApproachGroupCompetitorCount: null,
        averagePlannedApproachGroupAssignedCount: null,
        oversubscribedPlannedApproachGroupRate: null,
        plannedApproachBattleCount: 0,
        plannedApproachMoveSampleCount: 0,
        plannedApproachStillOpenRate: null,
        usedPlannedApproachRate: null,
        plannedApproachPathBlockedRate: null,
        plannedApproachFirstAttackRate: null,
        plannedApproachMatchedFirstAttackTargetRate: null,
        plannedApproachReachedRangeWithoutAttackRate: null,
        plannedApproachNoReachNoAttackRate: null,
        plannedApproachNoAttackTargetDiedBeforeBattleEndRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate: null,
        plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate: null,
      },
    ],
    rangeFormationDiagnosticsMetrics: [
      {
        side: "boss",
        rangeBand: "range_1",
        battleAppearances: 6,
        frontAllyBlockedBattleRate: 0.5,
        averageFrontAllyCount: 0.5,
        averageInitialRow: 3.5,
        averageInitialColumn: 0.5,
        zeroDamageBattleRateWithFrontAlly: 1 / 3,
        zeroDamageBattleRateWithoutFrontAlly: 0,
        noAttackBattleRateWithFrontAlly: 1 / 3,
        noAttackBattleRateWithoutFrontAlly: 0,
      },
      {
        side: "raid",
        rangeBand: "range_2_plus",
        battleAppearances: 5,
        frontAllyBlockedBattleRate: 0.2,
        averageFrontAllyCount: 0.2,
        averageInitialRow: 4.2,
        averageInitialColumn: 1.2,
        zeroDamageBattleRateWithFrontAlly: 0,
        zeroDamageBattleRateWithoutFrontAlly: 0,
        noAttackBattleRateWithFrontAlly: 0,
        noAttackBattleRateWithoutFrontAlly: 0,
      },
    ],
    raidMeleeCohortMetrics: [
      {
        cohort: "special",
        battleAppearances: 3,
        averageDamagePerBattle: 12.3,
        averageAttackCountPerBattle: 0.4,
        averageFirstAttackMs: 2800,
        averageLifetimeMs: 3100,
        zeroDamageBattleRate: 2 / 3,
        survivalRate: 1,
      },
      {
        cohort: "standard",
        battleAppearances: 7,
        averageDamagePerBattle: 128.4,
        averageAttackCountPerBattle: 2.2,
        averageFirstAttackMs: 520,
        averageLifetimeMs: 2480,
        zeroDamageBattleRate: 1 / 14,
        survivalRate: 0.82,
      },
    ],
    raidSpecialMeleeUnitDiagnostics: [
      {
        unitId: "keiki",
        unitName: "袿姫",
        battleAppearances: 5,
        averageDamagePerBattle: 6.2,
        averageAttackCountPerBattle: 0.3,
        averageFirstAttackMs: 3200,
        firstAttackSamples: 1,
        averageFirstReachedAttackRangeAtMs: 2800,
        firstReachedAttackRangeSamples: 2,
        noAttackWithoutReachingRangeBattleRate: 0.6,
        noAttackDespiteReachingRangeBattleRate: 0.1,
        contestedPursuitMoveRate: 0.4,
        sharedPursuitMoveSampleCount: 5,
        zeroDamageBattleRate: 0.8,
        survivalRate: 0.95,
      },
      {
        unitId: "reimu",
        unitName: "霊夢",
        battleAppearances: 4,
        averageDamagePerBattle: 12.9,
        averageAttackCountPerBattle: 0.5,
        averageFirstAttackMs: 2970,
        firstAttackSamples: 1,
        averageFirstReachedAttackRangeAtMs: 2600,
        firstReachedAttackRangeSamples: 2,
        noAttackWithoutReachingRangeBattleRate: 0.5,
        noAttackDespiteReachingRangeBattleRate: 0.15,
        contestedPursuitMoveRate: 0.35,
        sharedPursuitMoveSampleCount: 4,
        zeroDamageBattleRate: 0.8,
        survivalRate: 0.93,
      },
    ],
  };
}

function createSampleSummary(): BotBalanceBaselineSummary {
  return {
    requestedMatchCount: 10,
    chunkSize: 5,
    parallelism: 4,
    portOffsetBase: 10000,
    bossPolicy: "strength",
    raidPolicies: ["strength", "strength", "growth"],
    helperConfigs: [
      { wantsBoss: true, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
      { wantsBoss: false, policy: "growth" },
    ],
    chunkCount: 2,
    outputDir: "C:\\tmp\\baseline",
    aggregate: createSampleAggregate(),
    failures: [
      {
        chunkIndex: 1,
        globalMatchIndex: 7,
        localMatchIndex: 2,
        message: "sample failure",
      },
    ],
    chunks: [
      {
        chunkIndex: 0,
        matchStartIndex: 0,
        requestedMatchCount: 5,
        workerIndex: 0,
        portOffset: 10000,
        completedMatches: 5,
        abortedMatches: 0,
        logPath: "C:\\tmp\\baseline\\chunk-001.log",
        startedAt: "2026-04-10T00:00:00.000Z",
        finishedAt: "2026-04-10T00:01:00.000Z",
        durationMs: 60000,
      },
      {
        chunkIndex: 1,
        matchStartIndex: 5,
        requestedMatchCount: 5,
        workerIndex: 1,
        portOffset: 10500,
        completedMatches: 4,
        abortedMatches: 1,
        logPath: "C:\\tmp\\baseline\\chunk-002.log",
        startedAt: "2026-04-10T00:01:00.000Z",
        finishedAt: "2026-04-10T00:02:10.000Z",
        durationMs: 70000,
      },
    ],
  };
}

describe("bot balance baseline human report", () => {
  test("analysis JSON exposes integrity and final battle sections", () => {
    const analysis = buildBotBalanceBaselineAnalysis(createSampleSummary());

    expect(analysis).toMatchObject({
      schemaVersion: 1,
      overview: expect.objectContaining({
        integrityStatus: expect.any(String),
        balanceStatus: expect.any(String),
      }),
      integrity: expect.objectContaining({
        issues: expect.any(Array),
      }),
      finalBattle: expect.objectContaining({
        sampleCount: expect.any(Number),
      }),
    });
  });

  test("builds a Japanese JSON report with localized top-level sections", () => {
    const jsonReport = buildBotBalanceBaselineJapaneseJson(createSampleSummary()) as Record<string, unknown>;

    expect(jsonReport).toMatchObject({
      "実行条件": expect.objectContaining({
        "要求対戦数": 10,
        "チャンクサイズ": 5,
        "並列数": 4,
        "ボス購入方針": "strength",
        "レイド購入方針": ["strength", "strength", "growth"],
      }),
      "全体結果": expect.objectContaining({
        "完走数": 9,
        "中断数": 1,
        "ボス勝利数": 8,
        "レイド勝利数": 1,
      }),
      "戦闘終了指標": expect.objectContaining({
        "戦闘数": 9,
        "平均ボス側生存数": 1.4,
        "平均レイド側生存数": 2.1,
      }),
    });
    expect(jsonReport["戦闘終了指標"]).toMatchObject({
      "両軍生存終了率": 7 / 9,
      "ボス側全滅率": 1 / 9,
      "レイド側全滅率": 2 / 9,
      "終了理由内訳": expect.arrayContaining([
        expect.objectContaining({
          "終了理由": "片側全滅決着",
          "内部値": "annihilation",
          "件数": 2,
        }),
        expect.objectContaining({
          "終了理由": "時間切れHP判定決着",
          "内部値": "timeout_hp_lead",
          "件数": 5,
        }),
        expect.objectContaining({
          "終了理由": "フェーズHP削り切り",
          "内部値": "phase_hp_depleted",
          "件数": 1,
        }),
      ]),
    });
    expect(jsonReport["各ラウンド詳細"]).toEqual([
      expect.objectContaining({
        "試合番号": 0,
        "ラウンド": 1,
        "終了時間(実プレイ秒)": 5.7,
        "フェーズHP目標": 600,
        "フェーズHPダメージ": 600,
        "推定フェーズHP火力指数": 800 / 57,
        "レミリア本体集中": expect.objectContaining({
          "配置": "cell 2 (x=2, y=0)",
          "被ダメージ": 600,
          "直接フェーズ貢献": 600,
          "撃破": false,
        }),
        "ラウンド結果": "failed",
        "レイド全員撃破": true,
      }),
    ]);
    expect(jsonReport["プレイヤー別成績"]).toEqual({
      P1: expect.objectContaining({
        "平均順位": 1.8,
        "1位率": 0.3,
        "平均最終所持Gold": 8.4,
        "平均消費Gold": 13.7,
      }),
      P2: expect.objectContaining({
        "平均残HP": 95,
        "平均リロール回数": 3.3,
      }),
    });
    expect(jsonReport["ボス側戦闘ユニット指標"]).toEqual([
      expect.objectContaining({
        "ユニットID": "patchouli",
        "最大到達レベル": 4,
        "Lv4到達率": 1 / 9,
        "Lv7到達率": 0,
        "戦闘ごとの平均基本スキル発動回数": 1.1,
        "戦闘ごとの平均ペアスキル発動回数": 0,
        "担当側戦闘勝率": 0.66,
        "採用率": 1,
      }),
    ]);
    expect(jsonReport["レイド側戦闘ユニット指標"]).toEqual([
      expect.objectContaining({
        "ユニットID": "rin",
        "ユニット種別": "rin",
        "最大到達レベル": 7,
        "Lv4到達率": 4 / 9,
        "Lv7到達率": 1 / 9,
        "戦闘ごとの平均基本スキル発動回数": 0.6,
        "戦闘ごとの平均ペアスキル発動回数": 0.2,
        "担当側戦闘勝率": 0.4,
        "サブ採用回数": 7,
        "サブ採用試合数": 5,
        "採用率": 1,
      }),
    ]);
    expect(jsonReport["ボス側戦闘テレメトリ"]).toEqual([
      expect.objectContaining({
        "ユニットID": "patchouli",
        "行動参加率": 0.9,
        "戦闘ごとの平均攻撃回数": 4.2,
        "平均初回攻撃(ms)": 145.6,
      }),
    ]);
    expect(jsonReport["レイド側戦闘テレメトリ"]).toEqual([
      expect.objectContaining({
        "ユニットID": "rin",
        "戦闘ごとの平均被ダメージ": 220.3,
        "0ダメージ戦闘率": 0.2,
      }),
    ]);
    expect(jsonReport["最終盤面ユニット指標"]).toEqual([
      expect.objectContaining({
        "ユニットID": "momoyo",
        "ユニット種別": "vanguard",
      }),
    ]);
    expect(jsonReport["高コスト指標"]).toEqual(expect.objectContaining({
      "ショップ提示回数": 7,
      "提示試合数": 5,
      "購入回数": 3,
      "購入試合数": 2,
    }));
    expect(jsonReport["高コストショップ提示ユニット"]).toEqual([
      expect.objectContaining({
        "ユニットID": "junko",
        "コスト": 4,
        "提示回数": 4,
      }),
    ]);
    expect(jsonReport["射程別ダメージ効率比較"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "陣営": "boss",
        "射程帯": "射程1",
        "基礎火力発揮率": 0.6,
        "攻撃機会消化率": 0.75,
      }),
      expect.objectContaining({
        "陣営": "raid",
        "射程帯": "射程2以上",
        "基礎火力発揮率": 1.3,
        "平均初回攻撃(ms)": 150.5,
      }),
    ]));
    expect(jsonReport["射程別行動診断"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "陣営": "boss",
        "射程帯": "射程1",
        "射程内到達率": 4 / 6,
        "未攻撃だが射程内到達": 1 / 6,
        "未攻撃かつ射程外終了": 0,
        "平均初期最短距離": 4.5,
        "平均最短到達距離": 1.5,
        "平均距離短縮量": 3,
        "追跡対象比較サンプル数": 4,
        "最適接敵対象ズレ率": 0.5,
        "平均余剰接敵歩数": 1.75,
      }),
    ]));
    expect(jsonReport["射程別行動診断"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "陣営": "boss",
        "射程帯": "射程1",
        "移動参加率": 5 / 6,
        "戦闘ごとの平均移動回数": 1.8,
        "平均初回移動(ms)": 80,
        "移動後の平均初撃遅延(ms)": 130,
        "再接敵移動率": 2 / 6,
        "0ダメージ内訳: 未攻撃": 1 / 6,
        "追跡対象比較サンプル数": 4,
        "最適接敵対象ズレ率": 0.5,
        "割当先生存・未接敵終了のうち割当口未使用率": null,
        "割当先生存・未接敵終了のうち経路詰まり併発率": null,
        "割当先生存・未接敵終了のうち味方直前ブロック率": null,
        "割当先生存・未接敵終了のうち敵直前ブロック率": null,
        "割当先生存・未接敵終了のうち混在直前ブロック率": null,
        "割当先生存・未接敵終了のうち道中チョーク率": null,
        "割当先生存・未接敵終了のうち味方帯チョーク率": null,
        "割当先生存・未接敵終了のうち敵受け口帯チョーク率": null,
        "割当先生存・未接敵終了のうち境界混在チョーク率": null,
        "割当先生存・未接敵終了のうち未分類チョーク率": null,
      }),
      expect.objectContaining({
        "陣営": "raid",
        "射程帯": "射程2以上",
        "移動参加率": 0.2,
        "平均初回移動(ms)": 40,
        "移動後の平均初撃遅延(ms)": 90,
        "平均余剰接敵歩数": 0,
      }),
    ]));
    expect(jsonReport["射程別失敗分類"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "陣営": "boss",
        "射程帯": "射程1",
        "失敗分類: 未接敵": 0,
        "失敗分類: 接敵済み未攻撃": 1 / 6,
        "失敗分類: 遅すぎる単発": 1 / 6,
      }),
      expect.objectContaining({
        "陣営": "raid",
        "射程帯": "射程2以上",
        "失敗分類: 未接敵": 0,
        "失敗分類: 接敵済み未攻撃": 0,
        "失敗分類: 遅すぎる単発": 1 / 5,
      }),
    ]));
    expect(jsonReport["射程別初期配置診断"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "陣営": "boss",
        "射程帯": "射程1",
        "前方味方あり率": 0.5,
        "平均前方味方数": 0.5,
        "前方味方あり時 0ダメ率": 1 / 3,
        "前方味方なし時 未攻撃率": 0,
      }),
      expect.objectContaining({
        "陣営": "raid",
        "射程帯": "射程2以上",
        "平均初期行": 4.2,
        "平均初期列": 1.2,
      }),
    ]));
    expect(jsonReport["レイド射程1コホート診断"]).toEqual([
      expect.objectContaining({
        "コホート": "特殊ユニット",
        "戦闘登場回数": 3,
        "戦闘ごとの平均ダメージ": 12.3,
        "戦闘ごとの平均攻撃回数": 0.4,
        "0ダメージ戦闘率": 2 / 3,
      }),
      expect.objectContaining({
        "コホート": "通常ユニット",
        "戦闘登場回数": 7,
        "平均初回攻撃(ms)": 520,
        "生存率": 0.82,
      }),
    ]);
    expect(jsonReport["レイド特殊射程1ユニット診断"]).toEqual([
      expect.objectContaining({
        "ユニットID": "keiki",
        "ユニット名": "袿姫",
        "戦闘登場回数": 5,
        "戦闘ごとの平均ダメージ": 6.2,
        "戦闘ごとの平均攻撃回数": 0.3,
        "平均初回攻撃(ms)": 3200,
        "平均初回接敵(ms)": 2800,
        "未接敵終了率": 0.6,
        "接敵済み未攻撃率": 0.1,
        "同時追跡競合率": 0.4,
        "0ダメージ戦闘率": 0.8,
        "生存率": 0.95,
      }),
      expect.objectContaining({
        "ユニットID": "reimu",
        "ユニット名": "霊夢",
        "戦闘登場回数": 4,
        "平均初回攻撃(ms)": 2970,
        "同時追跡競合率": 0.35,
        "生存率": 0.93,
      }),
    ]);
    expect(jsonReport["失敗一覧"]).toEqual([
      expect.objectContaining({
        "メッセージ": "sample failure",
      }),
    ]);
  });

  test("builds a Japanese markdown report with all sections", () => {
    const markdown = buildBotBalanceBaselineJapaneseMarkdown(createSampleSummary());

    expect(markdown).toContain("# Bot Balance Baseline レポート");
    expect(markdown).toContain("## 実行条件");
    expect(markdown).toContain("- ボス購入方針: strength");
    expect(markdown).toContain("- レイド購入方針: strength, strength, growth");
    expect(markdown).toContain("- bot1: boss希望=ON / 購入方針=strength");
    expect(markdown).toContain("## 先に見るべき結論");
    expect(markdown).toContain("## 進行健全性診断");
    expect(markdown).toContain("## バランス診断");
    expect(markdown).toContain("## R12最終戦");
    expect(markdown).toContain("## ショップ出現診断");
    expect(markdown).toContain("## 全体結果");
    expect(markdown).toContain("## 戦闘終了指標");
    expect(markdown).toContain("| 戦闘数 | 平均ボス側生存数 | 平均レイド側生存数 | 両軍生存終了率 | ボス側全滅率 | レイド側全滅率 |");
    expect(markdown).toContain("| 9 | 1.4 | 2.1 | 77.8% | 11.1% | 22.2% |");
    expect(markdown).toContain("| 片側全滅決着 | annihilation | 2 | 22.2% |");
    expect(markdown).toContain("| 時間切れHP判定決着 | timeout_hp_lead | 5 | 55.6% |");
    expect(markdown).toContain("| フェーズHP削り切り | phase_hp_depleted | 1 | 11.1% |");
    expect(markdown).toContain("## ラウンド分布");
    expect(markdown).toContain("## 各ラウンド詳細");
    expect(markdown).toContain("- 詳細なラウンド別明細は `round-details.ja.md` に分離しています。");
    expect(markdown).not.toContain("| 試合 | R | 終了時間(実プレイ秒) | 最終勝利 | ラウンド結果 | 目的進捗 | 達成率 | レイド全滅 |");
    expect(markdown).not.toContain("| 試合 | R | 終了時間(実プレイ秒) | 最終勝利 | ラウンド結果 | フェーズHP |");
    expect(markdown).not.toContain("| 0 | 1 | 5.7 | boss | failed | 600/600 | 100.0% | YES | 3 | 1 | 0 | フェーズHP削り切り | raid | P2:撃破 2->1 | 霧雨魔理沙 Lv1 dmg=600(phase 600) hp=0 撃破 | レミリア Lv1 dmg=240 hp=1200 生存 |");
    expect(markdown).toContain("## プレイヤー別成績");
    expect(markdown).toContain("| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | 平均獲得Gold | 平均消費Gold | 平均購入回数 | 平均リロール回数 | 平均売却回数 |");
    expect(markdown).toContain("| P1 | 1.8 | 30.0% | 100 | 2.1 | 8.4 | 1.2 | 13.7 | 5.6 | 2.4 | 0.2 |");
    expect(markdown).toContain("## ボス側戦闘ユニット指標");
    expect(markdown).toContain("## レイド側戦闘ユニット指標");
    expect(markdown).toContain("担当側戦闘勝率");
    expect(markdown).toContain("基本スキル/戦闘");
    expect(markdown).toContain("ペアスキル/戦闘");
    expect(markdown).toContain("## ボス側戦闘テレメトリ");
    expect(markdown).toContain("## レイド側戦闘テレメトリ");
    expect(markdown).toContain("## 最終盤面ユニット指標");
    expect(markdown).toContain("## 上位ダメージユニット");
    expect(markdown).toContain("## 高コスト指標");
    expect(markdown).toContain("## 高コストショップ提示ユニット");
    expect(markdown).toContain("| パチュリー・ノーレッジ | patchouli | boss | bossShop | 4 | 100.0% | 41.7% | 44.4% |");
    expect(markdown).toContain("## 射程別ダメージ効率比較");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 基礎火力発揮率 | 攻撃機会消化率 | 平均初回攻撃(ms) | 0ダメージ戦闘率 |");
    expect(markdown).toContain("| boss | 射程1 | 6 | 60 | 0.6 | 75.0% | 210 | 16.7% |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 130 | 1.3 | 80.0% | 150.5 | 0.0% |");
    expect(markdown).toContain("## 射程別行動診断");
    expect(markdown).toContain("割当先生存・未接敵終了のうち味方直前ブロック率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち道中チョーク率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち味方帯チョーク率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち敵受け口帯チョーク率");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 移動参加率 | 戦闘ごとの平均移動回数 | 平均初回移動(ms) | 移動後の平均初撃遅延(ms) | 再接敵移動率 | 戦闘ごとの平均再接敵移動回数 | 射程内到達率 | 未攻撃だが射程内到達 | 未攻撃かつ射程外終了 | 平均初期最短距離 | 平均最短到達距離 | 平均距離短縮量 | 0ダメージ内訳: 未攻撃 | 0ダメージ内訳: 移動のみ | 0ダメージ内訳: 攻撃したが命中なし | 追跡対象比較サンプル数 | 最適接敵対象ズレ率 | 平均余剰接敵歩数 |");
    expect(markdown).toContain("割当先生存・未接敵終了のうち割当口未使用率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち経路詰まり併発率");
    expect(markdown).toContain("| boss | 射程1 | 6 | 83.3% | 1.8 | 80 | 130 | 33.3% | 0.5 | 66.7% | 16.7% | 0.0% | 4.5 | 1.5 | 3 | 16.7% | 16.7% | 0.0% | 4 | 50.0% | 1.75 |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 20.0% | 0.4 | 40 | 90 | 0.0% | 0 | 100.0% | 0.0% | 0.0% | 3 | 2 | 1 | 0.0% | 0.0% | 0.0% | 1 | 0.0% | 0 |");
    expect(markdown).toContain("## 射程別失敗分類");
    expect(markdown).toContain("- 遅すぎる単発: 攻撃1回のみ、かつ初撃が戦闘時間の60%以上を消費したケース");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 失敗分類: 未接敵 | 失敗分類: 接敵済み未攻撃 | 失敗分類: 遅すぎる単発 |");
    expect(markdown).toContain("| boss | 射程1 | 6 | 0.0% | 16.7% | 16.7% |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 0.0% | 0.0% | 20.0% |");
    expect(markdown).toContain("## 射程別初期配置診断");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 前方味方あり率 | 平均前方味方数 | 平均初期行 | 平均初期列 | 前方味方あり時 0ダメ率 | 前方味方なし時 0ダメ率 | 前方味方あり時 未攻撃率 | 前方味方なし時 未攻撃率 |");
    expect(markdown).toContain("| boss | 射程1 | 6 | 50.0% | 0.5 | 3.5 | 0.5 | 33.3% | 0.0% | 33.3% | 0.0% |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 20.0% | 0.2 | 4.2 | 1.2 | 0.0% | 0.0% | 0.0% | 0.0% |");
    expect(markdown).toContain("## レイド射程1コホート診断");
    expect(markdown).toContain("| コホート | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 戦闘ごとの平均攻撃回数 | 平均初回攻撃(ms) | 平均生存時間(ms) | 0ダメージ戦闘率 | 生存率 |");
    expect(markdown).toContain("| 特殊ユニット | 3 | 12.3 | 0.4 | 2800 | 3100 | 66.7% | 100.0% |");
    expect(markdown).toContain("| 通常ユニット | 7 | 128.4 | 2.2 | 520 | 2480 | 7.1% | 82.0% |");
    expect(markdown).toContain("## レイド特殊射程1ユニット診断");
    expect(markdown).toContain("| ユニット名 | ユニットID | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 戦闘ごとの平均攻撃回数 | 平均初回攻撃(ms) | 平均初回接敵(ms) | 未接敵終了率 | 接敵済み未攻撃率 | 同時追跡競合率 | 0ダメージ戦闘率 | 生存率 |");
    expect(markdown).toContain("| 袿姫 | keiki | 5 | 6.2 | 0.3 | 3200 | 2800 | 60.0% | 10.0% | 40.0% | 80.0% | 95.0% |");
    expect(markdown).toContain("| 霊夢 | reimu | 4 | 12.9 | 0.5 | 2970 | 2600 | 50.0% | 15.0% | 35.0% | 80.0% | 93.0% |");
    expect(markdown).toContain("| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |");
    expect(markdown).toContain("| 7 | 5 | 3 | 2 | 2 | 2 | 22.2% |");
    expect(markdown).toContain("| 純狐 | junko | vanguard | raid | shop | 4 | 4 | 3 | 33.3% |");
    expect(markdown).toContain("## チャンク実行状況");
    expect(markdown).toContain("## 失敗一覧");
    expect(markdown).toContain("| パチュリー・ノーレッジ | patchouli | mage | 12 | 9 | 1.4 | 4 | 11.1% | 0.0% | 1.1 | 0 | 420.5 | 5606.67 | 95.0% | 66.0% | 100.0% |");
    expect(markdown).toContain("| 火焔猫燐 | rin | rin | 18 | 9 | 2.2 | 7 | 44.4% | 11.1% | 0.6 | 0.2 | 120.5 | 2410 | 80.0% | 40.0% | 100.0% | 7 | 5 | 55.6% |");
    expect(markdown).toContain("| パチュリー・ノーレッジ | patchouli | mage | 90.0% | 4.2 | 3.5 | 180.4 | 145.6 | 770.2 | 5.0% |");
    expect(markdown).toContain("| 火焔猫燐 | rin | rin | 75.0% | 2.1 | 1.4 | 220.3 | 240.8 | 610.5 | 20.0% |");
    expect(markdown).toContain("| 姫虫百々世 | momoyo | vanguard | 30 | 9 | 3.33 | 100.0% |");
    expect(markdown).toContain("| 1 | 7 | 2 | sample failure |");
  });

  test("builds round detail markdown separately from the summary report", () => {
    const markdown = buildBotBalanceBaselineRoundDetailsJapaneseMarkdown(createSampleSummary());

    expect(markdown).toContain("# Bot Balance Baseline ラウンド詳細");
    expect(markdown).toContain("| 試合 | R | 終了時間(実プレイ秒) | 最終勝利 | ラウンド結果 | 目的進捗 | 達成率 | 推定フェーズHP火力指数 | レミリア集中 | レイド全滅 |");
    expect(markdown).toContain("| 0 | 1 | 5.7 | boss | failed | 600/600 | 100.0% | 14.04 | cell 2 (x=2, y=0), dmg=600, phase=600, hp=1200, 生存 | YES | 3 | 1 | 0 | フェーズHP削り切り | raid | P2:撃破 2->1 | 霧雨魔理沙 Lv1 dmg=600(phase 600) hp=0 撃破 | レミリア Lv1 dmg=240 hp=1200 生存 |");
  });
});
