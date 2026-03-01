export interface FeatureFlags {
  enableHeroSystem: boolean;
  enableSharedPool: boolean;
  enablePhaseExpansion: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  enableHeroSystem: false,
  enableSharedPool: false,
  enablePhaseExpansion: false,
};
