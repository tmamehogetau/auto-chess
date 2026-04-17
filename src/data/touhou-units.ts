import { DEFAULT_MOVEMENT_SPEED, type BoardUnitType, type CombatStats, type UnitId } from "../shared/types";

const DEFAULT_MELEE_MOVEMENT_SPEED = DEFAULT_MOVEMENT_SPEED * 2;

export type TouhouFactionId =
  | "chireiden"
  | "myourenji"
  | "shinreibyou"
  | "grassroot_network"
  | "kou_ryuudou"
  | "kanjuden";

export interface TouhouUnit extends CombatStats {
  unitId: UnitId;
  displayName: string;
  unitType: BoardUnitType;
  cost: 1 | 2 | 3 | 4 | 5;
  factionId: TouhouFactionId | null;
  skillRef?: string;
}

export const TOUHOU_UNITS: readonly TouhouUnit[] = [
  { unitId: "rin", displayName: "火焔猫燐", unitType: "vanguard", cost: 1, hp: 620, attack: 40, attackSpeed: 0.85, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 5, factionId: "chireiden" },
  { unitId: "satori", displayName: "古明地さとり", unitType: "mage", cost: 3, hp: 820, attack: 70, attackSpeed: 0.9, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "chireiden" },
  { unitId: "koishi", displayName: "古明地こいし", unitType: "assassin", cost: 2, hp: 580, attack: 68, attackSpeed: 1.05, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "chireiden" },
  { unitId: "utsuho", displayName: "霊烏路空", unitType: "mage", cost: 4, hp: 960, attack: 108, attackSpeed: 0.8, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 4, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "chireiden" },

  { unitId: "nazrin", displayName: "ナズーリン", unitType: "ranger", cost: 1, hp: 450, attack: 41, attackSpeed: 0.95, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 4, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "myourenji" },
  { unitId: "ichirin", displayName: "雲居一輪＆雲山", unitType: "vanguard", cost: 2, hp: 820, attack: 50, attackSpeed: 0.9, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 5, factionId: "myourenji" },
  { unitId: "murasa", displayName: "村紗水蜜", unitType: "mage", cost: 3, hp: 820, attack: 66, attackSpeed: 0.95, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "myourenji" },
  { unitId: "shou", displayName: "寅丸星", unitType: "mage", cost: 4, hp: 1010, attack: 81, attackSpeed: 0.95, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "myourenji" },
  { unitId: "byakuren", displayName: "聖白蓮", unitType: "vanguard", cost: 5, hp: 1450, attack: 116, attackSpeed: 0.95, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 5, factionId: "myourenji" },

  { unitId: "yoshika", displayName: "宮古芳香", unitType: "vanguard", cost: 1, hp: 550, attack: 43, attackSpeed: 0.9, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 5, factionId: "shinreibyou" },
  { unitId: "seiga", displayName: "霍青娥", unitType: "assassin", cost: 3, hp: 650, attack: 80, attackSpeed: 1.05, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "shinreibyou" },
  { unitId: "tojiko", displayName: "蘇我屠自古", unitType: "ranger", cost: 2, hp: 540, attack: 64, attackSpeed: 1.05, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 4, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "shinreibyou" },
  { unitId: "futo", displayName: "物部布都", unitType: "mage", cost: 4, hp: 900, attack: 90, attackSpeed: 0.95, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "shinreibyou" },
  { unitId: "miko", displayName: "豊聡耳神子", unitType: "mage", cost: 5, hp: 1060, attack: 108, attackSpeed: 0.95, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "shinreibyou" },

  { unitId: "wakasagihime", displayName: "わかさぎ姫", unitType: "ranger", cost: 1, hp: 390, attack: 45, attackSpeed: 1.0, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 4, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "grassroot_network" },
  { unitId: "sekibanki", displayName: "赤蛮奇", unitType: "assassin", cost: 2, hp: 520, attack: 64, attackSpeed: 1.1, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "grassroot_network" },
  { unitId: "kagerou", displayName: "今泉影狼", unitType: "vanguard", cost: 2, hp: 740, attack: 56, attackSpeed: 0.95, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 5, factionId: "grassroot_network" },

  { unitId: "tsukasa", displayName: "菅牧典", unitType: "mage", cost: 2, hp: 580, attack: 55, attackSpeed: 0.95, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 4, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "kou_ryuudou" },
  { unitId: "megumu", displayName: "飯綱丸龍", unitType: "ranger", cost: 3, hp: 680, attack: 76, attackSpeed: 1.05, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 4, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "kou_ryuudou" },
  { unitId: "chimata", displayName: "天弓千亦", unitType: "mage", cost: 4, hp: 900, attack: 84, attackSpeed: 0.95, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "kou_ryuudou" },
  { unitId: "momoyo", displayName: "姫虫百々世", unitType: "vanguard", cost: 2, hp: 740, attack: 54, attackSpeed: 0.9, movementSpeed: DEFAULT_MELEE_MOVEMENT_SPEED, range: 1, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 5, factionId: "kou_ryuudou" },

  { unitId: "clownpiece", displayName: "クラウンピース", unitType: "ranger", cost: 2, hp: 580, attack: 53, attackSpeed: 1.1, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 4, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "kanjuden" },
  { unitId: "junko", displayName: "純狐", unitType: "vanguard", cost: 4, hp: 1120, attack: 92, attackSpeed: 0.85, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 5, factionId: "kanjuden" },
  { unitId: "hecatia", displayName: "ヘカーティア・ラピスラズリ", unitType: "mage", cost: 5, hp: 1120, attack: 112, attackSpeed: 0.9, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: "kanjuden" },

  { unitId: "zanmu", displayName: "日白残無", unitType: "mage", cost: 5, hp: 1180, attack: 118, attackSpeed: 0.85, movementSpeed: DEFAULT_MOVEMENT_SPEED, range: 3, critRate: 0, critDamageMultiplier: 1.5, damageReduction: 0, factionId: null },
] as const;

export function getTouhouUnitById(unitId: UnitId): TouhouUnit | null {
  return TOUHOU_UNITS.find((unit) => unit.unitId === unitId) ?? null;
}

export function getTouhouUnitsByCost(cost: TouhouUnit["cost"]): TouhouUnit[] {
  return TOUHOU_UNITS.filter((unit) => unit.cost === cost);
}

export function getTouhouUnitsByFaction(factionId: TouhouFactionId): TouhouUnit[] {
  return TOUHOU_UNITS.filter((unit) => unit.factionId === factionId);
}
