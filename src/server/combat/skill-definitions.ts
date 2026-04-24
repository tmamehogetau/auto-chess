import type { BoardUnitType } from "../../shared/room-messages";
import { getHeroExclusiveUnitById } from "../../data/hero-exclusive-units";
import {
  sharedBoardIndexToCoordinate,
  sharedBoardManhattanDistance,
} from "../../shared/board-geometry";
import type { BoardCoordinate } from "../../shared/board-geometry";
import type { BattleUnit } from "./battle-simulator";

export interface SkillTiming {
  initialSkillDelayMs: number;
  skillCooldownMs: number;
}

export interface TimedCombatModifier {
  id: string;
  durationMs: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  attackSpeedMultiplier?: number;
  incomingDamageMultiplier?: number;
}

export interface SkillExecutionContext {
  currentTimeMs: number;
  applyTimedModifier: (target: BattleUnit, modifier: TimedCombatModifier) => void;
  applyShield: (target: BattleUnit, amount: number, sourceId: string) => void;
  findCurrentOrNearestTarget: (caster: BattleUnit, enemies: BattleUnit[]) => BattleUnit | null;
  executePairSkillsOnMainSkillActivated: (
    main: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
  ) => void;
}

export interface SkillEffect extends SkillTiming {
  name: string;
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
  executeOnMainSkillActivated?: (
    main: BattleUnit,
    allies: BattleUnit[],
    enemies: BattleUnit[],
    log: string[],
    context: SkillExecutionContext,
    pairSkillLevel: 1 | 2,
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
}

function isDebuffedTarget(unit: BattleUnit): boolean {
  return unit.buffModifiers.attackMultiplier < 1
    || unit.buffModifiers.defenseMultiplier < 1
    || unit.buffModifiers.attackSpeedMultiplier < 1;
}

function calculateUltimateDamage(caster: BattleUnit, baseDamage: number, target?: BattleUnit): number {
  let damage = baseDamage * (caster.ultimateDamageMultiplier ?? 1);

  if (target && isDebuffedTarget(target)) {
    damage *= 1 + (caster.bonusDamageVsDebuffedTarget ?? 0);
  }

  return Math.floor(damage);
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
      target.damageTakenMultiplier = (target.damageTakenMultiplier ?? 1)
        * (modifier.incomingDamageMultiplier ?? 1);
    },
    applyShield: (target, amount) => {
      target.shieldAmount = (target.shieldAmount ?? 0) + amount;
    },
    findCurrentOrNearestTarget: (caster, enemies) => {
      const currentTarget = enemies.find(
        (enemy) => enemy.id === caster.currentTargetId && !enemy.isDead,
      );
      return currentTarget ?? selectLowestHpTarget(caster, enemies);
    },
    executePairSkillsOnMainSkillActivated: () => undefined,
  };
}

function resolveSkillContext(
  context: SkillExecutionContext | undefined,
  log: string[],
): SkillExecutionContext {
  return context ?? createImmediateSkillContext(log);
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

export const SKILL_DEFINITIONS: Record<BoardUnitType, SkillEffect> = {
  vanguard: {
    name: 'Shield Wall',
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
    initialSkillDelayMs: 3000,
    skillCooldownMs: 6000,
    execute: (caster, _allies, enemies, log) => {
      const target = selectLowestHpTarget(caster, enemies);
      if (target) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 2,
          target,
        );
        target.hp -= damage;
        log.push(`${caster.type} activates Precise Shot! Deals ${damage} damage to ${target.type}`);
      }
    }
  },
  mage: {
    name: 'Arcane Burst',
    initialSkillDelayMs: 4000,
    skillCooldownMs: 8000,
    execute: (caster, _allies, enemies, log) => {
      for (const enemy of enemies) {
        if (!enemy.isDead) {
          const damage = calculateUltimateDamage(
            caster,
            caster.attackPower * caster.buffModifiers.attackMultiplier * 1.5,
            enemy,
          );
          enemy.hp -= damage;
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
    initialSkillDelayMs: 2500,
    skillCooldownMs: 5000,
    execute: (caster, _allies, enemies, log) => {
      const target = selectLowestHpTarget(caster, enemies);
      if (target) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * 3,
          target,
        );
        target.hp -= damage;
        log.push(`${caster.type} activates Backstab! Deals ${damage} damage to ${target.type}`);
      }
    }
  }
};

export const HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS: Record<string, UnitSkillEffect> = {
  "mayumi-basic": {
    name: "埴輪「熟練剣士埴輪」",
    initialSkillDelayMs: 7000,
    skillCooldownMs: 14000,
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
    initialSkillDelayMs: 6000,
    skillCooldownMs: 12000,
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
      target.hp -= damage;
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
    initialSkillDelayMs: 5000,
    skillCooldownMs: 5000,
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
  patchouli: {
    name: "火水木金土符「賢者の石」",
    initialSkillDelayMs: 5000,
    skillCooldownMs: 9000,
    execute: (caster, _allies, enemies, log) => {
      const stage = resolveSkillStage(caster);
      const damageMultiplier = stage >= 7 ? 1.5 : stage >= 4 ? 1.35 : 1.2;
      const targets = enemies
        .filter((enemy) => !enemy.isDead)
        .sort((left, right) =>
          calculateSharedBoardDistance(caster.cell, left.cell)
          - calculateSharedBoardDistance(caster.cell, right.cell))
        .slice(0, 3);

      for (const target of targets) {
        const damage = calculateUltimateDamage(
          caster,
          caster.attackPower * caster.buffModifiers.attackMultiplier * damageMultiplier,
          target,
        );
        target.hp -= damage;
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 火水木金土符「賢者の石」`);
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
};

// TODO(raid-balance): populate boss active skills here. Empty intentionally so
// resolveBossSkillDefinition no-ops until boss skill tuning is designed.
export const BOSS_SKILL_DEFINITIONS: Record<string, BossSkillEffect> = {};

export function resolveUnitSkillDefinition(unit: BattleUnit): UnitSkillEffect | null {
  const sourceUnitId = typeof unit.sourceUnitId === "string" ? unit.sourceUnitId : "";
  const heroExclusiveUnit = getHeroExclusiveUnitById(sourceUnitId);
  if (heroExclusiveUnit) {
    return HERO_EXCLUSIVE_BASIC_SKILL_DEFINITIONS[heroExclusiveUnit.skillId] ?? null;
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

  return BOSS_SKILL_DEFINITIONS[sourceUnitId] ?? null;
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
    initialSkillDelayMs: 8000,
    skillCooldownMs: 14000,
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
        enemy.hp -= damage;
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 夢符「二重結界」`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  marisa: {
    name: "恋符「マスタースパーク」",
    initialSkillDelayMs: 10000,
    skillCooldownMs: 16000,
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
        target.hp -= damage;
      }

      log.push(`${caster.sourceUnitId ?? caster.type} activates 恋符「マスタースパーク」`);
      skillContext.executePairSkillsOnMainSkillActivated(caster, allies, enemies);
    },
  },
  okina: {
    name: "秘神「裏表の逆転」",
    initialSkillDelayMs: 7000,
    skillCooldownMs: 13000,
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
    initialSkillDelayMs: 11000,
    skillCooldownMs: 17000,
    execute: (caster, allies, enemies, log, context) => {
      const skillContext = resolveSkillContext(context, log);
      const stage = resolveSkillStage(caster);
      const multiplier = stage >= 7 ? 1.30 : stage >= 4 ? 1.20 : 1.10;
      const durationMs = stage >= 7 ? 10000 : 8000;

      for (const ally of selectUnitsWithinRange(caster.cell, allies, 2)) {
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
    initialSkillDelayMs: 6000,
    skillCooldownMs: 10000,
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
    initialSkillDelayMs: 8000,
    skillCooldownMs: 13000,
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
