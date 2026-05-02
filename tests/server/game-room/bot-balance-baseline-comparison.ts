import type { BotBalanceBaselineSummary } from "./bot-balance-baseline-human-report";

type BotBalanceBaselineComparisonSignalCode =
  | "current_full_below_historical_baseline"
  | "raid_optimization_not_primary"
  | "raid_optimization_likely_primary"
  | "boss_optimization_not_primary"
  | "boss_optimization_may_hurt_boss";

export type BotBalanceBaselineVariantComparisonOptions = {
  baselineVariant?: BotBalanceBaselineSummary["optimizationVariant"];
  historicalBossWinRate?: number;
  primaryDeltaThreshold?: number;
};

export type BotBalanceBaselineVariantComparisonEntry = {
  optimizationVariant: BotBalanceBaselineSummary["optimizationVariant"];
  completedMatches: number;
  abortedMatches: number;
  bossWinRate: number;
  bossWinRateDelta: number;
  historicalBossWinRateDelta: number | null;
  averageRounds: number;
  averageRoundsDelta: number;
  boardRefitRecommendationRate: number;
  boardRefitCommitRate: number;
  bossBoardRefitRecommendationRate: number;
  raidBoardRefitRecommendationRate: number;
  okinaActionRecommendationRate: number;
  bossAverageDeployedAssetValue: number;
  raidAverageDeployedAssetValue: number;
  highCostPurchaseRate: number;
  bossNormalShopSpend: number;
  raidNormalShopSpend: number;
};

export type BotBalanceBaselineComparisonSignal = {
  code: BotBalanceBaselineComparisonSignalCode;
  message: string;
  evidence: Record<string, number | string | null>;
};

export type BotBalanceBaselineVariantComparison = {
  baselineVariant: BotBalanceBaselineSummary["optimizationVariant"];
  historicalBossWinRate: number | null;
  variants: BotBalanceBaselineVariantComparisonEntry[];
  signals: BotBalanceBaselineComparisonSignal[];
};

function round(value: number, digits = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function divide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function sumBy<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function getWeightedRoleAssetValue(
  summary: BotBalanceBaselineSummary,
  role: "boss" | "raid",
): number {
  const metrics = (summary.aggregate.finalPlayerBoardMetrics ?? [])
    .filter((entry) => entry.role === role);
  const totalMatches = sumBy(metrics, (entry) => entry.matchesPresent);
  return round(divide(
    sumBy(metrics, (entry) => entry.averageDeployedAssetValue * entry.matchesPresent),
    totalMatches,
  ));
}

function getRoleByLabel(summary: BotBalanceBaselineSummary, label: string): "boss" | "raid" {
  const boardRole = summary.aggregate.finalPlayerBoardMetrics
    ?.find((entry) => entry.label === label)?.role;
  if (boardRole === "boss" || boardRole === "raid") {
    return boardRole;
  }

  return label === "P1" ? "boss" : "raid";
}

function getNormalShopSpend(summary: BotBalanceBaselineSummary, role: "boss" | "raid"): number {
  return round(Object.entries(summary.aggregate.playerEconomyBreakdowns ?? {})
    .filter(([label]) => getRoleByLabel(summary, label) === role)
    .reduce((total, [, economy]) => total + economy.normalShopSpend, 0));
}

function getBoardRefitRoleRecommendationRate(
  summary: BotBalanceBaselineSummary,
  role: "boss" | "raid",
): number {
  const metric = summary.aggregate.boardRefitDecisionRoleMetrics
    ?.find((entry) => entry.role === role);
  return round(divide(
    metric?.recommendedReplacementSamples ?? 0,
    metric?.samples ?? 0,
  ));
}

function buildEntry(
  summary: BotBalanceBaselineSummary,
  baseline: BotBalanceBaselineSummary,
  historicalBossWinRate: number | null,
): BotBalanceBaselineVariantComparisonEntry {
  const boardRefitMetrics = summary.aggregate.boardRefitDecisionRoundMetrics ?? [];
  const boardRefitSamples = sumBy(boardRefitMetrics, (entry) => entry.samples);
  const boardRefitRecommended = sumBy(boardRefitMetrics, (entry) => entry.recommendedReplacementSamples);
  const boardRefitCommitted = sumBy(boardRefitMetrics, (entry) => entry.committedSamples);
  const okinaMetrics = summary.aggregate.okinaHeroSubDecisionRoundMetrics ?? [];
  const okinaSamples = sumBy(okinaMetrics, (entry) => entry.samples);
  const okinaRecommended = sumBy(okinaMetrics, (entry) => entry.actionRecommendedSamples);
  const highCostSummary = summary.aggregate.highCostSummary;

  return {
    optimizationVariant: summary.optimizationVariant,
    completedMatches: summary.aggregate.completedMatches,
    abortedMatches: summary.aggregate.abortedMatches,
    bossWinRate: round(summary.aggregate.bossWinRate),
    bossWinRateDelta: round(summary.aggregate.bossWinRate - baseline.aggregate.bossWinRate),
    historicalBossWinRateDelta: historicalBossWinRate === null
      ? null
      : round(summary.aggregate.bossWinRate - historicalBossWinRate),
    averageRounds: round(summary.aggregate.averageRounds),
    averageRoundsDelta: round(summary.aggregate.averageRounds - baseline.aggregate.averageRounds),
    boardRefitRecommendationRate: round(divide(boardRefitRecommended, boardRefitSamples)),
    boardRefitCommitRate: round(divide(boardRefitCommitted, boardRefitSamples)),
    bossBoardRefitRecommendationRate: getBoardRefitRoleRecommendationRate(summary, "boss"),
    raidBoardRefitRecommendationRate: getBoardRefitRoleRecommendationRate(summary, "raid"),
    okinaActionRecommendationRate: round(divide(okinaRecommended, okinaSamples)),
    bossAverageDeployedAssetValue: getWeightedRoleAssetValue(summary, "boss"),
    raidAverageDeployedAssetValue: getWeightedRoleAssetValue(summary, "raid"),
    highCostPurchaseRate: round(divide(
      highCostSummary?.purchaseCount ?? 0,
      highCostSummary?.offerObservationCount ?? 0,
    )),
    bossNormalShopSpend: getNormalShopSpend(summary, "boss"),
    raidNormalShopSpend: getNormalShopSpend(summary, "raid"),
  };
}

function findEntry(
  comparison: BotBalanceBaselineVariantComparison,
  variant: BotBalanceBaselineSummary["optimizationVariant"],
): BotBalanceBaselineVariantComparisonEntry | null {
  return comparison.variants.find((entry) => entry.optimizationVariant === variant) ?? null;
}

function buildSignals(
  comparison: BotBalanceBaselineVariantComparison,
  primaryDeltaThreshold: number,
): BotBalanceBaselineComparisonSignal[] {
  const signals: BotBalanceBaselineComparisonSignal[] = [];
  const full = findEntry(comparison, "full");
  const raidOff = findEntry(comparison, "raid-optimization-off");
  const bossOff = findEntry(comparison, "boss-optimization-off");

  if (full?.historicalBossWinRateDelta != null && full.historicalBossWinRateDelta <= -0.1) {
    signals.push({
      code: "current_full_below_historical_baseline",
      message: "Current full optimization is materially below the historical boss win-rate baseline.",
      evidence: {
        fullBossWinRate: full.bossWinRate,
        historicalBossWinRate: comparison.historicalBossWinRate,
        delta: full.historicalBossWinRateDelta,
      },
    });
  }

  if (full && raidOff) {
    const code = raidOff.bossWinRate <= full.bossWinRate + primaryDeltaThreshold
      ? "raid_optimization_not_primary"
      : "raid_optimization_likely_primary";
    signals.push({
      code,
      message: code === "raid_optimization_not_primary"
        ? "Disabling raid-side optimization did not restore boss win rate, so raid optimization alone is unlikely to be the primary cause."
        : "Disabling raid-side optimization restored boss win rate enough to mark it as a likely primary cause.",
      evidence: {
        fullBossWinRate: full.bossWinRate,
        raidOptimizationOffBossWinRate: raidOff.bossWinRate,
        deltaFromFull: raidOff.bossWinRateDelta,
      },
    });
  }

  if (full && bossOff) {
    const code = bossOff.bossWinRate <= full.bossWinRate + primaryDeltaThreshold
      ? "boss_optimization_not_primary"
      : "boss_optimization_may_hurt_boss";
    signals.push({
      code,
      message: code === "boss_optimization_not_primary"
        ? "Disabling boss-side optimization did not improve boss win rate enough to isolate boss optimization as the primary cause."
        : "Disabling boss-side optimization improved boss win rate enough to inspect boss-specific optimization fit.",
      evidence: {
        fullBossWinRate: full.bossWinRate,
        bossOptimizationOffBossWinRate: bossOff.bossWinRate,
        deltaFromFull: bossOff.bossWinRateDelta,
      },
    });
  }

  return signals;
}

export function buildBotBalanceBaselineVariantComparison(
  summaries: BotBalanceBaselineSummary[],
  options: BotBalanceBaselineVariantComparisonOptions = {},
): BotBalanceBaselineVariantComparison {
  if (summaries.length === 0) {
    throw new Error("At least one bot balance baseline summary is required");
  }

  const baselineVariant = options.baselineVariant ?? "full";
  const baseline = summaries.find((summary) => summary.optimizationVariant === baselineVariant)
    ?? summaries[0]!;
  const historicalBossWinRate = Number.isFinite(options.historicalBossWinRate)
    ? options.historicalBossWinRate ?? null
    : null;
  const comparison: BotBalanceBaselineVariantComparison = {
    baselineVariant: baseline.optimizationVariant,
    historicalBossWinRate,
    variants: summaries.map((summary) => buildEntry(summary, baseline, historicalBossWinRate)),
    signals: [],
  };

  comparison.signals = buildSignals(comparison, options.primaryDeltaThreshold ?? 0.03);
  return comparison;
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.?0+$/u, "");
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatPointDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  const percentagePoints = value * 100;
  const sign = percentagePoints >= 0 ? "+" : "";
  return `${sign}${percentagePoints.toFixed(1)}pt`;
}

function formatSignedNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}`;
}

export function buildBotBalanceBaselineVariantComparisonMarkdown(
  comparison: BotBalanceBaselineVariantComparison,
): string {
  const lines = [
    "# Bot Balance Baseline Variant Comparison",
    "",
    `- Baseline variant: ${comparison.baselineVariant}`,
    `- Historical boss win rate: ${formatPercent(comparison.historicalBossWinRate)}`,
    "",
    "| Variant | Completed | Aborted | Boss WR | vs baseline | vs historical | Avg R | Avg R delta | Board refit recommend | Boss refit recommend | Raid refit recommend | Board refit execute | Okina action | Boss asset | Raid asset | High-cost buy | Boss normal spend | Raid normal spend |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const entry of comparison.variants) {
    lines.push([
      `| ${entry.optimizationVariant}`,
      entry.completedMatches,
      entry.abortedMatches,
      formatPercent(entry.bossWinRate),
      formatPointDelta(entry.bossWinRateDelta),
      formatPointDelta(entry.historicalBossWinRateDelta),
      formatNumber(entry.averageRounds),
      formatSignedNumber(entry.averageRoundsDelta),
      formatPercent(entry.boardRefitRecommendationRate),
      formatPercent(entry.bossBoardRefitRecommendationRate),
      formatPercent(entry.raidBoardRefitRecommendationRate),
      formatPercent(entry.boardRefitCommitRate),
      formatPercent(entry.okinaActionRecommendationRate),
      formatNumber(entry.bossAverageDeployedAssetValue),
      formatNumber(entry.raidAverageDeployedAssetValue),
      formatPercent(entry.highCostPurchaseRate),
      formatNumber(entry.bossNormalShopSpend),
      `${formatNumber(entry.raidNormalShopSpend)} |`,
    ].join(" | "));
  }

  lines.push("", "## Signals", "");
  if (comparison.signals.length === 0) {
    lines.push("- No comparison signals.");
  } else {
    for (const signal of comparison.signals) {
      lines.push(`- ${signal.code}: ${signal.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
