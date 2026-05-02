import type { FeatureFlags } from "../shared/feature-flags";

const CHIMATA_LEVEL_UP_GOLD_BONUS = 1;
const CHIMATA_LEVEL_UP_FREE_REFRESH_BONUS_BY_LEVEL: Readonly<Record<number, number>> = {
  4: 1,
  7: 2,
};

export function getTouhouLevelUpGoldBonuses(
  unitId: string | undefined,
  previousUnitLevel: number,
  nextUnitLevel: number,
  rosterFlags: Pick<FeatureFlags, "enableTouhouRoster"> | undefined,
): Array<{ unitLevel: number; gold: number; freeRefreshes: number }> {
  if (unitId !== "chimata" || rosterFlags?.enableTouhouRoster !== true) {
    return [];
  }

  const bonuses: Array<{ unitLevel: number; gold: number; freeRefreshes: number }> = [];
  for (let unitLevel = Math.floor(previousUnitLevel) + 1; unitLevel <= Math.floor(nextUnitLevel); unitLevel += 1) {
    if (unitLevel < 2) {
      continue;
    }

    bonuses.push({
      unitLevel,
      gold: CHIMATA_LEVEL_UP_GOLD_BONUS,
      freeRefreshes: CHIMATA_LEVEL_UP_FREE_REFRESH_BONUS_BY_LEVEL[unitLevel] ?? 0,
    });
  }

  return bonuses
    .filter(({ unitLevel }) => previousUnitLevel < unitLevel && nextUnitLevel >= unitLevel);
}
