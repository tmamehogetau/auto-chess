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
  enableHeroSystem: true,
  enableSharedPool: false,
  enablePhaseExpansion: true,
  enableSubUnitSystem: true,
  enableEmblemCells: false,
  enableSpellCard: true,
  enableRumorInfluence: false,
  enableBossExclusiveShop: true,
  enableSharedBoardShadow: false,
  // Touhou roster is now the primary product baseline.
  enableTouhouRoster: true,
  enableTouhouFactions: true,
  enablePerUnitSharedPool: false,
};
