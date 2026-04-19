import type { BoardUnitType } from "../shared/room-messages";
import { DEFAULT_MOVEMENT_SPEED, type CombatStats, type UnitId } from "../shared/types";

export interface HeroExclusiveUnit extends CombatStats {
  id: string;
  unitId: UnitId;
  displayName: string;
  unitType: BoardUnitType;
  cost: 3;
  exclusiveHeroId: string;
  skillId: string;
  pairSkillId: string;
  role: string;
  skillDescription: string;
}

export const HERO_EXCLUSIVE_UNITS: Readonly<HeroExclusiveUnit[]> = [
  {
    id: "mayumi",
    unitId: "mayumi",
    displayName: "杖刀偶磨弓",
    unitType: "vanguard",
    cost: 3,
    hp: 920,
    attack: 68,
    attackSpeed: 0.88,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 14,
    exclusiveHeroId: "keiki",
    skillId: "mayumi-basic",
    pairSkillId: "mayumi-pair",
    role: "耐久寄り前衛",
    skillDescription: "一定時間、自身の被ダメージを軽減する。",
  },
  {
    id: "shion",
    unitId: "shion",
    displayName: "依神紫苑",
    unitType: "assassin",
    cost: 3,
    hp: 600,
    attack: 110,
    attackSpeed: 1.1,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 5,
    exclusiveHeroId: "jyoon",
    skillId: "shion-basic",
    pairSkillId: "shion-pair",
    role: "妨害寄り暗殺",
    skillDescription: "命中した敵の与ダメージを短時間低下させる。",
  },
  {
    id: "ariya",
    unitId: "ariya",
    displayName: "磐永阿梨夜",
    unitType: "vanguard",
    cost: 3,
    hp: 760,
    attack: 114,
    attackSpeed: 1,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 6,
    exclusiveHeroId: "yuiman",
    skillId: "ariya-basic",
    pairSkillId: "",
    role: "火力寄り前衛",
    skillDescription: "短時間、自身の攻撃性能を引き上げる。",
  },
] as const;

export function getHeroExclusiveUnitById(unitId: string): HeroExclusiveUnit | null {
  return HERO_EXCLUSIVE_UNITS.find((unit) => unit.unitId === unitId) ?? null;
}

export function isHeroExclusiveUnitId(unitId: string): boolean {
  return HERO_EXCLUSIVE_UNITS.some((unit) => unit.unitId === unitId);
}

export function getHeroExclusiveOffersForHero(heroId: string): HeroExclusiveUnit[] {
  if (typeof heroId !== "string" || heroId.length === 0) {
    return [];
  }

  return HERO_EXCLUSIVE_UNITS.filter((unit) => unit.exclusiveHeroId === heroId);
}
