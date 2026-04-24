export type SkillImplementationState = "implemented" | "provisional" | "missing";

export interface LevelBonusDescriptor {
  kind: string;
  summary: string;
  statScore?: number;
  skillScore?: number;
}

export interface UnitProgressionBonusConfig {
  baseGrowthProfile: string;
  level4Bonus: LevelBonusDescriptor | null;
  level7Bonus: LevelBonusDescriptor | null;
  skillImplementationState: SkillImplementationState;
}
