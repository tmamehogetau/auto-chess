import { HERO_EXCLUSIVE_UNITS } from "../../../src/data/hero-exclusive-units";
import { HEROES } from "../../../src/data/heroes";
import { SCARLET_MANSION_UNITS } from "../../../src/data/scarlet-mansion-units";
import { TOUHOU_UNITS } from "../../../src/data/touhou-units";
import { calculateSpecialUnitUpgradeCost } from "../../../src/server/special-unit-level-config";
import { getUnitLevelCombatMultiplier } from "../../../src/server/unit-level-config";
import type { BossSpellBattleMetric } from "../../../src/server/combat/battle-simulator";
import { BOSS_CHARACTERS } from "../../../src/shared/boss-characters";
import { sharedBoardCoordinateToIndex } from "../../../src/shared/shared-board-config";
import { getMvpPhase1Boss } from "../../../src/shared/types";

export type BotOnlyReportMetadata = {
  mode: "real-play" | "fast-parity" | "custom";
  timeScale: number;
  timings: {
    readyAutoStartMs: number;
    prepDurationMs: number;
    battleDurationMs: number;
    settleDurationMs: number;
    eliminationDurationMs: number;
    selectionTimeoutMs: number;
  };
};

export type BotOnlyBaselinePlayerMetrics = {
  averagePlacement: number;
  firstPlaceRate: number;
  averageRemainingHp: number;
  averageRemainingLives: number;
  averageFinalGold: number;
  averageGoldEarned: number;
  averageGoldSpent: number;
  averagePurchaseCount: number;
  averageRefreshCount: number;
  averageSellCount: number;
  averageSpecialUnitUpgradeCount?: number;
};

export type BotOnlyBaselinePlayerEconomyBreakdown = {
  fixedPrepIncome: number;
  raidPhaseSuccessBonusIncome: number;
  sellIncome: number;
  specialEconomyIncome: number;
  normalShopSpend: number;
  bossShopSpend: number;
  refreshSpend: number;
  specialUnitUpgradeSpend: number;
  otherSpend: number;
  loggedGoldGain: number;
  loggedGoldSpent: number;
  finalUnusedGold: number;
};

export type BotOnlyBaselineBattleUnitMetrics = {
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchesPresent: number;
  averageunitLevel: number;
  maxUnitLevel?: number;
  level4ReachRate?: number;
  level7ReachRate?: number;
  averageDamagePerBattle: number;
  averageDamagePerMatch: number;
  activeBattleRate: number;
  averageAttackCountPerBattle: number;
  averageBasicSkillActivationsPerBattle?: number;
  averagePairSkillActivationsPerBattle?: number;
  averageHitCountPerBattle: number;
  averageDamageTakenPerBattle: number;
  averageFirstAttackMs: number | null;
  averageLifetimeMs: number;
  zeroDamageBattleRate: number;
  survivalRate: number;
  ownerWinRate: number;
  adoptionRate: number;
  subUnitBattleAppearances?: number;
  subUnitMatchesPresent?: number;
  subUnitAdoptionRate?: number;
  hostedSubUnitBattleAppearances?: number;
  hostedSubUnitMatchesPresent?: number;
  hostedSubUnitAdoptionRate?: number;
};

export type BotOnlyBaselineBattleEndReason =
  | "annihilation"
  | "mutual_annihilation"
  | "timeout_hp_lead"
  | "timeout_hp_tie"
  | "phase_hp_depleted"
  | "boss_defeated"
  | "forced"
  | "unexpected";

export type BotOnlyBaselineBattleMetrics = {
  totalBattles: number;
  averageBossSurvivorsAtBattleEnd: number;
  averageRaidSurvivorsAtBattleEnd: number;
  bothSidesSurvivedRate: number;
  bossWipedRate: number;
  raidWipedRate: number;
  endReasonCounts: Record<BotOnlyBaselineBattleEndReason, number>;
};

export type BotOnlyBaselineFinalBoardUnitMetrics = {
  unitId: string;
  unitType: string;
  unitName: string;
  totalCopies: number;
  matchesPresent: number;
  averageCopiesPerMatch: number;
  adoptionRate: number;
  averageFinalUnitLevel: number;
  maxFinalUnitLevel: number;
  finalLevel4Rate: number;
  finalLevel7Rate: number;
};

export type BotOnlyBaselineTopDamageUnit = {
  unitId: string;
  unitName: string;
  side: "boss" | "raid";
  totalDamage: number;
  appearances: number;
  averageDamagePerMatch: number;
};

export type BotOnlyBaselineRoundDamageEfficiencyMetric = {
  roundIndex: number;
  side: "boss" | "raid";
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchesPresent: number;
  averageUnitLevel: number;
  totalDamage: number;
  totalInvestmentCost: number;
  averageInvestmentCostPerBattle: number;
  damagePerInvestmentCost: number | null;
};

export type BotOnlyBaselineUnitDamageEfficiencyMetric = {
  side: "boss" | "raid";
  unitId: string;
  unitType: string;
  unitName: string;
  roundsObserved: number;
  battleAppearances: number;
  matchesPresent: number;
  averageUnitLevel: number;
  totalDamage: number;
  totalInvestmentCost: number;
  weightedDamagePerInvestmentCost: number | null;
  sampleQuality: "usable" | "low";
};

export type BotOnlyBaselineRoundSurvivalDiagnosticMetric = {
  roundIndex: number;
  battleSamples: number;
  averageBattleEndMs: number;
  phaseSuccessRate: number;
  phaseSuccessWithBossWipeRate: number;
  phaseFailureWithRaidWipeRate: number;
  bossWipedRate: number;
  raidWipedRate: number;
  bothSidesSurvivedRate: number;
  averageBossStartUnitCount: number;
  averageBossSurvivors: number;
  bossUnitSurvivalRate: number;
  averageBossFinalHp: number;
  averageBossEstimatedMaxHp: number;
  bossRemainingHpRate: number | null;
  averageRaidStartUnitCount: number;
  averageRaidSurvivors: number;
  raidUnitSurvivalRate: number;
  averageRaidFinalHp: number;
  averageRaidEstimatedMaxHp: number;
  raidRemainingHpRate: number | null;
};

export type BotOnlyBaselineRoundUnitSurvivalDiagnosticMetric = {
  roundIndex: number;
  side: "boss" | "raid";
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchesPresent: number;
  averageUnitLevel: number;
  survivalRate: number;
  averageFinalHp: number;
  averageEstimatedMaxHp: number;
  remainingHpRate: number | null;
  averageDamageTaken: number;
  averageLifetimeMs: number;
  averageDamagePerBattle: number;
  zeroDamageBattleRate: number;
};

export type BotOnlyBaselinePurchase = {
  roundIndex?: number;
  playerId: string;
  label: string;
  actionType: "buy_unit" | "buy_boss_unit";
  unitType: string;
  unitId?: string;
  unitName?: string;
  cost: number;
};

export type BotOnlyBaselineObservedShopOffer = {
  roundIndex?: number;
  playerId: string;
  label: string;
  role: "boss" | "raid";
  source: "shop" | "bossShop";
  unitId: string;
  unitName: string;
  unitType: string;
  cost: number;
  observationCount: number;
};

export type BotOnlyBaselineHighCostSummary = {
  offerObservationCount: number;
  offerMatchCount: number;
  purchaseCount: number;
  purchaseMatchCount: number;
  finalBoardCopies: number;
  finalBoardMatchCount: number;
  finalBoardAdoptionRate: number;
};

export type BotOnlyBaselineHighCostOfferMetric = {
  unitId: string;
  unitName: string;
  unitType: string;
  role: "boss" | "raid";
  source: "shop" | "bossShop";
  cost: number;
  observationCount: number;
  matchesPresent: number;
  offeredMatchRate: number;
};

export type BotOnlyBaselineShopOfferMetric = BotOnlyBaselineHighCostOfferMetric & {
  purchaseCount: number;
  purchaseMatchCount: number;
  purchaseRate: number;
  finalBoardCopies: number;
  finalBoardMatchCount: number;
  finalBoardAdoptionRate: number;
};

export type BotOnlyBaselineBossExclusiveRoundLevelMetric = {
  roundIndex: number;
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchesPresent: number;
  averageUnitLevel: number;
  p25UnitLevel: number;
  p50UnitLevel: number;
  p75UnitLevel: number;
  level4ReachRate: number;
  level7ReachRate: number;
  unitLevelSamples?: number[];
};

export type BotOnlyBaselineHighCostRoundMetric = {
  roundIndex: number;
  role: "boss" | "raid";
  source: "shop" | "bossShop";
  unitId: string;
  unitName: string;
  unitType: string;
  cost: number;
  offerObservationCount: number;
  offerMatchCount: number;
  purchaseCount: number;
  purchaseMatchCount: number;
  battleAppearances: number;
  battleMatchCount: number;
  offeredMatchRate: number;
  purchaseRate: number;
  battlePresenceRate: number;
};

export type BotOnlyBaselineRangeBand = "range_1" | "range_2_plus";

export type BotOnlyBaselineRangeDamageEfficiencyMetric = {
  side: "boss" | "raid";
  rangeBand: BotOnlyBaselineRangeBand;
  battleAppearances: number;
  totalDamage: number;
  totalTheoreticalBaseDamage: number;
  normalizedDamageEfficiency: number;
  totalAttackCount: number;
  totalTheoreticalAttackCount: number;
  attackOpportunityUtilization: number | null;
  averageDamagePerBattle: number;
  averageFirstAttackMs: number | null;
  firstAttackSamples: number;
  zeroDamageBattleRate: number;
};

export type BotOnlyBaselineRangeActionDiagnosticsMetric = {
  side: "boss" | "raid";
  rangeBand: BotOnlyBaselineRangeBand;
  battleAppearances: number;
  movedBattleRate: number;
  averageMoveCountPerBattle: number;
  averageFirstMoveMs: number | null;
  firstMoveSamples: number;
  averageMoveToFirstAttackMs: number | null;
  moveToFirstAttackSamples: number;
  repositionBattleRate: number;
  averageRepositionMoveCountPerBattle: number;
  reachedAttackRangeBattleRate: number;
  noAttackDespiteReachingRangeBattleRate: number;
  noAttackWithoutReachingRangeBattleRate: number;
  averageInitialNearestEnemyDistance: number | null;
  averageBestNearestEnemyDistance: number | null;
  averageDistanceClosed: number | null;
  noAttackBattleRate: number;
  movedNoAttackBattleRate: number;
  attackedNoHitBattleRate: number;
  lateSingleAttackBattleRate: number;
  moveTargetDiagnosticSampleCount: number;
  suboptimalMoveTargetRate: number | null;
  averageExcessApproachSteps: number | null;
  averageOutsideAttackRangeBeforeFirstAttackMs: number | null;
  averageInAttackRangeBeforeFirstAttackMs: number | null;
  averageAfterFirstAttackMs: number | null;
  averageFirstReachedAttackRangeAtMs: number | null;
  firstReachedAttackRangeSamples: number;
  averageLeftLateralMovesPerBattle: number;
  averageRightLateralMovesPerBattle: number;
  firstLateralMoveLeftRate: number | null;
  firstLateralMoveRightRate: number | null;
  firstLateralMoveSamples: number;
  sharedPursuitMoveSampleCount: number;
  contestedPursuitMoveRate: number | null;
  plannedApproachGroupMoveSampleCount: number;
  averagePlannedApproachGroupCompetitorCount: number | null;
  averagePlannedApproachGroupAssignedCount: number | null;
  oversubscribedPlannedApproachGroupRate: number | null;
  plannedApproachBattleCount: number;
  plannedApproachMoveSampleCount: number;
  plannedApproachStillOpenRate: number | null;
  usedPlannedApproachRate: number | null;
  plannedApproachPathBlockedRate: number | null;
  plannedApproachFirstAttackRate: number | null;
  plannedApproachMatchedFirstAttackTargetRate: number | null;
  plannedApproachReachedRangeWithoutAttackRate: number | null;
  plannedApproachNoReachNoAttackRate: number | null;
  plannedApproachNoAttackTargetDiedBeforeBattleEndRate: number | null;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveRate: number | null;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: number | null;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate: number | null;
  plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate: number | null;
};

export type BotOnlyBaselineRangeFormationDiagnosticsMetric = {
  side: "boss" | "raid";
  rangeBand: BotOnlyBaselineRangeBand;
  battleAppearances: number;
  frontAllyBlockedBattleRate: number;
  averageFrontAllyCount: number | null;
  averageInitialRow: number | null;
  averageInitialColumn: number | null;
  zeroDamageBattleRateWithFrontAlly: number | null;
  zeroDamageBattleRateWithoutFrontAlly: number | null;
  noAttackBattleRateWithFrontAlly: number | null;
  noAttackBattleRateWithoutFrontAlly: number | null;
};

export type BotOnlyBaselineRaidMeleeCohort = "special" | "standard";

export type BotOnlyBaselineRaidMeleeCohortMetric = {
  cohort: BotOnlyBaselineRaidMeleeCohort;
  battleAppearances: number;
  averageDamagePerBattle: number;
  averageAttackCountPerBattle: number;
  averageFirstAttackMs: number | null;
  averageLifetimeMs: number;
  zeroDamageBattleRate: number;
  survivalRate: number;
};

export type BotOnlyBaselineRaidSpecialMeleeUnitDiagnostic = {
  unitId: string;
  unitName: string;
  battleAppearances: number;
  averageDamagePerBattle: number;
  averageAttackCountPerBattle: number;
  averageFirstAttackMs: number | null;
  firstAttackSamples: number;
  averageFirstReachedAttackRangeAtMs: number | null;
  firstReachedAttackRangeSamples: number;
  noAttackWithoutReachingRangeBattleRate: number;
  noAttackDespiteReachingRangeBattleRate: number;
  contestedPursuitMoveRate: number | null;
  sharedPursuitMoveSampleCount: number;
  zeroDamageBattleRate: number;
  survivalRate: number;
};

export type BotOnlyBaselineFinalBoardUnit = {
  cell: number;
  unitName: string;
  unitType: string;
  unitId: string;
  unitLevel: number;
  subUnitName: string;
};

export type BotOnlyBaselineFinalPlayer = {
  playerId: string;
  label: string;
  role: string;
  hp: number;
  gold: number;
  remainingLives: number;
  eliminated: boolean;
  rank: number;
  selectedHeroId: string;
  selectedBossId: string;
  totalGoldEarned: number;
  totalGoldSpent: number;
  economyBreakdown?: BotOnlyBaselinePlayerEconomyBreakdown;
  purchaseCount: number;
  refreshCount: number;
  sellCount: number;
  specialUnitUpgradeCount?: number;
  boardUnits: BotOnlyBaselineFinalBoardUnit[];
};

export type BotOnlyBaselineBattleDamageContribution = {
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  side: "boss" | "raid";
  totalDamage: number;
};

export type BotOnlyBaselineBattleUnitOutcome = {
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  unitType?: string;
  side: "boss" | "raid";
  totalDamage: number;
  phaseContributionDamage: number;
  finalHp: number;
  alive: boolean;
  unitLevel: number;
  subUnitName: string;
  attachedSubUnitId?: string;
  attachedSubUnitName?: string;
  attachedSubUnitType?: string;
  isSpecialUnit: boolean;
  attackCount?: number;
  basicSkillActivationCount?: number;
  pairSkillActivationCount?: number;
  hitCount?: number;
  damageTaken?: number;
  moveCount?: number;
  firstMoveAtMs?: number | null;
  firstAttackAtMs?: number | null;
  repositionMoveCount?: number;
  lifetimeMs?: number;
  battleDurationMs?: number;
  initialNearestEnemyDistance?: number | null;
  bestNearestEnemyDistance?: number | null;
  moveTargetDiagnosticSampleCount?: number;
  suboptimalMoveTargetCount?: number;
  totalExcessApproachSteps?: number;
  outsideAttackRangeBeforeFirstAttackMs?: number;
  inAttackRangeBeforeFirstAttackMs?: number;
  afterFirstAttackMs?: number;
  firstReachedAttackRangeAtMs?: number | null;
  initialRow?: number | null;
  initialColumn?: number | null;
  sameColumnFrontAllyCount?: number;
  lateralLeftMoveCount?: number;
  lateralRightMoveCount?: number;
  firstLateralMoveDirection?: "left" | "right" | null;
  sharedPursuitMoveSampleCount?: number;
  contestedPursuitMoveSampleCount?: number;
  plannedApproachGroupMoveSampleCount?: number;
  totalPlannedApproachGroupCompetitorCount?: number;
  totalPlannedApproachGroupAssignedCount?: number;
  oversubscribedPlannedApproachGroupMoveCount?: number;
  plannedApproachMoveSampleCount?: number;
  plannedApproachStillOpenMoveCount?: number;
  usedPlannedApproachMoveCount?: number;
  plannedApproachPathBlockedMoveCount?: number;
  plannedApproachWithFirstAttackCount?: number;
  plannedApproachMatchedFirstAttackTargetCount?: number;
  plannedApproachReachedRangeWithoutAttackCount?: number;
  plannedApproachNoReachNoAttackCount?: number;
  plannedApproachNoAttackTargetDiedBeforeBattleEndCount?: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveCount?: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount?: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount?: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount?: number;
};

export type BotOnlyBaselineBattleSummary = {
  leftPlayerId: string;
  rightPlayerId: string;
  winner: "left" | "right" | "draw";
  battleEndReason?: BotOnlyBaselineBattleEndReason;
  bossSurvivors?: number;
  raidSurvivors?: number;
  unitDamageBreakdown: BotOnlyBaselineBattleDamageContribution[];
  unitOutcomes: BotOnlyBaselineBattleUnitOutcome[];
  bossSpellMetrics?: BossSpellBattleMetric[];
};

export type BotOnlyBaselineRoundUnitDetail = {
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  unitType?: string;
  side: "boss" | "raid";
  cell?: number | null;
  x?: number | null;
  y?: number | null;
  totalDamage: number;
  phaseContributionDamage: number;
  damageTaken?: number;
  finalHp: number;
  alive: boolean;
  unitLevel: number;
};

export type BotOnlyBaselineRoundPlayerConsequence = {
  playerId: string;
  label: string;
  role: string;
  battleStartUnitCount: number;
  playerWipedOut: boolean;
  remainingLivesBefore: number;
  remainingLivesAfter: number;
  eliminatedAfter: boolean;
};

export type BotOnlyBaselineRoundBattleDetail = {
  battleIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  winner: "left" | "right" | "draw";
  battleDurationMs?: number;
  battleEndReason?: BotOnlyBaselineBattleEndReason;
  bossSurvivors?: number;
  raidSurvivors?: number;
  leftDamageDealt: number;
  rightDamageDealt: number;
  unitOutcomes: BotOnlyBaselineBattleUnitOutcome[];
  bossSpellMetrics?: BossSpellBattleMetric[];
};

export type BotOnlyBaselineRoundSummary = {
  roundIndex: number;
  phase: string;
  durationMs: number;
  phaseHpTarget: number;
  phaseDamageDealt: number;
  phaseResult: "pending" | "success" | "failed";
  phaseCompletionRate: number;
  playerConsequences: BotOnlyBaselineRoundPlayerConsequence[];
  battles: BotOnlyBaselineRoundBattleDetail[];
  eliminations: string[];
};

export type BotOnlyBaselineMatchRoundDetail = {
  matchIndex: number;
  matchWinnerRole: "boss" | "raid";
  totalRounds: number;
  roundIndex: number;
  battleEndTimeMs: number;
  phaseHpTarget: number;
  phaseDamageDealt: number;
  phaseCompletionRate: number;
  phaseHpPowerIndex?: number | null;
  phaseResult: "pending" | "success" | "failed";
  allRaidPlayersWipedOut: boolean;
  raidPlayersWipedOut: number;
  raidPlayersEliminatedAfterRound: number;
  bossSurvivors: number;
  raidSurvivors: number;
  bossTotalDamage: number;
  raidTotalDamage: number;
  raidPhaseContributionDamage: number;
  battleEndReasons: BotOnlyBaselineBattleEndReason[];
  battleWinnerRoles: Array<"boss" | "raid" | "draw">;
  bossSpellMetrics?: BossSpellBattleMetric[];
  raidPlayerConsequences: BotOnlyBaselineRoundPlayerConsequence[];
  bossBodyFocus?: BotOnlyBaselineBossBodyFocusDetail | null;
  topBossUnits: BotOnlyBaselineRoundUnitDetail[];
  topBossDamageTakenUnits?: BotOnlyBaselineRoundUnitDetail[];
  topRaidUnits: BotOnlyBaselineRoundUnitDetail[];
};

export type BotOnlyBaselineBossBodyFocusDetail = {
  unitId: string;
  unitName: string;
  cell: number | null;
  x: number | null;
  y: number | null;
  unitLevel: number | null;
  damageTaken: number;
  directPhaseDamage: number;
  firstDamageAtMs: number | null;
  defeated: boolean;
  finalHp: number | null;
};

export type BotOnlyBaselineMatchSummary = {
  metadata?: BotOnlyReportMetadata;
  totalRounds: number;
  bossPlayerId: string;
  ranking: string[];
  playerLabels: Record<string, string>;
  finalPlayers: BotOnlyBaselineFinalPlayer[];
  battles: BotOnlyBaselineBattleSummary[];
  rounds?: BotOnlyBaselineRoundSummary[];
  purchases?: BotOnlyBaselinePurchase[];
  observedShopOffers?: BotOnlyBaselineObservedShopOffer[];
  okinaHeroSubDecisionSnapshots?: BotOnlyBaselineOkinaHeroSubDecisionSnapshot[];
  boardRefitDecisionSnapshots?: BotOnlyBaselineBoardRefitDecisionSnapshot[];
};

export type BotOnlyBaselineAggregateReport = {
  metadata?: BotOnlyReportMetadata;
  requestedMatchCount: number;
  completedMatches: number;
  abortedMatches: number;
  bossWins: number;
  raidWins: number;
  bossWinRate: number;
  raidWinRate: number;
  averageRounds: number;
  minRounds: number;
  maxRounds: number;
  averageRemainingRaidPlayers: number;
  battleMetrics: BotOnlyBaselineBattleMetrics;
  roundHistogram: Record<string, number>;
  playerMetrics: Record<string, BotOnlyBaselinePlayerMetrics>;
  heroTeamMetrics?: BotOnlyBaselineHeroTeamMetric[];
  heroCompositionMetrics?: BotOnlyBaselineHeroCompositionMetric[];
  playerEconomyBreakdowns?: Record<string, BotOnlyBaselinePlayerEconomyBreakdown>;
  bossBattleUnitMetrics: BotOnlyBaselineBattleUnitMetrics[];
  raidBattleUnitMetrics: BotOnlyBaselineBattleUnitMetrics[];
  finalBoardUnitMetrics: BotOnlyBaselineFinalBoardUnitMetrics[];
  topDamageUnits: BotOnlyBaselineTopDamageUnit[];
  highCostSummary?: BotOnlyBaselineHighCostSummary;
  highCostOfferMetrics?: BotOnlyBaselineHighCostOfferMetric[];
  shopOfferMetrics?: BotOnlyBaselineShopOfferMetric[];
  bossExclusiveRoundLevelMetrics?: BotOnlyBaselineBossExclusiveRoundLevelMetric[];
  highCostRoundMetrics?: BotOnlyBaselineHighCostRoundMetric[];
  roundDamageEfficiencyMetrics?: BotOnlyBaselineRoundDamageEfficiencyMetric[];
  unitDamageEfficiencyMetrics?: BotOnlyBaselineUnitDamageEfficiencyMetric[];
  okinaSubHostMetrics?: BotOnlyBaselineOkinaSubHostMetric[];
  okinaSubHostRoundMetrics?: BotOnlyBaselineOkinaSubHostRoundMetric[];
  okinaHeroSubDecisionRoundMetrics?: BotOnlyBaselineOkinaHeroSubDecisionRoundMetric[];
  boardRefitDecisionRoundMetrics?: BotOnlyBaselineBoardRefitDecisionRoundMetric[];
  boardRefitDecisionRoleMetrics?: BotOnlyBaselineBoardRefitDecisionRoleMetric[];
  boardRefitDecisionRoleRoundMetrics?: BotOnlyBaselineBoardRefitDecisionRoleRoundMetric[];
  finalPlayerBoardMetrics?: BotOnlyBaselineFinalPlayerBoardMetric[];
  roundSurvivalDiagnostics?: BotOnlyBaselineRoundSurvivalDiagnosticMetric[];
  roundUnitSurvivalDiagnostics?: BotOnlyBaselineRoundUnitSurvivalDiagnosticMetric[];
  rangeDamageEfficiencyMetrics: BotOnlyBaselineRangeDamageEfficiencyMetric[];
  rangeActionDiagnosticsMetrics: BotOnlyBaselineRangeActionDiagnosticsMetric[];
  rangeFormationDiagnosticsMetrics: BotOnlyBaselineRangeFormationDiagnosticsMetric[];
  raidMeleeCohortMetrics?: BotOnlyBaselineRaidMeleeCohortMetric[];
  raidSpecialMeleeUnitDiagnostics?: BotOnlyBaselineRaidSpecialMeleeUnitDiagnostic[];
  roundDetails?: BotOnlyBaselineMatchRoundDetail[];
};

export type BotOnlyBaselineOkinaSubHostMetric = {
  hostUnitId: string;
  hostUnitType: string;
  hostUnitName: string;
  battleAppearances: number;
  matchesPresent: number;
  averageHostLevel: number;
  averageDamagePerBattle: number;
  averageDamageTakenPerBattle: number;
  averageLifetimeMs: number;
  survivalRate: number;
  ownerWinRate: number;
};

export type BotOnlyBaselineOkinaSubHostRoundMetric =
  BotOnlyBaselineOkinaSubHostMetric & {
    roundIndex: number;
  };

export type BotOnlyBaselineOkinaHeroSubDecisionReason =
  | "attach_best_host"
  | "reattach_stronger_host"
  | "front_value_preferred"
  | "current_host_margin_preferred"
  | "current_host_only"
  | "no_candidate";

export type BotOnlyBaselineOkinaHeroSubDecisionSnapshot = {
  roundIndex: number;
  playerId: string;
  label: string;
  specialUnitStage: number;
  candidateCount: number;
  bestHostUnitId: string | null;
  bestHostUnitType: string | null;
  bestHostUnitName: string | null;
  bestHostLevel: number | null;
  bestHostCurrentPowerScore?: number | null;
  bestHostFutureValueScore?: number | null;
  bestHostTransitionReadinessScore?: number | null;
  bestHostProtectionScore?: number | null;
  bestHostGain: number | null;
  frontEquivalentValue: number;
  bestToFrontRatio: number | null;
  bestToCurrentRatio: number | null;
  decision: "attach" | "reattach" | "keep_front" | "keep_current";
  reason: BotOnlyBaselineOkinaHeroSubDecisionReason;
};

export type BotOnlyBaselineOkinaHeroSubDecisionRoundMetric = {
  roundIndex: number;
  samples: number;
  actionRecommendedSamples: number;
  noCandidateSamples: number;
  frontValuePreferredSamples: number;
  currentHostKeptSamples: number;
  averageCandidateCount: number;
  averageFrontEquivalentValue: number;
  averageBestHostGain: number | null;
  averageBestHostCurrentPowerScore: number | null;
  averageBestHostFutureValueScore: number | null;
  averageBestHostTransitionReadinessScore: number | null;
  averageBestHostProtectionScore: number | null;
  averageBestToFrontRatio: number | null;
  mostFrequentBestHostUnitId: string | null;
  mostFrequentBestHostUnitName: string | null;
  mostFrequentBestHostSamples: number;
};

export type BotOnlyBaselineBoardRefitDecisionSnapshot = {
  roundIndex: number;
  playerId: string;
  label: string;
  role: "boss" | "raid";
  boardAtCapacity: boolean;
  boardUnitCount: number;
  benchUnitCount: number;
  benchPressure: number;
  candidateCount: number;
  outgoingCandidateCount: number;
  decision: "replace" | "hold" | "no_candidate";
  reason: string;
  committed?: boolean;
  replacementScore: number | null;
  incomingUnitId: string | null;
  incomingUnitType: string | null;
  incomingUnitCost: number | null;
  incomingUnitLevel: number | null;
  incomingReason: string | null;
  incomingCurrentPowerScore: number | null;
  incomingFutureValueScore: number | null;
  incomingTransitionReadinessScore: number | null;
  incomingProtectionScore: number | null;
  outgoingUnitId: string | null;
  outgoingUnitType: string | null;
  outgoingUnitCost: number | null;
  outgoingUnitLevel: number | null;
  outgoingCell: number | null;
  outgoingReason: string | null;
  outgoingCurrentPowerScore: number | null;
  outgoingFutureValueScore: number | null;
  outgoingTransitionReadinessScore: number | null;
  outgoingProtectionScore: number | null;
};

export type BotOnlyBaselineBoardRefitDecisionRoundMetric = {
  roundIndex: number;
  samples: number;
  boardFullSamples: number;
  attemptSamples: number;
  recommendedReplacementSamples: number;
  committedSamples: number;
  futureCandidateKeptCount: number;
  averageBenchPressure: number;
  averageReplacementScore: number | null;
  p25ReplacementScore: number | null;
  p50ReplacementScore: number | null;
  p75ReplacementScore: number | null;
  mostFrequentIncomingUnitId: string | null;
  mostFrequentIncomingUnitName: string | null;
  mostFrequentIncomingSamples: number;
  mostFrequentOutgoingUnitId: string | null;
  mostFrequentOutgoingUnitName: string | null;
  mostFrequentOutgoingSamples: number;
};

export type BotOnlyBaselineBoardRefitDecisionRoleMetric =
  Omit<BotOnlyBaselineBoardRefitDecisionRoundMetric, "roundIndex"> & {
    role: "boss" | "raid";
  };

export type BotOnlyBaselineBoardRefitDecisionRoleRoundMetric =
  BotOnlyBaselineBoardRefitDecisionRoundMetric & {
    role: "boss" | "raid";
  };

export type BotOnlyBaselineFinalPlayerBoardMetric = {
  label: string;
  role: string;
  matchesPresent: number;
  averageDeployedUnitCount: number;
  averageDeployedAssetValue: number;
  averageSpecialUnitCount: number;
  averageStandardUnitCount: number;
};

export type BotOnlyBaselineHeroTeamMetric = {
  heroId: string;
  heroName: string;
  matchesPresent: number;
  raidTeamWins: number;
  raidTeamWinRate: number;
  firstPlaceRate: number;
  averagePlacement: number;
  averageRemainingLives: number;
  averageFinalGold: number;
  averageGoldEarned: number;
  averageGoldSpent: number;
  averageSpecialUnitUpgradeCount: number;
};

export type BotOnlyBaselineHeroCompositionMetric = {
  compositionKey: string;
  heroIds: string[];
  heroNames: string[];
  matchesPresent: number;
  raidWins: number;
  raidWinRate: number;
  averageRounds: number;
};

const HIGH_COST_THRESHOLD = 4;
const ESTIMATED_RAID_PREP_BASE_INCOME = 5;
const ESTIMATED_BOSS_PREP_BASE_INCOME = 9;
const ESTIMATED_RAID_PHASE_SUCCESS_BONUS = 2;
const LATE_SINGLE_ATTACK_THRESHOLD_RATIO = 0.6;
const BOT_ONLY_BASELINE_BATTLE_END_REASONS: BotOnlyBaselineBattleEndReason[] = [
  "annihilation",
  "mutual_annihilation",
  "timeout_hp_lead",
  "timeout_hp_tie",
  "phase_hp_depleted",
  "boss_defeated",
  "forced",
  "unexpected",
];
const UNIT_COST_BY_UNIT_ID = new Map(
  [
    ...TOUHOU_UNITS.map((unit) => [unit.unitId, unit.cost] as const),
    ...SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, unit.cost] as const),
    ...HERO_EXCLUSIVE_UNITS.flatMap((unit) => [
      [unit.id, unit.cost] as const,
      [unit.unitId, unit.cost] as const,
    ]),
  ],
);
const UNIT_DISPLAY_NAME_BY_ID = new Map<string, string>([
  ...TOUHOU_UNITS.map((unit) => [unit.unitId, unit.displayName] as const),
  ...HEROES.map((hero) => [hero.id, hero.name] as const),
  ...HERO_EXCLUSIVE_UNITS.flatMap((unit) => [
    [unit.id, unit.displayName] as const,
    [unit.unitId, unit.displayName] as const,
  ]),
  ...SCARLET_MANSION_UNITS.flatMap((unit) => [
    [unit.id, unit.displayName] as const,
    [unit.unitId, unit.displayName] as const,
  ]),
  ...BOSS_CHARACTERS.map((boss) => [boss.id, boss.displayName] as const),
]);
const SPECIAL_BATTLE_UNIT_IDS = new Set<string>([
  ...HEROES.map((hero) => hero.id),
  ...HERO_EXCLUSIVE_UNITS.flatMap((unit) => [unit.id, unit.unitId]),
  ...BOSS_CHARACTERS.map((boss) => boss.id),
]);
const CHARACTER_BODY_UNIT_IDS = new Set<string>([
  ...HEROES.map((hero) => hero.id),
  ...BOSS_CHARACTERS.map((boss) => boss.id),
]);
const BOSS_EXCLUSIVE_UNIT_IDS = new Set<string>([
  ...SCARLET_MANSION_UNITS.flatMap((unit) => [unit.id, unit.unitId]),
]);

function createEmptyPlayerEconomyBreakdown(): BotOnlyBaselinePlayerEconomyBreakdown {
  return {
    fixedPrepIncome: 0,
    raidPhaseSuccessBonusIncome: 0,
    sellIncome: 0,
    specialEconomyIncome: 0,
    normalShopSpend: 0,
    bossShopSpend: 0,
    refreshSpend: 0,
    specialUnitUpgradeSpend: 0,
    otherSpend: 0,
    loggedGoldGain: 0,
    loggedGoldSpent: 0,
    finalUnusedGold: 0,
  };
}

function addPlayerEconomyBreakdown(
  target: BotOnlyBaselinePlayerEconomyBreakdown,
  source: BotOnlyBaselinePlayerEconomyBreakdown,
): void {
  target.fixedPrepIncome += source.fixedPrepIncome;
  target.raidPhaseSuccessBonusIncome += source.raidPhaseSuccessBonusIncome;
  target.sellIncome += source.sellIncome;
  target.specialEconomyIncome += source.specialEconomyIncome;
  target.normalShopSpend += source.normalShopSpend;
  target.bossShopSpend += source.bossShopSpend;
  target.refreshSpend += source.refreshSpend;
  target.specialUnitUpgradeSpend += source.specialUnitUpgradeSpend;
  target.otherSpend += source.otherSpend;
  target.loggedGoldGain += source.loggedGoldGain;
  target.loggedGoldSpent += source.loggedGoldSpent;
  target.finalUnusedGold += source.finalUnusedGold;
}

function dividePlayerEconomyBreakdown(
  source: BotOnlyBaselinePlayerEconomyBreakdown,
  divisor: number,
): BotOnlyBaselinePlayerEconomyBreakdown {
  if (divisor <= 0) {
    return createEmptyPlayerEconomyBreakdown();
  }

  return {
    fixedPrepIncome: source.fixedPrepIncome / divisor,
    raidPhaseSuccessBonusIncome: source.raidPhaseSuccessBonusIncome / divisor,
    sellIncome: source.sellIncome / divisor,
    specialEconomyIncome: source.specialEconomyIncome / divisor,
    normalShopSpend: source.normalShopSpend / divisor,
    bossShopSpend: source.bossShopSpend / divisor,
    refreshSpend: source.refreshSpend / divisor,
    specialUnitUpgradeSpend: source.specialUnitUpgradeSpend / divisor,
    otherSpend: source.otherSpend / divisor,
    loggedGoldGain: source.loggedGoldGain / divisor,
    loggedGoldSpent: source.loggedGoldSpent / divisor,
    finalUnusedGold: source.finalUnusedGold / divisor,
  };
}

function estimateFixedPrepIncomeForPlayer(
  report: BotOnlyBaselineMatchSummary,
  player: BotOnlyBaselineFinalPlayer,
): number {
  const baseIncome = player.role === "boss"
    ? ESTIMATED_BOSS_PREP_BASE_INCOME
    : ESTIMATED_RAID_PREP_BASE_INCOME;
  const roundsBeforeNextPrep = Math.max(0, report.totalRounds - 1);

  if (!Array.isArray(report.rounds) || report.rounds.length === 0) {
    return baseIncome * roundsBeforeNextPrep;
  }

  let eligiblePrepCount = 0;
  for (const round of report.rounds) {
    if (round.roundIndex >= report.totalRounds) {
      continue;
    }
    if (player.role === "boss") {
      eligiblePrepCount += 1;
      continue;
    }

    const consequence = round.playerConsequences.find((entry) => entry.playerId === player.playerId);
    if (!consequence || consequence.eliminatedAfter !== true) {
      eligiblePrepCount += 1;
    }
  }

  return baseIncome * eligiblePrepCount;
}

function estimateRaidPhaseSuccessBonusIncomeForPlayer(
  report: BotOnlyBaselineMatchSummary,
  player: BotOnlyBaselineFinalPlayer,
): number {
  if (player.role === "boss" || !Array.isArray(report.rounds)) {
    return 0;
  }

  let successBonusCount = 0;
  for (const round of report.rounds) {
    if (round.roundIndex >= 12 || round.phaseResult !== "success") {
      continue;
    }
    const consequence = round.playerConsequences.find((entry) => entry.playerId === player.playerId);
    if (!consequence || consequence.eliminatedAfter !== true) {
      successBonusCount += 1;
    }
  }

  return ESTIMATED_RAID_PHASE_SUCCESS_BONUS * successBonusCount;
}

function buildPlayerEconomyBreakdownForMatch(
  report: BotOnlyBaselineMatchSummary,
  player: BotOnlyBaselineFinalPlayer,
): BotOnlyBaselinePlayerEconomyBreakdown {
  const base = player.economyBreakdown ?? createEmptyPlayerEconomyBreakdown();
  const hasDirectEconomyBreakdown = player.economyBreakdown !== undefined;
  return {
    ...base,
    fixedPrepIncome: hasDirectEconomyBreakdown
      ? base.fixedPrepIncome
      : estimateFixedPrepIncomeForPlayer(report, player),
    raidPhaseSuccessBonusIncome: hasDirectEconomyBreakdown
      ? base.raidPhaseSuccessBonusIncome
      : estimateRaidPhaseSuccessBonusIncomeForPlayer(report, player),
    loggedGoldGain: base.loggedGoldGain || player.totalGoldEarned || 0,
    loggedGoldSpent: base.loggedGoldSpent || player.totalGoldSpent || 0,
    finalUnusedGold: player.gold ?? base.finalUnusedGold,
  };
}

type UnitCombatProfile = {
  attack: number;
  attackSpeed: number;
  range: number;
  usesStarMultiplier: boolean;
};

const GENERIC_UNIT_COMBAT_PROFILES = [
  { key: "vanguard", attack: 4, attackSpeed: 0.5, range: 1, usesStarMultiplier: true },
  { key: "ranger", attack: 5, attackSpeed: 0.8, range: 3, usesStarMultiplier: true },
  { key: "mage", attack: 6, attackSpeed: 0.6, range: 2, usesStarMultiplier: true },
  { key: "assassin", attack: 5, attackSpeed: 1.0, range: 1, usesStarMultiplier: true },
] as const;

const UNIT_COMBAT_PROFILE_BY_ID = new Map<string, UnitCombatProfile>([
  ...TOUHOU_UNITS.map((unit) => [unit.unitId, {
    attack: unit.attack,
    attackSpeed: unit.attackSpeed,
    range: unit.range,
    usesStarMultiplier: true,
  }] as const),
  ...HEROES.map((hero) => [hero.id, {
    attack: hero.attack,
    attackSpeed: hero.attackSpeed,
    range: hero.range,
    usesStarMultiplier: false,
  }] as const),
  ...SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, {
    attack: unit.attack,
    attackSpeed: unit.attackSpeed,
    range: unit.range,
    usesStarMultiplier: false,
  }] as const),
  ["remilia", {
    attack: getMvpPhase1Boss().attack,
    attackSpeed: getMvpPhase1Boss().attackSpeed,
    range: getMvpPhase1Boss().range,
    usesStarMultiplier: false,
  }],
  ...GENERIC_UNIT_COMBAT_PROFILES.map((profile) => [profile.key, {
    attack: profile.attack,
    attackSpeed: profile.attackSpeed,
    range: profile.range,
    usesStarMultiplier: profile.usesStarMultiplier,
  }] as const),
]);

const UNIT_COMBAT_PROFILE_BY_TYPE = new Map<string, UnitCombatProfile>([
  ...TOUHOU_UNITS.map((unit) => [unit.unitId, {
    attack: unit.attack,
    attackSpeed: unit.attackSpeed,
    range: unit.range,
    usesStarMultiplier: true,
  }] as const),
  ...HEROES.map((hero) => [hero.id, {
    attack: hero.attack,
    attackSpeed: hero.attackSpeed,
    range: hero.range,
    usesStarMultiplier: false,
  }] as const),
  ...SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, {
    attack: unit.attack,
    attackSpeed: unit.attackSpeed,
    range: unit.range,
    usesStarMultiplier: false,
  }] as const),
  ["remilia", {
    attack: getMvpPhase1Boss().attack,
    attackSpeed: getMvpPhase1Boss().attackSpeed,
    range: getMvpPhase1Boss().range,
    usesStarMultiplier: false,
  }],
  ...GENERIC_UNIT_COMBAT_PROFILES.map((profile) => [profile.key, {
    attack: profile.attack,
    attackSpeed: profile.attackSpeed,
    range: profile.range,
    usesStarMultiplier: profile.usesStarMultiplier,
  }] as const),
]);

type BattleUnitAggregateAccumulator = {
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchesPresent: number;
  totalunitLevel: number;
  maxUnitLevel: number;
  level4Matches: number;
  level7Matches: number;
  totalDamage: number;
  activeBattles: number;
  totalAttackCount: number;
  totalBasicSkillActivations: number;
  totalPairSkillActivations: number;
  totalHitCount: number;
  totalDamageTaken: number;
  totalFirstAttackMs: number;
  firstAttackSamples: number;
  totalLifetimeMs: number;
  zeroDamageBattles: number;
  survivedBattles: number;
  ownerWins: number;
  subUnitBattleAppearances?: number;
  subUnitMatchesPresent?: number;
  hostedSubUnitBattleAppearances?: number;
  hostedSubUnitMatchesPresent?: number;
};

type OkinaSubHostAccumulator = {
  hostUnitId: string;
  hostUnitType: string;
  hostUnitName: string;
  battleAppearances: number;
  matchesPresent: number;
  totalHostLevel: number;
  totalDamage: number;
  totalDamageTaken: number;
  totalLifetimeMs: number;
  survivedBattles: number;
  ownerWins: number;
};

type OkinaSubHostRoundAccumulator = OkinaSubHostAccumulator & {
  roundIndex: number;
};

type OkinaHeroSubDecisionRoundAccumulator = {
  roundIndex: number;
  samples: number;
  actionRecommendedSamples: number;
  noCandidateSamples: number;
  frontValuePreferredSamples: number;
  currentHostKeptSamples: number;
  totalCandidateCount: number;
  totalFrontEquivalentValue: number;
  totalBestHostGain: number;
  bestHostGainSamples: number;
  totalBestHostCurrentPowerScore: number;
  totalBestHostFutureValueScore: number;
  totalBestHostTransitionReadinessScore: number;
  totalBestHostProtectionScore: number;
  bestHostOptimizationSamples: number;
  totalBestToFrontRatio: number;
  bestToFrontRatioSamples: number;
  bestHostSamplesById: Map<string, {
    unitId: string;
    unitName: string;
    samples: number;
  }>;
};

type BoardRefitDecisionRoundAccumulator = {
  roundIndex: number;
  samples: number;
  boardFullSamples: number;
  attemptSamples: number;
  recommendedReplacementSamples: number;
  committedSamples: number;
  futureCandidateKeptCount: number;
  totalBenchPressure: number;
  replacementScores: number[];
  incomingSamplesById: Map<string, {
    unitId: string;
    unitName: string;
    samples: number;
  }>;
  outgoingSamplesById: Map<string, {
    unitId: string;
    unitName: string;
    samples: number;
  }>;
};

type BoardRefitDecisionRoleAccumulator =
  Omit<BoardRefitDecisionRoundAccumulator, "roundIndex"> & {
    role: "boss" | "raid";
  };

type BoardRefitDecisionRoleRoundAccumulator = BoardRefitDecisionRoundAccumulator & {
  role: "boss" | "raid";
};

type FinalPlayerBoardAccumulator = {
  label: string;
  role: string;
  matchesPresent: number;
  totalDeployedUnitCount: number;
  totalDeployedAssetValue: number;
  totalSpecialUnitCount: number;
  totalStandardUnitCount: number;
};

type HeroTeamAccumulator = {
  heroId: string;
  heroName: string;
  matchesPresent: number;
  raidTeamWins: number;
  firstPlaces: number;
  totalPlacement: number;
  totalRemainingLives: number;
  totalFinalGold: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  totalSpecialUnitUpgradeCount: number;
};

type HeroCompositionAccumulator = {
  compositionKey: string;
  heroIds: string[];
  heroNames: string[];
  matchesPresent: number;
  raidWins: number;
  totalRounds: number;
};

type RangeDamageEfficiencyAccumulator = {
  side: "boss" | "raid";
  rangeBand: BotOnlyBaselineRangeBand;
  battleAppearances: number;
  totalDamage: number;
  totalTheoreticalBaseDamage: number;
  totalAttackCount: number;
  totalTheoreticalAttackCount: number;
  totalFirstAttackMs: number;
  firstAttackSamples: number;
  zeroDamageBattles: number;
};

type RoundDamageEfficiencyAccumulator = {
  roundIndex: number;
  side: "boss" | "raid";
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchesPresent: number;
  totalUnitLevel: number;
  totalDamage: number;
  totalInvestmentCost: number;
};

type UnitDamageEfficiencyAccumulator = {
  side: "boss" | "raid";
  unitId: string;
  unitType: string;
  unitName: string;
  roundsObserved: number;
  battleAppearances: number;
  matchesPresent: number;
  totalUnitLevel: number;
  totalDamage: number;
  totalInvestmentCost: number;
};

type RoundSurvivalDiagnosticAccumulator = {
  roundIndex: number;
  battleSamples: number;
  totalBattleEndMs: number;
  phaseSuccessBattles: number;
  phaseSuccessWithBossWipeBattles: number;
  phaseFailureWithRaidWipeBattles: number;
  bossWipedBattles: number;
  raidWipedBattles: number;
  bothSidesSurvivedBattles: number;
  totalBossStartUnitCount: number;
  totalBossSurvivors: number;
  totalBossFinalHp: number;
  totalBossEstimatedMaxHp: number;
  totalRaidStartUnitCount: number;
  totalRaidSurvivors: number;
  totalRaidFinalHp: number;
  totalRaidEstimatedMaxHp: number;
};

type RoundUnitSurvivalDiagnosticAccumulator = {
  roundIndex: number;
  side: "boss" | "raid";
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchesPresent: number;
  totalUnitLevel: number;
  survivedBattles: number;
  totalFinalHp: number;
  totalEstimatedMaxHp: number;
  totalDamageTaken: number;
  totalLifetimeMs: number;
  totalDamage: number;
  zeroDamageBattles: number;
};

type BossExclusiveRoundLevelAccumulator = {
  roundIndex: number;
  unitId: string;
  unitType: string;
  unitName: string;
  battleAppearances: number;
  matchKeys: Set<string>;
  unitLevelSamples: number[];
};

type HighCostRoundAccumulator = {
  roundIndex: number;
  role: "boss" | "raid";
  source: "shop" | "bossShop";
  unitId: string;
  unitName: string;
  unitType: string;
  cost: number;
  offerObservationCount: number;
  offerMatchKeys: Set<string>;
  purchaseCount: number;
  purchaseMatchKeys: Set<string>;
  battleAppearances: number;
  battleMatchKeys: Set<string>;
};

type RangeActionDiagnosticsAccumulator = {
  side: "boss" | "raid";
  rangeBand: BotOnlyBaselineRangeBand;
  battleAppearances: number;
  movedBattles: number;
  totalMoveCount: number;
  totalFirstMoveMs: number;
  firstMoveSamples: number;
  totalMoveToFirstAttackMs: number;
  moveToFirstAttackSamples: number;
  repositionBattles: number;
  totalRepositionMoveCount: number;
  reachedAttackRangeBattles: number;
  noAttackDespiteReachingRangeBattles: number;
  noAttackWithoutReachingRangeBattles: number;
  totalInitialNearestEnemyDistance: number;
  initialNearestEnemyDistanceSamples: number;
  totalBestNearestEnemyDistance: number;
  bestNearestEnemyDistanceSamples: number;
  totalDistanceClosed: number;
  distanceClosedSamples: number;
  noAttackBattles: number;
  movedNoAttackBattles: number;
  attackedNoHitBattles: number;
  lateSingleAttackBattles: number;
  moveTargetDiagnosticSampleCount: number;
  suboptimalMoveTargetCount: number;
  totalExcessApproachSteps: number;
  excessApproachStepSamples: number;
  totalOutsideAttackRangeBeforeFirstAttackMs: number;
  totalInAttackRangeBeforeFirstAttackMs: number;
  totalAfterFirstAttackMs: number;
  totalFirstReachedAttackRangeAtMs: number;
  firstReachedAttackRangeSamples: number;
  totalLeftLateralMoveCount: number;
  totalRightLateralMoveCount: number;
  firstLateralMoveLeftBattles: number;
  firstLateralMoveRightBattles: number;
  firstLateralMoveSamples: number;
  sharedPursuitMoveSampleCount: number;
  contestedPursuitMoveSampleCount: number;
  plannedApproachGroupMoveSampleCount: number;
  totalPlannedApproachGroupCompetitorCount: number;
  totalPlannedApproachGroupAssignedCount: number;
  oversubscribedPlannedApproachGroupMoveCount: number;
  plannedApproachBattleCount: number;
  plannedApproachMoveSampleCount: number;
  plannedApproachStillOpenMoveCount: number;
  usedPlannedApproachMoveCount: number;
  plannedApproachPathBlockedMoveCount: number;
  plannedApproachWithFirstAttackCount: number;
  plannedApproachMatchedFirstAttackTargetCount: number;
  plannedApproachReachedRangeWithoutAttackCount: number;
  plannedApproachNoReachNoAttackCount: number;
  plannedApproachNoAttackTargetDiedBeforeBattleEndCount: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveCount: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: number;
  plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount: number;
  plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount: number;
};

type RangeFormationDiagnosticsAccumulator = {
  side: "boss" | "raid";
  rangeBand: BotOnlyBaselineRangeBand;
  battleAppearances: number;
  frontAllyBlockedBattles: number;
  totalFrontAllyCount: number;
  frontAllyCountSamples: number;
  totalInitialRow: number;
  initialRowSamples: number;
  totalInitialColumn: number;
  initialColumnSamples: number;
  withFrontAllySamples: number;
  withoutFrontAllySamples: number;
  zeroDamageWithFrontAllyBattles: number;
  zeroDamageWithoutFrontAllyBattles: number;
  noAttackWithFrontAllyBattles: number;
  noAttackWithoutFrontAllyBattles: number;
};

type RaidMeleeCohortAccumulator = {
  cohort: BotOnlyBaselineRaidMeleeCohort;
  battleAppearances: number;
  totalDamage: number;
  totalAttackCount: number;
  totalFirstAttackMs: number;
  firstAttackSamples: number;
  totalLifetimeMs: number;
  zeroDamageBattles: number;
  survivedBattles: number;
};

type RaidSpecialMeleeUnitDiagnosticAccumulator = {
  unitId: string;
  unitName: string;
  battleAppearances: number;
  totalDamage: number;
  totalAttackCount: number;
  totalFirstAttackMs: number;
  firstAttackSamples: number;
  totalFirstReachedAttackRangeAtMs: number;
  firstReachedAttackRangeSamples: number;
  noAttackWithoutReachingRangeBattles: number;
  noAttackDespiteReachingRangeBattles: number;
  sharedPursuitMoveSampleCount: number;
  contestedPursuitMoveSampleCount: number;
  zeroDamageBattles: number;
  survivedBattles: number;
};

function buildEmptyHighCostSummary(): BotOnlyBaselineHighCostSummary {
  return {
    offerObservationCount: 0,
    offerMatchCount: 0,
    purchaseCount: 0,
    purchaseMatchCount: 0,
    finalBoardCopies: 0,
    finalBoardMatchCount: 0,
    finalBoardAdoptionRate: 0,
  };
}

function createEmptyBattleEndReasonCounts(): Record<BotOnlyBaselineBattleEndReason, number> {
  return {
    annihilation: 0,
    mutual_annihilation: 0,
    timeout_hp_lead: 0,
    timeout_hp_tie: 0,
    phase_hp_depleted: 0,
    boss_defeated: 0,
    forced: 0,
    unexpected: 0,
  };
}

function buildEmptyBattleMetrics(): BotOnlyBaselineBattleMetrics {
  return {
    totalBattles: 0,
    averageBossSurvivorsAtBattleEnd: 0,
    averageRaidSurvivorsAtBattleEnd: 0,
    bothSidesSurvivedRate: 0,
    bossWipedRate: 0,
    raidWipedRate: 0,
    endReasonCounts: createEmptyBattleEndReasonCounts(),
  };
}

function resolveBattleEndReason(
  battle: Pick<BotOnlyBaselineBattleSummary, "battleEndReason" | "bossSurvivors" | "raidSurvivors" | "winner">,
): BotOnlyBaselineBattleEndReason {
  if (battle.battleEndReason != null) {
    return battle.battleEndReason;
  }

  const bossSurvivors = Math.max(0, Math.round(battle.bossSurvivors ?? 0));
  const raidSurvivors = Math.max(0, Math.round(battle.raidSurvivors ?? 0));
  if (bossSurvivors === 0 && raidSurvivors === 0) {
    return "mutual_annihilation";
  }
  if (bossSurvivors === 0 || raidSurvivors === 0) {
    return "annihilation";
  }
  return battle.winner === "draw" ? "timeout_hp_tie" : "timeout_hp_lead";
}

function resolveBoardUnitCost(unitId: string): number | null {
  if (typeof unitId !== "string" || unitId.length === 0) {
    return null;
  }

  return UNIT_COST_BY_UNIT_ID.get(unitId) ?? null;
}

function calculateCharacterBodyInvestmentCost(unitId: string, unitLevel: number): number {
  if (!Number.isFinite(unitLevel)) {
    return 0;
  }

  const normalizedLevel = Math.max(1, Math.floor(unitLevel));
  if (normalizedLevel <= 1) {
    return 0;
  }

  return calculateSpecialUnitUpgradeCost(1, normalizedLevel - 1, unitId) ?? 0;
}

function resolveBattleUnitInvestmentCost(outcome: BotOnlyBaselineBattleUnitOutcome): number {
  if (CHARACTER_BODY_UNIT_IDS.has(outcome.unitId)) {
    return calculateCharacterBodyInvestmentCost(outcome.unitId, outcome.unitLevel);
  }

  const unitCost = resolveBoardUnitCost(outcome.unitId);
  if (unitCost === null) {
    return 0;
  }

  const normalizedLevel = Number.isFinite(outcome.unitLevel)
    ? Math.max(1, Math.floor(outcome.unitLevel))
    : 1;
  return unitCost * normalizedLevel;
}

function createBattleUnitAggregateAccumulator(
  unitId: string,
  unitType: string,
  unitName: string,
  includeSubUnitMetrics = false,
): BattleUnitAggregateAccumulator {
  return {
    unitId,
    unitType,
    unitName,
    battleAppearances: 0,
    matchesPresent: 0,
    totalunitLevel: 0,
    maxUnitLevel: 0,
    level4Matches: 0,
    level7Matches: 0,
    totalDamage: 0,
    activeBattles: 0,
    totalAttackCount: 0,
    totalBasicSkillActivations: 0,
    totalPairSkillActivations: 0,
    totalHitCount: 0,
    totalDamageTaken: 0,
    totalFirstAttackMs: 0,
    firstAttackSamples: 0,
    totalLifetimeMs: 0,
    zeroDamageBattles: 0,
    survivedBattles: 0,
    ownerWins: 0,
    ...(includeSubUnitMetrics
      ? {
        subUnitBattleAppearances: 0,
        subUnitMatchesPresent: 0,
        hostedSubUnitBattleAppearances: 0,
        hostedSubUnitMatchesPresent: 0,
      }
      : {}),
  };
}

function createOkinaSubHostAccumulator(
  hostUnitId: string,
  hostUnitType: string,
  hostUnitName: string,
): OkinaSubHostAccumulator {
  return {
    hostUnitId,
    hostUnitType,
    hostUnitName,
    battleAppearances: 0,
    matchesPresent: 0,
    totalHostLevel: 0,
    totalDamage: 0,
    totalDamageTaken: 0,
    totalLifetimeMs: 0,
    survivedBattles: 0,
    ownerWins: 0,
  };
}

function createOkinaSubHostRoundAccumulator(
  roundIndex: number,
  hostUnitId: string,
  hostUnitType: string,
  hostUnitName: string,
): OkinaSubHostRoundAccumulator {
  return {
    ...createOkinaSubHostAccumulator(hostUnitId, hostUnitType, hostUnitName),
    roundIndex,
  };
}

function createOkinaHeroSubDecisionRoundAccumulator(
  roundIndex: number,
): OkinaHeroSubDecisionRoundAccumulator {
  return {
    roundIndex,
    samples: 0,
    actionRecommendedSamples: 0,
    noCandidateSamples: 0,
    frontValuePreferredSamples: 0,
    currentHostKeptSamples: 0,
    totalCandidateCount: 0,
    totalFrontEquivalentValue: 0,
    totalBestHostGain: 0,
    bestHostGainSamples: 0,
    totalBestHostCurrentPowerScore: 0,
    totalBestHostFutureValueScore: 0,
    totalBestHostTransitionReadinessScore: 0,
    totalBestHostProtectionScore: 0,
    bestHostOptimizationSamples: 0,
    totalBestToFrontRatio: 0,
    bestToFrontRatioSamples: 0,
    bestHostSamplesById: new Map(),
  };
}

function createBoardRefitDecisionRoundAccumulator(
  roundIndex: number,
): BoardRefitDecisionRoundAccumulator {
  return {
    roundIndex,
    samples: 0,
    boardFullSamples: 0,
    attemptSamples: 0,
    recommendedReplacementSamples: 0,
    committedSamples: 0,
    futureCandidateKeptCount: 0,
    totalBenchPressure: 0,
    replacementScores: [],
    incomingSamplesById: new Map(),
    outgoingSamplesById: new Map(),
  };
}

function createBoardRefitDecisionRoleAccumulator(
  role: "boss" | "raid",
): BoardRefitDecisionRoleAccumulator {
  return {
    role,
    samples: 0,
    boardFullSamples: 0,
    attemptSamples: 0,
    recommendedReplacementSamples: 0,
    committedSamples: 0,
    futureCandidateKeptCount: 0,
    totalBenchPressure: 0,
    replacementScores: [],
    incomingSamplesById: new Map(),
    outgoingSamplesById: new Map(),
  };
}

function createBoardRefitDecisionRoleRoundAccumulator(
  role: "boss" | "raid",
  roundIndex: number,
): BoardRefitDecisionRoleRoundAccumulator {
  return {
    role,
    ...createBoardRefitDecisionRoundAccumulator(roundIndex),
  };
}

function createFinalPlayerBoardAccumulator(
  label: string,
  role: string,
): FinalPlayerBoardAccumulator {
  return {
    label,
    role,
    matchesPresent: 0,
    totalDeployedUnitCount: 0,
    totalDeployedAssetValue: 0,
    totalSpecialUnitCount: 0,
    totalStandardUnitCount: 0,
  };
}

function divideOrZero(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function resolveRangeBand(range: number): BotOnlyBaselineRangeBand {
  return range <= 1 ? "range_1" : "range_2_plus";
}

function resolveUnitCombatProfile(
  unitId: string,
  unitType: string,
): UnitCombatProfile | null {
  return UNIT_COMBAT_PROFILE_BY_ID.get(unitId)
    ?? UNIT_COMBAT_PROFILE_BY_TYPE.get(unitType)
    ?? null;
}

function resolveBaselineUnitName(unitId: string, fallback: string): string {
  return UNIT_DISPLAY_NAME_BY_ID.get(unitId) ?? fallback;
}

function createHeroTeamAccumulator(heroId: string): HeroTeamAccumulator {
  return {
    heroId,
    heroName: resolveBaselineUnitName(heroId, heroId),
    matchesPresent: 0,
    raidTeamWins: 0,
    firstPlaces: 0,
    totalPlacement: 0,
    totalRemainingLives: 0,
    totalFinalGold: 0,
    totalGoldEarned: 0,
    totalGoldSpent: 0,
    totalSpecialUnitUpgradeCount: 0,
  };
}

function buildHeroTeamMetric(entry: HeroTeamAccumulator): BotOnlyBaselineHeroTeamMetric {
  return {
    heroId: entry.heroId,
    heroName: entry.heroName,
    matchesPresent: entry.matchesPresent,
    raidTeamWins: entry.raidTeamWins,
    raidTeamWinRate: entry.matchesPresent > 0 ? entry.raidTeamWins / entry.matchesPresent : 0,
    firstPlaceRate: entry.matchesPresent > 0 ? entry.firstPlaces / entry.matchesPresent : 0,
    averagePlacement: entry.matchesPresent > 0 ? entry.totalPlacement / entry.matchesPresent : 0,
    averageRemainingLives: entry.matchesPresent > 0 ? entry.totalRemainingLives / entry.matchesPresent : 0,
    averageFinalGold: entry.matchesPresent > 0 ? entry.totalFinalGold / entry.matchesPresent : 0,
    averageGoldEarned: entry.matchesPresent > 0 ? entry.totalGoldEarned / entry.matchesPresent : 0,
    averageGoldSpent: entry.matchesPresent > 0 ? entry.totalGoldSpent / entry.matchesPresent : 0,
    averageSpecialUnitUpgradeCount: entry.matchesPresent > 0
      ? entry.totalSpecialUnitUpgradeCount / entry.matchesPresent
      : 0,
  };
}

function buildHeroCompositionMetric(
  entry: HeroCompositionAccumulator,
): BotOnlyBaselineHeroCompositionMetric {
  return {
    compositionKey: entry.compositionKey,
    heroIds: [...entry.heroIds],
    heroNames: [...entry.heroNames],
    matchesPresent: entry.matchesPresent,
    raidWins: entry.raidWins,
    raidWinRate: entry.matchesPresent > 0 ? entry.raidWins / entry.matchesPresent : 0,
    averageRounds: entry.matchesPresent > 0 ? entry.totalRounds / entry.matchesPresent : 0,
  };
}

function buildHeroTeamMetrics(
  entries: Iterable<HeroTeamAccumulator>,
): BotOnlyBaselineHeroTeamMetric[] {
  return Array.from(entries)
    .map((entry) => buildHeroTeamMetric(entry))
    .sort((left, right) =>
      right.raidTeamWinRate - left.raidTeamWinRate
      || right.matchesPresent - left.matchesPresent
      || left.heroId.localeCompare(right.heroId));
}

function buildHeroCompositionMetrics(
  entries: Iterable<HeroCompositionAccumulator>,
): BotOnlyBaselineHeroCompositionMetric[] {
  return Array.from(entries)
    .map((entry) => buildHeroCompositionMetric(entry))
    .sort((left, right) =>
      right.raidWinRate - left.raidWinRate
      || right.matchesPresent - left.matchesPresent
      || left.compositionKey.localeCompare(right.compositionKey));
}

function recordHeroMatchMetrics(
  report: BotOnlyBaselineMatchSummary,
  heroTeamMetricsById: Map<string, HeroTeamAccumulator>,
  heroCompositionMetricsByKey: Map<string, HeroCompositionAccumulator>,
): void {
  const raidPlayersWithHeroes = report.finalPlayers
    .filter((player) =>
      player.role === "raid"
      && typeof player.selectedHeroId === "string"
      && player.selectedHeroId.length > 0)
    .sort((left, right) =>
      (left.label || left.playerId).localeCompare(right.label || right.playerId));
  if (raidPlayersWithHeroes.length === 0) {
    return;
  }

  const raidTeamWon = report.ranking[0] !== report.bossPlayerId;
  for (const player of raidPlayersWithHeroes) {
    const existing = heroTeamMetricsById.get(player.selectedHeroId)
      ?? createHeroTeamAccumulator(player.selectedHeroId);
    existing.matchesPresent += 1;
    existing.raidTeamWins += raidTeamWon ? 1 : 0;
    existing.firstPlaces += report.ranking[0] === player.playerId ? 1 : 0;
    existing.totalPlacement += player.rank;
    existing.totalRemainingLives += player.remainingLives;
    existing.totalFinalGold += player.gold ?? 0;
    existing.totalGoldEarned += player.totalGoldEarned ?? 0;
    existing.totalGoldSpent += player.totalGoldSpent ?? 0;
    existing.totalSpecialUnitUpgradeCount += player.specialUnitUpgradeCount ?? 0;
    heroTeamMetricsById.set(player.selectedHeroId, existing);
  }

  const heroIds = raidPlayersWithHeroes.map((player) => player.selectedHeroId);
  const compositionKey = heroIds.join(" / ");
  const existingComposition = heroCompositionMetricsByKey.get(compositionKey) ?? {
    compositionKey,
    heroIds,
    heroNames: heroIds.map((heroId) => resolveBaselineUnitName(heroId, heroId)),
    matchesPresent: 0,
    raidWins: 0,
    totalRounds: 0,
  };
  existingComposition.matchesPresent += 1;
  existingComposition.raidWins += raidTeamWon ? 1 : 0;
  existingComposition.totalRounds += report.totalRounds;
  heroCompositionMetricsByKey.set(compositionKey, existingComposition);
}

function isSpecialBattleUnitOutcome(outcome: BotOnlyBaselineBattleUnitOutcome): boolean {
  return outcome.isSpecialUnit || SPECIAL_BATTLE_UNIT_IDS.has(outcome.unitId);
}

function resolveBattleWinnerRole(
  battle: Pick<BotOnlyBaselineBattleSummary, "leftPlayerId" | "rightPlayerId" | "winner">,
  playerById: Map<string, BotOnlyBaselineFinalPlayer>,
  bossPlayerId: string,
): "boss" | "raid" | null {
  const winnerPlayerId = battle.winner === "left"
    ? battle.leftPlayerId
    : battle.winner === "right"
      ? battle.rightPlayerId
      : null;
  if (winnerPlayerId == null) {
    return null;
  }

  const role = playerById.get(winnerPlayerId)?.role;
  if (role === "boss" || role === "raid") {
    return role;
  }

  return winnerPlayerId === bossPlayerId ? "boss" : "raid";
}

function toRoundUnitDetail(
  outcome: BotOnlyBaselineBattleUnitOutcome,
): BotOnlyBaselineRoundUnitDetail {
  const hasCoordinate = typeof outcome.initialColumn === "number" && typeof outcome.initialRow === "number";
  return {
    playerId: outcome.playerId,
    label: outcome.label,
    unitId: outcome.unitId,
    unitName: resolveBaselineUnitName(outcome.unitId, outcome.unitName),
    ...(outcome.unitType ? { unitType: outcome.unitType } : {}),
    side: outcome.side,
    cell: hasCoordinate
      ? sharedBoardCoordinateToIndex({ x: outcome.initialColumn!, y: outcome.initialRow! })
      : null,
    x: hasCoordinate ? outcome.initialColumn! : null,
    y: hasCoordinate ? outcome.initialRow! : null,
    totalDamage: outcome.totalDamage,
    phaseContributionDamage: outcome.phaseContributionDamage,
    damageTaken: Math.max(0, outcome.damageTaken ?? 0),
    finalHp: outcome.finalHp,
    alive: outcome.alive,
    unitLevel: outcome.unitLevel,
  };
}

function calculatePhaseHpPowerIndex(input: {
  phaseHpTarget: number;
  phaseDamageDealt: number;
  targetReached: boolean;
  battleEndTimeMs: number;
  battleDurationMs: number;
}): number | null {
  if (!(input.phaseHpTarget > 0)) {
    return null;
  }

  if (
    input.targetReached
    && input.battleEndTimeMs > 0
    && input.battleDurationMs > 0
  ) {
    return input.battleDurationMs / input.battleEndTimeMs;
  }

  return input.phaseDamageDealt / input.phaseHpTarget;
}

function buildBossBodyFocusDetail(
  bossUnitOutcomes: BotOnlyBaselineBattleUnitOutcome[],
): BotOnlyBaselineBossBodyFocusDetail | null {
  const bossBody = bossUnitOutcomes.find((unit) => unit.unitId === "remilia");
  if (!bossBody) {
    return null;
  }

  const hasCoordinate = typeof bossBody.initialColumn === "number" && typeof bossBody.initialRow === "number";
  const cell = hasCoordinate
    ? sharedBoardCoordinateToIndex({ x: bossBody.initialColumn!, y: bossBody.initialRow! })
    : null;
  const damageTaken = Math.max(0, bossBody.damageTaken ?? 0);

  return {
    unitId: bossBody.unitId,
    unitName: resolveBaselineUnitName(bossBody.unitId, bossBody.unitName),
    cell,
    x: hasCoordinate ? bossBody.initialColumn! : null,
    y: hasCoordinate ? bossBody.initialRow! : null,
    unitLevel: Number.isFinite(bossBody.unitLevel) ? bossBody.unitLevel : null,
    damageTaken,
    directPhaseDamage: damageTaken,
    firstDamageAtMs: null,
    defeated: !bossBody.alive || bossBody.finalHp <= 0,
    finalHp: Number.isFinite(bossBody.finalHp) ? bossBody.finalHp : null,
  };
}

function buildRoundDetailsForMatch(
  report: BotOnlyBaselineMatchSummary,
  matchIndex: number,
): BotOnlyBaselineMatchRoundDetail[] {
  const playerById = new Map(
    report.finalPlayers.map((player) => [player.playerId, player] as const),
  );
  const matchWinnerRole = report.ranking[0] === report.bossPlayerId ? "boss" : "raid";

  return (report.rounds ?? []).map((round) => {
    const raidPlayerConsequences = round.playerConsequences.filter(
      (player) => player.role === "raid",
    );
    const allRaidPlayersWipedOut = raidPlayerConsequences.length > 0
      && raidPlayerConsequences.every((player) => player.playerWipedOut);
    const allUnitOutcomes = round.battles.flatMap((battle) => battle.unitOutcomes);
    const bossUnitOutcomes = allUnitOutcomes.filter((unit) => unit.side === "boss");
    const raidUnitOutcomes = allUnitOutcomes.filter((unit) => unit.side === "raid");
    const bossSurvivors = round.battles.reduce(
      (total, battle) => total + Math.max(0, Math.round(battle.bossSurvivors ?? 0)),
      0,
    );
    const raidSurvivors = round.battles.reduce(
      (total, battle) => total + Math.max(0, Math.round(battle.raidSurvivors ?? 0)),
      0,
    );
    const battleEndTimeMs = Math.max(
      0,
      ...round.battles
        .map((battle) => battle.battleDurationMs)
        .filter((duration): duration is number =>
          typeof duration === "number" && Number.isFinite(duration)),
    );
    const battleDurationBudgetMs = report.metadata?.timings.battleDurationMs
      ?? battleEndTimeMs;
    const targetReached = round.phaseResult === "success"
      || (round.phaseHpTarget > 0 && round.phaseDamageDealt >= round.phaseHpTarget);

    return {
      matchIndex,
      matchWinnerRole,
      totalRounds: report.totalRounds,
      roundIndex: round.roundIndex,
      battleEndTimeMs,
      phaseHpTarget: round.phaseHpTarget,
      phaseDamageDealt: round.phaseDamageDealt,
      phaseCompletionRate: round.phaseCompletionRate,
      phaseHpPowerIndex: calculatePhaseHpPowerIndex({
        phaseHpTarget: round.phaseHpTarget,
        phaseDamageDealt: round.phaseDamageDealt,
        targetReached,
        battleEndTimeMs,
        battleDurationMs: battleDurationBudgetMs,
      }),
      phaseResult: round.phaseResult,
      allRaidPlayersWipedOut,
      raidPlayersWipedOut: raidPlayerConsequences.filter((player) => player.playerWipedOut).length,
      raidPlayersEliminatedAfterRound: raidPlayerConsequences.filter((player) => player.eliminatedAfter).length,
      bossSurvivors,
      raidSurvivors,
      bossTotalDamage: bossUnitOutcomes.reduce((total, unit) => total + unit.totalDamage, 0),
      raidTotalDamage: raidUnitOutcomes.reduce((total, unit) => total + unit.totalDamage, 0),
      raidPhaseContributionDamage: raidUnitOutcomes.reduce(
        (total, unit) => total + unit.phaseContributionDamage,
        0,
      ),
      battleEndReasons: round.battles.map((battle) => resolveBattleEndReason(battle)),
      battleWinnerRoles: round.battles.map((battle) =>
        battle.winner === "draw"
          ? "draw"
          : resolveBattleWinnerRole(battle, playerById, report.bossPlayerId) ?? "draw"),
      bossSpellMetrics: round.battles.flatMap((battle) =>
        (battle.bossSpellMetrics ?? []).map((metric) => ({ ...metric }))),
      raidPlayerConsequences,
      bossBodyFocus: buildBossBodyFocusDetail(bossUnitOutcomes),
      topBossUnits: bossUnitOutcomes
        .map((unit) => toRoundUnitDetail(unit))
        .sort((left, right) =>
          right.totalDamage - left.totalDamage
          || right.finalHp - left.finalHp
          || left.unitId.localeCompare(right.unitId))
        .slice(0, 5),
      topBossDamageTakenUnits: bossUnitOutcomes
        .map((unit) => toRoundUnitDetail(unit))
        .sort((left, right) =>
          (right.damageTaken ?? 0) - (left.damageTaken ?? 0)
          || right.totalDamage - left.totalDamage
          || left.unitId.localeCompare(right.unitId))
        .slice(0, 8),
      topRaidUnits: raidUnitOutcomes
        .map((unit) => toRoundUnitDetail(unit))
        .sort((left, right) =>
          right.phaseContributionDamage - left.phaseContributionDamage
          || right.totalDamage - left.totalDamage
          || left.unitId.localeCompare(right.unitId))
        .slice(0, 8),
    };
  });
}

function createRangeDamageEfficiencyAccumulator(
  side: "boss" | "raid",
  rangeBand: BotOnlyBaselineRangeBand,
): RangeDamageEfficiencyAccumulator {
  return {
    side,
    rangeBand,
    battleAppearances: 0,
    totalDamage: 0,
    totalTheoreticalBaseDamage: 0,
    totalAttackCount: 0,
    totalTheoreticalAttackCount: 0,
    totalFirstAttackMs: 0,
    firstAttackSamples: 0,
    zeroDamageBattles: 0,
  };
}

function createRoundDamageEfficiencyAccumulator(
  roundIndex: number,
  side: "boss" | "raid",
  unitId: string,
  unitType: string,
  unitName: string,
): RoundDamageEfficiencyAccumulator {
  return {
    roundIndex,
    side,
    unitId,
    unitType,
    unitName,
    battleAppearances: 0,
    matchesPresent: 0,
    totalUnitLevel: 0,
    totalDamage: 0,
    totalInvestmentCost: 0,
  };
}

function buildRoundDamageEfficiencyMetric(
  entry: RoundDamageEfficiencyAccumulator,
): BotOnlyBaselineRoundDamageEfficiencyMetric {
  return {
    roundIndex: entry.roundIndex,
    side: entry.side,
    unitId: entry.unitId,
    unitType: entry.unitType,
    unitName: entry.unitName,
    battleAppearances: entry.battleAppearances,
    matchesPresent: entry.matchesPresent,
    averageUnitLevel: divideOrZero(entry.totalUnitLevel, entry.battleAppearances),
    totalDamage: entry.totalDamage,
    totalInvestmentCost: entry.totalInvestmentCost,
    averageInvestmentCostPerBattle: divideOrZero(entry.totalInvestmentCost, entry.battleAppearances),
    damagePerInvestmentCost: entry.totalInvestmentCost > 0
      ? entry.totalDamage / entry.totalInvestmentCost
      : null,
  };
}

function createRoundSurvivalDiagnosticAccumulator(
  roundIndex: number,
): RoundSurvivalDiagnosticAccumulator {
  return {
    roundIndex,
    battleSamples: 0,
    totalBattleEndMs: 0,
    phaseSuccessBattles: 0,
    phaseSuccessWithBossWipeBattles: 0,
    phaseFailureWithRaidWipeBattles: 0,
    bossWipedBattles: 0,
    raidWipedBattles: 0,
    bothSidesSurvivedBattles: 0,
    totalBossStartUnitCount: 0,
    totalBossSurvivors: 0,
    totalBossFinalHp: 0,
    totalBossEstimatedMaxHp: 0,
    totalRaidStartUnitCount: 0,
    totalRaidSurvivors: 0,
    totalRaidFinalHp: 0,
    totalRaidEstimatedMaxHp: 0,
  };
}

function createRoundUnitSurvivalDiagnosticAccumulator(
  roundIndex: number,
  side: "boss" | "raid",
  unitId: string,
  unitType: string,
  unitName: string,
): RoundUnitSurvivalDiagnosticAccumulator {
  return {
    roundIndex,
    side,
    unitId,
    unitType,
    unitName,
    battleAppearances: 0,
    matchesPresent: 0,
    totalUnitLevel: 0,
    survivedBattles: 0,
    totalFinalHp: 0,
    totalEstimatedMaxHp: 0,
    totalDamageTaken: 0,
    totalLifetimeMs: 0,
    totalDamage: 0,
    zeroDamageBattles: 0,
  };
}

function resolveOutcomeEstimatedMaxHp(outcome: BotOnlyBaselineBattleUnitOutcome): number {
  const finalHp = Number.isFinite(outcome.finalHp) ? Math.max(0, outcome.finalHp) : 0;
  const damageTaken = Number.isFinite(outcome.damageTaken ?? Number.NaN)
    ? Math.max(0, outcome.damageTaken ?? 0)
    : 0;
  return finalHp + damageTaken;
}

function buildRoundSurvivalDiagnosticMetric(
  entry: RoundSurvivalDiagnosticAccumulator,
): BotOnlyBaselineRoundSurvivalDiagnosticMetric {
  return {
    roundIndex: entry.roundIndex,
    battleSamples: entry.battleSamples,
    averageBattleEndMs: divideOrZero(entry.totalBattleEndMs, entry.battleSamples),
    phaseSuccessRate: divideOrZero(entry.phaseSuccessBattles, entry.battleSamples),
    phaseSuccessWithBossWipeRate: divideOrZero(entry.phaseSuccessWithBossWipeBattles, entry.battleSamples),
    phaseFailureWithRaidWipeRate: divideOrZero(entry.phaseFailureWithRaidWipeBattles, entry.battleSamples),
    bossWipedRate: divideOrZero(entry.bossWipedBattles, entry.battleSamples),
    raidWipedRate: divideOrZero(entry.raidWipedBattles, entry.battleSamples),
    bothSidesSurvivedRate: divideOrZero(entry.bothSidesSurvivedBattles, entry.battleSamples),
    averageBossStartUnitCount: divideOrZero(entry.totalBossStartUnitCount, entry.battleSamples),
    averageBossSurvivors: divideOrZero(entry.totalBossSurvivors, entry.battleSamples),
    bossUnitSurvivalRate: divideOrZero(entry.totalBossSurvivors, entry.totalBossStartUnitCount),
    averageBossFinalHp: divideOrZero(entry.totalBossFinalHp, entry.battleSamples),
    averageBossEstimatedMaxHp: divideOrZero(entry.totalBossEstimatedMaxHp, entry.battleSamples),
    bossRemainingHpRate: entry.totalBossEstimatedMaxHp > 0
      ? entry.totalBossFinalHp / entry.totalBossEstimatedMaxHp
      : null,
    averageRaidStartUnitCount: divideOrZero(entry.totalRaidStartUnitCount, entry.battleSamples),
    averageRaidSurvivors: divideOrZero(entry.totalRaidSurvivors, entry.battleSamples),
    raidUnitSurvivalRate: divideOrZero(entry.totalRaidSurvivors, entry.totalRaidStartUnitCount),
    averageRaidFinalHp: divideOrZero(entry.totalRaidFinalHp, entry.battleSamples),
    averageRaidEstimatedMaxHp: divideOrZero(entry.totalRaidEstimatedMaxHp, entry.battleSamples),
    raidRemainingHpRate: entry.totalRaidEstimatedMaxHp > 0
      ? entry.totalRaidFinalHp / entry.totalRaidEstimatedMaxHp
      : null,
  };
}

function buildRoundUnitSurvivalDiagnosticMetric(
  entry: RoundUnitSurvivalDiagnosticAccumulator,
): BotOnlyBaselineRoundUnitSurvivalDiagnosticMetric {
  return {
    roundIndex: entry.roundIndex,
    side: entry.side,
    unitId: entry.unitId,
    unitType: entry.unitType,
    unitName: entry.unitName,
    battleAppearances: entry.battleAppearances,
    matchesPresent: entry.matchesPresent,
    averageUnitLevel: divideOrZero(entry.totalUnitLevel, entry.battleAppearances),
    survivalRate: divideOrZero(entry.survivedBattles, entry.battleAppearances),
    averageFinalHp: divideOrZero(entry.totalFinalHp, entry.battleAppearances),
    averageEstimatedMaxHp: divideOrZero(entry.totalEstimatedMaxHp, entry.battleAppearances),
    remainingHpRate: entry.totalEstimatedMaxHp > 0
      ? entry.totalFinalHp / entry.totalEstimatedMaxHp
      : null,
    averageDamageTaken: divideOrZero(entry.totalDamageTaken, entry.battleAppearances),
    averageLifetimeMs: divideOrZero(entry.totalLifetimeMs, entry.battleAppearances),
    averageDamagePerBattle: divideOrZero(entry.totalDamage, entry.battleAppearances),
    zeroDamageBattleRate: divideOrZero(entry.zeroDamageBattles, entry.battleAppearances),
  };
}

function createBossExclusiveRoundLevelAccumulator(
  roundIndex: number,
  unitId: string,
  unitType: string,
  unitName: string,
): BossExclusiveRoundLevelAccumulator {
  return {
    roundIndex,
    unitId,
    unitType,
    unitName,
    battleAppearances: 0,
    matchKeys: new Set<string>(),
    unitLevelSamples: [],
  };
}

function calculatePercentileLevel(samples: number[], ratio: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const rawIndex = (sorted.length - 1) * ratio;
  const index = Math.min(
    sorted.length - 1,
    ratio > 0.5 ? Math.ceil(rawIndex) : Math.floor(rawIndex),
  );
  return sorted[index] ?? 0;
}

function buildBossExclusiveRoundLevelMetric(
  entry: BossExclusiveRoundLevelAccumulator,
): BotOnlyBaselineBossExclusiveRoundLevelMetric {
  const level4Samples = entry.unitLevelSamples.filter((level) => level >= 4).length;
  const level7Samples = entry.unitLevelSamples.filter((level) => level >= 7).length;

  return {
    roundIndex: entry.roundIndex,
    unitId: entry.unitId,
    unitType: entry.unitType,
    unitName: entry.unitName,
    battleAppearances: entry.battleAppearances,
    matchesPresent: entry.matchKeys.size,
    averageUnitLevel: divideOrZero(
      entry.unitLevelSamples.reduce((total, level) => total + level, 0),
      entry.battleAppearances,
    ),
    p25UnitLevel: calculatePercentileLevel(entry.unitLevelSamples, 0.25),
    p50UnitLevel: calculatePercentileLevel(entry.unitLevelSamples, 0.5),
    p75UnitLevel: calculatePercentileLevel(entry.unitLevelSamples, 0.75),
    level4ReachRate: divideOrZero(level4Samples, entry.battleAppearances),
    level7ReachRate: divideOrZero(level7Samples, entry.battleAppearances),
    unitLevelSamples: [...entry.unitLevelSamples],
  };
}

function resolveHighCostRoundSource(
  role: "boss" | "raid",
  unitId: string,
): "shop" | "bossShop" {
  return role === "boss" && BOSS_EXCLUSIVE_UNIT_IDS.has(unitId) ? "bossShop" : "shop";
}

function createHighCostRoundAccumulator(
  roundIndex: number,
  role: "boss" | "raid",
  source: "shop" | "bossShop",
  unitId: string,
  unitType: string,
  unitName: string,
  cost: number,
): HighCostRoundAccumulator {
  return {
    roundIndex,
    role,
    source,
    unitId,
    unitName,
    unitType,
    cost,
    offerObservationCount: 0,
    offerMatchKeys: new Set<string>(),
    purchaseCount: 0,
    purchaseMatchKeys: new Set<string>(),
    battleAppearances: 0,
    battleMatchKeys: new Set<string>(),
  };
}

function buildHighCostRoundMetric(
  entry: HighCostRoundAccumulator,
  completedMatches: number,
): BotOnlyBaselineHighCostRoundMetric {
  return {
    roundIndex: entry.roundIndex,
    role: entry.role,
    source: entry.source,
    unitId: entry.unitId,
    unitName: entry.unitName,
    unitType: entry.unitType,
    cost: entry.cost,
    offerObservationCount: entry.offerObservationCount,
    offerMatchCount: entry.offerMatchKeys.size,
    purchaseCount: entry.purchaseCount,
    purchaseMatchCount: entry.purchaseMatchKeys.size,
    battleAppearances: entry.battleAppearances,
    battleMatchCount: entry.battleMatchKeys.size,
    offeredMatchRate: divideOrZero(entry.offerMatchKeys.size, completedMatches),
    purchaseRate: divideOrZero(entry.purchaseCount, entry.offerObservationCount),
    battlePresenceRate: divideOrZero(entry.battleMatchKeys.size, completedMatches),
  };
}

function createUnitDamageEfficiencyAccumulator(
  side: "boss" | "raid",
  unitId: string,
  unitType: string,
  unitName: string,
): UnitDamageEfficiencyAccumulator {
  return {
    side,
    unitId,
    unitType,
    unitName,
    roundsObserved: 0,
    battleAppearances: 0,
    matchesPresent: 0,
    totalUnitLevel: 0,
    totalDamage: 0,
    totalInvestmentCost: 0,
  };
}

function buildUnitDamageEfficiencyMetric(
  entry: UnitDamageEfficiencyAccumulator,
): BotOnlyBaselineUnitDamageEfficiencyMetric {
  return {
    side: entry.side,
    unitId: entry.unitId,
    unitType: entry.unitType,
    unitName: entry.unitName,
    roundsObserved: entry.roundsObserved,
    battleAppearances: entry.battleAppearances,
    matchesPresent: entry.matchesPresent,
    averageUnitLevel: divideOrZero(entry.totalUnitLevel, entry.battleAppearances),
    totalDamage: entry.totalDamage,
    totalInvestmentCost: entry.totalInvestmentCost,
    weightedDamagePerInvestmentCost: entry.totalInvestmentCost > 0
      ? entry.totalDamage / entry.totalInvestmentCost
      : null,
    sampleQuality: entry.battleAppearances >= 10 ? "usable" : "low",
  };
}

function buildUnitDamageEfficiencyMetrics(
  roundEntries: Iterable<RoundDamageEfficiencyAccumulator>,
): BotOnlyBaselineUnitDamageEfficiencyMetric[] {
  const byUnit = new Map<string, UnitDamageEfficiencyAccumulator>();
  for (const entry of roundEntries) {
    const key = `${entry.side}::${entry.unitId}`;
    const existing = byUnit.get(key)
      ?? createUnitDamageEfficiencyAccumulator(
        entry.side,
        entry.unitId,
        entry.unitType,
        entry.unitName,
      );
    existing.roundsObserved += 1;
    existing.battleAppearances += entry.battleAppearances;
    existing.matchesPresent += entry.matchesPresent;
    existing.totalUnitLevel += entry.totalUnitLevel;
    existing.totalDamage += entry.totalDamage;
    existing.totalInvestmentCost += entry.totalInvestmentCost;
    byUnit.set(key, existing);
  }

  return Array.from(byUnit.values())
    .map((entry) => buildUnitDamageEfficiencyMetric(entry))
    .sort((left, right) =>
      left.side.localeCompare(right.side)
      || ((right.weightedDamagePerInvestmentCost ?? -1) - (left.weightedDamagePerInvestmentCost ?? -1))
      || right.totalDamage - left.totalDamage
      || left.unitId.localeCompare(right.unitId));
}

function buildRangeDamageEfficiencyMetric(
  entry: RangeDamageEfficiencyAccumulator,
): BotOnlyBaselineRangeDamageEfficiencyMetric {
  return {
    side: entry.side,
    rangeBand: entry.rangeBand,
    battleAppearances: entry.battleAppearances,
    totalDamage: entry.totalDamage,
    totalTheoreticalBaseDamage: entry.totalTheoreticalBaseDamage,
    normalizedDamageEfficiency: entry.totalTheoreticalBaseDamage > 0
      ? entry.totalDamage / entry.totalTheoreticalBaseDamage
      : 0,
    totalAttackCount: entry.totalAttackCount,
    totalTheoreticalAttackCount: entry.totalTheoreticalAttackCount,
    attackOpportunityUtilization: entry.totalTheoreticalAttackCount > 0
      ? entry.totalAttackCount / entry.totalTheoreticalAttackCount
      : null,
    averageDamagePerBattle: entry.battleAppearances > 0
      ? entry.totalDamage / entry.battleAppearances
      : 0,
    averageFirstAttackMs: entry.firstAttackSamples > 0
      ? entry.totalFirstAttackMs / entry.firstAttackSamples
      : null,
    firstAttackSamples: entry.firstAttackSamples,
    zeroDamageBattleRate: entry.battleAppearances > 0
      ? entry.zeroDamageBattles / entry.battleAppearances
      : 0,
  };
}

function createRangeActionDiagnosticsAccumulator(
  side: "boss" | "raid",
  rangeBand: BotOnlyBaselineRangeBand,
): RangeActionDiagnosticsAccumulator {
  return {
    side,
    rangeBand,
    battleAppearances: 0,
    movedBattles: 0,
    totalMoveCount: 0,
    totalFirstMoveMs: 0,
    firstMoveSamples: 0,
    totalMoveToFirstAttackMs: 0,
    moveToFirstAttackSamples: 0,
    repositionBattles: 0,
    totalRepositionMoveCount: 0,
    reachedAttackRangeBattles: 0,
    noAttackDespiteReachingRangeBattles: 0,
    noAttackWithoutReachingRangeBattles: 0,
    totalInitialNearestEnemyDistance: 0,
    initialNearestEnemyDistanceSamples: 0,
    totalBestNearestEnemyDistance: 0,
    bestNearestEnemyDistanceSamples: 0,
    totalDistanceClosed: 0,
    distanceClosedSamples: 0,
    noAttackBattles: 0,
    movedNoAttackBattles: 0,
    attackedNoHitBattles: 0,
    lateSingleAttackBattles: 0,
    moveTargetDiagnosticSampleCount: 0,
    suboptimalMoveTargetCount: 0,
    totalExcessApproachSteps: 0,
    excessApproachStepSamples: 0,
    totalOutsideAttackRangeBeforeFirstAttackMs: 0,
    totalInAttackRangeBeforeFirstAttackMs: 0,
    totalAfterFirstAttackMs: 0,
    totalFirstReachedAttackRangeAtMs: 0,
    firstReachedAttackRangeSamples: 0,
    totalLeftLateralMoveCount: 0,
    totalRightLateralMoveCount: 0,
    firstLateralMoveLeftBattles: 0,
    firstLateralMoveRightBattles: 0,
    firstLateralMoveSamples: 0,
    sharedPursuitMoveSampleCount: 0,
    contestedPursuitMoveSampleCount: 0,
    plannedApproachGroupMoveSampleCount: 0,
    totalPlannedApproachGroupCompetitorCount: 0,
    totalPlannedApproachGroupAssignedCount: 0,
    oversubscribedPlannedApproachGroupMoveCount: 0,
    plannedApproachBattleCount: 0,
    plannedApproachMoveSampleCount: 0,
    plannedApproachStillOpenMoveCount: 0,
    usedPlannedApproachMoveCount: 0,
    plannedApproachPathBlockedMoveCount: 0,
    plannedApproachWithFirstAttackCount: 0,
    plannedApproachMatchedFirstAttackTargetCount: 0,
    plannedApproachReachedRangeWithoutAttackCount: 0,
    plannedApproachNoReachNoAttackCount: 0,
    plannedApproachNoAttackTargetDiedBeforeBattleEndCount: 0,
    plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveCount: 0,
    plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: 0,
    plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount: 0,
    plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount: 0,
  };
}

function createRangeFormationDiagnosticsAccumulator(
  side: "boss" | "raid",
  rangeBand: BotOnlyBaselineRangeBand,
): RangeFormationDiagnosticsAccumulator {
  return {
    side,
    rangeBand,
    battleAppearances: 0,
    frontAllyBlockedBattles: 0,
    totalFrontAllyCount: 0,
    frontAllyCountSamples: 0,
    totalInitialRow: 0,
    initialRowSamples: 0,
    totalInitialColumn: 0,
    initialColumnSamples: 0,
    withFrontAllySamples: 0,
    withoutFrontAllySamples: 0,
    zeroDamageWithFrontAllyBattles: 0,
    zeroDamageWithoutFrontAllyBattles: 0,
    noAttackWithFrontAllyBattles: 0,
    noAttackWithoutFrontAllyBattles: 0,
  };
}

function createRaidMeleeCohortAccumulator(
  cohort: BotOnlyBaselineRaidMeleeCohort,
): RaidMeleeCohortAccumulator {
  return {
    cohort,
    battleAppearances: 0,
    totalDamage: 0,
    totalAttackCount: 0,
    totalFirstAttackMs: 0,
    firstAttackSamples: 0,
    totalLifetimeMs: 0,
    zeroDamageBattles: 0,
    survivedBattles: 0,
  };
}

function createRaidSpecialMeleeUnitDiagnosticAccumulator(
  unitId: string,
  unitName: string,
): RaidSpecialMeleeUnitDiagnosticAccumulator {
  return {
    unitId,
    unitName,
    battleAppearances: 0,
    totalDamage: 0,
    totalAttackCount: 0,
    totalFirstAttackMs: 0,
    firstAttackSamples: 0,
    totalFirstReachedAttackRangeAtMs: 0,
    firstReachedAttackRangeSamples: 0,
    noAttackWithoutReachingRangeBattles: 0,
    noAttackDespiteReachingRangeBattles: 0,
    sharedPursuitMoveSampleCount: 0,
    contestedPursuitMoveSampleCount: 0,
    zeroDamageBattles: 0,
    survivedBattles: 0,
  };
}

function isLateSingleAttackBattle(
  outcome: BotOnlyBaselineBattleUnitOutcome,
): boolean {
  const attackCount = outcome.attackCount ?? 0;
  const hitCount = outcome.hitCount ?? 0;
  if (attackCount !== 1 || hitCount <= 0 || typeof outcome.firstAttackAtMs !== "number") {
    return false;
  }

  const battleDurationMs = Math.max(0, outcome.battleDurationMs ?? outcome.lifetimeMs ?? 0);
  if (battleDurationMs <= 0) {
    return false;
  }

  return outcome.firstAttackAtMs / battleDurationMs >= LATE_SINGLE_ATTACK_THRESHOLD_RATIO;
}

function buildRangeActionDiagnosticsMetric(
  entry: RangeActionDiagnosticsAccumulator,
): BotOnlyBaselineRangeActionDiagnosticsMetric {
  return {
    side: entry.side,
    rangeBand: entry.rangeBand,
    battleAppearances: entry.battleAppearances,
    movedBattleRate: entry.battleAppearances > 0
      ? entry.movedBattles / entry.battleAppearances
      : 0,
    averageMoveCountPerBattle: entry.battleAppearances > 0
      ? entry.totalMoveCount / entry.battleAppearances
      : 0,
    averageFirstMoveMs: entry.firstMoveSamples > 0
      ? entry.totalFirstMoveMs / entry.firstMoveSamples
      : null,
    firstMoveSamples: entry.firstMoveSamples,
    averageMoveToFirstAttackMs: entry.moveToFirstAttackSamples > 0
      ? entry.totalMoveToFirstAttackMs / entry.moveToFirstAttackSamples
      : null,
    moveToFirstAttackSamples: entry.moveToFirstAttackSamples,
    repositionBattleRate: entry.battleAppearances > 0
      ? entry.repositionBattles / entry.battleAppearances
      : 0,
    averageRepositionMoveCountPerBattle: entry.battleAppearances > 0
      ? entry.totalRepositionMoveCount / entry.battleAppearances
      : 0,
    reachedAttackRangeBattleRate: entry.battleAppearances > 0
      ? entry.reachedAttackRangeBattles / entry.battleAppearances
      : 0,
    noAttackDespiteReachingRangeBattleRate: entry.battleAppearances > 0
      ? entry.noAttackDespiteReachingRangeBattles / entry.battleAppearances
      : 0,
    noAttackWithoutReachingRangeBattleRate: entry.battleAppearances > 0
      ? entry.noAttackWithoutReachingRangeBattles / entry.battleAppearances
      : 0,
    averageInitialNearestEnemyDistance: entry.initialNearestEnemyDistanceSamples > 0
      ? entry.totalInitialNearestEnemyDistance / entry.initialNearestEnemyDistanceSamples
      : null,
    averageBestNearestEnemyDistance: entry.bestNearestEnemyDistanceSamples > 0
      ? entry.totalBestNearestEnemyDistance / entry.bestNearestEnemyDistanceSamples
      : null,
    averageDistanceClosed: entry.distanceClosedSamples > 0
      ? entry.totalDistanceClosed / entry.distanceClosedSamples
      : null,
    noAttackBattleRate: entry.battleAppearances > 0
      ? entry.noAttackBattles / entry.battleAppearances
      : 0,
    movedNoAttackBattleRate: entry.battleAppearances > 0
      ? entry.movedNoAttackBattles / entry.battleAppearances
      : 0,
    attackedNoHitBattleRate: entry.battleAppearances > 0
      ? entry.attackedNoHitBattles / entry.battleAppearances
      : 0,
    lateSingleAttackBattleRate: entry.battleAppearances > 0
      ? entry.lateSingleAttackBattles / entry.battleAppearances
      : 0,
    moveTargetDiagnosticSampleCount: entry.moveTargetDiagnosticSampleCount,
    suboptimalMoveTargetRate: entry.moveTargetDiagnosticSampleCount > 0
      ? entry.suboptimalMoveTargetCount / entry.moveTargetDiagnosticSampleCount
      : null,
    averageExcessApproachSteps: entry.excessApproachStepSamples > 0
      ? entry.totalExcessApproachSteps / entry.excessApproachStepSamples
      : null,
    averageOutsideAttackRangeBeforeFirstAttackMs: entry.battleAppearances > 0
      ? entry.totalOutsideAttackRangeBeforeFirstAttackMs / entry.battleAppearances
      : null,
    averageInAttackRangeBeforeFirstAttackMs: entry.battleAppearances > 0
      ? entry.totalInAttackRangeBeforeFirstAttackMs / entry.battleAppearances
      : null,
    averageAfterFirstAttackMs: entry.battleAppearances > 0
      ? entry.totalAfterFirstAttackMs / entry.battleAppearances
      : null,
    averageFirstReachedAttackRangeAtMs: entry.firstReachedAttackRangeSamples > 0
      ? entry.totalFirstReachedAttackRangeAtMs / entry.firstReachedAttackRangeSamples
      : null,
    firstReachedAttackRangeSamples: entry.firstReachedAttackRangeSamples,
    averageLeftLateralMovesPerBattle: entry.battleAppearances > 0
      ? entry.totalLeftLateralMoveCount / entry.battleAppearances
      : 0,
    averageRightLateralMovesPerBattle: entry.battleAppearances > 0
      ? entry.totalRightLateralMoveCount / entry.battleAppearances
      : 0,
    firstLateralMoveLeftRate: entry.firstLateralMoveSamples > 0
      ? entry.firstLateralMoveLeftBattles / entry.firstLateralMoveSamples
      : null,
    firstLateralMoveRightRate: entry.firstLateralMoveSamples > 0
      ? entry.firstLateralMoveRightBattles / entry.firstLateralMoveSamples
      : null,
    firstLateralMoveSamples: entry.firstLateralMoveSamples,
    sharedPursuitMoveSampleCount: entry.sharedPursuitMoveSampleCount,
    contestedPursuitMoveRate: entry.sharedPursuitMoveSampleCount > 0
      ? entry.contestedPursuitMoveSampleCount / entry.sharedPursuitMoveSampleCount
      : null,
    plannedApproachGroupMoveSampleCount: entry.plannedApproachGroupMoveSampleCount,
    averagePlannedApproachGroupCompetitorCount: entry.plannedApproachGroupMoveSampleCount > 0
      ? entry.totalPlannedApproachGroupCompetitorCount / entry.plannedApproachGroupMoveSampleCount
      : null,
    averagePlannedApproachGroupAssignedCount: entry.plannedApproachGroupMoveSampleCount > 0
      ? entry.totalPlannedApproachGroupAssignedCount / entry.plannedApproachGroupMoveSampleCount
      : null,
    oversubscribedPlannedApproachGroupRate: entry.plannedApproachGroupMoveSampleCount > 0
      ? entry.oversubscribedPlannedApproachGroupMoveCount / entry.plannedApproachGroupMoveSampleCount
      : null,
    plannedApproachBattleCount: entry.plannedApproachBattleCount,
    plannedApproachMoveSampleCount: entry.plannedApproachMoveSampleCount,
    plannedApproachStillOpenRate: entry.plannedApproachMoveSampleCount > 0
      ? entry.plannedApproachStillOpenMoveCount / entry.plannedApproachMoveSampleCount
      : null,
    usedPlannedApproachRate: entry.plannedApproachMoveSampleCount > 0
      ? entry.usedPlannedApproachMoveCount / entry.plannedApproachMoveSampleCount
      : null,
    plannedApproachPathBlockedRate: entry.plannedApproachMoveSampleCount > 0
      ? entry.plannedApproachPathBlockedMoveCount / entry.plannedApproachMoveSampleCount
      : null,
    plannedApproachFirstAttackRate: entry.plannedApproachBattleCount > 0
      ? entry.plannedApproachWithFirstAttackCount / entry.plannedApproachBattleCount
      : null,
    plannedApproachMatchedFirstAttackTargetRate: entry.plannedApproachBattleCount > 0
      ? entry.plannedApproachMatchedFirstAttackTargetCount / entry.plannedApproachBattleCount
      : null,
    plannedApproachReachedRangeWithoutAttackRate: entry.plannedApproachBattleCount > 0
      ? entry.plannedApproachReachedRangeWithoutAttackCount / entry.plannedApproachBattleCount
      : null,
    plannedApproachNoReachNoAttackRate: entry.plannedApproachBattleCount > 0
      ? entry.plannedApproachNoReachNoAttackCount / entry.plannedApproachBattleCount
      : null,
    plannedApproachNoAttackTargetDiedBeforeBattleEndRate: entry.plannedApproachBattleCount > 0
      ? entry.plannedApproachNoAttackTargetDiedBeforeBattleEndCount / entry.plannedApproachBattleCount
      : null,
    plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate: entry.plannedApproachBattleCount > 0
      ? entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount / entry.plannedApproachBattleCount
      : null,
    plannedApproachNoReachNoAttackWhileTargetAliveRate: entry.plannedApproachBattleCount > 0
      ? entry.plannedApproachNoReachNoAttackWhileTargetAliveCount / entry.plannedApproachBattleCount
      : null,
    plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate:
      entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount
          / entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount
        : null,
    plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate:
      entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount
          / entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
    plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate:
      entry.plannedApproachNoReachNoAttackWhileTargetAliveCount > 0
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount
          / entry.plannedApproachNoReachNoAttackWhileTargetAliveCount
        : null,
  };
}

function buildRangeFormationDiagnosticsMetric(
  entry: RangeFormationDiagnosticsAccumulator,
): BotOnlyBaselineRangeFormationDiagnosticsMetric {
  return {
    side: entry.side,
    rangeBand: entry.rangeBand,
    battleAppearances: entry.battleAppearances,
    frontAllyBlockedBattleRate:
      entry.battleAppearances > 0 ? entry.frontAllyBlockedBattles / entry.battleAppearances : 0,
    averageFrontAllyCount:
      entry.frontAllyCountSamples > 0 ? entry.totalFrontAllyCount / entry.frontAllyCountSamples : null,
    averageInitialRow:
      entry.initialRowSamples > 0 ? entry.totalInitialRow / entry.initialRowSamples : null,
    averageInitialColumn:
      entry.initialColumnSamples > 0 ? entry.totalInitialColumn / entry.initialColumnSamples : null,
    zeroDamageBattleRateWithFrontAlly:
      entry.withFrontAllySamples > 0 ? entry.zeroDamageWithFrontAllyBattles / entry.withFrontAllySamples : null,
    zeroDamageBattleRateWithoutFrontAlly:
      entry.withoutFrontAllySamples > 0 ? entry.zeroDamageWithoutFrontAllyBattles / entry.withoutFrontAllySamples : null,
    noAttackBattleRateWithFrontAlly:
      entry.withFrontAllySamples > 0 ? entry.noAttackWithFrontAllyBattles / entry.withFrontAllySamples : null,
    noAttackBattleRateWithoutFrontAlly:
      entry.withoutFrontAllySamples > 0 ? entry.noAttackWithoutFrontAllyBattles / entry.withoutFrontAllySamples : null,
  };
}

function buildRaidMeleeCohortMetric(
  entry: RaidMeleeCohortAccumulator,
): BotOnlyBaselineRaidMeleeCohortMetric {
  return {
    cohort: entry.cohort,
    battleAppearances: entry.battleAppearances,
    averageDamagePerBattle: entry.battleAppearances > 0
      ? entry.totalDamage / entry.battleAppearances
      : 0,
    averageAttackCountPerBattle: entry.battleAppearances > 0
      ? entry.totalAttackCount / entry.battleAppearances
      : 0,
    averageFirstAttackMs: entry.firstAttackSamples > 0
      ? entry.totalFirstAttackMs / entry.firstAttackSamples
      : null,
    averageLifetimeMs: entry.battleAppearances > 0
      ? entry.totalLifetimeMs / entry.battleAppearances
      : 0,
    zeroDamageBattleRate: entry.battleAppearances > 0
      ? entry.zeroDamageBattles / entry.battleAppearances
      : 0,
    survivalRate: entry.battleAppearances > 0
      ? entry.survivedBattles / entry.battleAppearances
      : 0,
  };
}

function buildRaidSpecialMeleeUnitDiagnostic(
  entry: RaidSpecialMeleeUnitDiagnosticAccumulator,
): BotOnlyBaselineRaidSpecialMeleeUnitDiagnostic {
  return {
    unitId: entry.unitId,
    unitName: entry.unitName,
    battleAppearances: entry.battleAppearances,
    averageDamagePerBattle: entry.battleAppearances > 0
      ? entry.totalDamage / entry.battleAppearances
      : 0,
    averageAttackCountPerBattle: entry.battleAppearances > 0
      ? entry.totalAttackCount / entry.battleAppearances
      : 0,
    averageFirstAttackMs: entry.firstAttackSamples > 0
      ? entry.totalFirstAttackMs / entry.firstAttackSamples
      : null,
    firstAttackSamples: entry.firstAttackSamples,
    averageFirstReachedAttackRangeAtMs: entry.firstReachedAttackRangeSamples > 0
      ? entry.totalFirstReachedAttackRangeAtMs / entry.firstReachedAttackRangeSamples
      : null,
    firstReachedAttackRangeSamples: entry.firstReachedAttackRangeSamples,
    noAttackWithoutReachingRangeBattleRate: entry.battleAppearances > 0
      ? entry.noAttackWithoutReachingRangeBattles / entry.battleAppearances
      : 0,
    noAttackDespiteReachingRangeBattleRate: entry.battleAppearances > 0
      ? entry.noAttackDespiteReachingRangeBattles / entry.battleAppearances
      : 0,
    contestedPursuitMoveRate: entry.sharedPursuitMoveSampleCount > 0
      ? entry.contestedPursuitMoveSampleCount / entry.sharedPursuitMoveSampleCount
      : null,
    sharedPursuitMoveSampleCount: entry.sharedPursuitMoveSampleCount,
    zeroDamageBattleRate: entry.battleAppearances > 0
      ? entry.zeroDamageBattles / entry.battleAppearances
      : 0,
    survivalRate: entry.battleAppearances > 0
      ? entry.survivedBattles / entry.battleAppearances
      : 0,
  };
}

function buildBattleUnitMetrics(
  entry: BattleUnitAggregateAccumulator,
  completedMatches: number,
): BotOnlyBaselineBattleUnitMetrics {
  const hostedSubUnitMatchesPresent = entry.hostedSubUnitMatchesPresent ?? 0;
  return {
    unitId: entry.unitId,
    unitType: entry.unitType,
    unitName: entry.unitName,
    battleAppearances: entry.battleAppearances,
    matchesPresent: entry.matchesPresent,
    averageunitLevel: divideOrZero(entry.totalunitLevel, entry.battleAppearances),
    maxUnitLevel: entry.maxUnitLevel,
    level4ReachRate: entry.matchesPresent > 0
      ? entry.level4Matches / entry.matchesPresent
      : 0,
    level7ReachRate: entry.matchesPresent > 0
      ? entry.level7Matches / entry.matchesPresent
      : 0,
    averageDamagePerBattle: divideOrZero(entry.totalDamage, entry.battleAppearances),
    averageDamagePerMatch: entry.totalDamage / completedMatches,
    activeBattleRate: divideOrZero(entry.activeBattles, entry.battleAppearances),
    averageAttackCountPerBattle: divideOrZero(entry.totalAttackCount, entry.battleAppearances),
    averageHitCountPerBattle: divideOrZero(entry.totalHitCount, entry.battleAppearances),
    averageDamageTakenPerBattle: divideOrZero(entry.totalDamageTaken, entry.battleAppearances),
    averageFirstAttackMs: entry.firstAttackSamples > 0
      ? entry.totalFirstAttackMs / entry.firstAttackSamples
      : null,
    averageLifetimeMs: divideOrZero(entry.totalLifetimeMs, entry.battleAppearances),
    zeroDamageBattleRate: divideOrZero(entry.zeroDamageBattles, entry.battleAppearances),
    survivalRate: divideOrZero(entry.survivedBattles, entry.battleAppearances),
    ownerWinRate: divideOrZero(entry.ownerWins, entry.battleAppearances),
    adoptionRate: entry.matchesPresent / completedMatches,
    ...(entry.totalBasicSkillActivations > 0
      ? {
        averageBasicSkillActivationsPerBattle:
          entry.totalBasicSkillActivations / entry.battleAppearances,
      }
      : {}),
    ...(entry.totalPairSkillActivations > 0
      ? {
        averagePairSkillActivationsPerBattle:
          entry.totalPairSkillActivations / entry.battleAppearances,
      }
      : {}),
    ...(typeof entry.subUnitBattleAppearances === "number"
      ? { subUnitBattleAppearances: entry.subUnitBattleAppearances }
      : {}),
    ...(typeof entry.subUnitMatchesPresent === "number"
      ? {
        subUnitMatchesPresent: entry.subUnitMatchesPresent,
        subUnitAdoptionRate: entry.subUnitMatchesPresent / completedMatches,
      }
      : {}),
    ...((entry.hostedSubUnitBattleAppearances ?? 0) > 0
      ? { hostedSubUnitBattleAppearances: entry.hostedSubUnitBattleAppearances }
      : {}),
    ...(hostedSubUnitMatchesPresent > 0
      ? {
        hostedSubUnitMatchesPresent,
        hostedSubUnitAdoptionRate: hostedSubUnitMatchesPresent / completedMatches,
      }
      : {}),
  };
}

function buildOkinaSubHostMetric(
  entry: OkinaSubHostAccumulator,
): BotOnlyBaselineOkinaSubHostMetric {
  return {
    hostUnitId: entry.hostUnitId,
    hostUnitType: entry.hostUnitType,
    hostUnitName: entry.hostUnitName,
    battleAppearances: entry.battleAppearances,
    matchesPresent: entry.matchesPresent,
    averageHostLevel: divideOrZero(entry.totalHostLevel, entry.battleAppearances),
    averageDamagePerBattle: divideOrZero(entry.totalDamage, entry.battleAppearances),
    averageDamageTakenPerBattle: divideOrZero(entry.totalDamageTaken, entry.battleAppearances),
    averageLifetimeMs: divideOrZero(entry.totalLifetimeMs, entry.battleAppearances),
    survivalRate: divideOrZero(entry.survivedBattles, entry.battleAppearances),
    ownerWinRate: divideOrZero(entry.ownerWins, entry.battleAppearances),
  };
}

function buildOkinaSubHostRoundMetric(
  entry: OkinaSubHostRoundAccumulator,
): BotOnlyBaselineOkinaSubHostRoundMetric {
  return {
    roundIndex: entry.roundIndex,
    ...buildOkinaSubHostMetric(entry),
  };
}

function buildOkinaHeroSubDecisionRoundMetric(
  entry: OkinaHeroSubDecisionRoundAccumulator,
): BotOnlyBaselineOkinaHeroSubDecisionRoundMetric {
  const mostFrequentBestHost = Array.from(entry.bestHostSamplesById.values())
    .sort((left, right) => right.samples - left.samples || left.unitId.localeCompare(right.unitId))[0] ?? null;

  return {
    roundIndex: entry.roundIndex,
    samples: entry.samples,
    actionRecommendedSamples: entry.actionRecommendedSamples,
    noCandidateSamples: entry.noCandidateSamples,
    frontValuePreferredSamples: entry.frontValuePreferredSamples,
    currentHostKeptSamples: entry.currentHostKeptSamples,
    averageCandidateCount: divideOrZero(entry.totalCandidateCount, entry.samples),
    averageFrontEquivalentValue: divideOrZero(entry.totalFrontEquivalentValue, entry.samples),
    averageBestHostGain: entry.bestHostGainSamples > 0
      ? entry.totalBestHostGain / entry.bestHostGainSamples
      : null,
    averageBestHostCurrentPowerScore: entry.bestHostOptimizationSamples > 0
      ? entry.totalBestHostCurrentPowerScore / entry.bestHostOptimizationSamples
      : null,
    averageBestHostFutureValueScore: entry.bestHostOptimizationSamples > 0
      ? entry.totalBestHostFutureValueScore / entry.bestHostOptimizationSamples
      : null,
    averageBestHostTransitionReadinessScore: entry.bestHostOptimizationSamples > 0
      ? entry.totalBestHostTransitionReadinessScore / entry.bestHostOptimizationSamples
      : null,
    averageBestHostProtectionScore: entry.bestHostOptimizationSamples > 0
      ? entry.totalBestHostProtectionScore / entry.bestHostOptimizationSamples
      : null,
    averageBestToFrontRatio: entry.bestToFrontRatioSamples > 0
      ? entry.totalBestToFrontRatio / entry.bestToFrontRatioSamples
      : null,
    mostFrequentBestHostUnitId: mostFrequentBestHost?.unitId ?? null,
    mostFrequentBestHostUnitName: mostFrequentBestHost?.unitName ?? null,
    mostFrequentBestHostSamples: mostFrequentBestHost?.samples ?? 0,
  };
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * ratio)),
  );
  return sorted[index] ?? null;
}

function buildBoardRefitDecisionMetricFields(
  entry: Omit<BoardRefitDecisionRoundAccumulator, "roundIndex">,
): Omit<BotOnlyBaselineBoardRefitDecisionRoundMetric, "roundIndex"> {
  const mostFrequentIncoming = Array.from(entry.incomingSamplesById.values())
    .sort((left, right) => right.samples - left.samples || left.unitId.localeCompare(right.unitId))[0] ?? null;
  const mostFrequentOutgoing = Array.from(entry.outgoingSamplesById.values())
    .sort((left, right) => right.samples - left.samples || left.unitId.localeCompare(right.unitId))[0] ?? null;

  return {
    samples: entry.samples,
    boardFullSamples: entry.boardFullSamples,
    attemptSamples: entry.attemptSamples,
    recommendedReplacementSamples: entry.recommendedReplacementSamples,
    committedSamples: entry.committedSamples,
    futureCandidateKeptCount: entry.futureCandidateKeptCount,
    averageBenchPressure: divideOrZero(entry.totalBenchPressure, entry.samples),
    averageReplacementScore: entry.replacementScores.length > 0
      ? entry.replacementScores.reduce((sum, score) => sum + score, 0) / entry.replacementScores.length
      : null,
    p25ReplacementScore: percentile(entry.replacementScores, 0.25),
    p50ReplacementScore: percentile(entry.replacementScores, 0.5),
    p75ReplacementScore: percentile(entry.replacementScores, 0.75),
    mostFrequentIncomingUnitId: mostFrequentIncoming?.unitId ?? null,
    mostFrequentIncomingUnitName: mostFrequentIncoming?.unitName ?? null,
    mostFrequentIncomingSamples: mostFrequentIncoming?.samples ?? 0,
    mostFrequentOutgoingUnitId: mostFrequentOutgoing?.unitId ?? null,
    mostFrequentOutgoingUnitName: mostFrequentOutgoing?.unitName ?? null,
    mostFrequentOutgoingSamples: mostFrequentOutgoing?.samples ?? 0,
  };
}

function buildBoardRefitDecisionRoundMetric(
  entry: BoardRefitDecisionRoundAccumulator,
): BotOnlyBaselineBoardRefitDecisionRoundMetric {
  return {
    roundIndex: entry.roundIndex,
    ...buildBoardRefitDecisionMetricFields(entry),
  };
}

function buildBoardRefitDecisionRoleMetric(
  entry: BoardRefitDecisionRoleAccumulator,
): BotOnlyBaselineBoardRefitDecisionRoleMetric {
  return {
    role: entry.role,
    ...buildBoardRefitDecisionMetricFields(entry),
  };
}

function buildBoardRefitDecisionRoleRoundMetric(
  entry: BoardRefitDecisionRoleRoundAccumulator,
): BotOnlyBaselineBoardRefitDecisionRoleRoundMetric {
  return {
    role: entry.role,
    roundIndex: entry.roundIndex,
    ...buildBoardRefitDecisionMetricFields(entry),
  };
}

function buildFinalPlayerBoardMetric(
  entry: FinalPlayerBoardAccumulator,
): BotOnlyBaselineFinalPlayerBoardMetric {
  return {
    label: entry.label,
    role: entry.role,
    matchesPresent: entry.matchesPresent,
    averageDeployedUnitCount: divideOrZero(entry.totalDeployedUnitCount, entry.matchesPresent),
    averageDeployedAssetValue: divideOrZero(entry.totalDeployedAssetValue, entry.matchesPresent),
    averageSpecialUnitCount: divideOrZero(entry.totalSpecialUnitCount, entry.matchesPresent),
    averageStandardUnitCount: divideOrZero(entry.totalStandardUnitCount, entry.matchesPresent),
  };
}

function recordUnitSample(
  samplesById: Map<string, { unitId: string; unitName: string; samples: number }>,
  unitId: string | null,
  unitName: string | null,
): void {
  if (unitId === null || unitId.length === 0) {
    return;
  }

  const existing = samplesById.get(unitId) ?? {
    unitId,
    unitName: unitName ?? resolveBaselineUnitName(unitId, unitId),
    samples: 0,
  };
  existing.samples += 1;
  samplesById.set(unitId, existing);
}

function recordBoardRefitDecisionSnapshot(
  snapshot: BotOnlyBaselineBoardRefitDecisionSnapshot,
  decisionsByRound: Map<number, BoardRefitDecisionRoundAccumulator>,
  decisionsByRole?: Map<"boss" | "raid", BoardRefitDecisionRoleAccumulator>,
  decisionsByRoleRound?: Map<string, BoardRefitDecisionRoleRoundAccumulator>,
): void {
  const entry = decisionsByRound.get(snapshot.roundIndex)
    ?? createBoardRefitDecisionRoundAccumulator(snapshot.roundIndex);
  recordBoardRefitDecisionAccumulatorSample(entry, snapshot);
  decisionsByRound.set(snapshot.roundIndex, entry);

  if (decisionsByRole !== undefined) {
    const roleEntry = decisionsByRole.get(snapshot.role)
      ?? createBoardRefitDecisionRoleAccumulator(snapshot.role);
    recordBoardRefitDecisionAccumulatorSample(roleEntry, snapshot);
    decisionsByRole.set(snapshot.role, roleEntry);
  }

  if (decisionsByRoleRound !== undefined) {
    const key = `${snapshot.role}:${snapshot.roundIndex}`;
    const roleRoundEntry = decisionsByRoleRound.get(key)
      ?? createBoardRefitDecisionRoleRoundAccumulator(snapshot.role, snapshot.roundIndex);
    recordBoardRefitDecisionAccumulatorSample(roleRoundEntry, snapshot);
    decisionsByRoleRound.set(key, roleRoundEntry);
  }
}

function recordBoardRefitDecisionAccumulatorSample(
  entry: Omit<BoardRefitDecisionRoundAccumulator, "roundIndex">,
  snapshot: BotOnlyBaselineBoardRefitDecisionSnapshot,
): void {
  entry.samples += 1;
  entry.boardFullSamples += snapshot.boardAtCapacity ? 1 : 0;
  entry.attemptSamples += snapshot.incomingUnitId !== null && snapshot.outgoingUnitId !== null ? 1 : 0;
  entry.recommendedReplacementSamples += snapshot.decision === "replace" ? 1 : 0;
  entry.committedSamples += snapshot.committed === true ? 1 : 0;
  entry.futureCandidateKeptCount += snapshot.decision === "hold" && snapshot.incomingReason === "future_candidate" ? 1 : 0;
  entry.totalBenchPressure += snapshot.benchPressure;
  if (snapshot.replacementScore !== null) {
    entry.replacementScores.push(snapshot.replacementScore);
  }
  recordUnitSample(entry.incomingSamplesById, snapshot.incomingUnitId, null);
  recordUnitSample(entry.outgoingSamplesById, snapshot.outgoingUnitId, null);
}

function mergeBoardRefitDecisionMetricIntoAccumulator(
  entry: Omit<BotOnlyBaselineBoardRefitDecisionRoundMetric, "roundIndex">,
  existing: Omit<BoardRefitDecisionRoundAccumulator, "roundIndex">,
): void {
  existing.samples += entry.samples;
  existing.boardFullSamples += entry.boardFullSamples;
  existing.attemptSamples += entry.attemptSamples;
  existing.recommendedReplacementSamples += entry.recommendedReplacementSamples;
  existing.committedSamples += entry.committedSamples;
  existing.futureCandidateKeptCount += entry.futureCandidateKeptCount;
  existing.totalBenchPressure += entry.averageBenchPressure * entry.samples;
  for (const score of [
    entry.p25ReplacementScore,
    entry.p50ReplacementScore,
    entry.p75ReplacementScore,
  ]) {
    if (score !== null) {
      existing.replacementScores.push(score);
    }
  }
  if (entry.mostFrequentIncomingUnitId !== null) {
    const incoming = existing.incomingSamplesById.get(entry.mostFrequentIncomingUnitId) ?? {
      unitId: entry.mostFrequentIncomingUnitId,
      unitName: entry.mostFrequentIncomingUnitName ?? entry.mostFrequentIncomingUnitId,
      samples: 0,
    };
    incoming.samples += entry.mostFrequentIncomingSamples;
    existing.incomingSamplesById.set(entry.mostFrequentIncomingUnitId, incoming);
  }
  if (entry.mostFrequentOutgoingUnitId !== null) {
    const outgoing = existing.outgoingSamplesById.get(entry.mostFrequentOutgoingUnitId) ?? {
      unitId: entry.mostFrequentOutgoingUnitId,
      unitName: entry.mostFrequentOutgoingUnitName ?? entry.mostFrequentOutgoingUnitId,
      samples: 0,
    };
    outgoing.samples += entry.mostFrequentOutgoingSamples;
    existing.outgoingSamplesById.set(entry.mostFrequentOutgoingUnitId, outgoing);
  }
}

function recordOkinaHeroSubDecisionSnapshot(
  snapshot: BotOnlyBaselineOkinaHeroSubDecisionSnapshot,
  decisionsByRound: Map<number, OkinaHeroSubDecisionRoundAccumulator>,
): void {
  const entry = decisionsByRound.get(snapshot.roundIndex)
    ?? createOkinaHeroSubDecisionRoundAccumulator(snapshot.roundIndex);
  entry.samples += 1;
  entry.actionRecommendedSamples +=
    snapshot.decision === "attach" || snapshot.decision === "reattach" ? 1 : 0;
  entry.noCandidateSamples += snapshot.reason === "no_candidate" ? 1 : 0;
  entry.frontValuePreferredSamples += snapshot.reason === "front_value_preferred" ? 1 : 0;
  const keptCurrentHost =
    snapshot.reason === "current_host_margin_preferred"
    || snapshot.reason === "current_host_only";
  entry.currentHostKeptSamples += keptCurrentHost ? 1 : 0;
  entry.totalCandidateCount += snapshot.candidateCount;
  entry.totalFrontEquivalentValue += snapshot.frontEquivalentValue;

  if (snapshot.bestHostGain !== null) {
    entry.totalBestHostGain += snapshot.bestHostGain;
    entry.bestHostGainSamples += 1;
  }

  if (
    snapshot.bestHostCurrentPowerScore !== null
    && snapshot.bestHostCurrentPowerScore !== undefined
    && snapshot.bestHostFutureValueScore !== null
    && snapshot.bestHostFutureValueScore !== undefined
    && snapshot.bestHostTransitionReadinessScore !== null
    && snapshot.bestHostTransitionReadinessScore !== undefined
    && snapshot.bestHostProtectionScore !== null
    && snapshot.bestHostProtectionScore !== undefined
  ) {
    entry.totalBestHostCurrentPowerScore += snapshot.bestHostCurrentPowerScore;
    entry.totalBestHostFutureValueScore += snapshot.bestHostFutureValueScore;
    entry.totalBestHostTransitionReadinessScore += snapshot.bestHostTransitionReadinessScore;
    entry.totalBestHostProtectionScore += snapshot.bestHostProtectionScore;
    entry.bestHostOptimizationSamples += 1;
  }

  if (snapshot.bestToFrontRatio !== null) {
    entry.totalBestToFrontRatio += snapshot.bestToFrontRatio;
    entry.bestToFrontRatioSamples += 1;
  }

  if (snapshot.bestHostUnitId !== null) {
    const existing = entry.bestHostSamplesById.get(snapshot.bestHostUnitId) ?? {
      unitId: snapshot.bestHostUnitId,
      unitName: snapshot.bestHostUnitName ?? snapshot.bestHostUnitId,
      samples: 0,
    };
    existing.samples += 1;
    entry.bestHostSamplesById.set(snapshot.bestHostUnitId, existing);
  }

  decisionsByRound.set(snapshot.roundIndex, entry);
}

export function buildBotOnlyBaselineAggregateReport(
  reports: BotOnlyBaselineMatchSummary[],
  requestedMatchCount = reports.length,
): BotOnlyBaselineAggregateReport {
  const completedMatches = reports.length;
  if (completedMatches === 0) {
    return {
      requestedMatchCount,
      completedMatches: 0,
      abortedMatches: requestedMatchCount,
      bossWins: 0,
      raidWins: 0,
      bossWinRate: 0,
      raidWinRate: 0,
      averageRounds: 0,
      minRounds: 0,
      maxRounds: 0,
      averageRemainingRaidPlayers: 0,
      battleMetrics: buildEmptyBattleMetrics(),
      roundHistogram: {},
      playerMetrics: {},
      heroTeamMetrics: [],
      heroCompositionMetrics: [],
      playerEconomyBreakdowns: {},
      bossBattleUnitMetrics: [],
      raidBattleUnitMetrics: [],
      finalBoardUnitMetrics: [],
      topDamageUnits: [],
      highCostSummary: buildEmptyHighCostSummary(),
      highCostOfferMetrics: [],
      shopOfferMetrics: [],
      bossExclusiveRoundLevelMetrics: [],
      highCostRoundMetrics: [],
      roundDamageEfficiencyMetrics: [],
      unitDamageEfficiencyMetrics: [],
      okinaSubHostMetrics: [],
      okinaSubHostRoundMetrics: [],
      okinaHeroSubDecisionRoundMetrics: [],
      boardRefitDecisionRoundMetrics: [],
      boardRefitDecisionRoleMetrics: [],
      boardRefitDecisionRoleRoundMetrics: [],
      finalPlayerBoardMetrics: [],
      roundSurvivalDiagnostics: [],
      roundUnitSurvivalDiagnostics: [],
      rangeDamageEfficiencyMetrics: [],
      rangeActionDiagnosticsMetrics: [],
      rangeFormationDiagnosticsMetrics: [],
      raidMeleeCohortMetrics: [],
      raidSpecialMeleeUnitDiagnostics: [],
      roundDetails: [],
    };
  }

  let bossWins = 0;
  let totalRounds = 0;
  let totalRemainingRaidPlayers = 0;
  let totalBattles = 0;
  let totalBossSurvivorsAtBattleEnd = 0;
  let totalRaidSurvivorsAtBattleEnd = 0;
  let bothSidesSurvivedBattles = 0;
  let bossWipedBattles = 0;
  let raidWipedBattles = 0;
  let minRounds = Number.POSITIVE_INFINITY;
  let maxRounds = 0;
  let sharedMetadata = reports[0]?.metadata;
  const battleEndReasonCounts = createEmptyBattleEndReasonCounts();
  const roundHistogram = new Map<number, number>();
  const labelAppearanceCounts = new Map<string, number>();
  const placementTotalsByLabel = new Map<string, number>();
  const firstPlaceCountsByLabel = new Map<string, number>();
  const hpTotalsByLabel = new Map<string, number>();
  const finalGoldTotalsByLabel = new Map<string, number>();
  const goldEarnedTotalsByLabel = new Map<string, number>();
  const goldSpentTotalsByLabel = new Map<string, number>();
  const economyBreakdownTotalsByLabel = new Map<string, BotOnlyBaselinePlayerEconomyBreakdown>();
  const purchaseCountTotalsByLabel = new Map<string, number>();
  const refreshCountTotalsByLabel = new Map<string, number>();
  const sellCountTotalsByLabel = new Map<string, number>();
  const specialUnitUpgradeCountTotalsByLabel = new Map<string, number>();
  const remainingLivesTotalsByLabel = new Map<string, number>();
  const heroTeamMetricsById = new Map<string, HeroTeamAccumulator>();
  const heroCompositionMetricsByKey = new Map<string, HeroCompositionAccumulator>();
  const bossBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const raidBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const okinaSubHostsById = new Map<string, OkinaSubHostAccumulator>();
  const okinaSubHostsByRoundAndId = new Map<string, OkinaSubHostRoundAccumulator>();
  const okinaHeroSubDecisionsByRound = new Map<number, OkinaHeroSubDecisionRoundAccumulator>();
  const boardRefitDecisionsByRound = new Map<number, BoardRefitDecisionRoundAccumulator>();
  const boardRefitDecisionsByRole = new Map<"boss" | "raid", BoardRefitDecisionRoleAccumulator>();
  const boardRefitDecisionsByRoleRound = new Map<string, BoardRefitDecisionRoleRoundAccumulator>();
  const finalPlayerBoardMetricsByLabel = new Map<string, FinalPlayerBoardAccumulator>();
  const finalBoardUnitsById = new Map<string, {
    unitId: string;
    unitType: string;
    unitName: string;
    totalCopies: number;
    matchesPresent: number;
    totalUnitLevel: number;
    maxUnitLevel: number;
    level4Copies: number;
    level7Copies: number;
  }>();
  const finalBoardUnitsByRoleAndId = new Map<string, {
    unitId: string;
    unitType: string;
    unitName: string;
    totalCopies: number;
    matchesPresent: number;
  }>();
  const damageByUnit = new Map<string, {
    unitId: string;
    unitName: string;
    side: "boss" | "raid";
    totalDamage: number;
    appearances: number;
  }>();
  const highCostOfferMetricsByKey = new Map<string, {
    unitId: string;
    unitName: string;
    unitType: string;
    role: "boss" | "raid";
    source: "shop" | "bossShop";
    cost: number;
    observationCount: number;
    matchesPresent: number;
  }>();
  const shopOfferMetricsByKey = new Map<string, {
    unitId: string;
    unitName: string;
    unitType: string;
    role: "boss" | "raid";
    source: "shop" | "bossShop";
    cost: number;
    observationCount: number;
    matchesPresent: number;
    purchaseCount: number;
    purchaseMatchCount: number;
  }>();
  const roundDamageEfficiencyByKey = new Map<string, RoundDamageEfficiencyAccumulator>();
  const roundSurvivalDiagnosticsByRound = new Map<number, RoundSurvivalDiagnosticAccumulator>();
  const roundUnitSurvivalDiagnosticsByKey = new Map<string, RoundUnitSurvivalDiagnosticAccumulator>();
  const bossExclusiveRoundLevelByKey = new Map<string, BossExclusiveRoundLevelAccumulator>();
  const highCostRoundMetricsByKey = new Map<string, HighCostRoundAccumulator>();
  const rangeDamageEfficiencyByKey = new Map<string, RangeDamageEfficiencyAccumulator>();
  const rangeActionDiagnosticsByKey = new Map<string, RangeActionDiagnosticsAccumulator>();
  const rangeFormationDiagnosticsByKey = new Map<string, RangeFormationDiagnosticsAccumulator>();
  const raidMeleeCohortMetricsByKey = new Map<string, RaidMeleeCohortAccumulator>();
  const raidSpecialMeleeUnitDiagnosticsById = new Map<string, RaidSpecialMeleeUnitDiagnosticAccumulator>();
  const roundDetails: BotOnlyBaselineMatchRoundDetail[] = [];
  let highCostOfferObservationCount = 0;
  let highCostOfferMatchCount = 0;
  let highCostPurchaseCount = 0;
  let highCostPurchaseMatchCount = 0;
  let highCostFinalBoardCopies = 0;
  let highCostFinalBoardMatchCount = 0;

  for (const [matchIndex, report] of reports.entries()) {
    if (!areBotOnlyReportMetadataEqual(sharedMetadata, report.metadata)) {
      sharedMetadata = undefined;
    }
    const playerById = new Map(
      report.finalPlayers.map((player) => [player.playerId, player] as const),
    );
    recordHeroMatchMetrics(report, heroTeamMetricsById, heroCompositionMetricsByKey);
    roundDetails.push(...buildRoundDetailsForMatch(report, matchIndex));
    for (const snapshot of report.okinaHeroSubDecisionSnapshots ?? []) {
      recordOkinaHeroSubDecisionSnapshot(snapshot, okinaHeroSubDecisionsByRound);
    }
    for (const snapshot of report.boardRefitDecisionSnapshots ?? []) {
      recordBoardRefitDecisionSnapshot(
        snapshot,
        boardRefitDecisionsByRound,
        boardRefitDecisionsByRole,
        boardRefitDecisionsByRoleRound,
      );
    }
    const seenOkinaSubHostsByRoundInMatch = new Set<string>();
    for (const round of report.rounds ?? []) {
      const seenRoundDamageEfficiencyUnits = new Set<string>();
      const seenRoundUnitSurvivalUnits = new Set<string>();
      for (const battle of round.battles) {
        const winnerRole = resolveBattleWinnerRole(battle, playerById, report.bossPlayerId);
        const bossOutcomes = battle.unitOutcomes.filter((outcome) => outcome.side === "boss");
        const raidOutcomes = battle.unitOutcomes.filter((outcome) => outcome.side === "raid");
        const bossSurvivors = bossOutcomes.filter((outcome) => outcome.alive && outcome.finalHp > 0).length;
        const raidSurvivors = raidOutcomes.filter((outcome) => outcome.alive && outcome.finalHp > 0).length;
        const phaseSucceeded = round.phaseResult === "success"
          || (round.phaseHpTarget > 0 && round.phaseDamageDealt >= round.phaseHpTarget);
        const survivalDiagnostic = roundSurvivalDiagnosticsByRound.get(round.roundIndex)
          ?? createRoundSurvivalDiagnosticAccumulator(round.roundIndex);
        survivalDiagnostic.battleSamples += 1;
        survivalDiagnostic.totalBattleEndMs += Math.max(0, battle.battleDurationMs ?? 0);
        survivalDiagnostic.phaseSuccessBattles += phaseSucceeded ? 1 : 0;
        survivalDiagnostic.phaseSuccessWithBossWipeBattles += phaseSucceeded && bossSurvivors === 0 ? 1 : 0;
        survivalDiagnostic.phaseFailureWithRaidWipeBattles += !phaseSucceeded && raidSurvivors === 0 ? 1 : 0;
        survivalDiagnostic.bossWipedBattles += bossSurvivors === 0 ? 1 : 0;
        survivalDiagnostic.raidWipedBattles += raidSurvivors === 0 ? 1 : 0;
        survivalDiagnostic.bothSidesSurvivedBattles += bossSurvivors > 0 && raidSurvivors > 0 ? 1 : 0;
        survivalDiagnostic.totalBossStartUnitCount += bossOutcomes.length;
        survivalDiagnostic.totalBossSurvivors += bossSurvivors;
        survivalDiagnostic.totalBossFinalHp += bossOutcomes.reduce(
          (total, outcome) => total + Math.max(0, outcome.finalHp),
          0,
        );
        survivalDiagnostic.totalBossEstimatedMaxHp += bossOutcomes.reduce(
          (total, outcome) => total + resolveOutcomeEstimatedMaxHp(outcome),
          0,
        );
        survivalDiagnostic.totalRaidStartUnitCount += raidOutcomes.length;
        survivalDiagnostic.totalRaidSurvivors += raidSurvivors;
        survivalDiagnostic.totalRaidFinalHp += raidOutcomes.reduce(
          (total, outcome) => total + Math.max(0, outcome.finalHp),
          0,
        );
        survivalDiagnostic.totalRaidEstimatedMaxHp += raidOutcomes.reduce(
          (total, outcome) => total + resolveOutcomeEstimatedMaxHp(outcome),
          0,
        );
        roundSurvivalDiagnosticsByRound.set(round.roundIndex, survivalDiagnostic);

        for (const outcome of battle.unitOutcomes) {
          const resolvedUnitName = resolveBaselineUnitName(outcome.unitId, outcome.unitName);
          const resolvedUnitType = outcome.unitType ?? outcome.unitId;
          const key = `${round.roundIndex}::${outcome.side}::${outcome.unitId}`;
          const survivalUnit = roundUnitSurvivalDiagnosticsByKey.get(key)
            ?? createRoundUnitSurvivalDiagnosticAccumulator(
              round.roundIndex,
              outcome.side,
              outcome.unitId,
              resolvedUnitType,
              resolvedUnitName,
            );
          survivalUnit.battleAppearances += 1;
          survivalUnit.totalUnitLevel += outcome.unitLevel;
          survivalUnit.survivedBattles += outcome.alive && outcome.finalHp > 0 ? 1 : 0;
          survivalUnit.totalFinalHp += Math.max(0, outcome.finalHp);
          survivalUnit.totalEstimatedMaxHp += resolveOutcomeEstimatedMaxHp(outcome);
          survivalUnit.totalDamageTaken += Math.max(0, outcome.damageTaken ?? 0);
          survivalUnit.totalLifetimeMs += Math.max(0, outcome.lifetimeMs ?? 0);
          survivalUnit.totalDamage += outcome.totalDamage;
          survivalUnit.zeroDamageBattles += outcome.totalDamage <= 0 ? 1 : 0;
          const matchRoundSurvivalUnitKey = `${key}::${matchIndex}`;
          if (!seenRoundUnitSurvivalUnits.has(matchRoundSurvivalUnitKey)) {
            survivalUnit.matchesPresent += 1;
            seenRoundUnitSurvivalUnits.add(matchRoundSurvivalUnitKey);
          }
          roundUnitSurvivalDiagnosticsByKey.set(key, survivalUnit);

          if (outcome.side === "raid" && outcome.attachedSubUnitId === "okina") {
            const okinaRoundKey = `${round.roundIndex}::${outcome.unitId}`;
            const okinaHostRound = okinaSubHostsByRoundAndId.get(okinaRoundKey)
              ?? createOkinaSubHostRoundAccumulator(
                round.roundIndex,
                outcome.unitId,
                resolvedUnitType,
                resolvedUnitName,
              );
            okinaHostRound.battleAppearances += 1;
            okinaHostRound.totalHostLevel += outcome.unitLevel;
            okinaHostRound.totalDamage += outcome.totalDamage;
            okinaHostRound.totalDamageTaken += outcome.damageTaken ?? 0;
            okinaHostRound.totalLifetimeMs += outcome.lifetimeMs ?? outcome.battleDurationMs ?? 0;
            if (outcome.alive) {
              okinaHostRound.survivedBattles += 1;
            }
            if (winnerRole === outcome.side) {
              okinaHostRound.ownerWins += 1;
            }
            if (!seenOkinaSubHostsByRoundInMatch.has(okinaRoundKey)) {
              okinaHostRound.matchesPresent += 1;
              seenOkinaSubHostsByRoundInMatch.add(okinaRoundKey);
            }
            okinaSubHostsByRoundAndId.set(okinaRoundKey, okinaHostRound);
          }

          const existing = roundDamageEfficiencyByKey.get(key)
            ?? createRoundDamageEfficiencyAccumulator(
              round.roundIndex,
              outcome.side,
              outcome.unitId,
              resolvedUnitType,
              resolvedUnitName,
            );
          existing.battleAppearances += 1;
          existing.totalUnitLevel += outcome.unitLevel;
          existing.totalDamage += outcome.totalDamage;
          existing.totalInvestmentCost += resolveBattleUnitInvestmentCost(outcome);

          const matchRoundUnitKey = `${key}::${matchIndex}`;
          if (!seenRoundDamageEfficiencyUnits.has(matchRoundUnitKey)) {
            existing.matchesPresent += 1;
            seenRoundDamageEfficiencyUnits.add(matchRoundUnitKey);
          }
          roundDamageEfficiencyByKey.set(key, existing);

          if (outcome.side === "boss" && BOSS_EXCLUSIVE_UNIT_IDS.has(outcome.unitId)) {
            const bossExclusiveKey = `${round.roundIndex}::${outcome.unitId}`;
            const bossExclusive = bossExclusiveRoundLevelByKey.get(bossExclusiveKey)
              ?? createBossExclusiveRoundLevelAccumulator(
                round.roundIndex,
                outcome.unitId,
                resolvedUnitType,
                resolvedUnitName,
              );
            bossExclusive.battleAppearances += 1;
            bossExclusive.unitLevelSamples.push(outcome.unitLevel);
            bossExclusive.matchKeys.add(`${matchIndex}::${round.roundIndex}`);
            bossExclusiveRoundLevelByKey.set(bossExclusiveKey, bossExclusive);
          }

          const resolvedCost = resolveBoardUnitCost(outcome.unitId);
          if (resolvedCost !== null && resolvedCost >= HIGH_COST_THRESHOLD) {
            const highCostRole = outcome.side;
            const highCostSource = resolveHighCostRoundSource(highCostRole, outcome.unitId);
            const highCostRoundKey = `${round.roundIndex}::${highCostRole}::${highCostSource}::${outcome.unitId}`;
            const highCostRound = highCostRoundMetricsByKey.get(highCostRoundKey)
              ?? createHighCostRoundAccumulator(
                round.roundIndex,
                highCostRole,
                highCostSource,
                outcome.unitId,
                resolvedUnitType,
                resolvedUnitName,
                resolvedCost,
              );
            highCostRound.battleAppearances += 1;
            highCostRound.battleMatchKeys.add(`${matchIndex}::${round.roundIndex}`);
            highCostRoundMetricsByKey.set(highCostRoundKey, highCostRound);
          }
        }
      }
    }

    if (report.ranking[0] === report.bossPlayerId) {
      bossWins += 1;
    }

    totalRounds += report.totalRounds;
    minRounds = Math.min(minRounds, report.totalRounds);
    maxRounds = Math.max(maxRounds, report.totalRounds);
    roundHistogram.set(
      report.totalRounds,
      (roundHistogram.get(report.totalRounds) ?? 0) + 1,
    );

    const remainingRaidPlayers = report.finalPlayers.filter(
      (player) => player.role === "raid" && player.eliminated !== true,
    ).length;
    totalRemainingRaidPlayers += remainingRaidPlayers;

    for (const [rankIndex, playerId] of report.ranking.entries()) {
      const player = playerById.get(playerId);
      const label = player?.label ?? report.playerLabels[playerId] ?? playerId;
      placementTotalsByLabel.set(
        label,
        (placementTotalsByLabel.get(label) ?? 0) + rankIndex + 1,
      );
      labelAppearanceCounts.set(
        label,
        (labelAppearanceCounts.get(label) ?? 0) + 1,
      );
      if (rankIndex === 0) {
        firstPlaceCountsByLabel.set(label, (firstPlaceCountsByLabel.get(label) ?? 0) + 1);
      }
    }

    const seenBossBattleUnitsInMatch = new Set<string>();
    const seenRaidBattleUnitsInMatch = new Set<string>();
    const seenRaidSubUnitsInMatch = new Set<string>();
    const seenOkinaSubHostsInMatch = new Set<string>();
    const bossMaxUnitLevelByMatch = new Map<string, number>();
    const raidMaxUnitLevelByMatch = new Map<string, number>();
    const seenFinalBoardUnitsInMatch = new Set<string>();
    const seenFinalBoardUnitsByRoleInMatch = new Set<string>();
    let matchHasHighCostFinalBoardUnit = false;
    for (const player of report.finalPlayers) {
      hpTotalsByLabel.set(player.label, (hpTotalsByLabel.get(player.label) ?? 0) + player.hp);
      finalGoldTotalsByLabel.set(
        player.label,
        (finalGoldTotalsByLabel.get(player.label) ?? 0) + (player.gold ?? 0),
      );
      goldEarnedTotalsByLabel.set(
        player.label,
        (goldEarnedTotalsByLabel.get(player.label) ?? 0) + (player.totalGoldEarned ?? 0),
      );
      goldSpentTotalsByLabel.set(
        player.label,
        (goldSpentTotalsByLabel.get(player.label) ?? 0) + (player.totalGoldSpent ?? 0),
      );
      const economyBreakdown = economyBreakdownTotalsByLabel.get(player.label)
        ?? createEmptyPlayerEconomyBreakdown();
      addPlayerEconomyBreakdown(
        economyBreakdown,
        buildPlayerEconomyBreakdownForMatch(report, player),
      );
      economyBreakdownTotalsByLabel.set(player.label, economyBreakdown);
      purchaseCountTotalsByLabel.set(
        player.label,
        (purchaseCountTotalsByLabel.get(player.label) ?? 0) + (player.purchaseCount ?? 0),
      );
      refreshCountTotalsByLabel.set(
        player.label,
        (refreshCountTotalsByLabel.get(player.label) ?? 0) + (player.refreshCount ?? 0),
      );
      sellCountTotalsByLabel.set(
        player.label,
        (sellCountTotalsByLabel.get(player.label) ?? 0) + (player.sellCount ?? 0),
      );
      specialUnitUpgradeCountTotalsByLabel.set(
        player.label,
        (specialUnitUpgradeCountTotalsByLabel.get(player.label) ?? 0) + (player.specialUnitUpgradeCount ?? 0),
      );
      remainingLivesTotalsByLabel.set(
        player.label,
        (remainingLivesTotalsByLabel.get(player.label) ?? 0) + player.remainingLives,
      );
      const playerBoardMetric = finalPlayerBoardMetricsByLabel.get(player.label)
        ?? createFinalPlayerBoardAccumulator(player.label, player.role);
      playerBoardMetric.matchesPresent += 1;
      playerBoardMetric.totalDeployedUnitCount += player.boardUnits.length;
      for (const boardUnit of player.boardUnits) {
        const finalUnitLevel = Number.isFinite(boardUnit.unitLevel)
          ? Math.max(1, Math.trunc(boardUnit.unitLevel))
          : 1;
        const isSpecialUnit = SPECIAL_BATTLE_UNIT_IDS.has(boardUnit.unitId)
          || boardUnit.unitType === "hero"
          || boardUnit.unitType === "boss";
        playerBoardMetric.totalSpecialUnitCount += isSpecialUnit ? 1 : 0;
        playerBoardMetric.totalStandardUnitCount += isSpecialUnit ? 0 : 1;
        playerBoardMetric.totalDeployedAssetValue += resolveBattleUnitInvestmentCost({
          playerId: player.playerId,
          label: player.label,
          unitId: boardUnit.unitId,
          unitName: boardUnit.unitName,
          unitType: boardUnit.unitType,
          side: player.role === "boss" ? "boss" : "raid",
          totalDamage: 0,
          phaseContributionDamage: 0,
          finalHp: 0,
          alive: true,
          unitLevel: finalUnitLevel,
          subUnitName: boardUnit.subUnitName,
          isSpecialUnit,
        });
      }
      finalPlayerBoardMetricsByLabel.set(player.label, playerBoardMetric);
      for (const boardUnit of player.boardUnits) {
        const existing = finalBoardUnitsById.get(boardUnit.unitId) ?? {
          unitId: boardUnit.unitId,
          unitType: boardUnit.unitType,
          unitName: boardUnit.unitName,
          totalCopies: 0,
          matchesPresent: 0,
          totalUnitLevel: 0,
          maxUnitLevel: 0,
          level4Copies: 0,
          level7Copies: 0,
        };
        const finalUnitLevel = Number.isFinite(boardUnit.unitLevel)
          ? Math.max(1, Math.trunc(boardUnit.unitLevel))
          : 1;
        existing.totalCopies += 1;
        existing.totalUnitLevel += finalUnitLevel;
        existing.maxUnitLevel = Math.max(existing.maxUnitLevel, finalUnitLevel);
        if (finalUnitLevel >= 4) {
          existing.level4Copies += 1;
        }
        if (finalUnitLevel >= 7) {
          existing.level7Copies += 1;
        }
        if (!seenFinalBoardUnitsInMatch.has(boardUnit.unitId)) {
          existing.matchesPresent += 1;
          seenFinalBoardUnitsInMatch.add(boardUnit.unitId);
        }
        finalBoardUnitsById.set(boardUnit.unitId, existing);

        const roleScopedKey = `${player.role}::${boardUnit.unitId}`;
        const existingForRole = finalBoardUnitsByRoleAndId.get(roleScopedKey) ?? {
          unitId: boardUnit.unitId,
          unitType: boardUnit.unitType,
          unitName: boardUnit.unitName,
          totalCopies: 0,
          matchesPresent: 0,
        };
        existingForRole.totalCopies += 1;
        if (!seenFinalBoardUnitsByRoleInMatch.has(roleScopedKey)) {
          existingForRole.matchesPresent += 1;
          seenFinalBoardUnitsByRoleInMatch.add(roleScopedKey);
        }
        finalBoardUnitsByRoleAndId.set(roleScopedKey, existingForRole);

        const resolvedCost = resolveBoardUnitCost(boardUnit.unitId);
        if (resolvedCost !== null && resolvedCost >= HIGH_COST_THRESHOLD) {
          highCostFinalBoardCopies += 1;
          matchHasHighCostFinalBoardUnit = true;
        }
      }
    }
    if (matchHasHighCostFinalBoardUnit) {
      highCostFinalBoardMatchCount += 1;
    }

    let matchHasHighCostPurchase = false;
    const purchasedShopMetricKeysInMatch = new Set<string>();
    for (const purchase of report.purchases ?? []) {
      const purchaseSource = purchase.actionType === "buy_boss_unit" ? "bossShop" : "shop";
      const purchasingPlayerRole = playerById.get(purchase.playerId)?.role;
      const purchaseRole = purchase.actionType === "buy_boss_unit"
        ? "boss"
        : purchasingPlayerRole === "boss"
          ? "boss"
          : "raid";
      const purchaseUnitId = purchase.unitId ?? "";
      if (purchaseUnitId.length > 0) {
        const key = `${purchaseRole}::${purchaseSource}::${purchaseUnitId}`;
        const existing = shopOfferMetricsByKey.get(key) ?? {
          unitId: purchaseUnitId,
          unitName: purchase.unitName ?? resolveBaselineUnitName(purchaseUnitId, purchase.unitType),
          unitType: purchase.unitType,
          role: purchaseRole,
          source: purchaseSource,
          cost: purchase.cost,
          observationCount: 0,
          matchesPresent: 0,
          purchaseCount: 0,
          purchaseMatchCount: 0,
        };
        existing.purchaseCount += 1;
        if (!purchasedShopMetricKeysInMatch.has(key)) {
          existing.purchaseMatchCount += 1;
          purchasedShopMetricKeysInMatch.add(key);
        }
        shopOfferMetricsByKey.set(key, existing);
      }

      if (purchase.cost < HIGH_COST_THRESHOLD) {
        continue;
      }

      highCostPurchaseCount += 1;
      matchHasHighCostPurchase = true;
      if (purchase.roundIndex !== undefined && purchaseUnitId.length > 0) {
        const highCostRoundKey = `${purchase.roundIndex}::${purchaseRole}::${purchaseSource}::${purchaseUnitId}`;
        const highCostRound = highCostRoundMetricsByKey.get(highCostRoundKey)
          ?? createHighCostRoundAccumulator(
            purchase.roundIndex,
            purchaseRole,
            purchaseSource,
            purchaseUnitId,
            purchase.unitType,
            purchase.unitName ?? resolveBaselineUnitName(purchaseUnitId, purchase.unitType),
            purchase.cost,
          );
        highCostRound.purchaseCount += 1;
        highCostRound.purchaseMatchKeys.add(`${matchIndex}::${purchase.roundIndex}`);
        highCostRoundMetricsByKey.set(highCostRoundKey, highCostRound);
      }
    }
    if (matchHasHighCostPurchase) {
      highCostPurchaseMatchCount += 1;
    }

    let matchHasHighCostOffer = false;
    const seenShopOfferMetricKeysInMatch = new Set<string>();
    const seenHighCostOfferMetricKeysInMatch = new Set<string>();
    for (const offer of report.observedShopOffers ?? []) {
      const shopMetricKey = `${offer.role}::${offer.source}::${offer.unitId}`;
      const shopMetric = shopOfferMetricsByKey.get(shopMetricKey) ?? {
        unitId: offer.unitId,
        unitName: offer.unitName,
        unitType: offer.unitType,
        role: offer.role,
        source: offer.source,
        cost: offer.cost,
        observationCount: 0,
        matchesPresent: 0,
        purchaseCount: 0,
        purchaseMatchCount: 0,
      };
      shopMetric.observationCount += offer.observationCount;
      if (!seenShopOfferMetricKeysInMatch.has(shopMetricKey)) {
        shopMetric.matchesPresent += 1;
        seenShopOfferMetricKeysInMatch.add(shopMetricKey);
      }
      shopOfferMetricsByKey.set(shopMetricKey, shopMetric);

      if (offer.cost < HIGH_COST_THRESHOLD) {
        continue;
      }

      highCostOfferObservationCount += offer.observationCount;
      matchHasHighCostOffer = true;
      const key = `${offer.role}::${offer.source}::${offer.unitId}`;
      const existing = highCostOfferMetricsByKey.get(key) ?? {
        unitId: offer.unitId,
        unitName: offer.unitName,
        unitType: offer.unitType,
        role: offer.role,
        source: offer.source,
        cost: offer.cost,
        observationCount: 0,
        matchesPresent: 0,
      };
      existing.observationCount += offer.observationCount;
      if (!seenHighCostOfferMetricKeysInMatch.has(key)) {
        existing.matchesPresent += 1;
        seenHighCostOfferMetricKeysInMatch.add(key);
      }
      highCostOfferMetricsByKey.set(key, existing);
      if (offer.roundIndex !== undefined) {
        const highCostRoundKey = `${offer.roundIndex}::${offer.role}::${offer.source}::${offer.unitId}`;
        const highCostRound = highCostRoundMetricsByKey.get(highCostRoundKey)
          ?? createHighCostRoundAccumulator(
            offer.roundIndex,
            offer.role,
            offer.source,
            offer.unitId,
            offer.unitType,
            offer.unitName,
            offer.cost,
          );
        highCostRound.offerObservationCount += offer.observationCount;
        highCostRound.offerMatchKeys.add(`${matchIndex}::${offer.roundIndex}`);
        highCostRoundMetricsByKey.set(highCostRoundKey, highCostRound);
      }
    }
    if (matchHasHighCostOffer) {
      highCostOfferMatchCount += 1;
    }

    const seenUnitKeysInMatch = new Set<string>();
    for (const battle of report.battles) {
      const winnerRole = resolveBattleWinnerRole(battle, playerById, report.bossPlayerId);
      const bossSurvivors = Math.max(0, Math.round(battle.bossSurvivors ?? 0));
      const raidSurvivors = Math.max(0, Math.round(battle.raidSurvivors ?? 0));
      totalBattles += 1;
      totalBossSurvivorsAtBattleEnd += bossSurvivors;
      totalRaidSurvivorsAtBattleEnd += raidSurvivors;
      if (bossSurvivors > 0 && raidSurvivors > 0) {
        bothSidesSurvivedBattles += 1;
      }
      if (bossSurvivors === 0) {
        bossWipedBattles += 1;
      }
      if (raidSurvivors === 0) {
        raidWipedBattles += 1;
      }
      battleEndReasonCounts[resolveBattleEndReason(battle)] += 1;

      for (const outcome of battle.unitOutcomes) {
        const resolvedUnitId = outcome.unitId;
        const resolvedUnitType = outcome.unitType ?? outcome.unitId;
        const resolvedUnitName = resolveBaselineUnitName(resolvedUnitId, outcome.unitName);
        const isSpecialUnit = isSpecialBattleUnitOutcome(outcome);
        const ownerWon = winnerRole === outcome.side;
        const combatProfile = resolveUnitCombatProfile(resolvedUnitId, resolvedUnitType);
        if (combatProfile && combatProfile.attackSpeed > 0) {
          const rangeBand = resolveRangeBand(combatProfile.range);
          const rangeMetricKey = `${outcome.side}::${rangeBand}`;
          const rangeMetric = rangeDamageEfficiencyByKey.get(rangeMetricKey)
            ?? createRangeDamageEfficiencyAccumulator(outcome.side, rangeBand);
          const rangeActionMetric = rangeActionDiagnosticsByKey.get(rangeMetricKey)
            ?? createRangeActionDiagnosticsAccumulator(outcome.side, rangeBand);
          const rangeFormationMetric = rangeFormationDiagnosticsByKey.get(rangeMetricKey)
            ?? createRangeFormationDiagnosticsAccumulator(outcome.side, rangeBand);
          const lifetimeMs = Math.max(0, outcome.lifetimeMs ?? outcome.battleDurationMs ?? 0);
          const attackMultiplier = combatProfile.usesStarMultiplier
            ? getUnitLevelCombatMultiplier(outcome.unitLevel)
            : 1;
          const theoreticalAttackCount = combatProfile.attackSpeed * (lifetimeMs / 1000);
          const theoreticalBaseDamage = combatProfile.attack * attackMultiplier * theoreticalAttackCount;
          rangeMetric.battleAppearances += 1;
          rangeMetric.totalDamage += outcome.totalDamage;
          rangeMetric.totalTheoreticalBaseDamage += theoreticalBaseDamage;
          rangeMetric.totalAttackCount += outcome.attackCount ?? 0;
          rangeMetric.totalTheoreticalAttackCount += theoreticalAttackCount;
          if (typeof outcome.firstAttackAtMs === "number") {
            rangeMetric.totalFirstAttackMs += outcome.firstAttackAtMs;
            rangeMetric.firstAttackSamples += 1;
          }
          if (outcome.totalDamage <= 0) {
            rangeMetric.zeroDamageBattles += 1;
          }
          rangeDamageEfficiencyByKey.set(rangeMetricKey, rangeMetric);

          const moveCount = outcome.moveCount ?? 0;
          const attackCount = outcome.attackCount ?? 0;
          const hitCount = outcome.hitCount ?? 0;
          const repositionMoveCount = outcome.repositionMoveCount ?? 0;
          const initialNearestEnemyDistance = outcome.initialNearestEnemyDistance;
          const bestNearestEnemyDistance = outcome.bestNearestEnemyDistance;
          const reachedAttackRange = typeof bestNearestEnemyDistance === "number"
            && bestNearestEnemyDistance <= combatProfile.range;
          rangeActionMetric.battleAppearances += 1;
          rangeActionMetric.totalMoveCount += moveCount;
          rangeActionMetric.totalRepositionMoveCount += repositionMoveCount;
          if (moveCount > 0) {
            rangeActionMetric.movedBattles += 1;
          }
          if (repositionMoveCount > 0) {
            rangeActionMetric.repositionBattles += 1;
          }
          if (typeof initialNearestEnemyDistance === "number") {
            rangeActionMetric.totalInitialNearestEnemyDistance += initialNearestEnemyDistance;
            rangeActionMetric.initialNearestEnemyDistanceSamples += 1;
          }
          if (typeof bestNearestEnemyDistance === "number") {
            rangeActionMetric.totalBestNearestEnemyDistance += bestNearestEnemyDistance;
            rangeActionMetric.bestNearestEnemyDistanceSamples += 1;
          }
          if (
            typeof initialNearestEnemyDistance === "number"
            && typeof bestNearestEnemyDistance === "number"
          ) {
            rangeActionMetric.totalDistanceClosed += Math.max(
              0,
              initialNearestEnemyDistance - bestNearestEnemyDistance,
            );
            rangeActionMetric.distanceClosedSamples += 1;
          }
          if (typeof outcome.firstMoveAtMs === "number") {
            rangeActionMetric.totalFirstMoveMs += outcome.firstMoveAtMs;
            rangeActionMetric.firstMoveSamples += 1;
          }
          if (
            typeof outcome.firstMoveAtMs === "number"
            && typeof outcome.firstAttackAtMs === "number"
            && outcome.firstAttackAtMs >= outcome.firstMoveAtMs
          ) {
            rangeActionMetric.totalMoveToFirstAttackMs += outcome.firstAttackAtMs - outcome.firstMoveAtMs;
            rangeActionMetric.moveToFirstAttackSamples += 1;
          }
          if (reachedAttackRange) {
            rangeActionMetric.reachedAttackRangeBattles += 1;
          }
          if (attackCount <= 0) {
            rangeActionMetric.noAttackBattles += 1;
            if (moveCount > 0) {
              rangeActionMetric.movedNoAttackBattles += 1;
            }
            if (reachedAttackRange) {
              rangeActionMetric.noAttackDespiteReachingRangeBattles += 1;
            } else {
              rangeActionMetric.noAttackWithoutReachingRangeBattles += 1;
            }
          } else if (hitCount <= 0 && outcome.totalDamage <= 0) {
            rangeActionMetric.attackedNoHitBattles += 1;
          }
          if (isLateSingleAttackBattle(outcome)) {
            rangeActionMetric.lateSingleAttackBattles += 1;
          }
          rangeActionMetric.moveTargetDiagnosticSampleCount += outcome.moveTargetDiagnosticSampleCount ?? 0;
          rangeActionMetric.suboptimalMoveTargetCount += outcome.suboptimalMoveTargetCount ?? 0;
          rangeActionMetric.totalOutsideAttackRangeBeforeFirstAttackMs +=
            outcome.outsideAttackRangeBeforeFirstAttackMs ?? 0;
          rangeActionMetric.totalInAttackRangeBeforeFirstAttackMs +=
            outcome.inAttackRangeBeforeFirstAttackMs ?? 0;
          rangeActionMetric.totalAfterFirstAttackMs += outcome.afterFirstAttackMs ?? 0;
          rangeActionMetric.totalLeftLateralMoveCount += outcome.lateralLeftMoveCount ?? 0;
          rangeActionMetric.totalRightLateralMoveCount += outcome.lateralRightMoveCount ?? 0;
          if (outcome.firstLateralMoveDirection === "left") {
            rangeActionMetric.firstLateralMoveLeftBattles += 1;
            rangeActionMetric.firstLateralMoveSamples += 1;
          } else if (outcome.firstLateralMoveDirection === "right") {
            rangeActionMetric.firstLateralMoveRightBattles += 1;
            rangeActionMetric.firstLateralMoveSamples += 1;
          }
          rangeActionMetric.sharedPursuitMoveSampleCount += outcome.sharedPursuitMoveSampleCount ?? 0;
          rangeActionMetric.contestedPursuitMoveSampleCount +=
            outcome.contestedPursuitMoveSampleCount ?? 0;
          rangeActionMetric.plannedApproachGroupMoveSampleCount +=
            outcome.plannedApproachGroupMoveSampleCount ?? 0;
          rangeActionMetric.totalPlannedApproachGroupCompetitorCount +=
            outcome.totalPlannedApproachGroupCompetitorCount ?? 0;
          rangeActionMetric.totalPlannedApproachGroupAssignedCount +=
            outcome.totalPlannedApproachGroupAssignedCount ?? 0;
          rangeActionMetric.oversubscribedPlannedApproachGroupMoveCount +=
            outcome.oversubscribedPlannedApproachGroupMoveCount ?? 0;
          rangeActionMetric.plannedApproachMoveSampleCount +=
            outcome.plannedApproachMoveSampleCount ?? 0;
          if ((outcome.plannedApproachMoveSampleCount ?? 0) > 0) {
            rangeActionMetric.plannedApproachBattleCount += 1;
          }
          rangeActionMetric.plannedApproachStillOpenMoveCount +=
            outcome.plannedApproachStillOpenMoveCount ?? 0;
          rangeActionMetric.usedPlannedApproachMoveCount +=
            outcome.usedPlannedApproachMoveCount ?? 0;
          rangeActionMetric.plannedApproachPathBlockedMoveCount +=
            outcome.plannedApproachPathBlockedMoveCount ?? 0;
          rangeActionMetric.plannedApproachWithFirstAttackCount +=
            outcome.plannedApproachWithFirstAttackCount ?? 0;
          rangeActionMetric.plannedApproachMatchedFirstAttackTargetCount +=
            outcome.plannedApproachMatchedFirstAttackTargetCount ?? 0;
          rangeActionMetric.plannedApproachReachedRangeWithoutAttackCount +=
            outcome.plannedApproachReachedRangeWithoutAttackCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackCount +=
            outcome.plannedApproachNoReachNoAttackCount ?? 0;
          rangeActionMetric.plannedApproachNoAttackTargetDiedBeforeBattleEndCount +=
            outcome.plannedApproachNoAttackTargetDiedBeforeBattleEndCount ?? 0;
          rangeActionMetric.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount +=
            outcome.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveCount ?? 0;
          rangeActionMetric.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount +=
            outcome.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount ?? 0;
          rangeActionMetric.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount +=
            outcome.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount ?? 0;
          rangeActionMetric.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount +=
            outcome.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount ?? 0;
          if (typeof outcome.firstReachedAttackRangeAtMs === "number") {
            rangeActionMetric.totalFirstReachedAttackRangeAtMs += outcome.firstReachedAttackRangeAtMs;
            rangeActionMetric.firstReachedAttackRangeSamples += 1;
          }
          if ((outcome.moveTargetDiagnosticSampleCount ?? 0) > 0) {
            rangeActionMetric.totalExcessApproachSteps += outcome.totalExcessApproachSteps ?? 0;
            rangeActionMetric.excessApproachStepSamples += outcome.moveTargetDiagnosticSampleCount ?? 0;
          }
          rangeActionDiagnosticsByKey.set(rangeMetricKey, rangeActionMetric);

          const sameColumnFrontAllyCount = Math.max(0, outcome.sameColumnFrontAllyCount ?? 0);
          rangeFormationMetric.battleAppearances += 1;
          rangeFormationMetric.totalFrontAllyCount += sameColumnFrontAllyCount;
          rangeFormationMetric.frontAllyCountSamples += 1;
          if (typeof outcome.initialRow === "number") {
            rangeFormationMetric.totalInitialRow += outcome.initialRow;
            rangeFormationMetric.initialRowSamples += 1;
          }
          if (typeof outcome.initialColumn === "number") {
            rangeFormationMetric.totalInitialColumn += outcome.initialColumn;
            rangeFormationMetric.initialColumnSamples += 1;
          }
          if (sameColumnFrontAllyCount > 0) {
            rangeFormationMetric.frontAllyBlockedBattles += 1;
            rangeFormationMetric.withFrontAllySamples += 1;
            if (outcome.totalDamage <= 0) {
              rangeFormationMetric.zeroDamageWithFrontAllyBattles += 1;
            }
            if (attackCount <= 0) {
              rangeFormationMetric.noAttackWithFrontAllyBattles += 1;
            }
          } else {
            rangeFormationMetric.withoutFrontAllySamples += 1;
            if (outcome.totalDamage <= 0) {
              rangeFormationMetric.zeroDamageWithoutFrontAllyBattles += 1;
            }
            if (attackCount <= 0) {
              rangeFormationMetric.noAttackWithoutFrontAllyBattles += 1;
            }
          }
          rangeFormationDiagnosticsByKey.set(rangeMetricKey, rangeFormationMetric);

          if (outcome.side === "raid" && rangeBand === "range_1") {
            const cohort: BotOnlyBaselineRaidMeleeCohort = isSpecialUnit
              ? "special"
              : "standard";
            const cohortMetric = raidMeleeCohortMetricsByKey.get(cohort)
              ?? createRaidMeleeCohortAccumulator(cohort);
            cohortMetric.battleAppearances += 1;
            cohortMetric.totalDamage += outcome.totalDamage;
            cohortMetric.totalAttackCount += outcome.attackCount ?? 0;
            if (typeof outcome.firstAttackAtMs === "number") {
              cohortMetric.totalFirstAttackMs += outcome.firstAttackAtMs;
              cohortMetric.firstAttackSamples += 1;
            }
            cohortMetric.totalLifetimeMs += lifetimeMs;
            if (outcome.totalDamage <= 0) {
              cohortMetric.zeroDamageBattles += 1;
            }
            if (outcome.alive) {
              cohortMetric.survivedBattles += 1;
            }
            raidMeleeCohortMetricsByKey.set(cohort, cohortMetric);

            if (isSpecialUnit) {
              const diagnostic = raidSpecialMeleeUnitDiagnosticsById.get(resolvedUnitId)
                ?? createRaidSpecialMeleeUnitDiagnosticAccumulator(resolvedUnitId, resolvedUnitName);
              diagnostic.battleAppearances += 1;
              diagnostic.totalDamage += outcome.totalDamage;
              diagnostic.totalAttackCount += outcome.attackCount ?? 0;
              if (typeof outcome.firstAttackAtMs === "number") {
                diagnostic.totalFirstAttackMs += outcome.firstAttackAtMs;
                diagnostic.firstAttackSamples += 1;
              }
              if (typeof outcome.firstReachedAttackRangeAtMs === "number") {
                diagnostic.totalFirstReachedAttackRangeAtMs += outcome.firstReachedAttackRangeAtMs;
                diagnostic.firstReachedAttackRangeSamples += 1;
              }
              if (attackCount <= 0) {
                if (typeof outcome.firstReachedAttackRangeAtMs === "number") {
                  diagnostic.noAttackDespiteReachingRangeBattles += 1;
                } else {
                  diagnostic.noAttackWithoutReachingRangeBattles += 1;
                }
              }
              diagnostic.sharedPursuitMoveSampleCount += outcome.sharedPursuitMoveSampleCount ?? 0;
              diagnostic.contestedPursuitMoveSampleCount += outcome.contestedPursuitMoveSampleCount ?? 0;
              if (outcome.totalDamage <= 0) {
                diagnostic.zeroDamageBattles += 1;
              }
              if (outcome.alive) {
                diagnostic.survivedBattles += 1;
              }
              raidSpecialMeleeUnitDiagnosticsById.set(resolvedUnitId, diagnostic);
            }
          }
        }

        if (outcome.side === "boss") {
          const existing = bossBattleUnitsById.get(resolvedUnitId)
            ?? createBattleUnitAggregateAccumulator(
              resolvedUnitId,
              resolvedUnitType,
              resolvedUnitName,
            );
          existing.battleAppearances += 1;
          existing.totalunitLevel += outcome.unitLevel;
          existing.maxUnitLevel = Math.max(existing.maxUnitLevel, outcome.unitLevel);
          existing.totalDamage += outcome.totalDamage;
          existing.totalAttackCount += outcome.attackCount ?? 0;
          existing.totalBasicSkillActivations += outcome.basicSkillActivationCount ?? 0;
          existing.totalPairSkillActivations += outcome.pairSkillActivationCount ?? 0;
          existing.totalHitCount += outcome.hitCount ?? 0;
          existing.totalDamageTaken += outcome.damageTaken ?? 0;
          if ((outcome.attackCount ?? 0) > 0) {
            existing.activeBattles += 1;
          }
          if (typeof outcome.firstAttackAtMs === "number") {
            existing.totalFirstAttackMs += outcome.firstAttackAtMs;
            existing.firstAttackSamples += 1;
          }
          existing.totalLifetimeMs += outcome.lifetimeMs ?? outcome.battleDurationMs ?? 0;
          if (outcome.totalDamage <= 0) {
            existing.zeroDamageBattles += 1;
          }
          if (outcome.alive) {
            existing.survivedBattles += 1;
          }
          if (ownerWon) {
            existing.ownerWins += 1;
          }
          if (!seenBossBattleUnitsInMatch.has(resolvedUnitId)) {
            existing.matchesPresent += 1;
            seenBossBattleUnitsInMatch.add(resolvedUnitId);
          }
          bossMaxUnitLevelByMatch.set(
            resolvedUnitId,
            Math.max(bossMaxUnitLevelByMatch.get(resolvedUnitId) ?? 0, outcome.unitLevel),
          );
          bossBattleUnitsById.set(resolvedUnitId, existing);
          continue;
        }

        const existing = raidBattleUnitsById.get(resolvedUnitId)
          ?? createBattleUnitAggregateAccumulator(
            resolvedUnitId,
            resolvedUnitType,
            resolvedUnitName,
            true,
          );
        existing.battleAppearances += 1;
        existing.totalunitLevel += outcome.unitLevel;
        existing.maxUnitLevel = Math.max(existing.maxUnitLevel, outcome.unitLevel);
        existing.totalDamage += outcome.totalDamage;
        existing.totalAttackCount += outcome.attackCount ?? 0;
        existing.totalBasicSkillActivations += outcome.basicSkillActivationCount ?? 0;
        existing.totalPairSkillActivations += outcome.pairSkillActivationCount ?? 0;
        existing.totalHitCount += outcome.hitCount ?? 0;
        existing.totalDamageTaken += outcome.damageTaken ?? 0;
        if ((outcome.attackCount ?? 0) > 0) {
          existing.activeBattles += 1;
        }
        if (typeof outcome.firstAttackAtMs === "number") {
          existing.totalFirstAttackMs += outcome.firstAttackAtMs;
          existing.firstAttackSamples += 1;
        }
        existing.totalLifetimeMs += outcome.lifetimeMs ?? outcome.battleDurationMs ?? 0;
        if (outcome.totalDamage <= 0) {
          existing.zeroDamageBattles += 1;
        }
        if (outcome.alive) {
          existing.survivedBattles += 1;
        }
        if (ownerWon) {
          existing.ownerWins += 1;
        }
        if (!seenRaidBattleUnitsInMatch.has(resolvedUnitId)) {
          existing.matchesPresent += 1;
          seenRaidBattleUnitsInMatch.add(resolvedUnitId);
        }
        raidMaxUnitLevelByMatch.set(
          resolvedUnitId,
          Math.max(raidMaxUnitLevelByMatch.get(resolvedUnitId) ?? 0, outcome.unitLevel),
        );
        if (outcome.subUnitName.length > 0) {
          existing.hostedSubUnitBattleAppearances = (existing.hostedSubUnitBattleAppearances ?? 0) + 1;
          const hostKey = `host::${resolvedUnitId}`;
          if (!seenRaidSubUnitsInMatch.has(hostKey)) {
            existing.hostedSubUnitMatchesPresent = (existing.hostedSubUnitMatchesPresent ?? 0) + 1;
            seenRaidSubUnitsInMatch.add(hostKey);
          }
        }
        if (outcome.attachedSubUnitId && outcome.attachedSubUnitId.length > 0) {
          const subUnitId = outcome.attachedSubUnitId;
          const subUnitName = outcome.attachedSubUnitName
            ?? resolveBaselineUnitName(subUnitId, outcome.subUnitName);
          const subUnitType = outcome.attachedSubUnitType ?? subUnitId;
          if (subUnitId === "okina") {
            const okinaHost = okinaSubHostsById.get(resolvedUnitId)
              ?? createOkinaSubHostAccumulator(
                resolvedUnitId,
                resolvedUnitType,
                resolvedUnitName,
              );
            okinaHost.battleAppearances += 1;
            okinaHost.totalHostLevel += outcome.unitLevel;
            okinaHost.totalDamage += outcome.totalDamage;
            okinaHost.totalDamageTaken += outcome.damageTaken ?? 0;
            okinaHost.totalLifetimeMs += outcome.lifetimeMs ?? outcome.battleDurationMs ?? 0;
            if (outcome.alive) {
              okinaHost.survivedBattles += 1;
            }
            if (ownerWon) {
              okinaHost.ownerWins += 1;
            }
            const okinaHostKey = `okina-host::${resolvedUnitId}`;
            if (!seenOkinaSubHostsInMatch.has(okinaHostKey)) {
              okinaHost.matchesPresent += 1;
              seenOkinaSubHostsInMatch.add(okinaHostKey);
            }
            okinaSubHostsById.set(resolvedUnitId, okinaHost);
          }
          const subUnitEntry = raidBattleUnitsById.get(subUnitId)
            ?? createBattleUnitAggregateAccumulator(
              subUnitId,
              subUnitType,
              subUnitName,
              true,
            );
          subUnitEntry.subUnitBattleAppearances = (subUnitEntry.subUnitBattleAppearances ?? 0) + 1;
          const subKey = `sub::${subUnitId}`;
          if (!seenRaidSubUnitsInMatch.has(subKey)) {
            subUnitEntry.subUnitMatchesPresent = (subUnitEntry.subUnitMatchesPresent ?? 0) + 1;
            seenRaidSubUnitsInMatch.add(subKey);
          }
          raidBattleUnitsById.set(subUnitId, subUnitEntry);
        }
        raidBattleUnitsById.set(resolvedUnitId, existing);
      }

      for (const contribution of battle.unitDamageBreakdown) {
        const key = `${contribution.side}::${contribution.unitId}`;
        const resolvedUnitName = resolveBaselineUnitName(
          contribution.unitId,
          contribution.unitName,
        );
        const existing = damageByUnit.get(key) ?? {
          unitId: contribution.unitId,
          unitName: resolvedUnitName,
          side: contribution.side,
          totalDamage: 0,
          appearances: 0,
        };
        existing.totalDamage += contribution.totalDamage;
        if (!seenUnitKeysInMatch.has(key)) {
          existing.appearances += 1;
          seenUnitKeysInMatch.add(key);
        }
        damageByUnit.set(key, existing);
      }
    }

    for (const [unitId, maxUnitLevel] of bossMaxUnitLevelByMatch) {
      const existing = bossBattleUnitsById.get(unitId);
      if (existing == null) {
        continue;
      }
      if (maxUnitLevel >= 4) {
        existing.level4Matches += 1;
      }
      if (maxUnitLevel >= 7) {
        existing.level7Matches += 1;
      }
    }

    for (const [unitId, maxUnitLevel] of raidMaxUnitLevelByMatch) {
      const existing = raidBattleUnitsById.get(unitId);
      if (existing == null) {
        continue;
      }
      if (maxUnitLevel >= 4) {
        existing.level4Matches += 1;
      }
      if (maxUnitLevel >= 7) {
        existing.level7Matches += 1;
      }
    }
  }

  const raidWins = completedMatches - bossWins;
  const sortedLabels = Array.from(labelAppearanceCounts.keys()).sort((left, right) => left.localeCompare(right));
  const aggregate: BotOnlyBaselineAggregateReport = {
    requestedMatchCount,
    completedMatches,
    abortedMatches: Math.max(0, requestedMatchCount - completedMatches),
    bossWins,
    raidWins,
    bossWinRate: bossWins / completedMatches,
    raidWinRate: raidWins / completedMatches,
    averageRounds: totalRounds / completedMatches,
    minRounds,
    maxRounds,
    averageRemainingRaidPlayers: totalRemainingRaidPlayers / completedMatches,
    battleMetrics: totalBattles > 0
      ? {
        totalBattles,
        averageBossSurvivorsAtBattleEnd: totalBossSurvivorsAtBattleEnd / totalBattles,
        averageRaidSurvivorsAtBattleEnd: totalRaidSurvivorsAtBattleEnd / totalBattles,
        bothSidesSurvivedRate: bothSidesSurvivedBattles / totalBattles,
        bossWipedRate: bossWipedBattles / totalBattles,
        raidWipedRate: raidWipedBattles / totalBattles,
        endReasonCounts: battleEndReasonCounts,
      }
      : buildEmptyBattleMetrics(),
    roundHistogram: Object.fromEntries(
      Array.from(roundHistogram.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([rounds, count]) => [String(rounds), count]),
    ),
    playerMetrics: Object.fromEntries(
      sortedLabels.map((label) => {
        const appearanceCount = labelAppearanceCounts.get(label) ?? completedMatches;
        return [label, {
          averagePlacement: (placementTotalsByLabel.get(label) ?? 0) / appearanceCount,
          firstPlaceRate: (firstPlaceCountsByLabel.get(label) ?? 0) / appearanceCount,
          averageRemainingHp: (hpTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageRemainingLives: (remainingLivesTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageFinalGold: (finalGoldTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageGoldEarned: (goldEarnedTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageGoldSpent: (goldSpentTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averagePurchaseCount: (purchaseCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageRefreshCount: (refreshCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageSellCount: (sellCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageSpecialUnitUpgradeCount:
            (specialUnitUpgradeCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
        }];
      }),
    ),
    heroTeamMetrics: buildHeroTeamMetrics(heroTeamMetricsById.values()),
    heroCompositionMetrics: buildHeroCompositionMetrics(heroCompositionMetricsByKey.values()),
    playerEconomyBreakdowns: Object.fromEntries(
      sortedLabels.map((label) => {
        const appearanceCount = labelAppearanceCounts.get(label) ?? completedMatches;
        return [
          label,
          dividePlayerEconomyBreakdown(
            economyBreakdownTotalsByLabel.get(label) ?? createEmptyPlayerEconomyBreakdown(),
            appearanceCount,
          ),
        ];
      }),
    ),
    bossBattleUnitMetrics: Array.from(bossBattleUnitsById.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.totalDamage - left.totalDamage
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => buildBattleUnitMetrics(entry, completedMatches)),
    raidBattleUnitMetrics: Array.from(raidBattleUnitsById.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.totalDamage - left.totalDamage
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => buildBattleUnitMetrics(entry, completedMatches)),
    ...(okinaSubHostsById.size > 0
      ? {
        okinaSubHostMetrics: Array.from(okinaSubHostsById.values())
          .sort((left, right) =>
            right.battleAppearances - left.battleAppearances
            || right.totalDamage - left.totalDamage
            || left.hostUnitId.localeCompare(right.hostUnitId))
          .map((entry) => buildOkinaSubHostMetric(entry)),
      }
      : {}),
    ...(okinaSubHostsByRoundAndId.size > 0
      ? {
        okinaSubHostRoundMetrics: Array.from(okinaSubHostsByRoundAndId.values())
          .sort((left, right) =>
            left.roundIndex - right.roundIndex
            || right.battleAppearances - left.battleAppearances
            || right.totalDamage - left.totalDamage
            || left.hostUnitId.localeCompare(right.hostUnitId))
          .map((entry) => buildOkinaSubHostRoundMetric(entry)),
      }
      : {}),
    ...(okinaHeroSubDecisionsByRound.size > 0
      ? {
        okinaHeroSubDecisionRoundMetrics: Array.from(okinaHeroSubDecisionsByRound.values())
          .sort((left, right) => left.roundIndex - right.roundIndex)
          .map((entry) => buildOkinaHeroSubDecisionRoundMetric(entry)),
      }
      : {}),
    ...(boardRefitDecisionsByRound.size > 0
      ? {
        boardRefitDecisionRoundMetrics: Array.from(boardRefitDecisionsByRound.values())
          .sort((left, right) => left.roundIndex - right.roundIndex)
          .map((entry) => buildBoardRefitDecisionRoundMetric(entry)),
      }
      : {}),
    ...(boardRefitDecisionsByRole.size > 0
      ? {
        boardRefitDecisionRoleMetrics: Array.from(boardRefitDecisionsByRole.values())
          .sort((left, right) => left.role.localeCompare(right.role))
          .map((entry) => buildBoardRefitDecisionRoleMetric(entry)),
      }
      : {}),
    ...(boardRefitDecisionsByRoleRound.size > 0
      ? {
        boardRefitDecisionRoleRoundMetrics: Array.from(boardRefitDecisionsByRoleRound.values())
          .sort((left, right) =>
            left.role.localeCompare(right.role)
            || left.roundIndex - right.roundIndex)
          .map((entry) => buildBoardRefitDecisionRoleRoundMetric(entry)),
      }
      : {}),
    finalPlayerBoardMetrics: Array.from(finalPlayerBoardMetricsByLabel.values())
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((entry) => buildFinalPlayerBoardMetric(entry)),
    finalBoardUnitMetrics: Array.from(finalBoardUnitsById.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.totalCopies - left.totalCopies
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => ({
        unitId: entry.unitId,
        unitType: entry.unitType,
        unitName: entry.unitName,
        totalCopies: entry.totalCopies,
        matchesPresent: entry.matchesPresent,
        averageCopiesPerMatch: entry.totalCopies / completedMatches,
        adoptionRate: entry.matchesPresent / completedMatches,
        averageFinalUnitLevel: entry.totalCopies > 0 ? entry.totalUnitLevel / entry.totalCopies : 0,
        maxFinalUnitLevel: entry.maxUnitLevel,
        finalLevel4Rate: entry.totalCopies > 0 ? entry.level4Copies / entry.totalCopies : 0,
        finalLevel7Rate: entry.totalCopies > 0 ? entry.level7Copies / entry.totalCopies : 0,
      })),
    topDamageUnits: Array.from(damageByUnit.values())
      .sort((left, right) =>
        right.totalDamage - left.totalDamage
        || right.appearances - left.appearances
        || left.unitId.localeCompare(right.unitId))
      .slice(0, 10)
      .map((contribution) => ({
        ...contribution,
        averageDamagePerMatch: contribution.totalDamage / completedMatches,
      })),
    highCostSummary: {
      offerObservationCount: highCostOfferObservationCount,
      offerMatchCount: highCostOfferMatchCount,
      purchaseCount: highCostPurchaseCount,
      purchaseMatchCount: highCostPurchaseMatchCount,
      finalBoardCopies: highCostFinalBoardCopies,
      finalBoardMatchCount: highCostFinalBoardMatchCount,
      finalBoardAdoptionRate: highCostFinalBoardMatchCount / completedMatches,
    },
    highCostOfferMetrics: Array.from(highCostOfferMetricsByKey.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.observationCount - left.observationCount
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => ({
        ...entry,
        offeredMatchRate: entry.matchesPresent / completedMatches,
      })),
    bossExclusiveRoundLevelMetrics: Array.from(bossExclusiveRoundLevelByKey.values())
      .map((entry) => buildBossExclusiveRoundLevelMetric(entry))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.unitId.localeCompare(right.unitId)),
    highCostRoundMetrics: Array.from(highCostRoundMetricsByKey.values())
      .map((entry) => buildHighCostRoundMetric(entry, completedMatches))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.role.localeCompare(right.role)
        || left.source.localeCompare(right.source)
        || left.unitId.localeCompare(right.unitId)),
    roundDamageEfficiencyMetrics: Array.from(roundDamageEfficiencyByKey.values())
      .map((entry) => buildRoundDamageEfficiencyMetric(entry))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.side.localeCompare(right.side)
        || ((right.damagePerInvestmentCost ?? -1) - (left.damagePerInvestmentCost ?? -1))
        || right.totalDamage - left.totalDamage
        || left.unitId.localeCompare(right.unitId)),
    unitDamageEfficiencyMetrics: buildUnitDamageEfficiencyMetrics(roundDamageEfficiencyByKey.values()),
    roundSurvivalDiagnostics: Array.from(roundSurvivalDiagnosticsByRound.values())
      .map((entry) => buildRoundSurvivalDiagnosticMetric(entry))
      .sort((left, right) => left.roundIndex - right.roundIndex),
    roundUnitSurvivalDiagnostics: Array.from(roundUnitSurvivalDiagnosticsByKey.values())
      .map((entry) => buildRoundUnitSurvivalDiagnosticMetric(entry))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.side.localeCompare(right.side)
        || left.unitId.localeCompare(right.unitId)),
    shopOfferMetrics: Array.from(shopOfferMetricsByKey.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.observationCount - left.observationCount
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => {
        const finalBoard = finalBoardUnitsByRoleAndId.get(`${entry.role}::${entry.unitId}`);
        return {
          ...entry,
          offeredMatchRate: entry.matchesPresent / completedMatches,
          // purchaseRate is defined over observed offers; purchases should have matching offer observations.
          purchaseRate: entry.observationCount > 0 ? entry.purchaseCount / entry.observationCount : 0,
          finalBoardCopies: finalBoard?.totalCopies ?? 0,
          finalBoardMatchCount: finalBoard?.matchesPresent ?? 0,
          finalBoardAdoptionRate: completedMatches > 0 ? (finalBoard?.matchesPresent ?? 0) / completedMatches : 0,
        };
      }),
    rangeDamageEfficiencyMetrics: Array.from(rangeDamageEfficiencyByKey.values())
      .sort((left, right) =>
        left.side.localeCompare(right.side)
        || left.rangeBand.localeCompare(right.rangeBand))
      .map((entry) => buildRangeDamageEfficiencyMetric(entry)),
    rangeActionDiagnosticsMetrics: Array.from(rangeActionDiagnosticsByKey.values())
      .sort((left, right) =>
        left.side.localeCompare(right.side)
        || left.rangeBand.localeCompare(right.rangeBand))
      .map((entry) => buildRangeActionDiagnosticsMetric(entry)),
    rangeFormationDiagnosticsMetrics: Array.from(rangeFormationDiagnosticsByKey.values())
      .sort((left, right) =>
        left.side.localeCompare(right.side)
        || left.rangeBand.localeCompare(right.rangeBand))
      .map((entry) => buildRangeFormationDiagnosticsMetric(entry)),
    raidMeleeCohortMetrics: Array.from(raidMeleeCohortMetricsByKey.values())
      .sort((left, right) => left.cohort.localeCompare(right.cohort))
      .map((entry) => buildRaidMeleeCohortMetric(entry)),
    raidSpecialMeleeUnitDiagnostics: Array.from(raidSpecialMeleeUnitDiagnosticsById.values())
      .sort((left, right) => left.unitId.localeCompare(right.unitId))
      .map((entry) => buildRaidSpecialMeleeUnitDiagnostic(entry)),
    roundDetails,
  };

  return sharedMetadata == null
    ? aggregate
    : {
      ...aggregate,
      metadata: sharedMetadata,
    };
}

function areBotOnlyReportMetadataEqual(
  left: BotOnlyReportMetadata | undefined,
  right: BotOnlyReportMetadata | undefined,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return left.mode === right.mode
    && left.timeScale === right.timeScale
    && left.timings.readyAutoStartMs === right.timings.readyAutoStartMs
    && left.timings.prepDurationMs === right.timings.prepDurationMs
    && left.timings.battleDurationMs === right.timings.battleDurationMs
    && left.timings.settleDurationMs === right.timings.settleDurationMs
    && left.timings.eliminationDurationMs === right.timings.eliminationDurationMs
    && left.timings.selectionTimeoutMs === right.timings.selectionTimeoutMs;
}

export function mergeBotOnlyBaselineAggregateReports(
  aggregates: BotOnlyBaselineAggregateReport[],
  requestedMatchCount = aggregates.reduce(
    (total, aggregate) => total + aggregate.requestedMatchCount,
    0,
  ),
): BotOnlyBaselineAggregateReport {
  const completedMatches = aggregates.reduce(
    (total, aggregate) => total + aggregate.completedMatches,
    0,
  );
  if (completedMatches === 0) {
    return {
      requestedMatchCount,
      completedMatches: 0,
      abortedMatches: requestedMatchCount,
      bossWins: 0,
      raidWins: 0,
      bossWinRate: 0,
      raidWinRate: 0,
      averageRounds: 0,
      minRounds: 0,
      maxRounds: 0,
      averageRemainingRaidPlayers: 0,
      battleMetrics: buildEmptyBattleMetrics(),
      roundHistogram: {},
      playerMetrics: {},
      heroTeamMetrics: [],
      heroCompositionMetrics: [],
      playerEconomyBreakdowns: {},
      bossBattleUnitMetrics: [],
      raidBattleUnitMetrics: [],
      finalBoardUnitMetrics: [],
      topDamageUnits: [],
      highCostSummary: buildEmptyHighCostSummary(),
      highCostOfferMetrics: [],
      shopOfferMetrics: [],
      bossExclusiveRoundLevelMetrics: [],
      highCostRoundMetrics: [],
      roundDamageEfficiencyMetrics: [],
      unitDamageEfficiencyMetrics: [],
      okinaSubHostMetrics: [],
      okinaSubHostRoundMetrics: [],
      okinaHeroSubDecisionRoundMetrics: [],
      boardRefitDecisionRoundMetrics: [],
      boardRefitDecisionRoleMetrics: [],
      boardRefitDecisionRoleRoundMetrics: [],
      finalPlayerBoardMetrics: [],
      roundSurvivalDiagnostics: [],
      roundUnitSurvivalDiagnostics: [],
      rangeDamageEfficiencyMetrics: [],
      rangeActionDiagnosticsMetrics: [],
      rangeFormationDiagnosticsMetrics: [],
      raidMeleeCohortMetrics: [],
      raidSpecialMeleeUnitDiagnostics: [],
      roundDetails: [],
    };
  }

  let bossWins = 0;
  let totalRounds = 0;
  let totalRemainingRaidPlayers = 0;
  let totalBattles = 0;
  let totalBossSurvivorsAtBattleEnd = 0;
  let totalRaidSurvivorsAtBattleEnd = 0;
  let bothSidesSurvivedBattles = 0;
  let bossWipedBattles = 0;
  let raidWipedBattles = 0;
  let minRounds = Number.POSITIVE_INFINITY;
  let maxRounds = 0;
  let sharedMetadata = aggregates[0]?.metadata;
  const battleEndReasonCounts = createEmptyBattleEndReasonCounts();
  const roundHistogram = new Map<string, number>();
  const placementTotalsByLabel = new Map<string, number>();
  const firstPlaceTotalsByLabel = new Map<string, number>();
  const hpTotalsByLabel = new Map<string, number>();
  const finalGoldTotalsByLabel = new Map<string, number>();
  const goldEarnedTotalsByLabel = new Map<string, number>();
  const goldSpentTotalsByLabel = new Map<string, number>();
  const economyBreakdownTotalsByLabel = new Map<string, BotOnlyBaselinePlayerEconomyBreakdown>();
  const purchaseCountTotalsByLabel = new Map<string, number>();
  const refreshCountTotalsByLabel = new Map<string, number>();
  const sellCountTotalsByLabel = new Map<string, number>();
  const specialUnitUpgradeCountTotalsByLabel = new Map<string, number>();
  const remainingLivesTotalsByLabel = new Map<string, number>();
  const appearanceCountsByLabel = new Map<string, number>();
  const heroTeamMetricsById = new Map<string, HeroTeamAccumulator>();
  const heroCompositionMetricsByKey = new Map<string, HeroCompositionAccumulator>();
  const bossBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const raidBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const okinaSubHostsById = new Map<string, OkinaSubHostAccumulator>();
  const okinaSubHostsByRoundAndId = new Map<string, OkinaSubHostRoundAccumulator>();
  const okinaHeroSubDecisionsByRound = new Map<number, OkinaHeroSubDecisionRoundAccumulator>();
  const boardRefitDecisionsByRound = new Map<number, BoardRefitDecisionRoundAccumulator>();
  const boardRefitDecisionsByRole = new Map<"boss" | "raid", BoardRefitDecisionRoleAccumulator>();
  const boardRefitDecisionsByRoleRound = new Map<string, BoardRefitDecisionRoleRoundAccumulator>();
  const finalPlayerBoardMetricsByLabel = new Map<string, FinalPlayerBoardAccumulator>();
  const finalBoardUnitsById = new Map<string, {
    unitId: string;
    unitType: string;
    unitName: string;
    totalCopies: number;
    matchesPresent: number;
    totalUnitLevel: number;
    maxUnitLevel: number;
    level4Copies: number;
    level7Copies: number;
  }>();
  const topDamageUnitsByKey = new Map<string, {
    unitId: string;
    unitName: string;
    side: "boss" | "raid";
    totalDamage: number;
    appearances: number;
  }>();
  const highCostOfferMetricsByKey = new Map<string, {
    unitId: string;
    unitName: string;
    unitType: string;
    role: "boss" | "raid";
    source: "shop" | "bossShop";
    cost: number;
    observationCount: number;
    matchesPresent: number;
  }>();
  const shopOfferMetricsByKey = new Map<string, {
    unitId: string;
    unitName: string;
    unitType: string;
    role: "boss" | "raid";
    source: "shop" | "bossShop";
    cost: number;
    observationCount: number;
    matchesPresent: number;
    purchaseCount: number;
    purchaseMatchCount: number;
    finalBoardCopies: number;
    finalBoardMatchCount: number;
  }>();
  const roundDamageEfficiencyByKey = new Map<string, RoundDamageEfficiencyAccumulator>();
  const roundSurvivalDiagnosticsByRound = new Map<number, RoundSurvivalDiagnosticAccumulator>();
  const roundUnitSurvivalDiagnosticsByKey = new Map<string, RoundUnitSurvivalDiagnosticAccumulator>();
  const bossExclusiveRoundLevelByKey = new Map<string, BossExclusiveRoundLevelAccumulator>();
  const highCostRoundMetricsByKey = new Map<string, HighCostRoundAccumulator>();
  const rangeDamageEfficiencyByKey = new Map<string, RangeDamageEfficiencyAccumulator>();
  const rangeActionDiagnosticsByKey = new Map<string, RangeActionDiagnosticsAccumulator>();
  const rangeFormationDiagnosticsByKey = new Map<string, RangeFormationDiagnosticsAccumulator>();
  const raidMeleeCohortMetricsByKey = new Map<string, RaidMeleeCohortAccumulator>();
  const raidSpecialMeleeUnitDiagnosticsById = new Map<string, RaidSpecialMeleeUnitDiagnosticAccumulator>();
  const roundDetails: BotOnlyBaselineMatchRoundDetail[] = [];
  let roundDetailMatchOffset = 0;
  let highCostOfferObservationCount = 0;
  let highCostOfferMatchCount = 0;
  let highCostPurchaseCount = 0;
  let highCostPurchaseMatchCount = 0;
  let highCostFinalBoardCopies = 0;
  let highCostFinalBoardMatchCount = 0;

  for (const aggregate of aggregates) {
    if (!areBotOnlyReportMetadataEqual(sharedMetadata, aggregate.metadata)) {
      sharedMetadata = undefined;
    }

    for (const detail of aggregate.roundDetails ?? []) {
      roundDetails.push({
        ...detail,
        matchIndex: detail.matchIndex + roundDetailMatchOffset,
        raidPlayerConsequences: detail.raidPlayerConsequences.map((player) => ({ ...player })),
        topBossUnits: detail.topBossUnits.map((unit) => ({ ...unit })),
        ...(detail.topBossDamageTakenUnits !== undefined
          ? { topBossDamageTakenUnits: detail.topBossDamageTakenUnits.map((unit) => ({ ...unit })) }
          : {}),
        topRaidUnits: detail.topRaidUnits.map((unit) => ({ ...unit })),
        ...(detail.bossBodyFocus !== undefined
          ? { bossBodyFocus: detail.bossBodyFocus ? { ...detail.bossBodyFocus } : null }
          : {}),
        battleEndReasons: [...detail.battleEndReasons],
        battleWinnerRoles: [...detail.battleWinnerRoles],
      });
    }
    roundDetailMatchOffset += aggregate.completedMatches;

    bossWins += aggregate.bossWins;
    totalRounds += aggregate.averageRounds * aggregate.completedMatches;
    totalRemainingRaidPlayers += aggregate.averageRemainingRaidPlayers * aggregate.completedMatches;
    totalBattles += aggregate.battleMetrics.totalBattles;
    totalBossSurvivorsAtBattleEnd +=
      aggregate.battleMetrics.averageBossSurvivorsAtBattleEnd * aggregate.battleMetrics.totalBattles;
    totalRaidSurvivorsAtBattleEnd +=
      aggregate.battleMetrics.averageRaidSurvivorsAtBattleEnd * aggregate.battleMetrics.totalBattles;
    bothSidesSurvivedBattles +=
      aggregate.battleMetrics.bothSidesSurvivedRate * aggregate.battleMetrics.totalBattles;
    bossWipedBattles += aggregate.battleMetrics.bossWipedRate * aggregate.battleMetrics.totalBattles;
    raidWipedBattles += aggregate.battleMetrics.raidWipedRate * aggregate.battleMetrics.totalBattles;
    if (aggregate.completedMatches > 0) {
      minRounds = Math.min(minRounds, aggregate.minRounds);
      maxRounds = Math.max(maxRounds, aggregate.maxRounds);
    }
    for (const reason of BOT_ONLY_BASELINE_BATTLE_END_REASONS) {
      battleEndReasonCounts[reason] += aggregate.battleMetrics.endReasonCounts[reason] ?? 0;
    }

    for (const [roundKey, count] of Object.entries(aggregate.roundHistogram)) {
      roundHistogram.set(roundKey, (roundHistogram.get(roundKey) ?? 0) + count);
    }

    for (const entry of aggregate.heroTeamMetrics ?? []) {
      const existing = heroTeamMetricsById.get(entry.heroId) ?? createHeroTeamAccumulator(entry.heroId);
      existing.heroName = entry.heroName;
      existing.matchesPresent += entry.matchesPresent;
      existing.raidTeamWins += entry.raidTeamWins;
      existing.firstPlaces += entry.firstPlaceRate * entry.matchesPresent;
      existing.totalPlacement += entry.averagePlacement * entry.matchesPresent;
      existing.totalRemainingLives += entry.averageRemainingLives * entry.matchesPresent;
      existing.totalFinalGold += entry.averageFinalGold * entry.matchesPresent;
      existing.totalGoldEarned += entry.averageGoldEarned * entry.matchesPresent;
      existing.totalGoldSpent += entry.averageGoldSpent * entry.matchesPresent;
      existing.totalSpecialUnitUpgradeCount += entry.averageSpecialUnitUpgradeCount * entry.matchesPresent;
      heroTeamMetricsById.set(entry.heroId, existing);
    }

    for (const entry of aggregate.heroCompositionMetrics ?? []) {
      const existing = heroCompositionMetricsByKey.get(entry.compositionKey) ?? {
        compositionKey: entry.compositionKey,
        heroIds: [...entry.heroIds],
        heroNames: [...entry.heroNames],
        matchesPresent: 0,
        raidWins: 0,
        totalRounds: 0,
      };
      existing.matchesPresent += entry.matchesPresent;
      existing.raidWins += entry.raidWins;
      existing.totalRounds += entry.averageRounds * entry.matchesPresent;
      heroCompositionMetricsByKey.set(entry.compositionKey, existing);
    }

    for (const entry of aggregate.roundSurvivalDiagnostics ?? []) {
      const existing = roundSurvivalDiagnosticsByRound.get(entry.roundIndex)
        ?? createRoundSurvivalDiagnosticAccumulator(entry.roundIndex);
      existing.battleSamples += entry.battleSamples;
      existing.totalBattleEndMs += entry.averageBattleEndMs * entry.battleSamples;
      existing.phaseSuccessBattles += entry.phaseSuccessRate * entry.battleSamples;
      existing.phaseSuccessWithBossWipeBattles += entry.phaseSuccessWithBossWipeRate * entry.battleSamples;
      existing.phaseFailureWithRaidWipeBattles += entry.phaseFailureWithRaidWipeRate * entry.battleSamples;
      existing.bossWipedBattles += entry.bossWipedRate * entry.battleSamples;
      existing.raidWipedBattles += entry.raidWipedRate * entry.battleSamples;
      existing.bothSidesSurvivedBattles += entry.bothSidesSurvivedRate * entry.battleSamples;
      existing.totalBossStartUnitCount += entry.averageBossStartUnitCount * entry.battleSamples;
      existing.totalBossSurvivors += entry.averageBossSurvivors * entry.battleSamples;
      existing.totalBossFinalHp += entry.averageBossFinalHp * entry.battleSamples;
      existing.totalBossEstimatedMaxHp += entry.averageBossEstimatedMaxHp * entry.battleSamples;
      existing.totalRaidStartUnitCount += entry.averageRaidStartUnitCount * entry.battleSamples;
      existing.totalRaidSurvivors += entry.averageRaidSurvivors * entry.battleSamples;
      existing.totalRaidFinalHp += entry.averageRaidFinalHp * entry.battleSamples;
      existing.totalRaidEstimatedMaxHp += entry.averageRaidEstimatedMaxHp * entry.battleSamples;
      roundSurvivalDiagnosticsByRound.set(entry.roundIndex, existing);
    }

    for (const entry of aggregate.roundUnitSurvivalDiagnostics ?? []) {
      const key = `${entry.roundIndex}::${entry.side}::${entry.unitId}`;
      const existing = roundUnitSurvivalDiagnosticsByKey.get(key)
        ?? createRoundUnitSurvivalDiagnosticAccumulator(
          entry.roundIndex,
          entry.side,
          entry.unitId,
          entry.unitType,
          entry.unitName,
        );
      existing.battleAppearances += entry.battleAppearances;
      existing.matchesPresent += entry.matchesPresent;
      existing.totalUnitLevel += entry.averageUnitLevel * entry.battleAppearances;
      existing.survivedBattles += entry.survivalRate * entry.battleAppearances;
      existing.totalFinalHp += entry.averageFinalHp * entry.battleAppearances;
      existing.totalEstimatedMaxHp += entry.averageEstimatedMaxHp * entry.battleAppearances;
      existing.totalDamageTaken += entry.averageDamageTaken * entry.battleAppearances;
      existing.totalLifetimeMs += entry.averageLifetimeMs * entry.battleAppearances;
      existing.totalDamage += entry.averageDamagePerBattle * entry.battleAppearances;
      existing.zeroDamageBattles += entry.zeroDamageBattleRate * entry.battleAppearances;
      roundUnitSurvivalDiagnosticsByKey.set(key, existing);
    }

    for (const [label, metrics] of Object.entries(aggregate.playerMetrics)) {
      const appearanceCount = aggregate.completedMatches;
      appearanceCountsByLabel.set(
        label,
        (appearanceCountsByLabel.get(label) ?? 0) + appearanceCount,
      );
      placementTotalsByLabel.set(
        label,
        (placementTotalsByLabel.get(label) ?? 0) + metrics.averagePlacement * appearanceCount,
      );
      firstPlaceTotalsByLabel.set(
        label,
        (firstPlaceTotalsByLabel.get(label) ?? 0) + metrics.firstPlaceRate * appearanceCount,
      );
      hpTotalsByLabel.set(
        label,
        (hpTotalsByLabel.get(label) ?? 0) + metrics.averageRemainingHp * appearanceCount,
      );
      finalGoldTotalsByLabel.set(
        label,
        (finalGoldTotalsByLabel.get(label) ?? 0) + metrics.averageFinalGold * appearanceCount,
      );
      goldEarnedTotalsByLabel.set(
        label,
        (goldEarnedTotalsByLabel.get(label) ?? 0) + metrics.averageGoldEarned * appearanceCount,
      );
      goldSpentTotalsByLabel.set(
        label,
        (goldSpentTotalsByLabel.get(label) ?? 0) + metrics.averageGoldSpent * appearanceCount,
      );
      const economyBreakdown = aggregate.playerEconomyBreakdowns?.[label];
      if (economyBreakdown) {
        const existingEconomyBreakdown = economyBreakdownTotalsByLabel.get(label)
          ?? createEmptyPlayerEconomyBreakdown();
        addPlayerEconomyBreakdown(existingEconomyBreakdown, {
          fixedPrepIncome: economyBreakdown.fixedPrepIncome * appearanceCount,
          raidPhaseSuccessBonusIncome: economyBreakdown.raidPhaseSuccessBonusIncome * appearanceCount,
          sellIncome: economyBreakdown.sellIncome * appearanceCount,
          specialEconomyIncome: economyBreakdown.specialEconomyIncome * appearanceCount,
          normalShopSpend: economyBreakdown.normalShopSpend * appearanceCount,
          bossShopSpend: economyBreakdown.bossShopSpend * appearanceCount,
          refreshSpend: economyBreakdown.refreshSpend * appearanceCount,
          specialUnitUpgradeSpend: economyBreakdown.specialUnitUpgradeSpend * appearanceCount,
          otherSpend: economyBreakdown.otherSpend * appearanceCount,
          loggedGoldGain: economyBreakdown.loggedGoldGain * appearanceCount,
          loggedGoldSpent: economyBreakdown.loggedGoldSpent * appearanceCount,
          finalUnusedGold: economyBreakdown.finalUnusedGold * appearanceCount,
        });
        economyBreakdownTotalsByLabel.set(label, existingEconomyBreakdown);
      }
      purchaseCountTotalsByLabel.set(
        label,
        (purchaseCountTotalsByLabel.get(label) ?? 0) + metrics.averagePurchaseCount * appearanceCount,
      );
      refreshCountTotalsByLabel.set(
        label,
        (refreshCountTotalsByLabel.get(label) ?? 0) + metrics.averageRefreshCount * appearanceCount,
      );
      sellCountTotalsByLabel.set(
        label,
        (sellCountTotalsByLabel.get(label) ?? 0) + metrics.averageSellCount * appearanceCount,
      );
      specialUnitUpgradeCountTotalsByLabel.set(
        label,
        (specialUnitUpgradeCountTotalsByLabel.get(label) ?? 0)
          + (metrics.averageSpecialUnitUpgradeCount ?? 0) * appearanceCount,
      );
      remainingLivesTotalsByLabel.set(
        label,
        (remainingLivesTotalsByLabel.get(label) ?? 0) + metrics.averageRemainingLives * appearanceCount,
      );
    }

    for (const entry of aggregate.bossBattleUnitMetrics) {
      const existing = bossBattleUnitsById.get(entry.unitId)
        ?? createBattleUnitAggregateAccumulator(
          entry.unitId,
          entry.unitType,
          entry.unitName,
        );
      existing.battleAppearances += entry.battleAppearances;
      existing.matchesPresent += entry.matchesPresent;
      existing.totalunitLevel += entry.averageunitLevel * entry.battleAppearances;
      existing.maxUnitLevel = Math.max(existing.maxUnitLevel, entry.maxUnitLevel ?? 0);
      existing.level4Matches += (entry.level4ReachRate ?? 0) * entry.matchesPresent;
      existing.level7Matches += (entry.level7ReachRate ?? 0) * entry.matchesPresent;
      existing.totalDamage += entry.averageDamagePerBattle * entry.battleAppearances;
      existing.activeBattles += entry.activeBattleRate * entry.battleAppearances;
      existing.totalAttackCount += entry.averageAttackCountPerBattle * entry.battleAppearances;
      existing.totalBasicSkillActivations += (entry.averageBasicSkillActivationsPerBattle ?? 0) * entry.battleAppearances;
      existing.totalPairSkillActivations += (entry.averagePairSkillActivationsPerBattle ?? 0) * entry.battleAppearances;
      existing.totalHitCount += entry.averageHitCountPerBattle * entry.battleAppearances;
      existing.totalDamageTaken += entry.averageDamageTakenPerBattle * entry.battleAppearances;
      if (entry.averageFirstAttackMs != null) {
        const firstAttackSamples = entry.activeBattleRate * entry.battleAppearances;
        existing.totalFirstAttackMs += entry.averageFirstAttackMs * firstAttackSamples;
        existing.firstAttackSamples += firstAttackSamples;
      }
      existing.totalLifetimeMs += entry.averageLifetimeMs * entry.battleAppearances;
      existing.zeroDamageBattles += entry.zeroDamageBattleRate * entry.battleAppearances;
      existing.survivedBattles += entry.survivalRate * entry.battleAppearances;
      existing.ownerWins += entry.ownerWinRate * entry.battleAppearances;
      bossBattleUnitsById.set(entry.unitId, existing);
    }

    for (const entry of aggregate.raidBattleUnitMetrics) {
      const existing = raidBattleUnitsById.get(entry.unitId)
        ?? createBattleUnitAggregateAccumulator(
          entry.unitId,
          entry.unitType,
          entry.unitName,
          true,
        );
      existing.battleAppearances += entry.battleAppearances;
      existing.matchesPresent += entry.matchesPresent;
      existing.totalunitLevel += entry.averageunitLevel * entry.battleAppearances;
      existing.maxUnitLevel = Math.max(existing.maxUnitLevel, entry.maxUnitLevel ?? 0);
      existing.level4Matches += (entry.level4ReachRate ?? 0) * entry.matchesPresent;
      existing.level7Matches += (entry.level7ReachRate ?? 0) * entry.matchesPresent;
      existing.totalDamage += entry.averageDamagePerBattle * entry.battleAppearances;
      existing.activeBattles += entry.activeBattleRate * entry.battleAppearances;
      existing.totalAttackCount += entry.averageAttackCountPerBattle * entry.battleAppearances;
      existing.totalBasicSkillActivations += (entry.averageBasicSkillActivationsPerBattle ?? 0) * entry.battleAppearances;
      existing.totalPairSkillActivations += (entry.averagePairSkillActivationsPerBattle ?? 0) * entry.battleAppearances;
      existing.totalHitCount += entry.averageHitCountPerBattle * entry.battleAppearances;
      existing.totalDamageTaken += entry.averageDamageTakenPerBattle * entry.battleAppearances;
      if (entry.averageFirstAttackMs != null) {
        const firstAttackSamples = entry.activeBattleRate * entry.battleAppearances;
        existing.totalFirstAttackMs += entry.averageFirstAttackMs * firstAttackSamples;
        existing.firstAttackSamples += firstAttackSamples;
      }
      existing.totalLifetimeMs += entry.averageLifetimeMs * entry.battleAppearances;
      existing.zeroDamageBattles += entry.zeroDamageBattleRate * entry.battleAppearances;
      existing.survivedBattles += entry.survivalRate * entry.battleAppearances;
      existing.ownerWins += entry.ownerWinRate * entry.battleAppearances;
      existing.subUnitBattleAppearances = (existing.subUnitBattleAppearances ?? 0)
        + (entry.subUnitBattleAppearances ?? 0);
      existing.subUnitMatchesPresent = (existing.subUnitMatchesPresent ?? 0)
        + (entry.subUnitMatchesPresent ?? 0);
      existing.hostedSubUnitBattleAppearances = (existing.hostedSubUnitBattleAppearances ?? 0)
        + (entry.hostedSubUnitBattleAppearances ?? 0);
      existing.hostedSubUnitMatchesPresent = (existing.hostedSubUnitMatchesPresent ?? 0)
        + (entry.hostedSubUnitMatchesPresent ?? 0);
      raidBattleUnitsById.set(entry.unitId, existing);
    }

    for (const entry of aggregate.okinaSubHostMetrics ?? []) {
      const existing = okinaSubHostsById.get(entry.hostUnitId)
        ?? createOkinaSubHostAccumulator(
          entry.hostUnitId,
          entry.hostUnitType,
          entry.hostUnitName,
        );
      existing.battleAppearances += entry.battleAppearances;
      existing.matchesPresent += entry.matchesPresent;
      existing.totalHostLevel += entry.averageHostLevel * entry.battleAppearances;
      existing.totalDamage += entry.averageDamagePerBattle * entry.battleAppearances;
      existing.totalDamageTaken += entry.averageDamageTakenPerBattle * entry.battleAppearances;
      existing.totalLifetimeMs += entry.averageLifetimeMs * entry.battleAppearances;
      existing.survivedBattles += entry.survivalRate * entry.battleAppearances;
      existing.ownerWins += entry.ownerWinRate * entry.battleAppearances;
      okinaSubHostsById.set(entry.hostUnitId, existing);
    }

    for (const entry of aggregate.okinaSubHostRoundMetrics ?? []) {
      const key = `${entry.roundIndex}::${entry.hostUnitId}`;
      const existing = okinaSubHostsByRoundAndId.get(key)
        ?? createOkinaSubHostRoundAccumulator(
          entry.roundIndex,
          entry.hostUnitId,
          entry.hostUnitType,
          entry.hostUnitName,
        );
      existing.battleAppearances += entry.battleAppearances;
      existing.matchesPresent += entry.matchesPresent;
      existing.totalHostLevel += entry.averageHostLevel * entry.battleAppearances;
      existing.totalDamage += entry.averageDamagePerBattle * entry.battleAppearances;
      existing.totalDamageTaken += entry.averageDamageTakenPerBattle * entry.battleAppearances;
      existing.totalLifetimeMs += entry.averageLifetimeMs * entry.battleAppearances;
      existing.survivedBattles += entry.survivalRate * entry.battleAppearances;
      existing.ownerWins += entry.ownerWinRate * entry.battleAppearances;
      okinaSubHostsByRoundAndId.set(key, existing);
    }

    for (const entry of aggregate.okinaHeroSubDecisionRoundMetrics ?? []) {
      const existing = okinaHeroSubDecisionsByRound.get(entry.roundIndex)
        ?? createOkinaHeroSubDecisionRoundAccumulator(entry.roundIndex);
      existing.samples += entry.samples;
      existing.actionRecommendedSamples += entry.actionRecommendedSamples;
      existing.noCandidateSamples += entry.noCandidateSamples;
      existing.frontValuePreferredSamples += entry.frontValuePreferredSamples;
      existing.currentHostKeptSamples += entry.currentHostKeptSamples;
      existing.totalCandidateCount += entry.averageCandidateCount * entry.samples;
      existing.totalFrontEquivalentValue += entry.averageFrontEquivalentValue * entry.samples;
      if (entry.averageBestHostGain !== null) {
        const bestHostGainSamples = entry.samples - entry.noCandidateSamples;
        existing.totalBestHostGain += entry.averageBestHostGain * bestHostGainSamples;
        existing.bestHostGainSamples += bestHostGainSamples;
      }
      if (
        entry.averageBestHostCurrentPowerScore !== null
        && entry.averageBestHostFutureValueScore !== null
        && entry.averageBestHostTransitionReadinessScore !== null
        && entry.averageBestHostProtectionScore !== null
      ) {
        const bestHostOptimizationSamples = entry.samples - entry.noCandidateSamples;
        existing.totalBestHostCurrentPowerScore +=
          entry.averageBestHostCurrentPowerScore * bestHostOptimizationSamples;
        existing.totalBestHostFutureValueScore +=
          entry.averageBestHostFutureValueScore * bestHostOptimizationSamples;
        existing.totalBestHostTransitionReadinessScore +=
          entry.averageBestHostTransitionReadinessScore * bestHostOptimizationSamples;
        existing.totalBestHostProtectionScore +=
          entry.averageBestHostProtectionScore * bestHostOptimizationSamples;
        existing.bestHostOptimizationSamples += bestHostOptimizationSamples;
      }
      if (entry.averageBestToFrontRatio !== null) {
        const bestToFrontRatioSamples = entry.samples - entry.noCandidateSamples;
        existing.totalBestToFrontRatio += entry.averageBestToFrontRatio * bestToFrontRatioSamples;
        existing.bestToFrontRatioSamples += bestToFrontRatioSamples;
      }
      if (entry.mostFrequentBestHostUnitId !== null && entry.mostFrequentBestHostSamples > 0) {
        const host = existing.bestHostSamplesById.get(entry.mostFrequentBestHostUnitId) ?? {
          unitId: entry.mostFrequentBestHostUnitId,
          unitName: entry.mostFrequentBestHostUnitName ?? entry.mostFrequentBestHostUnitId,
          samples: 0,
        };
        host.samples += entry.mostFrequentBestHostSamples;
        existing.bestHostSamplesById.set(entry.mostFrequentBestHostUnitId, host);
      }
      okinaHeroSubDecisionsByRound.set(entry.roundIndex, existing);
    }

    for (const entry of aggregate.boardRefitDecisionRoundMetrics ?? []) {
      const existing = boardRefitDecisionsByRound.get(entry.roundIndex)
        ?? createBoardRefitDecisionRoundAccumulator(entry.roundIndex);
      mergeBoardRefitDecisionMetricIntoAccumulator(entry, existing);
      boardRefitDecisionsByRound.set(entry.roundIndex, existing);
    }

    for (const entry of aggregate.boardRefitDecisionRoleMetrics ?? []) {
      const existing = boardRefitDecisionsByRole.get(entry.role)
        ?? createBoardRefitDecisionRoleAccumulator(entry.role);
      mergeBoardRefitDecisionMetricIntoAccumulator(entry, existing);
      boardRefitDecisionsByRole.set(entry.role, existing);
    }

    for (const entry of aggregate.boardRefitDecisionRoleRoundMetrics ?? []) {
      const key = `${entry.role}:${entry.roundIndex}`;
      const existing = boardRefitDecisionsByRoleRound.get(key)
        ?? createBoardRefitDecisionRoleRoundAccumulator(entry.role, entry.roundIndex);
      mergeBoardRefitDecisionMetricIntoAccumulator(entry, existing);
      boardRefitDecisionsByRoleRound.set(key, existing);
    }

    for (const entry of aggregate.finalPlayerBoardMetrics ?? []) {
      const existing = finalPlayerBoardMetricsByLabel.get(entry.label)
        ?? createFinalPlayerBoardAccumulator(entry.label, entry.role);
      existing.matchesPresent += entry.matchesPresent;
      existing.totalDeployedUnitCount += entry.averageDeployedUnitCount * entry.matchesPresent;
      existing.totalDeployedAssetValue += entry.averageDeployedAssetValue * entry.matchesPresent;
      existing.totalSpecialUnitCount += entry.averageSpecialUnitCount * entry.matchesPresent;
      existing.totalStandardUnitCount += entry.averageStandardUnitCount * entry.matchesPresent;
      finalPlayerBoardMetricsByLabel.set(entry.label, existing);
    }

    for (const entry of aggregate.finalBoardUnitMetrics) {
      const existing = finalBoardUnitsById.get(entry.unitId) ?? {
        unitId: entry.unitId,
        unitType: entry.unitType,
        unitName: entry.unitName,
        totalCopies: 0,
        matchesPresent: 0,
        totalUnitLevel: 0,
        maxUnitLevel: 0,
        level4Copies: 0,
        level7Copies: 0,
      };
      existing.totalCopies += entry.totalCopies;
      existing.matchesPresent += entry.matchesPresent;
      existing.totalUnitLevel += (entry.averageFinalUnitLevel ?? 0) * entry.totalCopies;
      existing.maxUnitLevel = Math.max(existing.maxUnitLevel, entry.maxFinalUnitLevel ?? 0);
      existing.level4Copies += (entry.finalLevel4Rate ?? 0) * entry.totalCopies;
      existing.level7Copies += (entry.finalLevel7Rate ?? 0) * entry.totalCopies;
      finalBoardUnitsById.set(entry.unitId, existing);
    }

    for (const entry of aggregate.topDamageUnits) {
      const key = `${entry.side}::${entry.unitId}`;
      const existing = topDamageUnitsByKey.get(key) ?? {
        unitId: entry.unitId,
        unitName: entry.unitName,
        side: entry.side,
        totalDamage: 0,
        appearances: 0,
      };
      existing.totalDamage += entry.totalDamage;
      existing.appearances += entry.appearances;
      topDamageUnitsByKey.set(key, existing);
    }

    highCostOfferObservationCount += aggregate.highCostSummary?.offerObservationCount ?? 0;
    highCostOfferMatchCount += aggregate.highCostSummary?.offerMatchCount ?? 0;
    highCostPurchaseCount += aggregate.highCostSummary?.purchaseCount ?? 0;
    highCostPurchaseMatchCount += aggregate.highCostSummary?.purchaseMatchCount ?? 0;
    highCostFinalBoardCopies += aggregate.highCostSummary?.finalBoardCopies ?? 0;
    highCostFinalBoardMatchCount += aggregate.highCostSummary?.finalBoardMatchCount ?? 0;

    for (const entry of aggregate.highCostOfferMetrics ?? []) {
      const key = `${entry.role}::${entry.source}::${entry.unitId}`;
      const existing = highCostOfferMetricsByKey.get(key) ?? {
        unitId: entry.unitId,
        unitName: entry.unitName,
        unitType: entry.unitType,
        role: entry.role,
        source: entry.source,
        cost: entry.cost,
        observationCount: 0,
        matchesPresent: 0,
      };
      existing.observationCount += entry.observationCount;
      existing.matchesPresent += entry.matchesPresent;
      highCostOfferMetricsByKey.set(key, existing);
    }

    for (const entry of aggregate.shopOfferMetrics ?? []) {
      const key = `${entry.role}::${entry.source}::${entry.unitId}`;
      const existing = shopOfferMetricsByKey.get(key) ?? {
        unitId: entry.unitId,
        unitName: entry.unitName,
        unitType: entry.unitType,
        role: entry.role,
        source: entry.source,
        cost: entry.cost,
        observationCount: 0,
        matchesPresent: 0,
        purchaseCount: 0,
        purchaseMatchCount: 0,
        finalBoardCopies: 0,
        finalBoardMatchCount: 0,
      };
      existing.observationCount += entry.observationCount;
      existing.matchesPresent += entry.matchesPresent;
      existing.purchaseCount += entry.purchaseCount;
      existing.purchaseMatchCount += entry.purchaseMatchCount;
      existing.finalBoardCopies += entry.finalBoardCopies;
      existing.finalBoardMatchCount += entry.finalBoardMatchCount;
      shopOfferMetricsByKey.set(key, existing);
    }

    for (const entry of aggregate.bossExclusiveRoundLevelMetrics ?? []) {
      const key = `${entry.roundIndex}::${entry.unitId}`;
      const existing = bossExclusiveRoundLevelByKey.get(key)
        ?? createBossExclusiveRoundLevelAccumulator(
          entry.roundIndex,
          entry.unitId,
          entry.unitType,
          entry.unitName,
        );
      existing.battleAppearances += entry.battleAppearances;
      const levelSamples = entry.unitLevelSamples && entry.unitLevelSamples.length > 0
        ? entry.unitLevelSamples
        : Array.from({ length: entry.battleAppearances }, () => entry.averageUnitLevel);
      existing.unitLevelSamples.push(...levelSamples);
      for (let matchOffset = 0; matchOffset < entry.matchesPresent; matchOffset += 1) {
        existing.matchKeys.add(`${key}::chunk${roundDetailMatchOffset}::${matchOffset}`);
      }
      bossExclusiveRoundLevelByKey.set(key, existing);
    }

    for (const entry of aggregate.highCostRoundMetrics ?? []) {
      const key = `${entry.roundIndex}::${entry.role}::${entry.source}::${entry.unitId}`;
      const existing = highCostRoundMetricsByKey.get(key)
        ?? createHighCostRoundAccumulator(
          entry.roundIndex,
          entry.role,
          entry.source,
          entry.unitId,
          entry.unitType,
          entry.unitName,
          entry.cost,
        );
      existing.offerObservationCount += entry.offerObservationCount;
      existing.purchaseCount += entry.purchaseCount;
      existing.battleAppearances += entry.battleAppearances;
      for (let matchOffset = 0; matchOffset < entry.offerMatchCount; matchOffset += 1) {
        existing.offerMatchKeys.add(`${key}::offer::chunk${roundDetailMatchOffset}::${matchOffset}`);
      }
      for (let matchOffset = 0; matchOffset < entry.purchaseMatchCount; matchOffset += 1) {
        existing.purchaseMatchKeys.add(`${key}::purchase::chunk${roundDetailMatchOffset}::${matchOffset}`);
      }
      for (let matchOffset = 0; matchOffset < entry.battleMatchCount; matchOffset += 1) {
        existing.battleMatchKeys.add(`${key}::battle::chunk${roundDetailMatchOffset}::${matchOffset}`);
      }
      highCostRoundMetricsByKey.set(key, existing);
    }

    for (const entry of aggregate.roundDamageEfficiencyMetrics ?? []) {
      const key = `${entry.roundIndex}::${entry.side}::${entry.unitId}`;
      const existing = roundDamageEfficiencyByKey.get(key)
        ?? createRoundDamageEfficiencyAccumulator(
          entry.roundIndex,
          entry.side,
          entry.unitId,
          entry.unitType,
          entry.unitName,
        );
      existing.battleAppearances += entry.battleAppearances;
      existing.matchesPresent += entry.matchesPresent;
      existing.totalUnitLevel += entry.averageUnitLevel * entry.battleAppearances;
      existing.totalDamage += entry.totalDamage;
      existing.totalInvestmentCost += entry.totalInvestmentCost;
      roundDamageEfficiencyByKey.set(key, existing);
    }

    for (const entry of aggregate.rangeDamageEfficiencyMetrics) {
      const key = `${entry.side}::${entry.rangeBand}`;
      const existing = rangeDamageEfficiencyByKey.get(key)
        ?? createRangeDamageEfficiencyAccumulator(entry.side, entry.rangeBand);
      existing.battleAppearances += entry.battleAppearances;
      existing.totalDamage += entry.totalDamage;
      existing.totalTheoreticalBaseDamage += entry.totalTheoreticalBaseDamage;
      existing.totalAttackCount += entry.totalAttackCount;
      existing.totalTheoreticalAttackCount += entry.totalTheoreticalAttackCount;
      const averageFirstAttackMs = entry.averageFirstAttackMs ?? 0;
      existing.totalFirstAttackMs += averageFirstAttackMs * entry.firstAttackSamples;
      existing.firstAttackSamples += entry.firstAttackSamples;
      existing.zeroDamageBattles += entry.zeroDamageBattleRate * entry.battleAppearances;
      rangeDamageEfficiencyByKey.set(key, existing);
    }

    for (const entry of aggregate.rangeActionDiagnosticsMetrics ?? []) {
      const key = `${entry.side}::${entry.rangeBand}`;
      const existing = rangeActionDiagnosticsByKey.get(key)
        ?? createRangeActionDiagnosticsAccumulator(entry.side, entry.rangeBand);
      existing.battleAppearances += entry.battleAppearances;
      existing.movedBattles += entry.movedBattleRate * entry.battleAppearances;
      existing.totalMoveCount += entry.averageMoveCountPerBattle * entry.battleAppearances;
      if (entry.averageFirstMoveMs != null) {
        existing.totalFirstMoveMs += entry.averageFirstMoveMs * entry.firstMoveSamples;
        existing.firstMoveSamples += entry.firstMoveSamples;
      }
      if (entry.averageMoveToFirstAttackMs != null) {
        existing.totalMoveToFirstAttackMs += entry.averageMoveToFirstAttackMs * entry.moveToFirstAttackSamples;
        existing.moveToFirstAttackSamples += entry.moveToFirstAttackSamples;
      }
      existing.repositionBattles += entry.repositionBattleRate * entry.battleAppearances;
      existing.totalRepositionMoveCount += entry.averageRepositionMoveCountPerBattle * entry.battleAppearances;
      existing.reachedAttackRangeBattles += entry.reachedAttackRangeBattleRate * entry.battleAppearances;
      existing.noAttackDespiteReachingRangeBattles +=
        entry.noAttackDespiteReachingRangeBattleRate * entry.battleAppearances;
      existing.noAttackWithoutReachingRangeBattles +=
        entry.noAttackWithoutReachingRangeBattleRate * entry.battleAppearances;
      if (entry.averageInitialNearestEnemyDistance != null) {
        existing.totalInitialNearestEnemyDistance +=
          entry.averageInitialNearestEnemyDistance * entry.battleAppearances;
        existing.initialNearestEnemyDistanceSamples += entry.battleAppearances;
      }
      if (entry.averageBestNearestEnemyDistance != null) {
        existing.totalBestNearestEnemyDistance +=
          entry.averageBestNearestEnemyDistance * entry.battleAppearances;
        existing.bestNearestEnemyDistanceSamples += entry.battleAppearances;
      }
      if (entry.averageDistanceClosed != null) {
        existing.totalDistanceClosed += entry.averageDistanceClosed * entry.battleAppearances;
        existing.distanceClosedSamples += entry.battleAppearances;
      }
      existing.noAttackBattles += entry.noAttackBattleRate * entry.battleAppearances;
      existing.movedNoAttackBattles += entry.movedNoAttackBattleRate * entry.battleAppearances;
      existing.attackedNoHitBattles += entry.attackedNoHitBattleRate * entry.battleAppearances;
      existing.lateSingleAttackBattles += entry.lateSingleAttackBattleRate * entry.battleAppearances;
      if (entry.averageOutsideAttackRangeBeforeFirstAttackMs != null) {
        existing.totalOutsideAttackRangeBeforeFirstAttackMs +=
          entry.averageOutsideAttackRangeBeforeFirstAttackMs * entry.battleAppearances;
      }
      if (entry.averageInAttackRangeBeforeFirstAttackMs != null) {
        existing.totalInAttackRangeBeforeFirstAttackMs +=
          entry.averageInAttackRangeBeforeFirstAttackMs * entry.battleAppearances;
      }
      if (entry.averageAfterFirstAttackMs != null) {
        existing.totalAfterFirstAttackMs += entry.averageAfterFirstAttackMs * entry.battleAppearances;
      }
      existing.totalLeftLateralMoveCount += entry.averageLeftLateralMovesPerBattle * entry.battleAppearances;
      existing.totalRightLateralMoveCount += entry.averageRightLateralMovesPerBattle * entry.battleAppearances;
      existing.sharedPursuitMoveSampleCount += entry.sharedPursuitMoveSampleCount;
      if (entry.contestedPursuitMoveRate != null) {
        existing.contestedPursuitMoveSampleCount +=
          entry.contestedPursuitMoveRate * entry.sharedPursuitMoveSampleCount;
      }
      existing.plannedApproachGroupMoveSampleCount += entry.plannedApproachGroupMoveSampleCount;
      if (entry.averagePlannedApproachGroupCompetitorCount != null) {
        existing.totalPlannedApproachGroupCompetitorCount +=
          entry.averagePlannedApproachGroupCompetitorCount * entry.plannedApproachGroupMoveSampleCount;
      }
      if (entry.averagePlannedApproachGroupAssignedCount != null) {
        existing.totalPlannedApproachGroupAssignedCount +=
          entry.averagePlannedApproachGroupAssignedCount * entry.plannedApproachGroupMoveSampleCount;
      }
      if (entry.oversubscribedPlannedApproachGroupRate != null) {
        existing.oversubscribedPlannedApproachGroupMoveCount +=
          entry.oversubscribedPlannedApproachGroupRate * entry.plannedApproachGroupMoveSampleCount;
      }
      existing.plannedApproachBattleCount += entry.plannedApproachBattleCount;
      existing.plannedApproachMoveSampleCount += entry.plannedApproachMoveSampleCount;
      if (entry.plannedApproachStillOpenRate != null) {
        existing.plannedApproachStillOpenMoveCount +=
          entry.plannedApproachStillOpenRate * entry.plannedApproachMoveSampleCount;
      }
      if (entry.usedPlannedApproachRate != null) {
        existing.usedPlannedApproachMoveCount +=
          entry.usedPlannedApproachRate * entry.plannedApproachMoveSampleCount;
      }
      if (entry.plannedApproachPathBlockedRate != null) {
        existing.plannedApproachPathBlockedMoveCount +=
          entry.plannedApproachPathBlockedRate * entry.plannedApproachMoveSampleCount;
      }
      if (entry.plannedApproachFirstAttackRate != null) {
        existing.plannedApproachWithFirstAttackCount +=
          entry.plannedApproachFirstAttackRate * entry.plannedApproachBattleCount;
      }
      if (entry.plannedApproachMatchedFirstAttackTargetRate != null) {
        existing.plannedApproachMatchedFirstAttackTargetCount +=
          entry.plannedApproachMatchedFirstAttackTargetRate * entry.plannedApproachBattleCount;
      }
      if (entry.plannedApproachReachedRangeWithoutAttackRate != null) {
        existing.plannedApproachReachedRangeWithoutAttackCount +=
          entry.plannedApproachReachedRangeWithoutAttackRate * entry.plannedApproachBattleCount;
      }
      if (entry.plannedApproachNoReachNoAttackRate != null) {
        existing.plannedApproachNoReachNoAttackCount +=
          entry.plannedApproachNoReachNoAttackRate * entry.plannedApproachBattleCount;
      }
      if (entry.plannedApproachNoAttackTargetDiedBeforeBattleEndRate != null) {
        existing.plannedApproachNoAttackTargetDiedBeforeBattleEndCount +=
          entry.plannedApproachNoAttackTargetDiedBeforeBattleEndRate * entry.plannedApproachBattleCount;
      }
      if (entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate != null) {
        existing.plannedApproachReachedRangeWithoutAttackWhileTargetAliveCount +=
          entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate * entry.plannedApproachBattleCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveRate * entry.plannedApproachBattleCount;
      }
      const reachedWhileAliveCount = entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate != null
        ? entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate * entry.plannedApproachBattleCount
        : 0;
      const noReachWhileAliveCount = entry.plannedApproachNoReachNoAttackWhileTargetAliveRate != null
        ? entry.plannedApproachNoReachNoAttackWhileTargetAliveRate * entry.plannedApproachBattleCount
        : 0;
      if (entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate != null) {
        existing.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationCount +=
          entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate
          * reachedWhileAliveCount;
      }
      if (entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate != null) {
        existing.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedCount +=
          entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate
          * reachedWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate
          * noReachWhileAliveCount;
      }
      if (entry.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate != null) {
        existing.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeCount +=
          entry.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate
          * noReachWhileAliveCount;
      }
      existing.firstLateralMoveSamples += entry.firstLateralMoveSamples;
      if (entry.firstLateralMoveLeftRate != null) {
        existing.firstLateralMoveLeftBattles +=
          entry.firstLateralMoveLeftRate * entry.firstLateralMoveSamples;
      }
      if (entry.firstLateralMoveRightRate != null) {
        existing.firstLateralMoveRightBattles +=
          entry.firstLateralMoveRightRate * entry.firstLateralMoveSamples;
      }
      if (entry.averageFirstReachedAttackRangeAtMs != null) {
        existing.totalFirstReachedAttackRangeAtMs +=
          entry.averageFirstReachedAttackRangeAtMs * entry.firstReachedAttackRangeSamples;
        existing.firstReachedAttackRangeSamples += entry.firstReachedAttackRangeSamples;
      }
      existing.moveTargetDiagnosticSampleCount += entry.moveTargetDiagnosticSampleCount;
      if (entry.suboptimalMoveTargetRate != null) {
        existing.suboptimalMoveTargetCount +=
          entry.suboptimalMoveTargetRate * entry.moveTargetDiagnosticSampleCount;
      }
      if (entry.averageExcessApproachSteps != null) {
        existing.totalExcessApproachSteps +=
          entry.averageExcessApproachSteps * entry.moveTargetDiagnosticSampleCount;
        existing.excessApproachStepSamples += entry.moveTargetDiagnosticSampleCount;
      }
      rangeActionDiagnosticsByKey.set(key, existing);
    }

    for (const entry of aggregate.rangeFormationDiagnosticsMetrics ?? []) {
      const key = `${entry.side}::${entry.rangeBand}`;
      const existing = rangeFormationDiagnosticsByKey.get(key)
        ?? createRangeFormationDiagnosticsAccumulator(entry.side, entry.rangeBand);
      existing.battleAppearances += entry.battleAppearances;
      existing.frontAllyBlockedBattles += entry.frontAllyBlockedBattleRate * entry.battleAppearances;
      if (entry.averageFrontAllyCount != null) {
        existing.totalFrontAllyCount += entry.averageFrontAllyCount * entry.battleAppearances;
        existing.frontAllyCountSamples += entry.battleAppearances;
      }
      if (entry.averageInitialRow != null) {
        existing.totalInitialRow += entry.averageInitialRow * entry.battleAppearances;
        existing.initialRowSamples += entry.battleAppearances;
      }
      if (entry.averageInitialColumn != null) {
        existing.totalInitialColumn += entry.averageInitialColumn * entry.battleAppearances;
        existing.initialColumnSamples += entry.battleAppearances;
      }
      const withFrontSamples = Math.round(entry.frontAllyBlockedBattleRate * entry.battleAppearances);
      const withoutFrontSamples = Math.max(0, entry.battleAppearances - withFrontSamples);
      existing.withFrontAllySamples += withFrontSamples;
      existing.withoutFrontAllySamples += withoutFrontSamples;
      if (entry.zeroDamageBattleRateWithFrontAlly != null) {
        existing.zeroDamageWithFrontAllyBattles += entry.zeroDamageBattleRateWithFrontAlly * withFrontSamples;
      }
      if (entry.zeroDamageBattleRateWithoutFrontAlly != null) {
        existing.zeroDamageWithoutFrontAllyBattles +=
          entry.zeroDamageBattleRateWithoutFrontAlly * withoutFrontSamples;
      }
      if (entry.noAttackBattleRateWithFrontAlly != null) {
        existing.noAttackWithFrontAllyBattles += entry.noAttackBattleRateWithFrontAlly * withFrontSamples;
      }
      if (entry.noAttackBattleRateWithoutFrontAlly != null) {
        existing.noAttackWithoutFrontAllyBattles +=
          entry.noAttackBattleRateWithoutFrontAlly * withoutFrontSamples;
      }
      rangeFormationDiagnosticsByKey.set(key, existing);
    }

    for (const entry of aggregate.raidMeleeCohortMetrics ?? []) {
      const existing = raidMeleeCohortMetricsByKey.get(entry.cohort)
        ?? createRaidMeleeCohortAccumulator(entry.cohort);
      existing.battleAppearances += entry.battleAppearances;
      existing.totalDamage += entry.averageDamagePerBattle * entry.battleAppearances;
      existing.totalAttackCount += entry.averageAttackCountPerBattle * entry.battleAppearances;
      if (entry.averageFirstAttackMs != null) {
        const firstAttackSamples = entry.battleAppearances * (1 - entry.zeroDamageBattleRate);
        existing.totalFirstAttackMs += entry.averageFirstAttackMs * firstAttackSamples;
        existing.firstAttackSamples += firstAttackSamples;
      }
      existing.totalLifetimeMs += entry.averageLifetimeMs * entry.battleAppearances;
      existing.zeroDamageBattles += entry.zeroDamageBattleRate * entry.battleAppearances;
      existing.survivedBattles += entry.survivalRate * entry.battleAppearances;
      raidMeleeCohortMetricsByKey.set(entry.cohort, existing);
    }

    for (const entry of aggregate.raidSpecialMeleeUnitDiagnostics ?? []) {
      const existing = raidSpecialMeleeUnitDiagnosticsById.get(entry.unitId)
        ?? createRaidSpecialMeleeUnitDiagnosticAccumulator(entry.unitId, entry.unitName);
      existing.battleAppearances += entry.battleAppearances;
      existing.totalDamage += entry.averageDamagePerBattle * entry.battleAppearances;
      existing.totalAttackCount += entry.averageAttackCountPerBattle * entry.battleAppearances;
      if (entry.averageFirstAttackMs != null) {
        existing.totalFirstAttackMs += entry.averageFirstAttackMs * entry.firstAttackSamples;
        existing.firstAttackSamples += entry.firstAttackSamples;
      }
      if (entry.averageFirstReachedAttackRangeAtMs != null) {
        existing.totalFirstReachedAttackRangeAtMs +=
          entry.averageFirstReachedAttackRangeAtMs * entry.firstReachedAttackRangeSamples;
        existing.firstReachedAttackRangeSamples += entry.firstReachedAttackRangeSamples;
      }
      existing.noAttackWithoutReachingRangeBattles +=
        entry.noAttackWithoutReachingRangeBattleRate * entry.battleAppearances;
      existing.noAttackDespiteReachingRangeBattles +=
        entry.noAttackDespiteReachingRangeBattleRate * entry.battleAppearances;
      existing.sharedPursuitMoveSampleCount += entry.sharedPursuitMoveSampleCount;
      if (entry.contestedPursuitMoveRate != null) {
        existing.contestedPursuitMoveSampleCount +=
          entry.contestedPursuitMoveRate * entry.sharedPursuitMoveSampleCount;
      }
      existing.zeroDamageBattles += entry.zeroDamageBattleRate * entry.battleAppearances;
      existing.survivedBattles += entry.survivalRate * entry.battleAppearances;
      raidSpecialMeleeUnitDiagnosticsById.set(entry.unitId, existing);
    }
  }

  const raidWins = completedMatches - bossWins;
  const aggregate: BotOnlyBaselineAggregateReport = {
    requestedMatchCount,
    completedMatches,
    abortedMatches: Math.max(0, requestedMatchCount - completedMatches),
    bossWins,
    raidWins,
    bossWinRate: bossWins / completedMatches,
    raidWinRate: raidWins / completedMatches,
    averageRounds: totalRounds / completedMatches,
    minRounds: Number.isFinite(minRounds) ? minRounds : 0,
    maxRounds,
    averageRemainingRaidPlayers: totalRemainingRaidPlayers / completedMatches,
    battleMetrics: totalBattles > 0
      ? {
        totalBattles,
        averageBossSurvivorsAtBattleEnd: totalBossSurvivorsAtBattleEnd / totalBattles,
        averageRaidSurvivorsAtBattleEnd: totalRaidSurvivorsAtBattleEnd / totalBattles,
        bothSidesSurvivedRate: bothSidesSurvivedBattles / totalBattles,
        bossWipedRate: bossWipedBattles / totalBattles,
        raidWipedRate: raidWipedBattles / totalBattles,
        endReasonCounts: battleEndReasonCounts,
      }
      : buildEmptyBattleMetrics(),
    roundHistogram: Object.fromEntries(
      Array.from(roundHistogram.entries()).sort(
        ([leftRound], [rightRound]) => Number(leftRound) - Number(rightRound),
      ),
    ),
    playerMetrics: Object.fromEntries(
      Array.from(appearanceCountsByLabel.entries())
        .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel))
        .map(([label, appearanceCount]) => [label, {
          averagePlacement: (placementTotalsByLabel.get(label) ?? 0) / appearanceCount,
          firstPlaceRate: (firstPlaceTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageRemainingHp: (hpTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageRemainingLives: (remainingLivesTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageFinalGold: (finalGoldTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageGoldEarned: (goldEarnedTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageGoldSpent: (goldSpentTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averagePurchaseCount: (purchaseCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageRefreshCount: (refreshCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageSellCount: (sellCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
          averageSpecialUnitUpgradeCount:
            (specialUnitUpgradeCountTotalsByLabel.get(label) ?? 0) / appearanceCount,
        }]),
    ),
    heroTeamMetrics: buildHeroTeamMetrics(heroTeamMetricsById.values()),
    heroCompositionMetrics: buildHeroCompositionMetrics(heroCompositionMetricsByKey.values()),
    playerEconomyBreakdowns: Object.fromEntries(
      Array.from(appearanceCountsByLabel.entries())
        .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel))
        .map(([label, appearanceCount]) => [
          label,
          dividePlayerEconomyBreakdown(
            economyBreakdownTotalsByLabel.get(label) ?? createEmptyPlayerEconomyBreakdown(),
            appearanceCount,
          ),
        ]),
    ),
    bossBattleUnitMetrics: Array.from(bossBattleUnitsById.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.totalDamage - left.totalDamage
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => buildBattleUnitMetrics(entry, completedMatches)),
    raidBattleUnitMetrics: Array.from(raidBattleUnitsById.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.totalDamage - left.totalDamage
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => buildBattleUnitMetrics(entry, completedMatches)),
    ...(okinaSubHostsById.size > 0
      ? {
        okinaSubHostMetrics: Array.from(okinaSubHostsById.values())
          .sort((left, right) =>
            right.battleAppearances - left.battleAppearances
            || right.totalDamage - left.totalDamage
            || left.hostUnitId.localeCompare(right.hostUnitId))
          .map((entry) => buildOkinaSubHostMetric(entry)),
      }
      : {}),
    ...(okinaSubHostsByRoundAndId.size > 0
      ? {
        okinaSubHostRoundMetrics: Array.from(okinaSubHostsByRoundAndId.values())
          .sort((left, right) =>
            left.roundIndex - right.roundIndex
            || right.battleAppearances - left.battleAppearances
            || right.totalDamage - left.totalDamage
            || left.hostUnitId.localeCompare(right.hostUnitId))
          .map((entry) => buildOkinaSubHostRoundMetric(entry)),
      }
      : {}),
    ...(okinaHeroSubDecisionsByRound.size > 0
      ? {
        okinaHeroSubDecisionRoundMetrics: Array.from(okinaHeroSubDecisionsByRound.values())
          .sort((left, right) => left.roundIndex - right.roundIndex)
          .map((entry) => buildOkinaHeroSubDecisionRoundMetric(entry)),
      }
      : {}),
    ...(boardRefitDecisionsByRound.size > 0
      ? {
        boardRefitDecisionRoundMetrics: Array.from(boardRefitDecisionsByRound.values())
          .sort((left, right) => left.roundIndex - right.roundIndex)
          .map((entry) => buildBoardRefitDecisionRoundMetric(entry)),
      }
      : {}),
    ...(boardRefitDecisionsByRole.size > 0
      ? {
        boardRefitDecisionRoleMetrics: Array.from(boardRefitDecisionsByRole.values())
          .sort((left, right) => left.role.localeCompare(right.role))
          .map((entry) => buildBoardRefitDecisionRoleMetric(entry)),
      }
      : {}),
    ...(boardRefitDecisionsByRoleRound.size > 0
      ? {
        boardRefitDecisionRoleRoundMetrics: Array.from(boardRefitDecisionsByRoleRound.values())
          .sort((left, right) =>
            left.role.localeCompare(right.role)
            || left.roundIndex - right.roundIndex)
          .map((entry) => buildBoardRefitDecisionRoleRoundMetric(entry)),
      }
      : {}),
    finalPlayerBoardMetrics: Array.from(finalPlayerBoardMetricsByLabel.values())
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((entry) => buildFinalPlayerBoardMetric(entry)),
    finalBoardUnitMetrics: Array.from(finalBoardUnitsById.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.totalCopies - left.totalCopies
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => ({
        unitId: entry.unitId,
        unitType: entry.unitType,
        unitName: entry.unitName,
        totalCopies: entry.totalCopies,
        matchesPresent: entry.matchesPresent,
        averageCopiesPerMatch: entry.totalCopies / completedMatches,
        adoptionRate: entry.matchesPresent / completedMatches,
        averageFinalUnitLevel: entry.totalCopies > 0 ? entry.totalUnitLevel / entry.totalCopies : 0,
        maxFinalUnitLevel: entry.maxUnitLevel,
        finalLevel4Rate: entry.totalCopies > 0 ? entry.level4Copies / entry.totalCopies : 0,
        finalLevel7Rate: entry.totalCopies > 0 ? entry.level7Copies / entry.totalCopies : 0,
      })),
    topDamageUnits: Array.from(topDamageUnitsByKey.values())
      .sort((left, right) =>
        right.totalDamage - left.totalDamage
        || right.appearances - left.appearances
        || left.unitId.localeCompare(right.unitId))
      .slice(0, 10)
      .map((entry) => ({
        unitId: entry.unitId,
        unitName: entry.unitName,
        side: entry.side,
        totalDamage: entry.totalDamage,
        appearances: entry.appearances,
        averageDamagePerMatch: entry.totalDamage / completedMatches,
      })),
    highCostSummary: {
      offerObservationCount: highCostOfferObservationCount,
      offerMatchCount: highCostOfferMatchCount,
      purchaseCount: highCostPurchaseCount,
      purchaseMatchCount: highCostPurchaseMatchCount,
      finalBoardCopies: highCostFinalBoardCopies,
      finalBoardMatchCount: highCostFinalBoardMatchCount,
      finalBoardAdoptionRate: highCostFinalBoardMatchCount / completedMatches,
    },
    highCostOfferMetrics: Array.from(highCostOfferMetricsByKey.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.observationCount - left.observationCount
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => ({
        ...entry,
        offeredMatchRate: entry.matchesPresent / completedMatches,
      })),
    bossExclusiveRoundLevelMetrics: Array.from(bossExclusiveRoundLevelByKey.values())
      .map((entry) => buildBossExclusiveRoundLevelMetric(entry))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.unitId.localeCompare(right.unitId)),
    highCostRoundMetrics: Array.from(highCostRoundMetricsByKey.values())
      .map((entry) => buildHighCostRoundMetric(entry, completedMatches))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.role.localeCompare(right.role)
        || left.source.localeCompare(right.source)
        || left.unitId.localeCompare(right.unitId)),
    roundDamageEfficiencyMetrics: Array.from(roundDamageEfficiencyByKey.values())
      .map((entry) => buildRoundDamageEfficiencyMetric(entry))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.side.localeCompare(right.side)
        || ((right.damagePerInvestmentCost ?? -1) - (left.damagePerInvestmentCost ?? -1))
        || right.totalDamage - left.totalDamage
        || left.unitId.localeCompare(right.unitId)),
    unitDamageEfficiencyMetrics: buildUnitDamageEfficiencyMetrics(roundDamageEfficiencyByKey.values()),
    roundSurvivalDiagnostics: Array.from(roundSurvivalDiagnosticsByRound.values())
      .map((entry) => buildRoundSurvivalDiagnosticMetric(entry))
      .sort((left, right) => left.roundIndex - right.roundIndex),
    roundUnitSurvivalDiagnostics: Array.from(roundUnitSurvivalDiagnosticsByKey.values())
      .map((entry) => buildRoundUnitSurvivalDiagnosticMetric(entry))
      .sort((left, right) =>
        left.roundIndex - right.roundIndex
        || left.side.localeCompare(right.side)
        || left.unitId.localeCompare(right.unitId)),
    shopOfferMetrics: Array.from(shopOfferMetricsByKey.values())
      .sort((left, right) =>
        right.matchesPresent - left.matchesPresent
        || right.observationCount - left.observationCount
        || left.unitId.localeCompare(right.unitId))
      .map((entry) => ({
        ...entry,
        offeredMatchRate: completedMatches > 0 ? entry.matchesPresent / completedMatches : 0,
        // purchaseRate is defined over observed offers; purchases should have matching offer observations.
        purchaseRate: entry.observationCount > 0 ? entry.purchaseCount / entry.observationCount : 0,
        finalBoardAdoptionRate: completedMatches > 0 ? entry.finalBoardMatchCount / completedMatches : 0,
      })),
    rangeDamageEfficiencyMetrics: Array.from(rangeDamageEfficiencyByKey.values())
      .sort((left, right) =>
        left.side.localeCompare(right.side)
        || left.rangeBand.localeCompare(right.rangeBand))
      .map((entry) => buildRangeDamageEfficiencyMetric(entry)),
    rangeActionDiagnosticsMetrics: Array.from(rangeActionDiagnosticsByKey.values())
      .sort((left, right) =>
        left.side.localeCompare(right.side)
        || left.rangeBand.localeCompare(right.rangeBand))
      .map((entry) => buildRangeActionDiagnosticsMetric(entry)),
    rangeFormationDiagnosticsMetrics: Array.from(rangeFormationDiagnosticsByKey.values())
      .sort((left, right) =>
        left.side.localeCompare(right.side)
        || left.rangeBand.localeCompare(right.rangeBand))
      .map((entry) => buildRangeFormationDiagnosticsMetric(entry)),
    raidMeleeCohortMetrics: Array.from(raidMeleeCohortMetricsByKey.values())
      .sort((left, right) => left.cohort.localeCompare(right.cohort))
      .map((entry) => buildRaidMeleeCohortMetric(entry)),
    raidSpecialMeleeUnitDiagnostics: Array.from(raidSpecialMeleeUnitDiagnosticsById.values())
      .sort((left, right) => left.unitId.localeCompare(right.unitId))
      .map((entry) => buildRaidSpecialMeleeUnitDiagnostic(entry)),
    roundDetails,
  };

  return sharedMetadata == null
    ? aggregate
    : {
      ...aggregate,
      metadata: sharedMetadata,
    };
}
