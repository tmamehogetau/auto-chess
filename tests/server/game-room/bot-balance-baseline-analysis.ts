import { SCARLET_MANSION_UNITS } from "../../../src/data/scarlet-mansion-units";
import type {
  BotOnlyBaselineAggregateReport,
  BotOnlyBaselineBattleEndReason,
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
  bodyProtection: FinalBattleBossBodyProtectionAnalysis;
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
    bodyProtection: buildEmptyFinalBattleBossBodyProtection(),
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
  };
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function secondsFromMs(ms: number): number {
  return ms / 1000;
}

function realPlaySecondsFromMs(ms: number, timeScale: number): number {
  return timeScale > 0 ? ms / timeScale / 1000 : secondsFromMs(ms);
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
    const bossBodyDamage = Math.max(0, round.phaseDamageDealt);
    const bossDefeated = round.bossSurvivors <= 0 || round.battleEndReasons.includes("boss_defeated");
    const finalBattleWinner: "boss" | "raid" = bossDefeated ? "raid" : "boss";
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
  const bossWinSamples = samples.filter((sample) => sample.finalBattleWinner === "boss");
  const bodyDefeatedSamples = samples.filter((sample) => sample.bossDefeated);
  const bodyDefeatedWithBossSurvivors = bodyDefeatedSamples.filter((sample) =>
    sample.bossBodyDefeatedWithBossSurvivors);
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
    bodyProtection: {
      bossBodyDefeatedWithBossSurvivorsCount: bodyDefeatedWithBossSurvivors.length,
      bossBodyDefeatedWithBossSurvivorsSampleRate: bodyDefeatedWithBossSurvivors.length / samples.length,
      bossBodyDefeatedWithBossSurvivorsDefeatRate: bodyDefeatedSamples.length > 0
        ? bodyDefeatedWithBossSurvivors.length / bodyDefeatedSamples.length
        : 0,
      averageBossSurvivorsWhenBodyDefeated: average(bodyDefeatedSamples.map((sample) => sample.bossSurvivors)),
      averageBossSurvivorsWhenBossWins: average(bossWinSamples.map((sample) => sample.bossSurvivors)),
      averageRaidSurvivorsWhenBodyDefeated: average(bodyDefeatedSamples.map((sample) => sample.raidSurvivors)),
    },
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
  const criticalCount = integrity.issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = integrity.issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = integrity.issues.filter((issue) => issue.severity === "info").length;

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
