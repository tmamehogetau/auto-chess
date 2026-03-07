import type { BoardUnitPlacement, BoardUnitType } from "../shared/room-messages";
import { SCARLET_MANSION_UNITS } from "../data/scarlet-mansion-units";
import { RUMOR_UNITS_BY_ROUND } from "../data/rumor-units";
import { getActiveRosterUnits } from "./roster/roster-provider";
import type { FeatureFlags } from "../shared/feature-flags";

type ResolvedUnitMetadata = {
  unitType: BoardUnitType;
  archetype?: string;
};

const scarletUnitMetadataById = new Map<string, ResolvedUnitMetadata>(
  SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, { unitType: unit.unitType, archetype: unit.id }]),
);

const rumorUnitMetadataById = new Map<string, ResolvedUnitMetadata>(
  Object.values(RUMOR_UNITS_BY_ROUND).map((unit) => [unit.unitId, { unitType: unit.unitType }]),
);

/**
 * Get resolved unit metadata from roster provider.
 * This is the boundary function that MUST use roster provider for all roster data access.
 * 
 * @param unitId - Unit ID to resolve
 * @param flags - Feature flags (required for roster selection)
 * @returns Resolved unit metadata or undefined if not found
 * @throws TouhouRosterNotConfiguredError - When Touhou roster is active but not configured
 */
function getResolvedUnitMetadata(
  unitId: string, 
  flags: FeatureFlags
): ResolvedUnitMetadata | undefined {
  // Check scarlet and rumor units first (same behavior regardless of roster)
  const scarletOrRumor = scarletUnitMetadataById.get(unitId) ?? rumorUnitMetadataById.get(unitId);
  if (scarletOrRumor) {
    return scarletOrRumor;
  }

  // For MVP units, ALWAYS use roster provider (flags is now required)
  const rosterUnits = getActiveRosterUnits(flags);
  const rosterUnit = rosterUnits.find((u) => u.unitId === unitId);
  if (rosterUnit) {
    return { unitType: rosterUnit.type };
  }

  // Unit not found in any roster
  return undefined;
}

/**
 * Resolve battle placement with roster provider integration.
 * Uses roster provider boundary for MVP units.
 *
 * @param placement - Board unit placement
 * @param flags - Feature flags for roster selection (required)
 * @returns Resolved placement
 * @throws TouhouRosterNotConfiguredError - When Touhou roster is active but not configured
 */
export function resolveBattlePlacement(
  placement: BoardUnitPlacement,
  flags: FeatureFlags
): BoardUnitPlacement {
  if (!placement.unitId) {
    return { ...placement };
  }

  const resolvedMetadata = getResolvedUnitMetadata(placement.unitId, flags);
  if (!resolvedMetadata) {
    return { ...placement };
  }

  if (resolvedMetadata.archetype !== undefined) {
    return {
      ...placement,
      unitType: resolvedMetadata.unitType,
      archetype: resolvedMetadata.archetype,
    };
  }

  return {
    ...placement,
    unitType: resolvedMetadata.unitType,
  };
}

/**
 * Resolve multiple battle placements.
 *
 * @param placements - Array of board unit placements
 * @param flags - Feature flags for roster selection (required)
 * @returns Array of resolved placements
 * @throws TouhouRosterNotConfiguredError - When Touhou roster is active but not configured
 */
export function resolveBattlePlacements(
  placements: BoardUnitPlacement[],
  flags: FeatureFlags
): BoardUnitPlacement[] {
  return placements.map((placement) => resolveBattlePlacement(placement, flags));
}
