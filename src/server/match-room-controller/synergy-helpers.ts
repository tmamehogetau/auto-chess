import type {
  BoardUnitPlacement,
  BoardUnitType,
} from "../../shared/room-messages";
import type { FeatureFlags } from "../../shared/feature-flags";
import { resolveBattlePlacements } from "../unit-id-resolver";
import {
  calculateSynergyDetails,
} from "../combat/synergy-definitions";

export interface ActiveSynergy {
  unitType: string;
  count: number;
  tier: number;
}

export function calculateActiveSynergyList(
  placements: BoardUnitPlacement[] | undefined,
  heroSynergyBonusType: BoardUnitType | null,
  rosterFlags: FeatureFlags,
): ActiveSynergy[] {
  if (!placements) {
    return [];
  }

  const resolvedPlacements = resolveBattlePlacements(placements, rosterFlags);
  const synergyDetails = calculateSynergyDetails(
    resolvedPlacements,
    heroSynergyBonusType,
    { enableTouhouFactions: rosterFlags.enableTouhouFactions },
  );
  const result: ActiveSynergy[] = [];
  const unitTypes: BoardUnitType[] = ["vanguard", "ranger", "mage", "assassin"];

  for (const unitType of unitTypes) {
    const count = synergyDetails.countsByType[unitType] ?? 0;
    const tier = synergyDetails.activeTiers[unitType] ?? 0;

    if (count > 0) {
      result.push({ unitType, count, tier });
    }
  }

  if (rosterFlags.enableTouhouFactions) {
    for (const [factionId, count] of Object.entries(synergyDetails.factionCounts)) {
      if (!count || count <= 0) {
        continue;
      }

      result.push({
        unitType: factionId,
        count,
        tier: synergyDetails.factionActiveTiers[
          factionId as keyof typeof synergyDetails.factionActiveTiers
        ] ?? 0,
      });
    }
  }

  return result;
}
