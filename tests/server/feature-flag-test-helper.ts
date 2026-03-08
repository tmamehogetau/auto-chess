import type { FeatureFlags } from "../../src/shared/feature-flags";
import { FeatureFlagService } from "../../src/server/feature-flag-service";
import { GameRoom } from "../../src/server/rooms/game-room";
import type { ColyseusTestServer } from "@colyseus/testing";

/**
 * Environment variable name mapping for feature flags.
 * Centralized to avoid drift between test helper and integration tests.
 */
export const FLAG_ENV_VARS: Record<keyof FeatureFlags, string> = {
  enableHeroSystem: "FEATURE_ENABLE_HERO_SYSTEM",
  enableSharedPool: "FEATURE_ENABLE_SHARED_POOL",
  enablePhaseExpansion: "FEATURE_ENABLE_PHASE_EXPANSION",
  enableSubUnitSystem: "FEATURE_ENABLE_SUB_UNIT_SYSTEM",
  enableEmblemCells: "FEATURE_ENABLE_EMBLEM_CELLS",
  enableSpellCard: "FEATURE_ENABLE_SPELL_CARD",
  enableRumorInfluence: "FEATURE_ENABLE_RUMOR_INFLUENCE",
  enableBossExclusiveShop: "FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP",
  enableSharedBoardShadow: "FEATURE_ENABLE_SHARED_BOARD_SHADOW",
  enableTouhouRoster: "FEATURE_ENABLE_TOUHOU_ROSTER",
  enableTouhouFactions: "FEATURE_ENABLE_TOUHOU_FACTIONS",
  enablePerUnitSharedPool: "FEATURE_ENABLE_PER_UNIT_SHARED_POOL",
};

/**
 * Migration flags subset for validation and testing.
 */
export const MIGRATION_FLAGS: (keyof FeatureFlags)[] = [
  "enableTouhouRoster",
  "enableTouhouFactions",
  "enablePerUnitSharedPool",
];

/**
 * MVP-era flags subset (excludes migration flags).
 */
export const MVP_FLAGS: (keyof FeatureFlags)[] = [
  "enableHeroSystem",
  "enableSharedPool",
  "enablePhaseExpansion",
  "enableSubUnitSystem",
  "enableEmblemCells",
  "enableSpellCard",
  "enableRumorInfluence",
  "enableBossExclusiveShop",
  "enableSharedBoardShadow",
];

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
    // Set environment variables for specified flags using centralized mapping
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      const value = flags[flagName as keyof FeatureFlags];
      if (value !== undefined) {
        process.env[envVarName] = String(value);
      }
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
    // Set all environment variables for feature flags using centralized mapping
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      process.env[envVarName] = String(flags[flagName as keyof FeatureFlags]);
    }

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
 * Set FeatureFlagService flags directly by manipulating the private 'flags' field.
 * This bypasses validation and is intended for controlled test fixtures only.
 * Automatically resets the singleton after use to prevent flag leakage.
 *
 * @param flags - Partial flags to override
 * @param testFn - Test function to execute with forced flags
 */
export async function withForcedFlags(
  flags: Partial<FeatureFlags>,
  testFn: () => Promise<void>,
): Promise<void> {
  const service = FeatureFlagService.getInstance();
  const originalFlags = service.getFlags();

  try {
    // Directly set private flags field (bypasses validation)
    (service as any).flags = { ...originalFlags, ...flags };

    await testFn();
  } finally {
    // Restore original flags
    (service as any).flags = originalFlags;
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
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
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
  } satisfies FeatureFlags,

  /** Migration: Touhou roster only (true/false/false) */
  TOUHOU_ROSTER_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
    enableTouhouRoster: true,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
  } satisfies FeatureFlags,

  /** Migration: Touhou roster + factions (true/true/false) */
  TOUHOU_ROSTER_WITH_FACTIONS: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
    enableTouhouRoster: true,
    enableTouhouFactions: true,
    enablePerUnitSharedPool: false,
  } satisfies FeatureFlags,

  /** Migration: Touhou roster + factions + per-unit pool (true/true/true) */
  TOUHOU_FULL_MIGRATION: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
    enableTouhouRoster: true,
    enableTouhouFactions: true,
    enablePerUnitSharedPool: true,
  } satisfies FeatureFlags,
} as const;
