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
    roundSurvivalDiagnostics: [{
      roundIndex: 1,
      battleSamples: 3,
      averageBattleEndMs: 5700,
      phaseSuccessRate: 2 / 3,
      phaseSuccessWithBossWipeRate: 1 / 3,
      phaseFailureWithRaidWipeRate: 1 / 3,
      bossWipedRate: 1 / 3,
      raidWipedRate: 1 / 3,
      bothSidesSurvivedRate: 1 / 3,
      averageBossStartUnitCount: 4,
      averageBossSurvivors: 1.2,
      bossUnitSurvivalRate: 0.3,
      averageBossFinalHp: 640,
      averageBossEstimatedMaxHp: 1800,
      bossRemainingHpRate: 640 / 1800,
      averageRaidStartUnitCount: 8,
      averageRaidSurvivors: 4.5,
      raidUnitSurvivalRate: 4.5 / 8,
      averageRaidFinalHp: 2100,
      averageRaidEstimatedMaxHp: 4200,
      raidRemainingHpRate: 0.5,
    }],
    roundUnitSurvivalDiagnostics: [{
      roundIndex: 1,
      side: "boss",
      unitId: "remilia",
      unitType: "boss",
      unitName: "レミリア",
      battleAppearances: 3,
      matchesPresent: 3,
      averageUnitLevel: 2,
      survivalRate: 1 / 3,
      averageFinalHp: 400,
      averageEstimatedMaxHp: 1200,
      remainingHpRate: 1 / 3,
      averageDamageTaken: 800,
      averageLifetimeMs: 5400,
      averageDamagePerBattle: 900,
      zeroDamageBattleRate: 0,
    }, {
      roundIndex: 1,
      side: "raid",
      unitId: "marisa",
      unitType: "hero",
      unitName: "霧雨魔理沙",
      battleAppearances: 3,
      matchesPresent: 3,
      averageUnitLevel: 1,
      survivalRate: 2 / 3,
      averageFinalHp: 320,
      averageEstimatedMaxHp: 500,
      remainingHpRate: 0.64,
      averageDamageTaken: 180,
      averageLifetimeMs: 5700,
      averageDamagePerBattle: 600,
      zeroDamageBattleRate: 0,
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
    heroTeamMetrics: [{
      heroId: "reimu",
      heroName: "博麗霊夢",
      matchesPresent: 6,
      raidTeamWins: 2,
      raidTeamWinRate: 1 / 3,
      firstPlaceRate: 1 / 6,
      averagePlacement: 2.3,
      averageRemainingLives: 1.5,
      averageFinalGold: 4.2,
      averageGoldEarned: 16.8,
      averageGoldSpent: 15.4,
      averageSpecialUnitUpgradeCount: 2.1,
    }],
    heroCompositionMetrics: [{
      compositionKey: "reimu / marisa / keiki",
      heroIds: ["reimu", "marisa", "keiki"],
      heroNames: ["博麗霊夢", "霧雨魔理沙", "埴安神袿姫"],
      matchesPresent: 3,
      raidWins: 1,
      raidWinRate: 1 / 3,
      averageRounds: 10.7,
    }],
    playerEconomyBreakdowns: {
      P1: {
        fixedPrepIncome: 18,
        raidPhaseSuccessBonusIncome: 0,
        sellIncome: 2,
        specialEconomyIncome: 1,
        normalShopSpend: 8,
        bossShopSpend: 4,
        refreshSpend: 2,
        specialUnitUpgradeSpend: 3,
        otherSpend: 0.7,
        loggedGoldGain: 1.2,
        loggedGoldSpent: 13.7,
        finalUnusedGold: 8.4,
      },
      P2: {
        fixedPrepIncome: 10,
        raidPhaseSuccessBonusIncome: 2,
        sellIncome: 1,
        specialEconomyIncome: 0,
        normalShopSpend: 9,
        bossShopSpend: 0,
        refreshSpend: 4,
        specialUnitUpgradeSpend: 2,
        otherSpend: 0.1,
        loggedGoldGain: 0.5,
        loggedGoldSpent: 15.1,
        finalUnusedGold: 4.7,
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
    okinaSubHostMetrics: [{
      hostUnitId: "rin",
      hostUnitType: "vanguard",
      hostUnitName: "火焔猫燐",
      battleAppearances: 7,
      matchesPresent: 5,
      averageHostLevel: 2.2,
      averageDamagePerBattle: 120.5,
      averageDamageTakenPerBattle: 220.3,
      averageLifetimeMs: 610.5,
      survivalRate: 0.8,
      ownerWinRate: 0.4,
    }],
    okinaSubHostRoundMetrics: [{
      roundIndex: 4,
      hostUnitId: "rin",
      hostUnitType: "vanguard",
      hostUnitName: "火焔猫燐",
      battleAppearances: 3,
      matchesPresent: 2,
      averageHostLevel: 2.5,
      averageDamagePerBattle: 180,
      averageDamageTakenPerBattle: 160,
      averageLifetimeMs: 700,
      survivalRate: 2 / 3,
      ownerWinRate: 1 / 3,
    }],
    okinaHeroSubDecisionRoundMetrics: [{
      roundIndex: 4,
      samples: 3,
      actionRecommendedSamples: 1,
      noCandidateSamples: 1,
      frontValuePreferredSamples: 1,
      currentHostKeptSamples: 0,
      averageCandidateCount: 1.67,
      averageFrontEquivalentValue: 90,
      averageBestHostGain: 120,
      averageBestHostCurrentPowerScore: 740,
      averageBestHostFutureValueScore: 360,
      averageBestHostTransitionReadinessScore: 64,
      averageBestHostProtectionScore: 0,
      averageBestToFrontRatio: 1.33,
      mostFrequentBestHostUnitId: "rin",
      mostFrequentBestHostUnitName: "火焔猫燐",
      mostFrequentBestHostSamples: 2,
    }],
    boardRefitDecisionRoundMetrics: [{
      roundIndex: 6,
      samples: 4,
      boardFullSamples: 3,
      attemptSamples: 2,
      recommendedReplacementSamples: 1,
      committedSamples: 0,
      futureCandidateKeptCount: 1,
      averageBenchPressure: 0.75,
      averageReplacementScore: 24.5,
      p25ReplacementScore: -42,
      p50ReplacementScore: 24.5,
      p75ReplacementScore: 91,
      mostFrequentIncomingUnitId: "hecatia",
      mostFrequentIncomingUnitName: "ヘカーティア・ラピスラズリ",
      mostFrequentIncomingSamples: 2,
      mostFrequentIncomingReason: "future_candidate",
      mostFrequentIncomingReasonSamples: 2,
      mostFrequentOutgoingUnitId: "nazrin",
      mostFrequentOutgoingUnitName: "ナズーリン",
      mostFrequentOutgoingSamples: 1,
      mostFrequentOutgoingReason: "protected_outgoing",
      mostFrequentOutgoingReasonSamples: 1,
    }],
    boardRefitDecisionRoleMetrics: [{
      role: "boss",
      samples: 3,
      boardFullSamples: 3,
      attemptSamples: 2,
      recommendedReplacementSamples: 2,
      committedSamples: 1,
      futureCandidateKeptCount: 0,
      averageBenchPressure: 0.5,
      averageReplacementScore: 72,
      p25ReplacementScore: 12,
      p50ReplacementScore: 72,
      p75ReplacementScore: 120,
      mostFrequentIncomingUnitId: "patchouli",
      mostFrequentIncomingUnitName: "パチュリー・ノーレッジ",
      mostFrequentIncomingSamples: 2,
      mostFrequentIncomingReason: "replacement_ready",
      mostFrequentIncomingReasonSamples: 2,
      mostFrequentOutgoingUnitId: "momoyo",
      mostFrequentOutgoingUnitName: "姫虫百々世",
      mostFrequentOutgoingSamples: 1,
      mostFrequentOutgoingReason: "weak_outgoing",
      mostFrequentOutgoingReasonSamples: 1,
    }, {
      role: "raid",
      samples: 1,
      boardFullSamples: 1,
      attemptSamples: 1,
      recommendedReplacementSamples: 0,
      committedSamples: 0,
      futureCandidateKeptCount: 1,
      averageBenchPressure: 0.875,
      averageReplacementScore: -42,
      p25ReplacementScore: -42,
      p50ReplacementScore: -42,
      p75ReplacementScore: -42,
      mostFrequentIncomingUnitId: "hecatia",
      mostFrequentIncomingUnitName: "ヘカーティア・ラピスラズリ",
      mostFrequentIncomingSamples: 1,
      mostFrequentIncomingReason: "future_candidate",
      mostFrequentIncomingReasonSamples: 1,
      mostFrequentOutgoingUnitId: "nazrin",
      mostFrequentOutgoingUnitName: "ナズーリン",
      mostFrequentOutgoingSamples: 1,
      mostFrequentOutgoingReason: "protected_outgoing",
      mostFrequentOutgoingReasonSamples: 1,
    }],
    boardRefitDecisionRoleRoundMetrics: [{
      role: "boss",
      roundIndex: 6,
      samples: 3,
      boardFullSamples: 3,
      attemptSamples: 2,
      recommendedReplacementSamples: 2,
      committedSamples: 1,
      futureCandidateKeptCount: 0,
      averageBenchPressure: 0.5,
      averageReplacementScore: 72,
      p25ReplacementScore: 12,
      p50ReplacementScore: 72,
      p75ReplacementScore: 120,
      mostFrequentIncomingUnitId: "patchouli",
      mostFrequentIncomingUnitName: "パチュリー・ノーレッジ",
      mostFrequentIncomingSamples: 2,
      mostFrequentIncomingReason: "replacement_ready",
      mostFrequentIncomingReasonSamples: 2,
      mostFrequentOutgoingUnitId: "momoyo",
      mostFrequentOutgoingUnitName: "姫虫百々世",
      mostFrequentOutgoingSamples: 1,
      mostFrequentOutgoingReason: "weak_outgoing",
      mostFrequentOutgoingReasonSamples: 1,
    }],
    finalPlayerBoardMetrics: [{
      label: "P2",
      role: "raid",
      matchesPresent: 9,
      averageDeployedUnitCount: 3,
      averageDeployedAssetValue: 11.4,
      averageSpecialUnitCount: 1,
      averageStandardUnitCount: 2,
    }],
    finalBoardUnitMetrics: [
      {
        unitId: "momoyo",
        unitType: "vanguard",
        unitName: "姫虫百々世",
        totalCopies: 30,
        matchesPresent: 9,
        averageCopiesPerMatch: 3.33,
        adoptionRate: 1,
        averageFinalUnitLevel: 4.2,
        maxFinalUnitLevel: 7,
        finalLevel4Rate: 0.6,
        finalLevel7Rate: 0.2,
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
    bossNormalHighCostMaturationMetrics: [
      {
        unitId: "junko",
        unitName: "純狐",
        unitType: "vanguard",
        cost: 4,
        offerObservationCount: 12,
        offerMatchCount: 6,
        purchaseCount: 4,
        purchaseMatchCount: 3,
        purchaseRate: 4 / 12,
        battleAppearances: 8,
        battleMatchCount: 5,
        battleAdoptionRate: 5 / 9,
        averageBattleUnitLevel: 2.5,
        maxBattleUnitLevel: 4,
        battleLevel4ReachRate: 2 / 5,
        battleLevel7ReachRate: 0,
        finalBoardCopies: 2,
        finalBoardMatchCount: 2,
        finalBoardAdoptionRate: 2 / 9,
        averageFinalUnitLevel: 3.5,
        maxFinalUnitLevel: 4,
        finalLevel4Rate: 1 / 2,
        finalLevel7Rate: 0,
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
    bossExclusiveRoundLevelMetrics: [
      {
        roundIndex: 1,
        unitId: "patchouli",
        unitType: "mage",
        unitName: "パチュリー・ノーレッジ",
        battleAppearances: 6,
        matchesPresent: 5,
        averageUnitLevel: 1.5,
        p25UnitLevel: 1,
        p50UnitLevel: 1,
        p75UnitLevel: 2,
        level4ReachRate: 1 / 6,
        level7ReachRate: 0,
      },
    ],
    highCostRoundMetrics: [
      {
        roundIndex: 1,
        role: "boss",
        source: "bossShop",
        unitId: "patchouli",
        unitName: "パチュリー・ノーレッジ",
        unitType: "mage",
        cost: 4,
        offerObservationCount: 12,
        offerMatchCount: 9,
        purchaseCount: 5,
        purchaseMatchCount: 5,
        battleAppearances: 6,
        battleMatchCount: 5,
        offeredMatchRate: 1,
        purchaseRate: 5 / 12,
        battlePresenceRate: 5 / 9,
      },
    ],
    roundDamageEfficiencyMetrics: [
      {
        roundIndex: 1,
        side: "boss",
        unitId: "patchouli",
        unitType: "mage",
        unitName: "パチュリー・ノーレッジ",
        battleAppearances: 6,
        matchesPresent: 5,
        averageUnitLevel: 1.5,
        totalDamage: 480,
        totalInvestmentCost: 36,
        averageInvestmentCostPerBattle: 6,
        damagePerInvestmentCost: 480 / 36,
      },
      {
        roundIndex: 2,
        side: "boss",
        unitId: "patchouli",
        unitType: "mage",
        unitName: "パチュリー・ノーレッジ",
        battleAppearances: 6,
        matchesPresent: 4,
        averageUnitLevel: 2,
        totalDamage: 520,
        totalInvestmentCost: 48,
        averageInvestmentCostPerBattle: 8,
        damagePerInvestmentCost: 520 / 48,
      },
      {
        roundIndex: 1,
        side: "raid",
        unitId: "rin",
        unitType: "vanguard",
        unitName: "火焔猫燐",
        battleAppearances: 4,
        matchesPresent: 3,
        averageUnitLevel: 1,
        totalDamage: 220,
        totalInvestmentCost: 4,
        averageInvestmentCostPerBattle: 1,
        damagePerInvestmentCost: 55,
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
    optimizationVariant: "raid-optimization-off",
    helperConfigs: [
      { wantsBoss: true, policy: "strength", optimizationVariant: "raid-optimization-off" },
      { wantsBoss: false, policy: "strength", heroId: "okina", optimizationVariant: "raid-optimization-off" },
      { wantsBoss: false, policy: "strength", heroId: "keiki", optimizationVariant: "raid-optimization-off" },
      { wantsBoss: false, policy: "growth", heroId: "jyoon", optimizationVariant: "raid-optimization-off" },
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
        "最適化variant": "raid-optimization-off",
        "helper設定": expect.arrayContaining([
          expect.objectContaining({
            "bot": "bot2",
            "固定主人公": "okina",
            "最適化variant": "raid-optimization-off",
          }),
        ]),
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
    expect(jsonReport["ラウンド別隠岐奈sub host内訳"]).toEqual([
      expect.objectContaining({
        "R": 4,
        "HostユニットID": "rin",
        "Hostユニット名": "火焔猫燐",
        "戦闘登場回数": 3,
        "平均Lv": 2.5,
      }),
    ]);
    expect(jsonReport["ラウンド別隠岐奈sub判断診断"]).toEqual([
      expect.objectContaining({
        "R": 4,
        "診断回数": 3,
        "裏推奨回数": 1,
        "候補なし回数": 1,
        "表優先回数": 1,
        "平均候補数": 1.67,
        "平均表相当値": 90,
        "平均best host gain": 120,
        "平均host currentPower": 740,
        "平均host futureValue": 360,
        "平均host transitionReadiness": 64,
        "平均host protection": 0,
        "最多best host ID": "rin",
      }),
    ]);
    expect(jsonReport["ラウンド別盤面再編成診断"]).toEqual([
      expect.objectContaining({
        "R": 6,
        "診断回数": 4,
        "盤面満杯": 3,
        "試行候補": 2,
        "置換推奨": 1,
        "置換実行": 0,
        "将来候補保持": 1,
        "平均bench圧": 0.75,
        "P50置換score": 24.5,
        "最多incoming": "ヘカーティア・ラピスラズリ (hecatia) x2",
        "最多incoming理由": "future_candidate x2",
        "最多outgoing理由": "protected_outgoing x1",
      }),
    ]);
    expect(jsonReport["ロール別盤面再編成診断"]).toEqual([
      expect.objectContaining({
        "ロール": "boss",
        "診断回数": 3,
        "置換推奨": 2,
        "置換実行": 1,
        "平均bench圧": 0.5,
        "平均置換score": 72,
        "最多incoming": "パチュリー・ノーレッジ (patchouli) x2",
        "最多incoming理由": "replacement_ready x2",
        "最多outgoing理由": "weak_outgoing x1",
      }),
      expect.objectContaining({
        "ロール": "raid",
        "診断回数": 1,
        "置換推奨": 0,
        "将来候補保持": 1,
        "平均bench圧": 0.875,
        "平均置換score": -42,
        "最多incoming": "ヘカーティア・ラピスラズリ (hecatia) x1",
        "最多incoming理由": "future_candidate x1",
        "最多outgoing理由": "protected_outgoing x1",
      }),
    ]);
    expect(jsonReport["ロール・ラウンド別盤面再編成診断"]).toEqual([
      expect.objectContaining({
        "ロール": "boss",
        "R": 6,
        "診断回数": 3,
        "置換推奨": 2,
        "置換実行": 1,
        "最多incoming": "パチュリー・ノーレッジ (patchouli) x2",
        "最多incoming理由": "replacement_ready x2",
        "最多outgoing理由": "weak_outgoing x1",
      }),
    ]);
    expect(jsonReport["プレイヤー別最終盤面価値"]).toEqual([
      expect.objectContaining({
        "プレイヤー": "P2",
        "ロール": "raid",
        "平均出撃数": 3,
        "平均出撃資産価値": 11.4,
      }),
    ]);
    expect(jsonReport["主人公チーム勝率"]).toEqual([
      expect.objectContaining({
        "主人公": "博麗霊夢",
        "主人公ID": "reimu",
        "登場試合数": 6,
        "レイドチーム勝率": 1 / 3,
      }),
    ]);
    expect(jsonReport["主人公構成別勝率"]).toEqual([
      expect.objectContaining({
        "構成": "博麗霊夢 / 霧雨魔理沙 / 埴安神袿姫",
        "構成ID": "reimu / marisa / keiki",
        "レイド勝率": 1 / 3,
      }),
    ]);
    expect(jsonReport["ラウンド別生存診断"]).toEqual([
      expect.objectContaining({
        "ラウンド": 1,
        "戦闘サンプル": 3,
        "平均終了秒(通常換算)": 570,
        "フェーズ成功率": 2 / 3,
        "フェーズ成功かつボス全滅率": 1 / 3,
        "フェーズ失敗かつレイド全滅率": 1 / 3,
        "ボス側全滅率": 1 / 3,
        "レイド側全滅率": 1 / 3,
        "ボス側平均開始数": 4,
        "ボス側平均生存数": 1.2,
        "ボス側ユニット生存率": 0.3,
        "ボス側残HP率": 640 / 1800,
        "レイド側平均開始数": 8,
        "レイド側平均生存数": 4.5,
        "レイド側ユニット生存率": 4.5 / 8,
        "レイド側残HP率": 0.5,
      }),
    ]);
    expect(jsonReport["ラウンド別主要ユニット生存診断"]).toEqual([
      expect.objectContaining({
        "ラウンド": 1,
        "陣営": "boss",
        "ユニット名": "レミリア",
        "戦闘登場回数": 3,
        "生存率": 1 / 3,
        "残HP率": 1 / 3,
      }),
      expect.objectContaining({
        "ラウンド": 1,
        "陣営": "raid",
        "ユニット名": "霧雨魔理沙",
        "戦闘登場回数": 3,
        "生存率": 2 / 3,
        "残HP率": 0.64,
      }),
    ]);
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
        "ログ上のGold消費": 13.7,
      }),
      P2: expect.objectContaining({
        "平均残HP": 95,
        "平均リロール回数": 3.3,
      }),
    });
    expect(jsonReport["経済"]).toEqual({
      P1: expect.objectContaining({
        "固定Prep収入": 18,
        "売却収入": 2,
        "ボスショップ支出": 4,
      }),
      P2: expect.objectContaining({
        "レイド成功ボーナス": 2,
        "通常ショップ支出": 9,
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
        "最終平均Lv": 4.2,
        "最終最大Lv": 7,
        "最終Lv4到達率": 0.6,
        "最終Lv7到達率": 0.2,
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
    expect(jsonReport["ボス通常高コスト成熟診断"]).toEqual([
      expect.objectContaining({
        "ユニットID": "junko",
        "提示回数": 12,
        "購入率": 4 / 12,
        "戦闘採用率": 5 / 9,
        "戦闘平均Lv": 2.5,
        "戦闘Lv4到達率": 2 / 5,
        "最終採用率": 2 / 9,
        "最終平均Lv": 3.5,
        "最終Lv4到達率": 1 / 2,
      }),
    ]);
    expect(jsonReport["ボス専用ラウンド別レベル分布"]).toEqual([
      expect.objectContaining({
        "ラウンド": 1,
        "ユニットID": "patchouli",
        "平均Lv": 1.5,
        "P75Lv": 2,
        "Lv4到達率": 1 / 6,
      }),
    ]);
    expect(jsonReport["高コストラウンド別ショップ進行"]).toEqual([
      expect.objectContaining({
        "ラウンド": 1,
        "ユニットID": "patchouli",
        "提示回数": 12,
        "購入率": 5 / 12,
        "戦闘登場試合率": 5 / 9,
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
    expect(jsonReport["ユニット別加重ダメージ効率"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "陣営": "boss",
        "ユニットID": "patchouli",
        "観測ラウンド数": 2,
        "戦闘登場回数": 12,
        "合計ダメージ": 1000,
        "推定投入コスト": 84,
        "加重ダメージ効率": 1000 / 84,
        "サンプル品質": "usable",
      }),
      expect.objectContaining({
        "陣営": "raid",
        "ユニットID": "rin",
        "サンプル品質": "low",
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
    expect(markdown).toContain("- 最適化variant: raid-optimization-off");
    expect(markdown).toContain("- bot1: boss希望=ON / 購入方針=strength / 最適化variant=raid-optimization-off");
    expect(markdown).toContain("- bot2: boss希望=OFF / 購入方針=strength / 固定主人公=okina / 最適化variant=raid-optimization-off");
    expect(markdown).toContain("## 先に見るべき結論");
    expect(markdown).toContain("## 進行健全性診断");
    expect(markdown).toContain("## バランス診断");
    expect(markdown).toContain("## R12最終戦");
    expect(markdown).toContain("| 試行数 | レイド勝率 | ボス撃破率 | 同時全滅数 | 平均ボス本体ダメージ | 平均ボス残HP | 平均終了秒(高速) | 平均終了秒(通常換算) |");
    expect(markdown).toContain("## ショップ出現診断");
    expect(markdown).toContain("## 全体結果");
    expect(markdown).toContain("## 戦闘終了指標");
    expect(markdown).toContain("| 戦闘数 | 平均ボス側生存数 | 平均レイド側生存数 | 両軍生存終了率 | ボス側全滅率 | レイド側全滅率 |");
    expect(markdown).toContain("| 9 | 1.4 | 2.1 | 77.8% | 11.1% | 22.2% |");
    expect(markdown).toContain("| 片側全滅決着 | annihilation | 2 | 22.2% |");
    expect(markdown).toContain("| 時間切れHP判定決着 | timeout_hp_lead | 5 | 55.6% |");
    expect(markdown).toContain("| フェーズHP削り切り | phase_hp_depleted | 1 | 11.1% |");
    expect(markdown).toContain("## ラウンド別生存診断");
    expect(markdown).toContain("| R | 戦闘数 | 平均終了秒 | フェーズ成功率 | 成功+ボス全滅 | 失敗+レイド全滅 | ボス全滅率 | レイド全滅率 | ボス開始 | ボス生存 | ボス生存率 | ボス残HP率 | レイド開始 | レイド生存 | レイド生存率 | レイド残HP率 |");
    expect(markdown).toContain("| 1 | 3 | 570 | 66.7% | 33.3% | 33.3% | 33.3% | 33.3% | 4 | 1.2 | 30.0% | 35.6% | 8 | 4.5 | 56.3% | 50.0% |");
    expect(markdown).toContain("## ラウンド別主要ユニット生存診断");
    expect(markdown).toContain("| R | 陣営 | ユニット名 | ユニットID | 戦闘数 | 平均Lv | 生存率 | 平均残HP | 残HP率 | 平均被ダメ | 平均生存ms | 平均与ダメ | 0ダメ率 |");
    expect(markdown).toContain("| 1 | boss | レミリア | remilia | 3 | 2 | 33.3% | 400 | 33.3% | 800 | 5400 | 900 | 0.0% |");
    expect(markdown).toContain("| 1 | raid | 霧雨魔理沙 | marisa | 3 | 1 | 66.7% | 320 | 64.0% | 180 | 5700 | 600 | 0.0% |");
    expect(markdown).toContain("## ラウンド分布");
    expect(markdown).toContain("## 各ラウンド詳細");
    expect(markdown).toContain("- 詳細なラウンド別明細は `round-details.ja.md` に分離しています。");
    expect(markdown).not.toContain("| 試合 | R | 終了時間(実プレイ秒) | 最終勝利 | ラウンド結果 | 目的進捗 | 達成率 | レイド全滅 |");
    expect(markdown).not.toContain("| 試合 | R | 終了時間(実プレイ秒) | 最終勝利 | ラウンド結果 | フェーズHP |");
    expect(markdown).not.toContain("| 0 | 1 | 5.7 | boss | failed | 600/600 | 100.0% | YES | 3 | 1 | 0 | フェーズHP削り切り | raid | P2:撃破 2->1 | 霧雨魔理沙 Lv1 dmg=600(phase 600) hp=0 撃破 | レミリア Lv1 dmg=240 hp=1200 生存 |");
    expect(markdown).toContain("## プレイヤー別成績");
    expect(markdown).toContain("## 主人公チーム勝率");
    expect(markdown).toContain("| 博麗霊夢 | reimu | 6 | 2 | 33.3% | 16.7% | 2.3 | 1.5 | 4.2 | 16.8 | 15.4 | 2.1 |");
    expect(markdown).toContain("## 主人公構成別勝率");
    expect(markdown).toContain("| 博麗霊夢 / 霧雨魔理沙 / 埴安神袿姫 | reimu / marisa / keiki | 3 | 1 | 33.3% | 10.7 |");
    expect(markdown).toContain("## 経済");
    expect(markdown).toContain(
      "ログ上のGold増加は、固定Prep収入、レイド成功ボーナス、売却収入、特殊経済収入を含むログ由来の増加量です。",
    );
    expect(markdown).toContain("| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | ログ上のGold増加 | ログ上のGold消費 | 平均購入回数 | 平均リロール回数 | 平均売却回数 | 平均主人公強化回数 |");
    expect(markdown).toContain("| P1 | 1.8 | 30.0% | 100 | 2.1 | 8.4 | 1.2 | 13.7 | 5.6 | 2.4 | 0.2 | 0 |");
    expect(markdown).toContain("| プレイヤー | 固定Prep収入 | レイド成功ボーナス | 売却収入 | 特殊経済収入 | 通常ショップ支出 | ボスショップ支出 | リロール支出 | 主人公/ボス強化支出 | その他支出 | 最終未使用Gold |");
    expect(markdown).toContain("| P1 | 18 | 0 | 2 | 1 | 8 | 4 | 2 | 3 | 0.7 | 8.4 |");
    expect(markdown).toContain("## ボス側戦闘ユニット指標");
    expect(markdown).toContain("## レイド側戦闘ユニット指標");
    expect(markdown).toContain("## 隠岐奈sub host内訳");
    expect(markdown).toContain("| Hostユニット | Host ID | 種別 | 戦闘登場回数 | 登場試合数 | 平均Lv | 戦闘ごとの平均ダメージ | 生存率 | 担当側戦闘勝率 |");
    expect(markdown).toContain("| 火焔猫燐 | rin | vanguard | 7 | 5 | 2.2 | 120.5 | 80.0% | 40.0% |");
    expect(markdown).toContain("## ラウンド別隠岐奈sub host内訳");
    expect(markdown).toContain("| R | Hostユニット | Host ID | 種別 | 戦闘登場回数 | 登場試合数 | 平均Lv | 戦闘ごとの平均ダメージ | 生存率 | 担当側戦闘勝率 |");
    expect(markdown).toContain("| 4 | 火焔猫燐 | rin | vanguard | 3 | 2 | 2.5 | 180 | 66.7% | 33.3% |");
    expect(markdown).toContain("## ラウンド別隠岐奈sub判断診断");
    expect(markdown).toContain("| R | 診断回数 | 裏推奨 | 候補なし | 表優先 | 現host維持 | 平均候補数 | 平均表相当値 | 平均best host gain | 平均currentPower | 平均futureValue | 平均transition | 平均protection | 平均best/表 | 最多best host |");
    expect(markdown).toContain("| 4 | 3 | 1 | 1 | 1 | 0 | 1.67 | 90 | 120 | 740 | 360 | 64 | 0 | 1.33 | 火焔猫燐 (rin) x2 |");
    expect(markdown).toContain("## ラウンド別盤面再編成診断");
    expect(markdown).toContain("| R | 診断回数 | 盤面満杯 | 試行候補 | 置換推奨 | 置換実行 | 将来候補保持 | 平均bench圧 | 平均置換score | P25 | P50 | P75 | 最多incoming | incoming理由 | 最多outgoing | outgoing理由 |");
    expect(markdown).toContain("| 6 | 4 | 3 | 2 | 1 | 0 | 1 | 75.0% | 24.5 | -42 | 24.5 | 91 | ヘカーティア・ラピスラズリ (hecatia) x2 | future_candidate x2 | ナズーリン (nazrin) x1 | protected_outgoing x1 |");
    expect(markdown).toContain("## ロール別盤面再編成診断");
    expect(markdown).toContain("| ロール | 診断回数 | 盤面満杯 | 試行候補 | 置換推奨 | 置換実行 | 将来候補保持 | 平均bench圧 | 平均置換score | P25 | P50 | P75 | 最多incoming | incoming理由 | 最多outgoing | outgoing理由 |");
    expect(markdown).toContain("| boss | 3 | 3 | 2 | 2 | 1 | 0 | 50.0% | 72 | 12 | 72 | 120 | パチュリー・ノーレッジ (patchouli) x2 | replacement_ready x2 | 姫虫百々世 (momoyo) x1 | weak_outgoing x1 |");
    expect(markdown).toContain("| raid | 1 | 1 | 1 | 0 | 0 | 1 | 87.5% | -42 | -42 | -42 | -42 | ヘカーティア・ラピスラズリ (hecatia) x1 | future_candidate x1 | ナズーリン (nazrin) x1 | protected_outgoing x1 |");
    expect(markdown).toContain("## ロール・ラウンド別盤面再編成診断");
    expect(markdown).toContain("| boss | 6 | 3 | 3 | 2 | 2 | 1 | 0 | 50.0% | 72 | パチュリー・ノーレッジ (patchouli) x2 | replacement_ready x2 | 姫虫百々世 (momoyo) x1 | weak_outgoing x1 |");
    expect(markdown).toContain("## プレイヤー別最終盤面価値");
    expect(markdown).toContain("| P2 | raid | 9 | 3 | 11.4 | 1 | 2 |");
    expect(markdown).toContain("担当側戦闘勝率");
    expect(markdown).toContain("基本スキル/戦闘");
    expect(markdown).toContain("ペアスキル/戦闘");
    expect(markdown).toContain("## ボス側戦闘テレメトリ");
    expect(markdown).toContain("## レイド側戦闘テレメトリ");
    expect(markdown).toContain("## 最終盤面ユニット指標");
    expect(markdown).toContain("## 上位ダメージユニット");
    expect(markdown).toContain("## 高コスト指標");
    expect(markdown).toContain("## ユニット別加重ダメージ効率");
    expect(markdown).toContain("Lv1主人公/ボス本体は投入コスト0のため効率を `-` 表示");
    expect(markdown).toContain("| boss | パチュリー・ノーレッジ | patchouli | mage | 2 | 12 | 9 | 1.75 | 1000 | 84 | 11.9 | usable |");
    expect(markdown).toContain("## 高コストショップ提示ユニット");
    expect(markdown).toContain("| パチュリー・ノーレッジ | patchouli | boss | bossShop | 4 | 100.0% | 41.7% | 44.4% |");
    expect(markdown).toContain("## ボス通常高コスト成熟診断");
    expect(markdown).toContain("| 純狐 | junko | vanguard | 4 | 12 | 6 | 4 | 33.3% | 8 | 5 | 55.6% | 2.5 | 4 | 40.0% | 0.0% | 2 | 2 | 22.2% | 3.5 | 4 | 50.0% | 0.0% |");
    expect(markdown).toContain("## ボス専用ラウンド別レベル分布");
    expect(markdown).toContain("| 1 | パチュリー・ノーレッジ | patchouli | mage | 6 | 5 | 1.5 | 1 | 1 | 2 | 16.7% | 0.0% |");
    expect(markdown).toContain("## 高コストラウンド別ショップ進行");
    expect(markdown).toContain("| 1 | boss | bossShop | パチュリー・ノーレッジ | patchouli | mage | 4 | 12 | 9 | 5 | 5 | 6 | 5 | 100.0% | 41.7% | 55.6% |");
    expect(markdown).toContain("## 射程別ダメージ効率比較");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 基礎火力発揮率 | 攻撃機会消化率 | 平均初回攻撃(ms) | 0ダメージ戦闘率 |");
    expect(markdown).toContain("| boss | 射程1 | 6 | 60 | 0.6 | 75.0% | 210 | 16.7% |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 130 | 1.3 | 80.0% | 150.5 | 0.0% |");
    expect(markdown).toContain("## 付録");
    expect(markdown).toContain("### 射程別行動診断");
    expect(markdown).toContain("割当先生存・未接敵終了のうち味方直前ブロック率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち道中チョーク率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち味方帯チョーク率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち敵受け口帯チョーク率");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 移動参加率 | 戦闘ごとの平均移動回数 | 平均初回移動(ms) | 移動後の平均初撃遅延(ms) | 再接敵移動率 | 戦闘ごとの平均再接敵移動回数 | 射程内到達率 | 未攻撃だが射程内到達 | 未攻撃かつ射程外終了 | 平均初期最短距離 | 平均最短到達距離 | 平均距離短縮量 | 0ダメージ内訳: 未攻撃 | 0ダメージ内訳: 移動のみ | 0ダメージ内訳: 攻撃したが命中なし | 追跡対象比較サンプル数 | 最適接敵対象ズレ率 | 平均余剰接敵歩数 |");
    expect(markdown).toContain("割当先生存・未接敵終了のうち割当口未使用率");
    expect(markdown).toContain("割当先生存・未接敵終了のうち経路詰まり併発率");
    expect(markdown).toContain("| boss | 射程1 | 6 | 83.3% | 1.8 | 80 | 130 | 33.3% | 0.5 | 66.7% | 16.7% | 0.0% | 4.5 | 1.5 | 3 | 16.7% | 16.7% | 0.0% | 4 | 50.0% | 1.75 |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 20.0% | 0.4 | 40 | 90 | 0.0% | 0 | 100.0% | 0.0% | 0.0% | 3 | 2 | 1 | 0.0% | 0.0% | 0.0% | 1 | 0.0% | 0 |");
    expect(markdown).toContain("### 射程別失敗分類");
    expect(markdown).toContain("- 遅すぎる単発: 攻撃1回のみ、かつ初撃が戦闘時間の60%以上を消費したケース");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 失敗分類: 未接敵 | 失敗分類: 接敵済み未攻撃 | 失敗分類: 遅すぎる単発 |");
    expect(markdown).toContain("| boss | 射程1 | 6 | 0.0% | 16.7% | 16.7% |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 0.0% | 0.0% | 20.0% |");
    expect(markdown).toContain("### 射程別初期配置診断");
    expect(markdown).toContain("| 陣営 | 射程帯 | 戦闘登場回数 | 前方味方あり率 | 平均前方味方数 | 平均初期行 | 平均初期列 | 前方味方あり時 0ダメ率 | 前方味方なし時 0ダメ率 | 前方味方あり時 未攻撃率 | 前方味方なし時 未攻撃率 |");
    expect(markdown).toContain("| boss | 射程1 | 6 | 50.0% | 0.5 | 3.5 | 0.5 | 33.3% | 0.0% | 33.3% | 0.0% |");
    expect(markdown).toContain("| raid | 射程2以上 | 5 | 20.0% | 0.2 | 4.2 | 1.2 | 0.0% | 0.0% | 0.0% | 0.0% |");
    expect(markdown).toContain("### レイド射程1コホート診断");
    expect(markdown).toContain("| コホート | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 戦闘ごとの平均攻撃回数 | 平均初回攻撃(ms) | 平均生存時間(ms) | 0ダメージ戦闘率 | 生存率 |");
    expect(markdown).toContain("| 特殊ユニット | 3 | 12.3 | 0.4 | 2800 | 3100 | 66.7% | 100.0% |");
    expect(markdown).toContain("| 通常ユニット | 7 | 128.4 | 2.2 | 520 | 2480 | 7.1% | 82.0% |");
    expect(markdown).toContain("### レイド特殊射程1ユニット診断");
    expect(markdown).toContain("| ユニット名 | ユニットID | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 戦闘ごとの平均攻撃回数 | 平均初回攻撃(ms) | 平均初回接敵(ms) | 未接敵終了率 | 接敵済み未攻撃率 | 同時追跡競合率 | 0ダメージ戦闘率 | 生存率 |");
    expect(markdown).toContain("| 袿姫 | keiki | 5 | 6.2 | 0.3 | 3200 | 2800 | 60.0% | 10.0% | 40.0% | 80.0% | 95.0% |");
    expect(markdown).toContain("| 霊夢 | reimu | 4 | 12.9 | 0.5 | 2970 | 2600 | 50.0% | 15.0% | 35.0% | 80.0% | 93.0% |");
    expect(markdown).toContain("| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |");
    expect(markdown).toContain("| 7 | 5 | 3 | 2 | 2 | 2 | 22.2% |");
    expect(markdown).toContain("| 純狐 | junko | vanguard | raid | shop | 4 | 4 | 3 | 33.3% |");
    expect(markdown).toContain("### チャンク実行状況");
    expect(markdown).toContain("## 失敗一覧");
    expect(markdown).toContain("| パチュリー・ノーレッジ | patchouli | mage | 12 | 9 | 1.4 | 4 | 11.1% | 0.0% | 1.1 | 0 | 420.5 | 5606.67 | 95.0% | 66.0% | 100.0% |");
    expect(markdown).toContain("| 火焔猫燐 | rin | rin | 18 | 9 | 2.2 | 7 | 44.4% | 11.1% | 0.6 | 0.2 | 120.5 | 2410 | 80.0% | 40.0% | 100.0% | 7 | 5 | 55.6% |");
    expect(markdown).toContain("| パチュリー・ノーレッジ | patchouli | mage | 90.0% | 4.2 | 3.5 | 180.4 | 145.6 | 770.2 | 5.0% |");
    expect(markdown).toContain("| 火焔猫燐 | rin | rin | 75.0% | 2.1 | 1.4 | 220.3 | 240.8 | 610.5 | 20.0% |");
    expect(markdown).toContain("| 姫虫百々世 | momoyo | vanguard | 30 | 9 | 3.33 | 100.0% | 4.2 | 7 | 60.0% | 20.0% |");
    expect(markdown).toContain("| 1 | 7 | 2 | sample failure |");
  });

  test("builds round detail markdown separately from the summary report", () => {
    const markdown = buildBotBalanceBaselineRoundDetailsJapaneseMarkdown(createSampleSummary());

    expect(markdown).toContain("# Bot Balance Baseline ラウンド詳細");
    expect(markdown).toContain("| 試合 | R | 終了時間(実プレイ秒) | 最終勝利 | ラウンド結果 | 目的進捗 | 達成率 | 推定フェーズHP火力指数 | レミリア集中 | レイド全滅 |");
    expect(markdown).toContain("| 0 | 1 | 5.7 | boss | failed | 600/600 | 100.0% | 14.04 | cell 2 (x=2, y=0), dmg=600, phase=600, hp=1200, 生存 | YES | 3 | 1 | 0 | フェーズHP削り切り | raid | P2:撃破 2->1 | 霧雨魔理沙 Lv1 dmg=600(phase 600) hp=0 撃破 | レミリア Lv1 dmg=240 hp=1200 生存 |");
  });
});
