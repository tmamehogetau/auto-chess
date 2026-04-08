import type { GameplayKpiSummary } from "../../src/server/analytics/gameplay-kpi";

export interface AggregateReport {
  sampledMatches: number;
  r8CompletionRate: number;
  prepInputFailureRate: number;
  top1CompositionShare: number;
}

export interface RefinedEligibleAggregate extends AggregateReport {
  mostCommonTop1Composition: string | null;
}

export interface RoundSurvivalClassification {
  totalMatches: number;
  matchesWithKpi: number;
  matchesEndingBeforeR8: number;
  totalPlayersAcrossSamples: number;
  playersSurvivingR8: number;
}

export interface EligibleFailureClassification {
  totalEligibleMatches: number;
  matchesBelowR8Threshold: number;
  phaseProgressOnlyCases: number;
  playerHpDamageCases: number;
  earlyEliminationCases: number;
}

export interface KpiEvidenceRecord {
  suitePath: string;
  testName: string | null;
  data: GameplayKpiSummary;
}

export interface MatchSummaryFixture {
  suitePath: string;
  testName: string | null;
  totalRounds: number;
}

export interface KpiReplanClassificationEvidenceFixture {
  records: KpiEvidenceRecord[];
  matchSummaries: MatchSummaryFixture[];
  eligibleRecords: KpiEvidenceRecord[];
  incidentalRecords: KpiEvidenceRecord[];
  combinedBundle: RefinedEligibleAggregate;
  currentRealisticAggregate: AggregateReport;
  eligibleBundle: RefinedEligibleAggregate;
  incidentalBundle: RefinedEligibleAggregate;
  refinedEligibleBundle: RefinedEligibleAggregate;
  eligibleFailureClassification: EligibleFailureClassification;
  roundSurvivalClassification: RoundSurvivalClassification;
}

const KPI_EVIDENCE_SUITE_MANIFEST = {
  "tests/server/full-game-simulation.integration.test.ts": "eligible",
  "tests/server/realistic-kpi-simulation.integration.test.ts": "eligible",
  "tests/server/game-room.feature-flag.integration.test.ts": "incidental",
  "tests/server/kpi-replan-classification.integration.test.ts": "incidental",
} as const;

const FULL_GAME_EVIDENCE_CASE_MANIFEST = {
  "4人でR8完走後にEndフェーズへ遷移する": "eligible",
  "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する": "eligible",
  "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する": "eligible",
  "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する": "eligible",
  "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する": "eligible",
  "Touhou unitId は buy -> bench -> board -> sell で共有プール返却まで維持される": "incidental",
  "MVP unit は unitId なしでも buy -> bench -> board が従来どおり動く": "incidental",
  "各ラウンドで正しいフェーズサイクルが実行される": "incidental",
  "プレイヤーが4人接続したままゲームが継続する": "incidental",
  "round_stateメッセージが各フェーズで送信される": "incidental",
} as const;

function buildGameplayKpiSummary(options: {
  totalRounds: number;
  top1CompositionSignature: string;
  playersSurvivedR8?: number;
  totalPlayers?: number;
  failedPrepCommands?: number;
  totalPrepCommands?: number;
}): GameplayKpiSummary {
  const totalPlayers = options.totalPlayers ?? 4;
  const playersSurvivedR8 = options.playersSurvivedR8 ?? 4;
  const failedPrepCommands = options.failedPrepCommands ?? 0;
  const totalPrepCommands = options.totalPrepCommands ?? 24;

  return {
    totalRounds: options.totalRounds,
    playerCount: totalPlayers,
    playersSurvivedR8,
    totalPlayers,
    r8CompletionRate: totalPlayers > 0 ? playersSurvivedR8 / totalPlayers : 0,
    top1CompositionSignature: options.top1CompositionSignature,
    failedPrepCommands,
    totalPrepCommands,
    prepInputFailureRate: totalPrepCommands > 0 ? failedPrepCommands / totalPrepCommands : 0,
  };
}

function buildEvidenceRecord(
  suitePath: string,
  testName: string | null,
  summary: GameplayKpiSummary,
): KpiEvidenceRecord {
  return {
    suitePath,
    testName,
    data: summary,
  };
}

function buildMatchSummary(
  suitePath: string,
  testName: string | null,
  totalRounds: number,
): MatchSummaryFixture {
  return {
    suitePath,
    testName,
    totalRounds,
  };
}

function aggregateRecords(records: KpiEvidenceRecord[]): RefinedEligibleAggregate {
  let sampledMatches = 0;
  let totalPlayersSurvivedR8 = 0;
  let totalPlayers = 0;
  let totalFailedPrepCommands = 0;
  let totalPrepCommands = 0;
  const compositionCounts = new Map<string, number>();

  for (const record of records) {
    sampledMatches += 1;

    totalPlayersSurvivedR8 += record.data.playersSurvivedR8;
    totalPlayers += record.data.totalPlayers;
    totalFailedPrepCommands += record.data.failedPrepCommands;
    totalPrepCommands += record.data.totalPrepCommands;

    const signature = record.data.top1CompositionSignature;
    if (!signature) {
      continue;
    }

    compositionCounts.set(signature, (compositionCounts.get(signature) ?? 0) + 1);
  }

  let mostCommonTop1Composition: string | null = null;
  let maxCount = 0;
  for (const [signature, count] of compositionCounts.entries()) {
    if (count > maxCount || (count === maxCount && (mostCommonTop1Composition === null || signature < mostCommonTop1Composition))) {
      maxCount = count;
      mostCommonTop1Composition = signature;
    }
  }

  return {
    sampledMatches,
    r8CompletionRate: totalPlayers > 0 ? totalPlayersSurvivedR8 / totalPlayers : 0,
    prepInputFailureRate: totalPrepCommands > 0 ? totalFailedPrepCommands / totalPrepCommands : 0,
    top1CompositionShare: sampledMatches > 0 && maxCount > 0 ? maxCount / sampledMatches : 0,
    mostCommonTop1Composition,
  };
}

function classifyEligibleFailure(records: KpiEvidenceRecord[]): EligibleFailureClassification {
  let matchesBelowR8Threshold = 0;
  let phaseProgressOnlyCases = 0;
  let playerHpDamageCases = 0;
  let earlyEliminationCases = 0;

  for (const record of records) {
    if (record.data.r8CompletionRate < 0.97) {
      matchesBelowR8Threshold += 1;
    }

    if (record.data.totalRounds < 8) {
      earlyEliminationCases += 1;
      continue;
    }

    if (record.suitePath === "tests/server/full-game-simulation.integration.test.ts") {
      phaseProgressOnlyCases += 1;
    }
  }

  return {
    totalEligibleMatches: records.length,
    matchesBelowR8Threshold,
    phaseProgressOnlyCases,
    playerHpDamageCases,
    earlyEliminationCases,
  };
}

function classifyRoundSurvival(
  matchSummaries: MatchSummaryFixture[],
  kpiRecords: KpiEvidenceRecord[],
): RoundSurvivalClassification {
  return {
    totalMatches: matchSummaries.length,
    matchesWithKpi: kpiRecords.length,
    matchesEndingBeforeR8: matchSummaries.filter((summary) => summary.totalRounds < 8).length,
    totalPlayersAcrossSamples: kpiRecords.reduce((sum, record) => sum + record.data.totalPlayers, 0),
    playersSurvivingR8: kpiRecords.reduce((sum, record) => sum + record.data.playersSurvivedR8, 0),
  };
}

function isEligibleRecord(record: KpiEvidenceRecord): boolean {
  if (record.suitePath === "tests/server/full-game-simulation.integration.test.ts") {
    return (
      record.testName !== null &&
      (FULL_GAME_EVIDENCE_CASE_MANIFEST as Record<string, "eligible" | "incidental">)[record.testName] === "eligible"
    );
  }

  return KPI_EVIDENCE_SUITE_MANIFEST[record.suitePath as keyof typeof KPI_EVIDENCE_SUITE_MANIFEST] === "eligible";
}

function buildRawKpiEvidenceRecords(): KpiEvidenceRecord[] {
  return [
    buildEvidenceRecord(
      "tests/server/full-game-simulation.integration.test.ts",
      "4人でR8完走後にEndフェーズへ遷移する",
      buildGameplayKpiSummary({
        totalRounds: 8,
        top1CompositionSignature: "vanguard:1,vanguard:1,vanguard:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/full-game-simulation.integration.test.ts",
      "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する",
      buildGameplayKpiSummary({
        totalRounds: 12,
        top1CompositionSignature: "mage:1,mage:1,mage:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/full-game-simulation.integration.test.ts",
      "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する",
      buildGameplayKpiSummary({
        totalRounds: 8,
        top1CompositionSignature: "ranger:1,ranger:1,ranger:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/full-game-simulation.integration.test.ts",
      "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する",
      buildGameplayKpiSummary({
        totalRounds: 12,
        top1CompositionSignature: "assassin:1,assassin:1,assassin:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/full-game-simulation.integration.test.ts",
      "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する",
      buildGameplayKpiSummary({
        totalRounds: 8,
        top1CompositionSignature: "vanguard:1,vanguard:1,vanguard:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      buildGameplayKpiSummary({
        totalRounds: 8,
        top1CompositionSignature: "vanguard:1,vanguard:1,vanguard:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      buildGameplayKpiSummary({
        totalRounds: 8,
        top1CompositionSignature: "mage:1,mage:1,mage:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      buildGameplayKpiSummary({
        totalRounds: 12,
        top1CompositionSignature: "mage:1,mage:1,mage:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      buildGameplayKpiSummary({
        totalRounds: 8,
        top1CompositionSignature: "ranger:1,ranger:1,ranger:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      buildGameplayKpiSummary({
        totalRounds: 12,
        top1CompositionSignature: "ranger:1,ranger:1,ranger:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      buildGameplayKpiSummary({
        totalRounds: 8,
        top1CompositionSignature: "assassin:1,assassin:1,assassin:1",
      }),
    ),
    buildEvidenceRecord(
      "tests/server/full-game-simulation.integration.test.ts",
      "各ラウンドで正しいフェーズサイクルが実行される",
      buildGameplayKpiSummary({
        totalRounds: 6,
        playersSurvivedR8: 0,
        top1CompositionSignature: "",
        failedPrepCommands: 1,
        totalPrepCommands: 1,
      }),
    ),
    buildEvidenceRecord(
      "tests/server/full-game-simulation.integration.test.ts",
      "プレイヤーが4人接続したままゲームが継続する",
      buildGameplayKpiSummary({
        totalRounds: 4,
        playersSurvivedR8: 0,
        top1CompositionSignature: "",
        failedPrepCommands: 0,
        totalPrepCommands: 2,
      }),
    ),
  ];
}

function buildRawMatchSummaries(): MatchSummaryFixture[] {
  return [
    buildMatchSummary(
      "tests/server/full-game-simulation.integration.test.ts",
      "4人でR8完走後にEndフェーズへ遷移する",
      8,
    ),
    buildMatchSummary(
      "tests/server/full-game-simulation.integration.test.ts",
      "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する",
      12,
    ),
    buildMatchSummary(
      "tests/server/full-game-simulation.integration.test.ts",
      "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する",
      8,
    ),
    buildMatchSummary(
      "tests/server/full-game-simulation.integration.test.ts",
      "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する",
      12,
    ),
    buildMatchSummary(
      "tests/server/full-game-simulation.integration.test.ts",
      "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する",
      8,
    ),
    buildMatchSummary(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      8,
    ),
    buildMatchSummary(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      8,
    ),
    buildMatchSummary(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      12,
    ),
    buildMatchSummary(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      8,
    ),
    buildMatchSummary(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      12,
    ),
    buildMatchSummary(
      "tests/server/realistic-kpi-simulation.integration.test.ts",
      null,
      8,
    ),
    buildMatchSummary(
      "tests/server/full-game-simulation.integration.test.ts",
      "各ラウンドで正しいフェーズサイクルが実行される",
      6,
    ),
    buildMatchSummary(
      "tests/server/full-game-simulation.integration.test.ts",
      "プレイヤーが4人接続したままゲームが継続する",
      4,
    ),
  ];
}

export function getKpiEvidenceSuiteManifest(): Record<string, "eligible" | "incidental"> {
  return {
    ...KPI_EVIDENCE_SUITE_MANIFEST,
  };
}

export function getFullGameEvidenceCaseManifest(): Record<string, "eligible" | "incidental"> {
  return {
    ...FULL_GAME_EVIDENCE_CASE_MANIFEST,
  };
}

export function getKpiReplanClassificationEvidenceFixture(): KpiReplanClassificationEvidenceFixture {
  const records = buildRawKpiEvidenceRecords();
  const matchSummaries = buildRawMatchSummaries();
  const eligibleRecords = records.filter(isEligibleRecord);
  const incidentalRecords = records.filter((record) => !isEligibleRecord(record));

  const combinedBundle = aggregateRecords(records);
  const eligibleBundle = aggregateRecords(eligibleRecords);
  const incidentalBundle = aggregateRecords(incidentalRecords);
  const refinedEligibleBundle: RefinedEligibleAggregate = {
    sampledMatches: 11,
    r8CompletionRate: 1,
    prepInputFailureRate: 0,
    top1CompositionShare: 3 / 11,
    mostCommonTop1Composition: "mage:1,mage:1,mage:1",
  };

  return {
    records,
    matchSummaries,
    eligibleRecords,
    incidentalRecords,
    combinedBundle,
    currentRealisticAggregate: eligibleBundle,
    eligibleBundle,
    incidentalBundle,
    refinedEligibleBundle,
    eligibleFailureClassification: classifyEligibleFailure(eligibleRecords),
    roundSurvivalClassification: classifyRoundSurvival(matchSummaries, records),
  };
}
