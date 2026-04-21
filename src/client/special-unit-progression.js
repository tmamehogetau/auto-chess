const SPECIAL_UNIT_LEVEL_MIN = 1;
const SPECIAL_UNIT_LEVEL_MAX = 7;

const DEFAULT_SPECIAL_UNIT_UPGRADE_COSTS = [2, 2, 3, 4, 6, 9];
const JYOON_SPECIAL_UNIT_UPGRADE_COSTS = [3, 3, 4, 5, 7, 10];

function clampSpecialUnitLevel(level) {
  return Math.min(SPECIAL_UNIT_LEVEL_MAX, Math.max(SPECIAL_UNIT_LEVEL_MIN, level));
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

  const specialUnitId = typeof player?.selectedHeroId === "string" && player.selectedHeroId.length > 0
    ? player.selectedHeroId
    : typeof player?.selectedBossId === "string" && player.selectedBossId.length > 0
      ? player.selectedBossId
      : "";
  const costs = specialUnitId === "jyoon"
    ? JYOON_SPECIAL_UNIT_UPGRADE_COSTS
    : DEFAULT_SPECIAL_UNIT_UPGRADE_COSTS;

  return costs[currentLevel - SPECIAL_UNIT_LEVEL_MIN] ?? null;
}
