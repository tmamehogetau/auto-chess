export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type ItemType = 'sword' | 'shield' | 'boots' | 'ring' | 'amulet';

export interface ItemInstance {
  type: ItemType;
  id: string;
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

// MVP Phase 1 Unit Definition
export interface MvpPhase1Unit {
  id: string;
  name: string;
  type: BoardUnitType;
  cost: number;
  hp: number;
  attack: number;
  attackSpeed: number;
  range: number;
  synergy: string[];
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
}

// Load MVP Phase 1 Units from JSON
export async function loadMvpPhase1Units(): Promise<MvpPhase1Unit[]> {
  const data = await import('../data/mvp_phase1_units.json');
  return data.units as MvpPhase1Unit[];
}
