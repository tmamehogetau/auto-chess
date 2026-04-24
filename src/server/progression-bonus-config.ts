import { HERO_EXCLUSIVE_UNITS } from "../data/hero-exclusive-units";
import { HEROES } from "../data/heroes";
import type {
  LevelBonusDescriptor,
  UnitProgressionBonusConfig,
} from "../shared/progression-bonus-types";
import { getSpecialUnitCombatMultiplierDelta } from "./special-unit-level-config";
import {
  getStandardUnitProgressionBonusConfig,
  getUnitLevelCombatMultiplierDelta,
} from "./unit-level-config";

const PROVISIONAL_SKILL_SCORE_MULTIPLIER = 0.5;
const BASE_MULTIPLIER_DELTA_SCORE = 100;

const DEFAULT_STANDARD_UNIT_PROGRESSION: UnitProgressionBonusConfig = {
  baseGrowthProfile: "standard",
  level4Bonus: null,
  level7Bonus: null,
  skillImplementationState: "implemented",
};

const DEFAULT_SPECIAL_UNIT_PROGRESSION: UnitProgressionBonusConfig = {
  baseGrowthProfile: "balanced",
  level4Bonus: null,
  level7Bonus: null,
  skillImplementationState: "implemented",
};

function getAdjustedSkillScore(
  bonus: LevelBonusDescriptor | null,
  progression: UnitProgressionBonusConfig,
): number {
  const rawScore = bonus?.skillScore ?? 0;
  if (rawScore === 0) {
    return 0;
  }

  switch (progression.skillImplementationState) {
    case "missing":
      return 0;
    case "provisional":
      return rawScore * PROVISIONAL_SKILL_SCORE_MULTIPLIER;
    default:
      return rawScore;
  }
}

export function getMilestoneBonusScore(
  currentLevel: number,
  progression: UnitProgressionBonusConfig,
): number {
  const nextLevel = Math.floor(currentLevel) + 1;
  const bonus = nextLevel === 4
    ? progression.level4Bonus
    : nextLevel === 7
      ? progression.level7Bonus
      : null;

  if (!bonus) {
    return 0;
  }

  return (bonus.statScore ?? 0) + getAdjustedSkillScore(bonus, progression);
}

export function getProgressionMilestoneStage(
  unitLevel: number,
  progression: UnitProgressionBonusConfig,
): 0 | 1 | 2 {
  if (unitLevel >= 7 && progression.level7Bonus) {
    return 2;
  }

  if (unitLevel >= 4 && progression.level4Bonus) {
    return 1;
  }

  return 0;
}

export function resolveSpecialUnitProgressionBonusConfig(
  specialUnitId: string,
): UnitProgressionBonusConfig {
  const hero = HEROES.find((value) => value.id === specialUnitId);
  if (hero) {
    return hero.progressionBonus;
  }

  const exclusiveUnit = HERO_EXCLUSIVE_UNITS.find((value) => value.id === specialUnitId);
  if (exclusiveUnit) {
    return exclusiveUnit.progressionBonus;
  }

  return DEFAULT_SPECIAL_UNIT_PROGRESSION;
}

export function getSpecialUnitUpgradeValueScore(
  specialUnitId: string,
  currentLevel: number,
  nextLevelCost: number,
): number {
  if (!Number.isFinite(nextLevelCost) || nextLevelCost <= 0) {
    return 0;
  }

  const progression = resolveSpecialUnitProgressionBonusConfig(specialUnitId);
  const baseGrowthScore =
    getSpecialUnitCombatMultiplierDelta(currentLevel, specialUnitId) * BASE_MULTIPLIER_DELTA_SCORE;
  const milestoneScore = getMilestoneBonusScore(currentLevel, progression);

  return (baseGrowthScore + milestoneScore) / nextLevelCost;
}

export function getStandardUnitLevelValueScore(
  unitId: string,
  currentLevel: number,
  progression: UnitProgressionBonusConfig = getStandardUnitProgressionBonusConfig(unitId),
): number {
  const baseGrowthScore = getUnitLevelCombatMultiplierDelta(currentLevel) * BASE_MULTIPLIER_DELTA_SCORE;
  const milestoneScore = getMilestoneBonusScore(currentLevel, progression);
  return baseGrowthScore + milestoneScore;
}
