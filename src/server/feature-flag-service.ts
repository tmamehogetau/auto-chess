import type { FeatureFlags } from "../shared/feature-flags";

class FeatureFlagService {
  private static instance: FeatureFlagService;

  private flags: FeatureFlags;

  private constructor() {
    this.flags = this.loadFlags();
  }

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  private loadFlags(): FeatureFlags {
    return {
      enableHeroSystem: this.parseEnvBoolean("FEATURE_ENABLE_HERO_SYSTEM"),
      enableSharedPool: this.parseEnvBoolean("FEATURE_ENABLE_SHARED_POOL"),
      enablePhaseExpansion: this.parseEnvBoolean("FEATURE_ENABLE_PHASE_EXPANSION"),
      enableEmblemCells: this.parseEnvBoolean("FEATURE_ENABLE_EMBLEM_CELLS"),
      enableSpellCard: this.parseEnvBoolean("FEATURE_ENABLE_SPELL_CARD"),
      enableRumorInfluence: this.parseEnvBoolean("FEATURE_ENABLE_RUMOR_INFLUENCE"),
      enableBossExclusiveShop: this.parseEnvBoolean("FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP"),
      enableSharedBoardShadow: this.parseEnvBoolean("FEATURE_ENABLE_SHARED_BOARD_SHADOW"),
    };
  }

  private parseEnvBoolean(envName: string): boolean {
    const value = process.env[envName];
    if (value === undefined) {
      return false;
    }
    return value.toLowerCase() === "true" || value === "1";
  }

  public getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
    return this.flags[featureName] === true;
  }
}

export { FeatureFlagService };
