import mvpPhase1UnitsData from "../data/mvp_phase1_units.json";

export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type UnitId = string;

export const DEFAULT_MOVEMENT_SPEED = 1;

export interface CombatStats {
  hp: number;
  attack: number;
  attackSpeed: number;
  movementSpeed: number;
  range: number;
  critRate: number;
  critDamageMultiplier: number;
  damageReduction: number;
}

// MVP Phase 1 Unit Skill Types
export type UnitSkillType = 'aoe' | 'buff';

export interface AoeSkill {
  type: 'aoe';
  damageMultiplier: number;
  range: number;
}

export interface BuffSkill {
  type: 'buff';
  target: 'ally' | 'self';
  attackBonus: number;
  duration: number;
}

export type UnitSkill = AoeSkill | BuffSkill;

export type SubUnitMode = "assist";

export interface SubUnitConfig {
  unitId: string;
  mode: SubUnitMode;
  parentUnitId?: string;
  bonusAttackPct?: number;
  bonusHpPct?: number;
}

// MVP Phase 1 Unit Definition
export interface MvpPhase1Unit {
  id: string;
  unitId: UnitId;
  name: string;
  type: BoardUnitType;
  cost: number;
  hp: number;
  attack: number;
  attackSpeed: number;
  movementSpeed: number;
  range: number;
  critRate: number;
  critDamageMultiplier: number;
  damageReduction: number;
  synergy: string[];
  subUnit?: SubUnitConfig;
  skill?: UnitSkill;
}

export interface MvpPhase1Boss {
  id: string;
  name: string;
  hp: number;
  attack: number;
  attackSpeed: number;
  movementSpeed: number;
  range: number;
  critRate: number;
  critDamageMultiplier: number;
  healOnPhaseFail: number;
  damageReduction: number;
}

type MvpPhase1Data = {
  units: Array<
    Omit<MvpPhase1Unit, "movementSpeed" | "critRate" | "critDamageMultiplier">
    & Partial<Pick<MvpPhase1Unit, "movementSpeed" | "critRate" | "critDamageMultiplier">>
  >;
  boss: Omit<MvpPhase1Boss, "movementSpeed" | "critRate" | "critDamageMultiplier">
    & Partial<Pick<MvpPhase1Boss, "movementSpeed" | "critRate" | "critDamageMultiplier">>;
};

const MVP_PHASE1_DATA = mvpPhase1UnitsData as MvpPhase1Data;

function normalizeMvpPhase1Unit(unit: MvpPhase1Data["units"][number]): MvpPhase1Unit {
  return {
    ...unit,
    movementSpeed: unit.movementSpeed ?? DEFAULT_MOVEMENT_SPEED,
    critRate: unit.critRate ?? 0,
    critDamageMultiplier: unit.critDamageMultiplier ?? 1.5,
  };
}

function normalizeMvpPhase1Boss(boss: MvpPhase1Data["boss"]): MvpPhase1Boss {
  return {
    ...boss,
    movementSpeed: boss.movementSpeed ?? DEFAULT_MOVEMENT_SPEED,
    critRate: boss.critRate ?? 0,
    critDamageMultiplier: boss.critDamageMultiplier ?? 1.5,
  };
}

// Load MVP Phase 1 Units from JSON
export async function loadMvpPhase1Units(): Promise<MvpPhase1Unit[]> {
  return MVP_PHASE1_DATA.units.map((unit) => normalizeMvpPhase1Unit(unit));
}

// Load MVP Phase 1 Boss from JSON
export async function loadMvpPhase1Boss(): Promise<MvpPhase1Boss> {
  return normalizeMvpPhase1Boss(MVP_PHASE1_DATA.boss);
}

export function getMvpPhase1Boss(): MvpPhase1Boss {
  return normalizeMvpPhase1Boss(MVP_PHASE1_DATA.boss);
}
