import { SCARLET_MANSION_UNITS } from "../../../src/data/scarlet-mansion-units";
import type {
  BotOnlyBaselineAggregateReport,
  BotOnlyBaselineBattleEndReason,
  BotOnlyBaselineRoundUnitDetail,
} from "./bot-balance-baseline-aggregate";
import type { BotBalanceBaselineSummary } from "./bot-balance-baseline-human-report";

export type DiagnosticSeverity = "info" | "warning" | "critical";
export type AnalysisStatus = "pass" | "warning" | "fail";
export type BalanceStatus = "not_evaluated" | "pass" | "watch" | "needs_adjustment";

export type DiagnosticEvidence = {
  matchIndex: number;
  roundIndex?: number;
  playerLabel?: string;
  unitId?: string;
  unitName?: string;
  observed: Record<string, unknown>;
  expected?: Record<string, unknown>;
};

export type IntegrityIssue = {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  evidence: DiagnosticEvidence[];
};

export type BalanceIssue = {
  code: string;
  severity: DiagnosticSeverity;
  confidence: number;
  message: string;
  evidence: DiagnosticEvidence[];
  recommendedNextAction: "bug_investigation" | "balance_adjustment" | "collect_more_samples" | "spec_check";
};

export type OverviewMetrics = {
  completedMatches: number;
  abortedMatches: number;
  abortRate: number;
  bossWinRate: number;
  raidWinRate: number;
  averageRounds: number;
  r12ReachRate: number;
  integrityStatus: AnalysisStatus;
  balanceStatus: BalanceStatus;
};

export type IntegrityAnalysis = {
  status: AnalysisStatus;
  checkedMatchCount: number;
  forcedBattleCount: number;
  forcedBattleRate: number;
  unexpectedEndCount: number;
  contradictionCount: number;
  phaseTransitionIssueCount: number;
  finalBattleRuleViolationCount: number;
  issues: IntegrityIssue[];
};

export type BalanceAnalysis = {
  status: BalanceStatus;
  sampleUsability: "usable" | "partially_usable" | "not_usable";
  bossWinRate: { value: number; targetMin: number; targetMax: number };
  r12ReachRate: { value: number; targetMin: number; targetMax: number };
  finalBattleRaidWinRate: { value: number; targetMin: number; targetMax: number };
  issues: BalanceIssue[];
};

export type RoundPhaseAnalysis = {
  roundIndex: number;
  sampleCount: number;
  objectiveType: "phaseHp" | "finalBossBody";
  phaseHpTarget?: number;
  phaseSuccessRate?: number;
  averagePhaseDamage?: number;
  averageCompletionRate?: number;
  averagePhaseHpPowerIndex?: number;
  raidWipeRate: number;
  bossWipeRate: number;
  timeoutRate: number;
  averageBattleEndSeconds: number;
  averageBattleEndRealPlaySeconds: number;
};

export type FinalBattleBossBodyProtectionAnalysis = {
  bossBodyDefeatedWithBossSurvivorsCount: number;
  bossBodyDefeatedWithBossSurvivorsSampleRate: number;
  bossBodyDefeatedWithBossSurvivorsDefeatRate: number;
  averageBossSurvivorsWhenBodyDefeated: number;
  averageBossSurvivorsWhenBossWins: number;
  averageRaidSurvivorsWhenBodyDefeated: number;
  directGuardAliveWhenBodyBreachedCount: number;
  directGuardAliveWhenBodyBreachedRate: number;
  directGuardDefeatedWhenBodyBreachedCount: number;
  directGuardDefeatedWhenBodyBreachedRate: number;
  directGuardOutcomesWhenBodyBreached: FinalBattleDirectGuardOutcomeBreakdown[];
  survivingBossUnitsWhenBodyBreached: FinalBattleUnitPresenceBreakdown[];
  raidBodyDamageContributorsWhenBodyBreached: FinalBattleRaidBodyDamageContributorBreakdown[];
};

export type FinalBattleUnitPresenceBreakdown = {
  unitId: string;
  unitName: string;
  unitType: string;
  sampleCount: number;
  sampleRate: number;
  averageUnitLevel: number;
  averageFinalHp: number;
};

export type FinalBattleRaidBodyDamageContributorBreakdown = FinalBattleUnitPresenceBreakdown & {
  totalPhaseContributionDamage: number;
  phaseContributionShare: number;
  averagePhaseContributionDamage: number;
  averageTotalDamage: number;
};

export type FinalBattleRaidUnitOutcomeBreakdown = FinalBattleUnitPresenceBreakdown & {
  totalDamage: number;
  totalPhaseContributionDamage: number;
  averageTotalDamage: number;
  averagePhaseContributionDamage: number;
};

export type FinalBattleBossDamageContributorBreakdown = FinalBattleUnitPresenceBreakdown & {
  totalDamage: number;
  damageShare: number;
  averageTotalDamage: number;
};

export type FinalBattleDirectGuardOutcomeBreakdown = FinalBattleUnitPresenceBreakdown & {
  aliveAtBattleEndCount: number;
  aliveAtBattleEndRate: number;
  defeatedAtBattleEndCount: number;
  defeatedAtBattleEndRate: number;
  averageDamageTaken: number;
  matchedDecisionUnitCount: number;
  matchedDecisionUnitRate: number;
};

export type FinalBattleBossOffenseAnalysis = {
  defeatedRaidUnitsWhenBossWins: FinalBattleRaidUnitOutcomeBreakdown[];
  bossDamageContributorsWhenBossWins: FinalBattleBossDamageContributorBreakdown[];
  survivingRaidDamageContributorsWhenBodyBreached: FinalBattleRaidBodyDamageContributorBreakdown[];
};

export type FinalBattleBossSpellAnalysis = {
  spellId: string;
  sampleCount: number;
  activationCount: number;
  activationRate: number;
  averageFirstActivationMs: number | null;
  averageTickCount: number;
  averageTotalDamage: number;
  averageMaxStack: number | null;
};

export type FinalBattleOutcomeContrast = {
  winner: "boss" | "raid";
  sampleCount: number;
  sampleRate: number;
  bossBodyDefeatRate: number;
  averageBossBodyDamage: number;
  averageBossRemainingHp: number;
  averageBossSurvivors: number;
  averageRaidSurvivors: number;
  averageRaidPlayersWipedOut: number;
  averageRaidPlayersEliminatedAfterRound: number;
  averageBattleStartUnitsPerRaidPlayer: number;
  directGuardAliveRate: number;
  averageDirectGuardDamageTaken: number;
  averageBossDamage: number;
  averageRaidDamage: number;
  averageRaidPhaseContributionDamage: number;
  averageBossSpellDamage: number;
  averageBattleEndSeconds: number;
  averageBattleEndRealPlaySeconds: number;
};

export type FinalBattleBossWinBodyDamageBucket = {
  bucketId: "zero" | "low" | "mid" | "near";
  label: string;
  minBossBodyDamage: number;
  maxBossBodyDamage: number;
  sampleCount: number;
  sampleRate: number;
  averageBossBodyDamage: number;
  averageBossRemainingHp: number;
  averageBossSurvivors: number;
  averageRaidSurvivors: number;
  averageRaidPlayersWipedOut: number;
  averageBattleStartUnitsPerRaidPlayer: number;
  directGuardAliveRate: number;
  averageDirectGuardDamageTaken: number;
  averageBossDamage: number;
  averageRaidDamage: number;
  averageBossSpellDamage: number;
};

export type FinalBattleAnalysis = {
  sampleCount: number;
  bossBodyHp: number;
  raidWinCount: number;
  bossWinCount: number;
  raidWinRate: number;
  bossDefeatCount: number;
  bossDefeatRate: number;
  simultaneousWipeCount: number;
  averageBossBodyDamage: number;
  averageBossRemainingHp: number;
  averageBattleEndSeconds: number;
  averageBattleEndRealPlaySeconds: number;
  outcomeContrasts: FinalBattleOutcomeContrast[];
  bossWinBodyDamageBuckets: FinalBattleBossWinBodyDamageBucket[];
  bodyProtection: FinalBattleBossBodyProtectionAnalysis;
  bossOffense: FinalBattleBossOffenseAnalysis;
  bossSpells: FinalBattleBossSpellAnalysis[];
  endReasonCounts: Partial<Record<BotOnlyBaselineBattleEndReason, number>>;
  samples: Array<{
    matchIndex: number;
    roundIndex: number;
    bossBodyHp: number;
    bossBodyDamage: number;
    bossDefeated: boolean;
    bossSurvivors: number;
    raidSurvivors: number;
    bossBodyDefeatedWithBossSurvivors: boolean;
    finalBattleWinner: "boss" | "raid";
    matchWinnerRole: "boss" | "raid";
  }>;
};

export type BossBodyFocusAnalysis = {
  earlyRoundCount: number;
  earlyDefeatCount: number;
  earlyDefeatRate: number;
  averageEarlyDamageTaken: number;
  averageEarlyDirectPhaseDamage: number;
  averageEarlyFirstDamageAtMs: number | null;
};

export type EconomyMetrics = {
  averageFinalGold: number;
  averageGoldEarned: number;
  averageGoldSpent: number;
  averagePurchaseCount: number;
  averageRefreshCount: number;
  averageSellCount: number;
  averageSpecialUnitUpgradeCount: number;
  unusedGoldRate: number;
};

export type EconomyAnalysis = {
  overall: EconomyMetrics;
  byPlayer: Record<string, EconomyMetrics>;
};

export type UnitCategory = "hero" | "normal" | "heroExclusive" | "bossExclusive" | "bossBody";

export type ProgressionCohortMetrics = {
  unitCount: number;
  averageLevel: number;
  maxLevel: number;
  level4ReachRate: number;
  level7ReachRate: number;
};

export type UnitProgressionMetrics = {
  side: "boss" | "raid";
  unitId: string;
  unitName: string;
  unitCategory: UnitCategory;
  averageLevel: number;
  maxLevel: number;
  level4ReachRate: number;
  level7ReachRate: number;
};

export type ProgressionAnalysis = {
  heroes: ProgressionCohortMetrics;
  normalUnits: ProgressionCohortMetrics;
  heroExclusiveUnits: ProgressionCohortMetrics;
  bossExclusiveUnits: ProgressionCohortMetrics;
  byUnit: UnitProgressionMetrics[];
};

export type ShopOfferAnalysisMetric = {
  unitId: string;
  unitName: string;
  unitType: string;
  role: "boss" | "raid";
  source: "shop" | "bossShop";
  cost: number;
  observationCount: number;
  matchesPresent: number;
  offeredMatchRate: number;
  purchaseCount: number;
  purchaseMatchCount: number;
  purchaseRate: number;
  finalBoardCopies: number;
  finalBoardMatchCount: number;
  finalBoardAdoptionRate: number;
};

export type ShopAnalysis = {
  offerMetrics: ShopOfferAnalysisMetric[];
  mostOffered: ShopOfferAnalysisMetric[];
  highestFinalBoardAdoption: ShopOfferAnalysisMetric[];
};

export type BotBaselineAnalysisReport = {
  schemaVersion: 1;
  generatedAt: string;
  run: {
    requestedMatchCount: number;
    chunkSize: number;
    parallelism: number;
    outputDir: string;
  };
  overview: OverviewMetrics;
  integrity: IntegrityAnalysis;
  balance: BalanceAnalysis;
  rounds: RoundPhaseAnalysis[];
  finalBattle: FinalBattleAnalysis;
  bossBodyFocus: BossBodyFocusAnalysis;
  economy: EconomyAnalysis;
  progression: ProgressionAnalysis;
  shop: ShopAnalysis;
  diagnostics: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
};

const FINAL_BOSS_BODY_HP_FALLBACK = 3000;
const FINAL_BATTLE_ROUND_INDEX = 12;
const BALANCE_SAMPLE_MINIMUM = 10;

function countR12Matches(aggregate: BotOnlyBaselineAggregateReport): number {
  const detailCount = aggregate.roundDetails?.filter((round) => round.roundIndex === 12).length ?? 0;
  return detailCount > 0 ? detailCount : aggregate.roundHistogram["12"] ?? 0;
}

function buildIntegrity(summary: BotBalanceBaselineSummary): IntegrityAnalysis {
  const aggregate = summary.aggregate;
  const forcedBattleCount = aggregate.battleMetrics.endReasonCounts.forced ?? 0;
  const unexpectedEndCount = aggregate.battleMetrics.endReasonCounts.unexpected ?? 0;
  const issues: IntegrityIssue[] = [];

  if (aggregate.abortedMatches > 0 || summary.failures.length > 0) {
    issues.push({
      code: "match_aborted",
      severity: "critical",
      message: "Some baseline matches aborted and should not be used for balance decisions.",
      evidence: summary.failures.map((failure) => ({
        matchIndex: failure.globalMatchIndex,
        observed: { message: failure.message },
      })),
    });
  }

  if (forcedBattleCount > 0) {
    issues.push({
      code: "forced_battle_end",
      severity: "warning",
      message: "Some battles ended by force resolution.",
      evidence: [{ matchIndex: -1, observed: { forcedBattleCount } }],
    });
  }

  if (unexpectedEndCount > 0) {
    issues.push({
      code: "unexpected_battle_end",
      severity: "critical",
      message: "Some battles ended with an unexpected reason.",
      evidence: [{ matchIndex: -1, observed: { unexpectedEndCount } }],
    });
  }

  const finalBattleIssues = buildFinalBattleIntegrityIssues(aggregate);
  issues.push(...finalBattleIssues);

  const status: AnalysisStatus = issues.some((issue) => issue.severity === "critical")
    ? "fail"
    : issues.length > 0
      ? "warning"
      : "pass";
  const contradictionCount = issues.filter((issue) =>
    issue.code === "winner_result_contradiction"
    || issue.code === "round_result_ranking_contradiction"
    || issue.code === "r12_boss_defeated_but_boss_wins").length;

  return {
    status,
    checkedMatchCount: aggregate.completedMatches,
    forcedBattleCount,
    forcedBattleRate: aggregate.battleMetrics.totalBattles > 0
      ? forcedBattleCount / aggregate.battleMetrics.totalBattles
      : 0,
    unexpectedEndCount,
    contradictionCount,
    phaseTransitionIssueCount: 0,
    finalBattleRuleViolationCount: finalBattleIssues.length,
    issues,
  };
}

function buildFinalBattleIntegrityIssues(
  aggregate: BotOnlyBaselineAggregateReport,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  for (const round of aggregate.roundDetails ?? []) {
    if (round.roundIndex !== FINAL_BATTLE_ROUND_INDEX) {
      continue;
    }

    if (round.phaseHpTarget > 0 || round.battleEndReasons.includes("phase_hp_depleted")) {
      issues.push({
        code: "r12_phase_hp_resolution_used",
        severity: "critical",
        message: "R12 final battle used phase HP resolution even though it should resolve by boss body defeat.",
        evidence: [{
          matchIndex: round.matchIndex,
          roundIndex: round.roundIndex,
          observed: {
            phaseHpTarget: round.phaseHpTarget,
            battleEndReasons: round.battleEndReasons,
          },
          expected: {
            phaseHpTarget: 0,
            battleEndReason: "boss_defeated or annihilation/timeout",
          },
        }],
      });
    }

    const bossDefeated = round.bossSurvivors <= 0 || round.battleEndReasons.includes("boss_defeated");
    if (bossDefeated && round.matchWinnerRole !== "raid") {
      issues.push({
        code: "r12_boss_defeated_but_boss_wins",
        severity: "critical",
        message: "R12 boss body was defeated but the final match winner is boss.",
        evidence: [{
          matchIndex: round.matchIndex,
          roundIndex: round.roundIndex,
          observed: {
            bossSurvivors: round.bossSurvivors,
            battleEndReasons: round.battleEndReasons,
            matchWinnerRole: round.matchWinnerRole,
          },
          expected: { matchWinnerRole: "raid" },
        }],
      });
    }
  }

  return issues;
}

function buildEmptyFinalBattle(): FinalBattleAnalysis {
  return {
    sampleCount: 0,
    bossBodyHp: FINAL_BOSS_BODY_HP_FALLBACK,
    raidWinCount: 0,
    bossWinCount: 0,
    raidWinRate: 0,
    bossDefeatCount: 0,
    bossDefeatRate: 0,
    simultaneousWipeCount: 0,
    averageBossBodyDamage: 0,
    averageBossRemainingHp: FINAL_BOSS_BODY_HP_FALLBACK,
    averageBattleEndSeconds: 0,
    averageBattleEndRealPlaySeconds: 0,
    outcomeContrasts: [],
    bossWinBodyDamageBuckets: [],
    bodyProtection: buildEmptyFinalBattleBossBodyProtection(),
    bossOffense: buildEmptyFinalBattleBossOffense(),
    bossSpells: [],
    endReasonCounts: {},
    samples: [],
  };
}

function buildEmptyFinalBattleBossBodyProtection(): FinalBattleBossBodyProtectionAnalysis {
  return {
    bossBodyDefeatedWithBossSurvivorsCount: 0,
    bossBodyDefeatedWithBossSurvivorsSampleRate: 0,
    bossBodyDefeatedWithBossSurvivorsDefeatRate: 0,
    averageBossSurvivorsWhenBodyDefeated: 0,
    averageBossSurvivorsWhenBossWins: 0,
    averageRaidSurvivorsWhenBodyDefeated: 0,
    directGuardAliveWhenBodyBreachedCount: 0,
    directGuardAliveWhenBodyBreachedRate: 0,
    directGuardDefeatedWhenBodyBreachedCount: 0,
    directGuardDefeatedWhenBodyBreachedRate: 0,
    directGuardOutcomesWhenBodyBreached: [],
    survivingBossUnitsWhenBodyBreached: [],
    raidBodyDamageContributorsWhenBodyBreached: [],
  };
}

function buildEmptyFinalBattleBossOffense(): FinalBattleBossOffenseAnalysis {
  return {
    defeatedRaidUnitsWhenBossWins: [],
    bossDamageContributorsWhenBossWins: [],
    survivingRaidDamageContributorsWhenBodyBreached: [],
  };
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

type FinalBattleRoundDetail = NonNullable<BotOnlyBaselineAggregateReport["roundDetails"]>[number];

type FinalBattleUnitAccumulator = {
  unitId: string;
  unitName: string;
  unitType: string;
  sampleCount: number;
  totalUnitLevel: number;
  totalFinalHp: number;
  totalPhaseContributionDamage: number;
  totalDamage: number;
};

type FinalBattleDirectGuardOutcomeAccumulator = FinalBattleUnitAccumulator & {
  aliveAtBattleEndCount: number;
  defeatedAtBattleEndCount: number;
  totalDamageTaken: number;
  matchedDecisionUnitCount: number;
};

function secondsFromMs(ms: number): number {
  return ms / 1000;
}

function realPlaySecondsFromMs(ms: number, timeScale: number): number {
  return timeScale > 0 ? ms / timeScale / 1000 : secondsFromMs(ms);
}

function averageDefined(values: Array<number | null | undefined>): number {
  const defined = values.filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value));
  return average(defined);
}

function resolveBattleTimeScale(aggregate: BotOnlyBaselineAggregateReport): number {
  const timeScale = aggregate.metadata?.timeScale;
  return typeof timeScale === "number" && Number.isFinite(timeScale) && timeScale > 0
    ? timeScale
    : 1;
}

function buildFinalBattleBossSpells(
  rounds: NonNullable<BotOnlyBaselineAggregateReport["roundDetails"]>,
): FinalBattleBossSpellAnalysis[] {
  const bySpellId = new Map<string, Array<NonNullable<typeof rounds[number]["bossSpellMetrics"]>[number]>>();

  for (const round of rounds) {
    for (const metric of round.bossSpellMetrics ?? []) {
      const metrics = bySpellId.get(metric.spellId) ?? [];
      metrics.push(metric);
      bySpellId.set(metric.spellId, metrics);
    }
  }

  return Array.from(bySpellId.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([spellId, metrics]) => {
      const firstActivationTimes = metrics
        .map((metric) => metric.firstActivationAtMs)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const maxStacks = metrics
        .map((metric) => metric.maxStack)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      return {
        spellId,
        sampleCount: rounds.length,
        activationCount: metrics.reduce((total, metric) => total + metric.activationCount, 0),
        activationRate: metrics.length / Math.max(1, rounds.length),
        averageFirstActivationMs: firstActivationTimes.length > 0 ? average(firstActivationTimes) : null,
        averageTickCount: average(metrics.map((metric) => metric.tickCount)),
        averageTotalDamage: average(metrics.map((metric) => metric.totalDamage)),
        averageMaxStack: maxStacks.length > 0 ? average(maxStacks) : null,
      };
    });
}

function buildFinalBattleBodyProtection(
  rounds: FinalBattleRoundDetail[],
  samples: FinalBattleAnalysis["samples"],
): FinalBattleBossBodyProtectionAnalysis {
  const bossWinSamples = samples.filter((sample) => sample.finalBattleWinner === "boss");
  const bodyDefeatedSamples = samples.filter((sample) => sample.bossDefeated);
  const bodyBreachedSamples = bodyDefeatedSamples.filter((sample) =>
    sample.bossBodyDefeatedWithBossSurvivors);
  const bodyBreachedMatchKeys = new Set(bodyBreachedSamples.map((sample) =>
    `${sample.matchIndex}:${sample.roundIndex}`));
  const bodyBreachedRounds = rounds.filter((round) =>
    bodyBreachedMatchKeys.has(`${round.matchIndex}:${round.roundIndex}`));
  const directGuardAliveCount = bodyBreachedRounds.filter((round) =>
    isDirectGuardAliveAtBattleEnd(round)).length;
  const directGuardDefeatedCount = bodyBreachedRounds.filter((round) =>
    isDirectGuardDefeatedAtBattleEnd(round)).length;

  return {
    bossBodyDefeatedWithBossSurvivorsCount: bodyBreachedSamples.length,
    bossBodyDefeatedWithBossSurvivorsSampleRate: bodyBreachedSamples.length / samples.length,
    bossBodyDefeatedWithBossSurvivorsDefeatRate: bodyDefeatedSamples.length > 0
      ? bodyBreachedSamples.length / bodyDefeatedSamples.length
      : 0,
    averageBossSurvivorsWhenBodyDefeated: average(bodyDefeatedSamples.map((sample) => sample.bossSurvivors)),
    averageBossSurvivorsWhenBossWins: average(bossWinSamples.map((sample) => sample.bossSurvivors)),
    averageRaidSurvivorsWhenBodyDefeated: average(bodyDefeatedSamples.map((sample) => sample.raidSurvivors)),
    directGuardAliveWhenBodyBreachedCount: directGuardAliveCount,
    directGuardAliveWhenBodyBreachedRate: bodyBreachedRounds.length > 0
      ? directGuardAliveCount / bodyBreachedRounds.length
      : 0,
    directGuardDefeatedWhenBodyBreachedCount: directGuardDefeatedCount,
    directGuardDefeatedWhenBodyBreachedRate: bodyBreachedRounds.length > 0
      ? directGuardDefeatedCount / bodyBreachedRounds.length
      : 0,
    directGuardOutcomesWhenBodyBreached: buildFinalBattleDirectGuardOutcomeBreakdown(bodyBreachedRounds),
    survivingBossUnitsWhenBodyBreached: buildFinalBattleUnitPresenceBreakdown(
      bodyBreachedRounds,
      (round) => round.topBossUnits.filter((unit) => unit.alive && unit.finalHp > 0),
    ),
    raidBodyDamageContributorsWhenBodyBreached: buildFinalBattleRaidBodyDamageContributorBreakdown(
      bodyBreachedRounds,
    ),
  };
}

function isFinalBossBodyDefeated(round: FinalBattleRoundDetail): boolean {
  return round.bossSurvivors <= 0 || round.battleEndReasons.includes("boss_defeated");
}

function getFinalBattleWinner(round: FinalBattleRoundDetail): "boss" | "raid" {
  return isFinalBossBodyDefeated(round) ? "raid" : "boss";
}

function getRoundBossBodyDamage(round: FinalBattleRoundDetail): number {
  return Math.max(0, round.phaseDamageDealt);
}

function getRoundBossRemainingHp(round: FinalBattleRoundDetail): number {
  return Math.max(0, FINAL_BOSS_BODY_HP_FALLBACK - getRoundBossBodyDamage(round));
}

function getRoundBossSpellDamage(round: FinalBattleRoundDetail): number {
  return (round.bossSpellMetrics ?? []).reduce((total, metric) =>
    total + Math.max(0, metric.totalDamage), 0);
}

function getAverageBattleStartUnitsPerRaidPlayer(round: FinalBattleRoundDetail): number {
  return average(round.raidPlayerConsequences.map((player) =>
    Math.max(0, player.battleStartUnitCount)));
}

function buildFinalBattleOutcomeContrasts(
  rounds: FinalBattleRoundDetail[],
  timeScale: number,
): FinalBattleOutcomeContrast[] {
  return (["boss", "raid"] as const)
    .map((winner) => {
      const winnerRounds = rounds.filter((round) => getFinalBattleWinner(round) === winner);

      return {
        winner,
        sampleCount: winnerRounds.length,
        sampleRate: rounds.length > 0 ? winnerRounds.length / rounds.length : 0,
        bossBodyDefeatRate: winnerRounds.length > 0
          ? winnerRounds.filter((round) => isFinalBossBodyDefeated(round)).length / winnerRounds.length
          : 0,
        averageBossBodyDamage: average(winnerRounds.map(getRoundBossBodyDamage)),
        averageBossRemainingHp: average(winnerRounds.map(getRoundBossRemainingHp)),
        averageBossSurvivors: average(winnerRounds.map((round) => Math.max(0, round.bossSurvivors))),
        averageRaidSurvivors: average(winnerRounds.map((round) => Math.max(0, round.raidSurvivors))),
        averageRaidPlayersWipedOut: average(winnerRounds.map((round) =>
          Math.max(0, round.raidPlayersWipedOut))),
        averageRaidPlayersEliminatedAfterRound: average(winnerRounds.map((round) =>
          Math.max(0, round.raidPlayersEliminatedAfterRound))),
        averageBattleStartUnitsPerRaidPlayer: average(winnerRounds.map(
          getAverageBattleStartUnitsPerRaidPlayer,
        )),
        directGuardAliveRate: winnerRounds.length > 0
          ? winnerRounds.filter((round) => isDirectGuardAliveAtBattleEnd(round)).length / winnerRounds.length
          : 0,
        averageDirectGuardDamageTaken: averageDefined(winnerRounds.map((round) =>
          round.bossBodyDirectGuardOutcome?.damageTaken)),
        averageBossDamage: average(winnerRounds.map((round) => Math.max(0, round.bossTotalDamage))),
        averageRaidDamage: average(winnerRounds.map((round) => Math.max(0, round.raidTotalDamage))),
        averageRaidPhaseContributionDamage: average(winnerRounds.map((round) =>
          Math.max(0, round.raidPhaseContributionDamage))),
        averageBossSpellDamage: average(winnerRounds.map(getRoundBossSpellDamage)),
        averageBattleEndSeconds: average(winnerRounds.map((round) => secondsFromMs(round.battleEndTimeMs))),
        averageBattleEndRealPlaySeconds: average(winnerRounds.map((round) =>
          realPlaySecondsFromMs(round.battleEndTimeMs, timeScale))),
      };
    })
    .filter((entry) => entry.sampleCount > 0);
}

function buildFinalBattleBossWinBodyDamageBuckets(
  rounds: FinalBattleRoundDetail[],
): FinalBattleBossWinBodyDamageBucket[] {
  const bossWinRounds = rounds.filter((round) => getFinalBattleWinner(round) === "boss");
  const buckets: Array<Pick<
    FinalBattleBossWinBodyDamageBucket,
    "bucketId" | "label" | "minBossBodyDamage" | "maxBossBodyDamage"
  >> = [
    { bucketId: "zero", label: "0", minBossBodyDamage: 0, maxBossBodyDamage: 0 },
    { bucketId: "low", label: "1-999", minBossBodyDamage: 1, maxBossBodyDamage: 999 },
    { bucketId: "mid", label: "1000-2499", minBossBodyDamage: 1000, maxBossBodyDamage: 2499 },
    {
      bucketId: "near",
      label: `2500-${FINAL_BOSS_BODY_HP_FALLBACK - 1}`,
      minBossBodyDamage: 2500,
      maxBossBodyDamage: FINAL_BOSS_BODY_HP_FALLBACK - 1,
    },
  ];

  return buckets.map((bucket) => {
    const bucketRounds = bossWinRounds.filter((round) => {
      const damage = getRoundBossBodyDamage(round);
      return damage >= bucket.minBossBodyDamage && damage <= bucket.maxBossBodyDamage;
    });

    return {
      ...bucket,
      sampleCount: bucketRounds.length,
      sampleRate: bossWinRounds.length > 0 ? bucketRounds.length / bossWinRounds.length : 0,
      averageBossBodyDamage: average(bucketRounds.map(getRoundBossBodyDamage)),
      averageBossRemainingHp: average(bucketRounds.map(getRoundBossRemainingHp)),
      averageBossSurvivors: average(bucketRounds.map((round) => Math.max(0, round.bossSurvivors))),
      averageRaidSurvivors: average(bucketRounds.map((round) => Math.max(0, round.raidSurvivors))),
      averageRaidPlayersWipedOut: average(bucketRounds.map((round) =>
        Math.max(0, round.raidPlayersWipedOut))),
      averageBattleStartUnitsPerRaidPlayer: average(bucketRounds.map(
        getAverageBattleStartUnitsPerRaidPlayer,
      )),
      directGuardAliveRate: bucketRounds.length > 0
        ? bucketRounds.filter((round) => isDirectGuardAliveAtBattleEnd(round)).length / bucketRounds.length
        : 0,
      averageDirectGuardDamageTaken: averageDefined(bucketRounds.map((round) =>
        round.bossBodyDirectGuardOutcome?.damageTaken)),
      averageBossDamage: average(bucketRounds.map((round) => Math.max(0, round.bossTotalDamage))),
      averageRaidDamage: average(bucketRounds.map((round) => Math.max(0, round.raidTotalDamage))),
      averageBossSpellDamage: average(bucketRounds.map(getRoundBossSpellDamage)),
    };
  });
}

function buildFinalBattleBossOffense(rounds: FinalBattleRoundDetail[]): FinalBattleBossOffenseAnalysis {
  const bossWinRounds = rounds.filter((round) => getFinalBattleWinner(round) === "boss");
  const bodyBreachedRounds = rounds.filter((round) =>
    isFinalBossBodyDefeated(round) && round.bossSurvivors > 0);

  return {
    defeatedRaidUnitsWhenBossWins: buildFinalBattleRaidUnitOutcomeBreakdown(
      bossWinRounds,
      (round) => round.topRaidUnits.filter((unit) => !unit.alive || unit.finalHp <= 0),
    ),
    bossDamageContributorsWhenBossWins: buildFinalBattleBossDamageContributorBreakdown(
      bossWinRounds,
    ),
    survivingRaidDamageContributorsWhenBodyBreached: buildFinalBattleRaidBodyDamageContributorBreakdown(
      bodyBreachedRounds,
      { onlyAlive: true },
    ),
  };
}

function buildFinalBattleBossDamageContributorBreakdown(
  rounds: FinalBattleRoundDetail[],
): FinalBattleBossDamageContributorBreakdown[] {
  const accumulators = new Map<string, FinalBattleUnitAccumulator>();
  const totalBossDamage = rounds.reduce((roundTotal, round) =>
    roundTotal + round.topBossUnits.reduce((unitTotal, unit) =>
      unitTotal + Math.max(0, unit.totalDamage), 0), 0);

  for (const round of rounds) {
    const seenUnitIds = new Set<string>();
    for (const unit of round.topBossUnits.filter((candidate) => candidate.totalDamage > 0)) {
      const existing = accumulators.get(unit.unitId) ?? createFinalBattleUnitAccumulator(unit);
      if (!seenUnitIds.has(unit.unitId)) {
        existing.sampleCount += 1;
        existing.totalUnitLevel += unit.unitLevel;
        existing.totalFinalHp += Math.max(0, unit.finalHp);
        seenUnitIds.add(unit.unitId);
      }
      existing.totalDamage += Math.max(0, unit.totalDamage);
      accumulators.set(unit.unitId, existing);
    }
  }

  return Array.from(accumulators.values())
    .map((entry) => ({
      unitId: entry.unitId,
      unitName: entry.unitName,
      unitType: entry.unitType,
      sampleCount: entry.sampleCount,
      sampleRate: rounds.length > 0 ? entry.sampleCount / rounds.length : 0,
      averageUnitLevel: entry.totalUnitLevel / entry.sampleCount,
      averageFinalHp: entry.totalFinalHp / entry.sampleCount,
      totalDamage: entry.totalDamage,
      damageShare: totalBossDamage > 0 ? entry.totalDamage / totalBossDamage : 0,
      averageTotalDamage: entry.totalDamage / entry.sampleCount,
    }))
    .sort((left, right) =>
      right.totalDamage - left.totalDamage
      || left.unitId.localeCompare(right.unitId));
}

function isDirectGuardAliveAtBattleEnd(round: FinalBattleRoundDetail): boolean {
  if (round.bossBodyDirectGuardOutcome) {
    return round.bossBodyDirectGuardOutcome.alive && round.bossBodyDirectGuardOutcome.finalHp > 0;
  }

  const directGuardUnitId = round.bossBodyGuardDecision?.directGuardUnitId;
  if (directGuardUnitId == null) {
    return false;
  }

  return round.topBossUnits.some((unit) =>
    unit.unitId === directGuardUnitId && unit.alive && unit.finalHp > 0);
}

function isDirectGuardDefeatedAtBattleEnd(round: FinalBattleRoundDetail): boolean {
  if (round.bossBodyDirectGuardOutcome) {
    return !round.bossBodyDirectGuardOutcome.alive || round.bossBodyDirectGuardOutcome.finalHp <= 0;
  }

  const directGuardUnitId = round.bossBodyGuardDecision?.directGuardUnitId;
  if (directGuardUnitId == null) {
    return false;
  }

  return round.topBossUnits.some((unit) =>
    unit.unitId === directGuardUnitId && (!unit.alive || unit.finalHp <= 0));
}

function buildFinalBattleDirectGuardOutcomeBreakdown(
  rounds: FinalBattleRoundDetail[],
): FinalBattleDirectGuardOutcomeBreakdown[] {
  const accumulators = new Map<string, FinalBattleDirectGuardOutcomeAccumulator>();

  for (const round of rounds) {
    const guard = round.bossBodyDirectGuardOutcome;
    if (!guard) {
      continue;
    }

    const existing = accumulators.get(guard.unitId) ?? {
      ...createFinalBattleUnitAccumulator(guard),
      aliveAtBattleEndCount: 0,
      defeatedAtBattleEndCount: 0,
      totalDamageTaken: 0,
      matchedDecisionUnitCount: 0,
    };
    existing.sampleCount += 1;
    existing.totalUnitLevel += guard.unitLevel;
    existing.totalFinalHp += Math.max(0, guard.finalHp);
    existing.totalDamageTaken += Math.max(0, guard.damageTaken ?? 0);
    if (guard.alive && guard.finalHp > 0) {
      existing.aliveAtBattleEndCount += 1;
    } else {
      existing.defeatedAtBattleEndCount += 1;
    }
    if (guard.matchedDecisionUnit === true) {
      existing.matchedDecisionUnitCount += 1;
    }
    accumulators.set(guard.unitId, existing);
  }

  return Array.from(accumulators.values())
    .map((entry) => ({
      unitId: entry.unitId,
      unitName: entry.unitName,
      unitType: entry.unitType,
      sampleCount: entry.sampleCount,
      sampleRate: rounds.length > 0 ? entry.sampleCount / rounds.length : 0,
      averageUnitLevel: entry.totalUnitLevel / entry.sampleCount,
      averageFinalHp: entry.totalFinalHp / entry.sampleCount,
      aliveAtBattleEndCount: entry.aliveAtBattleEndCount,
      aliveAtBattleEndRate: entry.aliveAtBattleEndCount / entry.sampleCount,
      defeatedAtBattleEndCount: entry.defeatedAtBattleEndCount,
      defeatedAtBattleEndRate: entry.defeatedAtBattleEndCount / entry.sampleCount,
      averageDamageTaken: entry.totalDamageTaken / entry.sampleCount,
      matchedDecisionUnitCount: entry.matchedDecisionUnitCount,
      matchedDecisionUnitRate: entry.matchedDecisionUnitCount / entry.sampleCount,
    }))
    .sort((left, right) =>
      right.sampleCount - left.sampleCount
      || left.unitId.localeCompare(right.unitId));
}

function buildFinalBattleUnitPresenceBreakdown(
  rounds: FinalBattleRoundDetail[],
  selectUnits: (round: FinalBattleRoundDetail) => BotOnlyBaselineRoundUnitDetail[],
): FinalBattleUnitPresenceBreakdown[] {
  const accumulators = new Map<string, FinalBattleUnitAccumulator>();

  for (const round of rounds) {
    const seenUnitIds = new Set<string>();
    for (const unit of selectUnits(round)) {
      if (seenUnitIds.has(unit.unitId)) {
        continue;
      }
      seenUnitIds.add(unit.unitId);
      const existing = accumulators.get(unit.unitId) ?? createFinalBattleUnitAccumulator(unit);
      existing.sampleCount += 1;
      existing.totalUnitLevel += unit.unitLevel;
      existing.totalFinalHp += unit.finalHp;
      accumulators.set(unit.unitId, existing);
    }
  }

  return Array.from(accumulators.values())
    .map((entry) => ({
      unitId: entry.unitId,
      unitName: entry.unitName,
      unitType: entry.unitType,
      sampleCount: entry.sampleCount,
      sampleRate: rounds.length > 0 ? entry.sampleCount / rounds.length : 0,
      averageUnitLevel: entry.totalUnitLevel / entry.sampleCount,
      averageFinalHp: entry.totalFinalHp / entry.sampleCount,
    }))
    .sort((left, right) =>
      right.sampleCount - left.sampleCount
      || left.unitId.localeCompare(right.unitId));
}

function buildFinalBattleRaidBodyDamageContributorBreakdown(
  rounds: FinalBattleRoundDetail[],
  options: { onlyAlive?: boolean } = {},
): FinalBattleRaidBodyDamageContributorBreakdown[] {
  const accumulators = new Map<string, FinalBattleUnitAccumulator>();
  const totalBodyDamage = rounds.reduce((total, round) =>
    total + Math.max(0, round.bossBodyFocus?.damageTaken ?? round.phaseDamageDealt), 0);

  for (const round of rounds) {
    const seenUnitIds = new Set<string>();
    for (const unit of round.topRaidUnits.filter((candidate) =>
      candidate.phaseContributionDamage > 0
      && (!options.onlyAlive || (candidate.alive && candidate.finalHp > 0)))) {
      const existing = accumulators.get(unit.unitId) ?? createFinalBattleUnitAccumulator(unit);
      if (!seenUnitIds.has(unit.unitId)) {
        existing.sampleCount += 1;
        existing.totalUnitLevel += unit.unitLevel;
        existing.totalFinalHp += unit.finalHp;
        seenUnitIds.add(unit.unitId);
      }
      existing.totalPhaseContributionDamage += unit.phaseContributionDamage;
      existing.totalDamage += unit.totalDamage;
      accumulators.set(unit.unitId, existing);
    }
  }

  return Array.from(accumulators.values())
    .map((entry) => ({
      unitId: entry.unitId,
      unitName: entry.unitName,
      unitType: entry.unitType,
      sampleCount: entry.sampleCount,
      sampleRate: rounds.length > 0 ? entry.sampleCount / rounds.length : 0,
      averageUnitLevel: entry.totalUnitLevel / entry.sampleCount,
      averageFinalHp: entry.totalFinalHp / entry.sampleCount,
      totalPhaseContributionDamage: entry.totalPhaseContributionDamage,
      phaseContributionShare: totalBodyDamage > 0
        ? entry.totalPhaseContributionDamage / totalBodyDamage
        : 0,
      averagePhaseContributionDamage: entry.totalPhaseContributionDamage / entry.sampleCount,
      averageTotalDamage: entry.totalDamage / entry.sampleCount,
    }))
    .sort((left, right) =>
      right.totalPhaseContributionDamage - left.totalPhaseContributionDamage
      || left.unitId.localeCompare(right.unitId));
}

function buildFinalBattleRaidUnitOutcomeBreakdown(
  rounds: FinalBattleRoundDetail[],
  selectUnits: (round: FinalBattleRoundDetail) => BotOnlyBaselineRoundUnitDetail[],
): FinalBattleRaidUnitOutcomeBreakdown[] {
  const accumulators = new Map<string, FinalBattleUnitAccumulator>();

  for (const round of rounds) {
    const seenUnitIds = new Set<string>();
    for (const unit of selectUnits(round)) {
      const existing = accumulators.get(unit.unitId) ?? createFinalBattleUnitAccumulator(unit);
      if (!seenUnitIds.has(unit.unitId)) {
        existing.sampleCount += 1;
        existing.totalUnitLevel += unit.unitLevel;
        existing.totalFinalHp += Math.max(0, unit.finalHp);
        seenUnitIds.add(unit.unitId);
      }
      existing.totalDamage += unit.totalDamage;
      existing.totalPhaseContributionDamage += unit.phaseContributionDamage;
      accumulators.set(unit.unitId, existing);
    }
  }

  return Array.from(accumulators.values())
    .map((entry) => ({
      unitId: entry.unitId,
      unitName: entry.unitName,
      unitType: entry.unitType,
      sampleCount: entry.sampleCount,
      sampleRate: rounds.length > 0 ? entry.sampleCount / rounds.length : 0,
      averageUnitLevel: entry.totalUnitLevel / entry.sampleCount,
      averageFinalHp: entry.totalFinalHp / entry.sampleCount,
      totalDamage: entry.totalDamage,
      totalPhaseContributionDamage: entry.totalPhaseContributionDamage,
      averageTotalDamage: entry.totalDamage / entry.sampleCount,
      averagePhaseContributionDamage: entry.totalPhaseContributionDamage / entry.sampleCount,
    }))
    .sort((left, right) =>
      right.sampleCount - left.sampleCount
      || right.totalDamage - left.totalDamage
      || left.unitId.localeCompare(right.unitId));
}

function createFinalBattleUnitAccumulator(
  unit: BotOnlyBaselineRoundUnitDetail,
): FinalBattleUnitAccumulator {
  return {
    unitId: unit.unitId,
    unitName: unit.unitName,
    unitType: unit.unitType ?? "unknown",
    sampleCount: 0,
    totalUnitLevel: 0,
    totalFinalHp: 0,
    totalPhaseContributionDamage: 0,
    totalDamage: 0,
  };
}

function buildRounds(aggregate: BotOnlyBaselineAggregateReport): RoundPhaseAnalysis[] {
  const details = aggregate.roundDetails ?? [];
  const byRound = new Map<number, typeof details>();
  const timeScale = resolveBattleTimeScale(aggregate);

  for (const detail of details) {
    byRound.set(detail.roundIndex, [...(byRound.get(detail.roundIndex) ?? []), detail]);
  }

  return Array.from(byRound.entries())
    .sort(([left], [right]) => left - right)
    .map(([roundIndex, rounds]) => {
      const objectiveType = roundIndex === FINAL_BATTLE_ROUND_INDEX ? "finalBossBody" : "phaseHp";
      const phaseSuccessCount = rounds.filter((round) => round.phaseResult === "success").length;
      const timeoutCount = rounds.filter((round) =>
        round.battleEndReasons.some((reason) => reason === "timeout_hp_lead" || reason === "timeout_hp_tie"))
        .length;
      const bossWipeCount = rounds.filter((round) => round.bossSurvivors <= 0).length;

      return {
        roundIndex,
        sampleCount: rounds.length,
        objectiveType,
        ...(objectiveType === "phaseHp"
          ? {
            phaseHpTarget: Math.round(average(rounds.map((round) => round.phaseHpTarget))),
            phaseSuccessRate: phaseSuccessCount / rounds.length,
            averagePhaseDamage: average(rounds.map((round) => round.phaseDamageDealt)),
            averageCompletionRate: average(rounds.map((round) => round.phaseCompletionRate)),
            averagePhaseHpPowerIndex: average(rounds
              .map((round) => round.phaseHpPowerIndex)
              .filter((value): value is number =>
                typeof value === "number" && Number.isFinite(value))),
          }
          : {}),
        raidWipeRate: rounds.filter((round) => round.allRaidPlayersWipedOut).length / rounds.length,
        bossWipeRate: bossWipeCount / rounds.length,
        timeoutRate: timeoutCount / rounds.length,
        averageBattleEndSeconds: average(rounds.map((round) => secondsFromMs(round.battleEndTimeMs))),
        averageBattleEndRealPlaySeconds: average(rounds.map((round) =>
          realPlaySecondsFromMs(round.battleEndTimeMs, timeScale))),
      };
    });
}

function buildFinalBattle(aggregate: BotOnlyBaselineAggregateReport): FinalBattleAnalysis {
  const rounds = (aggregate.roundDetails ?? []).filter((round) =>
    round.roundIndex === FINAL_BATTLE_ROUND_INDEX);
  if (rounds.length === 0) {
    return buildEmptyFinalBattle();
  }

  const samples = rounds.map((round) => {
    const bossBodyDamage = getRoundBossBodyDamage(round);
    const bossDefeated = isFinalBossBodyDefeated(round);
    const finalBattleWinner = getFinalBattleWinner(round);
    const bossBodyDefeatedWithBossSurvivors = bossDefeated && round.bossSurvivors > 0;

    return {
      matchIndex: round.matchIndex,
      roundIndex: round.roundIndex,
      bossBodyHp: FINAL_BOSS_BODY_HP_FALLBACK,
      bossBodyDamage,
      bossDefeated,
      bossSurvivors: round.bossSurvivors,
      raidSurvivors: round.raidSurvivors,
      bossBodyDefeatedWithBossSurvivors,
      finalBattleWinner,
      matchWinnerRole: round.matchWinnerRole,
    };
  });
  const bossDefeatCount = samples.filter((sample) => sample.bossDefeated).length;
  const raidWinCount = samples.filter((sample) => sample.finalBattleWinner === "raid").length;
  const endReasonCounts: Partial<Record<BotOnlyBaselineBattleEndReason, number>> = {};
  const timeScale = resolveBattleTimeScale(aggregate);

  for (const round of rounds) {
    for (const reason of round.battleEndReasons) {
      endReasonCounts[reason] = (endReasonCounts[reason] ?? 0) + 1;
    }
  }

  return {
    sampleCount: rounds.length,
    bossBodyHp: FINAL_BOSS_BODY_HP_FALLBACK,
    raidWinCount,
    bossWinCount: samples.length - raidWinCount,
    raidWinRate: raidWinCount / samples.length,
    bossDefeatCount,
    bossDefeatRate: bossDefeatCount / samples.length,
    simultaneousWipeCount: rounds.filter((round) => round.bossSurvivors <= 0 && round.raidSurvivors <= 0).length,
    averageBossBodyDamage: average(samples.map((sample) => sample.bossBodyDamage)),
    averageBossRemainingHp: average(samples.map((sample) =>
      Math.max(0, sample.bossBodyHp - sample.bossBodyDamage))),
    averageBattleEndSeconds: average(rounds.map((round) => secondsFromMs(round.battleEndTimeMs))),
    averageBattleEndRealPlaySeconds: average(rounds.map((round) =>
      realPlaySecondsFromMs(round.battleEndTimeMs, timeScale))),
    outcomeContrasts: buildFinalBattleOutcomeContrasts(rounds, timeScale),
    bossWinBodyDamageBuckets: buildFinalBattleBossWinBodyDamageBuckets(rounds),
    bodyProtection: buildFinalBattleBodyProtection(rounds, samples),
    bossOffense: buildFinalBattleBossOffense(rounds),
    bossSpells: buildFinalBattleBossSpells(rounds),
    endReasonCounts,
    samples,
  };
}

function buildBossBodyFocus(aggregate: BotOnlyBaselineAggregateReport): BossBodyFocusAnalysis {
  const earlyFocusDetails = (aggregate.roundDetails ?? [])
    .filter((round) => round.roundIndex >= 1 && round.roundIndex <= 3)
    .map((round) => round.bossBodyFocus)
    .filter((focus): focus is NonNullable<typeof focus> => Boolean(focus));
  const earlyDefeatCount = earlyFocusDetails.filter((focus) => focus.defeated).length;
  const firstDamageSamples = earlyFocusDetails
    .map((focus) => focus.firstDamageAtMs)
    .filter((value): value is number =>
      typeof value === "number" && Number.isFinite(value));

  return {
    earlyRoundCount: earlyFocusDetails.length,
    earlyDefeatCount,
    earlyDefeatRate: earlyFocusDetails.length > 0 ? earlyDefeatCount / earlyFocusDetails.length : 0,
    averageEarlyDamageTaken: average(earlyFocusDetails.map((focus) => focus.damageTaken)),
    averageEarlyDirectPhaseDamage: average(earlyFocusDetails.map((focus) => focus.directPhaseDamage)),
    averageEarlyFirstDamageAtMs: firstDamageSamples.length > 0 ? average(firstDamageSamples) : null,
  };
}

function buildBalance(
  aggregate: BotOnlyBaselineAggregateReport,
  integrity: IntegrityAnalysis,
  finalBattle: FinalBattleAnalysis,
): BalanceAnalysis {
  const r12ReachRate = countR12Matches(aggregate) / Math.max(1, aggregate.completedMatches);
  const bossWinRate = { value: aggregate.bossWinRate, targetMin: 0.4, targetMax: 0.6 };
  const r12Reach = { value: r12ReachRate, targetMin: 0.3, targetMax: 0.8 };
  const finalBattleRaidWinRate = { value: finalBattle.raidWinRate, targetMin: 0.35, targetMax: 0.65 };
  const base = {
    bossWinRate,
    r12ReachRate: r12Reach,
    finalBattleRaidWinRate,
    issues: [] as BalanceIssue[],
  };

  if (integrity.status === "fail") {
    return {
      status: "not_evaluated",
      sampleUsability: "not_usable",
      ...base,
    };
  }

  const issues = buildBalanceIssues(aggregate, r12ReachRate, finalBattle);

  return {
    status: issues.length > 0 ? "needs_adjustment" : "pass",
    sampleUsability: integrity.status === "warning" ? "partially_usable" : "usable",
    bossWinRate,
    r12ReachRate: r12Reach,
    finalBattleRaidWinRate,
    issues,
  };
}

function isOutsideTarget(metric: { value: number; targetMin: number; targetMax: number }): boolean {
  return metric.value < metric.targetMin || metric.value > metric.targetMax;
}

function buildRateBalanceIssue(input: {
  code: string;
  message: string;
  metric: { value: number; targetMin: number; targetMax: number };
  sampleCount: number;
  evidenceObserved: Record<string, unknown>;
}): BalanceIssue | null {
  if (input.sampleCount < BALANCE_SAMPLE_MINIMUM || !isOutsideTarget(input.metric)) {
    return null;
  }

  return {
    code: input.code,
    severity: "warning",
    confidence: input.sampleCount >= 100 ? 0.85 : 0.7,
    message: input.message,
    recommendedNextAction: "balance_adjustment",
    evidence: [{
      matchIndex: -1,
      observed: input.evidenceObserved,
      expected: {
        targetMin: input.metric.targetMin,
        targetMax: input.metric.targetMax,
      },
    }],
  };
}

function buildBalanceIssues(
  aggregate: BotOnlyBaselineAggregateReport,
  r12ReachRate: number,
  finalBattle: FinalBattleAnalysis,
): BalanceIssue[] {
  const progression = buildProgression(aggregate);
  const rounds = buildRounds(aggregate);
  const bossBody = progression.byUnit.find((unit) => unit.unitCategory === "bossBody");
  const topDamageUnit = [...aggregate.bossBattleUnitMetrics, ...aggregate.raidBattleUnitMetrics]
    .filter((unit) => unit.battleAppearances >= 20)
    .sort((left, right) => right.averageDamagePerBattle - left.averageDamagePerBattle)[0];
  const raidSpecialMelee = aggregate.raidMeleeCohortMetrics?.find((entry) => entry.cohort === "special");
  const raidStandardMelee = aggregate.raidMeleeCohortMetrics?.find((entry) => entry.cohort === "standard");
  const issues = [
    buildRateBalanceIssue({
      code: "boss_win_rate_outside_target",
      message: "Boss win rate is outside the baseline target band.",
      metric: { value: aggregate.bossWinRate, targetMin: 0.4, targetMax: 0.6 },
      sampleCount: aggregate.completedMatches,
      evidenceObserved: {
        bossWinRate: aggregate.bossWinRate,
        completedMatches: aggregate.completedMatches,
        bossWins: aggregate.bossWins,
        raidWins: aggregate.raidWins,
      },
    }),
    buildRateBalanceIssue({
      code: "r12_reach_rate_outside_target",
      message: "R12 reach rate is outside the baseline target band.",
      metric: { value: r12ReachRate, targetMin: 0.3, targetMax: 0.8 },
      sampleCount: aggregate.completedMatches,
      evidenceObserved: {
        r12ReachRate,
        completedMatches: aggregate.completedMatches,
        r12Matches: countR12Matches(aggregate),
      },
    }),
    buildRateBalanceIssue({
      code: "final_battle_raid_win_rate_outside_target",
      message: "Final battle raid win rate is outside the baseline target band.",
      metric: { value: finalBattle.raidWinRate, targetMin: 0.35, targetMax: 0.65 },
      sampleCount: finalBattle.sampleCount,
      evidenceObserved: {
        finalBattleRaidWinRate: finalBattle.raidWinRate,
        finalBattleSamples: finalBattle.sampleCount,
        raidWinCount: finalBattle.raidWinCount,
        bossWinCount: finalBattle.bossWinCount,
      },
    }),
  ];

  const earlyFastRound = rounds.find((round) =>
    round.roundIndex <= 3
    && round.averageBattleEndRealPlaySeconds > 0
    && round.averageBattleEndRealPlaySeconds < 10);
  if (earlyFastRound) {
    issues.push({
      code: "early_round_resolution_too_fast",
      severity: "warning",
      confidence: 0.75,
      message: "Early rounds are ending too quickly to provide stable balance signal.",
      recommendedNextAction: "balance_adjustment",
      evidence: [{
        matchIndex: -1,
        roundIndex: earlyFastRound.roundIndex,
        observed: {
          averageBattleEndRealPlaySeconds: earlyFastRound.averageBattleEndRealPlaySeconds,
          sampleCount: earlyFastRound.sampleCount,
        },
        expected: { minimumAverageBattleEndRealPlaySeconds: 10 },
      }],
    });
  }

  if (topDamageUnit && topDamageUnit.averageDamagePerBattle >= 2000) {
    issues.push({
      code: "unit_damage_outlier",
      severity: "warning",
      confidence: topDamageUnit.battleAppearances >= 100 ? 0.85 : 0.7,
      message: "A unit is producing outlier battle damage.",
      recommendedNextAction: "balance_adjustment",
      evidence: [{
        matchIndex: -1,
        unitId: topDamageUnit.unitId,
        unitName: topDamageUnit.unitName,
        observed: {
          unitId: topDamageUnit.unitId,
          unitName: topDamageUnit.unitName,
          averageDamagePerBattle: topDamageUnit.averageDamagePerBattle,
          battleAppearances: topDamageUnit.battleAppearances,
        },
        expected: { softCapAverageDamagePerBattle: 2000 },
      }],
    });
  }

  if (progression.heroes.unitCount > 0 && progression.heroes.level7ReachRate === 0) {
    issues.push({
      code: "hero_level7_unreached",
      severity: "warning",
      confidence: aggregate.completedMatches >= 100 ? 0.85 : 0.7,
      message: "Heroes never reached Lv7 in usable baseline samples.",
      recommendedNextAction: "balance_adjustment",
      evidence: [{
        matchIndex: -1,
        observed: {
          heroAverageLevel: progression.heroes.averageLevel,
          heroMaxLevel: progression.heroes.maxLevel,
          heroLevel7ReachRate: progression.heroes.level7ReachRate,
        },
        expected: { heroLevel7ReachRateGreaterThan: 0 },
      }],
    });
  }

  if (bossBody && bossBody.maxLevel <= 1 && aggregate.completedMatches >= 20) {
    issues.push({
      code: "boss_body_level_locked",
      severity: "warning",
      confidence: aggregate.completedMatches >= 100 ? 0.9 : 0.75,
      message: "Boss body stayed at Lv1 across baseline samples.",
      recommendedNextAction: "bug_investigation",
      evidence: [{
        matchIndex: -1,
        unitId: bossBody.unitId,
        unitName: bossBody.unitName,
        observed: {
          averageLevel: bossBody.averageLevel,
          maxLevel: bossBody.maxLevel,
          level4ReachRate: bossBody.level4ReachRate,
        },
        expected: { maxLevelGreaterThan: 1 },
      }],
    });
  }

  if (
    raidSpecialMelee
    && raidStandardMelee
    && raidSpecialMelee.battleAppearances >= 50
    && raidSpecialMelee.averageDamagePerBattle < raidStandardMelee.averageDamagePerBattle * 0.8
  ) {
    issues.push({
      code: "raid_special_melee_underperforms_standard",
      severity: "warning",
      confidence: 0.75,
      message: "Raid special melee units underperform standard melee units.",
      recommendedNextAction: "bug_investigation",
      evidence: [{
        matchIndex: -1,
        observed: {
          specialAverageDamagePerBattle: raidSpecialMelee.averageDamagePerBattle,
          standardAverageDamagePerBattle: raidStandardMelee.averageDamagePerBattle,
          specialZeroDamageBattleRate: raidSpecialMelee.zeroDamageBattleRate,
          standardZeroDamageBattleRate: raidStandardMelee.zeroDamageBattleRate,
        },
        expected: { specialDamageAtLeastStandardRatio: 0.8 },
      }],
    });
  }

  return issues.filter((issue): issue is BalanceIssue => issue != null);
}

function emptyEconomyMetrics(): EconomyMetrics {
  return {
    averageFinalGold: 0,
    averageGoldEarned: 0,
    averageGoldSpent: 0,
    averagePurchaseCount: 0,
    averageRefreshCount: 0,
    averageSellCount: 0,
    averageSpecialUnitUpgradeCount: 0,
    unusedGoldRate: 0,
  };
}

function buildEconomy(aggregate: BotOnlyBaselineAggregateReport): EconomyAnalysis {
  const byPlayer = Object.fromEntries(
    Object.entries(aggregate.playerMetrics).map(([label, metrics]) => {
      const totalGoldKnown = metrics.averageGoldSpent + metrics.averageFinalGold;
      return [label, {
        averageFinalGold: metrics.averageFinalGold,
        averageGoldEarned: metrics.averageGoldEarned,
        averageGoldSpent: metrics.averageGoldSpent,
        averagePurchaseCount: metrics.averagePurchaseCount,
        averageRefreshCount: metrics.averageRefreshCount,
        averageSellCount: metrics.averageSellCount,
        averageSpecialUnitUpgradeCount: metrics.averageSpecialUnitUpgradeCount ?? 0,
        unusedGoldRate: totalGoldKnown > 0 ? metrics.averageFinalGold / totalGoldKnown : 0,
      }];
    }),
  );
  const playerMetrics = Object.values(byPlayer);

  return {
    overall: playerMetrics.length > 0
      ? {
        averageFinalGold: average(playerMetrics.map((metrics) => metrics.averageFinalGold)),
        averageGoldEarned: average(playerMetrics.map((metrics) => metrics.averageGoldEarned)),
        averageGoldSpent: average(playerMetrics.map((metrics) => metrics.averageGoldSpent)),
        averagePurchaseCount: average(playerMetrics.map((metrics) => metrics.averagePurchaseCount)),
        averageRefreshCount: average(playerMetrics.map((metrics) => metrics.averageRefreshCount)),
        averageSellCount: average(playerMetrics.map((metrics) => metrics.averageSellCount)),
        averageSpecialUnitUpgradeCount: average(
          playerMetrics.map((metrics) => metrics.averageSpecialUnitUpgradeCount),
        ),
        unusedGoldRate: average(playerMetrics.map((metrics) => metrics.unusedGoldRate)),
      }
      : emptyEconomyMetrics(),
    byPlayer,
  };
}

const HERO_UNIT_IDS = new Set(["reimu", "marisa", "okina", "jyoon", "keiki", "yuiman"]);
const HERO_EXCLUSIVE_UNIT_IDS = new Set(["shion", "mayumi", "ariya"]);
const BOSS_EXCLUSIVE_UNIT_IDS = new Set(SCARLET_MANSION_UNITS.flatMap((unit) => [unit.id, unit.unitId]));
const BOSS_BODY_UNIT_IDS = new Set(["remilia"]);

function resolveUnitCategory(unitId: string, unitType: string): UnitCategory {
  if (BOSS_BODY_UNIT_IDS.has(unitId) || unitType === "boss") {
    return "bossBody";
  }
  if (HERO_UNIT_IDS.has(unitId) || unitType === "hero") {
    return "hero";
  }
  if (HERO_EXCLUSIVE_UNIT_IDS.has(unitId)) {
    return "heroExclusive";
  }
  if (BOSS_EXCLUSIVE_UNIT_IDS.has(unitId)) {
    return "bossExclusive";
  }
  return "normal";
}

function emptyCohort(): ProgressionCohortMetrics {
  return { unitCount: 0, averageLevel: 0, maxLevel: 0, level4ReachRate: 0, level7ReachRate: 0 };
}

function buildCohort(units: UnitProgressionMetrics[]): ProgressionCohortMetrics {
  if (units.length === 0) {
    return emptyCohort();
  }

  return {
    unitCount: units.length,
    averageLevel: average(units.map((unit) => unit.averageLevel)),
    maxLevel: Math.max(0, ...units.map((unit) => unit.maxLevel)),
    level4ReachRate: average(units.map((unit) => unit.level4ReachRate)),
    level7ReachRate: average(units.map((unit) => unit.level7ReachRate)),
  };
}

function buildProgression(aggregate: BotOnlyBaselineAggregateReport): ProgressionAnalysis {
  const byUnit = [
    ...aggregate.bossBattleUnitMetrics.map((unit) => ({ side: "boss" as const, unit })),
    ...aggregate.raidBattleUnitMetrics.map((unit) => ({ side: "raid" as const, unit })),
  ].map(({ side, unit }) => ({
    side,
    unitId: unit.unitId,
    unitName: unit.unitName,
    unitCategory: resolveUnitCategory(unit.unitId, unit.unitType),
    averageLevel: unit.averageunitLevel,
    maxLevel: unit.maxUnitLevel ?? 0,
    level4ReachRate: unit.level4ReachRate ?? 0,
    level7ReachRate: unit.level7ReachRate ?? 0,
  }));

  return {
    heroes: buildCohort(byUnit.filter((unit) => unit.unitCategory === "hero")),
    normalUnits: buildCohort(byUnit.filter((unit) => unit.unitCategory === "normal")),
    heroExclusiveUnits: buildCohort(byUnit.filter((unit) => unit.unitCategory === "heroExclusive")),
    bossExclusiveUnits: buildCohort(byUnit.filter((unit) => unit.unitCategory === "bossExclusive")),
    byUnit,
  };
}

function buildShop(aggregate: BotOnlyBaselineAggregateReport): ShopAnalysis {
  const offerMetrics = (aggregate.shopOfferMetrics ?? []).map((entry) => ({ ...entry }));
  const byOffered = [...offerMetrics].sort((left, right) =>
    right.offeredMatchRate - left.offeredMatchRate
    || right.observationCount - left.observationCount
    || left.unitId.localeCompare(right.unitId));
  const byAdoption = [...offerMetrics].sort((left, right) =>
    right.finalBoardAdoptionRate - left.finalBoardAdoptionRate
    || right.finalBoardCopies - left.finalBoardCopies
    || left.unitId.localeCompare(right.unitId));

  return {
    offerMetrics,
    mostOffered: byOffered.slice(0, 10),
    highestFinalBoardAdoption: byAdoption.slice(0, 10),
  };
}

export function buildBotBalanceBaselineAnalysis(
  summary: BotBalanceBaselineSummary,
): BotBaselineAnalysisReport {
  const aggregate = summary.aggregate;
  const integrity = buildIntegrity(summary);
  const rounds = buildRounds(aggregate);
  const finalBattle = buildFinalBattle(aggregate);
  const bossBodyFocus = buildBossBodyFocus(aggregate);
  const balance = buildBalance(aggregate, integrity, finalBattle);
  const r12MatchCount = countR12Matches(aggregate);
  const diagnosticIssues = [...integrity.issues, ...balance.issues];
  const criticalCount = diagnosticIssues.filter((issue) => issue.severity === "critical").length;
  const warningCount = diagnosticIssues.filter((issue) => issue.severity === "warning").length;
  const infoCount = diagnosticIssues.filter((issue) => issue.severity === "info").length;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    run: {
      requestedMatchCount: summary.requestedMatchCount,
      chunkSize: summary.chunkSize,
      parallelism: summary.parallelism,
      outputDir: summary.outputDir,
    },
    overview: {
      completedMatches: aggregate.completedMatches,
      abortedMatches: aggregate.abortedMatches,
      abortRate: summary.requestedMatchCount > 0 ? aggregate.abortedMatches / summary.requestedMatchCount : 0,
      bossWinRate: aggregate.bossWinRate,
      raidWinRate: aggregate.raidWinRate,
      averageRounds: aggregate.averageRounds,
      r12ReachRate: aggregate.completedMatches > 0 ? r12MatchCount / aggregate.completedMatches : 0,
      integrityStatus: integrity.status,
      balanceStatus: balance.status,
    },
    integrity,
    balance,
    rounds,
    finalBattle,
    bossBodyFocus,
    economy: buildEconomy(aggregate),
    progression: buildProgression(aggregate),
    shop: buildShop(aggregate),
    diagnostics: {
      criticalCount,
      warningCount,
      infoCount,
    },
  };
}
