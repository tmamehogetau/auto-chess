import type { FeatureFlags } from "../../src/shared/feature-flags";
import { FeatureFlagService } from "../../src/server/feature-flag-service";
import { GameRoom } from "../../src/server/rooms/game-room";
import type { ColyseusTestServer } from "@colyseus/testing";

/**
 * Set environment variables for feature flags and execute a test function.
 * After execution, the environment variables and singleton instance are restored.
 *
 * @param flags - Partial feature flags to set (undefined flags are left as-is)
 * @param testFn - Async test function to execute with flags set
 * @returns Promise that resolves when testFn completes
 */
export async function withFlags(
  flags: Partial<FeatureFlags>,
  testFn: () => Promise<void>,
): Promise<void> {
  const originalEnv = { ...process.env };

  try {
    // Set environment variables for specified flags
    if (flags.enableHeroSystem !== undefined) {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = String(flags.enableHeroSystem);
    }
    if (flags.enableSharedPool !== undefined) {
      process.env.FEATURE_ENABLE_SHARED_POOL = String(flags.enableSharedPool);
    }
    if (flags.enablePhaseExpansion !== undefined) {
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = String(
        flags.enablePhaseExpansion,
      );
    }
    if (flags.enableSubUnitSystem !== undefined) {
      process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = String(
        flags.enableSubUnitSystem,
      );
    }
    if (flags.enableEmblemCells !== undefined) {
      process.env.FEATURE_ENABLE_EMBLEM_CELLS = String(flags.enableEmblemCells);
    }
    if (flags.enableSpellCard !== undefined) {
      process.env.FEATURE_ENABLE_SPELL_CARD = String(flags.enableSpellCard);
    }
    if (flags.enableRumorInfluence !== undefined) {
      process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = String(flags.enableRumorInfluence);
    }
    if (flags.enableBossExclusiveShop !== undefined) {
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = String(flags.enableBossExclusiveShop);
    }
    if (flags.enableSharedBoardShadow !== undefined) {
      process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = String(flags.enableSharedBoardShadow);
    }

    // Reset singleton instance to pick up new environment variables
    (FeatureFlagService as any).instance = undefined;

    // Execute test function
    await testFn();
  } finally {
    // Restore original environment variables
    process.env = originalEnv;

    // Reset singleton instance again
    (FeatureFlagService as any).instance = undefined;
  }
}

/**
 * Create a GameRoom instance with specified feature flags set via environment variables.
 * This function temporarily sets environment variables and resets the FeatureFlagService singleton.
 *
 * @param testServer - ColyseusTestServer instance
 * @param flags - Feature flags to set for this room
 * @param roomOptions - Additional options to pass to createRoom
 * @returns Promise resolving to the created GameRoom instance
 */
export async function createRoomWithFlags(
  testServer: ColyseusTestServer,
  flags: FeatureFlags,
  roomOptions?: Record<string, unknown>,
): Promise<GameRoom> {
  const originalEnv = { ...process.env };

  try {
    // Set all environment variables for feature flags
    process.env.FEATURE_ENABLE_HERO_SYSTEM = String(flags.enableHeroSystem);
    process.env.FEATURE_ENABLE_SHARED_POOL = String(flags.enableSharedPool);
    process.env.FEATURE_ENABLE_PHASE_EXPANSION = String(
      flags.enablePhaseExpansion,
    );
    process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = String(flags.enableSubUnitSystem);
    process.env.FEATURE_ENABLE_EMBLEM_CELLS = String(flags.enableEmblemCells);
    process.env.FEATURE_ENABLE_SPELL_CARD = String(flags.enableSpellCard);
    process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = String(flags.enableRumorInfluence);
    process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = String(flags.enableBossExclusiveShop);
    process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = String(flags.enableSharedBoardShadow);

    // Reset singleton instance to pick up new environment variables
    (FeatureFlagService as any).instance = undefined;

    // Create room
    const serverRoom = await testServer.createRoom<GameRoom>("game", roomOptions);

    return serverRoom;
  } finally {
    // Restore original environment variables
    process.env = originalEnv;

    // Reset singleton instance again
    (FeatureFlagService as any).instance = undefined;
  }
}

/**
 * Predefined flag configurations for common test scenarios
 */
export const FLAG_CONFIGURATIONS = {
  /** All feature flags disabled (default behavior) */
  ALL_DISABLED: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** All feature flags enabled (Phase2 behavior) */
  ALL_ENABLED: {
    enableHeroSystem: true,
    enableSharedPool: true,
    enablePhaseExpansion: true,
    enableSubUnitSystem: true,
    enableEmblemCells: true,
    enableSpellCard: true,
    enableRumorInfluence: true,
    enableBossExclusiveShop: true,
    enableSharedBoardShadow: true,
  } satisfies FeatureFlags,

  /** Only hero system enabled */
  HERO_ONLY: {
    enableHeroSystem: true,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** Only shared pool enabled */
  SHARED_POOL_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: true,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** Only phase expansion enabled */
  PHASE_EXPANSION_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: true,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** Only spell card enabled */
  SPELL_CARD_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: true,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** Only rumor influence enabled */
  RUMOR_INFLUENCE_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: true,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** Only boss exclusive shop enabled */
  BOSS_EXCLUSIVE_SHOP_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: true,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** Only sub-unit system enabled */
  SUB_UNIT_SYSTEM_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: true,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
  } satisfies FeatureFlags,

  /** Only shared board shadow enabled */
  SHARED_BOARD_SHADOW_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: true,
  } satisfies FeatureFlags,
} as const;
