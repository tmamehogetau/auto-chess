export const SPECIAL_UNIT_LEVEL_MIN = 1;
export const SPECIAL_UNIT_LEVEL_MAX = 7;

const DEFAULT_SPECIAL_UNIT_UPGRADE_COST_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 2,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 7,
};

const JYOON_SPECIAL_UNIT_UPGRADE_COST_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 3,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 8,
};

const DEFAULT_SPECIAL_UNIT_COMBAT_MULTIPLIER_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 1.0,
  2: 1.15,
  3: 1.3,
  4: 1.55,
  5: 1.95,
  6: 2.4,
  7: 3.0,
};

const JYOON_SPECIAL_UNIT_COMBAT_MULTIPLIER_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 1.0,
  2: 1.2,
  3: 1.4,
  4: 1.75,
  5: 2.25,
  6: 2.85,
  7: 3.6,
};

function usesJyoonProgression(unitId: string | undefined): boolean {
  return unitId === "jyoon";
}

export function getSpecialUnitUpgradeCost(
  currentLevel: number,
  specialUnitId?: string,
): number | null {
  if (!Number.isInteger(currentLevel)) {
    return null;
  }

  if (currentLevel < SPECIAL_UNIT_LEVEL_MIN || currentLevel >= SPECIAL_UNIT_LEVEL_MAX) {
    return null;
  }

  const costTable = usesJyoonProgression(specialUnitId)
    ? JYOON_SPECIAL_UNIT_UPGRADE_COST_BY_LEVEL
    : DEFAULT_SPECIAL_UNIT_UPGRADE_COST_BY_LEVEL;

  return costTable[currentLevel] ?? null;
}

export function calculateSpecialUnitUpgradeCost(
  currentLevel: number,
  upgradeCount: number,
  specialUnitId?: string,
): number | null {
  if (!Number.isInteger(upgradeCount) || upgradeCount < 1) {
    return null;
  }

  let totalCost = 0;
  let nextLevel = currentLevel;

  for (let index = 0; index < upgradeCount; index += 1) {
    const cost = getSpecialUnitUpgradeCost(nextLevel, specialUnitId);
    if (cost === null) {
      return null;
    }

    totalCost += cost;
    nextLevel += 1;
  }

  return totalCost;
}

export function upgradeSpecialUnitLevel(
  currentLevel: number,
  upgradeCount: number,
): number | null {
  if (!Number.isInteger(currentLevel) || !Number.isInteger(upgradeCount) || upgradeCount < 1) {
    return null;
  }

  const nextLevel = currentLevel + upgradeCount;
  if (
    currentLevel < SPECIAL_UNIT_LEVEL_MIN
    || nextLevel < SPECIAL_UNIT_LEVEL_MIN
    || nextLevel > SPECIAL_UNIT_LEVEL_MAX
  ) {
    return null;
  }

  return nextLevel;
}

export function getSpecialUnitCombatMultiplier(
  unitLevel: number = SPECIAL_UNIT_LEVEL_MIN,
  specialUnitId?: string,
): number {
  const multiplierTable = usesJyoonProgression(specialUnitId)
    ? JYOON_SPECIAL_UNIT_COMBAT_MULTIPLIER_BY_LEVEL
    : DEFAULT_SPECIAL_UNIT_COMBAT_MULTIPLIER_BY_LEVEL;

  return multiplierTable[unitLevel] ?? multiplierTable[SPECIAL_UNIT_LEVEL_MIN] ?? 1;
}

export function getSpecialUnitCombatMultiplierDelta(
  currentLevel: number,
  specialUnitId?: string,
): number {
  if (
    !Number.isFinite(currentLevel)
    || !Number.isInteger(currentLevel)
    || currentLevel < SPECIAL_UNIT_LEVEL_MIN
  ) {
    return 0;
  }

  const normalizedCurrentLevel = Math.min(SPECIAL_UNIT_LEVEL_MAX, currentLevel);
  if (normalizedCurrentLevel >= SPECIAL_UNIT_LEVEL_MAX) {
    return 0;
  }

  return getSpecialUnitCombatMultiplier(normalizedCurrentLevel + 1, specialUnitId)
    - getSpecialUnitCombatMultiplier(normalizedCurrentLevel, specialUnitId);
}
