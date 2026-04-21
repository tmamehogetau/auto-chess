import type {
  BattleTimelineEndReason,
  BattleKeyframeUnitState,
  PlannedApproachPathBlockerType,
  PlannedApproachRouteChokeType,
  BattleStartUnitSnapshot,
  BattleTimelineEvent,
  BattleTimelineSide,
  BoardUnitPlacement,
  BoardUnitType,
} from "../../shared/room-messages";
import { DEFAULT_MOVEMENT_SPEED, getMvpPhase1Boss, type SubUnitConfig } from "../../shared/types";
import { DEFAULT_FLAGS, type FeatureFlags } from "../../shared/feature-flags";
import { DEFAULT_SHARED_BOARD_CONFIG } from "../../shared/shared-board-config";
import { getHeroExclusiveUnitById } from "../../data/hero-exclusive-units";
import {
  sharedBoardCoordinateToIndex,
  sharedBoardManhattanDistance,
  sharedBoardIndexToCoordinate,
} from "../../shared/board-geometry";
import { getUnitLevelCombatMultiplier } from "../unit-level-config";
import {
  HERO_SKILL_DEFINITIONS,
  resolvePairSkillDefinition,
  resolvePairSkillDefinitions,
  resolveUnitSkillDefinition,
} from "./skill-definitions";
import {
  SYNERGY_DEFINITIONS,
  TOUHOU_FACTION_DEFINITIONS,
  applyScarletMansionSynergyToBoss,
  calculateScarletMansionSynergy,
  calculateSynergyDetails,
  getTouhouFactionTierEffect,
  hasScarletMansionBossLifesteal,
  type SynergyEffects,
} from "./synergy-definitions";
import { getScarletMansionUnitById } from "../../data/scarlet-mansion-units";
import { HEROES } from "../../data/heroes";
import { resolveBattlePlacement } from "../unit-id-resolver";
import {
  resolveSharedBoardBossPresentation,
  resolveSharedBoardHeroPresentation,
  resolveSharedBoardUnitPresentation,
} from "../shared-board-unit-presentation";
import {
  createAttackStartEvent,
  createBattleEndEvent,
  createBattleStartEvent,
  createDamageAppliedEvent,
  createKeyframeEvent,
  createMoveEvent,
  createUnitDeathEvent,
} from "./battle-timeline";
import { createDefaultBattleRng, type BattleRng } from "./battle-rng";
import {
  buildAppliedDamageSummary,
  calculateAttackDamage,
  calculateReflectedDamage,
  resolveUnitDefeatConsequences,
} from "./battle-resolution-helpers";

/**
 * アクションインターフェース
 * 戦闘中のユニットアクションを表現
 */
export interface Action {
  unit: BattleUnit;
  actionTime: number;
  type: "attack" | "move" | "skill";
}

/**
 * 戦闘シミュレーション用ユニット
 * 戦闘中のユニット状態を表現
 */
export interface BattleUnit {
  id: string;
  ownerPlayerId?: string;
  sourceUnitId?: string;
  battleSide?: "left" | "right";
  type: BoardUnitType;
  unitLevel?: number;
  hp: number;
  maxHp: number;
  attackPower: number;
  attackSpeed: number; // 1秒あたりの攻撃回数（0.5 = 2秒に1回攻撃）
  movementSpeed?: number;
  attackRange: number; // 1 = 近接, 2+ = 遠距離
  cell: number; // shared-board index on the 6x6 battle field
  isDead: boolean;
  isBoss?: boolean;
  attackCount: number;
  critRate: number;
  critDamageMultiplier: number;
  damageReduction: number;
  buffModifiers: {
    attackMultiplier: number;
    defenseMultiplier: number;
    attackSpeedMultiplier: number;
  };
  reflectRatio?: number;
  ultimateDamageMultiplier?: number;
  bonusDamageVsDebuffedTarget?: number;
  debuffImmunityCategories?: string[];
  pairSkillIds?: string[];
  pairSkillState?: Record<string, boolean>;
}

/**
 * 戦闘結果
 * 戦闘の結果を含む情報
 */
export interface BattleResult {
  winner: "left" | "right" | "draw";
  endReason: BattleTimelineEndReason;
  leftSurvivors: BattleUnit[];
  rightSurvivors: BattleUnit[];
  timeline: BattleTimelineEvent[];
  combatLog: string[]; // デバッグ用
  durationMs: number;
  damageDealt: {
    left: number;   // 左チームが与えた合計ダメージ
    right: number;  // 右チームが与えた合計ダメージ
  };
  bossDamage?: number;  // ボスが受けたダメージ（ボス戦時のみ）
  phaseDamageToBossSide?: number; // フェーズHPに加算する累計ダメージ
}

/**
 * ユニットタイプ別の基本ステータス
 */
interface BaseUnitStats {
  hp: number;
  attack: number;
  attackSpeed: number;
  movementSpeed: number;
  range: number;
}

const BASE_STATS: Readonly<Record<BoardUnitType, BaseUnitStats>> = {
  vanguard: { hp: 80, attack: 4, attackSpeed: 0.5, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 1 },
  ranger: { hp: 50, attack: 5, attackSpeed: 0.8, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3 },
  mage: { hp: 40, attack: 6, attackSpeed: 0.6, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 2 },
  assassin: { hp: 45, attack: 5, attackSpeed: 1.0, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 1 },
};

const MELEE_POST_MOVE_ATTACK_DELAY_MS = 250;
const ACTION_PRIORITY: Readonly<Record<Action["type"], number>> = {
  attack: 0,
  skill: 1,
  move: 2,
};

function compareActionOrder(left: Action, right: Action): number {
  if (left.actionTime !== right.actionTime) {
    return left.actionTime - right.actionTime;
  }

  return ACTION_PRIORITY[left.type] - ACTION_PRIORITY[right.type];
}

function getAttackIntervalMs(unit: BattleUnit): number | null {
  if (unit.attackSpeed <= 0) {
    return null;
  }

  return 1000 / (unit.attackSpeed * unit.buffModifiers.attackSpeedMultiplier);
}

function getMoveIntervalMs(unit: BattleUnit): number | null {
  const movementSpeed = unit.movementSpeed ?? DEFAULT_MOVEMENT_SPEED;
  if (movementSpeed <= 0) {
    return null;
  }

  return 1000 / movementSpeed;
}

function isHeroBattleUnit(unit: BattleUnit): boolean {
  if (unit.id.startsWith("hero-")) {
    return true;
  }

  if (typeof unit.sourceUnitId !== "string" || unit.sourceUnitId.length === 0) {
    return false;
  }

  return HEROES.some((hero) => (
    unit.sourceUnitId === hero.id
    || unit.sourceUnitId === `hero-${hero.id}`
  ));
}

function resolveHeroId(unit: BattleUnit): string | null {
  const candidates = new Set<string>();

  if (typeof unit.sourceUnitId === "string" && unit.sourceUnitId.length > 0) {
    candidates.add(unit.sourceUnitId);
    if (unit.sourceUnitId.startsWith("hero-")) {
      candidates.add(unit.sourceUnitId.slice("hero-".length));
    }
  }

  if (isHeroBattleUnit(unit)) {
    candidates.add(unit.id.slice("hero-".length));
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (HEROES.some((hero) => hero.id === candidate)) {
      return candidate;
    }
  }

  return null;
}

function applyPairSkillBindings(
  units: BattleUnit[],
  placements: BoardUnitPlacement[],
  combatLog: string[],
): void {
  const entryCount = Math.min(units.length, placements.length);

  for (let index = 0; index < entryCount; index += 1) {
    const unit = units[index];
    const placement = placements[index];
    if (!unit || !placement?.subUnit?.unitId) {
      continue;
    }

    const heroExclusiveUnit = getHeroExclusiveUnitById(placement.subUnit.unitId);
    if (!heroExclusiveUnit || heroExclusiveUnit.pairSkillId.length === 0) {
      continue;
    }

    unit.pairSkillIds = [...(unit.pairSkillIds ?? []), heroExclusiveUnit.pairSkillId];
    unit.pairSkillState = { ...(unit.pairSkillState ?? {}) };
    const pairSkillDefinition = resolvePairSkillDefinition(heroExclusiveUnit.pairSkillId);
    combatLog.push(
      `${generateUnitName(unit)} links pair skill (${heroExclusiveUnit.displayName}): ${pairSkillDefinition?.name ?? heroExclusiveUnit.pairSkillId}`,
    );
  }
}

function executePairSkillsBeforeTakeDamage(
  target: BattleUnit,
  attacker: BattleUnit,
  combatLog: string[],
): void {
  for (const pairSkillDefinition of resolvePairSkillDefinitions(target)) {
    pairSkillDefinition.executeOnBeforeTakeDamage?.(target, attacker, combatLog);
  }
}

function executePairSkillsAfterAttackHit(
  attacker: BattleUnit,
  target: BattleUnit,
  combatLog: string[],
): void {
  for (const pairSkillDefinition of resolvePairSkillDefinitions(attacker)) {
    pairSkillDefinition.executeOnAfterAttackHit?.(attacker, target, combatLog);
  }
}

function resolveHeroSkillDefinition(unit: BattleUnit): {
  heroId: string;
  skillDef: (typeof HERO_SKILL_DEFINITIONS)[string];
} | null {
  const heroId = resolveHeroId(unit);
  if (!heroId) {
    return null;
  }

  const skillDef = HERO_SKILL_DEFINITIONS[heroId];
  if (skillDef) {
    return {
      heroId,
      skillDef,
    };
  }

  return null;
}

function resolveTimelineSide(unit: BattleUnit): BattleTimelineSide {
  if (unit.isBoss) {
    return "boss";
  }

  if (typeof unit.ownerPlayerId === "string" && unit.ownerPlayerId.length > 0) {
    return "raid";
  }

  return (unit.id.startsWith("left") || isHeroBattleUnit(unit)) ? "raid" : "boss";
}

function resolveBattleSide(unit: BattleUnit): "left" | "right" {
  if (unit.battleSide === "left" || unit.battleSide === "right") {
    return unit.battleSide;
  }

  if (unit.isBoss) {
    return "right";
  }

  if (unit.id.startsWith("left") || isHeroBattleUnit(unit)) {
    return "left";
  }

  return "right";
}

function resolveBoardIndexForCell(cell: number): number {
  if (!Number.isInteger(cell)) {
    throw new Error("battle board cell index must be an integer");
  }

  if (cell >= 0 && cell < DEFAULT_SHARED_BOARD_CONFIG.width * DEFAULT_SHARED_BOARD_CONFIG.height) {
    return cell;
  }

  throw new Error("battle board cell index out of range");
}

function resolveTimelineCoordinate(unit: BattleUnit): { x: number; y: number } {
  return resolveCellCoordinate(unit.cell, resolveBattleSide(unit));
}

function resolveCellCoordinate(cell: number, side: "left" | "right"): { x: number; y: number } {
  return sharedBoardIndexToCoordinate(
    resolveBoardIndexForCell(cell),
    DEFAULT_SHARED_BOARD_CONFIG,
  );
}

function isCoordinateWithinBoard(coordinate: { x: number; y: number }): boolean {
  return (
    Number.isInteger(coordinate.x) &&
    Number.isInteger(coordinate.y) &&
    coordinate.x >= 0 &&
    coordinate.y >= 0 &&
    coordinate.x < DEFAULT_SHARED_BOARD_CONFIG.width &&
    coordinate.y < DEFAULT_SHARED_BOARD_CONFIG.height
  );
}

function coordinateKey(coordinate: { x: number; y: number }): string {
  return `${coordinate.x},${coordinate.y}`;
}

function buildApproachCandidates(
  currentCoordinate: { x: number; y: number },
  targetCoordinate: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const deltaX = targetCoordinate.x - currentCoordinate.x;
  const deltaY = targetCoordinate.y - currentCoordinate.y;
  const candidates: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();

  const pushCandidate = (coordinate: { x: number; y: number }): void => {
    if (!isCoordinateWithinBoard(coordinate)) {
      return;
    }

    const key = coordinateKey(coordinate);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push(coordinate);
  };

  const horizontalFirst = Math.abs(deltaX) >= Math.abs(deltaY);

  if (horizontalFirst && deltaX !== 0) {
    pushCandidate({ x: currentCoordinate.x + Math.sign(deltaX), y: currentCoordinate.y });
  }
  if (!horizontalFirst && deltaY !== 0) {
    pushCandidate({ x: currentCoordinate.x, y: currentCoordinate.y + Math.sign(deltaY) });
  }

  if (horizontalFirst && deltaY !== 0) {
    pushCandidate({ x: currentCoordinate.x, y: currentCoordinate.y + Math.sign(deltaY) });
  }
  if (!horizontalFirst && deltaX !== 0) {
    pushCandidate({ x: currentCoordinate.x + Math.sign(deltaX), y: currentCoordinate.y });
  }

  if (horizontalFirst) {
    const preferredVertical = deltaY === 0 ? -1 : Math.sign(deltaY);
    pushCandidate({ x: currentCoordinate.x, y: currentCoordinate.y + preferredVertical });
    pushCandidate({ x: currentCoordinate.x, y: currentCoordinate.y - preferredVertical });
  } else {
    const preferredHorizontal = deltaX === 0 ? -1 : Math.sign(deltaX);
    pushCandidate({ x: currentCoordinate.x + preferredHorizontal, y: currentCoordinate.y });
    pushCandidate({ x: currentCoordinate.x - preferredHorizontal, y: currentCoordinate.y });
  }

  pushCandidate({ x: currentCoordinate.x + 1, y: currentCoordinate.y });
  pushCandidate({ x: currentCoordinate.x - 1, y: currentCoordinate.y });
  pushCandidate({ x: currentCoordinate.x, y: currentCoordinate.y + 1 });
  pushCandidate({ x: currentCoordinate.x, y: currentCoordinate.y - 1 });

  return candidates;
}

function findShortestApproachStep(
  currentCoordinate: { x: number; y: number },
  targetCoordinate: { x: number; y: number },
  occupiedCoordinates: Set<string>,
  attackRange: number,
): { x: number; y: number } | null {
  const queue: Array<{
    coordinate: { x: number; y: number };
    firstStep: { x: number; y: number } | null;
  }> = [{ coordinate: currentCoordinate, firstStep: null }];
  const visited = new Set<string>([coordinateKey(currentCoordinate)]);

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode) {
      break;
    }

    const neighbors = buildApproachCandidates(currentNode.coordinate, targetCoordinate);
    for (const neighbor of neighbors) {
      const neighborKey = coordinateKey(neighbor);
      if (visited.has(neighborKey) || occupiedCoordinates.has(neighborKey)) {
        continue;
      }

      const firstStep = currentNode.firstStep ?? neighbor;
      if (sharedBoardManhattanDistance(neighbor, targetCoordinate) <= attackRange) {
        return firstStep;
      }

      visited.add(neighborKey);
      queue.push({ coordinate: neighbor, firstStep });
    }
  }

  return null;
}

function countOccupiedAdjacentCoordinates(
  coordinate: { x: number; y: number },
  occupiedCoordinates: Set<string>,
): number {
  return [
    { x: coordinate.x + 1, y: coordinate.y },
    { x: coordinate.x - 1, y: coordinate.y },
    { x: coordinate.x, y: coordinate.y + 1 },
    { x: coordinate.x, y: coordinate.y - 1 },
  ].reduce((count, neighbor) => {
    if (!isCoordinateWithinBoard(neighbor)) {
      return count;
    }

    return count + (occupiedCoordinates.has(coordinateKey(neighbor)) ? 1 : 0);
  }, 0);
}

function findFallbackApproachStep(
  currentCoordinate: { x: number; y: number },
  targetCoordinate: { x: number; y: number },
  occupiedCoordinates: Set<string>,
): { x: number; y: number } | null {
  const candidates = buildApproachCandidates(currentCoordinate, targetCoordinate).filter(
    (candidate) => !occupiedCoordinates.has(coordinateKey(candidate)),
  );

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const distanceDelta =
      sharedBoardManhattanDistance(left, targetCoordinate)
      - sharedBoardManhattanDistance(right, targetCoordinate);
    if (distanceDelta !== 0) {
      return distanceDelta;
    }

    const congestionDelta =
      countOccupiedAdjacentCoordinates(left, occupiedCoordinates)
      - countOccupiedAdjacentCoordinates(right, occupiedCoordinates);
    if (congestionDelta !== 0) {
      return congestionDelta;
    }

    const xDelta = left.x - right.x;
    if (xDelta !== 0) {
      return xDelta;
    }

    return left.y - right.y;
  });

  return candidates[0] ?? null;
}

function buildBattleStartSnapshot(unit: BattleUnit): BattleStartUnitSnapshot {
  const coordinate = resolveTimelineCoordinate(unit);
  const presentation = unit.isBoss
    ? resolveSharedBoardBossPresentation(unit.sourceUnitId)
    : resolveSharedBoardHeroPresentation(unit.sourceUnitId)
      ?? resolveSharedBoardUnitPresentation(unit.sourceUnitId, unit.type);

  return {
    battleUnitId: unit.id,
    ...(typeof unit.ownerPlayerId === "string" && unit.ownerPlayerId.length > 0
      ? { ownerPlayerId: unit.ownerPlayerId }
      : {}),
    side: resolveTimelineSide(unit),
    x: coordinate.x,
    y: coordinate.y,
    currentHp: unit.hp,
    maxHp: unit.maxHp,
    ...(typeof unit.sourceUnitId === "string" && unit.sourceUnitId.length > 0
      ? { sourceUnitId: unit.sourceUnitId }
      : {}),
    ...(typeof presentation?.displayName === "string" && presentation.displayName.length > 0
      ? { displayName: presentation.displayName }
      : {}),
    ...(typeof presentation?.portraitKey === "string" && presentation.portraitKey.length > 0
      ? { portraitKey: presentation.portraitKey }
      : {}),
  };
}

function buildBattleKeyframeUnitState(unit: BattleUnit): BattleKeyframeUnitState {
  const coordinate = resolveTimelineCoordinate(unit);

  return {
    battleUnitId: unit.id,
    x: coordinate.x,
    y: coordinate.y,
    currentHp: unit.hp,
    maxHp: unit.maxHp,
    alive: !unit.isDead,
    state: unit.isDead ? "dead" : "idle",
  };
}

function resolveTimelineWinner(winner: BattleResult["winner"]): "boss" | "raid" | "draw" {
  if (winner === "left") {
    return "raid";
  }

  if (winner === "right") {
    return "boss";
  }

  return "draw";
}

/**
 * BattleUnit を作成するヘルパー関数
 * BoardUnitPlacement から BattleUnit を生成し、星レベルに応じたステータスを適用
 * Scarlet Mansionユニットの場合は特殊ステータスを適用
 * ボス（remilia）の場合はボスステータスを適用
 */
export function createBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
  isBoss: boolean = false,
  flags: FeatureFlags,
): BattleUnit {
  const resolvedPlacement = resolveBattlePlacement(placement, flags);
  const {
    unitType,
    unitLevel: resolvedUnitLevel,
    cell,
    archetype,
    hp: resolvedHp,
    attack: resolvedAttack,
    attackSpeed: resolvedAttackSpeed,
    movementSpeed: resolvedMovementSpeed,
    range: resolvedRange,
    critRate: resolvedCritRate,
    critDamageMultiplier: resolvedCritDamageMultiplier,
    damageReduction: resolvedDamageReduction,
  } = resolvedPlacement;
  const unitLevel = resolvedUnitLevel ?? 1;
  const baseStats = BASE_STATS[unitType];
  const bossStats = isBoss && archetype === "remilia" ? getMvpPhase1Boss() : null;

  let finalHp: number;
  let finalAttack: number;
  let finalAttackSpeed: number;
  let finalMovementSpeed: number;
  let finalRange: number;
  let finalCritRate: number;
  let finalCritDamageMultiplier: number;
  let finalDamageReduction: number = 0;

  if (bossStats) {
    finalHp = bossStats.hp;
    finalAttack = bossStats.attack;
    finalAttackSpeed = bossStats.attackSpeed;
    finalMovementSpeed = bossStats.movementSpeed;
    finalRange = bossStats.range;
    finalCritRate = bossStats.critRate;
    finalCritDamageMultiplier = bossStats.critDamageMultiplier;
    finalDamageReduction = bossStats.damageReduction;
  } else if (archetype && ["meiling", "sakuya", "patchouli"].includes(archetype)) {
    const scarletUnit = getScarletMansionUnitById(archetype);
    if (scarletUnit) {
      finalHp = scarletUnit.hp;
      finalAttack = scarletUnit.attack;
      finalAttackSpeed = scarletUnit.attackSpeed;
      finalMovementSpeed = scarletUnit.movementSpeed;
      finalRange = scarletUnit.range;
      finalCritRate = scarletUnit.critRate;
      finalCritDamageMultiplier = scarletUnit.critDamageMultiplier;
      finalDamageReduction = scarletUnit.damageReduction;
    } else {
      const unitLevelMultiplier = isBoss ? 1.0 : getUnitLevelCombatMultiplier(unitLevel);
      finalHp = baseStats.hp * unitLevelMultiplier;
      finalAttack = baseStats.attack * unitLevelMultiplier;
      finalAttackSpeed = baseStats.attackSpeed;
      finalMovementSpeed = baseStats.movementSpeed;
      finalRange = baseStats.range;
      finalCritRate = 0;
      finalCritDamageMultiplier = 1.5;
    }
  } else {
    const unitLevelMultiplier = isBoss ? 1.0 : getUnitLevelCombatMultiplier(unitLevel);
    finalHp = (resolvedHp ?? baseStats.hp) * unitLevelMultiplier;
    finalAttack = (resolvedAttack ?? baseStats.attack) * unitLevelMultiplier;
    finalAttackSpeed = resolvedAttackSpeed ?? baseStats.attackSpeed;
    finalMovementSpeed = resolvedMovementSpeed ?? baseStats.movementSpeed;
    finalRange = resolvedRange ?? baseStats.range;
    finalCritRate = resolvedCritRate ?? 0;
    finalCritDamageMultiplier = resolvedCritDamageMultiplier ?? 1.5;
    finalDamageReduction = resolvedDamageReduction ?? 0;
  }

  return {
    id: `${side}-${unitType}-${index}`,
    ...(typeof resolvedPlacement.ownerPlayerId === "string" && resolvedPlacement.ownerPlayerId.length > 0
      ? { ownerPlayerId: resolvedPlacement.ownerPlayerId }
      : {}),
    sourceUnitId: resolvedPlacement.unitId ?? `${side}-${unitType}-${index}`,
    battleSide: side,
    type: unitType,
    unitLevel,
    hp: finalHp,
    maxHp: finalHp,
    attackPower: finalAttack,
    attackSpeed: finalAttackSpeed,
    movementSpeed: finalMovementSpeed,
    attackRange: finalRange,
    cell: resolveBoardIndexForCell(cell),
    isDead: false,
    isBoss,
    attackCount: 0,
    critRate: finalCritRate,
    critDamageMultiplier: finalCritDamageMultiplier,
    damageReduction: finalDamageReduction,
    buffModifiers: {
      attackMultiplier: 1.0,
      defenseMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
    },
    reflectRatio: 0,
    debuffImmunityCategories: [],
  };
}

/**
 * セル間の距離を計算
 * ボード上の2つのセル間の距離（絶対値の差）を計算
 */
export function calculateCellDistance(
  cell1: number,
  cell2: number,
  side1?: "left" | "right",
  side2?: "left" | "right",
): number {
  const coordinate1 = resolveCellCoordinate(cell1, side1 ?? "left");
  const coordinate2 = resolveCellCoordinate(cell2, side2 ?? "right");
  return sharedBoardManhattanDistance(coordinate1, coordinate2);
}

/**
 * ボスパッシブ「紅色の世界」が有効かどうかを判定
 * 条件: ボスユニットかつ HP ≥ 70%
 * @param unit ユニット
 * @returns パッシブが有効な場合は true
 */
function isBossPassiveActive(unit: BattleUnit): boolean {
  if (!unit.isBoss) {
    return false;
  }
  return unit.hp >= unit.maxHp * 0.7;
}

/**
 * ターゲット選択ロジック
 * 攻撃者に対して、射程内の最も近い生きている敵ユニットを返す
 * @param attacker 攻撃者
 * @param enemies 敵ユニット配列
 * @returns ターゲットユニット（射程内に有効なターゲットがない場合は null）
 */
export function findTarget(attacker: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  if (!enemies || enemies.length === 0) {
    return null;
  }

  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);

  if (livingEnemies.length === 0) {
    return null;
  }

  let closestTarget: BattleUnit | null = null;
  let minDistance = Infinity;

  for (const enemy of livingEnemies) {
    const distance = calculateCellDistance(
      attacker.cell,
      enemy.cell,
      resolveBattleSide(attacker),
      resolveBattleSide(enemy),
    );

    if (distance > attacker.attackRange) {
      continue;
    }

    if (
      distance < minDistance
      || (
        distance === minDistance
        && closestTarget
        && (
          enemy.hp < closestTarget.hp
          || (enemy.hp === closestTarget.hp && enemy.cell < closestTarget.cell)
        )
      )
      || (distance === minDistance && !closestTarget)
    ) {
      minDistance = distance;
      closestTarget = enemy;
    }
  }

  return closestTarget;
}

function findClosestLivingEnemy(attacker: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  let closestTarget: BattleUnit | null = null;
  let minDistance = Infinity;

  for (const enemy of livingEnemies) {
    const distance = calculateCellDistance(
      attacker.cell,
      enemy.cell,
      resolveBattleSide(attacker),
      resolveBattleSide(enemy),
    );
    if (
      distance < minDistance
      || (
        distance === minDistance
        && closestTarget
        && (
          enemy.hp < closestTarget.hp
          || (enemy.hp === closestTarget.hp && enemy.cell < closestTarget.cell)
        )
      )
      || (distance === minDistance && !closestTarget)
    ) {
      minDistance = distance;
      closestTarget = enemy;
    }
  }

  return closestTarget;
}

function buildOccupiedCoordinatesForMovement(
  allies: BattleUnit[],
  enemies: BattleUnit[],
  movingUnitId: string,
): Set<string> {
  return new Set(
    [...allies, ...enemies]
      .filter((candidate) => !candidate.isDead && candidate.id !== movingUnitId)
      .map((candidate) =>
        coordinateKey(resolveCellCoordinate(candidate.cell, resolveBattleSide(candidate)))),
  );
}

function buildOccupiedCoordinatesByTeam(
  units: BattleUnit[],
  excludedUnitId?: string,
): Set<string> {
  return new Set(
    units
      .filter((candidate) => !candidate.isDead && candidate.id !== excludedUnitId)
      .map((candidate) =>
        coordinateKey(resolveCellCoordinate(candidate.cell, resolveBattleSide(candidate)))),
  );
}

function classifyPlannedApproachPathBlockerType(
  currentCoordinate: { x: number; y: number },
  destinationCoordinate: { x: number; y: number },
  allyOccupiedCoordinates: ReadonlySet<string>,
  enemyOccupiedCoordinates: ReadonlySet<string>,
): PlannedApproachPathBlockerType {
  let openImmediateCandidateCount = 0;
  let allyBlockedImmediateCandidateCount = 0;
  let enemyBlockedImmediateCandidateCount = 0;

  for (const candidate of buildApproachCandidates(currentCoordinate, destinationCoordinate)) {
    const candidateKey = coordinateKey(candidate);
    if (allyOccupiedCoordinates.has(candidateKey)) {
      allyBlockedImmediateCandidateCount += 1;
      continue;
    }
    if (enemyOccupiedCoordinates.has(candidateKey)) {
      enemyBlockedImmediateCandidateCount += 1;
      continue;
    }
    openImmediateCandidateCount += 1;
  }

  if (openImmediateCandidateCount > 0) {
    return "route_choke";
  }
  if (allyBlockedImmediateCandidateCount > 0 && enemyBlockedImmediateCandidateCount > 0) {
    return "mixed_adjacent";
  }
  if (allyBlockedImmediateCandidateCount > 0) {
    return "ally_adjacent";
  }
  if (enemyBlockedImmediateCandidateCount > 0) {
    return "enemy_adjacent";
  }
  return "route_choke";
}

function classifyPlannedApproachRouteChokeType(
  currentCoordinate: { x: number; y: number },
  destinationCoordinate: { x: number; y: number },
  allyOccupiedCoordinates: ReadonlySet<string>,
  enemyOccupiedCoordinates: ReadonlySet<string>,
): PlannedApproachRouteChokeType {
  const queue: Array<{ x: number; y: number }> = [currentCoordinate];
  const visited = new Set<string>([coordinateKey(currentCoordinate)]);
  let allyFrontierBlockCount = 0;
  let enemyFrontierBlockCount = 0;

  while (queue.length > 0) {
    const coordinate = queue.shift();
    if (!coordinate) {
      break;
    }

    for (const neighbor of buildApproachCandidates(coordinate, destinationCoordinate)) {
      const neighborKey = coordinateKey(neighbor);
      if (visited.has(neighborKey)) {
        continue;
      }
      if (allyOccupiedCoordinates.has(neighborKey)) {
        allyFrontierBlockCount += 1;
        continue;
      }
      if (enemyOccupiedCoordinates.has(neighborKey)) {
        enemyFrontierBlockCount += 1;
        continue;
      }

      visited.add(neighborKey);
      queue.push(neighbor);
    }
  }

  if (allyFrontierBlockCount > 0 && enemyFrontierBlockCount > 0) {
    return "mixed_frontier";
  }
  if (allyFrontierBlockCount > 0) {
    return "ally_frontier";
  }
  if (enemyFrontierBlockCount > 0) {
    return "enemy_frontier";
  }
  return "unclassified";
}

function calculateRequiredStepsToReachAttackRange(
  currentCoordinate: { x: number; y: number },
  targetCoordinate: { x: number; y: number },
  occupiedCoordinates: Set<string>,
  attackRange: number,
): number | null {
  if (sharedBoardManhattanDistance(currentCoordinate, targetCoordinate) <= attackRange) {
    return 0;
  }

  const queue: Array<{
    coordinate: { x: number; y: number };
    steps: number;
  }> = [{ coordinate: currentCoordinate, steps: 0 }];
  const visited = new Set<string>([coordinateKey(currentCoordinate)]);

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode) {
      break;
    }

    const neighbors = buildApproachCandidates(currentNode.coordinate, targetCoordinate);
    for (const neighbor of neighbors) {
      const neighborKey = coordinateKey(neighbor);
      if (visited.has(neighborKey) || occupiedCoordinates.has(neighborKey)) {
        continue;
      }

      const nextSteps = currentNode.steps + 1;
      if (sharedBoardManhattanDistance(neighbor, targetCoordinate) <= attackRange) {
        return nextSteps;
      }

      visited.add(neighborKey);
      queue.push({ coordinate: neighbor, steps: nextSteps });
    }
  }

  return null;
}

function calculateRequiredStepsToCoordinate(
  currentCoordinate: { x: number; y: number },
  destinationCoordinate: { x: number; y: number },
  occupiedCoordinates: Set<string>,
): number | null {
  const destinationKey = coordinateKey(destinationCoordinate);
  if (coordinateKey(currentCoordinate) === destinationKey) {
    return 0;
  }

  const queue: Array<{
    coordinate: { x: number; y: number };
    steps: number;
  }> = [{ coordinate: currentCoordinate, steps: 0 }];
  const visited = new Set<string>([coordinateKey(currentCoordinate)]);

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode) {
      break;
    }

    const neighbors = buildApproachCandidates(currentNode.coordinate, destinationCoordinate);
    for (const neighbor of neighbors) {
      const neighborKey = coordinateKey(neighbor);
      if (visited.has(neighborKey) || occupiedCoordinates.has(neighborKey)) {
        continue;
      }

      const nextSteps = currentNode.steps + 1;
      if (neighborKey === destinationKey) {
        return nextSteps;
      }

      visited.add(neighborKey);
      queue.push({ coordinate: neighbor, steps: nextSteps });
    }
  }

  return null;
}

function buildAttackDestinationCandidates(
  targetCoordinate: { x: number; y: number },
  attackRange: number,
): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number }> = [];

  for (let x = 0; x < DEFAULT_SHARED_BOARD_CONFIG.width; x += 1) {
    for (let y = 0; y < DEFAULT_SHARED_BOARD_CONFIG.height; y += 1) {
      const candidate = { x, y };
      const distance = sharedBoardManhattanDistance(candidate, targetCoordinate);
      if (distance === 0 || distance > attackRange) {
        continue;
      }

      candidates.push(candidate);
    }
  }

  return candidates;
}

function countCompetingAlliesForDestination(
  attacker: BattleUnit,
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  destinationCoordinate: { x: number; y: number },
  attackerRequiredSteps: number,
): { competingAllies: number; constrainedCompetingAllies: number } {
  let competingAllies = 0;
  let constrainedCompetingAllies = 0;

  for (const ally of allies) {
    if (ally.id === attacker.id || ally.isDead) {
      continue;
    }

    const allyCoordinate = resolveCellCoordinate(ally.cell, resolveBattleSide(ally));
    const allyOccupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, ally.id);
    const allyRequiredSteps = calculateRequiredStepsToCoordinate(
      allyCoordinate,
      destinationCoordinate,
      allyOccupiedCoordinates,
    );

    if (allyRequiredSteps != null && allyRequiredSteps <= attackerRequiredSteps) {
      competingAllies += 1;
      const allyReachableStats = resolveReachableApproachDestinationStats(ally, target, allies, enemies);
      if (allyReachableStats.reachableDestinationCount <= 1) {
        constrainedCompetingAllies += 1;
      }
    }
  }

  return {
    competingAllies,
    constrainedCompetingAllies,
  };
}

type ReachableApproachDestinationStats = {
  reachableDestinationCount: number;
  bestRequiredSteps: number;
};

type ApproachTargetPressureMetrics = {
  reachableDestinationCount: number;
  competingAllyCount: number;
  overload: number;
};

type ReachableApproachDestinationCandidate = {
  coordinate: { x: number; y: number };
  requiredSteps: number;
  accessCount: number;
  congestion: number;
};

function buildAdjacentCoordinates(coordinate: { x: number; y: number }): Array<{ x: number; y: number }> {
  return [
    { x: coordinate.x + 1, y: coordinate.y },
    { x: coordinate.x - 1, y: coordinate.y },
    { x: coordinate.x, y: coordinate.y + 1 },
    { x: coordinate.x, y: coordinate.y - 1 },
  ].filter(isCoordinateWithinBoard);
}

export function countReachableApproachDestinationEntryCoordinates(
  attacker: BattleUnit,
  target: BattleUnit,
  destinationCoordinate: { x: number; y: number },
  allies: BattleUnit[],
  enemies: BattleUnit[],
): number {
  const attackerSide = resolveBattleSide(attacker);
  const targetSide = resolveBattleSide(target);
  const currentCoordinate = resolveCellCoordinate(attacker.cell, attackerSide);
  const targetCoordinate = resolveCellCoordinate(target.cell, targetSide);
  const occupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, attacker.id);
  const destinationDistance = sharedBoardManhattanDistance(destinationCoordinate, targetCoordinate);

  if (destinationDistance === 0 || destinationDistance > attacker.attackRange) {
    return 0;
  }

  if (occupiedCoordinates.has(coordinateKey(destinationCoordinate))) {
    return 0;
  }

  let reachableEntryCount = 0;
  for (const adjacentCoordinate of buildAdjacentCoordinates(destinationCoordinate)) {
    if (occupiedCoordinates.has(coordinateKey(adjacentCoordinate))) {
      continue;
    }

    const requiredSteps = calculateRequiredStepsToCoordinate(
      currentCoordinate,
      adjacentCoordinate,
      occupiedCoordinates,
    );
    if (requiredSteps != null) {
      reachableEntryCount += 1;
    }
  }

  return reachableEntryCount;
}

function resolveReachableApproachDestinationStats(
  attacker: BattleUnit,
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): ReachableApproachDestinationStats {
  const attackerSide = resolveBattleSide(attacker);
  const targetSide = resolveBattleSide(target);
  const currentCoordinate = resolveCellCoordinate(attacker.cell, attackerSide);
  const targetCoordinate = resolveCellCoordinate(target.cell, targetSide);
  const occupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, attacker.id);
  const candidates = buildAttackDestinationCandidates(targetCoordinate, attacker.attackRange)
    .filter((candidate) => !occupiedCoordinates.has(coordinateKey(candidate)));

  let reachableDestinationCount = 0;
  let bestRequiredSteps = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const requiredSteps = calculateRequiredStepsToCoordinate(
      currentCoordinate,
      candidate,
      occupiedCoordinates,
    );
    if (requiredSteps == null) {
      continue;
    }

    reachableDestinationCount += 1;
    if (requiredSteps < bestRequiredSteps) {
      bestRequiredSteps = requiredSteps;
    }
  }

  return {
    reachableDestinationCount,
    bestRequiredSteps,
  };
}

function resolveApproachTargetPressureMetrics(
  attacker: BattleUnit,
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  attackerRequiredSteps: number,
): ApproachTargetPressureMetrics {
  const attackerStats = resolveReachableApproachDestinationStats(attacker, target, allies, enemies);
  let competingAllyCount = attackerStats.reachableDestinationCount > 0 ? 1 : 0;

  for (const ally of allies) {
    if (
      ally.id === attacker.id
      || ally.isDead
      || ally.attackRange !== attacker.attackRange
    ) {
      continue;
    }

    const allyStats = resolveReachableApproachDestinationStats(ally, target, allies, enemies);
    if (allyStats.reachableDestinationCount <= 0) {
      continue;
    }

    if (allyStats.bestRequiredSteps <= attackerRequiredSteps + 1) {
      competingAllyCount += 1;
    }
  }

  return {
    reachableDestinationCount: attackerStats.reachableDestinationCount,
    competingAllyCount,
    overload: Math.max(0, competingAllyCount - attackerStats.reachableDestinationCount),
  };
}

export function compareReachableApproachDestinationCandidate(
  left: ReachableApproachDestinationCandidate,
  right: ReachableApproachDestinationCandidate,
): number {
  if (left.requiredSteps !== right.requiredSteps) {
    return left.requiredSteps - right.requiredSteps;
  }

  if (left.accessCount !== right.accessCount) {
    return right.accessCount - left.accessCount;
  }

  if (left.congestion !== right.congestion) {
    return left.congestion - right.congestion;
  }

  if (left.coordinate.y !== right.coordinate.y) {
    return left.coordinate.y - right.coordinate.y;
  }

  return right.coordinate.x - left.coordinate.x;
}

function resolveReachableApproachDestinationCandidates(
  attacker: BattleUnit,
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  reservedDestinationKeys: ReadonlySet<string> = new Set<string>(),
): ReachableApproachDestinationCandidate[] {
  const attackerSide = resolveBattleSide(attacker);
  const targetSide = resolveBattleSide(target);
  const currentCoordinate = resolveCellCoordinate(attacker.cell, attackerSide);
  const occupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, attacker.id);
  const targetCoordinate = resolveCellCoordinate(target.cell, targetSide);
  const candidates = buildAttackDestinationCandidates(targetCoordinate, attacker.attackRange)
    .filter((candidate) => {
      const key = coordinateKey(candidate);
      return !occupiedCoordinates.has(key) && !reservedDestinationKeys.has(key);
    });

  return candidates
    .map((candidate) => {
      const requiredSteps = calculateRequiredStepsToCoordinate(
        currentCoordinate,
        candidate,
        occupiedCoordinates,
      );
      if (requiredSteps == null) {
        return null;
      }

      return {
        coordinate: candidate,
        requiredSteps,
        accessCount: countReachableApproachDestinationEntryCoordinates(
          attacker,
          target,
          candidate,
          allies,
          enemies,
        ),
        congestion: countOccupiedAdjacentCoordinates(candidate, occupiedCoordinates),
      };
    })
    .filter((candidate): candidate is ReachableApproachDestinationCandidate => candidate != null)
    .sort(compareReachableApproachDestinationCandidate);
}

export function assignApproachDestinationsForTarget(
  attackers: BattleUnit[],
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  reservedDestinationKeys: ReadonlySet<string> = new Set<string>(),
): Map<string, { x: number; y: number }> {
  const optionSets = attackers
    .filter((attacker) => !attacker.isDead)
    .map((attacker, originalIndex) => ({
      attacker,
      originalIndex,
      options: resolveReachableApproachDestinationCandidates(
        attacker,
        target,
        allies,
        enemies,
        reservedDestinationKeys,
      ),
    }))
    .filter((entry) => entry.options.length > 0)
    .sort((left, right) => {
      if (left.options.length !== right.options.length) {
        return left.options.length - right.options.length;
      }

      const bestCandidateComparison = compareReachableApproachDestinationCandidate(
        left.options[0]!,
        right.options[0]!,
      );
      if (bestCandidateComparison !== 0) {
        return bestCandidateComparison;
      }

      return left.originalIndex - right.originalIndex;
    });

  let bestAssignedCount = -1;
  let bestAccessCount = Number.NEGATIVE_INFINITY;
  let bestRequiredSteps = Number.POSITIVE_INFINITY;
  let bestCongestion = Number.POSITIVE_INFINITY;
  let bestAssignments = new Map<string, { x: number; y: number }>();

  const search = (
    index: number,
    usedDestinationKeys: Set<string>,
    currentAssignments: Map<string, { x: number; y: number }>,
    totalAccessCount: number,
    totalRequiredSteps: number,
    totalCongestion: number,
  ) => {
    if (index >= optionSets.length) {
      const assignedCount = currentAssignments.size;
      if (
        assignedCount > bestAssignedCount
        || (
          assignedCount === bestAssignedCount
          && (
            totalAccessCount > bestAccessCount
            || (
              totalAccessCount === bestAccessCount
              && totalRequiredSteps < bestRequiredSteps
            )
            || (
              totalAccessCount === bestAccessCount
              && totalRequiredSteps === bestRequiredSteps
              && totalCongestion < bestCongestion
            )
          )
        )
      ) {
        bestAssignedCount = assignedCount;
        bestAccessCount = totalAccessCount;
        bestRequiredSteps = totalRequiredSteps;
        bestCongestion = totalCongestion;
        bestAssignments = new Map(currentAssignments);
      }
      return;
    }

    const remainingUnits = optionSets.length - index;
    if (currentAssignments.size + remainingUnits < bestAssignedCount) {
      return;
    }

    search(
      index + 1,
      usedDestinationKeys,
      currentAssignments,
      totalAccessCount,
      totalRequiredSteps,
      totalCongestion,
    );

    const optionSet = optionSets[index]!;
    for (const option of optionSet.options) {
      const destinationKey = coordinateKey(option.coordinate);
      if (usedDestinationKeys.has(destinationKey)) {
        continue;
      }

      usedDestinationKeys.add(destinationKey);
      currentAssignments.set(optionSet.attacker.id, option.coordinate);
      search(
        index + 1,
        usedDestinationKeys,
        currentAssignments,
        totalAccessCount + option.accessCount,
        totalRequiredSteps + option.requiredSteps,
        totalCongestion + option.congestion,
      );
      currentAssignments.delete(optionSet.attacker.id);
      usedDestinationKeys.delete(destinationKey);
    }
  };

  search(0, new Set<string>(), new Map<string, { x: number; y: number }>(), 0, 0, 0);

  return bestAssignments;
}

export function findBestApproachDestinationCoordinate(
  attacker: BattleUnit,
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  reservedDestinationKeys: ReadonlySet<string> = new Set<string>(),
): { x: number; y: number } | null {
  const attackerSide = resolveBattleSide(attacker);
  const targetSide = resolveBattleSide(target);
  const currentCoordinate = resolveCellCoordinate(attacker.cell, attackerSide);
  const targetCoordinate = resolveCellCoordinate(target.cell, targetSide);

  if (sharedBoardManhattanDistance(currentCoordinate, targetCoordinate) <= attacker.attackRange) {
    return currentCoordinate;
  }

  const occupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, attacker.id);
  const candidates = buildAttackDestinationCandidates(targetCoordinate, attacker.attackRange)
    .filter((candidate) => {
      const key = coordinateKey(candidate);
      return !occupiedCoordinates.has(key) && !reservedDestinationKeys.has(key);
    });

  let bestDestination: { x: number; y: number } | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestConstrainedCompetingAllies = Number.POSITIVE_INFINITY;
  let bestCompetingAllies = Number.POSITIVE_INFINITY;
  let bestAccessCount = Number.NEGATIVE_INFINITY;
  let bestRequiredSteps = Number.POSITIVE_INFINITY;
  let bestCongestion = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const requiredSteps = calculateRequiredStepsToCoordinate(
      currentCoordinate,
      candidate,
      occupiedCoordinates,
    );
    if (requiredSteps == null) {
      continue;
    }

    const { competingAllies, constrainedCompetingAllies } = countCompetingAlliesForDestination(
      attacker,
      target,
      allies,
      enemies,
      candidate,
      requiredSteps,
    );
    const accessCount = countReachableApproachDestinationEntryCoordinates(
      attacker,
      target,
      candidate,
      allies,
      enemies,
    );
    const congestion = countOccupiedAdjacentCoordinates(candidate, occupiedCoordinates);
    const score = requiredSteps + competingAllies;

    if (
      score < bestScore
      || (
      score === bestScore
      && (
          constrainedCompetingAllies < bestConstrainedCompetingAllies
          || (
            constrainedCompetingAllies === bestConstrainedCompetingAllies
            && (
              competingAllies < bestCompetingAllies
              || (
                competingAllies === bestCompetingAllies
                && (
                  accessCount > bestAccessCount
                  || (
                    accessCount === bestAccessCount
                    && (
                      requiredSteps < bestRequiredSteps
                      || (
                        requiredSteps === bestRequiredSteps
                        && (
                          congestion < bestCongestion
                          || (
                            congestion === bestCongestion
                            && bestDestination != null
                            && (
                              candidate.y < bestDestination.y
                              || (candidate.y === bestDestination.y && candidate.x > bestDestination.x)
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
      || (score === bestScore && bestDestination == null)
    ) {
      bestDestination = candidate;
      bestScore = score;
      bestConstrainedCompetingAllies = constrainedCompetingAllies;
      bestCompetingAllies = competingAllies;
      bestAccessCount = accessCount;
      bestRequiredSteps = requiredSteps;
      bestCongestion = congestion;
    }
  }

  return bestDestination;
}
export function findShortestApproachStepToCoordinate(
  currentCoordinate: { x: number; y: number },
  destinationCoordinate: { x: number; y: number },
  occupiedCoordinates: Set<string>,
): { x: number; y: number } | null {
  const destinationKey = coordinateKey(destinationCoordinate);
  if (coordinateKey(currentCoordinate) === destinationKey) {
    return null;
  }

  const queue: Array<{
    coordinate: { x: number; y: number };
    firstStep: { x: number; y: number } | null;
  }> = [{ coordinate: currentCoordinate, firstStep: null }];
  const visited = new Set<string>([coordinateKey(currentCoordinate)]);

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode) {
      break;
    }

    const neighbors = buildApproachCandidates(currentNode.coordinate, destinationCoordinate);
    for (const neighbor of neighbors) {
      const neighborKey = coordinateKey(neighbor);
      if (visited.has(neighborKey) || occupiedCoordinates.has(neighborKey)) {
        continue;
      }

      const firstStep = currentNode.firstStep ?? neighbor;
      if (neighborKey === destinationKey) {
        return firstStep;
      }

      visited.add(neighborKey);
      queue.push({ coordinate: neighbor, firstStep });
    }
  }

  return null;
}

export function findBestApproachTarget(
  attacker: BattleUnit,
  enemies: BattleUnit[],
  allies: BattleUnit[],
): BattleUnit | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  const attackerSide = resolveBattleSide(attacker);
  const currentCoordinate = resolveCellCoordinate(attacker.cell, attackerSide);
  const occupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, attacker.id);

  let bestTarget: BattleUnit | null = null;
  let bestOverload = Number.POSITIVE_INFINITY;
  let bestReachableDestinationCount = -1;
  let bestRequiredSteps = Number.POSITIVE_INFINITY;
  let bestDirectDistance = Number.POSITIVE_INFINITY;

  for (const enemy of livingEnemies) {
    const enemySide = resolveBattleSide(enemy);
    const targetCoordinate = resolveCellCoordinate(enemy.cell, enemySide);
    const requiredSteps = calculateRequiredStepsToReachAttackRange(
      currentCoordinate,
      targetCoordinate,
      occupiedCoordinates,
      attacker.attackRange,
    );
    const comparableSteps = requiredSteps ?? Number.POSITIVE_INFINITY;
    const directDistance = calculateCellDistance(attacker.cell, enemy.cell, attackerSide, enemySide);
    const targetPressure = attacker.attackRange === 1 && requiredSteps != null
      ? resolveApproachTargetPressureMetrics(attacker, enemy, allies, enemies, requiredSteps)
      : null;
    const overload = targetPressure?.overload ?? 0;
    const reachableDestinationCount = targetPressure?.reachableDestinationCount ?? Number.POSITIVE_INFINITY;

    if (
      comparableSteps < bestRequiredSteps
      || (
        comparableSteps === bestRequiredSteps
        && overload < bestOverload
      )
      || (
        comparableSteps === bestRequiredSteps
        && overload === bestOverload
        && reachableDestinationCount > bestReachableDestinationCount
      )
      || (
        comparableSteps === bestRequiredSteps
        && overload === bestOverload
        && reachableDestinationCount === bestReachableDestinationCount
        && (
          directDistance < bestDirectDistance
          || (
            directDistance === bestDirectDistance
            && bestTarget
            && (
              enemy.hp < bestTarget.hp
              || (enemy.hp === bestTarget.hp && enemy.cell < bestTarget.cell)
            )
          )
        )
      )
      || (
        comparableSteps === bestRequiredSteps
        && overload === bestOverload
        && reachableDestinationCount === bestReachableDestinationCount
        && directDistance === bestDirectDistance
        && bestTarget == null
      )
    ) {
      bestTarget = enemy;
      bestOverload = overload;
      bestReachableDestinationCount = reachableDestinationCount;
      bestRequiredSteps = comparableSteps;
      bestDirectDistance = directDistance;
    }
  }

  return bestTarget;
}

type MoveActionDiagnostics = {
  pursuedTarget: BattleUnit | null;
  bestApproachTarget: BattleUnit | null;
  pursuedTargetDistanceBeforeMove: number | null;
  bestApproachTargetDistanceBeforeMove: number | null;
  pursuedTargetRequiredStepsBeforeMove: number | null;
  bestApproachTargetRequiredStepsBeforeMove: number | null;
};

function resolveMoveActionDiagnostics(
  unit: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): MoveActionDiagnostics {
  const bestApproachTarget = findBestApproachTarget(unit, enemies, allies);
  const pursuedTarget = bestApproachTarget ?? findClosestLivingEnemy(unit, enemies);
  const unitSide = resolveBattleSide(unit);
  const currentCoordinate = resolveCellCoordinate(unit.cell, unitSide);
  const occupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, unit.id);

  const buildTargetMetrics = (target: BattleUnit | null): {
    directDistance: number | null;
    requiredSteps: number | null;
  } => {
    if (!target) {
      return {
        directDistance: null,
        requiredSteps: null,
      };
    }

    const targetSide = resolveBattleSide(target);
    const targetCoordinate = resolveCellCoordinate(target.cell, targetSide);
    return {
      directDistance: calculateCellDistance(unit.cell, target.cell, unitSide, targetSide),
      requiredSteps: calculateRequiredStepsToReachAttackRange(
        currentCoordinate,
        targetCoordinate,
        occupiedCoordinates,
        unit.attackRange,
      ),
    };
  };

  const pursuedMetrics = buildTargetMetrics(pursuedTarget);
  const bestApproachMetrics = buildTargetMetrics(bestApproachTarget);

  return {
    pursuedTarget,
    bestApproachTarget,
    pursuedTargetDistanceBeforeMove: pursuedMetrics.directDistance,
    bestApproachTargetDistanceBeforeMove: bestApproachMetrics.directDistance,
    pursuedTargetRequiredStepsBeforeMove: pursuedMetrics.requiredSteps,
    bestApproachTargetRequiredStepsBeforeMove: bestApproachMetrics.requiredSteps,
  };
}

function moveUnitBySimpleApproach(
  unit: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  combatLog: string[],
  approachTarget: BattleUnit | null = null,
  reservedApproachDestinationKeys: Set<string> | null = null,
  plannedDestinationCoordinate: { x: number; y: number } | null = null,
): {
  moved: boolean;
  plannedDestinationStillOpenBeforeMove: boolean | null;
  usedPlannedApproachDestination: boolean;
  plannedApproachDestinationPathBlockedBeforeMove: boolean;
  plannedApproachDestinationPathBlockerTypeBeforeMove: PlannedApproachPathBlockerType | null;
  plannedApproachDestinationRouteChokeTypeBeforeMove: PlannedApproachRouteChokeType | null;
} {
  const nearestEnemy = approachTarget ?? findClosestLivingEnemy(unit, enemies);
  if (!nearestEnemy) {
    return {
      moved: false,
      plannedDestinationStillOpenBeforeMove: null,
      usedPlannedApproachDestination: false,
      plannedApproachDestinationPathBlockedBeforeMove: false,
      plannedApproachDestinationPathBlockerTypeBeforeMove: null,
      plannedApproachDestinationRouteChokeTypeBeforeMove: null,
    };
  }

  const unitSide = resolveBattleSide(unit);
  const enemySide = resolveBattleSide(nearestEnemy);
  const currentDistance = calculateCellDistance(unit.cell, nearestEnemy.cell, unitSide, enemySide);
  if (currentDistance <= unit.attackRange) {
    return {
      moved: false,
      plannedDestinationStillOpenBeforeMove: null,
      usedPlannedApproachDestination: false,
      plannedApproachDestinationPathBlockedBeforeMove: false,
      plannedApproachDestinationPathBlockerTypeBeforeMove: null,
      plannedApproachDestinationRouteChokeTypeBeforeMove: null,
    };
  }

  const previousCell = unit.cell;
  const currentCoordinate = resolveCellCoordinate(unit.cell, unitSide);
  const occupiedCoordinates = buildOccupiedCoordinatesForMovement(allies, enemies, unit.id);
  const allyOccupiedCoordinates = buildOccupiedCoordinatesByTeam(allies, unit.id);
  const enemyOccupiedCoordinates = buildOccupiedCoordinatesByTeam(enemies);
  const plannedDestinationKey = plannedDestinationCoordinate == null
    ? null
    : coordinateKey(plannedDestinationCoordinate);
  const plannedDestinationStillOpenBeforeMove = plannedDestinationKey != null
    ? !occupiedCoordinates.has(plannedDestinationKey)
    : null;
  const preferredDestination = plannedDestinationStillOpenBeforeMove
    ? plannedDestinationCoordinate
    : findBestApproachDestinationCoordinate(
      unit,
      nearestEnemy,
      allies,
      enemies,
      reservedApproachDestinationKeys ?? undefined,
    );
  const usedPlannedApproachDestination = plannedDestinationCoordinate != null
    && plannedDestinationStillOpenBeforeMove === true;
  const targetCoordinate = preferredDestination
    ?? resolveCellCoordinate(nearestEnemy.cell, enemySide);
  const nextCoordinate = preferredDestination
    ? findShortestApproachStepToCoordinate(
      currentCoordinate,
      targetCoordinate,
      occupiedCoordinates,
    )
    : findShortestApproachStep(
      currentCoordinate,
      targetCoordinate,
      occupiedCoordinates,
      unit.attackRange,
    );
  const plannedApproachDestinationPathBlockedBeforeMove = usedPlannedApproachDestination
    && nextCoordinate == null;
  const plannedApproachDestinationPathBlockerTypeBeforeMove = plannedApproachDestinationPathBlockedBeforeMove
    ? classifyPlannedApproachPathBlockerType(
      currentCoordinate,
      targetCoordinate,
      allyOccupiedCoordinates,
      enemyOccupiedCoordinates,
    )
    : null;
  const plannedApproachDestinationRouteChokeTypeBeforeMove =
    plannedApproachDestinationPathBlockedBeforeMove
      && plannedApproachDestinationPathBlockerTypeBeforeMove === "route_choke"
      ? classifyPlannedApproachRouteChokeType(
        currentCoordinate,
        targetCoordinate,
        allyOccupiedCoordinates,
        enemyOccupiedCoordinates,
      )
      : null;
  const fallbackCoordinate = nextCoordinate
    ?? findFallbackApproachStep(currentCoordinate, targetCoordinate, occupiedCoordinates);
  if (!fallbackCoordinate) {
    return {
      moved: false,
      plannedDestinationStillOpenBeforeMove,
      usedPlannedApproachDestination,
      plannedApproachDestinationPathBlockedBeforeMove,
      plannedApproachDestinationPathBlockerTypeBeforeMove,
      plannedApproachDestinationRouteChokeTypeBeforeMove,
    };
  }

  unit.cell = sharedBoardCoordinateToIndex(fallbackCoordinate, DEFAULT_SHARED_BOARD_CONFIG);
  if (preferredDestination && reservedApproachDestinationKeys) {
    reservedApproachDestinationKeys.add(coordinateKey(preferredDestination));
  }

  const sideLabel = resolveBattleSide(unit) === "left" ? "Left" : "Right";
  const typeLabel = unit.type.charAt(0).toUpperCase() + unit.type.slice(1);
  combatLog.push(
    `${sideLabel} ${typeLabel} moves from cell ${previousCell} to cell ${unit.cell}`,
  );

  return {
    moved: true,
    plannedDestinationStillOpenBeforeMove,
    usedPlannedApproachDestination,
    plannedApproachDestinationPathBlockedBeforeMove,
    plannedApproachDestinationPathBlockerTypeBeforeMove,
    plannedApproachDestinationRouteChokeTypeBeforeMove,
  };
}

/**
 * チームの戦力を計算（HPと攻撃力の合計）
 */
function calculateTeamPower(units: BattleUnit[]): number {
  return units.reduce((total, unit) => {
    if (unit.isDead) {
      return total;
    }
    return total + unit.hp + unit.attackPower;
  }, 0);
}

/**
 * シナジーバフをユニットに適用
 * @param units ユニット配列
 * @param boardPlacements ボード配置情報
 */
function applySynergyBuffs(
  units: BattleUnit[],
  boardPlacements: BoardUnitPlacement[],
  heroSynergyBonusType: BoardUnitType | BoardUnitType[] | null = null,
  flags: FeatureFlags = DEFAULT_FLAGS,
): void {
  const synergyDetails = calculateSynergyDetails(boardPlacements, heroSynergyBonusType, {
    enableTouhouFactions: flags.enableTouhouFactions,
  });
  const scarletMansionSynergyActive = calculateScarletMansionSynergy(boardPlacements);

  for (const [index, unit] of units.entries()) {
    applyScarletMansionSynergyToBoss(unit, scarletMansionSynergyActive);

    const tier = synergyDetails.activeTiers[unit.type];
    if (tier > 0) {
      applySynergyEffects(unit, SYNERGY_DEFINITIONS[unit.type].effects, tier);
    }

    const factionId = boardPlacements[index]?.factionId;
    if (!factionId) {
      continue;
    }

    const factionTier = synergyDetails.factionActiveTiers[factionId] ?? 0;
    const factionDef = TOUHOU_FACTION_DEFINITIONS[factionId];
    if (factionTier > 0 && factionDef) {
      applySynergyEffects(unit, factionDef.effects, factionTier);

      const factionEffect = getTouhouFactionTierEffect(factionId, factionTier);
      if (factionEffect?.special?.reflectRatio !== undefined) {
        unit.reflectRatio = factionEffect.special.reflectRatio;
      }
      if (factionEffect?.special?.ultimateDamageMultiplier !== undefined) {
        unit.ultimateDamageMultiplier = factionEffect.special.ultimateDamageMultiplier;
      }
      if (factionEffect?.special?.bonusDamageVsDebuffedTarget !== undefined) {
        unit.bonusDamageVsDebuffedTarget = factionEffect.special.bonusDamageVsDebuffedTarget;
      }
      if (factionEffect?.special?.debuffImmunityCategories !== undefined) {
        unit.debuffImmunityCategories = factionEffect.special.debuffImmunityCategories;
      }
    }
  }
}

function applySynergyEffects(unit: BattleUnit, effects: SynergyEffects, tier: number): void {
  const idx = tier - 1;

  if (effects.defense) {
    const defenseValue = effects.defense[idx];
    if (defenseValue !== undefined) {
      unit.damageReduction += defenseValue;
    }
  }

  if (effects.hpMultiplier) {
    const multiplier = effects.hpMultiplier[idx];
    if (multiplier !== undefined) {
      unit.maxHp = Math.floor(unit.maxHp * multiplier);
      unit.hp = Math.floor(unit.hp * multiplier);
    }
  }

  if (effects.attackPower) {
    const attackPowerValue = effects.attackPower[idx];
    if (attackPowerValue !== undefined) {
      unit.attackPower += attackPowerValue;
    }
  }

  if (effects.attackSpeedMultiplier) {
    const attackSpeedValue = effects.attackSpeedMultiplier[idx];
    if (attackSpeedValue !== undefined) {
      unit.buffModifiers.attackSpeedMultiplier *= attackSpeedValue;
    }
  }

  if (effects.critRate) {
    const critRateValue = effects.critRate[idx];
    if (critRateValue !== undefined) {
      unit.critRate += critRateValue;
    }
  }

  if (effects.critDamageMultiplier) {
    const critDamageValue = effects.critDamageMultiplier[idx];
    if (critDamageValue !== undefined) {
      unit.critDamageMultiplier = Math.max(
        unit.critDamageMultiplier,
        critDamageValue,
      );
    }
  }
}

/**
 * サブユニット補助効果をユニットへ適用
 */
function applySubUnitAssist(
  units: BattleUnit[],
  placements: BoardUnitPlacement[],
  subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig>,
  combatLog: string[],
): void {
  const entryCount = Math.min(units.length, placements.length);

  for (let index = 0; index < entryCount; index += 1) {
    const unit = units[index];
    const placement = placements[index];

    if (!unit || !placement) {
      continue;
    }

    const subUnitConfig = subUnitAssistConfigByType.get(placement.unitType);
    if (!subUnitConfig || subUnitConfig.mode !== "assist") {
      continue;
    }

    if (subUnitConfig.parentUnitId && placement.unitId !== subUnitConfig.parentUnitId) {
      continue;
    }

    const appliedLabels: string[] = [];

    if (subUnitConfig.bonusHpPct !== undefined && subUnitConfig.bonusHpPct > 0) {
      const bonusHp = Math.floor(unit.maxHp * subUnitConfig.bonusHpPct);
      if (bonusHp > 0) {
        unit.maxHp += bonusHp;
        unit.hp += bonusHp;
        appliedLabels.push(`+${bonusHp} HP`);
      }
    }

    if (subUnitConfig.bonusAttackPct !== undefined && subUnitConfig.bonusAttackPct > 0) {
      const bonusAttack = Math.floor(unit.attackPower * subUnitConfig.bonusAttackPct);
      if (bonusAttack > 0) {
        unit.attackPower += bonusAttack;
        appliedLabels.push(`+${bonusAttack} ATK`);
      }
    }

    if (appliedLabels.length > 0) {
      combatLog.push(
        `${generateUnitName(unit)} gains sub-unit assist (${subUnitConfig.unitId}): ${appliedLabels.join(", ")}`,
      );
    }
  }
}

/**
 * ユニット名を生成（戦闘ログ用）
 */
function generateUnitName(unit: BattleUnit): string {
  const sideLabel = resolveBattleSide(unit) === "left" ? "Left" : "Right";
  const typeLabel = unit.type.charAt(0).toUpperCase() + unit.type.slice(1);
  return `${sideLabel} ${typeLabel} (cell ${unit.cell})`;
}

/**
 * 生存中のユニットが存在するかを確認
 */
function hasLivingUnits(units: BattleUnit[]): boolean {
  return units.some((unit) => !unit.isDead);
}

/**
 * 戦闘シミュレーター
 * ターン制戦闘ループを実装
 */
export class BattleSimulator {
  private readonly rng: BattleRng;

  constructor(options?: { rng?: BattleRng }) {
    this.rng = options?.rng ?? createDefaultBattleRng();
  }

  /**
   * 戦闘をシミュレート
   * ターゲット選択ロジックとターン制戦闘ループを使用して戦闘をシミュレート
   * @param leftUnits 左側チームのユニット（セル 0-3）
   * @param rightUnits 右側チームのユニット（セル 4-7）
   * @param leftPlacements 左側チームのユニット配置（シナジー・アイテム計算用）
   * @param rightPlacements 右側チームのユニット配置（シナジー・アイテム計算用）
   * @param maxDurationMs 最大戦闘時間（ミリ秒）
   * @returns 戦闘結果
   */
  simulateBattle(
    leftUnits: BattleUnit[],
    rightUnits: BattleUnit[],
    leftPlacements: BoardUnitPlacement[] = [],
    rightPlacements: BoardUnitPlacement[] = [],
    maxDurationMs: number = 30000,
    leftHeroSynergyBonusType: BoardUnitType | BoardUnitType[] | null = null,
    rightHeroSynergyBonusType: BoardUnitType | BoardUnitType[] | null = null,
    subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig> | null = null,
    flags: FeatureFlags = DEFAULT_FLAGS,
    round: number = 0,
  ): BattleResult {
    try {
      const timeoutEnabled = round < 12;
      const effectiveMaxDurationMs = timeoutEnabled ? maxDurationMs : Number.POSITIVE_INFINITY;

      // Bug #3 fix: Validate input teams
      if (!leftUnits || leftUnits.length === 0 || !rightUnits || rightUnits.length === 0) {
        console.warn("Battle simulation with empty teams");
        const isBothEmpty = (!leftUnits || leftUnits.length === 0) && (!rightUnits || rightUnits.length === 0);
        const result: BattleResult = {
          winner: leftUnits.length > 0 ? "left" : rightUnits.length > 0 ? "right" : "draw",
          endReason: isBothEmpty ? "mutual_annihilation" : "annihilation",
          leftSurvivors: leftUnits.filter(u => !u.isDead),
          rightSurvivors: rightUnits.filter(u => !u.isDead),
          timeline: [],
          combatLog: isBothEmpty ? ["Draw (all units defeated)"] : ["Battle with empty teams"],
          durationMs: 0,
          damageDealt: {
            left: 0,
            right: 0,
          },
        };
        return result;
      }

      const combatLog: string[] = [];
      const battleId = `battle-${Date.now()}`;
      const timeline: BattleTimelineEvent[] = [];
      combatLog.push("Battle started");
      combatLog.push(`Left units: ${leftUnits.length}`);
      combatLog.push(`Right units: ${rightUnits.length}`);
      timeline.push(createBattleStartEvent({
        battleId,
        round,
        boardConfig: {
          width: DEFAULT_SHARED_BOARD_CONFIG.width,
          height: DEFAULT_SHARED_BOARD_CONFIG.height,
        },
        units: [...leftUnits, ...rightUnits].map(buildBattleStartSnapshot),
      }));
      timeline.push(createKeyframeEvent({
        battleId,
        atMs: 0,
        units: [...leftUnits, ...rightUnits].map(buildBattleKeyframeUnitState),
      }));

      const leftScarletBossLifestealActive = hasScarletMansionBossLifesteal(leftPlacements);
      const rightScarletBossLifestealActive = hasScarletMansionBossLifesteal(rightPlacements);

      // シナジーバフを適用
      applySynergyBuffs(leftUnits, leftPlacements, leftHeroSynergyBonusType, flags);
      applySynergyBuffs(rightUnits, rightPlacements, rightHeroSynergyBonusType, flags);

      if (subUnitAssistConfigByType && subUnitAssistConfigByType.size > 0) {
        applySubUnitAssist(
          leftUnits,
          leftPlacements,
          subUnitAssistConfigByType,
          combatLog,
        );
        applySubUnitAssist(
          rightUnits,
          rightPlacements,
          subUnitAssistConfigByType,
          combatLog,
        );
      }

      if (flags.enableHeroSystem) {
        applyPairSkillBindings(leftUnits, leftPlacements, combatLog);
        applyPairSkillBindings(rightUnits, rightPlacements, combatLog);
      }

      const allUnits = [...leftUnits, ...rightUnits];
      const actionQueue: Action[] = [];
      const nextScheduledAttackAtByUnitId = new Map<string, number>();
      const nextScheduledMoveAtByUnitId = new Map<string, number>();
      let currentTime = 0;
      const bossBattleSide: "left" | "right" | null = leftUnits.some((unit) => unit.isBoss)
        ? "left"
        : rightUnits.some((unit) => unit.isBoss)
          ? "right"
          : null;

      // ダメージ追跡用変数
      let damageDealtLeft = 0;  // 左チームが与えたダメージ
      let damageDealtRight = 0; // 右チームが与えたダメージ
      let bossDamage = 0;       // ボスが受けたダメージ
      let phaseDamageToBossSide = 0; // ボス本体ダメージ + boss側護衛撃破ボーナス
      let nextKeyframeAtMs = 250;
      let forcedWinner: "left" | "right" | null = null;

      const appendDueKeyframes = (atMs: number) => {
        while (atMs >= nextKeyframeAtMs) {
          timeline.push(createKeyframeEvent({
            battleId,
            atMs: nextKeyframeAtMs,
            units: [...leftUnits, ...rightUnits].map(buildBattleKeyframeUnitState),
          }));
          nextKeyframeAtMs += 250;
        }
      };

      const resolveBossBreakWinner = (
        actingSide: "left" | "right",
        defeatedBoss: BattleUnit,
      ): "left" | "right" => {
        if (!defeatedBoss.isDead) {
          defeatedBoss.isDead = true;
          combatLog.push(`${generateUnitName(defeatedBoss)} has been defeated!`);
          timeline.push(createUnitDeathEvent({
            type: "unitDeath",
            battleId,
            atMs: currentTime,
            battleUnitId: defeatedBoss.id,
          }));
        }

        combatLog.push(
          `Battle ended: ${actingSide === "left" ? "Left" : "Right"} wins (phase HP depleted)`,
        );
        return actingSide;
      };

      const recordAppliedDamage = (
        sourceUnit: BattleUnit,
        targetUnit: BattleUnit,
        amount: number,
      ): "left" | "right" | null => {
        const sourceSide = resolveBattleSide(sourceUnit);
        const appliedDamageSummary = buildAppliedDamageSummary(
          sourceSide,
          targetUnit,
          amount,
          bossBattleSide,
        );

        if (amount <= 0) {
          return null;
        }

        timeline.push(createDamageAppliedEvent({
          type: "damageApplied",
          battleId,
          atMs: currentTime,
          sourceBattleUnitId: sourceUnit.id,
          targetBattleUnitId: targetUnit.id,
          amount,
          remainingHp: Math.max(0, targetUnit.hp),
        }));

        damageDealtLeft += appliedDamageSummary.damageDealtLeftIncrement;
        damageDealtRight += appliedDamageSummary.damageDealtRightIncrement;
        bossDamage += appliedDamageSummary.bossDamageIncrement;
        phaseDamageToBossSide += appliedDamageSummary.phaseDamageIncrement;

        if (appliedDamageSummary.defeatedTarget && !targetUnit.isDead) {
          if (appliedDamageSummary.bossBreakTriggered) {
            return resolveBossBreakWinner(sourceSide, targetUnit);
          }

          targetUnit.isDead = true;
          combatLog.push(`${generateUnitName(targetUnit)} has been defeated!`);
          timeline.push(createUnitDeathEvent({
            type: "unitDeath",
            battleId,
            atMs: currentTime,
            battleUnitId: targetUnit.id,
          }));
        }

        return null;
      };

      const recordSkillDamageAgainstEnemies = (
        sourceUnit: BattleUnit,
        enemies: BattleUnit[],
        enemyHpBefore: Map<string, number>,
      ): "left" | "right" | null => {
        for (const enemy of enemies) {
          const hpBefore = enemyHpBefore.get(enemy.id);
          if (hpBefore === undefined) {
            continue;
          }

          const appliedDamage = Math.max(0, hpBefore - Math.max(0, enemy.hp));
          const forcedSkillWinner = recordAppliedDamage(sourceUnit, enemy, appliedDamage);
          if (forcedSkillWinner) {
            return forcedSkillWinner;
          }
        }

        return null;
      };

      type PendingAttack = {
        sourceUnit: BattleUnit;
        targetUnit: BattleUnit;
        unitSide: "left" | "right";
        actualDamage: number;
        remainingHpAfterHit: number;
        reflectedDamage: number;
        isCrit: boolean;
        bossPassiveActive: boolean;
        scarletBossLifestealActive: boolean;
      };

      const scheduleTriggeredSkill = (unit: BattleUnit) => {
        const skillDef = resolveUnitSkillDefinition(unit);
        if (
          skillDef
          && skillDef.triggerType === "on_attack_count"
          && skillDef.triggerCount !== undefined
          && unit.attackCount % skillDef.triggerCount === 0
        ) {
          actionQueue.push({
            unit,
            actionTime: currentTime,
            type: "skill",
          });
        }
      };

      const scheduleAttackAt = (unit: BattleUnit, actionTime: number) => {
        nextScheduledAttackAtByUnitId.set(unit.id, actionTime);
        actionQueue.push({
          unit,
          actionTime,
          type: "attack",
        });
      };

      const scheduleMoveAt = (unit: BattleUnit, actionTime: number) => {
        nextScheduledMoveAtByUnitId.set(unit.id, actionTime);
        actionQueue.push({
          unit,
          actionTime,
          type: "move",
        });
      };

      const scheduleNextAttack = (unit: BattleUnit) => {
        const attackIntervalMs = getAttackIntervalMs(unit);
        if (attackIntervalMs === null) {
          nextScheduledAttackAtByUnitId.delete(unit.id);
          return;
        }

        scheduleAttackAt(unit, currentTime + attackIntervalMs);
      };

      const scheduleNextMove = (unit: BattleUnit) => {
        const moveIntervalMs = getMoveIntervalMs(unit);
        if (moveIntervalMs === null) {
          nextScheduledMoveAtByUnitId.delete(unit.id);
          return;
        }

        scheduleMoveAt(unit, currentTime + moveIntervalMs);
      };

      const schedulePostMoveAttack = (unit: BattleUnit) => {
        if (unit.attackRange !== 1) {
          return;
        }

        const attackIntervalMs = getAttackIntervalMs(unit);
        if (attackIntervalMs === null) {
          return;
        }

        const desiredAttackTime = currentTime + Math.min(attackIntervalMs, MELEE_POST_MOVE_ATTACK_DELAY_MS);
        const scheduledAttackTime = nextScheduledAttackAtByUnitId.get(unit.id);
        if (scheduledAttackTime === undefined || desiredAttackTime < scheduledAttackTime) {
          scheduleAttackAt(unit, desiredAttackTime);
        }
      };

      const resolveAttackDamage = (
        attacker: BattleUnit,
        target: BattleUnit,
      ): { actualDamage: number; isCrit: boolean; bossPassiveActive: boolean } => {
        executePairSkillsBeforeTakeDamage(target, attacker, combatLog);

        const isCrit = this.rng.nextFloat() < attacker.critRate;
        const bossPassiveActive = isBossPassiveActive(attacker);

        return {
          actualDamage: calculateAttackDamage(attacker, target, isCrit, bossPassiveActive),
          isCrit,
          bossPassiveActive,
        };
      };

      const collectAttackBatch = (firstAction: Action): Action[] => {
        const batch = [firstAction];

        while (
          actionQueue[0]
          && actionQueue[0]!.type === "attack"
          && actionQueue[0]!.actionTime === firstAction.actionTime
        ) {
          batch.push(actionQueue.shift()!);
        }

        return batch;
      };

      const collectMoveBatch = (firstAction: Action): Action[] => {
        const batch = [firstAction];

        while (
          actionQueue[0]
          && actionQueue[0]!.type === "move"
          && actionQueue[0]!.actionTime === firstAction.actionTime
        ) {
          batch.push(actionQueue.shift()!);
        }

        return batch;
      };

      const resolvePendingDeaths = (pendingAttacks: PendingAttack[]): "left" | "right" | null => {
        let pendingWinner: "left" | "right" | null = null;

        for (const pendingAttack of pendingAttacks) {
          const {
            sourceUnit,
            targetUnit,
            unitSide,
            actualDamage,
            remainingHpAfterHit,
            reflectedDamage,
            isCrit,
            bossPassiveActive,
            scarletBossLifestealActive,
          } = pendingAttack;
          const appliedDamageSummary = buildAppliedDamageSummary(
            unitSide,
            targetUnit,
            actualDamage,
            bossBattleSide,
            false,
          );

          timeline.push(createDamageAppliedEvent({
            type: "damageApplied",
            battleId,
            atMs: currentTime,
            sourceBattleUnitId: sourceUnit.id,
            targetBattleUnitId: targetUnit.id,
            amount: actualDamage,
            remainingHp: remainingHpAfterHit,
          }));

          damageDealtLeft += appliedDamageSummary.damageDealtLeftIncrement;
          damageDealtRight += appliedDamageSummary.damageDealtRightIncrement;
          bossDamage += appliedDamageSummary.bossDamageIncrement;
          phaseDamageToBossSide += appliedDamageSummary.phaseDamageIncrement;

          if (reflectedDamage > 0) {
            sourceUnit.hp -= reflectedDamage;
            combatLog.push(
              `${generateUnitName(targetUnit)} reflects ${reflectedDamage} damage to ${generateUnitName(sourceUnit)}`,
            );
          }

          if (bossPassiveActive && actualDamage > 0) {
            const healAmount = Math.floor(actualDamage * 0.05);
            sourceUnit.hp = Math.min(sourceUnit.maxHp, sourceUnit.hp + healAmount);
            if (healAmount > 0) {
              combatLog.push(
                `${generateUnitName(sourceUnit)} Boss Passive heals for ${healAmount} HP (${sourceUnit.hp}/${sourceUnit.maxHp})`,
              );
            }
          }

          if (scarletBossLifestealActive && actualDamage > 0) {
            const healAmount = Math.max(1, Math.floor(actualDamage * 0.1));
            sourceUnit.hp = Math.min(sourceUnit.maxHp, sourceUnit.hp + healAmount);
            combatLog.push(
              `${generateUnitName(sourceUnit)} Scarlet Mansion Synergy lifesteals ${healAmount} HP (${sourceUnit.hp}/${sourceUnit.maxHp})`,
            );
          }

          if (isCrit) {
            combatLog.push(
              `${generateUnitName(sourceUnit)} CRITICAL HIT on ${generateUnitName(targetUnit)} for ${actualDamage} damage!`,
            );
          } else {
            combatLog.push(
              `${generateUnitName(sourceUnit)} attacks ${generateUnitName(targetUnit)} for ${actualDamage} damage (${targetUnit.hp}/${targetUnit.maxHp})`,
            );
          }
        }

        for (const unit of allUnits) {
          if (unit.isDead || unit.hp > 0) {
            continue;
          }

          const defeatConsequences = resolveUnitDefeatConsequences(unit, bossBattleSide);

          if (unit.isBoss) {
            const bossFinisher = pendingAttacks.find((pendingAttack) => pendingAttack.targetUnit.id === unit.id);
            if (bossFinisher && pendingWinner === null) {
              pendingWinner = resolveBossBreakWinner(bossFinisher.unitSide, unit);
              continue;
            }

            const reflectedBossFinisher = pendingAttacks.find((pendingAttack) =>
              pendingAttack.sourceUnit.id === unit.id && pendingAttack.reflectedDamage > 0);
            if (reflectedBossFinisher && pendingWinner === null) {
              pendingWinner = resolveBossBreakWinner(
                resolveBattleSide(reflectedBossFinisher.targetUnit),
                unit,
              );
            }
            continue;
          }

          unit.isDead = true;
          combatLog.push(`${generateUnitName(unit)} has been defeated!`);
          timeline.push(createUnitDeathEvent({
            type: "unitDeath",
            battleId,
            atMs: currentTime,
            battleUnitId: unit.id,
          }));

          phaseDamageToBossSide += defeatConsequences.phaseDamageIncrement;
        }

        return pendingWinner;
      };

      // 全ユニットの初期アクションをキューに追加
      for (const unit of allUnits) {
        scheduleAttackAt(unit, 0);
        if (getMoveIntervalMs(unit) !== null) {
          scheduleMoveAt(unit, 0);
        }
      }

      // ヒーローのスキルを戦闘開始時に発動
      for (const unit of allUnits) {
        if (isHeroBattleUnit(unit)) {
          if (resolveHeroSkillDefinition(unit)) {
            actionQueue.push({
              unit,
              actionTime: 100, // 戦闘開始直後に発動（100ms後）
              type: "skill",
            });
          }
        }
      }

      actionQueue.sort(compareActionOrder);

      // Bug #3 fix: Add iteration counter to prevent infinite loops
      let iterationCount = 0;
      const MAX_ITERATIONS = 10000;

      // 戦闘ループ
      while (currentTime < effectiveMaxDurationMs && hasLivingUnits(leftUnits) && hasLivingUnits(rightUnits)) {
        iterationCount++;
        if (iterationCount > MAX_ITERATIONS) {
          console.error("Battle simulation exceeded max iterations");
          break;
        }
      const action = actionQueue.shift();

      if (!action) {
        break;
      }

      if (action.unit.isDead) {
        continue;
      }

      if (timeoutEnabled && action.actionTime > maxDurationMs) {
        currentTime = maxDurationMs;
        break;
      }

      currentTime = action.actionTime;
      appendDueKeyframes(currentTime);

      if (action.type === "attack") {
        const pendingAttacks: PendingAttack[] = [];
        const attackBatch = collectAttackBatch(action);

        for (const attackAction of attackBatch) {
          if (attackAction.unit.isDead) {
            continue;
          }
          if (nextScheduledAttackAtByUnitId.get(attackAction.unit.id) !== attackAction.actionTime) {
            continue;
          }

          const unitSide = resolveBattleSide(attackAction.unit);
          const enemies = unitSide === "left" ? rightUnits : leftUnits;
          const target = findTarget(attackAction.unit, enemies);

          if (target) {
            timeline.push(createAttackStartEvent({
              type: "attackStart",
              battleId,
              atMs: currentTime,
              sourceBattleUnitId: attackAction.unit.id,
              targetBattleUnitId: target.id,
            }));

            const { actualDamage, isCrit, bossPassiveActive } = resolveAttackDamage(attackAction.unit, target);
            target.hp -= actualDamage;
            pendingAttacks.push({
              sourceUnit: attackAction.unit,
              targetUnit: target,
              unitSide,
              actualDamage,
              remainingHpAfterHit: Math.max(0, target.hp),
              reflectedDamage: calculateReflectedDamage(actualDamage, target.reflectRatio),
              isCrit,
              bossPassiveActive,
              scarletBossLifestealActive: Boolean(
                (unitSide === "left" ? leftScarletBossLifestealActive : rightScarletBossLifestealActive)
                && attackAction.unit.isBoss
              ),
            });

            executePairSkillsAfterAttackHit(attackAction.unit, target, combatLog);

            attackAction.unit.attackCount++;
            scheduleTriggeredSkill(attackAction.unit);
          } else {
            nextScheduledAttackAtByUnitId.delete(attackAction.unit.id);
          }

          scheduleNextAttack(attackAction.unit);
        }

        const forcedAttackWinner = resolvePendingDeaths(pendingAttacks);
        if (forcedAttackWinner) {
          forcedWinner = forcedAttackWinner;
          break;
        }
      } else if (action.type === "move") {
        const moveBatch = collectMoveBatch(action);
        const actionableMoveBatch = moveBatch.filter(
          (moveAction) => nextScheduledMoveAtByUnitId.get(moveAction.unit.id) === moveAction.actionTime,
        );
        const reservedApproachDestinationKeys: Record<"left" | "right", Set<string>> = {
          left: new Set<string>(),
          right: new Set<string>(),
        };
        const plannedApproachDestinationsBySide: Record<
        "left" | "right",
        Map<string, { target: BattleUnit; destination: { x: number; y: number } }>
        > = {
          left: new Map<string, { target: BattleUnit; destination: { x: number; y: number } }>(),
          right: new Map<string, { target: BattleUnit; destination: { x: number; y: number } }>(),
        };
        const plannedApproachGroupDiagnosticsBySide: Record<
        "left" | "right",
        Map<string, {
          target: BattleUnit;
          competitorCount: number;
          assignedCount: number;
        }>
        > = {
          left: new Map<string, {
            target: BattleUnit;
            competitorCount: number;
            assignedCount: number;
          }>(),
          right: new Map<string, {
            target: BattleUnit;
            competitorCount: number;
            assignedCount: number;
          }>(),
        };
        const plannedApproachDestinationKeysBySide: Record<"left" | "right", Set<string>> = {
          left: new Set<string>(),
          right: new Set<string>(),
        };

        for (const unitSide of ["left", "right"] as const) {
          const allies = unitSide === "left" ? leftUnits : rightUnits;
          const enemies = unitSide === "left" ? rightUnits : leftUnits;
          const groupedAttackers = new Map<string, { target: BattleUnit; attackers: BattleUnit[] }>();

          for (const moveAction of actionableMoveBatch) {
            if (resolveBattleSide(moveAction.unit) !== unitSide || moveAction.unit.attackRange !== 1) {
              continue;
            }

            if (findTarget(moveAction.unit, enemies)) {
              continue;
            }

            const approachTarget = findBestApproachTarget(moveAction.unit, enemies, allies)
              ?? findClosestLivingEnemy(moveAction.unit, enemies);
            if (!approachTarget) {
              continue;
            }

            const existingGroup = groupedAttackers.get(approachTarget.id);
            if (existingGroup) {
              existingGroup.attackers.push(moveAction.unit);
            } else {
              groupedAttackers.set(approachTarget.id, {
                target: approachTarget,
                attackers: [moveAction.unit],
              });
            }
          }

          for (const { target, attackers } of groupedAttackers.values()) {
            const assignments = assignApproachDestinationsForTarget(
              attackers,
              target,
              allies,
              enemies,
              plannedApproachDestinationKeysBySide[unitSide],
            );
            const competitorCount = attackers.length;
            const assignedCount = assignments.size;

            for (const attacker of attackers) {
              plannedApproachGroupDiagnosticsBySide[unitSide].set(attacker.id, {
                target,
                competitorCount,
                assignedCount,
              });
            }

            for (const attacker of attackers) {
              const destination = assignments.get(attacker.id);
              if (!destination) {
                continue;
              }

              plannedApproachDestinationsBySide[unitSide].set(attacker.id, {
                target,
                destination,
              });
              plannedApproachDestinationKeysBySide[unitSide].add(coordinateKey(destination));
            }
          }
        }

        for (const moveAction of moveBatch) {
          if (nextScheduledMoveAtByUnitId.get(moveAction.unit.id) !== moveAction.actionTime) {
            continue;
          }

          const unitSide = resolveBattleSide(moveAction.unit);
          const enemies = unitSide === "left" ? rightUnits : leftUnits;
          const allies = unitSide === "left" ? leftUnits : rightUnits;
          const target = findTarget(moveAction.unit, enemies);
          const plannedApproach = plannedApproachDestinationsBySide[unitSide].get(moveAction.unit.id);
          const plannedApproachGroupDiagnostics = plannedApproachGroupDiagnosticsBySide[unitSide].get(
            moveAction.unit.id,
          );
          const moveDiagnostics = target == null
            ? resolveMoveActionDiagnostics(moveAction.unit, allies, enemies)
            : null;
          let moveExecutionResult: ReturnType<typeof moveUnitBySimpleApproach> | null = null;

          if (!target) {
            const previousCell = moveAction.unit.cell;
            const blockedApproachDestinationKeys = new Set<string>([
              ...reservedApproachDestinationKeys[unitSide],
              ...plannedApproachDestinationKeysBySide[unitSide],
            ]);
            if (plannedApproach) {
              blockedApproachDestinationKeys.delete(coordinateKey(plannedApproach.destination));
            }
            moveExecutionResult = moveUnitBySimpleApproach(
              moveAction.unit,
              allies,
              enemies,
              combatLog,
              plannedApproach?.target ?? moveDiagnostics?.pursuedTarget ?? null,
              blockedApproachDestinationKeys,
              plannedApproach?.destination ?? null,
            );
            if (moveExecutionResult.moved && moveAction.unit.cell !== previousCell) {
              timeline.push(createMoveEvent({
                type: "move",
                battleId,
                atMs: currentTime,
                battleUnitId: moveAction.unit.id,
                from: resolveTimelineCoordinate({ ...moveAction.unit, cell: previousCell }),
                to: resolveTimelineCoordinate(moveAction.unit),
                ...(moveDiagnostics?.pursuedTarget
                  ? { pursuedTargetBattleUnitId: moveDiagnostics.pursuedTarget.id }
                  : {}),
                ...(moveDiagnostics?.bestApproachTarget
                  ? { bestApproachTargetBattleUnitId: moveDiagnostics.bestApproachTarget.id }
                  : {}),
                ...(plannedApproachGroupDiagnostics
                  ? {
                    plannedApproachGroupTargetBattleUnitId: plannedApproachGroupDiagnostics.target.id,
                    plannedApproachGroupCompetitorCountBeforeMove:
                      plannedApproachGroupDiagnostics.competitorCount,
                    plannedApproachGroupAssignedCountBeforeMove:
                      plannedApproachGroupDiagnostics.assignedCount,
                  }
                  : {}),
                ...(plannedApproach
                  ? {
                    plannedApproachTargetBattleUnitId: plannedApproach.target.id,
                    usedPlannedApproachDestination: moveExecutionResult.usedPlannedApproachDestination,
                    plannedApproachDestinationPathBlockedBeforeMove:
                      moveExecutionResult.plannedApproachDestinationPathBlockedBeforeMove,
                    ...(moveExecutionResult.plannedApproachDestinationPathBlockerTypeBeforeMove != null
                      ? {
                        plannedApproachDestinationPathBlockerTypeBeforeMove:
                          moveExecutionResult.plannedApproachDestinationPathBlockerTypeBeforeMove,
                      }
                      : {}),
                    ...(moveExecutionResult.plannedApproachDestinationRouteChokeTypeBeforeMove != null
                      ? {
                        plannedApproachDestinationRouteChokeTypeBeforeMove:
                          moveExecutionResult.plannedApproachDestinationRouteChokeTypeBeforeMove,
                      }
                      : {}),
                  }
                  : {}),
                ...(plannedApproach && moveExecutionResult.plannedDestinationStillOpenBeforeMove != null
                  ? {
                    plannedApproachDestinationStillOpenBeforeMove:
                      moveExecutionResult.plannedDestinationStillOpenBeforeMove,
                  }
                  : {}),
                pursuedTargetDistanceBeforeMove: moveDiagnostics?.pursuedTargetDistanceBeforeMove ?? null,
                bestApproachTargetDistanceBeforeMove: moveDiagnostics?.bestApproachTargetDistanceBeforeMove ?? null,
                pursuedTargetRequiredStepsBeforeMove: moveDiagnostics?.pursuedTargetRequiredStepsBeforeMove ?? null,
                bestApproachTargetRequiredStepsBeforeMove: moveDiagnostics?.bestApproachTargetRequiredStepsBeforeMove ?? null,
              }));
            }
          }

          if (moveExecutionResult?.moved) {
            schedulePostMoveAttack(moveAction.unit);
          }
          scheduleNextMove(moveAction.unit);
        }
      } else if (action.type === "skill") {
        // ヒーローユニットかどうかを判定
        const isHero = isHeroBattleUnit(action.unit);
        let skillExecuted = false;

        if (isHero) {
          // ヒーロースキルを使用（sourceUnitId 優先でヒーロー定義を解決）
          const resolvedHeroSkill = resolveHeroSkillDefinition(action.unit);
          if (!resolvedHeroSkill) {
            if (!resolveHeroId(action.unit)) {
              console.error(`Invalid hero ID for unit: ${action.unit.id}`);
            }
            continue;
          }
          const { heroId, skillDef: heroSkillDef } = resolvedHeroSkill;
          if (heroSkillDef && heroSkillDef.execute) {
            const isLeftSide = leftUnits.includes(action.unit);
            const allies = isLeftSide ? leftUnits : rightUnits;
            const enemies = isLeftSide ? rightUnits : leftUnits;
            const enemyHpBefore = new Map(enemies.map((enemy) => [enemy.id, enemy.hp]));

            try {
              heroSkillDef.execute(action.unit, allies, enemies, combatLog);
              skillExecuted = true;
            } catch (error) {
              console.error(`Error executing hero skill for ${heroId}:`, error);
              combatLog.push(`Error executing hero skill for ${heroId}`);
            }

            const forcedSkillWinner = recordSkillDamageAgainstEnemies(
              action.unit,
              enemies,
              enemyHpBefore,
            );
            if (forcedSkillWinner) {
              forcedWinner = forcedSkillWinner;
              break;
            }
          }
        } else {
          // 通常ユニットのスキルを使用
          const skillDef = resolveUnitSkillDefinition(action.unit);
          if (skillDef && skillDef.execute) {
            const isLeftSide = leftUnits.includes(action.unit);
            const allies = isLeftSide ? leftUnits : rightUnits;
            const enemies = isLeftSide ? rightUnits : leftUnits;
            const enemyHpBefore = new Map(enemies.map((enemy) => [enemy.id, enemy.hp]));

            try {
              skillDef.execute(action.unit, allies, enemies, combatLog);
              skillExecuted = true;
            } catch (error) {
              console.error(`Error executing skill for ${action.unit.type}:`, error);
              combatLog.push(`Error executing skill for ${action.unit.type}`);
            }

            const forcedSkillWinner = recordSkillDamageAgainstEnemies(
              action.unit,
              enemies,
              enemyHpBefore,
            );
            if (forcedSkillWinner) {
              forcedWinner = forcedSkillWinner;
              break;
            }
          }
        }
      }

      actionQueue.sort(compareActionOrder);
    }

      const result = this.determineBattleResult(
        leftUnits, 
        rightUnits, 
        currentTime, 
      maxDurationMs,
      timeoutEnabled,
      timeline,
        combatLog,
        damageDealtLeft, 
        damageDealtRight,
        bossDamage,
        phaseDamageToBossSide,
        forcedWinner,
      );

    return result;
    } catch (error) {
      console.error("Battle simulation error:", error);
      // Return a draw result on error (Bug #3 fix)
      const result: BattleResult = {
        winner: "draw",
        endReason: "unexpected",
        leftSurvivors: leftUnits ? leftUnits.filter(u => !u.isDead) : [],
        rightSurvivors: rightUnits ? rightUnits.filter(u => !u.isDead) : [],
        timeline: [],
        combatLog: ["Battle error occurred"],
        durationMs: 0,
        damageDealt: {
          left: 0,
          right: 0,
        },
      };
      return result;
    }
  }

  /**
   * 戦闘結果を判定
   * @param leftUnits 左側ユニット
   * @param rightUnits 右側ユニット
   * @param currentTime 現在の戦闘時間
   * @param maxDurationMs 最大戦闘時間
   * @param combatLog 戦闘ログ
   * @param damageDealtLeft 左チームが与えたダメージ
   * @param damageDealtRight 右チームが与えたダメージ
   * @param bossDamage ボスが受けたダメージ
   * @param phaseDamageToBossSide フェーズHPに入る累計ダメージ
   * @returns 戦闘結果
   */
  private determineBattleResult(
    leftUnits: BattleUnit[],
    rightUnits: BattleUnit[],
    currentTime: number,
    maxDurationMs: number,
    timeoutEnabled: boolean,
    timeline: BattleTimelineEvent[],
    combatLog: string[],
    damageDealtLeft: number,
    damageDealtRight: number,
    bossDamage: number = 0,
    phaseDamageToBossSide: number = 0,
    forcedWinner: "left" | "right" | null = null,
  ): BattleResult {
    // BattleResult の基本オブジェクトを作成（bossDamage は条件付きで追加）
    const createResult = (
      winner: "left" | "right" | "draw",
      endReason: BattleTimelineEndReason,
    ): BattleResult => {
      const leftSurvivors = leftUnits.filter((unit) => !unit.isDead);
      const rightSurvivors = rightUnits.filter((unit) => !unit.isDead);
      const baseResult = {
        winner,
        endReason,
        leftSurvivors,
        rightSurvivors,
        timeline: [
          ...timeline,
          createBattleEndEvent({
            type: "battleEnd",
            battleId: timeline[0]?.battleId ?? "battle-unknown",
            atMs: currentTime,
            winner: resolveTimelineWinner(winner),
            endReason,
          }),
        ],
        combatLog,
        durationMs: currentTime,
        damageDealt: {
          left: damageDealtLeft,
          right: damageDealtRight,
        },
      };
      
      if (phaseDamageToBossSide > 0) {
        return { ...baseResult, bossDamage, phaseDamageToBossSide };
      }

      if (bossDamage > 0) {
        return { ...baseResult, bossDamage };
      }
      return baseResult;
    };
    const leftSurvivors = leftUnits.filter((unit) => !unit.isDead);
    const rightSurvivors = rightUnits.filter((unit) => !unit.isDead);

    if (forcedWinner) {
      return createResult(forcedWinner, "forced");
    }

    if (leftSurvivors.length === 0 && rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Draw (all units defeated)");
      return createResult("draw", "mutual_annihilation");
    }

    if (leftSurvivors.length === 0) {
      combatLog.push("Battle ended: Right wins");
      return createResult("right", "annihilation");
    }

    if (rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Left wins");
      return createResult("left", "annihilation");
    }

    // 時間制限に達した場合
    if (timeoutEnabled && currentTime >= maxDurationMs) {
      const leftTotalHp = leftSurvivors.reduce((sum, unit) => sum + unit.hp, 0);
      const rightTotalHp = rightSurvivors.reduce((sum, unit) => sum + unit.hp, 0);

      if (leftTotalHp > rightTotalHp) {
        combatLog.push(`Battle ended: Left wins (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return createResult("left", "timeout_hp_lead");
      } else if (rightTotalHp > leftTotalHp) {
        combatLog.push(`Battle ended: Right wins (HP: ${rightTotalHp} vs ${leftTotalHp})`);
        return createResult("right", "timeout_hp_lead");
      } else {
        combatLog.push(`Battle ended: Draw (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return createResult("draw", "timeout_hp_tie");
      }
    }

    combatLog.push("Battle ended: Unexpected termination");
    return createResult("draw", "unexpected");
  }
}

/**
 * ボスダメージ結果を計算
 * ボス戦のダメージに基づいて成功判定とオーバーキル量を計算
 * @param bossMaxHp ボスの最大HP
 * @param damageDealt ボスに与えたダメージ
 * @returns 成功判定とオーバーキル量
 */
export function calculateBossDamageResult(
  bossMaxHp: number,
  damageDealt: number,
): { success: boolean; overkill: number } {
  if (damageDealt >= bossMaxHp) {
    return {
      success: true,
      overkill: damageDealt - bossMaxHp,
    };
  } else {
    return {
      success: false,
      overkill: 0,
    };
  }
}
