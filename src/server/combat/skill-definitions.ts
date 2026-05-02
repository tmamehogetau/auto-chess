import type { BoardUnitType } from "../../shared/room-messages";
import { getHeroExclusiveUnitById } from "../../data/hero-exclusive-units";
import {
  SHARED_BOARD_HEIGHT,
  SHARED_BOARD_WIDTH,
  sharedBoardCoordinateToIndex,
  sharedBoardIndexToCoordinate,
  sharedBoardManhattanDistance,
} from "../../shared/board-geometry";
import type { BoardCoordinate } from "../../shared/board-geometry";
import type { AttackDamageResult } from "./battle-resolution-helpers";
import type { BattleUnit } from "./battle-simulator";
import type { PairSkillLevel } from "./pair-sub-bindings";

export interface SkillTiming {
  activationModel: "cooldown" | "mana" | "passive";
  initialSkillDelayMs: number;
  skillCooldownMs: number;
  mana?: ManaSkillConfig;
  combatHooks?: CombatHooks;
}

export interface ManaSkillConfig {
  maxMana: number;
  initialMana: number;
  manaCost: number;
  manaGainOnAttack: number;
  manaGainOnDamageTakenRatio: number;
}

export interface CombatHookContext {
  currentTimeMs: number;
  unit: BattleUnit;
  allies: BattleUnit[];
  enemies: BattleUnit[];
  log: string[];
  applyTimedModifier: (target: BattleUnit, modifier: TimedCombatModifier) => void;
  grantGoldReward?: (ownerPlayerId: string | undefined, amount: number, reason: string) => void;
}

export interface AfterAttackHitHookContext extends CombatHookContext {
  attacker: BattleUnit;
  target: BattleUnit;
  actualDamage: number;
}

export interface AttackTargetSelectionHookContext extends CombatHookContext {
  attacker: BattleUnit;
  defaultTarget: BattleUnit | null;
}

export interface LethalDamageHookContext extends CombatHookContext {
  unit: BattleUnit;
}

export interface DamageTakenHookContext extends CombatHookContext {
  sourceUnit: BattleUnit;
  target: BattleUnit;
  actualDamage: number;
}

export interface DamageDealtHookContext extends CombatHookContext {
  sourceUnit: BattleUnit;
  target: BattleUnit;
  actualDamage: number;
}

export interface UnitDefeatedHookContext extends CombatHookContext {
  defeatedUnit: BattleUnit;
}

export interface CombatHooks {
  onBattleStart?: (context: CombatHookContext) => void;
  onBeforeAction?: (context: CombatHookContext) => void;
  selectAttackTarget?: (context: AttackTargetSelectionHookContext) => BattleUnit | null;
  onBeforeAttackHit?: (context: AfterAttackHitHookContext) => void;
  onAfterAttackHit?: (context: AfterAttackHitHookContext) => void;
  onBeforeTakeDamage?: (context: CombatHookContext) => void;
  onAfterTakeDamage?: (context: DamageTakenHookContext) => void;
  onAfterDealDamage?: (context: DamageDealtHookContext) => void;
  onBeforeLethalDamage?: (context: LethalDamageHookContext) => void;
  onAfterUnitDefeated?: (context: UnitDefeatedHookContext) => void;
  onAfterAllyDefeated?: (context: UnitDefeatedHookContext) => void;
  onSkillWillCast?: (context: CombatHookContext) => void;
  onSkillDidCast?: (context: CombatHookContext) => void;
  onTimedEffectTick?: (context: CombatHookContext) => void;
  onBattleEnd?: (context: CombatHookContext) => void;
}

export interface TimedCombatModifier {
  id: string;
  durationMs: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  attackSpeedMultiplier?: number;
  movementSpeedMultiplier?: number;
  manaGainMultiplier?: number;
  targetPriorityMultiplier?: number;
  incomingDamageMultiplier?: number;
  tauntTargetId?: string;
}

export interface ScheduledSkillTickConfig {
  id: string;
  sourceSkillId?: string;
  initialDelayMs?: number;
  intervalMs: number;
  tickCount: number;
  onBeforeTick?: (
    source: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    tickIndex: number,
  ) => void;
  selectTarget: (source: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[]) => BattleUnit | null;
  selectTargets?: (
    source: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    tickIndex: number,
  ) => BattleUnit[];
  calculateDamage: (source: BattleUnit, target: BattleUnit, tickIndex: number) => number;
  describeTick?: (source: BattleUnit, target: BattleUnit, damage: number, tickIndex: number) => string;
}

export interface SkillExecutionContext {
  currentTimeMs: number;
  applyTimedModifier: (target: BattleUnit, modifier: TimedCombatModifier) => void;
  applyShield: (target: BattleUnit, amount: number, sourceId: string) => void;
  dealDamage: (caster: BattleUnit, target: BattleUnit, amount: number, sourceId: string) => number;
  findCurrentOrNearestTarget: (caster: BattleUnit, enemies: BattleUnit[]) => BattleUnit | null;
  scheduleSkillTicks: (source: BattleUnit, config: ScheduledSkillTickConfig) => void;
  executePairSkillsOnMainSkillActivated: (
    main: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
  ) => void;
}

export interface SkillEffect extends SkillTiming {
  name: string;
  canActivate?: (
    caster: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    context?: SkillExecutionContext,
  ) => boolean;
  execute: (
    caster: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    log: string[],
    context?: SkillExecutionContext,
  ) => void;
}

export interface HeroSkillEffect extends SkillTiming {
  name: string;
  execute: (
    caster: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    log: string[],
    context?: SkillExecutionContext,
  ) => void;
}

export interface UnitSkillEffect extends SkillEffect {}

export type BossSkillEffect = SkillEffect;

export interface PairSkillEffect {
  name: string;
  executeOnPairLinked?: (
    main: BattleUnit,
    log: string[],
    pairSkillLevel: PairSkillLevel,
  ) => void;
  executeOnMainSkillActivated?: (
    main: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    log: string[],
    context: SkillExecutionContext,
    pairSkillLevel: PairSkillLevel,
  ) => void;
  executeOnBeforeTakeDamage?: (
    target: BattleUnit,
    attacker: BattleUnit,
    log: string[],
  ) => void;
  executeOnAfterAttackHit?: (
    attacker: BattleUnit,
    target: BattleUnit,
    log: string[],
  ) => void;
  modifyAttackDamageResult?: (
    attacker: BattleUnit,
    target: BattleUnit,
    damageResult: AttackDamageResult,
    log: string[],
    context: SkillExecutionContext,
    pairSkillLevel: PairSkillLevel,
  ) => AttackDamageResult;
}

function isDebuffedTarget(unit: BattleUnit): boolean {
  return unit.buffModifiers.attackMultiplier < 1
    || unit.buffModifiers.defenseMultiplier < 1
    || unit.buffModifiers.attackSpeedMultiplier < 1;
}

function resolveExperimentMultiplier(envName: string, fallback: number): number {
  const rawValue = process.env[envName];
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return fallback;
  }

  const value = Number.parseFloat(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const EXPERIMENT_SKILL_DAMAGE_MULTIPLIER = resolveExperimentMultiplier(
  "AUTO_CHESS_EXPERIMENT_SKILL_DAMAGE_MULTIPLIER",
  0.5,
);

function calculateUltimateDamage(caster: BattleUnit, baseDamage: number, target?: BattleUnit): number {
  let damage = baseDamage * (caster.ultimateDamageMultiplier ?? 1);

  if (target && isDebuffedTarget(target)) {
    damage *= 1 + (caster.bonusDamageVsDebuffedTarget ?? 0);
  }

  return Math.floor(damage * EXPERIMENT_SKILL_DAMAGE_MULTIPLIER);
}

function calculateSharedBoardDistance(leftCell: number, rightCell: number): number {
  return sharedBoardManhattanDistance(
    sharedBoardIndexToCoordinate(leftCell),
    sharedBoardIndexToCoordinate(rightCell),
  );
}

type SkillStage = 1 | 4 | 7;

function resolveSkillStage(unit: BattleUnit): SkillStage {
  const unitLevel = unit.unitLevel ?? 1;
  if (unitLevel >= 7) {
    return 7;
  }
  if (unitLevel >= 4) {
    return 4;
  }
  return 1;
}

function selectUnitsWithinRange(
  centerCell: number,
  units: BattleUnit[],
  radius: number,
): BattleUnit[] {
  return units.filter((unit) => (
    !unit.isDead
    && calculateSharedBoardDistance(centerCell, unit.cell) <= radius
  ));
}

function selectHighestHpTarget(caster: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  return livingEnemies.reduce((best, enemy) => {
    if (enemy.hp !== best.hp) {
      return enemy.hp > best.hp ? enemy : best;
    }

    const bestDistance = calculateSharedBoardDistance(caster.cell, best.cell);
    const enemyDistance = calculateSharedBoardDistance(caster.cell, enemy.cell);
    if (enemyDistance !== bestDistance) {
      return enemyDistance < bestDistance ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

function createImmediateSkillContext(_log: string[]): SkillExecutionContext {
  return {
    currentTimeMs: 0,
    applyTimedModifier: (target, modifier) => {
      target.buffModifiers.attackMultiplier *= modifier.attackMultiplier ?? 1;
      target.buffModifiers.defenseMultiplier *= modifier.defenseMultiplier ?? 1;
      target.buffModifiers.attackSpeedMultiplier *= modifier.attackSpeedMultiplier ?? 1;
      target.buffModifiers.movementSpeedMultiplier =
        (target.buffModifiers.movementSpeedMultiplier ?? 1) * (modifier.movementSpeedMultiplier ?? 1);
      target.manaGainMultiplier = (target.manaGainMultiplier ?? 1) * (modifier.manaGainMultiplier ?? 1);
      target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
        * (modifier.incomingDamageMultiplier ?? 1);
      if (modifier.tauntTargetId) {
        target.tauntTargetId = modifier.tauntTargetId;
      }
    },
    applyShield: (target, amount) => {
      target.shieldAmount = (target.shieldAmount ?? 0) + amount;
    },
    dealDamage: (_caster, target, amount) => {
      if (!Number.isFinite(amount) || amount <= 0 || target.isDead) {
        return 0;
      }
      const scaledDamage = Math.max(0, Math.floor(amount * (target.damageTakenMultiplier ?? 1)));
      const shieldBeforeHit = target.shieldAmount ?? 0;
      const shieldAbsorbed = Math.min(shieldBeforeHit, scaledDamage);
      const damageAfterShield = scaledDamage - shieldAbsorbed;
      target.shieldAmount = shieldBeforeHit - shieldAbsorbed;
      target.hp -= damageAfterShield;
      return damageAfterShield;
    },
    findCurrentOrNearestTarget: (caster, enemies) => {
      const currentTarget = enemies.find(
        (enemy) => enemy.id === caster.currentTargetId && !enemy.isDead,
      );
      return currentTarget ?? selectLowestHpTarget(caster, enemies);
    },
    scheduleSkillTicks: () => undefined,
    executePairSkillsOnMainSkillActivated: () => undefined,
  };
}

function resolveSkillContext(
  context: SkillExecutionContext | undefined,
  log: string[],
): SkillExecutionContext {
  return context ?? createImmediateSkillContext(log);
}

function noopSkillExecute(): void {
  // Passive skills are driven by combat hooks.
}

function selectLowestHpRatioTarget(enemies: BattleUnit[]): BattleUnit | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  return livingEnemies.reduce((best, enemy) => {
    const bestRatio = best.hp / Math.max(1, best.maxHp);
    const enemyRatio = enemy.hp / Math.max(1, enemy.maxHp);
    if (enemyRatio !== bestRatio) {
      return enemyRatio < bestRatio ? enemy : best;
    }

    if (enemy.hp !== best.hp) {
      return enemy.hp < best.hp ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

function selectLowestHpRatioTargetWithinRange(caster: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  return selectLowestHpRatioTarget(enemies.filter((enemy) =>
    calculateSharedBoardDistance(caster.cell, enemy.cell) <= caster.attackRange,
  ));
}

const TONGLING_YOSHIKA_PAIR_ID = "tongling-yoshika-pair";
const PERFECT_MIND_CONTROL_PAIR_ID = "perfect-mind-control-pair";
const KOMEIJI_HEARTBREAKER_PAIR_ID = "komeiji-heartbreaker-pair";
const KOMEIJI_HEARTBREAKER_RANGE = 3;
const DELAYED_KUDAGITSUNE_PAIR_ID = "delayed-kudagitsune-shot-pair";
const DELAYED_KUDAGITSUNE_STACK_STATE_ID = "delayed-kudagitsune-shot-stacks";
const DELAYED_KUDAGITSUNE_ATTACK_DOWN_UNTIL_STATE_ID = "delayed-kudagitsune-shot-attack-down-until";
const DELAYED_KUDAGITSUNE_MAX_STACKS = 3;
const GREATEST_TREASURE_PAIR_ID = "greatest-treasure-pair";
const GOUZOKU_RANBU_MONONOBE_PAIR_ID = "gouzoku-ranbu-mononobe-pair";
const GOUZOKU_RANBU_SOGA_PAIR_ID = "gouzoku-ranbu-soga-pair";
const NAZRIN_TREASURE_REWARD_CLAIMED_KEY = "nazrin-treasure-reward-claimed";

function getNazrinTreasureMarkExpiresAtKey(caster: BattleUnit): string {
  return `nazrin-treasure-mark-expires-at:${caster.id}`;
}

function getNazrinTreasureMarkRewardKey(caster: BattleUnit): string {
  return `nazrin-treasure-mark-reward:${caster.id}`;
}

function resolveNazrinPendulumValues(stage: SkillStage): {
  damageMultiplier: number;
  markDurationMs: number;
  rewardGold: number;
} {
  if (stage >= 7) {
    return { damageMultiplier: 1.8, markDurationMs: 6000, rewardGold: 2 };
  }
  if (stage >= 4) {
    return { damageMultiplier: 1.6, markDurationMs: 4500, rewardGold: 1 };
  }
  return { damageMultiplier: 1.4, markDurationMs: 3000, rewardGold: 1 };
}

function resolveRinShikaifukunenValues(stage: SkillStage): {
  maxStacks: number;
  attackMultiplier: number;
  incomingDamageMultiplier: number;
} {
  if (stage >= 7) {
    return { maxStacks: 5, attackMultiplier: 1.10, incomingDamageMultiplier: 0.86 };
  }

  if (stage >= 4) {
    return { maxStacks: 4, attackMultiplier: 1.09, incomingDamageMultiplier: 0.89 };
  }

  return { maxStacks: 3, attackMultiplier: 1.08, incomingDamageMultiplier: 0.91 };
}

function resolveTonglingYoshikaPairLevel(unit: BattleUnit): 1 | 4 | 7 | null {
  const pairSkillLevel = unit.pairSkillLevels?.[TONGLING_YOSHIKA_PAIR_ID];
  if (pairSkillLevel === 1 || pairSkillLevel === 4 || pairSkillLevel === 7) {
    return pairSkillLevel;
  }

  return null;
}

function resolveTonglingYoshikaReviveRatio(pairSkillLevel: 1 | 4 | 7 | null): number {
  if (pairSkillLevel === 7) {
    return 0.55;
  }

  if (pairSkillLevel === 4) {
    return 0.40;
  }

  if (pairSkillLevel === 1) {
    return 0.32;
  }

  return 0.22;
}

function resolveYoshikaReviveValues(stage: SkillStage, pairSkillLevel: 1 | 4 | 7 | null): {
  maxRevives: number;
  reviveHpRatio: number;
  guardDurationMs: number;
  incomingDamageMultiplier: number;
} {
  const baseValues = stage >= 7
    ? { maxRevives: 2, reviveHpRatio: 0.34, guardDurationMs: 3000, incomingDamageMultiplier: 0.80 }
    : stage >= 4
      ? { maxRevives: 1, reviveHpRatio: 0.28, guardDurationMs: 2500, incomingDamageMultiplier: 0.85 }
      : { maxRevives: 1, reviveHpRatio: 0.22, guardDurationMs: 2000, incomingDamageMultiplier: 0.90 };

  return {
    ...baseValues,
    reviveHpRatio: Math.max(baseValues.reviveHpRatio, resolveTonglingYoshikaReviveRatio(pairSkillLevel)),
  };
}

function resolveKoishiUnconsciousValues(stage: SkillStage): {
  targetPriorityMultiplier: number;
  revealDamageMultiplier: number;
} {
  if (stage >= 7) {
    return { targetPriorityMultiplier: 0.10, revealDamageMultiplier: 0.90 };
  }

  if (stage >= 4) {
    return { targetPriorityMultiplier: 0.15, revealDamageMultiplier: 0.45 };
  }

  return { targetPriorityMultiplier: 0.20, revealDamageMultiplier: 0 };
}

function resolveWakasagihimeTailFinValues(stage: SkillStage): {
  triggerEveryAttacks: number;
  hitCount: number;
  damageMultiplierPerHit: number;
} {
  if (stage >= 7) {
    return { triggerEveryAttacks: 3, hitCount: 2, damageMultiplierPerHit: 0.35 };
  }

  if (stage >= 4) {
    return { triggerEveryAttacks: 3, hitCount: 2, damageMultiplierPerHit: 0.30 };
  }

  return { triggerEveryAttacks: 3, hitCount: 2, damageMultiplierPerHit: 0.25 };
}

function resolveIchirinGenkotsuValues(stage: SkillStage): {
  radius: number;
  damageMultiplier: number;
  guardDurationMs: number;
  incomingDamageMultiplier: number;
} {
  if (stage >= 7) {
    return {
      radius: 2,
      damageMultiplier: 1.65,
      guardDurationMs: 8000,
      incomingDamageMultiplier: 0.75,
    };
  }

  if (stage >= 4) {
    return {
      radius: 1,
      damageMultiplier: 1.45,
      guardDurationMs: 7000,
      incomingDamageMultiplier: 0.80,
    };
  }

  return {
    radius: 1,
    damageMultiplier: 1.20,
    guardDurationMs: 6000,
    incomingDamageMultiplier: 0.85,
  };
}

function resolveTojikoIrukaThunderValues(stage: SkillStage): {
  primaryDamageMultiplier: number;
  chainDamageMultiplier: number;
  chainRadius: number;
  maxChainTargets: number;
} {
  if (stage >= 7) {
    return {
      primaryDamageMultiplier: 2.20,
      chainDamageMultiplier: 0.85,
      chainRadius: 3,
      maxChainTargets: 3,
    };
  }

  if (stage >= 4) {
    return {
      primaryDamageMultiplier: 1.85,
      chainDamageMultiplier: 0.70,
      chainRadius: 2,
      maxChainTargets: 2,
    };
  }

  return {
    primaryDamageMultiplier: 1.50,
    chainDamageMultiplier: 0.55,
    chainRadius: 2,
    maxChainTargets: 2,
  };
}

function resolveFutoTaiyiTrueFireValues(stage: SkillStage): {
  formationCount: number;
  radius: number;
  tickCount: number;
  intervalMs: number;
  tickDamageMultiplier: number;
  attackSpeedMultiplier: number;
  durationMs: number;
} {
  if (stage >= 7) {
    return {
      formationCount: 3,
      radius: 1,
      tickCount: 5,
      intervalMs: 800,
      tickDamageMultiplier: 0.50,
      attackSpeedMultiplier: 0.80,
      durationMs: 5800,
    };
  }

  if (stage >= 4) {
    return {
      formationCount: 2,
      radius: 1,
      tickCount: 5,
      intervalMs: 800,
      tickDamageMultiplier: 0.44,
      attackSpeedMultiplier: 0.84,
      durationMs: 5000,
    };
  }

  return {
    formationCount: 1,
    radius: 1,
    tickCount: 4,
    intervalMs: 800,
    tickDamageMultiplier: 0.38,
    attackSpeedMultiplier: 0.88,
    durationMs: 4200,
  };
}

function selectFutoTaiyiTrueFireFormationCells(
  primaryTarget: BattleUnit,
  enemies: BattleUnit[],
  radius: number,
  formationCount: number,
): number[] {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  const formationCells = [primaryTarget.cell];
  const coveredUnitIds = new Set(
    selectUnitsWithinRange(primaryTarget.cell, livingEnemies, radius).map((enemy) => enemy.id),
  );

  while (formationCells.length < formationCount) {
    const candidates = livingEnemies.filter((enemy) =>
      !formationCells.includes(enemy.cell)
      && formationCells.every((cell) => calculateSharedBoardDistance(cell, enemy.cell) > radius)
    );
    if (candidates.length === 0) {
      break;
    }

    const bestCandidate = candidates.reduce((best, enemy) => {
      const bestNewCoverage = selectUnitsWithinRange(best.cell, livingEnemies, radius)
        .filter((target) => !coveredUnitIds.has(target.id)).length;
      const enemyNewCoverage = selectUnitsWithinRange(enemy.cell, livingEnemies, radius)
        .filter((target) => !coveredUnitIds.has(target.id)).length;
      if (enemyNewCoverage !== bestNewCoverage) {
        return enemyNewCoverage > bestNewCoverage ? enemy : best;
      }

      const bestDistance = calculateSharedBoardDistance(primaryTarget.cell, best.cell);
      const enemyDistance = calculateSharedBoardDistance(primaryTarget.cell, enemy.cell);
      if (enemyDistance !== bestDistance) {
        return enemyDistance < bestDistance ? enemy : best;
      }

      return enemy.cell < best.cell ? enemy : best;
    });

    formationCells.push(bestCandidate.cell);
    for (const enemy of selectUnitsWithinRange(bestCandidate.cell, livingEnemies, radius)) {
      coveredUnitIds.add(enemy.id);
    }
  }

  return formationCells;
}

function resolveShouAbsoluteJusticeValues(stage: SkillStage): {
  attackMultiplier: number;
  durationMs: number;
  beamDamageMultiplier: number;
  maxBeamTargets: number;
} {
  if (stage >= 7) {
    return {
      attackMultiplier: 1.34,
      durationMs: 7000,
      beamDamageMultiplier: 1.55,
      maxBeamTargets: 4,
    };
  }

  if (stage >= 4) {
    return {
      attackMultiplier: 1.26,
      durationMs: 6000,
      beamDamageMultiplier: 1.35,
      maxBeamTargets: 3,
    };
  }

  return {
    attackMultiplier: 1.18,
    durationMs: 5000,
    beamDamageMultiplier: 1.15,
    maxBeamTargets: 3,
  };
}

function resolveClownpieceHellEclipseValues(stage: SkillStage): {
  attackMultiplier: number;
  attackSpeedMultiplier: number;
  incomingDamageMultiplier: number;
  durationMs: number;
} {
  if (stage >= 7) {
    return {
      attackMultiplier: 1.16,
      attackSpeedMultiplier: 1.48,
      incomingDamageMultiplier: 1.08,
      durationMs: 7000,
    };
  }

  if (stage >= 4) {
    return {
      attackMultiplier: 1.14,
      attackSpeedMultiplier: 1.34,
      incomingDamageMultiplier: 1.08,
      durationMs: 6000,
    };
  }

  return {
    attackMultiplier: 1.12,
    attackSpeedMultiplier: 1.22,
    incomingDamageMultiplier: 1.08,
    durationMs: 5000,
  };
}

function resolveMegumuLightWindClearMoonValues(stage: SkillStage): {
  attackSpeedMultiplier: number;
  durationMs: number;
} {
  if (stage >= 7) {
    return { attackSpeedMultiplier: 1.25, durationMs: 6500 };
  }

  if (stage >= 4) {
    return { attackSpeedMultiplier: 1.18, durationMs: 5500 };
  }

  return { attackSpeedMultiplier: 1.12, durationMs: 4500 };
}

function resolveMomoyoDragonEaterValues(stage: SkillStage): {
  attackDamageMultiplier: number;
  targetMaxHpDamageRatio: number;
  damageCapMultiplier: number;
} {
  if (stage >= 7) {
    return { attackDamageMultiplier: 1.75, targetMaxHpDamageRatio: 0.08, damageCapMultiplier: 3.8 };
  }

  if (stage >= 4) {
    return { attackDamageMultiplier: 1.45, targetMaxHpDamageRatio: 0.07, damageCapMultiplier: 3.2 };
  }

  return { attackDamageMultiplier: 1.20, targetMaxHpDamageRatio: 0.06, damageCapMultiplier: 2.6 };
}

function resolveKagerouFullMoonHowlValues(stage: SkillStage): {
  triggerDamageRatio: number;
  healRatio: number;
  durationMs: number;
  attackSpeedMultiplier: number;
} {
  if (stage >= 7) {
    return {
      triggerDamageRatio: 0.35,
      healRatio: 0.26,
      durationMs: 8000,
      attackSpeedMultiplier: 1.70,
    };
  }

  if (stage >= 4) {
    return {
      triggerDamageRatio: 0.35,
      healRatio: 0.22,
      durationMs: 8000,
      attackSpeedMultiplier: 1.50,
    };
  }

  return {
    triggerDamageRatio: 0.35,
    healRatio: 0.18,
    durationMs: 8000,
    attackSpeedMultiplier: 1.35,
  };
}

function resolveTsukasaCylinderFoxValues(stage: SkillStage): {
  searchRangeBonus: number;
  durationMs: number;
  attackMultiplier: number;
  incomingDamageMultiplier: number;
} {
  if (stage >= 7) {
    return {
      searchRangeBonus: 2,
      durationMs: 8000,
      attackMultiplier: 0.70,
      incomingDamageMultiplier: 1.18,
    };
  }

  if (stage >= 4) {
    return {
      searchRangeBonus: 2,
      durationMs: 7000,
      attackMultiplier: 0.76,
      incomingDamageMultiplier: 1.14,
    };
  }

  return {
    searchRangeBonus: 2,
    durationMs: 6000,
    attackMultiplier: 0.82,
    incomingDamageMultiplier: 1.10,
  };
}

function resolveSatoriMindReadValues(stage: SkillStage): {
  durationMs: number;
  assassinDurationMs: number;
  vanguardIncomingDamageMultiplier: number;
  rangerAttackMultiplier: number;
  assassinAttackSpeedMultiplier: number;
  mageManaReduction: number;
  mageManaGainMultiplier: number;
} {
  if (stage >= 7) {
    return {
      durationMs: 7500,
      assassinDurationMs: 7000,
      vanguardIncomingDamageMultiplier: 1.28,
      rangerAttackMultiplier: 0.70,
      assassinAttackSpeedMultiplier: 0.62,
      mageManaReduction: 50,
      mageManaGainMultiplier: 0.55,
    };
  }

  if (stage >= 4) {
    return {
      durationMs: 6000,
      assassinDurationMs: 5500,
      vanguardIncomingDamageMultiplier: 1.20,
      rangerAttackMultiplier: 0.78,
      assassinAttackSpeedMultiplier: 0.72,
      mageManaReduction: 35,
      mageManaGainMultiplier: 0.65,
    };
  }

  return {
    durationMs: 5000,
    assassinDurationMs: 4500,
    vanguardIncomingDamageMultiplier: 1.15,
    rangerAttackMultiplier: 0.82,
    assassinAttackSpeedMultiplier: 0.78,
    mageManaReduction: 25,
    mageManaGainMultiplier: 0.75,
  };
}

function resolveNormalPairSkillLevel(unit: BattleUnit, pairSkillId: string): 1 | 4 | 7 | null {
  const pairSkillLevel = unit.pairSkillLevels?.[pairSkillId];
  if (pairSkillLevel === 1 || pairSkillLevel === 4 || pairSkillLevel === 7) {
    return pairSkillLevel;
  }

  return null;
}

function resolvePerfectMindControlValues(pairSkillLevel: 1 | 4 | 7): {
  durationMs: number;
  targetPriorityMultiplier: number;
} {
  if (pairSkillLevel >= 7) {
    return { durationMs: 6000, targetPriorityMultiplier: 0.15 };
  }

  if (pairSkillLevel >= 4) {
    return { durationMs: 4000, targetPriorityMultiplier: 0.25 };
  }

  return { durationMs: 2500, targetPriorityMultiplier: 0.35 };
}

function resolveKomeijiHeartbreakerDamageMultiplier(pairSkillLevel: 1 | 4 | 7): number {
  if (pairSkillLevel >= 7) {
    return 3.4;
  }

  if (pairSkillLevel >= 4) {
    return 2.6;
  }

  return 2.0;
}

function resolveBattleUnitCombatClass(unit: BattleUnit): BoardUnitType {
  return unit.combatClass ?? unit.type;
}

function resolveDelayedKudagitsuneValues(pairSkillLevel: PairSkillLevel): {
  damageMultiplier: number;
  attackDownMultiplier: number;
  durationMs: number;
} {
  if (pairSkillLevel >= 7) {
    return { damageMultiplier: 1.50, attackDownMultiplier: 0.75, durationMs: 7000 };
  }

  if (pairSkillLevel >= 4) {
    return { damageMultiplier: 1.35, attackDownMultiplier: 0.82, durationMs: 6000 };
  }

  return { damageMultiplier: 1.25, attackDownMultiplier: 0.88, durationMs: 5000 };
}

function resolveGreatestTreasureValues(pairSkillLevel: PairSkillLevel): {
  damageMultiplier: number;
  incomingDamageMultiplier: number;
  durationMs: number;
} {
  if (pairSkillLevel >= 7) {
    return { damageMultiplier: 1.45, incomingDamageMultiplier: 1.18, durationMs: 7000 };
  }

  if (pairSkillLevel >= 4) {
    return { damageMultiplier: 1.05, incomingDamageMultiplier: 1.12, durationMs: 6000 };
  }

  return { damageMultiplier: 0.75, incomingDamageMultiplier: 1.08, durationMs: 5000 };
}

function resolveGouzokuRanbuMononobeValues(pairSkillLevel: PairSkillLevel): {
  tickCount: number;
  tickDamageMultiplier: number;
  attackSpeedMultiplier: number;
  durationMs: number;
} {
  if (pairSkillLevel >= 7) {
    return {
      tickCount: 5,
      tickDamageMultiplier: 0.35,
      attackSpeedMultiplier: 0.84,
      durationMs: 6500,
    };
  }

  if (pairSkillLevel >= 4) {
    return {
      tickCount: 4,
      tickDamageMultiplier: 0.28,
      attackSpeedMultiplier: 0.88,
      durationMs: 5500,
    };
  }

  return {
    tickCount: 3,
    tickDamageMultiplier: 0.22,
    attackSpeedMultiplier: 0.92,
    durationMs: 4500,
  };
}

function resolveGouzokuRanbuSogaValues(pairSkillLevel: PairSkillLevel): {
  primaryDamageMultiplier: number;
  chainDamageMultiplier: number;
  chainCount: number;
} {
  if (pairSkillLevel >= 7) {
    return { primaryDamageMultiplier: 1.25, chainDamageMultiplier: 0.48, chainCount: 4 };
  }

  if (pairSkillLevel >= 4) {
    return { primaryDamageMultiplier: 0.95, chainDamageMultiplier: 0.38, chainCount: 3 };
  }

  return { primaryDamageMultiplier: 0.70, chainDamageMultiplier: 0.30, chainCount: 2 };
}

function selectKomeijiHeartbreakerTarget(caster: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  const livingEnemiesInRange = enemies.filter((enemy) =>
    !enemy.isDead && calculateSharedBoardDistance(caster.cell, enemy.cell) <= KOMEIJI_HEARTBREAKER_RANGE
  );
  if (livingEnemiesInRange.length === 0) {
    return null;
  }

  const currentTarget = livingEnemiesInRange.find((enemy) => enemy.id === caster.currentTargetId);
  if (currentTarget) {
    return currentTarget;
  }

  return livingEnemiesInRange.sort((left, right) => {
    const distanceDiff = calculateSharedBoardDistance(caster.cell, left.cell)
      - calculateSharedBoardDistance(caster.cell, right.cell);
    if (distanceDiff !== 0) {
      return distanceDiff;
    }

    const hpRatioDiff = (left.hp / Math.max(1, left.maxHp)) - (right.hp / Math.max(1, right.maxHp));
    if (hpRatioDiff !== 0) {
      return hpRatioDiff;
    }

    return left.cell - right.cell;
  })[0] ?? null;
}

function countUniqueFactionIds(units: BattleUnit[]): number {
  return new Set(
    units
      .filter((unit) => !unit.isDead && typeof unit.factionId === "string" && unit.factionId.length > 0)
      .map((unit) => unit.factionId),
  ).size;
}

function isInsideSharedBoard(coordinate: BoardCoordinate): boolean {
  return coordinate.x >= 0
    && coordinate.x < SHARED_BOARD_WIDTH
    && coordinate.y >= 0
    && coordinate.y < SHARED_BOARD_HEIGHT;
}

function selectSeigaWallRunnerTarget(
  caster: BattleUnit,
  enemies: BattleUnit[],
  defaultTarget: BattleUnit | null,
): BattleUnit | null {
  const candidates = enemies.filter((enemy) =>
    !enemy.isDead
    && calculateSharedBoardDistance(caster.cell, enemy.cell) <= caster.attackRange,
  );
  if (candidates.length === 0) {
    return defaultTarget;
  }

  return candidates.reduce((best, enemy) => {
    const bestRatio = best.hp / Math.max(1, best.maxHp);
    const enemyRatio = enemy.hp / Math.max(1, enemy.maxHp);
    if (enemyRatio !== bestRatio) {
      return enemyRatio < bestRatio ? enemy : best;
    }

    if (enemy.hp !== best.hp) {
      return enemy.hp < best.hp ? enemy : best;
    }

    const bestDistance = calculateSharedBoardDistance(caster.cell, best.cell);
    const enemyDistance = calculateSharedBoardDistance(caster.cell, enemy.cell);
    if (enemyDistance !== bestDistance) {
      return enemyDistance < bestDistance ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

function selectSeigaWallRunCell(
  caster: BattleUnit,
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): number | null {
  const occupiedCells = new Set(
    [...allies, ...enemies]
      .filter((unit) => !unit.isDead && unit.id !== caster.id)
      .map((unit) => unit.cell),
  );
  const casterCoordinate = sharedBoardIndexToCoordinate(caster.cell);
  const targetCoordinate = sharedBoardIndexToCoordinate(target.cell);
  const xDirection = Math.sign(targetCoordinate.x - casterCoordinate.x);
  const yDirection = Math.sign(targetCoordinate.y - casterCoordinate.y);
  const adjacentCoordinates: BoardCoordinate[] = [];

  if (Math.abs(targetCoordinate.x - casterCoordinate.x) >= Math.abs(targetCoordinate.y - casterCoordinate.y)) {
    if (xDirection !== 0) {
      adjacentCoordinates.push({ x: targetCoordinate.x + xDirection, y: targetCoordinate.y });
    }
  } else if (yDirection !== 0) {
    adjacentCoordinates.push({ x: targetCoordinate.x, y: targetCoordinate.y + yDirection });
  }

  adjacentCoordinates.push(
    { x: targetCoordinate.x + 1, y: targetCoordinate.y },
    { x: targetCoordinate.x - 1, y: targetCoordinate.y },
    { x: targetCoordinate.x, y: targetCoordinate.y + 1 },
    { x: targetCoordinate.x, y: targetCoordinate.y - 1 },
  );

  const candidates = adjacentCoordinates
    .filter(isInsideSharedBoard)
    .map((coordinate) => sharedBoardCoordinateToIndex(coordinate))
    .filter((cell, index, cells) => !occupiedCells.has(cell) && cells.indexOf(cell) === index);

  return candidates[0] ?? null;
}

function resolveSeigaWallRunnerValues(stage: SkillStage): {
  empoweredDamageMultiplier: number;
} {
  if (stage >= 7) {
    return { empoweredDamageMultiplier: 1.40 };
  }

  if (stage >= 4) {
    return { empoweredDamageMultiplier: 1.05 };
  }

  return { empoweredDamageMultiplier: 0.75 };
}

function trySeigaWallRun(
  unit: BattleUnit,
  target: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  currentTimeMs: number,
  log: string[],
): void {
  const stackState = unit.stackState ?? {};
  const usedCount = stackState["seiga-wall-run-count"] ?? 0;
  const lastUsedAt = stackState["seiga-wall-run-last-at"] ?? Number.NEGATIVE_INFINITY;
  if (usedCount >= 2 || currentTimeMs - lastUsedAt < 1800) {
    return;
  }

  const nextCell = selectSeigaWallRunCell(unit, target, allies, enemies);
  if (nextCell === null || nextCell === unit.cell) {
    return;
  }

  unit.cell = nextCell;
  unit.stackState = {
    ...stackState,
    "seiga-wall-run-count": usedCount + 1,
    "seiga-wall-run-last-at": currentTimeMs,
    "seiga-wall-run-empowered": 1,
  };
  log.push(`${unit.sourceUnitId ?? unit.type} activates ウォールランナー`);
}

function selectHighestAttackTarget(enemies: BattleUnit[]): BattleUnit | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  return livingEnemies.reduce((best, enemy) => {
    const bestAttack = best.attackPower * best.buffModifiers.attackMultiplier;
    const enemyAttack = enemy.attackPower * enemy.buffModifiers.attackMultiplier;
    if (enemyAttack !== bestAttack) {
      return enemyAttack > bestAttack ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

function selectHighestAttackTargetWithinRange(
  caster: BattleUnit,
  enemies: BattleUnit[],
  range: number,
): BattleUnit | null {
  return selectHighestAttackTarget(enemies.filter((enemy) =>
    calculateSharedBoardDistance(caster.cell, enemy.cell) <= range,
  ));
}

function selectNearestAlly(caster: BattleUnit, allies: BattleUnit[]): BattleUnit {
  const livingAllies = allies.filter((ally) => !ally.isDead && ally.id !== caster.id);
  if (livingAllies.length === 0) {
    return caster;
  }

  return livingAllies.reduce((best, ally) => {
    const bestDistance = calculateSharedBoardDistance(caster.cell, best.cell);
    const allyDistance = calculateSharedBoardDistance(caster.cell, ally.cell);
    if (allyDistance !== bestDistance) {
      return allyDistance < bestDistance ? ally : best;
    }

    return ally.cell < best.cell ? ally : best;
  });
}

function selectKoishiBacklineTarget(caster: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  const livingBacklineEnemies = enemies.filter((enemy) =>
    !enemy.isDead
    && (enemy.type === "mage" || enemy.type === "ranger")
    && calculateSharedBoardDistance(caster.cell, enemy.cell) <= caster.attackRange,
  );
  if (livingBacklineEnemies.length === 0) {
    return null;
  }

  return livingBacklineEnemies.reduce((best, enemy) => {
    const bestDistance = calculateSharedBoardDistance(caster.cell, best.cell);
    const enemyDistance = calculateSharedBoardDistance(caster.cell, enemy.cell);
    if (enemyDistance !== bestDistance) {
      return enemyDistance < bestDistance ? enemy : best;
    }

    if (enemy.hp !== best.hp) {
      return enemy.hp < best.hp ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

function selectSekibankiFlyingHeadTarget(caster: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  const currentTargetId = caster.currentTargetId;
  const candidates = enemies.filter((enemy) => !enemy.isDead && enemy.id !== currentTargetId);
  if (candidates.length === 0) {
    return enemies.find((enemy) => !enemy.isDead) ?? null;
  }

  return candidates.reduce((best, enemy) => {
    if (enemy.hp !== best.hp) {
      return enemy.hp < best.hp ? enemy : best;
    }

    const bestDistance = calculateSharedBoardDistance(caster.cell, best.cell);
    const enemyDistance = calculateSharedBoardDistance(caster.cell, enemy.cell);
    if (enemyDistance !== bestDistance) {
      return enemyDistance < bestDistance ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

const JUNKO_PURIFICATION_DURATION_MS = 7000;
const JUNKO_EXECUTION_HP_RATIO = 0.25;
const JUNKO_BOSS_EXECUTION_DAMAGE_MULTIPLIER = 2.5;
const MYOURENJI_MEMBER_IDS = new Set(["nazrin", "ichirin", "murasa", "shou", "byakuren"]);

function resolveJunkoLilyOfMurderValues(stage: SkillStage): {
  purificationDurationMs: number;
  executionHpRatio: number;
  bossExecutionDamageMultiplier: number;
} {
  if (stage >= 7) {
    return {
      purificationDurationMs: 9000,
      executionHpRatio: 0.32,
      bossExecutionDamageMultiplier: 3.6,
    };
  }

  if (stage >= 4) {
    return {
      purificationDurationMs: 8000,
      executionHpRatio: 0.28,
      bossExecutionDamageMultiplier: 3.0,
    };
  }

  return {
    purificationDurationMs: JUNKO_PURIFICATION_DURATION_MS,
    executionHpRatio: JUNKO_EXECUTION_HP_RATIO,
    bossExecutionDamageMultiplier: JUNKO_BOSS_EXECUTION_DAMAGE_MULTIPLIER,
  };
}

function resolveByakurenSuperhumanValues(stage: SkillStage): {
  attackMultipliersByMemberCount: readonly [number, number, number, number, number];
  incomingDamageMultiplier: number;
  durationMs: number;
  chargeDamageMultiplier: number;
} {
  if (stage >= 7) {
    return {
      attackMultipliersByMemberCount: [1.30, 1.40, 1.52, 1.65, 1.85],
      incomingDamageMultiplier: 0.82,
      durationMs: 9000,
      chargeDamageMultiplier: 1.35,
    };
  }

  if (stage >= 4) {
    return {
      attackMultipliersByMemberCount: [1.22, 1.29, 1.36, 1.43, 1.55],
      incomingDamageMultiplier: 0.88,
      durationMs: 7500,
      chargeDamageMultiplier: 1.00,
    };
  }

  return {
    attackMultipliersByMemberCount: [1.18, 1.23, 1.28, 1.33, 1.40],
    incomingDamageMultiplier: 0.92,
    durationMs: 6500,
    chargeDamageMultiplier: 0.75,
  };
}

function resolveUtsuhoMegaFlareValues(stage: SkillStage): {
  chargeDelayMs: number;
  radius: number;
  primaryDamageMultiplier: number;
  splashDamageMultiplier: number;
} {
  if (stage >= 7) {
    return {
      chargeDelayMs: 500,
      radius: 2,
      primaryDamageMultiplier: 2.75,
      splashDamageMultiplier: 1.70,
    };
  }

  if (stage >= 4) {
    return {
      chargeDelayMs: 600,
      radius: 1,
      primaryDamageMultiplier: 2.15,
      splashDamageMultiplier: 1.35,
    };
  }

  return {
    chargeDelayMs: 700,
    radius: 1,
    primaryDamageMultiplier: 1.75,
    splashDamageMultiplier: 1.10,
  };
}

function resolveMurasaDeepSinkerValues(stage: SkillStage): {
  radius: number;
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  durationMs: number;
} {
  if (stage >= 7) {
    return {
      radius: 2,
      damageMultiplier: 1.65,
      attackSpeedMultiplier: 0.75,
      durationMs: 8000,
    };
  }

  if (stage >= 4) {
    return {
      radius: 1,
      damageMultiplier: 1.35,
      attackSpeedMultiplier: 0.80,
      durationMs: 7000,
    };
  }

  return {
    radius: 1,
    damageMultiplier: 1.10,
    attackSpeedMultiplier: 0.85,
    durationMs: 6000,
  };
}

function resolveSekibankiFlyingHeadValues(stage: SkillStage): {
  tickCount: number;
  intervalMs: number;
  damageMultiplier: number;
} {
  if (stage >= 7) {
    return {
      tickCount: 6,
      intervalMs: 500,
      damageMultiplier: 0.58,
    };
  }

  if (stage >= 4) {
    return {
      tickCount: 5,
      intervalMs: 550,
      damageMultiplier: 0.50,
    };
  }

  return {
    tickCount: 4,
    intervalMs: 600,
    damageMultiplier: 0.45,
  };
}

function resolveHecatiaTrinitarianRhapsodyValues(stage: SkillStage): {
  primaryDamageMultiplier: number;
  supplementalDamageMultiplier: number;
} {
  if (stage >= 7) {
    return { primaryDamageMultiplier: 3.60, supplementalDamageMultiplier: 1.20 };
  }

  if (stage >= 4) {
    return { primaryDamageMultiplier: 2.10, supplementalDamageMultiplier: 0.70 };
  }

  return { primaryDamageMultiplier: 1.60, supplementalDamageMultiplier: 0.50 };
}

function resolveZanmuValues(stage: SkillStage): {
  disableDurationMs: number;
  attackMultiplierPerFaction: number;
  damageReductionPerFaction: number;
  initialManaBonus: number;
  manaGainMultiplier: number;
} {
  if (stage >= 7) {
    return {
      disableDurationMs: 7000,
      attackMultiplierPerFaction: 0.065,
      damageReductionPerFaction: 0.045,
      initialManaBonus: 15,
      manaGainMultiplier: 1.30,
    };
  }

  if (stage >= 4) {
    return {
      disableDurationMs: 5500,
      attackMultiplierPerFaction: 0.05,
      damageReductionPerFaction: 0.035,
      initialManaBonus: 5,
      manaGainMultiplier: 1.10,
    };
  }

  return {
    disableDurationMs: 4000,
    attackMultiplierPerFaction: 0.04,
    damageReductionPerFaction: 0.03,
    initialManaBonus: 0,
    manaGainMultiplier: 1,
  };
}

function resolveMikoObeyWithoutResistanceValues(stage: SkillStage): {
  durationMs: number;
  attackMultiplier: number;
  damageMultiplier: number;
  radius: number;
  initialManaBonus: number;
  manaGainMultiplier: number;
} {
  if (stage >= 7) {
    return {
      durationMs: 7500,
      attackMultiplier: 0.82,
      damageMultiplier: 1.35,
      radius: 2,
      initialManaBonus: 10,
      manaGainMultiplier: 1.20,
    };
  }

  if (stage >= 4) {
    return {
      durationMs: 6500,
      attackMultiplier: 0.86,
      damageMultiplier: 1.10,
      radius: 1,
      initialManaBonus: 5,
      manaGainMultiplier: 1.10,
    };
  }

  return {
    durationMs: 5500,
    attackMultiplier: 0.90,
    damageMultiplier: 0.90,
    radius: 1,
    initialManaBonus: 0,
    manaGainMultiplier: 1,
  };
}

function getJunkoPurificationKey(caster: BattleUnit): string {
  return `junko-purified-by-${caster.id}`;
}

function selectJunkoPurifiedTarget(
  caster: BattleUnit,
  enemies: BattleUnit[],
  currentTimeMs: number,
): BattleUnit | null {
  const purificationKey = getJunkoPurificationKey(caster);
  return enemies.find((enemy) =>
    !enemy.isDead
    && (enemy.stackState?.[purificationKey] ?? 0) >= currentTimeMs,
  ) ?? null;
}

function countUniqueMyourenjiMembers(units: BattleUnit[]): number {
  const memberIds = new Set<string>();
  for (const unit of units) {
    const sourceUnitId = unit.sourceUnitId ?? "";
    if (MYOURENJI_MEMBER_IDS.has(sourceUnitId)) {
      memberIds.add(sourceUnitId);
    }
  }

  return memberIds.size;
}

function selectLowestHpTarget(caster: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  return livingEnemies.reduce((best, enemy) => {
    if (enemy.hp !== best.hp) {
      return enemy.hp < best.hp ? enemy : best;
    }

    const bestDistance = calculateSharedBoardDistance(caster.cell, best.cell);
    const enemyDistance = calculateSharedBoardDistance(caster.cell, enemy.cell);
    if (enemyDistance !== bestDistance) {
      return enemyDistance < bestDistance ? enemy : best;
    }

    return enemy.cell < best.cell ? enemy : best;
  });
}

function selectBestAreaCenter(caster: BattleUnit, enemies: BattleUnit[], radius: number): number | null {
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  if (livingEnemies.length === 0) {
    return null;
  }

  let bestCenter = livingEnemies[0]!.cell;
  let bestCount = -1;
  let bestCasterDistance = Infinity;

  for (const candidate of livingEnemies) {
    const affectedCount = livingEnemies.filter(
      (enemy) => calculateSharedBoardDistance(enemy.cell, candidate.cell) <= radius,
    ).length;
    const casterDistance = calculateSharedBoardDistance(caster.cell, candidate.cell);

    if (
      affectedCount > bestCount
      || (
        affectedCount === bestCount
        && (
          casterDistance < bestCasterDistance
          || (casterDistance === bestCasterDistance && candidate.cell < bestCenter)
        )
      )
    ) {
      bestCenter = candidate.cell;
      bestCount = affectedCount;
      bestCasterDistance = casterDistance;
    }
  }

  return bestCenter;
}

function buildLineCoordinates(from: BoardCoordinate, to: BoardCoordinate): BoardCoordinate[] {
  const coordinates: BoardCoordinate[] = [];
  let currentX = from.x;
  let currentY = from.y;
  const deltaX = Math.abs(to.x - from.x);
  const stepX = from.x < to.x ? 1 : -1;
  const deltaY = -Math.abs(to.y - from.y);
  const stepY = from.y < to.y ? 1 : -1;
  let error = deltaX + deltaY;

  while (true) {
    coordinates.push({ x: currentX, y: currentY });

    if (currentX === to.x && currentY === to.y) {
      return coordinates;
    }

    const doubledError = error * 2;
    if (doubledError >= deltaY) {
      error += deltaY;
      currentX += stepX;
    }
    if (doubledError <= deltaX) {
      error += deltaX;
      currentY += stepY;
    }
  }
}

function getUnitsOnBeamLine(caster: BattleUnit, primaryTarget: BattleUnit, enemies: BattleUnit[]): BattleUnit[] {
  const from = sharedBoardIndexToCoordinate(caster.cell);
  const to = sharedBoardIndexToCoordinate(primaryTarget.cell);
  const lineCoordinates = buildLineCoordinates(from, to);
  const lineSet = new Set(lineCoordinates.map((coordinate) => `${coordinate.x},${coordinate.y}`));

  return enemies.filter((enemy) => {
    if (enemy.isDead) {
      return false;
    }

    const coordinate = sharedBoardIndexToCoordinate(enemy.cell);
    return lineSet.has(`${coordinate.x},${coordinate.y}`);
  });
}

function selectAbsoluteJusticeBeamTargets(
  caster: BattleUnit,
  primaryTarget: BattleUnit,
  enemies: BattleUnit[],
  maxTargets: number,
): BattleUnit[] {
  const additionalBeamTargets = getUnitsOnBeamLine(caster, primaryTarget, enemies)
    .filter((enemy) => enemy.id !== primaryTarget.id)
    .sort((left, right) => {
      const distanceDiff = calculateSharedBoardDistance(caster.cell, left.cell)
        - calculateSharedBoardDistance(caster.cell, right.cell);
      if (distanceDiff !== 0) {
        return distanceDiff;
      }
      return left.cell - right.cell;
    })
    .slice(0, Math.max(0, maxTargets - 1));

  return [primaryTarget, ...additionalBeamTargets].slice(0, maxTargets);
}

function dealBossSpellDamage(
  caster: BattleUnit,
  targets: BattleUnit[],
  damageMultiplier: number,
  log: string[],
  spellName: string,
): void {
  const damage = Math.max(1, Math.round(
    caster.attackPower * caster.buffModifiers.attackMultiplier * damageMultiplier,
  ));

  for (const target of targets) {
    if (target.isDead) {
      continue;
    }

    target.hp = Math.max(0, target.hp - damage);
    log.push(`${caster.sourceUnitId ?? caster.type} ${spellName} hits ${target.sourceUnitId ?? target.type} for ${damage}`);
  }
}

function selectCrossTargets(
  caster: BattleUnit,
  enemies: BattleUnit[],
  range: number,
): BattleUnit[] {
  const casterCoordinate = sharedBoardIndexToCoordinate(caster.cell);
  return enemies.filter((enemy) => {
    if (enemy.isDead) {
      return false;
    }

    const coordinate = sharedBoardIndexToCoordinate(enemy.cell);
    const sameColumn = coordinate.x === casterCoordinate.x;
    const sameRow = coordinate.y === casterCoordinate.y;
    if (!sameColumn && !sameRow) {
      return false;
    }

    return sharedBoardManhattanDistance(casterCoordinate, coordinate) <= range;
  });
}

function selectAreaTargets(
  caster: BattleUnit,
  enemies: BattleUnit[],
  range: number,
): BattleUnit[] {
  const casterCoordinate = sharedBoardIndexToCoordinate(caster.cell);
  return enemies.filter((enemy) => {
    if (enemy.isDead) {
      return false;
    }

    const coordinate = sharedBoardIndexToCoordinate(enemy.cell);
    return sharedBoardManhattanDistance(casterCoordinate, coordinate) <= range;
  });
}

type HorizontalRushSelection = {
  targets: BattleUnit[];
  destinationCell: number | null;
};

function selectHorizontalRush(
  caster: BattleUnit,
  enemies: BattleUnit[],
): HorizontalRushSelection {
  const casterCoordinate = sharedBoardIndexToCoordinate(caster.cell);
  const livingEnemies = enemies.filter((enemy) => !enemy.isDead);
  const leftTargets: BattleUnit[] = [];
  const rightTargets: BattleUnit[] = [];

  for (const enemy of livingEnemies) {
    const coordinate = sharedBoardIndexToCoordinate(enemy.cell);
    if (Math.abs(coordinate.y - casterCoordinate.y) > 1) {
      continue;
    }
    if (coordinate.x < casterCoordinate.x) {
      leftTargets.push(enemy);
    } else if (coordinate.x > casterCoordinate.x) {
      rightTargets.push(enemy);
    }
  }

  const nearestDistance = (targets: BattleUnit[]) =>
    targets.reduce((best, target) => {
      const distance = Math.abs(sharedBoardIndexToCoordinate(target.cell).x - casterCoordinate.x);
      return Math.min(best, distance);
    }, Number.POSITIVE_INFINITY);

  const buildSelection = (targets: BattleUnit[], direction: "left" | "right"): HorizontalRushSelection => ({
    targets,
    destinationCell: targets.length > 0
      ? sharedBoardCoordinateToIndex({
        x: direction === "right" ? SHARED_BOARD_WIDTH - 1 : 0,
        y: casterCoordinate.y,
      })
      : null,
  });

  if (rightTargets.length !== leftTargets.length) {
    return rightTargets.length > leftTargets.length
      ? buildSelection(rightTargets, "right")
      : buildSelection(leftTargets, "left");
  }

  if (nearestDistance(rightTargets) !== nearestDistance(leftTargets)) {
    return nearestDistance(rightTargets) < nearestDistance(leftTargets)
      ? buildSelection(rightTargets, "right")
      : buildSelection(leftTargets, "left");
  }

  return rightTargets.length > 0
    ? buildSelection(rightTargets, "right")
    : buildSelection(leftTargets, "left");
}

function selectVerticalAdjustingHorizontalRush(
  caster: BattleUnit,
  enemies: BattleUnit[],
): HorizontalRushSelection {
  const casterCoordinate = sharedBoardIndexToCoordinate(caster.cell);
  const baseSelection = selectHorizontalRush(caster, enemies);
  const baseDestination = baseSelection.destinationCell !== null
    ? sharedBoardIndexToCoordinate(baseSelection.destinationCell)
    : null;
  const baseDirection = baseDestination?.x === 0
    ? "left"
    : baseDestination?.x === SHARED_BOARD_WIDTH - 1
      ? "right"
      : null;
  const rowCandidates = [casterCoordinate.y, casterCoordinate.y - 1, casterCoordinate.y + 1]
    .filter((row, index, rows) => row >= 0 && row < SHARED_BOARD_HEIGHT && rows.indexOf(row) === index);

  const collectTargets = (row: number, direction: "left" | "right") =>
    enemies.filter((enemy) => {
      if (enemy.isDead) {
        return false;
      }

      const coordinate = sharedBoardIndexToCoordinate(enemy.cell);
      if (Math.abs(coordinate.y - row) > 1) {
        return false;
      }

      return direction === "right"
        ? coordinate.x > casterCoordinate.x
        : coordinate.x < casterCoordinate.x;
    });

  const directionCandidates: ReadonlyArray<"left" | "right"> = baseDirection ? [baseDirection] : ["right", "left"];
  const best = directionCandidates
    .flatMap((direction) => rowCandidates.map((row) => ({
      direction,
      row,
      targets: collectTargets(row, direction),
    })))
    .sort((a, b) => {
      if (b.targets.length !== a.targets.length) {
        return b.targets.length - a.targets.length;
      }

      const aShift = Math.abs(a.row - casterCoordinate.y);
      const bShift = Math.abs(b.row - casterCoordinate.y);
      if (aShift !== bShift) {
        return aShift - bShift;
      }

      return a.row - b.row;
    })[0];

  if (!best || best.targets.length === 0) {
    return { targets: [], destinationCell: null };
  }

  return {
    targets: best.targets,
    destinationCell: sharedBoardCoordinateToIndex({
      x: best.direction === "right" ? SHARED_BOARD_WIDTH - 1 : 0,
      y: best.row,
    }),
  };
}

export const SKILL_DEFINITIONS: Record<BoardUnitType, SkillEffect> = {
  vanguard: {
    name: 'Shield Wall',
    activationModel: "cooldown",
    initialSkillDelayMs: 3000,
    skillCooldownMs: 7500,
    execute: (caster, allies, _enemies, log) => {
      for (const ally of allies) {
        if (!ally.isDead) {
          ally.buffModifiers.defenseMultiplier *= 1.5;
        }
      }
      log.push(`${caster.type} activates Shield Wall! All allies gain +50% defense`);
    }
  },
  ranger: {
    name: 'Precise Shot',
    activationModel: "cooldown",
    initialSkillDelayMs: 3000,
    skillCooldownMs: 6000,
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = selectLowestHpTarget(caster, enemies);
      if (target) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 2,
          target,
        );
        skillContext.dealDamage(caster, target, damage, "Precise Shot");
        log.push(`${caster.type} activates Precise Shot! Deals ${damage} damage to ${target.type}`);
      }
    }
  },
  mage: {
    name: 'Arcane Burst',
    activationModel: "cooldown",
    initialSkillDelayMs: 4000,
    skillCooldownMs: 8000,
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      for (const enemy of enemies) {
        if (!enemy.isDead) {
          const damage = calculateUltimateDamage(
            caster,
            caster.attackPower * caster.buffModifiers.attackMultiplier * 1.5,
            enemy,
          );
          skillContext.dealDamage(caster, enemy, damage, "Arcane Burst");
        }
      }
      const sampleTarget = enemies.find((enemy) => !enemy.isDead);
      const damage = sampleTarget
        ? calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 1.5,
          sampleTarget,
        )
        : 0;
      log.push(`${caster.type} activates Arcane Burst! Deals ${damage} damage to all enemies`);
    }
  },
  assassin: {
    name: 'Backstab',
    activationModel: "cooldown",
    initialSkillDelayMs: 2500,
    skillCooldownMs: 5000,
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = selectLowestHpTarget(caster, enemies);
      if (target) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 3,
          target,
        );
        skillContext.dealDamage(caster, target, damage, "Backstab");
        log.push(`${caster.type} activates Backstab! Deals ${damage} damage to ${target.type}`);
      }
    }
  }
};

export const STANDARD_TOUHOU_BASIC_SKILL_DEFINITIONS: Record<string, UnitSkillEffect> = {
  rin: {
    name: "死灰復燃",
    activationModel: "passive",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    execute: noopSkillExecute,
    combatHooks: {
      onAfterAllyDefeated: ({ unit, log }) => {
        const stackState = unit.stackState ?? {};
        const currentStacks = stackState["rin-shikaifukunen"] ?? 0;
        const values = resolveRinShikaifukunenValues(resolveSkillStage(unit));
        if (currentStacks >= values.maxStacks) {
          return;
        }

        const nextStacks = currentStacks + 1;
        unit.stackState = {
          ...stackState,
          "rin-shikaifukunen": nextStacks,
        };
        unit.buffModifiers.attackMultiplier *= values.attackMultiplier;
        unit.damageTakenMultiplier = (unit.damageTakenMultiplier ?? 1) * values.incomingDamageMultiplier;
        log.push(`${unit.sourceUnitId ?? unit.type} activates 死灰復燃 (${nextStacks}/${values.maxStacks})`);
      },
    },
  },
  nazrin: {
    name: "ナズーリンペンデュラム",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 80,
      manaGainOnAttack: 15,
      manaGainOnDamageTakenRatio: 60,
    },
    canActivate: (caster, _allies, enemies) =>
      selectLowestHpRatioTargetWithinRange(caster, enemies) !== null,
    execute: (caster, _allies, enemies, log, context) => {
      const target = selectLowestHpRatioTargetWithinRange(caster, enemies);
      if (!target) {
        return;
      }

      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const values = resolveNazrinPendulumValues(stage);
      const damage = Math.max(
        1,
        Math.round(caster.attackPower * caster.buffModifiers.attackMultiplier * values.damageMultiplier),
      );
      target.stackState = {
        ...(target.stackState ?? {}),
        [getNazrinTreasureMarkExpiresAtKey(caster)]: skillContext.currentTimeMs + values.markDurationMs,
        [getNazrinTreasureMarkRewardKey(caster)]: values.rewardGold,
      };
      target.hp -= damage;
      log.push(`${caster.sourceUnitId ?? caster.type} activates ナズーリンペンデュラム for ${damage} damage`);
      log.push(
        `${target.sourceUnitId ?? target.type} gains トレジャーマーク for ${values.markDurationMs}ms`,
      );
    },
    combatHooks: {
      onAfterUnitDefeated: ({ unit, defeatedUnit, currentTimeMs, grantGoldReward, log }) => {
        if (unit.stackState?.[NAZRIN_TREASURE_REWARD_CLAIMED_KEY]) {
          return;
        }

        const expiresAt = defeatedUnit.stackState?.[getNazrinTreasureMarkExpiresAtKey(unit)] ?? 0;
        if (expiresAt < currentTimeMs) {
          return;
        }

        const rewardGold = defeatedUnit.stackState?.[getNazrinTreasureMarkRewardKey(unit)] ?? 0;
        if (rewardGold <= 0) {
          return;
        }

        unit.stackState = {
          ...(unit.stackState ?? {}),
          [NAZRIN_TREASURE_REWARD_CLAIMED_KEY]: 1,
        };
        grantGoldReward?.(unit.ownerPlayerId, rewardGold, "nazrin_treasure_mark");
        log.push(`${unit.sourceUnitId ?? unit.type} claims トレジャーマーク for ${rewardGold} gold`);
      },
    },
  },
  koishi: {
    name: "無意識の遺伝子",
    activationModel: "passive",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    execute: noopSkillExecute,
    combatHooks: {
      onBattleStart: ({ unit, log }) => {
        const values = resolveKoishiUnconsciousValues(resolveSkillStage(unit));
        unit.stackState = {
          ...(unit.stackState ?? {}),
          "koishi-unconscious": 1,
        };
        unit.targetPriorityMultiplier = values.targetPriorityMultiplier;
        log.push(`${unit.sourceUnitId ?? unit.type} enters 無意識の遺伝子`);
      },
      selectAttackTarget: ({ unit, defaultTarget, enemies }) => {
        if (unit.stackState?.["koishi-unconscious"] !== 1) {
          return defaultTarget;
        }

        return selectKoishiBacklineTarget(unit, enemies) ?? defaultTarget;
      },
      onAfterDealDamage: ({ unit, target, actualDamage, log, applyTimedModifier }) => {
        if (actualDamage <= 0 || unit.stackState?.["koishi-unconscious"] !== 1) {
          return;
        }

        const values = resolveKoishiUnconsciousValues(resolveSkillStage(unit));
        if (!target.isDead && values.revealDamageMultiplier > 0) {
          const bonusDamage = Math.max(
            1,
            Math.round(unit.attackPower * unit.buffModifiers.attackMultiplier * values.revealDamageMultiplier),
          );
          target.hp -= bonusDamage;
          log.push(`${unit.sourceUnitId ?? unit.type} 無意識の遺伝子 reveal hit deals ${bonusDamage}`);
        }

        unit.stackState = {
          ...(unit.stackState ?? {}),
          "koishi-unconscious": 0,
        };
        unit.targetPriorityMultiplier = 1;
        const perfectMindControlLevel = resolveNormalPairSkillLevel(unit, PERFECT_MIND_CONTROL_PAIR_ID);
        if (perfectMindControlLevel) {
          const { durationMs, targetPriorityMultiplier } =
            resolvePerfectMindControlValues(perfectMindControlLevel);
          applyTimedModifier(unit, {
            id: PERFECT_MIND_CONTROL_PAIR_ID,
            durationMs,
            targetPriorityMultiplier,
          });
          log.push(
            `${unit.sourceUnitId ?? unit.type} keeps パーフェクトマインドコントロール stealth for ${durationMs}ms`,
          );
        }
        log.push(`${unit.sourceUnitId ?? unit.type} reveals herself from 無意識の遺伝子`);
      },
    },
  },
  satori: {
    name: "想起「読心裁断」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 85,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 30,
    },
    canActivate: (caster, _allies, enemies, context) => {
      const skillContext = resolveSkillContext(context, []);
      return skillContext.findCurrentOrNearestTarget(caster, enemies) !== null;
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!target) {
        return;
      }

      const combatClass = resolveBattleUnitCombatClass(target);
      const values = resolveSatoriMindReadValues(resolveSkillStage(caster));
      if (combatClass === "vanguard") {
        skillContext.applyTimedModifier(target, {
          id: "satori-mind-read-vanguard",
          durationMs: values.durationMs,
          incomingDamageMultiplier: values.vanguardIncomingDamageMultiplier,
        });
      } else if (combatClass === "ranger") {
        skillContext.applyTimedModifier(target, {
          id: "satori-mind-read-ranger",
          durationMs: values.durationMs,
          attackMultiplier: values.rangerAttackMultiplier,
        });
      } else if (combatClass === "assassin") {
        skillContext.applyTimedModifier(target, {
          id: "satori-mind-read-assassin",
          durationMs: values.assassinDurationMs,
          attackSpeedMultiplier: values.assassinAttackSpeedMultiplier,
        });
      } else {
        target.currentMana = Math.max(0, (target.currentMana ?? 0) - values.mageManaReduction);
        skillContext.applyTimedModifier(target, {
          id: "satori-mind-read-mage",
          durationMs: values.durationMs,
          manaGainMultiplier: values.mageManaGainMultiplier,
        });
      }

      log.push(
        `${caster.sourceUnitId ?? caster.type} activates 想起「読心裁断」 on ${target.sourceUnitId ?? target.type} (${combatClass})`,
      );
    },
  },
  utsuho: {
    name: "メガフレア",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 25,
      manaCost: 90,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 25,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const primaryTarget = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!primaryTarget) {
        return;
      }

      const values = resolveUtsuhoMegaFlareValues(resolveSkillStage(caster));
      const impactCell = primaryTarget.cell;
      skillContext.scheduleSkillTicks(caster, {
        id: "utsuho-mega-flare",
        initialDelayMs: values.chargeDelayMs,
        intervalMs: 700,
        tickCount: 1,
        selectTarget: (_source, _tickAllies, tickEnemies) =>
          tickEnemies.find((enemy) => !enemy.isDead && enemy.cell === impactCell) ?? null,
        selectTargets: (_source, _tickAllies, tickEnemies) =>
          selectUnitsWithinRange(impactCell, tickEnemies, values.radius),
        calculateDamage: (source, target) => {
          const multiplier = target.cell === impactCell
            ? values.primaryDamageMultiplier
            : values.splashDamageMultiplier;
          return Math.max(
            1,
            Math.round(source.attackPower * source.buffModifiers.attackMultiplier * multiplier),
          );
        },
        describeTick: (source, target, damage) =>
          `${source.sourceUnitId ?? source.type} メガフレア hits ${target.sourceUnitId ?? target.type} for ${damage}`,
      });
      log.push(`${caster.sourceUnitId ?? caster.type} activates メガフレア`);
    },
  },
  yoshika: {
    name: "死なない殺人鬼",
    activationModel: "passive",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    execute: noopSkillExecute,
    combatHooks: {
      onBeforeLethalDamage: ({ unit, log, applyTimedModifier }) => {
        const stackState = unit.stackState ?? {};
        const reviveCount = stackState["yoshika-revived"] ?? 0;
        const tonglingPairLevel = resolveTonglingYoshikaPairLevel(unit);
        const reviveValues = resolveYoshikaReviveValues(resolveSkillStage(unit), tonglingPairLevel);
        if (reviveCount >= reviveValues.maxRevives) {
          return;
        }

        const revivedHp = Math.max(1, Math.floor(unit.maxHp * reviveValues.reviveHpRatio));
        unit.stackState = {
          ...stackState,
          "yoshika-revived": reviveCount + 1,
        };
        unit.hp = revivedHp;
        applyTimedModifier(unit, {
          id: "yoshika-post-revive-guard",
          durationMs: reviveValues.guardDurationMs,
          incomingDamageMultiplier: reviveValues.incomingDamageMultiplier,
        });
        const boostLabel = tonglingPairLevel ? " with トンリン芳香" : "";
        log.push(`${unit.sourceUnitId ?? unit.type} activates 死なない殺人鬼${boostLabel} (${revivedHp}/${unit.maxHp})`);
      },
    },
  },
  seiga: {
    name: "ウォールランナー",
    activationModel: "passive",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    execute: noopSkillExecute,
    combatHooks: {
      selectAttackTarget: ({ unit, defaultTarget, allies, enemies, currentTimeMs, log }) => {
        const target = selectSeigaWallRunnerTarget(unit, enemies, defaultTarget);
        if (target) {
          trySeigaWallRun(unit, target, allies, enemies, currentTimeMs, log);
        }
        return target;
      },
      onAfterAttackHit: ({ unit, target, log }) => {
        if (unit.stackState?.["seiga-wall-run-empowered"] !== 1 || target.isDead) {
          return;
        }

        const values = resolveSeigaWallRunnerValues(resolveSkillStage(unit));
        const bonusDamage = Math.max(
          1,
          Math.round(unit.attackPower * unit.buffModifiers.attackMultiplier * values.empoweredDamageMultiplier),
        );
        target.hp -= bonusDamage;
        unit.stackState = {
          ...(unit.stackState ?? {}),
          "seiga-wall-run-empowered": 0,
        };
        log.push(`${unit.sourceUnitId ?? unit.type} ウォールランナー empowers hit for ${bonusDamage}`);
      },
    },
  },
  wakasagihime: {
    name: "テイルフィンスラップ",
    activationModel: "passive",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    execute: noopSkillExecute,
    combatHooks: {
      onAfterAttackHit: ({ unit, target, log }) => {
        const nextAttackCount = unit.attackCount + 1;
        const values = resolveWakasagihimeTailFinValues(resolveSkillStage(unit));
        if (nextAttackCount % values.triggerEveryAttacks !== 0 || target.isDead) {
          return;
        }

        const hitDamage = Math.max(
          1,
          Math.round(unit.attackPower * unit.buffModifiers.attackMultiplier * values.damageMultiplierPerHit),
        );
        const bonusDamage = hitDamage * values.hitCount;
        target.hp -= bonusDamage;
        log.push(
          `${unit.sourceUnitId ?? unit.type} activates テイルフィンスラップ `
          + `for ${values.hitCount} hits (${bonusDamage} damage)`,
        );
      },
    },
  },
  ichirin: {
    name: "げんこつスマッシュ",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 30,
      manaCost: 80,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 60,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!target) {
        return;
      }

      const values = resolveIchirinGenkotsuValues(resolveSkillStage(caster));
      const targets = selectUnitsWithinRange(target.cell, enemies, values.radius);
      const damage = Math.max(
        1,
        Math.round(caster.attackPower * caster.buffModifiers.attackMultiplier * values.damageMultiplier),
      );
      for (const enemy of targets) {
        enemy.hp -= damage;
      }

      if (targets.length >= 2) {
        skillContext.applyTimedModifier(caster, {
          id: "ichirin-genkotsu-mitigation",
          durationMs: values.guardDurationMs,
          incomingDamageMultiplier: values.incomingDamageMultiplier,
        });
      }
      log.push(`${caster.sourceUnitId ?? caster.type} activates げんこつスマッシュ on ${targets.length} enemies`);
    },
  },
  tojiko: {
    name: "入鹿の雷",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 80,
      manaGainOnAttack: 14,
      manaGainOnDamageTakenRatio: 40,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const primary = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!primary) {
        return;
      }

      const values = resolveTojikoIrukaThunderValues(resolveSkillStage(caster));
      const primaryDamage = Math.max(
        1,
        Math.round(caster.attackPower * caster.buffModifiers.attackMultiplier * values.primaryDamageMultiplier),
      );
      const chainDamage = Math.max(
        1,
        Math.round(caster.attackPower * caster.buffModifiers.attackMultiplier * values.chainDamageMultiplier),
      );
      primary.hp -= primaryDamage;

      const chainedTargets = enemies
        .filter((enemy) =>
          !enemy.isDead
          && enemy.id !== primary.id
          && calculateSharedBoardDistance(primary.cell, enemy.cell) <= values.chainRadius
        )
        .sort((left, right) => {
          const distanceDiff = calculateSharedBoardDistance(primary.cell, left.cell)
            - calculateSharedBoardDistance(primary.cell, right.cell);
          if (distanceDiff !== 0) {
            return distanceDiff;
          }
          return left.cell - right.cell;
        })
        .slice(0, values.maxChainTargets);
      for (const enemy of chainedTargets) {
        enemy.hp -= chainDamage;
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 入鹿の雷 with ${chainedTargets.length} chains`);
    },
  },
  futo: {
    name: "太乙真火",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 30,
      manaCost: 85,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 30,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const primaryTarget = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!primaryTarget) {
        return;
      }

      const values = resolveFutoTaiyiTrueFireValues(resolveSkillStage(caster));
      const formationCells = selectFutoTaiyiTrueFireFormationCells(
        primaryTarget,
        enemies,
        values.radius,
        values.formationCount,
      );
      const slowedTargetIds = new Set<string>();
      for (const formationCell of formationCells) {
        for (const target of selectUnitsWithinRange(formationCell, enemies, values.radius)) {
          if (slowedTargetIds.has(target.id)) {
            continue;
          }

          slowedTargetIds.add(target.id);
          skillContext.applyTimedModifier(target, {
            id: "futo-taiyi-true-fire-slow",
            durationMs: values.durationMs,
            attackSpeedMultiplier: values.attackSpeedMultiplier,
          });
        }
      }

      for (const formationCell of formationCells) {
        skillContext.scheduleSkillTicks(caster, {
          id: "futo-taiyi-true-fire",
          initialDelayMs: 0,
          intervalMs: values.intervalMs,
          tickCount: values.tickCount,
          selectTarget: (_source, _tickAllies, tickEnemies) =>
            tickEnemies.find((enemy) => !enemy.isDead && enemy.cell === formationCell) ?? null,
          selectTargets: (_source, _tickAllies, tickEnemies) =>
            selectUnitsWithinRange(formationCell, tickEnemies, values.radius),
          calculateDamage: (source) =>
            Math.max(
              1,
              Math.round(
                source.attackPower
                * source.buffModifiers.attackMultiplier
                * values.tickDamageMultiplier,
              ),
            ),
          describeTick: (source, target, damage) =>
            `${source.sourceUnitId ?? source.type} 太乙真火 burns ${target.sourceUnitId ?? target.type} for ${damage}`,
        });
      }
      log.push(`${caster.sourceUnitId ?? caster.type} activates 太乙真火 with ${formationCells.length} formations`);
    },
  },
  kagerou: {
    name: "満月の遠吠え",
    activationModel: "passive",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    execute: noopSkillExecute,
    combatHooks: {
      selectAttackTarget: ({ unit, enemies, currentTimeMs, defaultTarget }) => {
        const transformedUntil = unit.stackState?.["kagerou-transformed-until"] ?? 0;
        if (unit.stackState?.["kagerou-transformed"] !== 1 || transformedUntil <= currentTimeMs) {
          return defaultTarget;
        }

        return enemies.find((enemy) => enemy.id === unit.currentTargetId && !enemy.isDead) ?? defaultTarget;
      },
      onAfterTakeDamage: ({ unit, actualDamage, currentTimeMs, log, applyTimedModifier }) => {
        const stackState = unit.stackState ?? {};
        if (stackState["kagerou-transformed"]) {
          return;
        }

        const values = resolveKagerouFullMoonHowlValues(resolveSkillStage(unit));
        const accumulatedDamage = (stackState["kagerou-damage-taken"] ?? 0) + actualDamage;
        if (accumulatedDamage < unit.maxHp * values.triggerDamageRatio) {
          unit.stackState = {
            ...stackState,
            "kagerou-damage-taken": accumulatedDamage,
          };
          return;
        }

        const healAmount = Math.max(1, Math.floor(unit.maxHp * values.healRatio));
        unit.stackState = {
          ...stackState,
          "kagerou-damage-taken": accumulatedDamage,
          "kagerou-transformed": 1,
          "kagerou-transformed-until": currentTimeMs + values.durationMs,
        };
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmount);
        applyTimedModifier(unit, {
          id: "kagerou-full-moon-howl",
          durationMs: values.durationMs,
          attackSpeedMultiplier: values.attackSpeedMultiplier,
        });
        log.push(`${unit.sourceUnitId ?? unit.type} activates 満月の遠吠え`);
      },
    },
  },
  tsukasa: {
    name: "シリンダーフォックス",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 80,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 40,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const values = resolveTsukasaCylinderFoxValues(resolveSkillStage(caster));
      const target = selectHighestAttackTargetWithinRange(
        caster,
        enemies,
        caster.attackRange + values.searchRangeBonus,
      );
      if (!target) {
        return;
      }

      const skillContext = resolveSkillContext(context, log);
      skillContext.applyTimedModifier(target, {
        id: "tsukasa-cylinder-fox",
        durationMs: values.durationMs,
        attackMultiplier: values.attackMultiplier,
        incomingDamageMultiplier: values.incomingDamageMultiplier,
      });
      log.push(`${caster.sourceUnitId ?? caster.type} activates シリンダーフォックス`);
    },
  },
  megumu: {
    name: "光風霽月",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 45,
      manaCost: 80,
      manaGainOnAttack: 14,
      manaGainOnDamageTakenRatio: 35,
    },
    execute: (caster, allies, _enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const values = resolveMegumuLightWindClearMoonValues(resolveSkillStage(caster));
      let buffedCount = 0;
      for (const ally of allies) {
        if (ally.isDead) {
          continue;
        }

        skillContext.applyTimedModifier(ally, {
          id: "megumu-light-wind-clear-moon",
          durationMs: values.durationMs,
          attackSpeedMultiplier: values.attackSpeedMultiplier,
        });
        buffedCount += 1;
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 光風霽月 on ${buffedCount} allies`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, _enemies);
    },
  },
  chimata: {
    name: "バレットマーケット",
    activationModel: "passive",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    execute: noopSkillExecute,
  },
  junko: {
    name: "殺意の百合",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 80,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 55,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!target) {
        return;
      }

      const purificationKey = getJunkoPurificationKey(caster);
      const values = resolveJunkoLilyOfMurderValues(resolveSkillStage(caster));
      target.stackState = {
        ...(target.stackState ?? {}),
        [purificationKey]: skillContext.currentTimeMs + values.purificationDurationMs,
      };
      caster.currentTargetId = target.id;
      log.push(`${caster.sourceUnitId ?? caster.type} activates 殺意の百合 on ${target.sourceUnitId ?? target.type}`);
    },
    combatHooks: {
      selectAttackTarget: ({ unit, enemies, currentTimeMs, defaultTarget }) =>
        selectJunkoPurifiedTarget(unit, enemies, currentTimeMs) ?? defaultTarget,
      onAfterAttackHit: ({ unit, target, currentTimeMs, log }) => {
        const purificationKey = getJunkoPurificationKey(unit);
        const purificationExpiresAt = target.stackState?.[purificationKey] ?? 0;
        if (purificationExpiresAt <= currentTimeMs) {
          return;
        }

        const values = resolveJunkoLilyOfMurderValues(resolveSkillStage(unit));
        if (target.hp / Math.max(1, target.maxHp) > values.executionHpRatio) {
          return;
        }

        target.stackState = {
          ...(target.stackState ?? {}),
          [purificationKey]: 0,
        };
        if (target.isBoss) {
          const bossExecutionDamage = Math.max(
            1,
            Math.round(unit.attackPower * unit.buffModifiers.attackMultiplier * values.bossExecutionDamageMultiplier),
          );
          target.hp -= bossExecutionDamage;
          log.push(`${unit.sourceUnitId ?? unit.type} 処刑 deals ${bossExecutionDamage} capped damage`);
          return;
        }

        target.hp = 0;
        log.push(`${unit.sourceUnitId ?? unit.type} 処刑 executes ${target.sourceUnitId ?? target.type}`);
      },
    },
  },
  hecatia: {
    name: "トリニタリアンラプソディ",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 30,
      manaCost: 90,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 35,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const primary = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!primary) {
        return;
      }

      const values = resolveHecatiaTrinitarianRhapsodyValues(resolveSkillStage(caster));
      const attackValue = caster.attackPower * caster.buffModifiers.attackMultiplier;
      const primaryDamage = Math.max(1, Math.round(attackValue * values.primaryDamageMultiplier));
      const supplementalDamage = Math.max(1, Math.round(attackValue * values.supplementalDamageMultiplier));

      primary.hp -= primaryDamage;

      const supplementalTargets = enemies
        .filter((enemy) => !enemy.isDead && enemy.id !== primary.id)
        .sort((left, right) => {
          const distanceDiff = calculateSharedBoardDistance(primary.cell, left.cell)
            - calculateSharedBoardDistance(primary.cell, right.cell);
          if (distanceDiff !== 0) {
            return distanceDiff;
          }

          const hpRatioDiff = (left.hp / Math.max(1, left.maxHp))
            - (right.hp / Math.max(1, right.maxHp));
          if (hpRatioDiff !== 0) {
            return hpRatioDiff;
          }

          return left.cell - right.cell;
        })
        .slice(0, 2);

      for (const target of supplementalTargets) {
        target.hp -= supplementalDamage;
      }

      log.push(
        `${caster.sourceUnitId ?? caster.type} activates トリニタリアンラプソディ on ${1 + supplementalTargets.length} targets`,
      );
    },
  },
  zanmu: {
    name: "無心純霊弾",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 20,
      manaCost: 90,
      manaGainOnAttack: 10,
      manaGainOnDamageTakenRatio: 20,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!target) {
        return;
      }

      const values = resolveZanmuValues(resolveSkillStage(caster));
      target.unitSkillDisabledUntilMs = Math.max(
        target.unitSkillDisabledUntilMs ?? 0,
        skillContext.currentTimeMs + values.disableDurationMs,
      );
      log.push(`${caster.sourceUnitId ?? caster.type} activates 無心純霊弾 on ${target.sourceUnitId ?? target.type}`);
    },
    combatHooks: {
      onBattleStart: ({ unit, allies, log }) => {
        const values = resolveZanmuValues(resolveSkillStage(unit));
        unit.initialManaBonus = (unit.initialManaBonus ?? 0) + values.initialManaBonus;
        unit.manaGainMultiplier = (unit.manaGainMultiplier ?? 1) * values.manaGainMultiplier;

        const uniqueFactionCount = countUniqueFactionIds(allies);
        if (uniqueFactionCount <= 0) {
          return;
        }

        unit.buffModifiers.attackMultiplier *= 1 + uniqueFactionCount * values.attackMultiplierPerFaction;
        unit.damageTakenMultiplier = (unit.damageTakenMultiplier ?? 1)
          * (1 - uniqueFactionCount * values.damageReductionPerFaction);
        log.push(`${unit.sourceUnitId ?? unit.type} activates 亡羊のキングダム with ${uniqueFactionCount} factions`);
      },
    },
  },
  miko: {
    name: "逆らう事なきを宗とせよ",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 25,
      manaCost: 90,
      manaGainOnAttack: 11,
      manaGainOnDamageTakenRatio: 30,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const values = resolveMikoObeyWithoutResistanceValues(resolveSkillStage(caster));
      for (const enemy of enemies) {
        if (enemy.isDead) {
          continue;
        }

        skillContext.applyTimedModifier(enemy, {
          id: "miko-obey-without-resistance",
          durationMs: values.durationMs,
          attackMultiplier: values.attackMultiplier,
        });
      }

      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      const damagedTargets = target ? selectUnitsWithinRange(target.cell, enemies, values.radius) : [];
      const damage = Math.max(
        1,
        Math.round(caster.attackPower * caster.buffModifiers.attackMultiplier * values.damageMultiplier),
      );
      for (const damagedTarget of damagedTargets) {
        damagedTarget.hp -= damage;
      }

      log.push(
        `${caster.sourceUnitId ?? caster.type} activates 逆らう事なきを宗とせよ on ${damagedTargets.length} enemies`,
      );
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
    combatHooks: {
      onBattleStart: ({ unit }) => {
        const values = resolveMikoObeyWithoutResistanceValues(resolveSkillStage(unit));
        unit.initialManaBonus = (unit.initialManaBonus ?? 0) + values.initialManaBonus;
        unit.manaGainMultiplier = (unit.manaGainMultiplier ?? 1) * values.manaGainMultiplier;
      },
    },
  },
  byakuren: {
    name: "超人「聖白蓮」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 90,
      manaGainOnAttack: 13,
      manaGainOnDamageTakenRatio: 45,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const values = resolveByakurenSuperhumanValues(resolveSkillStage(caster));
      const memberCount = Math.max(1, Math.min(5, countUniqueMyourenjiMembers(allies)));
      const attackMultiplier = values.attackMultipliersByMemberCount[memberCount - 1] ?? 1.18;
      const attackValueBeforeBuff = caster.attackPower * caster.buffModifiers.attackMultiplier;

      skillContext.applyTimedModifier(caster, {
        id: "byakuren-superhuman",
        durationMs: values.durationMs,
        attackMultiplier,
        incomingDamageMultiplier: values.incomingDamageMultiplier,
      });

      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (target) {
        const chargeDamage = Math.max(1, Math.round(attackValueBeforeBuff * values.chargeDamageMultiplier));
        target.hp -= chargeDamage;
      }

      log.push(
        `${caster.sourceUnitId ?? caster.type} activates 超人「聖白蓮」 with ${memberCount} Myourenji members`,
      );
    },
  },
  shou: {
    name: "アブソリュートジャスティス",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 85,
      manaGainOnAttack: 13,
      manaGainOnDamageTakenRatio: 30,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const values = resolveShouAbsoluteJusticeValues(resolveSkillStage(caster));
      const buffTarget = selectNearestAlly(caster, allies);
      skillContext.applyTimedModifier(buffTarget, {
        id: "shou-absolute-justice",
        durationMs: values.durationMs,
        attackMultiplier: values.attackMultiplier,
      });

      const primaryTarget = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!primaryTarget) {
        log.push(`${caster.sourceUnitId ?? caster.type} activates アブソリュートジャスティス without a beam target`);
        return;
      }

      const beamTargets = selectAbsoluteJusticeBeamTargets(caster, primaryTarget, enemies, values.maxBeamTargets);
      const damage = Math.max(
        1,
        Math.round(caster.attackPower * caster.buffModifiers.attackMultiplier * values.beamDamageMultiplier),
      );
      for (const target of beamTargets) {
        target.hp -= damage;
      }

      log.push(
        `${caster.sourceUnitId ?? caster.type} activates アブソリュートジャスティス on ${beamTargets.length} enemies`,
      );
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  momoyo: {
    name: "ドラゴンイーター",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 30,
      manaCost: 90,
      manaGainOnAttack: 14,
      manaGainOnDamageTakenRatio: 70,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!target) {
        return;
      }

      const values = resolveMomoyoDragonEaterValues(resolveSkillStage(caster));
      const attackPower = caster.attackPower * caster.buffModifiers.attackMultiplier;
      const rawDamage = attackPower * values.attackDamageMultiplier
        + target.maxHp * values.targetMaxHpDamageRatio;
      const damageCap = attackPower * values.damageCapMultiplier;
      const damage = Math.max(1, Math.round(Math.min(rawDamage, damageCap)));
      target.hp -= damage;
      log.push(`${caster.sourceUnitId ?? caster.type} activates ドラゴンイーター for ${damage} damage`);
    },
  },
  clownpiece: {
    name: "ヘルエクリプス",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 80,
      manaGainOnAttack: 14,
      manaGainOnDamageTakenRatio: 35,
    },
    execute: (caster, allies, _enemies, log, context) => {
      const target = selectNearestAlly(caster, allies);
      const skillContext = resolveSkillContext(context, log);
      const values = resolveClownpieceHellEclipseValues(resolveSkillStage(caster));
      skillContext.applyTimedModifier(target, {
        id: "clownpiece-hell-eclipse",
        durationMs: values.durationMs,
        attackMultiplier: values.attackMultiplier,
        attackSpeedMultiplier: values.attackSpeedMultiplier,
        incomingDamageMultiplier: values.incomingDamageMultiplier,
      });
      log.push(`${caster.sourceUnitId ?? caster.type} activates ヘルエクリプス on ${target.sourceUnitId ?? target.type}`);
    },
  },
  sekibanki: {
    name: "フライングヘッド",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 80,
      manaGainOnAttack: 14,
      manaGainOnDamageTakenRatio: 50,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const initialTarget = selectSekibankiFlyingHeadTarget(caster, enemies);
      if (!initialTarget) {
        return;
      }

      const values = resolveSekibankiFlyingHeadValues(resolveSkillStage(caster));
      const skillContext = resolveSkillContext(context, log);
      skillContext.scheduleSkillTicks(caster, {
        id: "sekibanki-flying-head",
        initialDelayMs: 0,
        intervalMs: values.intervalMs,
        tickCount: values.tickCount,
        selectTarget: (source, _allies, tickEnemies) => selectSekibankiFlyingHeadTarget(source, tickEnemies),
        calculateDamage: (source) =>
          Math.max(
            1,
            Math.round(source.attackPower * source.buffModifiers.attackMultiplier * values.damageMultiplier),
          ),
        describeTick: (source, target, damage) =>
          `${source.sourceUnitId ?? source.type} フライングヘッド hits ${target.sourceUnitId ?? target.type} for ${damage}`,
      });
      log.push(`${caster.sourceUnitId ?? caster.type} activates フライングヘッド on ${initialTarget.sourceUnitId ?? initialTarget.type}`);
    },
  },
  murasa: {
    name: "ディープシンカー",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 80,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 45,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!target) {
        return;
      }

      const values = resolveMurasaDeepSinkerValues(resolveSkillStage(caster));
      const targets = selectUnitsWithinRange(target.cell, enemies, values.radius);
      const damage = Math.max(
        1,
        Math.round(caster.attackPower * caster.buffModifiers.attackMultiplier * values.damageMultiplier),
      );

      for (const enemy of targets) {
        enemy.hp -= damage;
        skillContext.applyTimedModifier(enemy, {
          id: "murasa-deep-sinker-slow",
          durationMs: values.durationMs,
          attackSpeedMultiplier: values.attackSpeedMultiplier,
        });
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates ディープシンカー on ${targets.length} enemies`);
    },
  },
};

export const HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS: Record<string, UnitSkillEffect> = {
  "mayumi-basic": {
    name: "埴輪「熟練剣士埴輪」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 100,
      manaGainOnAttack: 9,
      manaGainOnDamageTakenRatio: 55,
    },
    execute: (caster, _allies, _enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      skillContext.applyTimedModifier(caster, {
        id: "mayumi-skilled-swordsman",
        durationMs: 6000,
        attackMultiplier: stage >= 7 ? 1.60 : stage >= 4 ? 1.35 : 1.20,
        defenseMultiplier: stage >= 7 ? 1.80 : stage >= 4 ? 1.50 : 1.30,
      });
      log.push(`${caster.sourceUnitId ?? caster.type} activates 埴輪「熟練剣士埴輪」`);
    },
  },
  "shion-basic": {
    name: "貧符「超貧乏玉」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 9,
      manaGainOnDamageTakenRatio: 25,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const target = skillContext.findCurrentOrNearestTarget(caster, enemies);
      if (!target) {
        return;
      }

      const stage = resolveSkillStage(caster);
      const damageMultiplier = stage >= 7 ? 2.5 : stage >= 4 ? 1.8 : 1.3;
      const damage = calculateUltimateDamage(
        caster,
        caster.attackPower * caster.buffModifiers.attackMultiplier * damageMultiplier,
        target,
      );
      skillContext.dealDamage(caster, target, damage, "貧符「超貧乏玉」");
      skillContext.applyTimedModifier(target, {
        id: "shion-poverty-orb",
        durationMs: 6000,
        attackMultiplier: stage >= 7 ? 0.55 : stage >= 4 ? 0.70 : 0.80,
      });
      log.push(`${caster.sourceUnitId ?? caster.type} activates 貧符「超貧乏玉」`);
    },
  },
  "ariya-basic": {
    name: "ストーンゴッデス",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 100,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 35,
    },
    execute: (caster, _allies, _enemies, log) => {
      const stage = resolveSkillStage(caster);
      const maxStacks = stage >= 7 ? 8 : stage >= 4 ? 7 : 6;
      const attackPerStack = stage >= 7 ? 0.09 : stage >= 4 ? 0.07 : 0.05;
      const defensePerStack = stage >= 7 ? 0.06 : stage >= 4 ? 0.05 : 0.04;
      const key = "ariya-stone-goddess";
      const currentStacks = caster.stackState?.[key] ?? 0;
      if (currentStacks >= maxStacks) {
        return;
      }

      caster.stackState = {
        ...(caster.stackState ?? {}),
        [key]: currentStacks + 1,
      };
      caster.buffModifiers.attackMultiplier += attackPerStack;
      caster.buffModifiers.defenseMultiplier += defensePerStack;
      log.push(`${caster.sourceUnitId ?? caster.type} activates ストーンゴッデス`);
    },
  },
};

export const SCARLET_MANSION_BASIC_SKILL_DEFINITIONS: Record<string, UnitSkillEffect> = {
  meiling: {
    name: "彩華「虹色太極拳」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 40,
      manaCost: 100,
      manaGainOnAttack: 10,
      manaGainOnDamageTakenRatio: 70,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const incomingDamageMultiplier = stage >= 7 ? 0.64 : stage >= 4 ? 0.72 : 0.80;

      skillContext.applyTimedModifier(caster, {
        id: "meiling-rainbow-taijiquan-guard",
        durationMs: 6000,
        incomingDamageMultiplier,
      });

      for (const enemy of selectUnitsWithinRange(caster.cell, enemies, 3)) {
        skillContext.applyTimedModifier(enemy, {
          id: "meiling-rainbow-taijiquan-taunt",
          durationMs: 6000,
          tauntTargetId: caster.id,
        });
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 彩華「虹色太極拳」`);
    },
  },
  sakuya: {
    name: "時符「プライベートスクウェア」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 20,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const target = selectHighestAttackTarget(enemies);
      if (!target) {
        return;
      }

      const stage = resolveSkillStage(caster);
      const skillContext = resolveSkillContext(context, log);
      skillContext.applyTimedModifier(target, {
        id: "sakuya-private-square",
        durationMs: 6000,
        attackSpeedMultiplier: stage >= 7 ? 0.58 : stage >= 4 ? 0.68 : 0.78,
        movementSpeedMultiplier: stage >= 7 ? 0.40 : stage >= 4 ? 0.55 : 0.70,
      });
      log.push(`${caster.sourceUnitId ?? caster.type} activates 時符「プライベートスクウェア」`);
    },
  },
  patchouli: {
    name: "日符「ロイヤルフレア」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 0,
      manaCost: 100,
      manaGainOnAttack: 8,
      manaGainOnDamageTakenRatio: 20,
    },
    execute: (caster, _allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const damageMultiplier = stage >= 7 ? 3.6 : stage >= 4 ? 3.0 : 2.6;
      const targets = selectUnitsWithinRange(caster.cell, enemies, 3);

      for (const target of targets) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * damageMultiplier,
          target,
        );
        skillContext.dealDamage(caster, target, damage, "日符「ロイヤルフレア」");
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 日符「ロイヤルフレア」`);
    },
  },
};

export const PAIR_SKILL_DEFINITIONS: Record<string, PairSkillEffect> = {
  "mayumi-pair": {
    name: "埴輪「アイドルクリーチャー」",
    executeOnMainSkillActivated: (main, _allies, _enemies, log, context, pairSkillLevel) => {
      const attackMultiplier = pairSkillLevel >= 2 ? 1.25 : 1.15;
      const shieldRatio = pairSkillLevel >= 2 ? 0.25 : 0.15;
      context.applyShield(main, main.maxHp * shieldRatio, "埴輪「アイドルクリーチャー」");
      context.applyTimedModifier(main, {
        id: "mayumi-idol-creature",
        durationMs: 8000,
        attackMultiplier,
      });
      log.push(`${main.sourceUnitId ?? main.type} activates 埴輪「アイドルクリーチャー」 Lv${pairSkillLevel}`);
    },
  },
  "shion-pair": {
    name: "最凶最悪の双子神",
    executeOnMainSkillActivated: (main, _allies, enemies, log, context, pairSkillLevel) => {
      const target = context.findCurrentOrNearestTarget(main, enemies);
      context.applyTimedModifier(main, {
        id: "shion-worst-twin-gods-self",
        durationMs: 6000,
        attackMultiplier: pairSkillLevel >= 2 ? 1.20 : 1.10,
      });
      if (target) {
        context.applyTimedModifier(target, {
          id: "shion-worst-twin-gods-target",
          durationMs: 6000,
          attackMultiplier: pairSkillLevel >= 2 ? 0.70 : 0.85,
        });
      }
      log.push(`${main.sourceUnitId ?? main.type} activates 最凶最悪の双子神 Lv${pairSkillLevel}`);
    },
  },
  "tongling-yoshika-pair": {
    name: "トンリン芳香",
    executeOnPairLinked: (main, log, pairSkillLevel) => {
      const hpBonus = pairSkillLevel >= 7 ? 400 : pairSkillLevel >= 4 ? 220 : 100;
      main.maxHp += hpBonus;
      main.hp += hpBonus;
      log.push(`${main.sourceUnitId ?? main.type} gains トンリン芳香 max HP +${hpBonus}`);
    },
  },
  [PERFECT_MIND_CONTROL_PAIR_ID]: {
    name: "パーフェクトマインドコントロール",
  },
  [KOMEIJI_HEARTBREAKER_PAIR_ID]: {
    name: "コメイジハートブレイカー",
  },
  "nameless-danmaku-pair": {
    name: "最初で最後の無名の弾幕",
  },
  [DELAYED_KUDAGITSUNE_PAIR_ID]: {
    name: "狐符「遅効性の管狐弾」",
    executeOnMainSkillActivated: (main, _allies, _enemies, log, _context, pairSkillLevel) => {
      const currentStacks = main.stackState?.[DELAYED_KUDAGITSUNE_STACK_STATE_ID] ?? 0;
      const nextStacks = Math.min(DELAYED_KUDAGITSUNE_MAX_STACKS, currentStacks + 3);
      main.stackState = {
        ...(main.stackState ?? {}),
        [DELAYED_KUDAGITSUNE_STACK_STATE_ID]: nextStacks,
      };
      log.push(
        `${main.sourceUnitId ?? main.type} activates 狐符「遅効性の管狐弾」 Lv${pairSkillLevel}: 管狐弾 ${nextStacks}/${DELAYED_KUDAGITSUNE_MAX_STACKS}`,
      );
    },
    modifyAttackDamageResult: (attacker, target, damageResult, log, context, pairSkillLevel) => {
      const currentStacks = attacker.stackState?.[DELAYED_KUDAGITSUNE_STACK_STATE_ID] ?? 0;
      if (currentStacks <= 0) {
        return damageResult;
      }

      const values = resolveDelayedKudagitsuneValues(pairSkillLevel);
      const nextStacks = Math.max(0, currentStacks - 1);
      attacker.stackState = {
        ...(attacker.stackState ?? {}),
        [DELAYED_KUDAGITSUNE_STACK_STATE_ID]: nextStacks,
      };
      const attackDownUntil = target.stackState?.[DELAYED_KUDAGITSUNE_ATTACK_DOWN_UNTIL_STATE_ID] ?? 0;
      if (attackDownUntil <= context.currentTimeMs) {
        context.applyTimedModifier(target, {
          id: "delayed-kudagitsune-shot-attack-down",
          durationMs: values.durationMs,
          attackMultiplier: values.attackDownMultiplier,
        });
        target.stackState = {
          ...(target.stackState ?? {}),
          [DELAYED_KUDAGITSUNE_ATTACK_DOWN_UNTIL_STATE_ID]: context.currentTimeMs + values.durationMs,
        };
      }
      const boostedDamage = Math.max(1, Math.floor(damageResult.actualDamage * values.damageMultiplier));
      log.push(
        `${attacker.sourceUnitId ?? attacker.type} fires 狐符「遅効性の管狐弾」 for ${boostedDamage} damage; 管狐弾 ${nextStacks}/${DELAYED_KUDAGITSUNE_MAX_STACKS}`,
      );
      return {
        ...damageResult,
        actualDamage: boostedDamage,
      };
    },
  },
  [GREATEST_TREASURE_PAIR_ID]: {
    name: "宝塔「グレイテストトレジャー」",
    executeOnMainSkillActivated: (main, _allies, enemies, log, context, pairSkillLevel) => {
      const primaryTarget = context.findCurrentOrNearestTarget(main, enemies);
      if (!primaryTarget) {
        return;
      }

      const shouValues = resolveShouAbsoluteJusticeValues(resolveSkillStage(main));
      const target = selectLowestHpRatioTarget(
        selectAbsoluteJusticeBeamTargets(main, primaryTarget, enemies, shouValues.maxBeamTargets),
      );
      if (!target) {
        return;
      }

      const values = resolveGreatestTreasureValues(pairSkillLevel);
      const damage = Math.max(
        1,
        Math.round(main.attackPower * main.buffModifiers.attackMultiplier * values.damageMultiplier),
      );
      target.hp -= damage;
      context.applyTimedModifier(target, {
        id: "greatest-treasure-vulnerability",
        durationMs: values.durationMs,
        incomingDamageMultiplier: values.incomingDamageMultiplier,
      });
      log.push(
        `${main.sourceUnitId ?? main.type} activates 宝塔「グレイテストトレジャー」 Lv${pairSkillLevel} on ${target.sourceUnitId ?? target.type} for ${damage} damage`,
      );
    },
  },
  [GOUZOKU_RANBU_MONONOBE_PAIR_ID]: {
    name: "豪族乱舞-物部-",
    executeOnMainSkillActivated: (main, _allies, enemies, log, context, pairSkillLevel) => {
      const primaryTarget = context.findCurrentOrNearestTarget(main, enemies);
      if (!primaryTarget) {
        return;
      }

      const values = resolveGouzokuRanbuMononobeValues(pairSkillLevel);
      const impactCell = primaryTarget.cell;
      const initialTargets = selectUnitsWithinRange(impactCell, enemies, 1);
      for (const target of initialTargets) {
        context.applyTimedModifier(target, {
          id: "gouzoku-ranbu-mononobe-slow",
          durationMs: values.durationMs,
          attackSpeedMultiplier: values.attackSpeedMultiplier,
        });
      }

      context.scheduleSkillTicks(main, {
        id: "gouzoku-ranbu-mononobe-fire",
        initialDelayMs: 0,
        intervalMs: 800,
        tickCount: values.tickCount,
        selectTarget: (_source, _tickAllies, tickEnemies) =>
          tickEnemies.find((enemy) => !enemy.isDead && enemy.cell === impactCell) ?? null,
        selectTargets: (_source, _tickAllies, tickEnemies) => selectUnitsWithinRange(impactCell, tickEnemies, 1),
        calculateDamage: (source) =>
          Math.max(
            1,
            Math.round(source.attackPower * source.buffModifiers.attackMultiplier * values.tickDamageMultiplier),
          ),
        describeTick: (source, target, damage) =>
          `${source.sourceUnitId ?? source.type} 豪族乱舞-物部- burns ${target.sourceUnitId ?? target.type} for ${damage}`,
      });
      log.push(
        `${main.sourceUnitId ?? main.type} activates 豪族乱舞-物部- Lv${pairSkillLevel} on ${initialTargets.length} enemies`,
      );
    },
  },
  [GOUZOKU_RANBU_SOGA_PAIR_ID]: {
    name: "豪族乱舞-蘇我-",
    executeOnMainSkillActivated: (main, _allies, enemies, log, context, pairSkillLevel) => {
      const primaryTarget = context.findCurrentOrNearestTarget(main, enemies);
      if (!primaryTarget) {
        return;
      }

      const values = resolveGouzokuRanbuSogaValues(pairSkillLevel);
      const primaryDamage = Math.max(
        1,
        Math.round(main.attackPower * main.buffModifiers.attackMultiplier * values.primaryDamageMultiplier),
      );
      const chainDamage = Math.max(
        1,
        Math.round(main.attackPower * main.buffModifiers.attackMultiplier * values.chainDamageMultiplier),
      );
      primaryTarget.hp -= primaryDamage;

      const chainedTargets = enemies
        .filter((enemy) => !enemy.isDead && enemy.id !== primaryTarget.id)
        .sort((left, right) => {
          const distanceDiff = calculateSharedBoardDistance(primaryTarget.cell, left.cell)
            - calculateSharedBoardDistance(primaryTarget.cell, right.cell);
          if (distanceDiff !== 0) {
            return distanceDiff;
          }
          return left.cell - right.cell;
        })
        .slice(0, values.chainCount);
      for (const target of chainedTargets) {
        target.hp -= chainDamage;
      }

      log.push(
        `${main.sourceUnitId ?? main.type} activates 豪族乱舞-蘇我- Lv${pairSkillLevel} with ${chainedTargets.length} chains`,
      );
    },
  },
};

const KOMEIJI_HEARTBREAKER_SKILL_DEFINITION: UnitSkillEffect = {
  name: "コメイジハートブレイカー",
  activationModel: "mana",
  initialSkillDelayMs: 0,
  skillCooldownMs: 0,
  mana: {
    maxMana: 100,
    initialMana: 35,
    manaCost: 100,
    manaGainOnAttack: 12,
    manaGainOnDamageTakenRatio: 20,
  },
  canActivate: (caster, _allies, enemies) => selectKomeijiHeartbreakerTarget(caster, enemies) !== null,
  execute: (caster, _allies, enemies, log) => {
    const pairSkillLevel = resolveNormalPairSkillLevel(caster, KOMEIJI_HEARTBREAKER_PAIR_ID);
    if (!pairSkillLevel) {
      return;
    }

    const target = selectKomeijiHeartbreakerTarget(caster, enemies);
    if (!target) {
      return;
    }

    const damageMultiplier = resolveKomeijiHeartbreakerDamageMultiplier(pairSkillLevel);
    const damage = calculateUltimateDamage(
      caster,
      caster.attackPower * caster.buffModifiers.attackMultiplier * damageMultiplier,
      target,
    );
    target.hp -= damage;
    log.push(`${caster.sourceUnitId ?? caster.type} activates コメイジハートブレイカー for ${damage} damage`);
  },
};

const REMILIA_BOSS_SPELL_MANA: ManaSkillConfig = {
  maxMana: 100,
  initialMana: 30,
  manaCost: 100,
  manaGainOnAttack: 10,
  manaGainOnDamageTakenRatio: 25,
};
const REMILIA_LAST_WORD_BOSS_SPELL_MANA: ManaSkillConfig = {
  ...REMILIA_BOSS_SPELL_MANA,
  initialMana: 35,
};
const REMILIA_SCARLET_SHOOT_DAMAGE_MULTIPLIER = 2.1;
const REMILIA_NIGHTLESS_CASTLE_DAMAGE_MULTIPLIER = 1.6;
const REMILIA_DEMON_KING_CRADLE_DAMAGE_MULTIPLIER = 1.9;
const REMILIA_HEART_BREAK_DAMAGE_MULTIPLIER = 2.5;
const REMILIA_SCARLET_DEVIL_DAMAGE_MULTIPLIER = 2.0;
const REMILIA_BAD_LADY_SCRAMBLE_DAMAGE_MULTIPLIER = 2.2;
const REMILIA_GUNGNIR_DAMAGE_MULTIPLIER = 3.0;
const REMILIA_WORLD_NIGHTMARE_DAMAGE_MULTIPLIER = 1.5;
const REMILIA_DRACULA_CRADLE_DAMAGE_MULTIPLIER = 2.6;
const REMILIA_LAST_WORD_DOT_DAMAGE_MULTIPLIER = 0.07;
const REMILIA_LAST_WORD_ATTACK_STACK_BONUS = 0.05;
const REMILIA_LAST_WORD_MAX_STACKS = 25;
const REMILIA_LAST_WORD_TICK_COUNT = 10_000;
const REMILIA_LAST_WORD_STACK_STATE_ID = "last-word-enrage";

function getLastWordStackForTick(tickIndex: number): number {
  return Math.min(
    REMILIA_LAST_WORD_MAX_STACKS,
    Math.max(1, Math.floor(Math.max(0, tickIndex) / 5) + 1),
  );
}

function applyLastWordEnrageStack(caster: BattleUnit, allies: BattleUnit[], nextStack: number): void {
  caster.stackState ??= {};
  const previousStack = Math.min(
    REMILIA_LAST_WORD_MAX_STACKS,
    Math.max(0, Math.floor(caster.stackState[REMILIA_LAST_WORD_STACK_STATE_ID] ?? 0)),
  );
  const acceptedStack = Math.min(
    REMILIA_LAST_WORD_MAX_STACKS,
    Math.max(previousStack, Math.floor(nextStack)),
  );
  if (acceptedStack <= previousStack) {
    return;
  }

  const previousMultiplier = 1 + previousStack * REMILIA_LAST_WORD_ATTACK_STACK_BONUS;
  const nextMultiplier = 1 + acceptedStack * REMILIA_LAST_WORD_ATTACK_STACK_BONUS;
  const deltaMultiplier = nextMultiplier / previousMultiplier;
  for (const ally of allies) {
    if (!ally.isDead) {
      ally.buffModifiers.attackMultiplier *= deltaMultiplier;
    }
  }
  caster.stackState[REMILIA_LAST_WORD_STACK_STATE_ID] = acceptedStack;
}

function calculateLastWordDotDamage(caster: BattleUnit, tickIndex: number): number {
  const stack = getLastWordStackForTick(tickIndex);
  const lastWordAttackMultiplier = 1 + stack * REMILIA_LAST_WORD_ATTACK_STACK_BONUS;
  const effectiveAttackExcludingLastWord = (
    caster.attackPower
    * caster.buffModifiers.attackMultiplier
    / lastWordAttackMultiplier
  );
  return Math.floor(effectiveAttackExcludingLastWord * REMILIA_LAST_WORD_DOT_DAMAGE_MULTIPLIER * stack);
}

export const BOSS_SKILL_DEFINITIONS: Record<string, BossSkillEffect> = {
  "instant-1": {
    name: '紅符「スカーレットシュート」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const target = selectHighestAttackTarget(enemies);
      if (!target) {
        return;
      }

      const targets = getUnitsOnBeamLine(caster, target, enemies);
      dealBossSpellDamage(
        caster,
        targets,
        REMILIA_SCARLET_SHOOT_DAMAGE_MULTIPLIER,
        log,
        '紅符「スカーレットシュート」',
      );
      log.push(`${caster.sourceUnitId ?? caster.type} activates 紅符「スカーレットシュート」`);
    },
  },
  "area-1": {
    name: '紅符「不夜城レッド」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const targets = selectCrossTargets(caster, enemies, 2);
      dealBossSpellDamage(
        caster,
        targets,
        REMILIA_NIGHTLESS_CASTLE_DAMAGE_MULTIPLIER,
        log,
        '紅符「不夜城レッド」',
      );
      log.push(`${caster.sourceUnitId ?? caster.type} activates 紅符「不夜城レッド」`);
    },
  },
  "rush-1": {
    name: '夜符「デーモンキングクレイドル」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const rush = selectHorizontalRush(caster, enemies);
      dealBossSpellDamage(
        caster,
        rush.targets,
        REMILIA_DEMON_KING_CRADLE_DAMAGE_MULTIPLIER,
        log,
        '夜符「デーモンキングクレイドル」',
      );
      if (rush.destinationCell !== null) {
        caster.cell = rush.destinationCell;
      }
      log.push(`${caster.sourceUnitId ?? caster.type} activates 夜符「デーモンキングクレイドル」`);
    },
  },
  "instant-2": {
    name: '必殺「ハートブレイク」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const target = selectHighestAttackTarget(enemies);
      if (!target) {
        return;
      }

      const targets = getUnitsOnBeamLine(caster, target, enemies);
      dealBossSpellDamage(
        caster,
        targets,
        REMILIA_HEART_BREAK_DAMAGE_MULTIPLIER,
        log,
        '必殺「ハートブレイク」',
      );
      log.push(`${caster.sourceUnitId ?? caster.type} activates 必殺「ハートブレイク」`);
    },
  },
  "area-2": {
    name: '紅魔「スカーレットデビル」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const targets = selectAreaTargets(caster, enemies, 2);
      dealBossSpellDamage(
        caster,
        targets,
        REMILIA_SCARLET_DEVIL_DAMAGE_MULTIPLIER,
        log,
        '紅魔「スカーレットデビル」',
      );
      log.push(`${caster.sourceUnitId ?? caster.type} activates 紅魔「スカーレットデビル」`);
    },
  },
  "rush-2": {
    name: '夜符「バッドレディスクランブル」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const rush = selectHorizontalRush(caster, enemies);
      dealBossSpellDamage(
        caster,
        rush.targets,
        REMILIA_BAD_LADY_SCRAMBLE_DAMAGE_MULTIPLIER,
        log,
        '夜符「バッドレディスクランブル」',
      );
      if (rush.destinationCell !== null) {
        caster.cell = rush.destinationCell;
      }
      log.push(`${caster.sourceUnitId ?? caster.type} activates 夜符「バッドレディスクランブル」`);
    },
  },
  "instant-3": {
    name: '神槍「スピア・ザ・グングニル」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const target = selectHighestAttackTarget(enemies);
      if (!target) {
        return;
      }

      const targets = getUnitsOnBeamLine(caster, target, enemies);
      dealBossSpellDamage(
        caster,
        targets,
        REMILIA_GUNGNIR_DAMAGE_MULTIPLIER,
        log,
        '神槍「スピア・ザ・グングニル」',
      );
      log.push(`${caster.sourceUnitId ?? caster.type} activates 神槍「スピア・ザ・グングニル」`);
    },
  },
  "area-3": {
    name: '魔符「全世界ナイトメア」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const targets = enemies.filter((enemy) => !enemy.isDead);
      dealBossSpellDamage(
        caster,
        targets,
        REMILIA_WORLD_NIGHTMARE_DAMAGE_MULTIPLIER,
        log,
        '魔符「全世界ナイトメア」',
      );
      log.push(`${caster.sourceUnitId ?? caster.type} activates 魔符「全世界ナイトメア」`);
    },
  },
  "rush-3": {
    name: '夜王「ドラキュラクレイドル」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_BOSS_SPELL_MANA,
    execute: (caster, _allies, enemies, log) => {
      const rush = selectVerticalAdjustingHorizontalRush(caster, enemies);
      dealBossSpellDamage(
        caster,
        rush.targets,
        REMILIA_DRACULA_CRADLE_DAMAGE_MULTIPLIER,
        log,
        '夜王「ドラキュラクレイドル」',
      );
      if (rush.destinationCell !== null) {
        caster.cell = rush.destinationCell;
      }
      log.push(`${caster.sourceUnitId ?? caster.type} activates 夜王「ドラキュラクレイドル」`);
    },
  },
  "last-word": {
    name: '「紅色の幻想郷」',
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: REMILIA_LAST_WORD_BOSS_SPELL_MANA,
    execute: (caster, allies, enemies, log, context) => {
      if ((caster.stackState?.[REMILIA_LAST_WORD_STACK_STATE_ID] ?? 0) > 0) {
        caster.activeBossSpellId = "";
        return;
      }

      applyLastWordEnrageStack(caster, allies, 1);
      context?.scheduleSkillTicks(caster, {
        id: REMILIA_LAST_WORD_STACK_STATE_ID,
        sourceSkillId: "last-word",
        initialDelayMs: 1000,
        intervalMs: 1000,
        tickCount: REMILIA_LAST_WORD_TICK_COUNT,
        onBeforeTick: (source, tickAllies, _tickEnemies, tickIndex) => {
          applyLastWordEnrageStack(source, tickAllies, getLastWordStackForTick(tickIndex));
        },
        selectTarget: () => null,
        selectTargets: (_source, _allies, tickEnemies) =>
          tickEnemies.filter((enemy) => !enemy.isDead),
        calculateDamage: (source, _target, tickIndex) =>
          calculateLastWordDotDamage(source, tickIndex),
        describeTick: (source, target, damage, tickIndex) =>
          `${source.sourceUnitId ?? source.type} sustains 「紅色の幻想郷」 stack ${getLastWordStackForTick(tickIndex)} on ${target.sourceUnitId ?? target.type} for ${damage} damage`,
      });
      caster.activeBossSpellId = "";
      log.push(`${caster.sourceUnitId ?? caster.type} activates 「紅色の幻想郷」`);
      if (enemies.some((enemy) => !enemy.isDead)) {
        log.push(`${caster.sourceUnitId ?? caster.type} starts final enrage stacks`);
      }
    },
  },
};

export function hasStandardTouhouBasicSkillDefinition(unit: BattleUnit): boolean {
  const sourceUnitId = typeof unit.sourceUnitId === "string" ? unit.sourceUnitId : "";
  return STANDARD_TOUHOU_BASIC_SKILL_DEFINITIONS[sourceUnitId] !== undefined;
}

export function resolveUnitSkillDefinition(unit: BattleUnit): UnitSkillEffect | null {
  const sourceUnitId = typeof unit.sourceUnitId === "string" ? unit.sourceUnitId : "";
  const heroExclusiveUnit = getHeroExclusiveUnitById(sourceUnitId);
  if (heroExclusiveUnit) {
    return HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS[heroExclusiveUnit.skillId] ?? null;
  }

  if (
    sourceUnitId === "satori"
    && resolveNormalPairSkillLevel(unit, KOMEIJI_HEARTBREAKER_PAIR_ID)
  ) {
    return KOMEIJI_HEARTBREAKER_SKILL_DEFINITION;
  }

  const standardTouhouSkill = STANDARD_TOUHOU_BASIC_SKILL_DEFINITIONS[sourceUnitId];
  if (standardTouhouSkill) {
    return standardTouhouSkill;
  }

  const scarletMansionSkill = SCARLET_MANSION_BASIC_SKILL_DEFINITIONS[sourceUnitId];
  if (scarletMansionSkill) {
    return scarletMansionSkill;
  }

  return SKILL_DEFINITIONS[unit.type] ?? null;
}

export function resolveBossSkillDefinition(unit: BattleUnit): BossSkillEffect | null {
  if (!unit.isBoss) {
    return null;
  }

  const sourceUnitId = typeof unit.sourceUnitId === "string" ? unit.sourceUnitId : "";
  if (sourceUnitId.length === 0) {
    return null;
  }

  const activeBossSpellId = typeof unit.activeBossSpellId === "string" ? unit.activeBossSpellId : "";
  if (activeBossSpellId.length === 0) {
    return null;
  }

  return BOSS_SKILL_DEFINITIONS[activeBossSpellId] ?? null;
}

export function resolvePairSkillDefinition(pairSkillId: string): PairSkillEffect | null {
  if (typeof pairSkillId !== "string" || pairSkillId.length === 0) {
    return null;
  }

  return PAIR_SKILL_DEFINITIONS[pairSkillId] ?? null;
}

export function resolvePairSkillDefinitions(unit: BattleUnit): PairSkillEffect[] {
  return (unit.pairSkillIds ?? [])
    .map((pairSkillId) => resolvePairSkillDefinition(pairSkillId))
    .filter((definition): definition is PairSkillEffect => definition !== null);
}

// ヒーロースキル定義
export const HERO_SKILL_DEFINITIONS: Record<string, HeroSkillEffect> = {
  reimu: {
    name: "夢符「二重結界」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 25,
      manaCost: 100,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 35,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const defenseMultiplier = stage >= 4 ? 1.20 : 1.15;
      const damageMultiplier = stage >= 7 ? 1.8 : 1.2;

      for (const ally of allies) {
        if (!ally.isDead) {
          skillContext.applyTimedModifier(ally, {
            id: "reimu-double-barrier",
            durationMs: 7000,
            defenseMultiplier,
          });
        }
      }

      for (const enemy of selectUnitsWithinRange(caster.cell, enemies, 2)) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * damageMultiplier,
          enemy,
        );
        skillContext.dealDamage(caster, enemy, damage, "夢符「二重結界」");
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 夢符「二重結界」`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  marisa: {
    name: "恋符「マスタースパーク」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 20,
      manaCost: 100,
      manaGainOnAttack: 8,
      manaGainOnDamageTakenRatio: 25,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const damageMultiplier = stage >= 7 ? 3.8 : stage >= 4 ? 3.0 : 2.4;
      const primaryTarget = selectHighestHpTarget(caster, enemies);
      if (!primaryTarget) {
        return;
      }

      const targets = getUnitsOnBeamLine(caster, primaryTarget, enemies);
      for (const target of targets) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * damageMultiplier,
          target,
        );
        skillContext.dealDamage(caster, target, damage, "恋符「マスタースパーク」");
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 恋符「マスタースパーク」`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  okina: {
    name: "秘神「裏表の逆転」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 30,
      manaCost: 90,
      manaGainOnAttack: 12,
      manaGainOnDamageTakenRatio: 35,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const attackMultiplier = stage >= 7 ? 1.30 : stage >= 4 ? 1.20 : 1.10;

      for (const ally of allies) {
        if (!ally.isDead) {
          skillContext.applyTimedModifier(ally, {
            id: "okina-front-reversal",
            durationMs: 6000,
            attackMultiplier,
          });
        }
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 秘神「裏表の逆転」`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  keiki: {
    name: "鬼形造形術",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 9,
      manaGainOnDamageTakenRatio: 40,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const multiplier = stage >= 7 ? 1.38 : stage >= 4 ? 1.24 : 1.12;
      const durationMs = stage >= 7 ? 12000 : stage >= 4 ? 10000 : 8000;

      for (const ally of selectUnitsWithinRange(caster.cell, allies, 3)) {
        skillContext.applyTimedModifier(ally, {
          id: "keiki-modeling",
          durationMs,
          attackMultiplier: multiplier,
          defenseMultiplier: multiplier,
        });
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 鬼形造形術`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  jyoon: {
    name: "財符「黄金のトルネード」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 35,
      manaCost: 100,
      manaGainOnAttack: 7,
      manaGainOnDamageTakenRatio: 45,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      skillContext.applyTimedModifier(caster, {
        id: "jyoon-golden-tornado",
        durationMs: 5000,
        attackMultiplier: stage >= 7 ? 1.65 : stage >= 4 ? 1.35 : 1.20,
        attackSpeedMultiplier: stage >= 7 ? 1.45 : stage >= 4 ? 1.30 : 1.20,
        incomingDamageMultiplier: stage >= 7 ? 1.0 : 1.10,
      });

      log.push(`${caster.sourceUnitId ?? caster.type} activates 財符「黄金のトルネード」`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  yuiman: {
    name: "虚構「ディスコミュニケーション」",
    activationModel: "mana",
    initialSkillDelayMs: 0,
    skillCooldownMs: 0,
    mana: {
      maxMana: 100,
      initialMana: 30,
      manaCost: 100,
      manaGainOnAttack: 10,
      manaGainOnDamageTakenRatio: 35,
    },
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);

      for (const enemy of selectUnitsWithinRange(caster.cell, enemies, 2)) {
        if (enemy.debuffImmunityCategories?.includes("crowd_control")) {
          continue;
        }
        skillContext.applyTimedModifier(enemy, {
          id: "yuiman-discommunication",
          durationMs: 6000,
          attackSpeedMultiplier: stage >= 7 ? 0.50 : stage >= 4 ? 0.60 : 0.70,
          defenseMultiplier: stage >= 7 ? 0.75 : stage >= 4 ? 0.85 : 0.90,
        });
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 虚構「ディスコミュニケーション」`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
};
