import mvpPhase1UnitsData from "../data/mvp_phase1_units.json";

export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type UnitId = string;

export interface CombatStats {
  hp: number;
  attack: number;
  attackSpeed: number;
  range: number;
  defense: number;
  critRate: number;
  critDamageMultiplier: number;
  physicalReduction: number;
  magicReduction: number;
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
  range: number;
  defense: number;
  critRate: number;
  critDamageMultiplier: number;
  physicalReduction: number;
  magicReduction: number;
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
  defense: number;
  critRate: number;
  critDamageMultiplier: number;
  healOnPhaseFail: number;
  physicalReduction: number;
  magicReduction: number;
}

type MvpPhase1Data = {
  units: Array<
    Omit<MvpPhase1Unit, "defense" | "critRate" | "critDamageMultiplier" | "physicalReduction" | "magicReduction">
    & Partial<Pick<MvpPhase1Unit, "defense" | "critRate" | "critDamageMultiplier" | "physicalReduction" | "magicReduction">>
  >;
  boss: Omit<MvpPhase1Boss, "defense" | "critRate" | "critDamageMultiplier">
    & Partial<Pick<MvpPhase1Boss, "defense" | "critRate" | "critDamageMultiplier">>;
};

const MVP_PHASE1_DATA = mvpPhase1UnitsData as MvpPhase1Data;

function getDefaultDefense(unitType: BoardUnitType): number {
  return unitType === "vanguard" ? 3 : 0;
}

function normalizeMvpPhase1Unit(unit: MvpPhase1Data["units"][number]): MvpPhase1Unit {
  return {
    ...unit,
    defense: unit.defense ?? getDefaultDefense(unit.type),
    critRate: unit.critRate ?? 0,
    critDamageMultiplier: unit.critDamageMultiplier ?? 1.5,
    physicalReduction: unit.physicalReduction ?? 0,
    magicReduction: unit.magicReduction ?? 0,
  };
}

function normalizeMvpPhase1Boss(boss: MvpPhase1Data["boss"]): MvpPhase1Boss {
  return {
    ...boss,
    defense: boss.defense ?? 0,
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
