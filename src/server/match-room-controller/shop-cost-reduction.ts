import type { BoardUnitPlacement } from "../../shared/room-messages";
import type { FeatureFlags } from "../../shared/feature-flags";
import { calculateSynergyDetails, getTouhouFactionTierEffect } from "../combat/synergy-definitions";
import { getTouhouUnitById } from "../../data/touhou-units";
import { resolveBattlePlacements } from "../unit-id-resolver";

interface ShopOfferLike {
  unitId?: string;
  cost: number;
}

export function calculateDiscountedShopOfferCost(
  offer: ShopOfferLike,
  boardPlacements: BoardUnitPlacement[],
  rosterFlags: FeatureFlags,
): number {
  if (!rosterFlags.enableTouhouFactions || !offer.unitId) {
    return offer.cost;
  }

  if (!getTouhouUnitById(offer.unitId)) {
    return offer.cost;
  }

  const resolvedPlacements = resolveBattlePlacements(boardPlacements, rosterFlags);
  const synergyDetails = calculateSynergyDetails(resolvedPlacements, null, {
    enableTouhouFactions: rosterFlags.enableTouhouFactions,
  });

  let maxReduction = 0;

  for (const [factionId, tier] of Object.entries(synergyDetails.factionActiveTiers)) {
    if (!tier || tier <= 0) {
      continue;
    }

    const effect = getTouhouFactionTierEffect(factionId as keyof typeof synergyDetails.factionActiveTiers, tier);
    const reduction = effect?.special?.shopCostReduction ?? 0;
    if (reduction > maxReduction) {
      maxReduction = reduction;
    }
  }

  return Math.max(1, offer.cost - maxReduction);
}
