export function getClientSpecialUnitLevel(player?: {
  specialUnitLevel?: number | null;
  level?: number | null;
} | null): number;

export function getClientSpecialUnitUpgradeCost(player?: {
  specialUnitLevel?: number | null;
  level?: number | null;
  selectedHeroId?: string | null;
  selectedBossId?: string | null;
} | null): number | null;
