import { HERO_EXCLUSIVE_UNITS } from "../../data/hero-exclusive-units";
import type { UnitProgressionBonusConfig } from "../../shared/progression-bonus-types";
import { getProgressionMilestoneStage } from "../progression-bonus-config";

export type PairSkillLevel = 1 | 2 | 4 | 7;

export interface MainSubPairSkillBinding {
  id: string;
  subUnitId: string;
  subUnitDisplayName: string;
  pairSkillId: string;
  progressionBonus?: UnitProgressionBonusConfig;
  mainHeroId?: string;
  mainUnitId?: string;
  levelBreakpoints?: ReadonlyArray<{
    minUnitLevel: number;
    pairSkillLevel: PairSkillLevel;
  }>;
}

export interface SubUnitEffectBinding {
  id: string;
  subUnitId: string;
  subUnitEffectId: string;
  effectName: string;
  mainUnitId?: string;
  levelBreakpoints: ReadonlyArray<{
    minUnitLevel: number;
    effectLevel: 1 | 4 | 7;
  }>;
}

export interface SubUnitEquipmentBonus {
  hpBonus?: number;
  attackBonus?: number;
  attackSpeedMultiplier?: number;
  skillDamageMultiplier?: number;
  critRateBonus?: number;
  damageReductionBonus?: number;
}

export interface SubUnitEquipmentBonusBinding {
  id: string;
  subUnitId: string;
  label: string;
  levelBreakpoints: ReadonlyArray<{
    minUnitLevel: number;
    bonus: SubUnitEquipmentBonus;
  }>;
}

const HERO_EXCLUSIVE_PAIR_SKILL_BINDINGS: ReadonlyArray<MainSubPairSkillBinding> =
  HERO_EXCLUSIVE_UNITS
    .filter((unit) => unit.pairSkillId.length > 0)
    .map((unit) => ({
      id: `${unit.exclusiveHeroId}-${unit.unitId}-pair`,
      subUnitId: unit.unitId,
      subUnitDisplayName: unit.displayName,
      pairSkillId: unit.pairSkillId,
      progressionBonus: unit.progressionBonus,
      mainHeroId: unit.exclusiveHeroId,
    }));

const NORMAL_UNIT_PAIR_SKILL_BINDINGS: ReadonlyArray<MainSubPairSkillBinding> = [
  {
    id: "yoshika-seiga-pair",
    subUnitId: "seiga",
    subUnitDisplayName: "霍青娥",
    pairSkillId: "tongling-yoshika-pair",
    mainUnitId: "yoshika",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "koishi-satori-perfect-mind-control-pair",
    subUnitId: "satori",
    subUnitDisplayName: "古明地さとり",
    pairSkillId: "perfect-mind-control-pair",
    mainUnitId: "koishi",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "satori-koishi-heartbreaker-pair",
    subUnitId: "koishi",
    subUnitDisplayName: "古明地こいし",
    pairSkillId: "komeiji-heartbreaker-pair",
    mainUnitId: "satori",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "junko-hecatia-nameless-danmaku-pair",
    subUnitId: "hecatia",
    subUnitDisplayName: "ヘカーティア・ラピスラズリ",
    pairSkillId: "nameless-danmaku-pair",
    mainUnitId: "junko",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "hecatia-junko-nameless-danmaku-pair",
    subUnitId: "junko",
    subUnitDisplayName: "純狐",
    pairSkillId: "nameless-danmaku-pair",
    mainUnitId: "hecatia",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "megumu-tsukasa-delayed-kudagitsune-pair",
    subUnitId: "tsukasa",
    subUnitDisplayName: "菅牧典",
    pairSkillId: "delayed-kudagitsune-shot-pair",
    mainUnitId: "megumu",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "shou-nazrin-greatest-treasure-pair",
    subUnitId: "nazrin",
    subUnitDisplayName: "ナズーリン",
    pairSkillId: "greatest-treasure-pair",
    mainUnitId: "shou",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "miko-futo-gouzoku-ranbu-mononobe-pair",
    subUnitId: "futo",
    subUnitDisplayName: "物部布都",
    pairSkillId: "gouzoku-ranbu-mononobe-pair",
    mainUnitId: "miko",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
  {
    id: "miko-tojiko-gouzoku-ranbu-soga-pair",
    subUnitId: "tojiko",
    subUnitDisplayName: "蘇我屠自古",
    pairSkillId: "gouzoku-ranbu-soga-pair",
    mainUnitId: "miko",
    levelBreakpoints: [
      { minUnitLevel: 7, pairSkillLevel: 7 },
      { minUnitLevel: 4, pairSkillLevel: 4 },
      { minUnitLevel: 1, pairSkillLevel: 1 },
    ],
  },
];

export const MAIN_SUB_PAIR_SKILL_BINDINGS: ReadonlyArray<MainSubPairSkillBinding> = [
  ...HERO_EXCLUSIVE_PAIR_SKILL_BINDINGS,
  ...NORMAL_UNIT_PAIR_SKILL_BINDINGS,
];

export const SUB_UNIT_EFFECT_BINDINGS: ReadonlyArray<SubUnitEffectBinding> = [
  {
    id: "okina-back-sub-effect",
    subUnitId: "okina",
    subUnitEffectId: "okina-back",
    effectName: "秘神「裏表の逆転:裏」",
    levelBreakpoints: [
      { minUnitLevel: 7, effectLevel: 7 },
      { minUnitLevel: 4, effectLevel: 4 },
      { minUnitLevel: 1, effectLevel: 1 },
    ],
  },
];

export const SUB_UNIT_EQUIPMENT_BONUS_BINDINGS: ReadonlyArray<SubUnitEquipmentBonusBinding> = [
  {
    id: "okina-sub-equipment-bonus",
    subUnitId: "okina",
    label: "摩多羅隠岐奈",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 56, skillDamageMultiplier: 1.28 } },
      { minUnitLevel: 4, bonus: { attackBonus: 34, skillDamageMultiplier: 1.17 } },
      { minUnitLevel: 1, bonus: { attackBonus: 18, skillDamageMultiplier: 1.10 } },
    ],
  },
  {
    id: "wakasagihime-sub-equipment-bonus",
    subUnitId: "wakasagihime",
    label: "わかさぎ姫",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 30, attackSpeedMultiplier: 1.24 } },
      { minUnitLevel: 4, bonus: { attackBonus: 18, attackSpeedMultiplier: 1.16 } },
      { minUnitLevel: 1, bonus: { attackBonus: 10, attackSpeedMultiplier: 1.10 } },
    ],
  },
  {
    id: "sekibanki-sub-equipment-bonus",
    subUnitId: "sekibanki",
    label: "赤蛮奇",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 54, critRateBonus: 0.15 } },
      { minUnitLevel: 4, bonus: { attackBonus: 34, critRateBonus: 0.10 } },
      { minUnitLevel: 1, bonus: { attackBonus: 20, critRateBonus: 0.06 } },
    ],
  },
  {
    id: "kagerou-sub-equipment-bonus",
    subUnitId: "kagerou",
    label: "今泉影狼",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { hpBonus: 700, damageReductionBonus: 12 } },
      { minUnitLevel: 4, bonus: { hpBonus: 440, damageReductionBonus: 8 } },
      { minUnitLevel: 1, bonus: { hpBonus: 260, damageReductionBonus: 5 } },
    ],
  },
  {
    id: "tsukasa-sub-equipment-bonus",
    subUnitId: "tsukasa",
    label: "菅牧典",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 46, skillDamageMultiplier: 1.24 } },
      { minUnitLevel: 4, bonus: { attackBonus: 28, skillDamageMultiplier: 1.14 } },
      { minUnitLevel: 1, bonus: { attackBonus: 16, skillDamageMultiplier: 1.08 } },
    ],
  },
  {
    id: "megumu-sub-equipment-bonus",
    subUnitId: "megumu",
    label: "飯綱丸龍",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 68, attackSpeedMultiplier: 1.28 } },
      { minUnitLevel: 4, bonus: { attackBonus: 42, attackSpeedMultiplier: 1.17 } },
      { minUnitLevel: 1, bonus: { attackBonus: 24, attackSpeedMultiplier: 1.10 } },
    ],
  },
  {
    id: "chimata-sub-equipment-bonus",
    subUnitId: "chimata",
    label: "天弓千亦",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 36, skillDamageMultiplier: 1.18 } },
      { minUnitLevel: 4, bonus: { attackBonus: 22, skillDamageMultiplier: 1.10 } },
      { minUnitLevel: 1, bonus: { attackBonus: 12, skillDamageMultiplier: 1.05 } },
    ],
  },
  {
    id: "momoyo-sub-equipment-bonus",
    subUnitId: "momoyo",
    label: "姫虫百々世",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { hpBonus: 580, damageReductionBonus: 10 } },
      { minUnitLevel: 4, bonus: { hpBonus: 360, damageReductionBonus: 7 } },
      { minUnitLevel: 1, bonus: { hpBonus: 220, damageReductionBonus: 4 } },
    ],
  },
  {
    id: "nazrin-sub-equipment-bonus",
    subUnitId: "nazrin",
    label: "ナズーリン",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 30, attackSpeedMultiplier: 1.22 } },
      { minUnitLevel: 4, bonus: { attackBonus: 18, attackSpeedMultiplier: 1.14 } },
      { minUnitLevel: 1, bonus: { attackBonus: 10, attackSpeedMultiplier: 1.08 } },
    ],
  },
  {
    id: "ichirin-sub-equipment-bonus",
    subUnitId: "ichirin",
    label: "雲居一輪＆雲山",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { hpBonus: 680, damageReductionBonus: 12 } },
      { minUnitLevel: 4, bonus: { hpBonus: 420, damageReductionBonus: 8 } },
      { minUnitLevel: 1, bonus: { hpBonus: 260, damageReductionBonus: 5 } },
    ],
  },
  {
    id: "murasa-sub-equipment-bonus",
    subUnitId: "murasa",
    label: "村紗水蜜",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 50, skillDamageMultiplier: 1.25 } },
      { minUnitLevel: 4, bonus: { attackBonus: 30, skillDamageMultiplier: 1.15 } },
      { minUnitLevel: 1, bonus: { attackBonus: 16, skillDamageMultiplier: 1.08 } },
    ],
  },
  {
    id: "shou-sub-equipment-bonus",
    subUnitId: "shou",
    label: "寅丸星",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 66, skillDamageMultiplier: 1.30 } },
      { minUnitLevel: 4, bonus: { attackBonus: 40, skillDamageMultiplier: 1.18 } },
      { minUnitLevel: 1, bonus: { attackBonus: 22, skillDamageMultiplier: 1.10 } },
    ],
  },
  {
    id: "byakuren-sub-equipment-bonus",
    subUnitId: "byakuren",
    label: "聖白蓮",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { hpBonus: 980, attackBonus: 52, damageReductionBonus: 15 } },
      { minUnitLevel: 4, bonus: { hpBonus: 620, attackBonus: 32, damageReductionBonus: 10 } },
      { minUnitLevel: 1, bonus: { hpBonus: 360, attackBonus: 18, damageReductionBonus: 6 } },
    ],
  },
  {
    id: "rin-sub-equipment-bonus",
    subUnitId: "rin",
    label: "火焔猫燐",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { hpBonus: 580, damageReductionBonus: 10 } },
      { minUnitLevel: 4, bonus: { hpBonus: 360, damageReductionBonus: 7 } },
      { minUnitLevel: 1, bonus: { hpBonus: 220, damageReductionBonus: 4 } },
    ],
  },
  {
    id: "satori-sub-equipment-bonus",
    subUnitId: "satori",
    label: "古明地さとり",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 56, skillDamageMultiplier: 1.28 } },
      { minUnitLevel: 4, bonus: { attackBonus: 34, skillDamageMultiplier: 1.17 } },
      { minUnitLevel: 1, bonus: { attackBonus: 18, skillDamageMultiplier: 1.10 } },
    ],
  },
  {
    id: "koishi-sub-equipment-bonus",
    subUnitId: "koishi",
    label: "古明地こいし",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 50, critRateBonus: 0.14 } },
      { minUnitLevel: 4, bonus: { attackBonus: 32, critRateBonus: 0.09 } },
      { minUnitLevel: 1, bonus: { attackBonus: 18, critRateBonus: 0.05 } },
    ],
  },
  {
    id: "utsuho-sub-equipment-bonus",
    subUnitId: "utsuho",
    label: "霊烏路空",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 72, skillDamageMultiplier: 1.30 } },
      { minUnitLevel: 4, bonus: { attackBonus: 44, skillDamageMultiplier: 1.18 } },
      { minUnitLevel: 1, bonus: { attackBonus: 24, skillDamageMultiplier: 1.10 } },
    ],
  },
  {
    id: "clownpiece-sub-equipment-bonus",
    subUnitId: "clownpiece",
    label: "クラウンピース",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 42, attackSpeedMultiplier: 1.28 } },
      { minUnitLevel: 4, bonus: { attackBonus: 26, attackSpeedMultiplier: 1.18 } },
      { minUnitLevel: 1, bonus: { attackBonus: 14, attackSpeedMultiplier: 1.11 } },
    ],
  },
  {
    id: "junko-sub-equipment-bonus",
    subUnitId: "junko",
    label: "純狐",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { hpBonus: 780, attackBonus: 72, damageReductionBonus: 12 } },
      { minUnitLevel: 4, bonus: { hpBonus: 500, attackBonus: 44, damageReductionBonus: 8 } },
      { minUnitLevel: 1, bonus: { hpBonus: 300, attackBonus: 24, damageReductionBonus: 5 } },
    ],
  },
  {
    id: "hecatia-sub-equipment-bonus",
    subUnitId: "hecatia",
    label: "ヘカーティア・ラピスラズリ",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 90, skillDamageMultiplier: 1.36 } },
      { minUnitLevel: 4, bonus: { attackBonus: 56, skillDamageMultiplier: 1.22 } },
      { minUnitLevel: 1, bonus: { attackBonus: 30, skillDamageMultiplier: 1.12 } },
    ],
  },
  {
    id: "yoshika-sub-equipment-bonus",
    subUnitId: "yoshika",
    label: "宮古芳香",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { hpBonus: 640, damageReductionBonus: 12 } },
      { minUnitLevel: 4, bonus: { hpBonus: 400, damageReductionBonus: 8 } },
      { minUnitLevel: 1, bonus: { hpBonus: 240, damageReductionBonus: 5 } },
    ],
  },
  {
    id: "seiga-sub-equipment-bonus",
    subUnitId: "seiga",
    label: "霍青娥",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 62, critRateBonus: 0.16 } },
      { minUnitLevel: 4, bonus: { attackBonus: 38, critRateBonus: 0.10 } },
      { minUnitLevel: 1, bonus: { attackBonus: 20, critRateBonus: 0.06 } },
    ],
  },
  {
    id: "tojiko-sub-equipment-bonus",
    subUnitId: "tojiko",
    label: "蘇我屠自古",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 52, attackSpeedMultiplier: 1.26 } },
      { minUnitLevel: 4, bonus: { attackBonus: 32, attackSpeedMultiplier: 1.17 } },
      { minUnitLevel: 1, bonus: { attackBonus: 18, attackSpeedMultiplier: 1.10 } },
    ],
  },
  {
    id: "futo-sub-equipment-bonus",
    subUnitId: "futo",
    label: "物部布都",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 76, skillDamageMultiplier: 1.32 } },
      { minUnitLevel: 4, bonus: { attackBonus: 46, skillDamageMultiplier: 1.20 } },
      { minUnitLevel: 1, bonus: { attackBonus: 24, skillDamageMultiplier: 1.10 } },
    ],
  },
  {
    id: "miko-sub-equipment-bonus",
    subUnitId: "miko",
    label: "豊聡耳神子",
    levelBreakpoints: [
      { minUnitLevel: 7, bonus: { attackBonus: 96, skillDamageMultiplier: 1.38 } },
      { minUnitLevel: 4, bonus: { attackBonus: 60, skillDamageMultiplier: 1.24 } },
      { minUnitLevel: 1, bonus: { attackBonus: 32, skillDamageMultiplier: 1.12 } },
    ],
  },
];

export function findMainSubPairSkillBindings(subUnitId: string): MainSubPairSkillBinding[] {
  return MAIN_SUB_PAIR_SKILL_BINDINGS.filter((binding) => binding.subUnitId === subUnitId);
}

export function findSubUnitEffectBindings(subUnitId: string, mainUnitId?: string): SubUnitEffectBinding[] {
  return SUB_UNIT_EFFECT_BINDINGS.filter((binding) =>
    binding.subUnitId === subUnitId
    && (!binding.mainUnitId || binding.mainUnitId === mainUnitId)
  );
}

export function resolveMainSubPairSkillLevel(
  binding: MainSubPairSkillBinding,
  subUnitLevel: number,
): 0 | PairSkillLevel {
  if (binding.levelBreakpoints) {
    const normalizedLevel = Number.isFinite(subUnitLevel) ? subUnitLevel : 1;
    return binding.levelBreakpoints.find((breakpoint) =>
      normalizedLevel >= breakpoint.minUnitLevel
    )?.pairSkillLevel ?? 0;
  }

  if (!binding.progressionBonus) {
    return 0;
  }

  return getProgressionMilestoneStage(subUnitLevel, binding.progressionBonus);
}

export function resolveSubUnitEffectLevel(
  binding: SubUnitEffectBinding,
  subUnitLevel: number,
): 1 | 4 | 7 {
  const normalizedLevel = Number.isFinite(subUnitLevel) ? subUnitLevel : 1;
  return binding.levelBreakpoints.find((breakpoint) =>
    normalizedLevel >= breakpoint.minUnitLevel
  )?.effectLevel ?? 1;
}

export function resolveSubUnitEquipmentBonus(
  subUnitId: string,
  subUnitLevel: number,
): { binding: SubUnitEquipmentBonusBinding; bonus: SubUnitEquipmentBonus } | null {
  const binding = SUB_UNIT_EQUIPMENT_BONUS_BINDINGS.find((candidate) => candidate.subUnitId === subUnitId);
  if (!binding) {
    return null;
  }

  const normalizedLevel = Number.isFinite(subUnitLevel) ? subUnitLevel : 1;
  const bonus = binding.levelBreakpoints.find((breakpoint) =>
    normalizedLevel >= breakpoint.minUnitLevel
  )?.bonus;

  return bonus ? { binding, bonus } : null;
}
