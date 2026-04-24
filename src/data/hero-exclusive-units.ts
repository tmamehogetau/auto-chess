import type { BoardUnitType } from "../shared/room-messages";
import type { UnitProgressionBonusConfig } from "../shared/progression-bonus-types";
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
  progressionBonus: UnitProgressionBonusConfig;
}

export const HERO_EXCLUSIVE_UNITS: Readonly<HeroExclusiveUnit[]> = [
  {
    id: "mayumi",
    unitId: "mayumi",
    displayName: "杖刀偶磨弓",
    unitType: "vanguard",
    cost: 3,
    hp: 1240,
    attack: 104,
    attackSpeed: 0.9,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 28,
    exclusiveHeroId: "keiki",
    skillId: "mayumi-basic",
    pairSkillId: "mayumi-pair",
    role: "耐久寄り前衛",
    skillDescription: "一定時間、自身の攻撃と防御を強化する。",
    progressionBonus: {
      baseGrowthProfile: "frontline",
      level4Bonus: {
        kind: "pair-skill-unlock",
        summary: "Lv4で埴輪「アイドルクリーチャー」が解禁される",
        skillScore: 24,
      },
      level7Bonus: {
        kind: "pair-skill-upgrade",
        summary: "Lv7で埴輪「アイドルクリーチャー」のシールドと攻撃支援が強化される",
        skillScore: 22,
      },
      skillImplementationState: "implemented",
    },
  },
  {
    id: "shion",
    unitId: "shion",
    displayName: "依神紫苑",
    unitType: "assassin",
    cost: 3,
    hp: 860,
    attack: 148,
    attackSpeed: 1.22,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 10,
    exclusiveHeroId: "jyoon",
    skillId: "shion-basic",
    pairSkillId: "shion-pair",
    role: "妨害寄り暗殺",
    skillDescription: "現在の攻撃対象へダメージを与え、攻撃力を低下させる。",
    progressionBonus: {
      baseGrowthProfile: "debuff",
      level4Bonus: {
        kind: "pair-skill-unlock",
        summary: "Lv4で最凶最悪の双子神が解禁される",
        skillScore: 22,
      },
      level7Bonus: {
        kind: "pair-skill-upgrade",
        summary: "Lv7で最凶最悪の双子神の妨害と女苑支援が強化される",
        skillScore: 20,
      },
      skillImplementationState: "implemented",
    },
  },
  {
    id: "ariya",
    unitId: "ariya",
    displayName: "磐永阿梨夜",
    unitType: "vanguard",
    cost: 3,
    hp: 1040,
    attack: 176,
    attackSpeed: 1.2,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    range: 1,
    critRate: 0,
    critDamageMultiplier: 1.5,
    damageReduction: 14,
    exclusiveHeroId: "yuiman",
    skillId: "ariya-basic",
    pairSkillId: "",
    role: "火力寄り前衛",
    skillDescription: "発動するたびに自身の攻撃と防御が累積上昇する。",
    progressionBonus: {
      baseGrowthProfile: "offense",
      level4Bonus: {
        kind: "skill-upgrade",
        summary: "Lv4でストーンゴッデスのスタック上限と1スタック性能が強化される",
        skillScore: 18,
      },
      level7Bonus: {
        kind: "skill-upgrade",
        summary: "Lv7でストーンゴッデスの最大成長量が強化される",
        skillScore: 22,
      },
      skillImplementationState: "implemented",
    },
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
