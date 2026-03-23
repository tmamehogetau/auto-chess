import mvpPhase1UnitsData from "../data/mvp_phase1_units.json";

export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type UnitId = string;

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
  range: number;
  synergy: string[];
  subUnit?: SubUnitConfig;
  skill?: UnitSkill;
}

// MVP Phase 1 Boss Definition
export interface MvpPhase1Boss {
  id: string;
  name: string;
  hp: number;
  attack: number;
  attackSpeed: number;
  range: number;
  healOnPhaseFail: number;
  physicalReduction: number;
  magicReduction: number;
}

type MvpPhase1Data = {
  units: MvpPhase1Unit[];
  boss: MvpPhase1Boss;
};

const MVP_PHASE1_DATA = mvpPhase1UnitsData as MvpPhase1Data;

// Load MVP Phase 1 Units from JSON
export async function loadMvpPhase1Units(): Promise<MvpPhase1Unit[]> {
  return MVP_PHASE1_DATA.units;
}

// Load MVP Phase 1 Boss from JSON
export async function loadMvpPhase1Boss(): Promise<MvpPhase1Boss> {
  return MVP_PHASE1_DATA.boss;
}

export function getMvpPhase1Boss(): MvpPhase1Boss {
  return MVP_PHASE1_DATA.boss;
}
