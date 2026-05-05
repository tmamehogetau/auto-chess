import { BattleSimulator, createBattleUnit, type BattleUnit } from "../../../src/server/combat/battle-simulator";
import { createSeededBattleRng } from "../../../src/server/combat/battle-rng";
import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";
import { sharedBoardCoordinateToIndex } from "../../../src/shared/board-geometry";
import type { BattleTimelineEvent, BoardUnitPlacement, BoardUnitType } from "../../../src/shared/room-messages";

type ProbeSide = "fit" | "nonfit";
type TargetVariant = "target" | "replacement";

export type BotArchetypeControlledProbeOptions = {
  samplesPerScenario?: number;
  unitIds?: string[];
  unitLevel?: number;
  enemyUnitLevel?: number;
  roundIndex?: number;
  seedBase?: number;
};

export type BotArchetypeControlledProbeMetric = {
  unitId: string;
  unitName: string;
  unitType: BoardUnitType;
  primaryArchetypeTag: string;
  roundIndex: number;
  unitLevel: number;
  enemyUnitLevel: number;
  fitBattleCount: number;
  nonFitBattleCount: number;
  comparableBattleCount: number;
  averageFitEffectiveStrengthScore: number;
  averageNonFitEffectiveStrengthScore: number;
  effectiveStrengthLift: number;
  effectiveStrengthIndex: number | null;
  averageFitBoardStrengthScore: number;
  averageNonFitBoardStrengthScore: number;
  averageFitReplacementBoardStrengthScore: number;
  averageNonFitReplacementBoardStrengthScore: number;
  averageFitMarginalStrengthScore: number;
  averageNonFitMarginalStrengthScore: number;
  marginalStrengthLift: number;
  marginalStrengthIndex: number | null;
  averageFitTargetDamage: number;
  averageNonFitTargetDamage: number;
  fitWinRate: number;
  nonFitWinRate: number;
};

export type BotArchetypeControlledProbeReport = {
  samplesPerScenario: number;
  roundIndex: number;
  unitLevel: number;
  enemyUnitLevel: number;
  seedBase: number;
  metrics: BotArchetypeControlledProbeMetric[];
};

type ProbeUnitDefinition = {
  unitId: string;
  unitName: string;
  unitType: BoardUnitType;
  replacementUnitId: string;
  archetype: string;
  primaryArchetypeTag: string;
  fitAllies: ProbeAllyDefinition[];
  nonFitAllies: ProbeAllyDefinition[];
};

type ProbeAllyDefinition = {
  unitId: string;
  unitType: BoardUnitType;
  archetype?: string;
};

type ProbeAccumulator = {
  definition: ProbeUnitDefinition;
  fitBattleCount: number;
  nonFitBattleCount: number;
  totalFitEffectiveStrengthScore: number;
  totalNonFitEffectiveStrengthScore: number;
  totalFitBoardStrengthScore: number;
  totalNonFitBoardStrengthScore: number;
  totalFitReplacementBoardStrengthScore: number;
  totalNonFitReplacementBoardStrengthScore: number;
  totalFitMarginalStrengthScore: number;
  totalNonFitMarginalStrengthScore: number;
  totalFitTargetDamage: number;
  totalNonFitTargetDamage: number;
  fitWins: number;
  nonFitWins: number;
};

type ProbeSampleResult = {
  targetDamage: number;
  effectiveStrengthScore: number;
  boardStrengthScore: number;
  won: boolean;
};

type ProbePairResult = {
  target: ProbeSampleResult;
  replacement: ProbeSampleResult;
  marginalStrengthScore: number;
};

const DEFAULT_SAMPLES_PER_SCENARIO = 50;
const DEFAULT_ROUND_INDEX = 7;
const DEFAULT_UNIT_LEVEL = 4;
const DEFAULT_SEED_BASE = 1000;

const RAID_COORDINATES = [
  { x: 0, y: 3 },
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
] as const;

const BOSS_COORDINATES = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
] as const;

const TARGET_COORDINATE_OPTIONS = [2, 1, 3] as const;

type ProbeScenario = {
  targetCoordinateIndex: number;
  allyCoordinateOrder: number[];
  enemyCoordinateOrder: number[];
  enemyUnits: ProbeAllyDefinition[];
};

const PROBE_UNIT_DEFINITIONS: ProbeUnitDefinition[] = [
  {
    unitId: "patchouli",
    unitName: "パチュリー・ノーレッジ",
    unitType: "mage",
    replacementUnitId: "futo",
    archetype: "patchouli",
    primaryArchetypeTag: "scarlet_core",
    fitAllies: [
      { unitId: "meiling", unitType: "vanguard", archetype: "meiling" },
      { unitId: "sakuya", unitType: "assassin", archetype: "sakuya" },
    ],
    nonFitAllies: [
      { unitId: "kagerou", unitType: "vanguard" },
      { unitId: "seiga", unitType: "assassin" },
    ],
  },
  {
    unitId: "sakuya",
    unitName: "十六夜咲夜",
    unitType: "assassin",
    replacementUnitId: "seiga",
    archetype: "sakuya",
    primaryArchetypeTag: "scarlet_core",
    fitAllies: [
      { unitId: "meiling", unitType: "vanguard", archetype: "meiling" },
      { unitId: "patchouli", unitType: "mage", archetype: "patchouli" },
    ],
    nonFitAllies: [
      { unitId: "kagerou", unitType: "vanguard" },
      { unitId: "futo", unitType: "mage" },
    ],
  },
  {
    unitId: "meiling",
    unitName: "紅美鈴",
    unitType: "vanguard",
    replacementUnitId: "kagerou",
    archetype: "meiling",
    primaryArchetypeTag: "scarlet_core",
    fitAllies: [
      { unitId: "sakuya", unitType: "assassin", archetype: "sakuya" },
      { unitId: "patchouli", unitType: "mage", archetype: "patchouli" },
    ],
    nonFitAllies: [
      { unitId: "seiga", unitType: "assassin" },
      { unitId: "futo", unitType: "mage" },
    ],
  },
  {
    unitId: "byakuren",
    unitName: "聖白蓮",
    unitType: "vanguard",
    replacementUnitId: "junko",
    archetype: "byakuren",
    primaryArchetypeTag: "myourenji_core",
    fitAllies: [
      { unitId: "nazrin", unitType: "ranger" },
      { unitId: "ichirin", unitType: "vanguard" },
      { unitId: "murasa", unitType: "mage" },
      { unitId: "shou", unitType: "mage" },
    ],
    nonFitAllies: [
      { unitId: "seiga", unitType: "assassin" },
      { unitId: "megumu", unitType: "ranger" },
      { unitId: "utsuho", unitType: "mage" },
      { unitId: "kagerou", unitType: "vanguard" },
    ],
  },
  {
    unitId: "utsuho",
    unitName: "霊烏路空",
    unitType: "mage",
    replacementUnitId: "futo",
    archetype: "utsuho",
    primaryArchetypeTag: "chireiden_core",
    fitAllies: [
      { unitId: "rin", unitType: "vanguard" },
      { unitId: "satori", unitType: "mage" },
      { unitId: "koishi", unitType: "assassin" },
    ],
    nonFitAllies: [
      { unitId: "nazrin", unitType: "ranger" },
      { unitId: "seiga", unitType: "assassin" },
      { unitId: "megumu", unitType: "ranger" },
    ],
  },
  {
    unitId: "miko",
    unitName: "豊聡耳神子",
    unitType: "mage",
    replacementUnitId: "hecatia",
    archetype: "miko",
    primaryArchetypeTag: "shinreibyou_core",
    fitAllies: [
      { unitId: "yoshika", unitType: "vanguard" },
      { unitId: "seiga", unitType: "assassin" },
      { unitId: "tojiko", unitType: "ranger" },
      { unitId: "futo", unitType: "mage" },
    ],
    nonFitAllies: [
      { unitId: "rin", unitType: "vanguard" },
      { unitId: "nazrin", unitType: "ranger" },
      { unitId: "megumu", unitType: "ranger" },
      { unitId: "clownpiece", unitType: "ranger" },
    ],
  },
  {
    unitId: "kagerou",
    unitName: "今泉影狼",
    unitType: "vanguard",
    replacementUnitId: "momoyo",
    archetype: "kagerou",
    primaryArchetypeTag: "grassroot_core",
    fitAllies: [
      { unitId: "wakasagihime", unitType: "ranger" },
      { unitId: "sekibanki", unitType: "assassin" },
    ],
    nonFitAllies: [
      { unitId: "nazrin", unitType: "ranger" },
      { unitId: "seiga", unitType: "assassin" },
    ],
  },
  {
    unitId: "megumu",
    unitName: "飯綱丸龍",
    unitType: "ranger",
    replacementUnitId: "tojiko",
    archetype: "megumu",
    primaryArchetypeTag: "kou_ryuudou_core",
    fitAllies: [
      { unitId: "tsukasa", unitType: "mage" },
      { unitId: "chimata", unitType: "mage" },
      { unitId: "momoyo", unitType: "vanguard" },
    ],
    nonFitAllies: [
      { unitId: "nazrin", unitType: "ranger" },
      { unitId: "seiga", unitType: "assassin" },
      { unitId: "kagerou", unitType: "vanguard" },
    ],
  },
  {
    unitId: "hecatia",
    unitName: "ヘカーティア・ラピスラズリ",
    unitType: "mage",
    replacementUnitId: "miko",
    archetype: "hecatia",
    primaryArchetypeTag: "kanjuden_core",
    fitAllies: [
      { unitId: "clownpiece", unitType: "ranger" },
      { unitId: "junko", unitType: "vanguard" },
    ],
    nonFitAllies: [
      { unitId: "nazrin", unitType: "ranger" },
      { unitId: "seiga", unitType: "assassin" },
    ],
  },
  {
    unitId: "zanmu",
    unitName: "日白残無",
    unitType: "mage",
    replacementUnitId: "hecatia",
    archetype: "zanmu",
    primaryArchetypeTag: "factionless_carry",
    fitAllies: [
      { unitId: "junko", unitType: "vanguard" },
      { unitId: "seiga", unitType: "assassin" },
      { unitId: "megumu", unitType: "ranger" },
      { unitId: "kagerou", unitType: "vanguard" },
    ],
    nonFitAllies: [
      { unitId: "nazrin", unitType: "ranger" },
      { unitId: "ichirin", unitType: "vanguard" },
      { unitId: "murasa", unitType: "mage" },
      { unitId: "shou", unitType: "mage" },
    ],
  },
];

function boardIndex(coordinate: { x: number; y: number }): number {
  return sharedBoardCoordinateToIndex(coordinate);
}

function nextShuffleSeed(seed: number): number {
  return (seed * 1_664_525 + 1_013_904_223) >>> 0;
}

function shuffleBySeed<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  let currentSeed = seed >>> 0;
  for (let index = result.length - 1; index > 0; index -= 1) {
    currentSeed = nextShuffleSeed(currentSeed);
    const swapIndex = currentSeed % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function createProbeScenario(seed: number, allyCount: number, enemyCount: number): ProbeScenario {
  const targetCoordinateIndex = TARGET_COORDINATE_OPTIONS[Math.abs(seed) % TARGET_COORDINATE_OPTIONS.length]!;
  const allyCoordinateCandidates = RAID_COORDINATES
    .map((_, index) => index)
    .filter((index) => index !== targetCoordinateIndex);
  const enemyUnitCandidates: ProbeAllyDefinition[] = [
    { unitId: "junko", unitType: "vanguard" },
    { unitId: "hecatia", unitType: "mage" },
    { unitId: "miko", unitType: "mage" },
    { unitId: "byakuren", unitType: "vanguard" },
    { unitId: "zanmu", unitType: "mage" },
  ];

  return {
    targetCoordinateIndex,
    allyCoordinateOrder: shuffleBySeed(allyCoordinateCandidates, seed + 17).slice(0, allyCount),
    enemyCoordinateOrder: shuffleBySeed(BOSS_COORDINATES.map((_, index) => index), seed + 31).slice(0, enemyCount),
    enemyUnits: shuffleBySeed(enemyUnitCandidates, seed + 43).slice(0, enemyCount),
  };
}

function createTargetPlacement(
  definition: ProbeUnitDefinition,
  unitLevel: number,
  variant: TargetVariant,
  scenario: ProbeScenario,
): BoardUnitPlacement {
  const placement: BoardUnitPlacement = {
    cell: boardIndex(RAID_COORDINATES[scenario.targetCoordinateIndex]!),
    unitType: definition.unitType,
    unitLevel,
  };
  if (variant === "target") {
    placement.unitId = definition.unitId;
    placement.archetype = definition.archetype;
  } else {
    placement.unitId = definition.replacementUnitId;
  }
  return placement;
}

function createFitAllyPlacement(
  ally: ProbeAllyDefinition,
  unitLevel: number,
  coordinateIndex: number,
): BoardUnitPlacement {
  const placement: BoardUnitPlacement = {
    cell: boardIndex(RAID_COORDINATES[coordinateIndex]!),
    unitType: ally.unitType,
    unitId: ally.unitId,
    unitLevel,
  };
  if (ally.archetype) {
    placement.archetype = ally.archetype;
  }
  return placement;
}

function createEnemyPlacements(unitLevel: number, scenario: ProbeScenario): BoardUnitPlacement[] {
  return scenario.enemyUnits.map((unit, index) => ({
    cell: boardIndex(BOSS_COORDINATES[scenario.enemyCoordinateOrder[index]!]!),
    unitType: unit.unitType,
    unitId: unit.unitId,
    unitLevel,
  }));
}

function createLeftPlacements(
  definition: ProbeUnitDefinition,
  side: ProbeSide,
  unitLevel: number,
  variant: TargetVariant,
  scenario: ProbeScenario,
): BoardUnitPlacement[] {
  const target = createTargetPlacement(definition, unitLevel, variant, scenario);
  const allies = side === "fit" ? definition.fitAllies : definition.nonFitAllies;
  return [
    target,
    ...allies.map((ally, index) =>
      createFitAllyPlacement(ally, unitLevel, scenario.allyCoordinateOrder[index]!)),
  ];
}

function createBattleUnits(placements: BoardUnitPlacement[], side: "left" | "right"): BattleUnit[] {
  return placements.map((placement, index) =>
    createBattleUnit(placement, side, index, false, DEFAULT_FLAGS),
  );
}

function sumDamageBySource(timeline: BattleTimelineEvent[], sourceBattleUnitId: string): number {
  return timeline.reduce((total, event) =>
    event.type === "damageApplied" && event.sourceBattleUnitId === sourceBattleUnitId
      ? total + event.amount
      : total,
  0);
}

function calculateEffectiveStrengthScore(unit: BattleUnit, targetDamage: number): number {
  const remainingHp = Math.max(0, unit.hp);
  const absorbedDamage = Math.max(0, unit.maxHp - remainingHp);
  return targetDamage + absorbedDamage * 0.35 + remainingHp * 0.5;
}

function sumHp(units: BattleUnit[]): number {
  return units.reduce((total, unit) => total + Math.max(0, unit.hp), 0);
}

function calculateBoardStrengthScore(result: ReturnType<BattleSimulator["simulateBattle"]>): number {
  const winScore = result.winner === "left" ? 1_000 : result.winner === "right" ? -1_000 : 0;
  const tempoScore = result.winner === "left" ? Math.max(0, 30_000 - result.durationMs) * 0.02 : 0;
  return (
    winScore
    + tempoScore
    + result.damageDealt.left
    - result.damageDealt.right
    + sumHp(result.leftSurvivors) * 0.5
    - sumHp(result.rightSurvivors) * 0.5
  );
}

function runProbeSample(
  definition: ProbeUnitDefinition,
  side: ProbeSide,
  unitLevel: number,
  enemyUnitLevel: number,
  roundIndex: number,
  seed: number,
  variant: TargetVariant,
  scenario: ProbeScenario,
): ProbeSampleResult {
  const leftPlacements = createLeftPlacements(definition, side, unitLevel, variant, scenario);
  const rightPlacements = createEnemyPlacements(enemyUnitLevel, scenario);
  const leftUnits = createBattleUnits(leftPlacements, "left");
  const rightUnits = createBattleUnits(rightPlacements, "right");
  const targetUnit = leftUnits[0]!;
  const simulator = new BattleSimulator({ rng: createSeededBattleRng(seed) });
  const result = simulator.simulateBattle(
    leftUnits,
    rightUnits,
    leftPlacements,
    rightPlacements,
    30_000,
    null,
    null,
    null,
    DEFAULT_FLAGS,
    roundIndex,
  );
  const targetDamage = sumDamageBySource(result.timeline, targetUnit.id);

  return {
    targetDamage,
    effectiveStrengthScore: calculateEffectiveStrengthScore(targetUnit, targetDamage),
    boardStrengthScore: calculateBoardStrengthScore(result),
    won: result.winner === "left",
  };
}

function runProbePair(
  definition: ProbeUnitDefinition,
  side: ProbeSide,
  unitLevel: number,
  enemyUnitLevel: number,
  roundIndex: number,
  seed: number,
): ProbePairResult {
  const allyCount = side === "fit" ? definition.fitAllies.length : definition.nonFitAllies.length;
  const scenario = createProbeScenario(seed, allyCount, allyCount + 1);
  const target = runProbeSample(definition, side, unitLevel, enemyUnitLevel, roundIndex, seed, "target", scenario);
  const replacement = runProbeSample(
    definition,
    side,
    unitLevel,
    enemyUnitLevel,
    roundIndex,
    seed,
    "replacement",
    scenario,
  );
  return {
    target,
    replacement,
    marginalStrengthScore: target.boardStrengthScore - replacement.boardStrengthScore,
  };
}

function createAccumulator(definition: ProbeUnitDefinition): ProbeAccumulator {
  return {
    definition,
    fitBattleCount: 0,
    nonFitBattleCount: 0,
    totalFitEffectiveStrengthScore: 0,
    totalNonFitEffectiveStrengthScore: 0,
    totalFitBoardStrengthScore: 0,
    totalNonFitBoardStrengthScore: 0,
    totalFitReplacementBoardStrengthScore: 0,
    totalNonFitReplacementBoardStrengthScore: 0,
    totalFitMarginalStrengthScore: 0,
    totalNonFitMarginalStrengthScore: 0,
    totalFitTargetDamage: 0,
    totalNonFitTargetDamage: 0,
    fitWins: 0,
    nonFitWins: 0,
  };
}

function recordSample(accumulator: ProbeAccumulator, side: ProbeSide, pair: ProbePairResult): void {
  if (side === "fit") {
    accumulator.fitBattleCount += 1;
    accumulator.totalFitEffectiveStrengthScore += pair.target.effectiveStrengthScore;
    accumulator.totalFitBoardStrengthScore += pair.target.boardStrengthScore;
    accumulator.totalFitReplacementBoardStrengthScore += pair.replacement.boardStrengthScore;
    accumulator.totalFitMarginalStrengthScore += pair.marginalStrengthScore;
    accumulator.totalFitTargetDamage += pair.target.targetDamage;
    accumulator.fitWins += pair.target.won ? 1 : 0;
    return;
  }

  accumulator.nonFitBattleCount += 1;
  accumulator.totalNonFitEffectiveStrengthScore += pair.target.effectiveStrengthScore;
  accumulator.totalNonFitBoardStrengthScore += pair.target.boardStrengthScore;
  accumulator.totalNonFitReplacementBoardStrengthScore += pair.replacement.boardStrengthScore;
  accumulator.totalNonFitMarginalStrengthScore += pair.marginalStrengthScore;
  accumulator.totalNonFitTargetDamage += pair.target.targetDamage;
  accumulator.nonFitWins += pair.target.won ? 1 : 0;
}

function divideOrZero(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function buildMetric(
  accumulator: ProbeAccumulator,
  roundIndex: number,
  unitLevel: number,
  enemyUnitLevel: number,
): BotArchetypeControlledProbeMetric {
  const averageFitEffectiveStrengthScore = divideOrZero(
    accumulator.totalFitEffectiveStrengthScore,
    accumulator.fitBattleCount,
  );
  const averageNonFitEffectiveStrengthScore = divideOrZero(
    accumulator.totalNonFitEffectiveStrengthScore,
    accumulator.nonFitBattleCount,
  );
  const effectiveStrengthLift = averageFitEffectiveStrengthScore - averageNonFitEffectiveStrengthScore;
  const effectiveStrengthIndex = averageNonFitEffectiveStrengthScore > 0
    ? averageFitEffectiveStrengthScore / averageNonFitEffectiveStrengthScore
    : null;
  const averageFitMarginalStrengthScore = divideOrZero(
    accumulator.totalFitMarginalStrengthScore,
    accumulator.fitBattleCount,
  );
  const averageNonFitMarginalStrengthScore = divideOrZero(
    accumulator.totalNonFitMarginalStrengthScore,
    accumulator.nonFitBattleCount,
  );
  const marginalStrengthLift = averageFitMarginalStrengthScore - averageNonFitMarginalStrengthScore;
  const marginalStrengthIndex = averageNonFitMarginalStrengthScore > 0
    ? averageFitMarginalStrengthScore / averageNonFitMarginalStrengthScore
    : null;

  return {
    unitId: accumulator.definition.unitId,
    unitName: accumulator.definition.unitName,
    unitType: accumulator.definition.unitType,
    primaryArchetypeTag: accumulator.definition.primaryArchetypeTag,
    roundIndex,
    unitLevel,
    enemyUnitLevel,
    fitBattleCount: accumulator.fitBattleCount,
    nonFitBattleCount: accumulator.nonFitBattleCount,
    comparableBattleCount: accumulator.fitBattleCount + accumulator.nonFitBattleCount,
    averageFitEffectiveStrengthScore,
    averageNonFitEffectiveStrengthScore,
    effectiveStrengthLift,
    effectiveStrengthIndex,
    averageFitBoardStrengthScore: divideOrZero(accumulator.totalFitBoardStrengthScore, accumulator.fitBattleCount),
    averageNonFitBoardStrengthScore: divideOrZero(
      accumulator.totalNonFitBoardStrengthScore,
      accumulator.nonFitBattleCount,
    ),
    averageFitReplacementBoardStrengthScore: divideOrZero(
      accumulator.totalFitReplacementBoardStrengthScore,
      accumulator.fitBattleCount,
    ),
    averageNonFitReplacementBoardStrengthScore: divideOrZero(
      accumulator.totalNonFitReplacementBoardStrengthScore,
      accumulator.nonFitBattleCount,
    ),
    averageFitMarginalStrengthScore,
    averageNonFitMarginalStrengthScore,
    marginalStrengthLift,
    marginalStrengthIndex,
    averageFitTargetDamage: divideOrZero(accumulator.totalFitTargetDamage, accumulator.fitBattleCount),
    averageNonFitTargetDamage: divideOrZero(accumulator.totalNonFitTargetDamage, accumulator.nonFitBattleCount),
    fitWinRate: divideOrZero(accumulator.fitWins, accumulator.fitBattleCount),
    nonFitWinRate: divideOrZero(accumulator.nonFitWins, accumulator.nonFitBattleCount),
  };
}

function resolveProbeDefinitions(unitIds: string[] | undefined): ProbeUnitDefinition[] {
  if (!unitIds || unitIds.length === 0) {
    return PROBE_UNIT_DEFINITIONS;
  }

  const requested = new Set(unitIds);
  return PROBE_UNIT_DEFINITIONS.filter((definition) => requested.has(definition.unitId));
}

export function runBotArchetypeControlledProbe(
  options: BotArchetypeControlledProbeOptions = {},
): BotArchetypeControlledProbeReport {
  const samplesPerScenario = Math.max(1, Math.floor(options.samplesPerScenario ?? DEFAULT_SAMPLES_PER_SCENARIO));
  const roundIndex = Math.max(1, Math.floor(options.roundIndex ?? DEFAULT_ROUND_INDEX));
  const unitLevel = Math.max(1, Math.floor(options.unitLevel ?? DEFAULT_UNIT_LEVEL));
  const enemyUnitLevel = Math.max(1, Math.floor(options.enemyUnitLevel ?? unitLevel));
  const seedBase = Math.floor(options.seedBase ?? DEFAULT_SEED_BASE);
  const definitions = resolveProbeDefinitions(options.unitIds);

  const metrics = definitions.map((definition, definitionIndex) => {
    const accumulator = createAccumulator(definition);
    for (let sampleIndex = 0; sampleIndex < samplesPerScenario; sampleIndex += 1) {
      const seed = seedBase + definitionIndex * 10_000 + sampleIndex;
      recordSample(accumulator, "fit", runProbePair(definition, "fit", unitLevel, enemyUnitLevel, roundIndex, seed));
      recordSample(accumulator, "nonfit", runProbePair(
        definition,
        "nonfit",
        unitLevel,
        enemyUnitLevel,
        roundIndex,
        seed,
      ));
    }
    return buildMetric(accumulator, roundIndex, unitLevel, enemyUnitLevel);
  });

  return {
    samplesPerScenario,
    roundIndex,
    unitLevel,
    enemyUnitLevel,
    seedBase,
    metrics,
  };
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildBotArchetypeControlledProbeJapaneseMarkdown(
  report: BotArchetypeControlledProbeReport,
): string {
  const marginalLiftRanking = [...report.metrics]
    .sort((left, right) => right.marginalStrengthLift - left.marginalStrengthLift);

  return [
    "# Bot Archetype Controlled Probe レポート",
    "",
    "## 実行条件",
    "",
    `- fit/nonfit 各サンプル数: ${report.samplesPerScenario}`,
    `- R: ${report.roundIndex}`,
    `- Lv: ${report.unitLevel}`,
    `- Enemy Lv: ${report.enemyUnitLevel}`,
    `- seedBase: ${report.seedBase}`,
    "",
    "## ユニット別 controlled 比較",
    "",
    "| ユニット名 | ユニットID | アーキタイプ | R | Lv | 比較戦闘数 | fit限界score | nonfit限界score | 限界リフト | 限界指数 | fit実効score | nonfit実効score | fit与ダメ | nonfit与ダメ | fit勝率 | nonfit勝率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.metrics.map((metric) =>
      `| ${metric.unitName} | ${metric.unitId} | ${metric.primaryArchetypeTag} | ${metric.roundIndex} | ${metric.unitLevel} | ${metric.comparableBattleCount} | ${formatNumber(metric.averageFitMarginalStrengthScore)} | ${formatNumber(metric.averageNonFitMarginalStrengthScore)} | ${formatNumber(metric.marginalStrengthLift)} | ${formatNumber(metric.marginalStrengthIndex)} | ${formatNumber(metric.averageFitEffectiveStrengthScore)} | ${formatNumber(metric.averageNonFitEffectiveStrengthScore)} | ${formatNumber(metric.averageFitTargetDamage)} | ${formatNumber(metric.averageNonFitTargetDamage)} | ${formatPercent(metric.fitWinRate)} | ${formatPercent(metric.nonFitWinRate)} |`),
    "",
    "## 限界リフトランキング",
    "",
    "| 順位 | ユニット名 | ユニットID | アーキタイプ | 限界リフト | fit勝率 | nonfit勝率 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...marginalLiftRanking.map((metric, index) =>
      `| ${index + 1} | ${metric.unitName} | ${metric.unitId} | ${metric.primaryArchetypeTag} | ${formatNumber(metric.marginalStrengthLift)} | ${formatPercent(metric.fitWinRate)} | ${formatPercent(metric.nonFitWinRate)} |`),
    "",
  ].join("\n");
}
