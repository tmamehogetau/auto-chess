export interface FeatureFlags {
  enableHeroSystem: boolean;
  enableSharedPool: boolean;
  enablePhaseExpansion: boolean;
  enableEmblemCells: boolean;
  enableSpellCard: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  enableHeroSystem: false,
  enableSharedPool: false,
  enablePhaseExpansion: false,
  enableEmblemCells: false,
  enableSpellCard: false,
};
