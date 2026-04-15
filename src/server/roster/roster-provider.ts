import type { TouhouFactionId } from "../../data/touhou-units";
import type { FeatureFlags } from "../../shared/feature-flags";
import { DEFAULT_MOVEMENT_SPEED, type BoardUnitType, type CombatStats, type UnitSkill } from "../../shared/types";
import mvpPhase1UnitsData from "../../data/mvp_phase1_units.json";
import { TOUHOU_UNITS } from "../../data/touhou-units";

/**
 * Generic roster unit interface - not tied to MVP-specific types.
 * Supports both the legacy MVP regression path and the Touhou mainline roster.
 */
export interface RosterUnit extends CombatStats {
  id: string;
  unitId: string;
  name: string;
  type: BoardUnitType;
  factionId?: TouhouFactionId | null;
  cost: number;
  synergy: string[];
  subUnit?: {
    unitId: string;
    mode: "assist";
    bonusAttackPct?: number;
    bonusHpPct?: number;
  };
  skill?: UnitSkill;
}

/**
 * Roster kind identifiers
 */
export const ROSTER_KIND_MVP = "mvp" as const;
export const ROSTER_KIND_TOUHOU = "touhou" as const;

export type RosterKind = typeof ROSTER_KIND_MVP | typeof ROSTER_KIND_TOUHOU;

/**
 * Error thrown when Touhou roster is requested but not configured
 */
export class TouhouRosterNotConfiguredError extends Error {
  constructor() {
    super("Touhou roster data is not configured yet");
    this.name = "TouhouRosterNotConfiguredError";
  }
}

/**
 * Internal roster source types - abstraction boundary for source selection.
 */
type RosterSource = "mvp-json" | "touhou-roster";

/**
 * Select the roster source based on feature flags.
 * This is the abstraction boundary - future source types can be added here.
 *
 * @param flags - Current feature flags
 * @returns RosterSource - The selected source type
 */
function selectRosterSource(flags: FeatureFlags): RosterSource {
  if (flags.enableTouhouRoster) {
    return "touhou-roster";
  }
  return "mvp-json";
}

/**
 * Load units from MVP JSON source.
 * Isolated for testability and future source additions.
 *
 * @returns RosterUnit[] - MVP roster units
 */
function loadMvpRosterUnits(): RosterUnit[] {
  return (mvpPhase1UnitsData.units as Array<
    Omit<RosterUnit, "movementSpeed" | "defense" | "critRate" | "critDamageMultiplier" | "physicalReduction" | "magicReduction">
    & Partial<Pick<RosterUnit, "movementSpeed" | "defense" | "critRate" | "critDamageMultiplier" | "physicalReduction" | "magicReduction">>
  >).map((unit) => ({
    ...unit,
    movementSpeed: unit.movementSpeed ?? DEFAULT_MOVEMENT_SPEED,
    defense: unit.defense ?? (unit.type === "vanguard" ? 3 : 0),
    critRate: unit.critRate ?? 0,
    critDamageMultiplier: unit.critDamageMultiplier ?? 1.5,
    physicalReduction: unit.physicalReduction ?? 0,
    magicReduction: unit.magicReduction ?? 0,
  }));
}

export function getTouhouDraftRosterUnits(): RosterUnit[] {
  return TOUHOU_UNITS.map((unit) => ({
    id: unit.unitId,
    unitId: unit.unitId,
    name: unit.displayName,
    type: unit.unitType,
    factionId: unit.factionId,
    cost: unit.cost,
    hp: unit.hp,
    attack: unit.attack,
    attackSpeed: unit.attackSpeed,
    movementSpeed: unit.movementSpeed,
    range: unit.range,
    defense: unit.defense,
    critRate: unit.critRate,
    critDamageMultiplier: unit.critDamageMultiplier,
    physicalReduction: unit.physicalReduction,
    magicReduction: unit.magicReduction,
    synergy: unit.factionId ? [unit.factionId] : [],
  }));
}

/**
 * Get the active roster kind based on feature flags.
 * @param flags - Current feature flags
 * @returns RosterKind - Either MVP or Touhou roster
 */
export function getActiveRosterKind(flags: FeatureFlags): RosterKind {
  return flags.enableTouhouRoster ? ROSTER_KIND_TOUHOU : ROSTER_KIND_MVP;
}

/**
 * Get active roster unit definitions.
 * Returns MVP roster when enableTouhouRoster=false (from production data source).
 * Returns Touhou draft roster when enableTouhouRoster=true.
 *
 * @param flags - Current feature flags
 * @returns RosterUnit[] - Array of active roster units
 */
export function getActiveRosterUnits(flags: FeatureFlags): RosterUnit[] {
  const source = selectRosterSource(flags);

  switch (source) {
    case "mvp-json":
      return loadMvpRosterUnits();
    case "touhou-roster":
      return getTouhouDraftRosterUnits();
    default:
      // Exhaustiveness check - should never reach here
      throw new TouhouRosterNotConfiguredError();
  }
}

export function getActiveRosterUnitById(
  flags: FeatureFlags,
  unitId: string,
): RosterUnit | undefined {
  return getActiveRosterUnits(flags).find((unit) => unit.unitId === unitId);
}

export function validateRosterAvailability(flags: FeatureFlags): void {
  void getActiveRosterUnits(flags);
}
