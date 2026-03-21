import type {
  BattleKeyframeUnitState,
  BattleStartUnitSnapshot,
  BattleTimelineEvent,
  BattleTimelineSide,
  BoardUnitPlacement,
  BoardUnitType,
} from "../../shared/room-messages";
import { getMvpPhase1Boss, type SubUnitConfig } from "../../shared/types";
import { DEFAULT_FLAGS, type FeatureFlags } from "../../shared/feature-flags";
import { DEFAULT_SHARED_BOARD_CONFIG } from "../../shared/shared-board-config";
import {
  combatCellToBossBoardIndex,
  combatCellToRaidBoardIndex,
  sharedBoardCoordinateToIndex,
  sharedBoardIndexToCoordinate,
} from "../../shared/board-geometry";
import { getStarCombatMultiplier } from "../star-level-config";
import { SKILL_DEFINITIONS, HERO_SKILL_DEFINITIONS } from "./skill-definitions";
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
import { ITEM_DEFINITIONS, ItemType } from "./item-definitions";
import { getScarletMansionUnitById } from "../../data/scarlet-mansion-units";
import { HEROES } from "../../data/heroes";
import { resolveBattlePlacement } from "../unit-id-resolver";
import {
  createAttackStartEvent,
  createBattleEndEvent,
  createBattleStartEvent,
  createDamageAppliedEvent,
  createKeyframeEvent,
  createMoveEvent,
  createUnitDeathEvent,
} from "./battle-timeline";

/**
 * アクションインターフェース
 * 戦闘中のユニットアクションを表現
 */
export interface Action {
  unit: BattleUnit;
  actionTime: number;
  type: "attack" | "skill";
}

/**
 * 戦闘シミュレーション用ユニット
 * 戦闘中のユニット状態を表現
 */
export interface BattleUnit {
  id: string;
  sourceUnitId?: string;
  type: BoardUnitType;
  starLevel: number;
  hp: number;
  maxHp: number;
  attackPower: number;
  attackSpeed: number; // 1秒あたりの攻撃回数（0.5 = 2秒に1回攻撃）
  attackRange: number; // 1 = 近接, 2+ = 遠距離
  cell: number; // 0-7 のボード位置
  isDead: boolean;
  isBoss?: boolean; // ボスフラグ（ボス戦時のみ）
  attackCount: number; // スキルトリガー用の攻撃回数トラッキング
  defense: number; // ベース防御力（被ダメージを軽減）
  critRate: number; // 0.0-1.0, クリティカルヒット率
  critDamageMultiplier: number; // 1.5 = 150% クリティカルダメージ
  physicalReduction: number | undefined; // 物理ダメージ軽減率（0-100）
  magicReduction: number | undefined; // 魔法ダメージ軽減率（0-100）
  buffModifiers: {
    attackMultiplier: number; // デフォルト 1.0
    defenseMultiplier: number; // デフォルト 1.0
    attackSpeedMultiplier: number; // デフォルト 1.0
  };
  reflectRatio?: number;
  ultimateDamageMultiplier?: number;
  bonusDamageVsDebuffedTarget?: number;
  debuffImmunityCategories?: string[];
}

/**
 * 戦闘結果
 * 戦闘の結果を含む情報
 */
export interface BattleResult {
  winner: "left" | "right" | "draw";
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
}

/**
 * ユニットタイプ別の基本ステータス
 */
interface BaseUnitStats {
  hp: number;
  attack: number;
  attackSpeed: number;
  range: number;
}

const BASE_STATS: Readonly<Record<BoardUnitType, BaseUnitStats>> = {
  vanguard: { hp: 80, attack: 4, attackSpeed: 0.5, range: 1 },
  ranger: { hp: 50, attack: 5, attackSpeed: 0.8, range: 3 },
  mage: { hp: 40, attack: 6, attackSpeed: 0.6, range: 2 },
  assassin: { hp: 45, attack: 5, attackSpeed: 1.0, range: 1 },
};

function resolveTimelineSide(unit: BattleUnit): BattleTimelineSide {
  return resolveBattleSide(unit) === "left" ? "raid" : "boss";
}

function resolveBattleSide(unit: BattleUnit): "left" | "right" {
  if (unit.isBoss) {
    return "right";
  }

  if (unit.id.startsWith("left") || unit.id.startsWith("hero-")) {
    return "left";
  }

  return "right";
}

function isLegacyCombatCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell <= 7;
}

function resolveBoardIndexForCell(cell: number, side: "left" | "right"): number {
  if (!Number.isInteger(cell)) {
    throw new Error("battle board cell index must be an integer");
  }

  if (isLegacyCombatCell(cell)) {
    return side === "left"
      ? combatCellToRaidBoardIndex(cell)
      : combatCellToBossBoardIndex(cell);
  }

  if (cell >= 0 && cell < DEFAULT_SHARED_BOARD_CONFIG.width * DEFAULT_SHARED_BOARD_CONFIG.height) {
    return cell;
  }

  throw new Error("battle board cell index out of range");
}

function resolveTimelineCoordinate(unit: BattleUnit): { x: number; y: number } {
  return sharedBoardIndexToCoordinate(
    resolveBoardIndexForCell(unit.cell, resolveBattleSide(unit)),
    DEFAULT_SHARED_BOARD_CONFIG,
  );
}

function buildBattleStartSnapshot(unit: BattleUnit): BattleStartUnitSnapshot {
  const coordinate = resolveTimelineCoordinate(unit);

  return {
    battleUnitId: unit.id,
    side: resolveTimelineSide(unit),
    x: coordinate.x,
    y: coordinate.y,
    currentHp: unit.hp,
    maxHp: unit.maxHp,
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
    starLevel = 1,
    cell,
    archetype,
    hp: resolvedHp,
    attack: resolvedAttack,
    attackSpeed: resolvedAttackSpeed,
    range: resolvedRange,
  } = resolvedPlacement;
  const baseStats = BASE_STATS[unitType];
  const bossStats = isBoss && archetype === "remilia" ? getMvpPhase1Boss() : null;

  // Scarlet Mansionユニットの特殊ステータスをチェック
  let finalHp: number;
  let finalAttack: number;
  let finalAttackSpeed: number;
  let finalRange: number;
  let finalDefense: number;
  let finalPhysicalReduction: number | undefined = undefined;
  let finalMagicReduction: number | undefined = undefined;

  if (bossStats) {
    // ボス（remilia）の場合、ボスステータスを適用
    finalHp = bossStats.hp;
    finalAttack = bossStats.attack;
    finalAttackSpeed = bossStats.attackSpeed;
    finalRange = bossStats.range;
    finalDefense = 0; // ボスは reduction を使用
    finalPhysicalReduction = bossStats.physicalReduction;
    finalMagicReduction = bossStats.magicReduction;
  } else if (archetype && ["meiling", "sakuya", "patchouli"].includes(archetype)) {
    // Scarlet Mansionユニットの場合、特殊ステータスを適用
    const scarletUnit = getScarletMansionUnitById(archetype);
    if (scarletUnit) {
      finalHp = scarletUnit.hp;
      finalAttack = scarletUnit.attack;
      finalAttackSpeed = scarletUnit.attackSpeed;
      finalRange = scarletUnit.range;
      // 物理軽減と魔法軽減の平均を防御力として適用
      finalDefense = (scarletUnit.physicalReduction + scarletUnit.magicReduction) / 2;
      finalPhysicalReduction = scarletUnit.physicalReduction;
      finalMagicReduction = scarletUnit.magicReduction;
    } else {
      // フォールバック: 通常ステータスを使用
      const starMultiplier = isBoss ? 1.0 : getStarCombatMultiplier(starLevel);
      finalHp = baseStats.hp * starMultiplier;
      finalAttack = baseStats.attack * starMultiplier;
      finalAttackSpeed = baseStats.attackSpeed;
      finalRange = baseStats.range;
      finalDefense = unitType === "vanguard" ? 3 : 0;
    }
  } else {
    // 通常ユニット: 星レベル倍率を適用
    const starMultiplier = isBoss ? 1.0 : getStarCombatMultiplier(starLevel);
    finalHp = (resolvedHp ?? baseStats.hp) * starMultiplier;
    finalAttack = (resolvedAttack ?? baseStats.attack) * starMultiplier;
    finalAttackSpeed = resolvedAttackSpeed ?? baseStats.attackSpeed;
    finalRange = resolvedRange ?? baseStats.range;
    finalDefense = unitType === "vanguard" ? 3 : 0;
  }

  return {
    id: `${side}-${unitType}-${index}`,
    sourceUnitId: resolvedPlacement.unitId ?? `${side}-${unitType}-${index}`,
    type: unitType,
    starLevel,
    hp: finalHp,
    maxHp: finalHp,
    attackPower: finalAttack,
    attackSpeed: finalAttackSpeed,
    attackRange: finalRange,
    cell,
    isDead: false,
    isBoss,
    attackCount: 0,
    defense: finalDefense,
    critRate: 0,
    critDamageMultiplier: 1.5,
    physicalReduction: finalPhysicalReduction,
    magicReduction: finalMagicReduction,
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
  if (isLegacyCombatCell(cell1) && isLegacyCombatCell(cell2)) {
    return Math.abs(cell1 - cell2);
  }

  const coordinate1 = sharedBoardIndexToCoordinate(
    resolveBoardIndexForCell(cell1, side1 ?? "left"),
    DEFAULT_SHARED_BOARD_CONFIG,
  );
  const coordinate2 = sharedBoardIndexToCoordinate(
    resolveBoardIndexForCell(cell2, side2 ?? "right"),
    DEFAULT_SHARED_BOARD_CONFIG,
  );
  return Math.abs(coordinate1.x - coordinate2.x) + Math.abs(coordinate1.y - coordinate2.y);
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

    if (distance <= attacker.attackRange && distance < minDistance) {
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
    if (distance < minDistance) {
      minDistance = distance;
      closestTarget = enemy;
    }
  }

  return closestTarget;
}

function moveUnitBySimpleApproach(
  unit: BattleUnit,
  enemies: BattleUnit[],
  combatLog: string[],
): boolean {
  const nearestEnemy = findClosestLivingEnemy(unit, enemies);
  if (!nearestEnemy) {
    return false;
  }

  const unitSide = resolveBattleSide(unit);
  const enemySide = resolveBattleSide(nearestEnemy);
  const currentDistance = calculateCellDistance(unit.cell, nearestEnemy.cell, unitSide, enemySide);
  if (currentDistance <= unit.attackRange) {
    return false;
  }

  const previousCell = unit.cell;
  if (isLegacyCombatCell(unit.cell) && isLegacyCombatCell(nearestEnemy.cell)) {
    if (unit.cell < nearestEnemy.cell) {
      unit.cell += 1;
    } else if (unit.cell > nearestEnemy.cell) {
      unit.cell -= 1;
    } else {
      return false;
    }
  } else {
    const currentCoordinate = sharedBoardIndexToCoordinate(
      resolveBoardIndexForCell(unit.cell, unitSide),
      DEFAULT_SHARED_BOARD_CONFIG,
    );
    const targetCoordinate = sharedBoardIndexToCoordinate(
      resolveBoardIndexForCell(nearestEnemy.cell, enemySide),
      DEFAULT_SHARED_BOARD_CONFIG,
    );
    const deltaX = targetCoordinate.x - currentCoordinate.x;
    const deltaY = targetCoordinate.y - currentCoordinate.y;

    const nextCoordinate = { ...currentCoordinate };
    if (Math.abs(deltaX) >= Math.abs(deltaY) && deltaX !== 0) {
      nextCoordinate.x += Math.sign(deltaX);
    } else if (deltaY !== 0) {
      nextCoordinate.y += Math.sign(deltaY);
    } else {
      return false;
    }

    unit.cell = sharedBoardCoordinateToIndex(nextCoordinate, DEFAULT_SHARED_BOARD_CONFIG);
  }

  const sideLabel = unit.id.startsWith("left") ? "Left" : "Right";
  const typeLabel = unit.type.charAt(0).toUpperCase() + unit.type.slice(1);
  combatLog.push(
    `${sideLabel} ${typeLabel} moves from cell ${previousCell} to cell ${unit.cell}`,
  );

  return true;
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
      unit.defense += defenseValue;
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
 * アイテム効果をユニットに適用
 * @param unit ユニット
 * @param items 装備されているアイテムの配列
 */
function applyItemEffects(unit: BattleUnit, items: ItemType[]): void {
  for (const itemType of items) {
    const itemDef = ITEM_DEFINITIONS[itemType];

    if (!itemDef || !itemDef.effects) {
      console.warn(`Invalid item definition for: ${itemType}`);
      continue;
    }

    if (itemDef.effects.attackPower !== undefined) {
      unit.attackPower += itemDef.effects.attackPower;
    }
    if (itemDef.effects.defense !== undefined) {
      unit.defense += itemDef.effects.defense;
    }
    if (itemDef.effects.attackSpeedMultiplier !== undefined) {
      unit.buffModifiers.attackSpeedMultiplier += itemDef.effects.attackSpeedMultiplier;
    }
    if (itemDef.effects.critRate !== undefined) {
      unit.critRate += itemDef.effects.critRate;
    }
    if (itemDef.effects.hpMultiplier !== undefined) {
      const multiplier = 1 + itemDef.effects.hpMultiplier;
      unit.maxHp = Math.floor(unit.maxHp * multiplier);
      unit.hp = Math.floor(unit.hp * multiplier);
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
  const sideLabel = unit.id.startsWith("left") ? "Left" : "Right";
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
  ): BattleResult {
    try {
      // Bug #3 fix: Validate input teams
      if (!leftUnits || leftUnits.length === 0 || !rightUnits || rightUnits.length === 0) {
        console.warn("Battle simulation with empty teams");
        const isBothEmpty = (!leftUnits || leftUnits.length === 0) && (!rightUnits || rightUnits.length === 0);
        const result: BattleResult = {
          winner: leftUnits.length > 0 ? "left" : rightUnits.length > 0 ? "right" : "draw",
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
        round: 0,
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

      // アイテム効果を適用
      for (let i = 0; i < leftUnits.length; i++) {
        const unit = leftUnits[i];
        if (unit) {
          const items = leftPlacements[i]?.items || [];
          applyItemEffects(unit, items);
        }
      }
      for (let i = 0; i < rightUnits.length; i++) {
        const unit = rightUnits[i];
        if (unit) {
          const items = rightPlacements[i]?.items || [];
          applyItemEffects(unit, items);
        }
      }

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

      const allUnits = [...leftUnits, ...rightUnits];
      const actionQueue: Action[] = [];
      let currentTime = 0;

      // ダメージ追跡用変数
      let damageDealtLeft = 0;  // 左チームが与えたダメージ
      let damageDealtRight = 0; // 右チームが与えたダメージ
      let bossDamage = 0;       // ボスが受けたダメージ
      let nextKeyframeAtMs = 250;

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

      // 全ユニットの初期アクションをキューに追加
      for (const unit of allUnits) {
        actionQueue.push({
          unit,
          actionTime: 0,
          type: "attack",
        });
      }

      // ヒーローのスキルを戦闘開始時に発動
      for (const unit of allUnits) {
        if (unit.id.startsWith("hero-")) {
          // ヒーローのIDからヒーローを取得して、スキルが定義されているか確認
          const heroId = unit.id.replace("hero-", "").split("-")[0];
          if (heroId && HERO_SKILL_DEFINITIONS[heroId]) {
            actionQueue.push({
              unit,
              actionTime: 100, // 戦闘開始直後に発動（100ms後）
              type: "skill",
            });
          }
        }
      }

      actionQueue.sort((a, b) => a.actionTime - b.actionTime);

      // Bug #3 fix: Add iteration counter to prevent infinite loops
      let iterationCount = 0;
      const MAX_ITERATIONS = 10000;

      // 戦闘ループ
      while (currentTime < maxDurationMs && hasLivingUnits(leftUnits) && hasLivingUnits(rightUnits)) {
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

      currentTime = action.actionTime;
      appendDueKeyframes(currentTime);

      if (action.type === "attack") {
        const enemies = action.unit.id.startsWith("left") ? rightUnits : leftUnits;
        const target = findTarget(action.unit, enemies);

        if (target) {
          timeline.push(createAttackStartEvent({
            type: "attackStart",
            battleId,
            atMs: currentTime,
            sourceBattleUnitId: action.unit.id,
            targetBattleUnitId: target.id,
          }));
          // クリティカルヒット判定
          const isCrit = Math.random() < action.unit.critRate;
          const critMultiplier = isCrit ? action.unit.critDamageMultiplier : 1.0;

          // ボスパッシブ「紅色の世界」の判定とATKバフ適用
          const bossPassiveActive = isBossPassiveActive(action.unit);
          const bossAtkMultiplier = bossPassiveActive ? 1.2 : 1.0;

          // 防御力とバフモディファイアとクリティカルとボスパッシブを適用したダメージ計算
          const baseDamage = action.unit.attackPower * action.unit.buffModifiers.attackMultiplier * critMultiplier * bossAtkMultiplier;
          const defense = target.defense * target.buffModifiers.defenseMultiplier;
          let actualDamage = Math.max(1, Math.floor(baseDamage - defense));

          // 物理軽減と魔法軽減を適用（ボスユニットの場合）
          if (action.unit.type === "mage" && target.magicReduction !== undefined) {
            // 魔法攻撃の場合は魔法軽減を適用
            actualDamage = Math.max(1, Math.floor(actualDamage * (1 - target.magicReduction / 100)));
          } else if (target.physicalReduction !== undefined) {
            // 物理攻撃の場合は物理軽減を適用
            actualDamage = Math.max(1, Math.floor(actualDamage * (1 - target.physicalReduction / 100)));
          }

          target.hp -= actualDamage;
          timeline.push(createDamageAppliedEvent({
            type: "damageApplied",
            battleId,
            atMs: currentTime,
            sourceBattleUnitId: action.unit.id,
            targetBattleUnitId: target.id,
            amount: actualDamage,
            remainingHp: Math.max(0, target.hp),
          }));

          if ((target.reflectRatio ?? 0) > 0 && actualDamage > 0) {
            const reflectedDamage = Math.max(1, Math.floor(actualDamage * (target.reflectRatio ?? 0)));
            action.unit.hp -= reflectedDamage;
            combatLog.push(
              `${generateUnitName(target)} reflects ${reflectedDamage} damage to ${generateUnitName(action.unit)}`,
            );

            if (action.unit.hp <= 0) {
              action.unit.isDead = true;
              combatLog.push(`${generateUnitName(action.unit)} has been defeated!`);
              timeline.push(createUnitDeathEvent({
                type: "unitDeath",
                battleId,
                atMs: currentTime,
                battleUnitId: action.unit.id,
              }));
            }
          }

          // ボスパッシブ「紅色の世界」の回復効果（与えたダメージの5%回復）
          if (bossPassiveActive && actualDamage > 0) {
            const healAmount = Math.floor(actualDamage * 0.05);
            action.unit.hp = Math.min(action.unit.maxHp, action.unit.hp + healAmount);
            if (healAmount > 0) {
              combatLog.push(
                `${generateUnitName(action.unit)} Boss Passive heals for ${healAmount} HP (${action.unit.hp}/${action.unit.maxHp})`,
              );
            }
          }

          const scarletBossLifestealActive = action.unit.id.startsWith("left")
            ? leftScarletBossLifestealActive
            : rightScarletBossLifestealActive;
          const canTriggerScarletBossLifesteal = scarletBossLifestealActive
            && action.unit.isBoss
            && actualDamage > 0;

          if (canTriggerScarletBossLifesteal) {
            const healAmount = Math.max(1, Math.floor(actualDamage * 0.1));
            action.unit.hp = Math.min(action.unit.maxHp, action.unit.hp + healAmount);
            combatLog.push(
              `${generateUnitName(action.unit)} Scarlet Mansion Synergy lifesteals ${healAmount} HP (${action.unit.hp}/${action.unit.maxHp})`,
            );
          }

          // ダメージ追跡
          const isAttackerLeft = action.unit.id.startsWith("left");
          if (isAttackerLeft) {
            damageDealtLeft += actualDamage;
          } else {
            damageDealtRight += actualDamage;
          }

          // ボスダメージ記録
          if (target.isBoss) {
            bossDamage += actualDamage;
          }

          if (isCrit) {
            combatLog.push(
              `${generateUnitName(action.unit)} CRITICAL HIT on ${generateUnitName(target)} for ${actualDamage} damage!`,
            );
          } else {
            combatLog.push(
              `${generateUnitName(action.unit)} attacks ${generateUnitName(target)} for ${actualDamage} damage (${target.hp}/${target.maxHp})`,
            );
          }

          if (target.hp <= 0) {
            target.isDead = true;
            combatLog.push(`${generateUnitName(target)} has been defeated!`);
            timeline.push(createUnitDeathEvent({
              type: "unitDeath",
              battleId,
              atMs: currentTime,
              battleUnitId: target.id,
            }));
          }

          // 攻撃カウントを増加
      action.unit.attackCount++;

      // スキルトリガーのチェック
      const skillDef = SKILL_DEFINITIONS[action.unit.type];
      if (skillDef && skillDef.triggerType === 'on_attack_count' &&
          skillDef.triggerCount !== undefined &&
          action.unit.attackCount % skillDef.triggerCount === 0) {
        // スキルを即座にスケジュール
        actionQueue.push({
          unit: action.unit,
          actionTime: currentTime,
          type: 'skill'
        });
      }

      // 次の攻撃をスケジュール（0でない場合）
          if (action.unit.attackSpeed > 0) {
            const nextAttackTime = currentTime + (1000 / (action.unit.attackSpeed * action.unit.buffModifiers.attackSpeedMultiplier));
            actionQueue.push({
              unit: action.unit,
              actionTime: nextAttackTime,
              type: "attack",
            });
          }
        } else {
          const isRaidBattle = leftUnits.some((unit) => unit.isBoss) || rightUnits.some((unit) => unit.isBoss);
          if (flags.enableBossExclusiveShop && isRaidBattle) {
            const previousCell = action.unit.cell;
            moveUnitBySimpleApproach(action.unit, enemies, combatLog);
            if (action.unit.cell !== previousCell) {
              timeline.push(createMoveEvent({
                type: "move",
                battleId,
                atMs: currentTime,
                battleUnitId: action.unit.id,
                from: resolveTimelineCoordinate({ ...action.unit, cell: previousCell }),
                to: resolveTimelineCoordinate(action.unit),
              }));
            }
          }

          // 攻撃カウントを増加（ターゲットが見つからない場合も）
          action.unit.attackCount++;

          // 次の攻撃をスケジュール
          if (action.unit.attackSpeed > 0) {
            const nextAttackTime = currentTime + (1000 / (action.unit.attackSpeed * action.unit.buffModifiers.attackSpeedMultiplier));
            actionQueue.push({
              unit: action.unit,
              actionTime: nextAttackTime,
              type: "attack",
            });
          }
        }
      } else if (action.type === "skill") {
        // ヒーローユニットかどうかを判定
        const isHero = action.unit.id.startsWith("hero-");
        let skillExecuted = false;

        if (isHero) {
          // ヒーロースキルを使用（ヒーローIDからヒーローを取得）
          const heroId = action.unit.id.replace("hero-", "").split("-")[0];
          if (!heroId) {
            console.error(`Invalid hero ID for unit: ${action.unit.id}`);
            continue;
          }
          const heroSkillDef = HERO_SKILL_DEFINITIONS[heroId];
          if (heroSkillDef && heroSkillDef.execute) {
            const isLeftSide = leftUnits.includes(action.unit);
            const allies = isLeftSide ? leftUnits : rightUnits;
            const enemies = isLeftSide ? rightUnits : leftUnits;

            try {
              heroSkillDef.execute(action.unit, allies, enemies, combatLog);
              skillExecuted = true;
            } catch (error) {
              console.error(`Error executing hero skill for ${heroId}:`, error);
              combatLog.push(`Error executing hero skill for ${heroId}`);
            }

            // スキルによる死亡をチェック
            for (const enemy of enemies) {
              if (enemy.hp <= 0 && !enemy.isDead) {
                enemy.isDead = true;
                combatLog.push(`${generateUnitName(enemy)} has been defeated!`);
              }
            }
          }
        } else {
          // 通常ユニットのスキルを使用
          const skillDef = SKILL_DEFINITIONS[action.unit.type];
          if (skillDef && skillDef.execute) {
            const isLeftSide = leftUnits.includes(action.unit);
            const allies = isLeftSide ? leftUnits : rightUnits;
            const enemies = isLeftSide ? rightUnits : leftUnits;

            try {
              skillDef.execute(action.unit, allies, enemies, combatLog);
              skillExecuted = true;
            } catch (error) {
              console.error(`Error executing skill for ${action.unit.type}:`, error);
              combatLog.push(`Error executing skill for ${action.unit.type}`);
            }

            // スキルによる死亡をチェック
            for (const enemy of enemies) {
              if (enemy.hp <= 0 && !enemy.isDead) {
                enemy.isDead = true;
                combatLog.push(`${generateUnitName(enemy)} has been defeated!`);
              }
            }
          }
        }
      }

      actionQueue.sort((a, b) => a.actionTime - b.actionTime);
    }

    const result = this.determineBattleResult(
      leftUnits, 
      rightUnits, 
      currentTime, 
      maxDurationMs, 
      timeline,
      combatLog,
      damageDealtLeft, 
      damageDealtRight,
      bossDamage
    );

    return result;
    } catch (error) {
      console.error("Battle simulation error:", error);
      // Return a draw result on error (Bug #3 fix)
      const result: BattleResult = {
        winner: "draw",
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
   * @returns 戦闘結果
   */
  private determineBattleResult(
    leftUnits: BattleUnit[],
    rightUnits: BattleUnit[],
    currentTime: number,
    maxDurationMs: number,
    timeline: BattleTimelineEvent[],
    combatLog: string[],
    damageDealtLeft: number,
    damageDealtRight: number,
    bossDamage: number = 0,
  ): BattleResult {
    // BattleResult の基本オブジェクトを作成（bossDamage は条件付きで追加）
    const createResult = (winner: "left" | "right" | "draw"): BattleResult => {
      const leftSurvivors = leftUnits.filter((unit) => !unit.isDead);
      const rightSurvivors = rightUnits.filter((unit) => !unit.isDead);
      const baseResult = {
        winner,
        leftSurvivors,
        rightSurvivors,
        timeline: [
          ...timeline,
          createBattleEndEvent({
            type: "battleEnd",
            battleId: timeline[0]?.battleId ?? "battle-unknown",
            atMs: currentTime,
            winner: resolveTimelineWinner(winner),
          }),
        ],
        combatLog,
        durationMs: currentTime,
        damageDealt: {
          left: damageDealtLeft,
          right: damageDealtRight,
        },
      };
      
      // bossDamage が 0 より大きい場合のみ追加
      if (bossDamage > 0) {
        return { ...baseResult, bossDamage };
      }
      return baseResult;
    };
    const leftSurvivors = leftUnits.filter((unit) => !unit.isDead);
    const rightSurvivors = rightUnits.filter((unit) => !unit.isDead);

    if (leftSurvivors.length === 0 && rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Draw (all units defeated)");
      return createResult("draw");
    }

    if (leftSurvivors.length === 0) {
      combatLog.push("Battle ended: Right wins");
      return createResult("right");
    }

    if (rightSurvivors.length === 0) {
      combatLog.push("Battle ended: Left wins");
      return createResult("left");
    }

    // 時間制限に達した場合
    if (currentTime >= maxDurationMs) {
      const leftTotalHp = leftSurvivors.reduce((sum, unit) => sum + unit.hp, 0);
      const rightTotalHp = rightSurvivors.reduce((sum, unit) => sum + unit.hp, 0);

      if (leftTotalHp > rightTotalHp) {
        combatLog.push(`Battle ended: Left wins (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return createResult("left");
      } else if (rightTotalHp > leftTotalHp) {
        combatLog.push(`Battle ended: Right wins (HP: ${rightTotalHp} vs ${leftTotalHp})`);
        return createResult("right");
      } else {
        combatLog.push(`Battle ended: Draw (HP: ${leftTotalHp} vs ${rightTotalHp})`);
        return createResult("draw");
      }
    }

    combatLog.push("Battle ended: Unexpected termination");
    return createResult("draw");
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
