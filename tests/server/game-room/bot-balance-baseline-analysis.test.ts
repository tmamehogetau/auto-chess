import { describe, expect, test } from "vitest";
import type { BotOnlyBaselineAggregateReport } from "./bot-balance-baseline-aggregate";
import type { BotBalanceBaselineSummary } from "./bot-balance-baseline-human-report";
import { buildBotBalanceBaselineAnalysis } from "./bot-balance-baseline-analysis";

function createSampleAggregate(
  overrides: Partial<BotOnlyBaselineAggregateReport> = {},
): BotOnlyBaselineAggregateReport {
  return {
    requestedMatchCount: 2,
    completedMatches: 2,
    abortedMatches: 0,
    bossWins: 1,
    raidWins: 1,
    bossWinRate: 0.5,
    raidWinRate: 0.5,
    averageRounds: 11.5,
    minRounds: 11,
    maxRounds: 12,
    averageRemainingRaidPlayers: 1.5,
    battleMetrics: {
      totalBattles: 2,
      averageBossSurvivorsAtBattleEnd: 1,
      averageRaidSurvivorsAtBattleEnd: 2,
      bothSidesSurvivedRate: 0,
      bossWipedRate: 0.5,
      raidWipedRate: 0,
      endReasonCounts: {
        annihilation: 0,
        mutual_annihilation: 0,
        timeout_hp_lead: 0,
        timeout_hp_tie: 0,
        phase_hp_depleted: 1,
        boss_defeated: 1,
        forced: 0,
        unexpected: 0,
      },
    },
    roundHistogram: { "11": 1, "12": 1 },
    playerMetrics: {},
    bossBattleUnitMetrics: [],
    raidBattleUnitMetrics: [],
    finalBoardUnitMetrics: [],
    topDamageUnits: [],
    rangeDamageEfficiencyMetrics: [],
    rangeActionDiagnosticsMetrics: [],
    rangeFormationDiagnosticsMetrics: [],
    roundDetails: [],
    ...overrides,
  };
}

function createSummary(overrides: Partial<BotBalanceBaselineSummary> = {}): BotBalanceBaselineSummary {
  return {
    requestedMatchCount: 2,
    chunkSize: 1,
    parallelism: 1,
    portOffsetBase: 10_000,
    bossPolicy: "strength",
    raidPolicies: ["strength", "strength", "strength"],
    optimizationVariant: "full",
    helperConfigs: [
      { wantsBoss: true, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
      { wantsBoss: false, policy: "strength" },
    ],
    chunkCount: 2,
    outputDir: "C:\\tmp\\baseline",
    failures: [],
    chunks: [],
    aggregate: createSampleAggregate(),
    ...overrides,
  };
}

describe("bot balance baseline analysis report", () => {
  test("builds overview metrics for machine analysis", () => {
    const analysis = buildBotBalanceBaselineAnalysis(createSummary());

    expect(analysis.schemaVersion).toBe(1);
    expect(analysis.overview).toMatchObject({
      completedMatches: 2,
      abortedMatches: 0,
      abortRate: 0,
      bossWinRate: 0.5,
      raidWinRate: 0.5,
      averageRounds: 11.5,
      r12ReachRate: 0.5,
      integrityStatus: "pass",
      balanceStatus: "pass",
    });
  });

  test("separates R12 final boss body combat from phase HP objectives", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
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
        completedMatches: 1,
        bossWins: 0,
        raidWins: 1,
        bossWinRate: 0,
        raidWinRate: 1,
        roundHistogram: { "12": 1 },
        roundDetails: [{
          matchIndex: 0,
          matchWinnerRole: "raid",
          totalRounds: 12,
          roundIndex: 12,
          battleEndTimeMs: 17_000,
          phaseHpTarget: 0,
          phaseDamageDealt: 3020,
          phaseCompletionRate: 0,
          phaseResult: "success",
          allRaidPlayersWipedOut: false,
          raidPlayersWipedOut: 0,
          raidPlayersEliminatedAfterRound: 0,
          bossSurvivors: 0,
          raidSurvivors: 8,
          bossTotalDamage: 2700,
          raidTotalDamage: 3020,
          raidPhaseContributionDamage: 1567,
          battleEndReasons: ["boss_defeated"],
          battleWinnerRoles: ["raid"],
          raidPlayerConsequences: [],
          topBossUnits: [],
          topRaidUnits: [{
            playerId: "raid-1",
            label: "P1",
            unitId: "marisa",
            unitName: "霧雨魔理沙",
            side: "raid",
            totalDamage: 1548,
            phaseContributionDamage: 510,
            finalHp: 306,
            alive: true,
            unitLevel: 5,
          }],
        }],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.rounds).toContainEqual(expect.objectContaining({
      roundIndex: 12,
      objectiveType: "finalBossBody",
      sampleCount: 1,
    }));
    expect(analysis.finalBattle).toMatchObject({
      sampleCount: 1,
      bossBodyHp: 3000,
      raidWinCount: 1,
      bossWinCount: 0,
      raidWinRate: 1,
      bossDefeatCount: 1,
      bossDefeatRate: 1,
      averageBossBodyDamage: 3020,
      averageBossRemainingHp: 0,
      averageBattleEndSeconds: 17,
      averageBattleEndRealPlaySeconds: 1700,
    });
    expect(analysis.finalBattle.samples[0]).toMatchObject({
      matchIndex: 0,
      roundIndex: 12,
      bossBodyDamage: 3020,
      bossDefeated: true,
      finalBattleWinner: "raid",
      matchWinnerRole: "raid",
    });
  });

  test("summarizes R12 boss body protection outcomes", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
        completedMatches: 2,
        roundHistogram: { "12": 2 },
        roundDetails: [{
          matchIndex: 0,
          matchWinnerRole: "raid",
          totalRounds: 12,
          roundIndex: 12,
          battleEndTimeMs: 12_000,
          phaseHpTarget: 0,
          phaseDamageDealt: 3100,
          phaseCompletionRate: 0,
          phaseResult: "success",
          allRaidPlayersWipedOut: false,
          raidPlayersWipedOut: 0,
          raidPlayersEliminatedAfterRound: 0,
          bossSurvivors: 2,
          raidSurvivors: 5,
          bossTotalDamage: 2400,
          raidTotalDamage: 3100,
          raidPhaseContributionDamage: 1700,
          battleEndReasons: ["boss_defeated"],
          battleWinnerRoles: ["raid"],
          raidPlayerConsequences: [],
          topBossUnits: [],
          topRaidUnits: [],
        }, {
          matchIndex: 1,
          matchWinnerRole: "boss",
          totalRounds: 12,
          roundIndex: 12,
          battleEndTimeMs: 16_000,
          phaseHpTarget: 0,
          phaseDamageDealt: 2100,
          phaseCompletionRate: 0,
          phaseResult: "failed",
          allRaidPlayersWipedOut: true,
          raidPlayersWipedOut: 3,
          raidPlayersEliminatedAfterRound: 0,
          bossSurvivors: 4,
          raidSurvivors: 0,
          bossTotalDamage: 3600,
          raidTotalDamage: 2100,
          raidPhaseContributionDamage: 900,
          battleEndReasons: ["annihilation"],
          battleWinnerRoles: ["boss"],
          raidPlayerConsequences: [],
          topBossUnits: [],
          topRaidUnits: [],
        }],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.finalBattle.bodyProtection).toMatchObject({
      bossBodyDefeatedWithBossSurvivorsCount: 1,
      bossBodyDefeatedWithBossSurvivorsSampleRate: 0.5,
      bossBodyDefeatedWithBossSurvivorsDefeatRate: 1,
      averageBossSurvivorsWhenBodyDefeated: 2,
      averageBossSurvivorsWhenBossWins: 4,
      averageRaidSurvivorsWhenBodyDefeated: 5,
    });
    expect(analysis.finalBattle.samples[0]).toMatchObject({
      bossDefeated: true,
      bossSurvivors: 2,
      raidSurvivors: 5,
      bossBodyDefeatedWithBossSurvivors: true,
    });
  });

  test("summarizes early Remilia body focus from R1-R3 details", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
        completedMatches: 2,
        roundDetails: [{
          matchIndex: 0,
          matchWinnerRole: "boss",
          totalRounds: 4,
          roundIndex: 1,
          battleEndTimeMs: 5000,
          phaseHpTarget: 1200,
          phaseDamageDealt: 1200,
          phaseCompletionRate: 1,
          phaseHpPowerIndex: 8,
          phaseResult: "success",
          allRaidPlayersWipedOut: false,
          raidPlayersWipedOut: 0,
          raidPlayersEliminatedAfterRound: 0,
          bossSurvivors: 0,
          raidSurvivors: 8,
          bossTotalDamage: 100,
          raidTotalDamage: 1200,
          raidPhaseContributionDamage: 1200,
          battleEndReasons: ["phase_hp_depleted"],
          battleWinnerRoles: ["raid"],
          raidPlayerConsequences: [],
          bossBodyFocus: {
            unitId: "remilia",
            unitName: "レミリア",
            cell: 2,
            x: 2,
            y: 0,
            unitLevel: 4,
            damageTaken: 800,
            directPhaseDamage: 800,
            firstDamageAtMs: null,
            defeated: true,
            finalHp: 0,
          },
          topBossUnits: [],
          topRaidUnits: [],
        }, {
          matchIndex: 1,
          matchWinnerRole: "boss",
          totalRounds: 4,
          roundIndex: 3,
          battleEndTimeMs: 30_000,
          phaseHpTarget: 1800,
          phaseDamageDealt: 900,
          phaseCompletionRate: 0.5,
          phaseHpPowerIndex: 0.5,
          phaseResult: "failed",
          allRaidPlayersWipedOut: true,
          raidPlayersWipedOut: 3,
          raidPlayersEliminatedAfterRound: 0,
          bossSurvivors: 3,
          raidSurvivors: 0,
          bossTotalDamage: 1200,
          raidTotalDamage: 900,
          raidPhaseContributionDamage: 900,
          battleEndReasons: ["annihilation"],
          battleWinnerRoles: ["boss"],
          raidPlayerConsequences: [],
          bossBodyFocus: {
            unitId: "remilia",
            unitName: "レミリア",
            cell: 2,
            x: 2,
            y: 0,
            unitLevel: 6,
            damageTaken: 200,
            directPhaseDamage: 200,
            firstDamageAtMs: null,
            defeated: false,
            finalHp: 1600,
          },
          topBossUnits: [],
          topRaidUnits: [],
        }],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.bossBodyFocus).toMatchObject({
      earlyRoundCount: 2,
      earlyDefeatCount: 1,
      earlyDefeatRate: 0.5,
      averageEarlyDamageTaken: 500,
      averageEarlyDirectPhaseDamage: 500,
      averageEarlyFirstDamageAtMs: null,
    });
  });

  test("marks R12 phase HP resolution as an integrity failure", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
        completedMatches: 1,
        roundHistogram: { "12": 1 },
        roundDetails: [{
          matchIndex: 0,
          matchWinnerRole: "raid",
          totalRounds: 12,
          roundIndex: 12,
          battleEndTimeMs: 8000,
          phaseHpTarget: 3000,
          phaseDamageDealt: 3000,
          phaseCompletionRate: 1,
          phaseResult: "success",
          allRaidPlayersWipedOut: false,
          raidPlayersWipedOut: 0,
          raidPlayersEliminatedAfterRound: 0,
          bossSurvivors: 2,
          raidSurvivors: 6,
          bossTotalDamage: 1000,
          raidTotalDamage: 3000,
          raidPhaseContributionDamage: 3000,
          battleEndReasons: ["phase_hp_depleted"],
          battleWinnerRoles: ["raid"],
          raidPlayerConsequences: [],
          topBossUnits: [],
          topRaidUnits: [],
        }],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.integrity.status).toBe("fail");
    expect(analysis.balance.status).toBe("not_evaluated");
    expect(analysis.integrity.issues).toContainEqual(expect.objectContaining({
      code: "r12_phase_hp_resolution_used",
      severity: "critical",
    }));
    expect(analysis.integrity.finalBattleRuleViolationCount).toBe(1);
  });

  test("summarizes economy and unit progression cohorts for analysis", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
        playerMetrics: {
          P1: {
            averagePlacement: 1.5,
            firstPlaceRate: 0.5,
            averageRemainingHp: 100,
            averageRemainingLives: 2,
            averageFinalGold: 6,
            averageGoldEarned: 20,
            averageGoldSpent: 30,
            averagePurchaseCount: 8,
            averageRefreshCount: 2,
            averageSellCount: 0,
            averageSpecialUnitUpgradeCount: 1,
          },
        },
        bossBattleUnitMetrics: [{
          unitId: "remilia",
          unitType: "boss",
          unitName: "レミリア・スカーレット",
          battleAppearances: 2,
          matchesPresent: 1,
          averageunitLevel: 3,
          maxUnitLevel: 4,
          level4ReachRate: 1,
          level7ReachRate: 0,
          averageDamagePerBattle: 1000,
          averageDamagePerMatch: 2000,
          activeBattleRate: 1,
          averageAttackCountPerBattle: 4,
          averageBasicSkillActivationsPerBattle: 0,
          averageHitCountPerBattle: 3,
          averageDamageTakenPerBattle: 100,
          averageFirstAttackMs: 100,
          averageLifetimeMs: 1000,
          zeroDamageBattleRate: 0,
          survivalRate: 1,
          ownerWinRate: 0.5,
          adoptionRate: 1,
        }],
        raidBattleUnitMetrics: [{
          unitId: "marisa",
          unitType: "hero",
          unitName: "霧雨魔理沙",
          battleAppearances: 2,
          matchesPresent: 1,
          averageunitLevel: 5,
          maxUnitLevel: 7,
          level4ReachRate: 1,
          level7ReachRate: 1,
          averageDamagePerBattle: 800,
          averageDamagePerMatch: 1600,
          activeBattleRate: 1,
          averageAttackCountPerBattle: 3,
          averageBasicSkillActivationsPerBattle: 1,
          averagePairSkillActivationsPerBattle: 0,
          averageHitCountPerBattle: 2,
          averageDamageTakenPerBattle: 200,
          averageFirstAttackMs: 120,
          averageLifetimeMs: 900,
          zeroDamageBattleRate: 0,
          survivalRate: 0.5,
          ownerWinRate: 1,
          adoptionRate: 1,
        }],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.economy.overall).toMatchObject({
      averageFinalGold: 6,
      averageGoldEarned: 20,
      averageGoldSpent: 30,
      averageSpecialUnitUpgradeCount: 1,
    });
    expect(analysis.progression.heroes).toMatchObject({
      unitCount: 1,
      averageLevel: 5,
      level7ReachRate: 1,
    });
    expect(analysis.progression.byUnit).toContainEqual(expect.objectContaining({
      side: "raid",
      unitId: "marisa",
      unitCategory: "hero",
      maxLevel: 7,
    }));
  });

  test("classifies scarlet mansion units as boss exclusive progression", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
        bossBattleUnitMetrics: [{
          unitId: "meiling",
          unitType: "vanguard",
          unitName: "紅美鈴",
          battleAppearances: 2,
          matchesPresent: 1,
          averageunitLevel: 4,
          maxUnitLevel: 5,
          level4ReachRate: 1,
          level7ReachRate: 0,
          averageDamagePerBattle: 400,
          averageDamagePerMatch: 800,
          activeBattleRate: 1,
          averageAttackCountPerBattle: 3,
          averageBasicSkillActivationsPerBattle: 0,
          averageHitCountPerBattle: 2,
          averageDamageTakenPerBattle: 500,
          averageFirstAttackMs: 300,
          averageLifetimeMs: 1000,
          zeroDamageBattleRate: 0,
          survivalRate: 0.5,
          ownerWinRate: 0.5,
          adoptionRate: 1,
        }],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.progression.bossExclusiveUnits).toMatchObject({
      unitCount: 1,
      averageLevel: 4,
      maxLevel: 5,
      level4ReachRate: 1,
    });
    expect(analysis.progression.byUnit).toContainEqual(expect.objectContaining({
      side: "boss",
      unitId: "meiling",
      unitCategory: "bossExclusive",
    }));
  });

  test("reports balance issues when usable samples fall outside target bands", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
        requestedMatchCount: 100,
        completedMatches: 100,
        bossWins: 80,
        raidWins: 20,
        bossWinRate: 0.8,
        raidWinRate: 0.2,
        averageRounds: 8,
        roundHistogram: { "12": 10 },
        battleMetrics: {
          totalBattles: 100,
          averageBossSurvivorsAtBattleEnd: 2,
          averageRaidSurvivorsAtBattleEnd: 1,
          bothSidesSurvivedRate: 0,
          bossWipedRate: 0.1,
          raidWipedRate: 0.8,
          endReasonCounts: {
            annihilation: 100,
            mutual_annihilation: 0,
            timeout_hp_lead: 0,
            timeout_hp_tie: 0,
            phase_hp_depleted: 0,
            boss_defeated: 0,
            forced: 0,
            unexpected: 0,
          },
        },
        roundDetails: Array.from({ length: 10 }, (_, matchIndex) => ({
          matchIndex,
          matchWinnerRole: "boss" as const,
          totalRounds: 12,
          roundIndex: 12,
          battleEndTimeMs: 30_000,
          phaseHpTarget: 0,
          phaseDamageDealt: 1200,
          phaseCompletionRate: 0,
          phaseResult: "failed" as const,
          allRaidPlayersWipedOut: true,
          raidPlayersWipedOut: 3,
          raidPlayersEliminatedAfterRound: 3,
          bossSurvivors: 2,
          raidSurvivors: 0,
          bossTotalDamage: 2600,
          raidTotalDamage: 1200,
          raidPhaseContributionDamage: 0,
          battleEndReasons: ["annihilation" as const],
          battleWinnerRoles: ["boss" as const],
          raidPlayerConsequences: [],
          topBossUnits: [],
          topRaidUnits: [],
        })),
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.integrity.status).toBe("pass");
    expect(analysis.balance.status).toBe("needs_adjustment");
    expect(analysis.balance.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "boss_win_rate_outside_target",
        severity: "warning",
        recommendedNextAction: "balance_adjustment",
      }),
      expect.objectContaining({
        code: "r12_reach_rate_outside_target",
        severity: "warning",
      }),
      expect.objectContaining({
        code: "final_battle_raid_win_rate_outside_target",
        severity: "warning",
      }),
    ]));
  });

  test("exposes shop metrics and real-play round seconds for balance analysis", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
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
        shopOfferMetrics: [{
          unitId: "patchouli",
          unitName: "パチュリー・ノーレッジ",
          unitType: "mage",
          role: "boss",
          source: "bossShop",
          cost: 4,
          observationCount: 20,
          matchesPresent: 10,
          offeredMatchRate: 1,
          purchaseCount: 8,
          purchaseMatchCount: 8,
          purchaseRate: 0.4,
          finalBoardCopies: 6,
          finalBoardMatchCount: 6,
          finalBoardAdoptionRate: 0.6,
        }],
        roundDetails: [{
          matchIndex: 0,
          matchWinnerRole: "boss",
          totalRounds: 1,
          roundIndex: 1,
          battleEndTimeMs: 50,
          phaseHpTarget: 600,
          phaseDamageDealt: 600,
          phaseCompletionRate: 1,
          phaseHpPowerIndex: 16,
          phaseResult: "success",
          allRaidPlayersWipedOut: false,
          raidPlayersWipedOut: 0,
          raidPlayersEliminatedAfterRound: 0,
          bossSurvivors: 1,
          raidSurvivors: 3,
          bossTotalDamage: 100,
          raidTotalDamage: 600,
          raidPhaseContributionDamage: 600,
          battleEndReasons: ["phase_hp_depleted"],
          battleWinnerRoles: ["raid"],
          raidPlayerConsequences: [],
          topBossUnits: [],
          topRaidUnits: [],
        }],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.rounds[0]).toMatchObject({
      roundIndex: 1,
      averageBattleEndSeconds: 0.05,
      averageBattleEndRealPlaySeconds: 5,
      averagePhaseHpPowerIndex: 16,
    });
    expect(analysis.shop.mostOffered).toContainEqual(expect.objectContaining({
      unitId: "patchouli",
      source: "bossShop",
      offeredMatchRate: 1,
      purchaseRate: 0.4,
      finalBoardAdoptionRate: 0.6,
    }));
  });
});
