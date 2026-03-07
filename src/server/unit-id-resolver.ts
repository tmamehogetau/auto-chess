import type { BoardUnitPlacement, BoardUnitType } from "../shared/room-messages";
import mvpPhase1UnitsData from "../data/mvp_phase1_units.json";
import { SCARLET_MANSION_UNITS } from "../data/scarlet-mansion-units";
import { RUMOR_UNITS_BY_ROUND } from "../data/rumor-units";

type ResolvedUnitMetadata = {
  unitType: BoardUnitType;
  archetype?: string;
};

const mvpUnitMetadataById = new Map<string, ResolvedUnitMetadata>(
  mvpPhase1UnitsData.units.map((unit) => [unit.unitId, { unitType: unit.type as BoardUnitType }]),
);

const scarletUnitMetadataById = new Map<string, ResolvedUnitMetadata>(
  SCARLET_MANSION_UNITS.map((unit) => [unit.unitId, { unitType: unit.unitType, archetype: unit.id }]),
);

const rumorUnitMetadataById = new Map<string, ResolvedUnitMetadata>(
  Object.values(RUMOR_UNITS_BY_ROUND).map((unit) => [unit.unitId, { unitType: unit.unitType }]),
);

function getResolvedUnitMetadata(unitId: string): ResolvedUnitMetadata | undefined {
  return scarletUnitMetadataById.get(unitId) ?? rumorUnitMetadataById.get(unitId) ?? mvpUnitMetadataById.get(unitId);
}

export function resolveBattlePlacement(placement: BoardUnitPlacement): BoardUnitPlacement {
  if (!placement.unitId) {
    return { ...placement };
  }

  const resolvedMetadata = getResolvedUnitMetadata(placement.unitId);
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

export function resolveBattlePlacements(placements: BoardUnitPlacement[]): BoardUnitPlacement[] {
  return placements.map((placement) => resolveBattlePlacement(placement));
}
