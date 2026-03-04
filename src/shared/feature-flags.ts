export interface FeatureFlags {
  enableHeroSystem: boolean;
  enableSharedPool: boolean;
  enablePhaseExpansion: boolean;
  enableSubUnitSystem: boolean;
  enableEmblemCells: boolean;
  enableSpellCard: boolean;
  enableRumorInfluence: boolean;
  enableBossExclusiveShop: boolean;
  enableSharedBoardShadow: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  enableHeroSystem: false,
  enableSharedPool: false,
  enablePhaseExpansion: false,
  enableSubUnitSystem: false,
  enableEmblemCells: false,
  enableSpellCard: false,
  enableRumorInfluence: false,
  enableBossExclusiveShop: false,
  enableSharedBoardShadow: false,
};
