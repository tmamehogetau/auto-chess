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
  // Migration flags for Touhou roster switch (Phase 2)
  enableTouhouRoster: boolean;
  enableTouhouFactions: boolean;
  enablePerUnitSharedPool: boolean;
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
  // Migration flags for Touhou roster switch (Phase 2)
  enableTouhouRoster: false,
  enableTouhouFactions: false,
  enablePerUnitSharedPool: false,
};
