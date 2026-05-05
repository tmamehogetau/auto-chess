import { createSeededBattleRng } from "../../../src/server/combat/battle-rng";
import { HEROES } from "../../../src/data/heroes";
import { BOSS_CHARACTERS } from "../../../src/shared/boss-characters";
import { sharedBoardCoordinateToIndex } from "../../../src/shared/shared-board-config";
import {
  BattleSimulator,
  createBattleUnit,
  type BattleUnit,
  type BattleResult,
  type BossSpellBattleMetric,
} from "../../../src/server/combat/battle-simulator";
import { getSpecialUnitCombatMultiplier } from "../../../src/server/special-unit-level-config";
import { DEFAULT_FLAGS, type FeatureFlags } from "../../../src/shared/feature-flags";
import type { AttachedSubUnitPlacement, BoardUnitPlacement, BoardUnitType } from "../../../src/shared/room-messages";
import { getMvpPhase1Boss, type SubUnitConfig } from "../../../src/shared/types";

export type BotBattleDiagnosticVariant = {
  id: string;
  flags?: Partial<FeatureFlags>;
  disabledFactionIds?: "all" | string[];
};

export type BotBattleOnlyDiagnosticOptions = {
  leftPlacements: BoardUnitPlacement[];
  rightPlacements: BoardUnitPlacement[];
  variants?: BotBattleDiagnosticVariant[];
  seeds?: number[];
  battleSeed?: number;
  samplesPerVariant?: number;
  seedBase?: number;
  maxDurationMs?: number;
  round?: number;
  baselineVariantId?: string;
  leftHeroSynergyBonusType?: BoardUnitType | BoardUnitType[] | null;
  rightHeroSynergyBonusType?: BoardUnitType | BoardUnitType[] | null;
  subUnitAssistConfigByType?: ReadonlyMap<BoardUnitType, SubUnitConfig> | null;
  leftBossUnitIds?: readonly string[];
  rightBossUnitIds?: readonly string[];
  leftActiveBossSpellId?: string | null;
  rightActiveBossSpellId?: string | null;
  leftBossHpOverride?: number;
  rightBossHpOverride?: number;
  includeBattleSamples?: boolean;
};

export type BotBattleOnlyScenario = Pick<
  BotBattleOnlyDiagnosticOptions,
  | "leftPlacements"
  | "rightPlacements"
  | "battleSeed"
  | "round"
  | "leftBossUnitIds"
  | "rightBossUnitIds"
  | "leftHeroSynergyBonusType"
  | "rightHeroSynergyBonusType"
  | "leftActiveBossSpellId"
  | "rightActiveBossSpellId"
  | "leftBossHpOverride"
  | "rightBossHpOverride"
>;

export type BotBattleOnlySnapshotBoardUnit = {
  cell: number;
  unitId: string;
  unitType: string;
  unitLevel?: number;
  factionId?: string | null;
  subUnitName?: string;
  attachedSubUnitId?: string;
  attachedSubUnitType?: string;
  attachedSubUnitLevel?: number;
  attachedSubUnitFactionId?: string | null;
};

export type BotBattleOnlySnapshotPlayer = {
  playerId: string;
  role: string;
  selectedHeroId?: string;
  selectedBossId?: string;
  boardUnits: BotBattleOnlySnapshotBoardUnit[];
};

export type BotBattleOnlyRoundSnapshotInput = {
  roundIndex: number;
  battle: {
    leftPlayerId: string;
    rightPlayerId: string;
    bossSpellMetrics?: BossSpellBattleMetric[];
    declaredSpellId?: string | null;
    battleSeed?: number;
  };
  playersAtBattleStart: BotBattleOnlySnapshotPlayer[];
};

export type BotBattleOnlyMatchReportInput = {
  matchIndex?: number;
  rounds: Array<{
    roundIndex: number;
    battles?: Array<{
      battleIndex: number;
      leftPlayerId: string;
      rightPlayerId: string;
      winner?: "left" | "right" | "draw";
      battleSeed?: number;
      bossSpellMetrics?: BossSpellBattleMetric[];
      declaredSpellId?: string | null;
    }>;
    playersAtBattleStart: BotBattleOnlySnapshotPlayer[];
  }>;
};

export type BotBattleOnlyScenarioRecord = {
  matchIndex: number;
  roundIndex: number;
  battleIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  winner?: "left" | "right" | "draw";
  scenario: BotBattleOnlyScenario;
};

export type BotBattleOnlyVariantMetric = {
  variantId: string;
  battleCount: number;
  leftWinRate: number;
  rightWinRate: number;
  drawRate: number;
  averageDurationMs: number;
  averageLeftDamage: number;
  averageRightDamage: number;
  averageLeftSurvivors: number;
  averageRightSurvivors: number;
};

export type BotBattleOnlyVariantComparison = {
  baselineVariantId: string;
  variantId: string;
  leftWinRateDelta: number;
  rightWinRateDelta: number;
  averageLeftDamageDelta: number;
  averageRightDamageDelta: number;
  averageLeftSurvivorsDelta: number;
  averageRightSurvivorsDelta: number;
};

export type BotBattleOnlySample = {
  variantId: string;
  seed: number;
  winner: BattleResult["winner"];
  endReason: BattleResult["endReason"];
  durationMs: number;
  leftDamage: number;
  rightDamage: number;
  bossDamage?: number;
  phaseDamageToBossSide?: number;
  leftSurvivors: number;
  rightSurvivors: number;
  leftSurvivorDetails: BotBattleOnlyUnitState[];
  rightSurvivorDetails: BotBattleOnlyUnitState[];
  leftBossUnitStates: BotBattleOnlyUnitState[];
  rightBossUnitStates: BotBattleOnlyUnitState[];
  leftFactionIds: string[];
  rightFactionIds: string[];
  bossSpellMetrics?: BossSpellBattleMetric[];
};

export type BotBattleOnlyUnitState = {
  unitId: string;
  battleUnitId: string;
  hp: number;
  maxHp: number;
  cell: number;
  unitLevel?: number;
  isBoss?: boolean;
  isDead?: boolean;
};

export type BotBattleOnlyDiagnosticReport = {
  samplesPerVariant: number;
  seeds: number[];
  variants: BotBattleOnlyVariantMetric[];
  comparisons: BotBattleOnlyVariantComparison[];
  battles?: BotBattleOnlySample[];
};

type VariantRunResult = {
  metric: BotBattleOnlyVariantMetric;
  samples: BotBattleOnlySample[];
};

type ValidFactionId = NonNullable<BoardUnitPlacement["factionId"]>;

type VariantAccumulator = {
  variantId: string;
  battleCount: number;
  leftWins: number;
  rightWins: number;
  draws: number;
  totalDurationMs: number;
  totalLeftDamage: number;
  totalRightDamage: number;
  totalLeftSurvivors: number;
  totalRightSurvivors: number;
};

const DEFAULT_SAMPLES_PER_VARIANT = 20;
const DEFAULT_SEED_BASE = 1_000;
const STANDARD_BATTLE_SIMULATION_DURATION_MS = 40_000;
const FINAL_BATTLE_SIMULATION_DURATION_MS = 600_000;
const RAID_FINAL_BOSS_HP = 3_000;
const RAID_PHASE_HP_TARGET_BY_ROUND: Readonly<Record<number, number>> = {
  1: 1_200,
  2: 1_500,
  3: 1_800,
  4: 2_100,
  5: 2_500,
  6: 2_900,
  7: 3_300,
  8: 3_550,
  9: 3_800,
  10: 4_100,
  11: 4_400,
  12: 0,
};
const RAID_AGGREGATE_CORE_BATTLE_COLUMNS = [1, 3, 5, 0, 2, 4] as const;
const RAID_AGGREGATE_BATTLE_COLUMNS = [1, 0, 3, 2, 5, 4] as const;
const RAID_AGGREGATE_MELEE_ROWS = [3, 4, 5] as const;
const RAID_AGGREGATE_MID_RANGE_ROWS = [4, 3, 5] as const;
const RAID_AGGREGATE_BACK_RANGE_ROWS = [5, 4, 3] as const;
const RAID_AGGREGATE_PLAYER_LANE_COLUMNS = [
  [1, 0],
  [3, 2],
  [5, 4],
  [0, 1],
  [2, 3],
  [4, 5],
] as const;
const RAID_HERO_DEFAULT_COLUMNS = [0, 2, 4, 1, 3, 5] as const;
const LEGACY_REPORTED_SPECIAL_UNIT_CELL = 8;

export function buildFactionDisabledVariant(id = "faction-disabled"): BotBattleDiagnosticVariant {
  return {
    id,
    flags: { enableTouhouFactions: false },
    disabledFactionIds: "all",
  };
}

export function buildBattleOnlyDiagnosticScenarioFromRoundSnapshot(
  input: BotBattleOnlyRoundSnapshotInput,
): BotBattleOnlyScenario {
  const playerById = new Map(input.playersAtBattleStart.map((player) => [player.playerId, player] as const));
  const leftPlayer = playerById.get(input.battle.leftPlayerId);
  const rightPlayer = playerById.get(input.battle.rightPlayerId);

  if (!leftPlayer) {
    throw new Error(`Could not find left battle player snapshot: ${input.battle.leftPlayerId}`);
  }
  if (!rightPlayer) {
    throw new Error(`Could not find right battle player snapshot: ${input.battle.rightPlayerId}`);
  }

  const bossVsRaid = leftPlayer.role === "boss" || rightPlayer.role === "boss";
  const raidAggregatePlacements = bossVsRaid
    ? buildRaidAggregateBattlePlacements(input.playersAtBattleStart)
    : null;

  return {
    round: input.roundIndex,
    ...(typeof input.battle.battleSeed === "number" ? { battleSeed: input.battle.battleSeed } : {}),
    leftPlacements: bossVsRaid && leftPlayer.role !== "boss"
      ? raidAggregatePlacements ?? []
      : buildPlayerBattleDiagnosticPlacements(leftPlayer),
    rightPlacements: bossVsRaid && rightPlayer.role !== "boss"
      ? raidAggregatePlacements ?? []
      : buildPlayerBattleDiagnosticPlacements(rightPlayer),
    leftBossUnitIds: resolveBossUnitIds(leftPlayer),
    rightBossUnitIds: resolveBossUnitIds(rightPlayer),
    leftHeroSynergyBonusType: resolveSideHeroSynergyBonusTypes(
      bossVsRaid && leftPlayer.role !== "boss"
        ? input.playersAtBattleStart.filter((player) => player.role !== "boss")
        : [leftPlayer],
    ),
    rightHeroSynergyBonusType: resolveSideHeroSynergyBonusTypes(
      bossVsRaid && rightPlayer.role !== "boss"
        ? input.playersAtBattleStart.filter((player) => player.role !== "boss")
        : [rightPlayer],
    ),
    ...buildBossHpOverrideScenarioFields(input.roundIndex, leftPlayer, rightPlayer),
    ...buildActiveBossSpellScenarioFields(input, leftPlayer, rightPlayer),
  };
}

export function buildBattleOnlyDiagnosticScenarioRecordsFromMatchReport(
  report: BotBattleOnlyMatchReportInput,
): BotBattleOnlyScenarioRecord[] {
  const matchIndex = Math.max(0, Math.trunc(report.matchIndex ?? 0));
  const records: BotBattleOnlyScenarioRecord[] = [];

  for (const round of report.rounds) {
    const playerIds = new Set(round.playersAtBattleStart.map((player) => player.playerId));
    for (const battle of round.battles ?? []) {
      if (!playerIds.has(battle.leftPlayerId) || !playerIds.has(battle.rightPlayerId)) {
        continue;
      }

      records.push({
        matchIndex,
        roundIndex: round.roundIndex,
        battleIndex: battle.battleIndex,
        leftPlayerId: battle.leftPlayerId,
        rightPlayerId: battle.rightPlayerId,
        ...(battle.winner !== undefined ? { winner: battle.winner } : {}),
        scenario: buildBattleOnlyDiagnosticScenarioFromRoundSnapshot({
          roundIndex: round.roundIndex,
          battle: {
            leftPlayerId: battle.leftPlayerId,
            rightPlayerId: battle.rightPlayerId,
            ...(typeof battle.battleSeed === "number" ? { battleSeed: battle.battleSeed } : {}),
            ...(Array.isArray(battle.bossSpellMetrics) ? { bossSpellMetrics: battle.bossSpellMetrics } : {}),
            ...(typeof battle.declaredSpellId === "string" ? { declaredSpellId: battle.declaredSpellId } : {}),
          },
          playersAtBattleStart: round.playersAtBattleStart,
        }),
      });
    }
  }

  return records;
}

export function runBattleOnlyDiagnostic(
  options: BotBattleOnlyDiagnosticOptions,
): BotBattleOnlyDiagnosticReport {
  const seeds = resolveSeeds(options);
  const variants = options.variants?.length ? options.variants : [{ id: "normal" }];
  const results = variants.map((variant) => runVariant(variant, seeds, options));
  const baselineVariantId = options.baselineVariantId ?? variants[0]?.id ?? "normal";
  const baseline = results.find((result) => result.metric.variantId === baselineVariantId)?.metric;

  return {
    samplesPerVariant: seeds.length,
    seeds,
    variants: results.map((result) => result.metric),
    comparisons: baseline
      ? results
        .filter((result) => result.metric.variantId !== baselineVariantId)
        .map((result) => buildComparison(baseline, result.metric))
      : [],
    ...(options.includeBattleSamples
      ? { battles: results.flatMap((result) => result.samples) }
      : {}),
  };
}

export function resolveBattleOnlyDiagnosticMaxDurationMs(options: {
  round?: number;
  maxDurationMs?: number;
}): number {
  if (options.maxDurationMs !== undefined) {
    return options.maxDurationMs;
  }

  return (options.round ?? 0) >= 12
    ? FINAL_BATTLE_SIMULATION_DURATION_MS
    : STANDARD_BATTLE_SIMULATION_DURATION_MS;
}

export function resolveBattleOnlyDiagnosticBossHpOverride(round: number | undefined): number | undefined {
  const roundIndex = Math.max(0, Math.trunc(round ?? 0));
  if (roundIndex >= 12) {
    return RAID_FINAL_BOSS_HP;
  }

  const phaseHpTarget = RAID_PHASE_HP_TARGET_BY_ROUND[roundIndex] ?? 0;
  return phaseHpTarget > 0 ? phaseHpTarget : undefined;
}

export function buildBattleOnlyDiagnosticMarkdown(report: BotBattleOnlyDiagnosticReport): string {
  const lines = [
    "# Battle-only Diagnostic",
    "",
    `- samplesPerVariant: ${report.samplesPerVariant}`,
    `- seeds: ${report.seeds.join(", ")}`,
    "",
    "## Variant Metrics",
    "",
    "| Variant | Battles | Left WR | Right WR | Draw | Avg duration ms | Avg left dmg | Avg right dmg | Avg left survivors | Avg right survivors |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.variants.map((metric) =>
      `| ${metric.variantId} | ${metric.battleCount} | ${formatPercent(metric.leftWinRate)} | ${formatPercent(metric.rightWinRate)} | ${formatPercent(metric.drawRate)} | ${formatNumber(metric.averageDurationMs)} | ${formatNumber(metric.averageLeftDamage)} | ${formatNumber(metric.averageRightDamage)} | ${formatNumber(metric.averageLeftSurvivors)} | ${formatNumber(metric.averageRightSurvivors)} |`,
    ),
    "",
    "## Variant Deltas",
    "",
    "| Variant | Baseline | Left WR delta | Right WR delta | Left dmg delta | Right dmg delta | Left survivors delta | Right survivors delta |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.comparisons.map((comparison) =>
      `| ${comparison.variantId} | ${comparison.baselineVariantId} | ${formatPointDelta(comparison.leftWinRateDelta)} | ${formatPointDelta(comparison.rightWinRateDelta)} | ${formatNumber(comparison.averageLeftDamageDelta)} | ${formatNumber(comparison.averageRightDamageDelta)} | ${formatNumber(comparison.averageLeftSurvivorsDelta)} | ${formatNumber(comparison.averageRightSurvivorsDelta)} |`,
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function resolveSeeds(options: BotBattleOnlyDiagnosticOptions): number[] {
  if (options.seeds?.length) {
    return options.seeds.slice();
  }

  if (options.samplesPerVariant === undefined && typeof options.battleSeed === "number") {
    return [options.battleSeed];
  }

  const sampleCount = Math.max(1, Math.floor(options.samplesPerVariant ?? DEFAULT_SAMPLES_PER_VARIANT));
  const seedBase = Math.floor(options.seedBase ?? DEFAULT_SEED_BASE);
  return Array.from({ length: sampleCount }, (_value, index) => seedBase + index);
}

function toBattleDiagnosticPlacement(
  unit: BotBattleOnlySnapshotBoardUnit,
  player: BotBattleOnlySnapshotPlayer,
): BoardUnitPlacement {
  const bossUnit = isBossBoardUnit(unit, player);
  const heroMetadata = resolveHeroPlacementMetadata(unit);
  const unitType = bossUnit ? "vanguard" : heroMetadata?.unitType ?? parseBoardUnitType(unit.unitType);
  const factionId = parseFactionId(unit.factionId);

  return {
    cell: unit.cell,
    unitId: unit.unitId,
    unitType,
    ownerPlayerId: player.playerId,
    ...(bossUnit ? { combatClass: resolveDiagnosticBossCombatClass(unit.unitId), archetype: unit.unitId } : {}),
    ...(heroMetadata ? heroMetadata : {}),
    unitLevel: unit.unitLevel ?? 1,
    factionId,
    ...(unit.attachedSubUnitId && unit.attachedSubUnitType
      ? {
        subUnit: resolveAttachedSubUnitPlacement(unit),
      }
      : {}),
  };
}

function resolveDiagnosticBossCombatClass(unitId: string): BoardUnitType {
  return BOSS_CHARACTERS.find((boss) => boss.id === unitId)?.combatClass ?? "vanguard";
}

function buildPlayerBattleDiagnosticPlacements(
  player: BotBattleOnlySnapshotPlayer,
): BoardUnitPlacement[] {
  return player.boardUnits.map((unit) => toBattleDiagnosticPlacement(unit, player));
}

function buildRaidAggregateBattlePlacements(
  playersAtBattleStart: readonly BotBattleOnlySnapshotPlayer[],
): BoardUnitPlacement[] {
  const occupiedCells = new Set<number>();
  const placements: BoardUnitPlacement[] = [];
  const heroPlacements: BoardUnitPlacement[] = [];
  const raidPlayers = playersAtBattleStart.filter((player) => player.role !== "boss");

  for (const [raidPlayerIndex, player] of raidPlayers.entries()) {
    const playerPlacements = buildPlayerBattleDiagnosticPlacements(player);
    const sortedPlacements = playerPlacements
      .filter((placement) => !isDiagnosticHeroPlacement(placement))
      .sort((left, right) =>
        resolveRaidAggregateRangePriority(left) - resolveRaidAggregateRangePriority(right)
        || left.cell - right.cell
        || (left.unitId ?? "").localeCompare(right.unitId ?? "")
        || left.unitType.localeCompare(right.unitType));

    for (const placement of sortedPlacements) {
      const rangePriority = resolveRaidAggregateRangePriority(placement);
      const targetCell = selectRaidAggregateTargetCell(
        rangePriority,
        occupiedCells,
        buildRaidAggregatePlayerColumnPriority(raidPlayerIndex, rangePriority),
      );
      occupiedCells.add(targetCell);
      placements.push({
        ...placement,
        cell: targetCell,
        ownerPlayerId: player.playerId,
      });
    }

    for (const placement of playerPlacements.filter((candidate) => isDiagnosticHeroPlacement(candidate))) {
      heroPlacements.push({
        ...placement,
        cell: resolveRaidHeroBattleCell(raidPlayerIndex, placement.cell),
        ownerPlayerId: player.playerId,
      });
    }
  }

  return [...placements, ...heroPlacements];
}

function resolveRaidHeroBattleCell(raidPlayerIndex: number, reportedCell: number): number {
  if (reportedCell !== LEGACY_REPORTED_SPECIAL_UNIT_CELL) {
    return reportedCell;
  }

  return sharedBoardCoordinateToIndex({
    x: RAID_HERO_DEFAULT_COLUMNS[raidPlayerIndex % RAID_HERO_DEFAULT_COLUMNS.length] ?? 0,
    y: 5,
  });
}

function resolveRaidAggregateRangePriority(placement: BoardUnitPlacement): number {
  const attackRange = createBattleUnit(
    placement,
    "right",
    0,
    false,
    DEFAULT_FLAGS,
  ).attackRange;

  if (attackRange <= 1) {
    return 0;
  }
  if (attackRange <= 3) {
    return 1;
  }
  return 2;
}

function buildRaidAggregatePlayerColumnPriority(
  raidPlayerIndex: number,
  rangePriority: number,
): readonly number[] {
  const prioritizedColumns: number[] = [];
  const addColumn = (column: number): void => {
    if (column < 0 || column > 5 || prioritizedColumns.includes(column)) {
      return;
    }
    prioritizedColumns.push(column);
  };

  for (const column of resolveRaidAggregatePlayerLaneColumns(raidPlayerIndex, rangePriority)) {
    addColumn(column);
  }
  for (const column of RAID_AGGREGATE_CORE_BATTLE_COLUMNS) {
    addColumn(column);
  }
  for (const column of RAID_AGGREGATE_BATTLE_COLUMNS) {
    addColumn(column);
  }

  return prioritizedColumns;
}

function resolveRaidAggregatePlayerLaneColumns(
  playerIndex: number,
  rangePriority: number,
): readonly number[] {
  const laneColumns = RAID_AGGREGATE_PLAYER_LANE_COLUMNS[
    playerIndex % RAID_AGGREGATE_PLAYER_LANE_COLUMNS.length
  ] ?? RAID_AGGREGATE_BATTLE_COLUMNS;

  if (laneColumns.length < 2 || rangePriority <= 0) {
    return laneColumns;
  }

  const [primaryColumn, secondaryColumn] = laneColumns;
  return [
    secondaryColumn,
    primaryColumn,
    ...laneColumns.slice(2),
  ];
}

function selectRaidAggregateTargetCell(
  rangePriority: number,
  occupiedCells: Set<number>,
  preferredColumns: readonly number[],
): number {
  const preferredRows = resolveRaidAggregatePreferredRows(rangePriority);

  for (const row of preferredRows) {
    for (const column of preferredColumns) {
      const cell = sharedBoardCoordinateToIndex({ x: column, y: row });
      if (!occupiedCells.has(cell)) {
        return cell;
      }
    }
  }

  return sharedBoardCoordinateToIndex({
    x: RAID_AGGREGATE_BATTLE_COLUMNS[RAID_AGGREGATE_BATTLE_COLUMNS.length - 1] ?? 5,
    y: preferredRows[preferredRows.length - 1] ?? 5,
  });
}

function resolveRaidAggregatePreferredRows(rangePriority: number): readonly number[] {
  if (rangePriority <= 0) {
    return RAID_AGGREGATE_MELEE_ROWS;
  }
  if (rangePriority === 1) {
    return RAID_AGGREGATE_MID_RANGE_ROWS;
  }
  return RAID_AGGREGATE_BACK_RANGE_ROWS;
}

function resolveHeroPlacementMetadata(
  unit: BotBattleOnlySnapshotBoardUnit,
): Partial<BoardUnitPlacement> | null {
  if (unit.unitType !== "hero") {
    return null;
  }

  const hero = HEROES.find((candidate) => candidate.id === unit.unitId);
  if (!hero) {
    throw new Error(`Unsupported battle diagnostic hero unitId: ${unit.unitId}`);
  }

  return {
    unitType: hero.unitType,
    combatClass: hero.combatClass,
    archetype: hero.id,
    hp: hero.hp,
    attack: hero.attack,
    attackSpeed: hero.attackSpeed,
    movementSpeed: hero.movementSpeed,
    range: hero.range,
    critRate: hero.critRate,
    critDamageMultiplier: hero.critDamageMultiplier,
    damageReduction: hero.damageReduction,
  };
}

function resolveAttachedSubUnitPlacement(
  unit: BotBattleOnlySnapshotBoardUnit,
): AttachedSubUnitPlacement {
  const attachedSubUnitId = unit.attachedSubUnitId;
  const attachedSubUnitType = unit.attachedSubUnitType;
  if (!attachedSubUnitId || !attachedSubUnitType) {
    throw new Error("Attached sub unit diagnostic metadata is incomplete");
  }

  if (attachedSubUnitType === "hero") {
    const hero = HEROES.find((candidate) => candidate.id === attachedSubUnitId);
    if (!hero) {
      throw new Error(`Unsupported battle diagnostic hero unitId: ${attachedSubUnitId}`);
    }

    return {
      unitId: attachedSubUnitId,
      unitType: hero.unitType,
      combatClass: hero.combatClass,
      archetype: hero.id,
      ...(unit.attachedSubUnitLevel !== undefined ? { unitLevel: unit.attachedSubUnitLevel } : {}),
      factionId: parseFactionId(unit.attachedSubUnitFactionId),
    };
  }

  return {
    unitId: attachedSubUnitId,
    unitType: parseBoardUnitType(attachedSubUnitType),
    ...(unit.attachedSubUnitLevel !== undefined ? { unitLevel: unit.attachedSubUnitLevel } : {}),
    factionId: parseFactionId(unit.attachedSubUnitFactionId),
  };
}

function isBossBoardUnit(
  unit: BotBattleOnlySnapshotBoardUnit,
  player: BotBattleOnlySnapshotPlayer,
): boolean {
  return player.role === "boss"
    && typeof player.selectedBossId === "string"
    && player.selectedBossId.length > 0
    && unit.unitId === player.selectedBossId;
}

function resolveBossUnitIds(player: BotBattleOnlySnapshotPlayer): string[] {
  if (player.role !== "boss" || !player.selectedBossId) {
    return [];
  }
  return player.boardUnits.some((unit) => unit.unitId === player.selectedBossId)
    ? [player.selectedBossId]
    : [];
}

function resolveSideHeroSynergyBonusTypes(
  players: readonly BotBattleOnlySnapshotPlayer[],
): BoardUnitType[] | null {
  const bonusTypes = players
    .map((player) => HEROES.find((hero) => hero.id === player.selectedHeroId)?.synergyBonusType ?? null)
    .filter((bonusType): bonusType is BoardUnitType => bonusType !== null);

  return bonusTypes.length > 0 ? bonusTypes : null;
}

function buildActiveBossSpellScenarioFields(
  input: BotBattleOnlyRoundSnapshotInput,
  leftPlayer: BotBattleOnlySnapshotPlayer,
  rightPlayer: BotBattleOnlySnapshotPlayer,
): Pick<BotBattleOnlyScenario, "leftActiveBossSpellId" | "rightActiveBossSpellId"> {
  const activeBossSpellId = resolveActiveBossSpellId(input);
  if (activeBossSpellId === null) {
    return {};
  }

  return {
    ...(leftPlayer.role === "boss" ? { leftActiveBossSpellId: activeBossSpellId } : {}),
    ...(rightPlayer.role === "boss" ? { rightActiveBossSpellId: activeBossSpellId } : {}),
  };
}

function resolveActiveBossSpellId(input: BotBattleOnlyRoundSnapshotInput): string | null {
  const declaredSpellId = typeof input.battle.declaredSpellId === "string"
    ? input.battle.declaredSpellId.trim()
    : "";
  if (declaredSpellId.length > 0) {
    return declaredSpellId;
  }

  const metricSpellId = input.battle.bossSpellMetrics
    ?.map((metric) => metric.spellId.trim())
    .find((spellId) => spellId.length > 0);
  return metricSpellId ?? null;
}

function buildBossHpOverrideScenarioFields(
  roundIndex: number,
  leftPlayer: BotBattleOnlySnapshotPlayer,
  rightPlayer: BotBattleOnlySnapshotPlayer,
): Pick<BotBattleOnlyScenario, "leftBossHpOverride" | "rightBossHpOverride"> {
  const bossHpOverride = resolveBattleOnlyDiagnosticBossHpOverride(roundIndex);
  if (bossHpOverride === undefined) {
    return {};
  }

  return {
    ...(leftPlayer.role === "boss" ? { leftBossHpOverride: bossHpOverride } : {}),
    ...(rightPlayer.role === "boss" ? { rightBossHpOverride: bossHpOverride } : {}),
  };
}

function parseBoardUnitType(unitType: string): BoardUnitType {
  if (unitType === "vanguard" || unitType === "ranger" || unitType === "mage" || unitType === "assassin") {
    return unitType;
  }

  if (unitType === "boss") {
    return "vanguard";
  }

  throw new Error(`Unsupported battle diagnostic unitType: ${unitType}`);
}

function parseFactionId(factionId: string | null | undefined): ValidFactionId | null {
  if (
    factionId === "chireiden"
    || factionId === "myourenji"
    || factionId === "shinreibyou"
    || factionId === "grassroot_network"
    || factionId === "kou_ryuudou"
    || factionId === "kanjuden"
  ) {
    return factionId;
  }

  return null;
}

function runVariant(
  variant: BotBattleDiagnosticVariant,
  seeds: readonly number[],
  options: BotBattleOnlyDiagnosticOptions,
): VariantRunResult {
  const accumulator = createAccumulator(variant.id);
  const samples: BotBattleOnlySample[] = [];

  for (const seed of seeds) {
    const flags = { ...DEFAULT_FLAGS, ...variant.flags };
    const leftPlacements = clonePlacementsForVariant(options.leftPlacements, variant);
    const rightPlacements = clonePlacementsForVariant(options.rightPlacements, variant);
    const leftSynergyPlacements = resolveBattleOnlyDiagnosticSynergyPlacements(
      leftPlacements,
      options.leftBossUnitIds,
    );
    const rightSynergyPlacements = resolveBattleOnlyDiagnosticSynergyPlacements(
      rightPlacements,
      options.rightBossUnitIds,
    );
    const leftUnits = createBattleUnits(
      leftPlacements,
      "left",
      flags,
      options.leftBossUnitIds,
      options.leftActiveBossSpellId,
      options.leftBossHpOverride ?? resolveBattleOnlyDiagnosticBossHpOverride(options.round),
    );
    const rightUnits = createBattleUnits(
      rightPlacements,
      "right",
      flags,
      options.rightBossUnitIds,
      options.rightActiveBossSpellId,
      options.rightBossHpOverride ?? resolveBattleOnlyDiagnosticBossHpOverride(options.round),
    );
    const result = new BattleSimulator({ rng: createSeededBattleRng(seed) }).simulateBattle(
      leftUnits,
      rightUnits,
      leftSynergyPlacements,
      rightSynergyPlacements,
      resolveBattleOnlyDiagnosticMaxDurationMs(options),
      options.leftHeroSynergyBonusType ?? null,
      options.rightHeroSynergyBonusType ?? null,
      options.subUnitAssistConfigByType ?? null,
      flags,
      options.round ?? 0,
    );

    recordResult(accumulator, result);
    samples.push({
      variantId: variant.id,
      seed,
      winner: result.winner,
      endReason: result.endReason,
      durationMs: result.durationMs,
      leftDamage: result.damageDealt.left,
      rightDamage: result.damageDealt.right,
      ...(typeof result.bossDamage === "number" ? { bossDamage: result.bossDamage } : {}),
      ...(typeof result.phaseDamageToBossSide === "number"
        ? { phaseDamageToBossSide: result.phaseDamageToBossSide }
        : {}),
      leftSurvivors: result.leftSurvivors.length,
      rightSurvivors: result.rightSurvivors.length,
      leftSurvivorDetails: result.leftSurvivors.map(toBattleOnlyUnitState),
      rightSurvivorDetails: result.rightSurvivors.map(toBattleOnlyUnitState),
      leftBossUnitStates: collectBossUnitStates(leftUnits, options.leftBossUnitIds),
      rightBossUnitStates: collectBossUnitStates(rightUnits, options.rightBossUnitIds),
      leftFactionIds: collectFactionIds(leftPlacements),
      rightFactionIds: collectFactionIds(rightPlacements),
      ...(Array.isArray(result.bossSpellMetrics) && result.bossSpellMetrics.length > 0
        ? { bossSpellMetrics: result.bossSpellMetrics.map((metric) => ({ ...metric })) }
        : {}),
    });
  }

  return {
    metric: buildMetric(accumulator),
    samples,
  };
}

function collectBossUnitStates(
  units: readonly BattleUnit[],
  bossUnitIds: readonly string[] | undefined,
): BotBattleOnlyUnitState[] {
  const bossUnitIdSet = new Set(bossUnitIds ?? []);
  return units
    .filter((unit) => unit.isBoss === true || bossUnitIdSet.has(unit.sourceUnitId ?? ""))
    .map(toBattleOnlyUnitState);
}

function toBattleOnlyUnitState(unit: BattleUnit): BotBattleOnlyUnitState {
  return {
    unitId: unit.sourceUnitId ?? unit.id,
    battleUnitId: unit.id,
    hp: Math.max(0, Math.round(Number(unit.hp) || 0)),
    maxHp: Math.max(0, Math.round(Number(unit.maxHp) || 0)),
    cell: Number.isInteger(unit.cell) ? unit.cell : -1,
    ...(typeof unit.unitLevel === "number" ? { unitLevel: unit.unitLevel } : {}),
    ...(unit.isBoss === true ? { isBoss: true } : {}),
    ...(unit.isDead === true ? { isDead: true } : {}),
  };
}

function clonePlacementsForVariant(
  placements: readonly BoardUnitPlacement[],
  variant: BotBattleDiagnosticVariant,
): BoardUnitPlacement[] {
  return placements.map((placement) => {
    const disableFaction = shouldDisableFaction(placement.factionId, variant.disabledFactionIds);
    return {
      ...placement,
      ...(disableFaction ? { factionId: null } : {}),
      ...(placement.subUnit
        ? {
          subUnit: {
            ...placement.subUnit,
            ...(shouldDisableFaction(placement.subUnit.factionId, variant.disabledFactionIds)
              ? { factionId: null }
              : {}),
          },
        }
        : {}),
    };
  });
}

function shouldDisableFaction(
  factionId: string | null | undefined,
  disabledFactionIds: BotBattleDiagnosticVariant["disabledFactionIds"],
): boolean {
  if (!factionId || disabledFactionIds == null) {
    return false;
  }

  return disabledFactionIds === "all" || disabledFactionIds.includes(factionId);
}

export function resolveBattleOnlyDiagnosticSynergyPlacements(
  placements: readonly BoardUnitPlacement[],
  bossUnitIds: readonly string[] | undefined,
): BoardUnitPlacement[] {
  const bossUnitIdSet = new Set(bossUnitIds ?? []);
  return placements.filter((placement) => {
    if (placement.unitId != null && bossUnitIdSet.has(placement.unitId)) {
      return false;
    }
    return !isDiagnosticHeroPlacement(placement);
  });
}

function createBattleUnits(
  placements: readonly BoardUnitPlacement[],
  side: "left" | "right",
  flags: FeatureFlags,
  bossUnitIds: readonly string[] | undefined,
  activeBossSpellId: string | null | undefined,
  bossHpOverride: number | undefined,
): BattleUnit[] {
  const bossUnitIdSet = new Set(bossUnitIds ?? []);
  return placements.map((placement, index) => {
    const isBoss = placement.unitId != null && bossUnitIdSet.has(placement.unitId);
    if (isBoss) {
      return createDiagnosticBossBattleUnit(placement, side, index, activeBossSpellId, bossHpOverride);
    }

    const heroUnit = createDiagnosticHeroBattleUnit(placement, side, index);
    if (heroUnit) {
      return heroUnit;
    }

    return createBattleUnit(
      placement,
      side,
      index,
      false,
      flags,
    );
  });
}

function createDiagnosticBossBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
  activeBossSpellId: string | null | undefined,
  bossHpOverride: number | undefined,
): BattleUnit {
  const bossId = placement.unitId ?? placement.archetype ?? `${side}-boss-${index}`;
  const unitLevel = placement.unitLevel ?? 1;
  const multiplier = getSpecialUnitCombatMultiplier(unitLevel, bossId);
  const bossStats = getMvpPhase1Boss();
  const ownerPlayerId = resolveDiagnosticOwnerPlayerId(placement);

  return {
    id: ownerPlayerId ? `boss-${ownerPlayerId}` : `${side}-boss-${index}`,
    ...(ownerPlayerId ? { ownerPlayerId } : {}),
    sourceUnitId: bossId,
    battleSide: side,
    type: "vanguard",
    combatClass: placement.combatClass ?? "vanguard",
    unitLevel,
    hp: bossHpOverride ?? bossStats.hp * multiplier,
    maxHp: bossHpOverride ?? bossStats.hp * multiplier,
    attackPower: bossStats.attack * multiplier,
    attackSpeed: bossStats.attackSpeed,
    movementSpeed: bossStats.movementSpeed,
    attackRange: bossStats.range,
    cell: placement.cell,
    isDead: false,
    isBoss: true,
    attackCount: 0,
    critRate: bossStats.critRate,
    critDamageMultiplier: bossStats.critDamageMultiplier,
    damageReduction: bossStats.damageReduction,
    buffModifiers: {
      attackMultiplier: 1,
      defenseMultiplier: 1,
      attackSpeedMultiplier: 1,
    },
    ...(typeof activeBossSpellId === "string" && activeBossSpellId.length > 0
      ? { activeBossSpellId }
      : {}),
  };
}

function createDiagnosticHeroBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
): BattleUnit | null {
  const hero = HEROES.find((candidate) => isDiagnosticHeroPlacement(placement, candidate.id));
  if (!hero) {
    return null;
  }

  const unitLevel = placement.unitLevel ?? 1;
  const multiplier = getSpecialUnitCombatMultiplier(unitLevel, hero.id);
  const ownerPlayerId = resolveDiagnosticOwnerPlayerId(placement);

  return {
    id: ownerPlayerId ? `hero-${ownerPlayerId}` : `${side}-hero-${index}`,
    ...(ownerPlayerId ? { ownerPlayerId } : {}),
    sourceUnitId: hero.id,
    battleSide: side,
    type: hero.unitType,
    combatClass: hero.combatClass,
    unitLevel,
    hp: hero.hp * multiplier,
    maxHp: hero.hp * multiplier,
    attackPower: hero.attack * multiplier,
    attackSpeed: hero.attackSpeed,
    movementSpeed: hero.movementSpeed,
    attackRange: hero.range,
    cell: placement.cell,
    isDead: false,
    attackCount: 0,
    critRate: hero.critRate,
    critDamageMultiplier: hero.critDamageMultiplier,
    damageReduction: hero.damageReduction,
    buffModifiers: {
      attackMultiplier: 1,
      defenseMultiplier: 1,
      attackSpeedMultiplier: 1,
    },
    ...(placement.subUnit ? { attachedSubUnit: placement.subUnit } : {}),
  };
}

function resolveDiagnosticOwnerPlayerId(placement: BoardUnitPlacement): string | null {
  return typeof placement.ownerPlayerId === "string" && placement.ownerPlayerId.length > 0
    ? placement.ownerPlayerId
    : null;
}

function isDiagnosticHeroPlacement(placement: BoardUnitPlacement, heroId = placement.unitId): boolean {
  return typeof heroId === "string"
    && heroId.length > 0
    && heroId === placement.unitId
    && heroId === placement.archetype
    && typeof placement.hp === "number"
    && typeof placement.attack === "number";
}

function collectFactionIds(placements: readonly BoardUnitPlacement[]): string[] {
  const factionIds: string[] = [];
  for (const placement of placements) {
    if (typeof placement.factionId === "string" && placement.factionId.length > 0) {
      factionIds.push(placement.factionId);
    }
  }
  return Array.from(new Set(factionIds)).sort();
}

function createAccumulator(variantId: string): VariantAccumulator {
  return {
    variantId,
    battleCount: 0,
    leftWins: 0,
    rightWins: 0,
    draws: 0,
    totalDurationMs: 0,
    totalLeftDamage: 0,
    totalRightDamage: 0,
    totalLeftSurvivors: 0,
    totalRightSurvivors: 0,
  };
}

function recordResult(accumulator: VariantAccumulator, result: BattleResult): void {
  accumulator.battleCount += 1;
  accumulator.totalDurationMs += result.durationMs;
  accumulator.totalLeftDamage += result.damageDealt.left;
  accumulator.totalRightDamage += result.damageDealt.right;
  accumulator.totalLeftSurvivors += result.leftSurvivors.length;
  accumulator.totalRightSurvivors += result.rightSurvivors.length;

  if (result.winner === "left") {
    accumulator.leftWins += 1;
  } else if (result.winner === "right") {
    accumulator.rightWins += 1;
  } else {
    accumulator.draws += 1;
  }
}

function buildMetric(accumulator: VariantAccumulator): BotBattleOnlyVariantMetric {
  const battleCount = Math.max(1, accumulator.battleCount);
  return {
    variantId: accumulator.variantId,
    battleCount: accumulator.battleCount,
    leftWinRate: accumulator.leftWins / battleCount,
    rightWinRate: accumulator.rightWins / battleCount,
    drawRate: accumulator.draws / battleCount,
    averageDurationMs: accumulator.totalDurationMs / battleCount,
    averageLeftDamage: accumulator.totalLeftDamage / battleCount,
    averageRightDamage: accumulator.totalRightDamage / battleCount,
    averageLeftSurvivors: accumulator.totalLeftSurvivors / battleCount,
    averageRightSurvivors: accumulator.totalRightSurvivors / battleCount,
  };
}

function buildComparison(
  baseline: BotBattleOnlyVariantMetric,
  variant: BotBattleOnlyVariantMetric,
): BotBattleOnlyVariantComparison {
  return {
    baselineVariantId: baseline.variantId,
    variantId: variant.variantId,
    leftWinRateDelta: variant.leftWinRate - baseline.leftWinRate,
    rightWinRateDelta: variant.rightWinRate - baseline.rightWinRate,
    averageLeftDamageDelta: variant.averageLeftDamage - baseline.averageLeftDamage,
    averageRightDamageDelta: variant.averageRightDamage - baseline.averageRightDamage,
    averageLeftSurvivorsDelta: variant.averageLeftSurvivors - baseline.averageLeftSurvivors,
    averageRightSurvivorsDelta: variant.averageRightSurvivors - baseline.averageRightSurvivors,
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPointDelta(value: number): string {
  return `${(value * 100).toFixed(1)}pp`;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
