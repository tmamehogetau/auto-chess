import type { BoardUnitPlacement, BoardUnitType } from "../shared/room-messages";
import { SCARLET_MANSION_UNITS } from "../data/scarlet-mansion-units";
import type { TouhouFactionId } from "../data/touhou-units";
import { RUMOR_UNITS_BY_ROUND } from "../data/rumor-units";
import { getActiveRosterUnitById } from "./roster/roster-provider";
import type { FeatureFlags } from "../shared/feature-flags";

type ResolvedUnitMetadata = {
  unitType: BoardUnitType;
  cost?: number;
  archetype?: string;
  factionId?: TouhouFactionId | null;
  hp?: number;
  attack?: number;
  attackSpeed?: number;
  range?: number;
  defense?: number;
  critRate?: number;
  critDamageMultiplier?: number;
  physicalReduction?: number;
  magicReduction?: number;
};

const scarletUnitMetadataById = new Map<string, ResolvedUnitMetadata>(
  SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, {
    unitType: unit.unitType,
    cost: unit.cost,
    archetype: unit.id,
    hp: unit.hp,
    attack: unit.attack,
    attackSpeed: unit.attackSpeed,
    range: unit.range,
    defense: unit.defense,
    critRate: unit.critRate,
    critDamageMultiplier: unit.critDamageMultiplier,
    physicalReduction: unit.physicalReduction,
    magicReduction: unit.magicReduction,
  }]),
);

const rumorUnitMetadataById = new Map<string, ResolvedUnitMetadata>(
  Object.values(RUMOR_UNITS_BY_ROUND).map((unit) => [unit.unitId, {
    unitType: unit.unitType,
    cost: unit.rarity,
  }]),
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
  const rosterUnit = getActiveRosterUnitById(flags, unitId);
  if (rosterUnit) {
    const resolvedMetadata: ResolvedUnitMetadata = {
      unitType: rosterUnit.type,
      cost: rosterUnit.cost,
    };

    if (flags.enableTouhouRoster) {
      resolvedMetadata.hp = rosterUnit.hp;
      resolvedMetadata.attack = rosterUnit.attack;
      resolvedMetadata.attackSpeed = rosterUnit.attackSpeed;
      resolvedMetadata.range = rosterUnit.range;
      resolvedMetadata.defense = rosterUnit.defense;
      resolvedMetadata.critRate = rosterUnit.critRate;
      resolvedMetadata.critDamageMultiplier = rosterUnit.critDamageMultiplier;
      resolvedMetadata.physicalReduction = rosterUnit.physicalReduction;
      resolvedMetadata.magicReduction = rosterUnit.magicReduction;
    }

    if (rosterUnit.factionId !== undefined) {
      resolvedMetadata.factionId = rosterUnit.factionId;
    }

    return resolvedMetadata;
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
    const resolvedPlacement: BoardUnitPlacement = {
      ...placement,
      unitType: resolvedMetadata.unitType,
      archetype: resolvedMetadata.archetype,
    };

    if (resolvedMetadata.factionId !== undefined) {
      resolvedPlacement.factionId = resolvedMetadata.factionId;
    }

    if (resolvedMetadata.hp !== undefined) {
      resolvedPlacement.hp = resolvedMetadata.hp;
    }

    if (resolvedMetadata.attack !== undefined) {
      resolvedPlacement.attack = resolvedMetadata.attack;
    }

    if (resolvedMetadata.attackSpeed !== undefined) {
      resolvedPlacement.attackSpeed = resolvedMetadata.attackSpeed;
    }

    if (resolvedMetadata.range !== undefined) {
      resolvedPlacement.range = resolvedMetadata.range;
    }

    if (resolvedMetadata.defense !== undefined) {
      resolvedPlacement.defense = resolvedMetadata.defense;
    }

    if (resolvedMetadata.critRate !== undefined) {
      resolvedPlacement.critRate = resolvedMetadata.critRate;
    }

    if (resolvedMetadata.critDamageMultiplier !== undefined) {
      resolvedPlacement.critDamageMultiplier = resolvedMetadata.critDamageMultiplier;
    }

    if (resolvedMetadata.physicalReduction !== undefined) {
      resolvedPlacement.physicalReduction = resolvedMetadata.physicalReduction;
    }

    if (resolvedMetadata.magicReduction !== undefined) {
      resolvedPlacement.magicReduction = resolvedMetadata.magicReduction;
    }

    return resolvedPlacement;
  }

  const resolvedPlacement: BoardUnitPlacement = {
    ...placement,
    unitType: resolvedMetadata.unitType,
  };

  if (resolvedMetadata.factionId !== undefined) {
    resolvedPlacement.factionId = resolvedMetadata.factionId;
  }

  if (resolvedMetadata.hp !== undefined) {
    resolvedPlacement.hp = resolvedMetadata.hp;
  }

  if (resolvedMetadata.attack !== undefined) {
    resolvedPlacement.attack = resolvedMetadata.attack;
  }

  if (resolvedMetadata.attackSpeed !== undefined) {
    resolvedPlacement.attackSpeed = resolvedMetadata.attackSpeed;
  }

  if (resolvedMetadata.range !== undefined) {
    resolvedPlacement.range = resolvedMetadata.range;
  }

  if (resolvedMetadata.defense !== undefined) {
    resolvedPlacement.defense = resolvedMetadata.defense;
  }

  if (resolvedMetadata.critRate !== undefined) {
    resolvedPlacement.critRate = resolvedMetadata.critRate;
  }

  if (resolvedMetadata.critDamageMultiplier !== undefined) {
    resolvedPlacement.critDamageMultiplier = resolvedMetadata.critDamageMultiplier;
  }

  if (resolvedMetadata.physicalReduction !== undefined) {
    resolvedPlacement.physicalReduction = resolvedMetadata.physicalReduction;
  }

  if (resolvedMetadata.magicReduction !== undefined) {
    resolvedPlacement.magicReduction = resolvedMetadata.magicReduction;
  }

  return resolvedPlacement;
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

export function resolveSharedPoolCost(
  unitId: string | undefined,
  fallbackCost: number,
  flags: FeatureFlags,
): number {
  if (!unitId) {
    return fallbackCost;
  }

  return getResolvedUnitMetadata(unitId, flags)?.cost ?? fallbackCost;
}
