import type { BoardUnitType, UnitEffectSetId } from "../../shared/room-messages";

export type { UnitEffectSetId } from "../../shared/room-messages";

export type UnitSkillActivation =
  | "all-back"
  | "all-front"
  | "all-back-with-mage-spotter";

export interface UnitSkillRule {
  minimumCount: number;
  bonus: number;
  activation: UnitSkillActivation;
}

export interface UnitEffectRule {
  basePower: number;
  frontRowBonus: number;
  backRowBonus: number;
  skill?: UnitSkillRule;
}

export const VALID_UNIT_TYPES: ReadonlySet<BoardUnitType> = new Set<BoardUnitType>([
  "vanguard",
  "ranger",
  "mage",
  "assassin",
]);

export const DEFAULT_UNIT_EFFECT_SET_ID: UnitEffectSetId = "set1";

const VALID_UNIT_EFFECT_SET_IDS: ReadonlySet<UnitEffectSetId> = new Set<UnitEffectSetId>([
  "set1",
  "set2",
]);

const UNIT_EFFECT_SETS: Readonly<
  Record<UnitEffectSetId, Readonly<Record<BoardUnitType, UnitEffectRule>>>
> = {
  set1: {
    vanguard: {
      basePower: 4,
      frontRowBonus: 2,
      backRowBonus: -1,
      skill: {
        minimumCount: 2,
        bonus: 5,
        activation: "all-front",
      },
    },
    ranger: {
      basePower: 5,
      frontRowBonus: 0,
      backRowBonus: 1,
      skill: {
        minimumCount: 2,
        bonus: 3,
        activation: "all-back-with-mage-spotter",
      },
    },
    mage: {
      basePower: 5,
      frontRowBonus: -2,
      backRowBonus: 2,
      skill: {
        minimumCount: 2,
        bonus: 4,
        activation: "all-back",
      },
    },
    assassin: {
      basePower: 5,
      frontRowBonus: -1,
      backRowBonus: 2,
      skill: {
        minimumCount: 2,
        bonus: 3,
        activation: "all-back",
      },
    },
  },
  set2: {
    vanguard: {
      basePower: 4,
      frontRowBonus: 2,
      backRowBonus: -1,
      skill: {
        minimumCount: 2,
        bonus: 5,
        activation: "all-front",
      },
    },
    ranger: {
      basePower: 5,
      frontRowBonus: 0,
      backRowBonus: 1,
      skill: {
        minimumCount: 2,
        bonus: 3,
        activation: "all-back",
      },
    },
    mage: {
      basePower: 5,
      frontRowBonus: -2,
      backRowBonus: 2,
      skill: {
        minimumCount: 2,
        bonus: 4,
        activation: "all-back",
      },
    },
    assassin: {
      basePower: 5,
      frontRowBonus: -1,
      backRowBonus: 2,
      skill: {
        minimumCount: 2,
        bonus: 3,
        activation: "all-back",
      },
    },
  },
};

export function getUnitEffectTable(
  setId: UnitEffectSetId = DEFAULT_UNIT_EFFECT_SET_ID,
): Readonly<Record<BoardUnitType, UnitEffectRule>> {
  return UNIT_EFFECT_SETS[setId];
}

export function isUnitEffectSetId(value: unknown): value is UnitEffectSetId {
  if (typeof value !== "string") {
    return false;
  }

  return VALID_UNIT_EFFECT_SET_IDS.has(value as UnitEffectSetId);
}

export const UNIT_EFFECT_TABLE = getUnitEffectTable(DEFAULT_UNIT_EFFECT_SET_ID);
