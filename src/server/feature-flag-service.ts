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
      enableSubUnitSystem: this.parseEnvBoolean("FEATURE_ENABLE_SUB_UNIT_SYSTEM"),
      enableEmblemCells: this.parseEnvBoolean("FEATURE_ENABLE_EMBLEM_CELLS"),
      enableSpellCard: this.parseEnvBoolean("FEATURE_ENABLE_SPELL_CARD"),
      enableRumorInfluence: this.parseEnvBoolean("FEATURE_ENABLE_RUMOR_INFLUENCE"),
      enableBossExclusiveShop: this.parseEnvBoolean("FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP"),
      enableSharedBoardShadow: this.parseEnvBoolean("FEATURE_ENABLE_SHARED_BOARD_SHADOW"),
      // Migration flags for Touhou roster switch (Phase 2)
      enableTouhouRoster: this.parseEnvBoolean("FEATURE_ENABLE_TOUHOU_ROSTER"),
      enableTouhouFactions: this.parseEnvBoolean("FEATURE_ENABLE_TOUHOU_FACTIONS"),
      enablePerUnitSharedPool: this.parseEnvBoolean("FEATURE_ENABLE_PER_UNIT_SHARED_POOL"),
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

    // Separate MVP flags from migration flags for validation
    const mvpFlags = {
      enableHeroSystem: flags.enableHeroSystem,
      enableSharedPool: flags.enableSharedPool,
      enablePhaseExpansion: flags.enablePhaseExpansion,
      enableSubUnitSystem: flags.enableSubUnitSystem,
      enableEmblemCells: flags.enableEmblemCells,
      enableSpellCard: flags.enableSpellCard,
      enableRumorInfluence: flags.enableRumorInfluence,
      enableBossExclusiveShop: flags.enableBossExclusiveShop,
      enableSharedBoardShadow: flags.enableSharedBoardShadow,
    };

    const enabledMvpFeatures = Object.entries(mvpFlags)
      .filter(([, enabled]) => enabled)
      .map(([featureName]) => featureName);
    const enabledMvpCount = enabledMvpFeatures.length;
    const totalMvpFeatureCount = Object.keys(mvpFlags).length;
    const isMvpAllDisabled = enabledMvpCount === 0;
    const isMvpAllEnabled = enabledMvpCount === totalMvpFeatureCount;
    const isMvpSingleFeatureMode = enabledMvpCount === 1;

    // 非許可組み合わせの検証
    const invalidCombinations: string[] = [];

    // MVP運用では「ALL_DISABLED / ALL_ENABLED / 単機能ON」のみ許可する
    if (!isMvpAllDisabled && !isMvpAllEnabled && !isMvpSingleFeatureMode) {
      invalidCombinations.push(
        "MVP mode allows only ALL_DISABLED, ALL_ENABLED, or single-feature configuration",
      );
    }

    // エンブレムセルは未実装領域が残るため、MVPでは ALL_ENABLED のみ許可
    if (flags.enableEmblemCells && !isMvpAllEnabled) {
      invalidCombinations.push(
        "enableEmblemCells is only allowed in ALL_ENABLED configuration",
      );
    }

    if (invalidCombinations.length > 0) {
      const enabledFeatures = Object.entries(flags)
        .filter(([, enabled]) => enabled)
        .map(([featureName]) => featureName);
      throw new Error(
        `Invalid Feature Flag configuration: ${invalidCombinations.join("; ")} (enabled: ${enabledFeatures.join(",") || "none"})`,
      );
    }

    // 許可構成のログ出力（T3の observability と連携）
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      type: "feature_flag_config",
      flags: { ...flags },
      timestamp: Date.now(),
    }));
  }
}

export { FeatureFlagService };
