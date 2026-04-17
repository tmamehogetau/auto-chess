import { DEFAULT_FLAGS, type FeatureFlags } from "../shared/feature-flags";

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

  public static resetForTests(): void {
    FeatureFlagService.instance = undefined as unknown as FeatureFlagService;
  }

  private loadFlags(): FeatureFlags {
    return {
      enableHeroSystem: this.parseEnvBoolean("FEATURE_ENABLE_HERO_SYSTEM", DEFAULT_FLAGS.enableHeroSystem),
      enableSharedPool: this.parseEnvBoolean("FEATURE_ENABLE_SHARED_POOL", DEFAULT_FLAGS.enableSharedPool),
      enablePhaseExpansion: this.parseEnvBoolean("FEATURE_ENABLE_PHASE_EXPANSION", DEFAULT_FLAGS.enablePhaseExpansion),
      enableDominationSystem: this.parseEnvBoolean("FEATURE_ENABLE_DOMINATION_SYSTEM", DEFAULT_FLAGS.enableDominationSystem),
      enableSubUnitSystem: this.parseEnvBoolean("FEATURE_ENABLE_SUB_UNIT_SYSTEM", DEFAULT_FLAGS.enableSubUnitSystem),
      enableEmblemCells: this.parseEnvBoolean("FEATURE_ENABLE_EMBLEM_CELLS", DEFAULT_FLAGS.enableEmblemCells),
      enableSpellCard: this.parseEnvBoolean("FEATURE_ENABLE_SPELL_CARD", DEFAULT_FLAGS.enableSpellCard),
      enableRumorInfluence: this.parseEnvBoolean("FEATURE_ENABLE_RUMOR_INFLUENCE", DEFAULT_FLAGS.enableRumorInfluence),
      enableBossExclusiveShop: this.parseEnvBoolean("FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP", DEFAULT_FLAGS.enableBossExclusiveShop),
      enableSharedBoardShadow: this.parseEnvBoolean("FEATURE_ENABLE_SHARED_BOARD_SHADOW", DEFAULT_FLAGS.enableSharedBoardShadow),
      enableTouhouRoster: this.parseEnvBoolean("FEATURE_ENABLE_TOUHOU_ROSTER", DEFAULT_FLAGS.enableTouhouRoster),
      enableTouhouFactions: this.parseEnvBoolean("FEATURE_ENABLE_TOUHOU_FACTIONS", DEFAULT_FLAGS.enableTouhouFactions),
      enablePerUnitSharedPool: this.parseEnvBoolean("FEATURE_ENABLE_PER_UNIT_SHARED_POOL", DEFAULT_FLAGS.enablePerUnitSharedPool),
    };
  }

  private parseEnvBoolean(envName: string, defaultValue: boolean): boolean {
    const value = process.env[envName];
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === "true" || value === "1";
  }

  public getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
    return this.flags[featureName] === true;
  }

  /**
   * T5: フラグ構成の検証
   * 非許可の組み合わせを検出してエラーを投げる
   */
  public validateFlagConfiguration(): void {
    const flags = this.flags;

    // Migration flag validation (Phase 2: Touhou roster switch)
    // Dependency rules: factions => roster, perUnitSharedPool => factions && roster
    if (flags.enableTouhouFactions && !flags.enableTouhouRoster) {
      throw new Error(
        "Invalid Feature Flag configuration: enableTouhouFactions requires enableTouhouRoster",
      );
    }
    if (flags.enablePerUnitSharedPool && (!flags.enableTouhouRoster || !flags.enableTouhouFactions)) {
      throw new Error(
        "Invalid Feature Flag configuration: enablePerUnitSharedPool requires both enableTouhouRoster and enableTouhouFactions",
      );
    }

    if (flags.enableEmblemCells && !flags.enablePhaseExpansion) {
      throw new Error(
        "Invalid Feature Flag configuration: enableEmblemCells requires enablePhaseExpansion",
      );
    }

    if (process.env.SUPPRESS_VERBOSE_TEST_LOGS !== "true") {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({
        type: "feature_flag_config",
        flags: { ...flags },
        timestamp: Date.now(),
      }));
    }
  }
}

export { FeatureFlagService };
