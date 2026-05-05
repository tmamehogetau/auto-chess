import { describe, expect, test } from "vitest";
import type {
  BotOnlyBaselineAggregateReport,
  BotOnlyBaselineBossBodyGuardDecisionSnapshot,
  BotOnlyBaselineMatchRoundDetail,
  BotOnlyBaselineRoundPlayerConsequence,
  BotOnlyBaselineRoundUnitDetail,
} from "./bot-balance-baseline-aggregate";
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

function createRoundUnit(
  overrides: Partial<BotOnlyBaselineRoundUnitDetail>,
): BotOnlyBaselineRoundUnitDetail {
  return {
    playerId: "P1",
    label: "P1",
    unitId: "meiling",
    unitName: "紅美鈴",
    unitType: "vanguard",
    side: "boss",
    totalDamage: 0,
    phaseContributionDamage: 0,
    finalHp: 0,
    alive: false,
    unitLevel: 1,
    ...overrides,
  };
}

function createBossBodyGuardDecision(
  overrides: Partial<BotOnlyBaselineBossBodyGuardDecisionSnapshot> = {},
): BotOnlyBaselineBossBodyGuardDecisionSnapshot {
  return {
    roundIndex: 12,
    playerId: "P1",
    label: "P1",
    decision: "none",
    reason: "side_backline_guarded",
    bossCell: 2,
    directGuardCell: 8,
    directGuardUnitId: "meiling",
    directGuardUnitName: "紅美鈴",
    directGuardUnitType: "vanguard",
    directGuardLevel: 7,
    strongestGuardCell: 9,
    strongestGuardUnitId: "junko",
    strongestGuardUnitName: "純狐",
    strongestGuardUnitType: "vanguard",
    strongestGuardLevel: 3,
    benchFrontlineCount: 0,
    directEmpty: false,
    strongerOffDirect: false,
    actionFromCell: null,
    actionToCell: null,
    ...overrides,
  };
}

function createRaidPlayerConsequence(
  overrides: Partial<BotOnlyBaselineRoundPlayerConsequence>,
): BotOnlyBaselineRoundPlayerConsequence {
  return {
    playerId: "raid-1",
    label: "P1",
    role: "raid",
    battleStartUnitCount: 3,
    playerWipedOut: false,
    remainingLivesBefore: 2,
    remainingLivesAfter: 2,
    eliminatedAfter: false,
    ...overrides,
  };
}

function createFinalBattleRound(
  overrides: Partial<BotOnlyBaselineMatchRoundDetail>,
): BotOnlyBaselineMatchRoundDetail {
  return {
    matchIndex: 0,
    matchWinnerRole: "raid",
    totalRounds: 12,
    roundIndex: 12,
    battleEndTimeMs: 20_000,
    phaseHpTarget: 0,
    phaseDamageDealt: 3_000,
    phaseCompletionRate: 0,
    phaseHpPowerIndex: null,
    phaseResult: "success",
    allRaidPlayersWipedOut: false,
    raidPlayersWipedOut: 0,
    raidPlayersEliminatedAfterRound: 0,
    bossSurvivors: 1,
    raidSurvivors: 5,
    bossTotalDamage: 1_000,
    raidTotalDamage: 5_000,
    raidPhaseContributionDamage: 3_000,
    battleEndReasons: ["boss_defeated"],
    battleWinnerRoles: ["raid"],
    raidPlayerConsequences: [],
    bossBodyFocus: {
      unitId: "remilia",
      unitName: "レミリア",
      cell: 2,
      x: 2,
      y: 0,
      unitLevel: 4,
      damageTaken: 3_000,
      directPhaseDamage: 3_000,
      firstDamageAtMs: null,
      defeated: true,
      finalHp: 0,
    },
    bossBodyGuardDecision: createBossBodyGuardDecision(),
    topBossUnits: [],
    topRaidUnits: [],
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

  test("summarizes R12 body breaches by direct guard state and unit contributors", () => {
    const summary = createSummary({
      aggregate: createSampleAggregate({
        completedMatches: 4,
        roundDetails: [
          createFinalBattleRound({
            matchIndex: 0,
            bossSurvivors: 2,
            bossBodyDirectGuardOutcome: {
              ...createRoundUnit({
                unitId: "byakuren",
                unitName: "聖白蓮",
                unitType: "vanguard",
                alive: true,
                finalHp: 1_100,
                damageTaken: 450,
                unitLevel: 6,
              }),
              bossCell: 2,
              expectedCell: 8,
              matchedDecisionUnit: false,
            },
            topBossUnits: [
              createRoundUnit({ unitId: "meiling", unitName: "紅美鈴", alive: true, finalHp: 900, unitLevel: 7 }),
              createRoundUnit({
                unitId: "utsuho",
                unitName: "霊烏路空",
                unitType: "mage",
                alive: true,
                finalHp: 700,
                unitLevel: 2,
              }),
            ],
            topRaidUnits: [
              createRoundUnit({
                playerId: "P2",
                label: "P2",
                unitId: "shion",
                unitName: "依神紫苑",
                unitType: "assassin",
                side: "raid",
                totalDamage: 4_200,
                phaseContributionDamage: 1_200,
                finalHp: 800,
                alive: true,
                unitLevel: 7,
              }),
              createRoundUnit({
                playerId: "P3",
                label: "P3",
                unitId: "ariya",
                unitName: "磐永阿梨夜",
                unitType: "vanguard",
                side: "raid",
                totalDamage: 5_000,
                phaseContributionDamage: 1_800,
                finalHp: 600,
                alive: true,
                unitLevel: 7,
              }),
            ],
          }),
          createFinalBattleRound({
            matchIndex: 1,
            bossSurvivors: 1,
            bossBodyDirectGuardOutcome: {
              ...createRoundUnit({
                unitId: "meiling",
                unitName: "紅美鈴",
                alive: false,
                finalHp: 0,
                damageTaken: 1_250,
                unitLevel: 7,
              }),
              bossCell: 2,
              expectedCell: 8,
              matchedDecisionUnit: true,
            },
            topBossUnits: [
              createRoundUnit({ unitId: "meiling", unitName: "紅美鈴", alive: false, finalHp: 0, unitLevel: 7 }),
              createRoundUnit({
                unitId: "patchouli",
                unitName: "パチュリー・ノーレッジ",
                unitType: "mage",
                alive: true,
                finalHp: 950,
                unitLevel: 6,
              }),
            ],
            topRaidUnits: [
              createRoundUnit({
                playerId: "P2",
                label: "P2",
                unitId: "mayumi",
                unitName: "杖刀偶磨弓",
                unitType: "ranger",
                side: "raid",
                totalDamage: 4_000,
                phaseContributionDamage: 1_500,
                finalHp: 500,
                alive: true,
                unitLevel: 5,
              }),
              createRoundUnit({
                playerId: "P3",
                label: "P3",
                unitId: "marisa",
                unitName: "霧雨魔理沙",
                unitType: "hero",
                side: "raid",
                totalDamage: 3_500,
                phaseContributionDamage: 1_500,
                finalHp: 500,
                alive: true,
                unitLevel: 7,
              }),
            ],
          }),
          createFinalBattleRound({
            matchIndex: 2,
            bossSurvivors: 0,
            topBossUnits: [
              createRoundUnit({ unitId: "meiling", unitName: "紅美鈴", alive: false, finalHp: 0, unitLevel: 7 }),
            ],
            topRaidUnits: [
              createRoundUnit({
                playerId: "P2",
                label: "P2",
                unitId: "shion",
                unitName: "依神紫苑",
                unitType: "assassin",
                side: "raid",
                totalDamage: 4_300,
                phaseContributionDamage: 3_000,
                finalHp: 700,
                alive: true,
                unitLevel: 7,
              }),
            ],
          }),
          createFinalBattleRound({
            matchIndex: 3,
            matchWinnerRole: "boss",
            phaseDamageDealt: 800,
            phaseResult: "failed",
            bossSurvivors: 4,
            raidSurvivors: 0,
            battleEndReasons: ["annihilation"],
            battleWinnerRoles: ["boss"],
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
              defeated: false,
              finalHp: 2_200,
            },
            topBossUnits: [
              createRoundUnit({
                unitId: "hecatia",
                unitName: "ヘカーティア・ラピスラズリ",
                unitType: "mage",
                totalDamage: 3_600,
                alive: true,
                finalHp: 900,
                unitLevel: 4,
              }),
              createRoundUnit({
                unitId: "remilia",
                unitName: "レミリア",
                unitType: "hero",
                totalDamage: 2_400,
                alive: true,
                finalHp: 2_200,
                unitLevel: 7,
              }),
              createRoundUnit({
                unitId: "meiling",
                unitName: "紅美鈴",
                totalDamage: 1_100,
                alive: true,
                finalHp: 1_200,
                unitLevel: 7,
              }),
            ],
            topRaidUnits: [
              createRoundUnit({
                playerId: "P2",
                label: "P2",
                unitId: "ariya",
                unitName: "磐永阿梨夜",
                unitType: "vanguard",
                side: "raid",
                totalDamage: 2_200,
                phaseContributionDamage: 300,
                finalHp: 0,
                alive: false,
                unitLevel: 7,
              }),
              createRoundUnit({
                playerId: "P3",
                label: "P3",
                unitId: "marisa",
                unitName: "霧雨魔理沙",
                unitType: "hero",
                side: "raid",
                totalDamage: 1_700,
                phaseContributionDamage: 250,
                finalHp: 0,
                alive: false,
                unitLevel: 7,
              }),
            ],
          }),
        ],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.finalBattle.bodyProtection).toMatchObject({
      bossBodyDefeatedWithBossSurvivorsCount: 2,
      directGuardAliveWhenBodyBreachedCount: 1,
      directGuardAliveWhenBodyBreachedRate: 0.5,
      directGuardDefeatedWhenBodyBreachedCount: 1,
      directGuardDefeatedWhenBodyBreachedRate: 0.5,
    });
    expect(analysis.finalBattle.bodyProtection.directGuardOutcomesWhenBodyBreached).toEqual([
      expect.objectContaining({
        unitId: "byakuren",
        sampleCount: 1,
        aliveAtBattleEndCount: 1,
        aliveAtBattleEndRate: 1,
        averageDamageTaken: 450,
        matchedDecisionUnitRate: 0,
      }),
      expect.objectContaining({
        unitId: "meiling",
        sampleCount: 1,
        defeatedAtBattleEndCount: 1,
        defeatedAtBattleEndRate: 1,
        averageDamageTaken: 1_250,
        matchedDecisionUnitRate: 1,
      }),
    ]);
    expect(analysis.finalBattle.bodyProtection.survivingBossUnitsWhenBodyBreached).toEqual([
      expect.objectContaining({
        unitId: "meiling",
        sampleCount: 1,
        sampleRate: 0.5,
        averageUnitLevel: 7,
        averageFinalHp: 900,
      }),
      expect.objectContaining({
        unitId: "patchouli",
        sampleCount: 1,
        sampleRate: 0.5,
        averageUnitLevel: 6,
        averageFinalHp: 950,
      }),
      expect.objectContaining({
        unitId: "utsuho",
        sampleCount: 1,
        sampleRate: 0.5,
        averageUnitLevel: 2,
        averageFinalHp: 700,
      }),
    ]);
    expect(analysis.finalBattle.bodyProtection.raidBodyDamageContributorsWhenBodyBreached).toEqual([
      expect.objectContaining({
        unitId: "ariya",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_800,
        phaseContributionShare: 0.3,
      }),
      expect.objectContaining({
        unitId: "marisa",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_500,
        phaseContributionShare: 0.25,
      }),
      expect.objectContaining({
        unitId: "mayumi",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_500,
        phaseContributionShare: 0.25,
      }),
      expect.objectContaining({
        unitId: "shion",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_200,
        phaseContributionShare: 0.2,
      }),
    ]);
    expect(analysis.finalBattle.bossOffense.defeatedRaidUnitsWhenBossWins).toEqual([
      expect.objectContaining({
        unitId: "ariya",
        sampleCount: 1,
        sampleRate: 1,
        averageUnitLevel: 7,
        averageTotalDamage: 2_200,
      }),
      expect.objectContaining({
        unitId: "marisa",
        sampleCount: 1,
        sampleRate: 1,
        averageUnitLevel: 7,
        averageTotalDamage: 1_700,
      }),
    ]);
    expect(analysis.finalBattle.bossOffense.bossDamageContributorsWhenBossWins).toEqual([
      expect.objectContaining({
        unitId: "hecatia",
        sampleCount: 1,
        sampleRate: 1,
        totalDamage: 3_600,
        damageShare: 3_600 / 7_100,
        averageTotalDamage: 3_600,
        averageUnitLevel: 4,
      }),
      expect.objectContaining({
        unitId: "remilia",
        sampleCount: 1,
        sampleRate: 1,
        totalDamage: 2_400,
        damageShare: 2_400 / 7_100,
        averageTotalDamage: 2_400,
        averageUnitLevel: 7,
      }),
      expect.objectContaining({
        unitId: "meiling",
        sampleCount: 1,
        sampleRate: 1,
        totalDamage: 1_100,
        damageShare: 1_100 / 7_100,
        averageTotalDamage: 1_100,
        averageUnitLevel: 7,
      }),
    ]);
    expect(analysis.finalBattle.bossOffense.survivingRaidDamageContributorsWhenBodyBreached).toEqual([
      expect.objectContaining({
        unitId: "ariya",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_800,
        phaseContributionShare: 0.3,
      }),
      expect.objectContaining({
        unitId: "marisa",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_500,
        phaseContributionShare: 0.25,
      }),
      expect.objectContaining({
        unitId: "mayumi",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_500,
        phaseContributionShare: 0.25,
      }),
      expect.objectContaining({
        unitId: "shion",
        sampleCount: 1,
        totalPhaseContributionDamage: 1_200,
        phaseContributionShare: 0.2,
      }),
    ]);
  });

  test("contrasts R12 final battle conversion by winner and boss win damage buckets", () => {
    const createSpellMetric = (totalDamage: number) => ({
      spellId: "remilia_last_word",
      casterBattleUnitId: "remilia:0",
      activationCount: 1,
      firstActivationAtMs: 100,
      lastActivationAtMs: 100,
      tickCount: 1,
      firstTickAtMs: 100,
      lastTickAtMs: 100,
      totalDamage,
      maxStack: 1,
    });
    const createGuardOutcome = (alive: boolean, finalHp: number, damageTaken: number) => ({
      ...createRoundUnit({
        unitId: "meiling",
        unitName: "紅美鈴",
        side: "boss" as const,
        finalHp,
        alive,
        unitLevel: 7,
        damageTaken,
      }),
      bossCell: 2,
      expectedCell: 8,
      matchedDecisionUnit: true,
    });
    const summary = createSummary({
      aggregate: createSampleAggregate({
        completedMatches: 3,
        roundHistogram: { "12": 3 },
        roundDetails: [
          createFinalBattleRound({
            matchIndex: 0,
            matchWinnerRole: "boss",
            phaseDamageDealt: 0,
            phaseResult: "failed",
            allRaidPlayersWipedOut: true,
            raidPlayersWipedOut: 3,
            raidPlayersEliminatedAfterRound: 1,
            bossSurvivors: 5,
            raidSurvivors: 0,
            bossTotalDamage: 9_000,
            raidTotalDamage: 4_000,
            raidPhaseContributionDamage: 0,
            battleEndReasons: ["annihilation"],
            battleWinnerRoles: ["boss"],
            raidPlayerConsequences: [
              createRaidPlayerConsequence({
                playerId: "raid-1",
                label: "P1",
                battleStartUnitCount: 3,
                playerWipedOut: true,
                remainingLivesBefore: 1,
                remainingLivesAfter: 0,
                eliminatedAfter: true,
              }),
              createRaidPlayerConsequence({
                playerId: "raid-2",
                label: "P2",
                battleStartUnitCount: 2,
                playerWipedOut: true,
                remainingLivesAfter: 1,
              }),
              createRaidPlayerConsequence({
                playerId: "raid-3",
                label: "P3",
                battleStartUnitCount: 1,
                playerWipedOut: true,
                remainingLivesAfter: 1,
              }),
            ],
            bossBodyDirectGuardOutcome: createGuardOutcome(true, 700, 500),
            bossSpellMetrics: [createSpellMetric(1_000)],
          }),
          createFinalBattleRound({
            matchIndex: 1,
            matchWinnerRole: "boss",
            phaseDamageDealt: 2_700,
            phaseResult: "failed",
            allRaidPlayersWipedOut: true,
            raidPlayersWipedOut: 2,
            bossSurvivors: 2,
            raidSurvivors: 0,
            bossTotalDamage: 8_000,
            raidTotalDamage: 8_500,
            raidPhaseContributionDamage: 2_700,
            battleEndReasons: ["annihilation"],
            battleWinnerRoles: ["boss"],
            raidPlayerConsequences: [
              createRaidPlayerConsequence({ playerId: "raid-1", label: "P1" }),
              createRaidPlayerConsequence({ playerId: "raid-2", label: "P2" }),
              createRaidPlayerConsequence({
                playerId: "raid-3",
                label: "P3",
                playerWipedOut: true,
                remainingLivesAfter: 1,
              }),
            ],
            bossBodyDirectGuardOutcome: createGuardOutcome(false, 0, 1_800),
            bossSpellMetrics: [createSpellMetric(900)],
          }),
          createFinalBattleRound({
            matchIndex: 2,
            matchWinnerRole: "raid",
            phaseDamageDealt: 3_200,
            phaseResult: "success",
            allRaidPlayersWipedOut: false,
            raidPlayersWipedOut: 0,
            bossSurvivors: 0,
            raidSurvivors: 6,
            bossTotalDamage: 6_000,
            raidTotalDamage: 12_000,
            raidPhaseContributionDamage: 3_200,
            battleEndReasons: ["boss_defeated"],
            battleWinnerRoles: ["raid"],
            raidPlayerConsequences: [
              createRaidPlayerConsequence({ playerId: "raid-1", label: "P1" }),
              createRaidPlayerConsequence({ playerId: "raid-2", label: "P2" }),
              createRaidPlayerConsequence({ playerId: "raid-3", label: "P3" }),
            ],
            bossBodyDirectGuardOutcome: createGuardOutcome(false, 0, 2_400),
            bossSpellMetrics: [createSpellMetric(800)],
          }),
        ],
      }),
    });

    const analysis = buildBotBalanceBaselineAnalysis(summary);

    expect(analysis.finalBattle.outcomeContrasts).toEqual([
      expect.objectContaining({
        winner: "boss",
        sampleCount: 2,
        sampleRate: 2 / 3,
        averageBossBodyDamage: 1_350,
        averageRaidSurvivors: 0,
        averageRaidPlayersWipedOut: 2.5,
        averageBattleStartUnitsPerRaidPlayer: 2.5,
        directGuardAliveRate: 0.5,
        averageDirectGuardDamageTaken: 1_150,
        averageBossDamage: 8_500,
        averageRaidDamage: 6_250,
        averageBossSpellDamage: 950,
      }),
      expect.objectContaining({
        winner: "raid",
        sampleCount: 1,
        sampleRate: 1 / 3,
        bossBodyDefeatRate: 1,
        averageBossBodyDamage: 3_200,
        averageRaidSurvivors: 6,
        averageBattleStartUnitsPerRaidPlayer: 3,
        directGuardAliveRate: 0,
        averageDirectGuardDamageTaken: 2_400,
        averageBossDamage: 6_000,
        averageRaidDamage: 12_000,
        averageBossSpellDamage: 800,
      }),
    ]);
    expect(analysis.finalBattle.bossWinBodyDamageBuckets).toEqual([
      expect.objectContaining({
        bucketId: "zero",
        sampleCount: 1,
        sampleRate: 0.5,
        averageBossBodyDamage: 0,
        directGuardAliveRate: 1,
        averageBattleStartUnitsPerRaidPlayer: 2,
      }),
      expect.objectContaining({ bucketId: "low", sampleCount: 0 }),
      expect.objectContaining({ bucketId: "mid", sampleCount: 0 }),
      expect.objectContaining({
        bucketId: "near",
        sampleCount: 1,
        sampleRate: 0.5,
        averageBossBodyDamage: 2_700,
        directGuardAliveRate: 0,
        averageBattleStartUnitsPerRaidPlayer: 3,
      }),
    ]);
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
