import { HERO_EXCLUSIVE_UNITS } from "../../../src/data/hero-exclusive-units";
import { HEROES } from "../../../src/data/heroes";
import { SCARLET_MANSION_UNITS } from "../../../src/data/scarlet-mansion-units";
import { TOUHOU_UNITS } from "../../../src/data/touhou-units";
import { getUnitLevelCombatMultiplier } from "../../../src/server/unit-level-config";
import { BOSS_CHARACTERS } from "../../../src/shared/boss-characters";
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
};

export type BotOnlyBaselineTopDamageUnit = {
  unitId: string;
  unitName: string;
  side: "boss" | "raid";
  totalDamage: number;
  appearances: number;
  averageDamagePerMatch: number;
};

export type BotOnlyBaselinePurchase = {
  playerId: string;
  label: string;
  actionType: "buy_unit" | "buy_boss_unit";
  unitType: string;
  unitId?: string;
  unitName?: string;
  cost: number;
};

export type BotOnlyBaselineObservedShopOffer = {
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
};

export type BotOnlyBaselineRoundUnitDetail = {
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  side: "boss" | "raid";
  totalDamage: number;
  phaseContributionDamage: number;
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
  raidPlayerConsequences: BotOnlyBaselineRoundPlayerConsequence[];
  topBossUnits: BotOnlyBaselineRoundUnitDetail[];
  topRaidUnits: BotOnlyBaselineRoundUnitDetail[];
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
  bossBattleUnitMetrics: BotOnlyBaselineBattleUnitMetrics[];
  raidBattleUnitMetrics: BotOnlyBaselineBattleUnitMetrics[];
  finalBoardUnitMetrics: BotOnlyBaselineFinalBoardUnitMetrics[];
  topDamageUnits: BotOnlyBaselineTopDamageUnit[];
  highCostSummary?: BotOnlyBaselineHighCostSummary;
  highCostOfferMetrics?: BotOnlyBaselineHighCostOfferMetric[];
  shopOfferMetrics?: BotOnlyBaselineShopOfferMetric[];
  rangeDamageEfficiencyMetrics: BotOnlyBaselineRangeDamageEfficiencyMetric[];
  rangeActionDiagnosticsMetrics: BotOnlyBaselineRangeActionDiagnosticsMetric[];
  rangeFormationDiagnosticsMetrics: BotOnlyBaselineRangeFormationDiagnosticsMetric[];
  raidMeleeCohortMetrics?: BotOnlyBaselineRaidMeleeCohortMetric[];
  raidSpecialMeleeUnitDiagnostics?: BotOnlyBaselineRaidSpecialMeleeUnitDiagnostic[];
  roundDetails?: BotOnlyBaselineMatchRoundDetail[];
};

const HIGH_COST_THRESHOLD = 4;
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
  TOUHOU_UNITS.map((unit) => [unit.unitId, unit.cost] as const),
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
      }
      : {}),
  };
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
  return {
    playerId: outcome.playerId,
    label: outcome.label,
    unitId: outcome.unitId,
    unitName: resolveBaselineUnitName(outcome.unitId, outcome.unitName),
    side: outcome.side,
    totalDamage: outcome.totalDamage,
    phaseContributionDamage: outcome.phaseContributionDamage,
    finalHp: outcome.finalHp,
    alive: outcome.alive,
    unitLevel: outcome.unitLevel,
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

    return {
      matchIndex,
      matchWinnerRole,
      totalRounds: report.totalRounds,
      roundIndex: round.roundIndex,
      battleEndTimeMs,
      phaseHpTarget: round.phaseHpTarget,
      phaseDamageDealt: round.phaseDamageDealt,
      phaseCompletionRate: round.phaseCompletionRate,
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
      raidPlayerConsequences,
      topBossUnits: bossUnitOutcomes
        .map((unit) => toRoundUnitDetail(unit))
        .sort((left, right) =>
          right.totalDamage - left.totalDamage
          || right.finalHp - left.finalHp
          || left.unitId.localeCompare(right.unitId))
        .slice(0, 5),
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
  return {
    unitId: entry.unitId,
    unitType: entry.unitType,
    unitName: entry.unitName,
    battleAppearances: entry.battleAppearances,
    matchesPresent: entry.matchesPresent,
    averageunitLevel: entry.totalunitLevel / entry.battleAppearances,
    maxUnitLevel: entry.maxUnitLevel,
    level4ReachRate: entry.matchesPresent > 0
      ? entry.level4Matches / entry.matchesPresent
      : 0,
    level7ReachRate: entry.matchesPresent > 0
      ? entry.level7Matches / entry.matchesPresent
      : 0,
    averageDamagePerBattle: entry.totalDamage / entry.battleAppearances,
    averageDamagePerMatch: entry.totalDamage / completedMatches,
    activeBattleRate: entry.activeBattles / entry.battleAppearances,
    averageAttackCountPerBattle: entry.totalAttackCount / entry.battleAppearances,
    averageHitCountPerBattle: entry.totalHitCount / entry.battleAppearances,
    averageDamageTakenPerBattle: entry.totalDamageTaken / entry.battleAppearances,
    averageFirstAttackMs: entry.firstAttackSamples > 0
      ? entry.totalFirstAttackMs / entry.firstAttackSamples
      : null,
    averageLifetimeMs: entry.totalLifetimeMs / entry.battleAppearances,
    zeroDamageBattleRate: entry.zeroDamageBattles / entry.battleAppearances,
    survivalRate: entry.survivedBattles / entry.battleAppearances,
    ownerWinRate: entry.ownerWins / entry.battleAppearances,
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
  };
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
      bossBattleUnitMetrics: [],
      raidBattleUnitMetrics: [],
      finalBoardUnitMetrics: [],
      topDamageUnits: [],
      highCostSummary: buildEmptyHighCostSummary(),
      highCostOfferMetrics: [],
      shopOfferMetrics: [],
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
  const purchaseCountTotalsByLabel = new Map<string, number>();
  const refreshCountTotalsByLabel = new Map<string, number>();
  const sellCountTotalsByLabel = new Map<string, number>();
  const specialUnitUpgradeCountTotalsByLabel = new Map<string, number>();
  const remainingLivesTotalsByLabel = new Map<string, number>();
  const bossBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const raidBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const finalBoardUnitsById = new Map<string, {
    unitId: string;
    unitType: string;
    unitName: string;
    totalCopies: number;
    matchesPresent: number;
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
    roundDetails.push(...buildRoundDetailsForMatch(report, matchIndex));

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

    const playerById = new Map(
      report.finalPlayers.map((player) => [player.playerId, player] as const),
    );
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
      for (const boardUnit of player.boardUnits) {
        const existing = finalBoardUnitsById.get(boardUnit.unitId) ?? {
          unitId: boardUnit.unitId,
          unitType: boardUnit.unitType,
          unitName: boardUnit.unitName,
          totalCopies: 0,
          matchesPresent: 0,
        };
        existing.totalCopies += 1;
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
    }
    if (matchHasHighCostPurchase) {
      highCostPurchaseMatchCount += 1;
    }

    let matchHasHighCostOffer = false;
    const seenShopOfferMetricKeysInMatch = new Set<string>();
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
      existing.matchesPresent += 1;
      highCostOfferMetricsByKey.set(key, existing);
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
          existing.subUnitBattleAppearances = (existing.subUnitBattleAppearances ?? 0) + 1;
          if (!seenRaidSubUnitsInMatch.has(resolvedUnitId)) {
            existing.subUnitMatchesPresent = (existing.subUnitMatchesPresent ?? 0) + 1;
            seenRaidSubUnitsInMatch.add(resolvedUnitId);
          }
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
      bossBattleUnitMetrics: [],
      raidBattleUnitMetrics: [],
      finalBoardUnitMetrics: [],
      topDamageUnits: [],
      highCostSummary: buildEmptyHighCostSummary(),
      highCostOfferMetrics: [],
      shopOfferMetrics: [],
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
  const purchaseCountTotalsByLabel = new Map<string, number>();
  const refreshCountTotalsByLabel = new Map<string, number>();
  const sellCountTotalsByLabel = new Map<string, number>();
  const specialUnitUpgradeCountTotalsByLabel = new Map<string, number>();
  const remainingLivesTotalsByLabel = new Map<string, number>();
  const appearanceCountsByLabel = new Map<string, number>();
  const bossBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const raidBattleUnitsById = new Map<string, BattleUnitAggregateAccumulator>();
  const finalBoardUnitsById = new Map<string, {
    unitId: string;
    unitType: string;
    unitName: string;
    totalCopies: number;
    matchesPresent: number;
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
        topRaidUnits: detail.topRaidUnits.map((unit) => ({ ...unit })),
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
      raidBattleUnitsById.set(entry.unitId, existing);
    }

    for (const entry of aggregate.finalBoardUnitMetrics) {
      const existing = finalBoardUnitsById.get(entry.unitId) ?? {
        unitId: entry.unitId,
        unitType: entry.unitType,
        unitName: entry.unitName,
        totalCopies: 0,
        matchesPresent: 0,
      };
      existing.totalCopies += entry.totalCopies;
      existing.matchesPresent += entry.matchesPresent;
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
