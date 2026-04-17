import type { BattleUnit } from "./battle-simulator";

export interface AppliedDamageSummary {
  damageDealtLeftIncrement: number;
  damageDealtRightIncrement: number;
  bossDamageIncrement: number;
  phaseDamageIncrement: number;
  defeatedTarget: boolean;
  bossBreakTriggered: boolean;
}

export interface UnitDefeatConsequences {
  defeatedUnit: boolean;
  bossBreakTriggered: boolean;
  phaseDamageIncrement: number;
}

export function calculateAttackDamage(
  attacker: BattleUnit,
  target: BattleUnit,
  isCrit: boolean,
  bossPassiveActive: boolean,
): number {
  const critMultiplier = isCrit ? attacker.critDamageMultiplier : 1.0;
  const bossAtkMultiplier = bossPassiveActive ? 1.2 : 1.0;
  const baseDamage = attacker.attackPower
    * attacker.buffModifiers.attackMultiplier
    * critMultiplier
    * bossAtkMultiplier;
  const damageReduction = target.damageReduction ?? 0;
  const defenseMultiplier = Math.max(target.buffModifiers.defenseMultiplier ?? 1, 0.01);
  const actualDamage = Math.max(
    1,
    Math.floor((baseDamage * (1 - damageReduction / 100)) / defenseMultiplier),
  );

  return actualDamage;
}

export function calculateReflectedDamage(
  actualDamage: number,
  reflectRatio: number | undefined,
): number {
  if (!reflectRatio || actualDamage <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(actualDamage * reflectRatio));
}

export function calculatePhaseDamageOnUnitDefeat(
  unit: BattleUnit,
  bossBattleSide: "left" | "right" | null,
): number {
  if (!bossBattleSide || unit.isBoss || unit.battleSide !== bossBattleSide) {
    return 0;
  }

  return Math.floor(unit.maxHp / 2);
}

export function resolveUnitDefeatConsequences(
  unit: BattleUnit,
  bossBattleSide: "left" | "right" | null,
): UnitDefeatConsequences {
  const defeatedUnit = unit.hp <= 0;
  if (!defeatedUnit) {
    return {
      defeatedUnit: false,
      bossBreakTriggered: false,
      phaseDamageIncrement: 0,
    };
  }

  if (unit.isBoss) {
    return {
      defeatedUnit: true,
      bossBreakTriggered: true,
      phaseDamageIncrement: 0,
    };
  }

  return {
    defeatedUnit: true,
    bossBreakTriggered: false,
    phaseDamageIncrement: calculatePhaseDamageOnUnitDefeat(unit, bossBattleSide),
  };
}

export function buildAppliedDamageSummary(
  sourceSide: "left" | "right",
  targetUnit: BattleUnit,
  amount: number,
  bossBattleSide: "left" | "right" | null,
  includeDefeatConsequences: boolean = true,
): AppliedDamageSummary {
  if (amount <= 0) {
    return {
      damageDealtLeftIncrement: 0,
      damageDealtRightIncrement: 0,
      bossDamageIncrement: 0,
      phaseDamageIncrement: 0,
      defeatedTarget: false,
      bossBreakTriggered: false,
    };
  }

  const defeatConsequences = includeDefeatConsequences
    ? resolveUnitDefeatConsequences(targetUnit, bossBattleSide)
    : {
      defeatedUnit: targetUnit.hp <= 0,
      bossBreakTriggered: Boolean(targetUnit.isBoss && targetUnit.hp <= 0),
      phaseDamageIncrement: 0,
    };
  const bossDamageIncrement = targetUnit.isBoss ? amount : 0;

  return {
    damageDealtLeftIncrement: sourceSide === "left" ? amount : 0,
    damageDealtRightIncrement: sourceSide === "right" ? amount : 0,
    bossDamageIncrement,
    phaseDamageIncrement: bossDamageIncrement + defeatConsequences.phaseDamageIncrement,
    defeatedTarget: defeatConsequences.defeatedUnit,
    bossBreakTriggered: defeatConsequences.bossBreakTriggered,
  };
}
