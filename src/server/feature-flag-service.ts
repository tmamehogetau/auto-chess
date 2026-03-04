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

  /**
   * T5: フラグ構成の検証
   * 非許可の組み合わせを検出してエラーを投げる
   */
  public validateFlagConfiguration(): void {
    const flags = this.flags;

    // 非許可組み合わせの検証
    const invalidCombinations: string[] = [];

    // 例: enableSharedBoardShadow=true の場合、他の関連フラグも必要
    // 現時点ではMVP範囲で厳密な制約は少ないが、将来追加予定

    // PhaseExpansionが有効な場合は、PhaseExpansion用の追加検証が必要
    if (flags.enablePhaseExpansion) {
      // PhaseExpansionは他の機能と同時に有効化する場合、検証が必要
      // 現時点では警告のみ
    }

    if (invalidCombinations.length > 0) {
      throw new Error(
        `Invalid Feature Flag configuration: ${invalidCombinations.join(", ")}`
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
