const SPECIAL_UNIT_LEVEL_MIN = 1;
const SPECIAL_UNIT_LEVEL_MAX = 7;

const DEFAULT_SPECIAL_UNIT_UPGRADE_COSTS = [2, 2, 3, 4, 5, 7];
const JYOON_SPECIAL_UNIT_UPGRADE_COSTS = [3, 3, 4, 5, 6, 8];
const DEFAULT_SPECIAL_UNIT_COMBAT_MULTIPLIERS = [1.0, 1.15, 1.3, 1.55, 1.95, 2.4, 3.0];
const JYOON_SPECIAL_UNIT_COMBAT_MULTIPLIERS = [1.0, 1.2, 1.4, 1.75, 2.25, 2.85, 3.6];
const BASE_MULTIPLIER_DELTA_SCORE = 100;
const PROVISIONAL_SKILL_SCORE_MULTIPLIER = 0.5;
const DEFAULT_SPECIAL_UNIT_PROGRESSION_BONUS = {
  baseGrowthProfile: "balanced",
  level4Bonus: null,
  level7Bonus: null,
  skillImplementationState: "implemented",
};
const SPECIAL_UNIT_PROGRESSION_BONUS_BY_ID = {
  jyoon: {
    ...DEFAULT_SPECIAL_UNIT_PROGRESSION_BONUS,
    baseGrowthProfile: "late-bloom",
  },
};

function clampSpecialUnitLevel(level) {
  return Math.min(SPECIAL_UNIT_LEVEL_MAX, Math.max(SPECIAL_UNIT_LEVEL_MIN, level));
}

function getClientSelectedSpecialUnitId(player) {
  if (typeof player?.selectedHeroId === "string" && player.selectedHeroId.length > 0) {
    return player.selectedHeroId;
  }

  if (typeof player?.selectedBossId === "string" && player.selectedBossId.length > 0) {
    return player.selectedBossId;
  }

  return "";
}

function getClientSpecialUnitCombatMultiplier(unitLevel, specialUnitId) {
  const multipliers = specialUnitId === "jyoon"
    ? JYOON_SPECIAL_UNIT_COMBAT_MULTIPLIERS
    : DEFAULT_SPECIAL_UNIT_COMBAT_MULTIPLIERS;
  return multipliers[unitLevel - SPECIAL_UNIT_LEVEL_MIN] ?? multipliers[0] ?? 1;
}

function getClientSpecialUnitCombatMultiplierDelta(currentLevel, specialUnitId) {
  const normalizedCurrentLevel = clampSpecialUnitLevel(Math.floor(currentLevel));
  if (normalizedCurrentLevel >= SPECIAL_UNIT_LEVEL_MAX) {
    return 0;
  }

  return getClientSpecialUnitCombatMultiplier(normalizedCurrentLevel + 1, specialUnitId)
    - getClientSpecialUnitCombatMultiplier(normalizedCurrentLevel, specialUnitId);
}

function getAdjustedSkillScore(bonus, progression) {
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

function getClientSpecialUnitMilestoneBonusScore(currentLevel, progression) {
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

export function getClientSpecialUnitLevel(player) {
  const rawLevel = Number(player?.specialUnitLevel ?? player?.level ?? SPECIAL_UNIT_LEVEL_MIN);
  if (!Number.isFinite(rawLevel)) {
    return SPECIAL_UNIT_LEVEL_MIN;
  }

  return clampSpecialUnitLevel(Math.round(rawLevel));
}

export function getClientSpecialUnitUpgradeCost(player) {
  const currentLevel = getClientSpecialUnitLevel(player);
  if (currentLevel >= SPECIAL_UNIT_LEVEL_MAX) {
    return null;
  }

  const specialUnitId = getClientSelectedSpecialUnitId(player);
  const costs = specialUnitId === "jyoon"
    ? JYOON_SPECIAL_UNIT_UPGRADE_COSTS
    : DEFAULT_SPECIAL_UNIT_UPGRADE_COSTS;

  return costs[currentLevel - SPECIAL_UNIT_LEVEL_MIN] ?? null;
}

export function getClientSpecialUnitUpgradeValueScore(player) {
  const currentLevel = getClientSpecialUnitLevel(player);
  const nextUpgradeCost = getClientSpecialUnitUpgradeCost(player);
  if (nextUpgradeCost === null) {
    return 0;
  }

  const specialUnitId = getClientSelectedSpecialUnitId(player);
  const progression = SPECIAL_UNIT_PROGRESSION_BONUS_BY_ID[specialUnitId]
    ?? DEFAULT_SPECIAL_UNIT_PROGRESSION_BONUS;
  const baseGrowthScore =
    getClientSpecialUnitCombatMultiplierDelta(currentLevel, specialUnitId) * BASE_MULTIPLIER_DELTA_SCORE;
  const milestoneBonusScore = getClientSpecialUnitMilestoneBonusScore(currentLevel, progression);

  return (baseGrowthScore + milestoneBonusScore) / nextUpgradeCost;
}
