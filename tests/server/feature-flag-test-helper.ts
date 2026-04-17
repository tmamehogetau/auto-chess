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
  enableDominationSystem: "FEATURE_ENABLE_DOMINATION_SYSTEM",
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
  "enableDominationSystem",
  "enableSubUnitSystem",
  "enableEmblemCells",
  "enableSpellCard",
  "enableRumorInfluence",
  "enableBossExclusiveShop",
  "enableSharedBoardShadow",
];

export type ManagedFlagEnvSnapshot = Partial<Record<keyof typeof FLAG_ENV_VARS, string | undefined>>;

export function captureManagedFlagEnv(): ManagedFlagEnvSnapshot {
  const snapshot: ManagedFlagEnvSnapshot = {};

  for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
    snapshot[flagName as keyof typeof FLAG_ENV_VARS] = process.env[envVarName];
  }

  return snapshot;
}

export function restoreManagedFlagEnv(snapshot: ManagedFlagEnvSnapshot): void {
  for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
    const originalValue = snapshot[flagName as keyof typeof FLAG_ENV_VARS];
    if (originalValue === undefined) {
      delete process.env[envVarName];
    } else {
      process.env[envVarName] = originalValue;
    }
  }
}

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
  const originalEnv = captureManagedFlagEnv();

  try {
    // Set environment variables for specified flags using centralized mapping
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      const value = flags[flagName as keyof FeatureFlags];
      if (value !== undefined) {
        process.env[envVarName] = String(value);
      }
    }

    // Reset singleton instance to pick up new environment variables
    FeatureFlagService.resetForTests();

    // Execute test function
    await testFn();
  } finally {
    // Restore original environment variables
    restoreManagedFlagEnv(originalEnv);

    // Reset singleton instance again
    FeatureFlagService.resetForTests();
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
  const originalEnv = captureManagedFlagEnv();

  try {
    // Set all environment variables for feature flags using centralized mapping
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      process.env[envVarName] = String(flags[flagName as keyof FeatureFlags]);
    }

    // Reset singleton instance to pick up new environment variables
    FeatureFlagService.resetForTests();

    // Create room
    const serverRoom = await testServer.createRoom<GameRoom>("game", roomOptions);

    return serverRoom;
  } finally {
    // Restore original environment variables
    restoreManagedFlagEnv(originalEnv);

    // Reset singleton instance again
    FeatureFlagService.resetForTests();
  }
}

/**
 * Store the original getInstance method for restoration after tests.
 * Used by createRoomWithForcedFlags to allow flag assertions in test body.
 */
let originalGetInstance: (() => FeatureFlagService) | undefined;

/**
 * Store the original environment variables for restoration after tests.
 * Used by createRoomWithForcedFlags to prevent env leakage.
 */
let originalEnv: ManagedFlagEnvSnapshot | undefined;

/**
 * Create a mock FeatureFlagService that returns forced flags.
 * Does not rely on private internals - uses public interface only.
 */
function createMockFeatureFlagService(forcedFlags: FeatureFlags): FeatureFlagService {
  return {
    getFlags: () => ({ ...forcedFlags }),
    isFeatureEnabled: (featureName: keyof FeatureFlags) => forcedFlags[featureName] === true,
    validateFlagConfiguration: () => {
      // No-op: skip validation to allow invalid flag combinations for testing
    },
  } as FeatureFlagService;
}

function applyKnownRoomOptions(
  room: GameRoom,
  roomOptions?: Record<string, unknown>,
): void {
  if (!roomOptions) {
    return;
  }

  const mutableRoom = room as unknown as {
    readyAutoStartMs?: number;
    prepDurationMs?: number;
    battleDurationMs?: number;
    settleDurationMs?: number;
    eliminationDurationMs?: number;
    selectionTimeoutMs?: number;
    sharedBoardRoomId?: string;
  };

  const numericOptionKeys = [
    "readyAutoStartMs",
    "prepDurationMs",
    "battleDurationMs",
    "settleDurationMs",
    "eliminationDurationMs",
    "selectionTimeoutMs",
  ] as const;

  for (const optionKey of numericOptionKeys) {
    const optionValue = roomOptions[optionKey];
    if (typeof optionValue === "number") {
      mutableRoom[optionKey] = optionValue;
    }
  }

  const sharedBoardRoomId = roomOptions.sharedBoardRoomId;
  if (typeof sharedBoardRoomId === "string") {
    mutableRoom.sharedBoardRoomId = sharedBoardRoomId;
  }
}

/**
 * Create a GameRoom with forced feature flags, bypassing validation.
 * This helper ensures room state and controllers see the same flag snapshot.
 * 
 * Strategy: Spy/mock FeatureFlagService.getInstance to return a mock service
 * with forced flags. This avoids touching private internals.
 *
 * @param testServer - ColyseusTestServer instance
 * @param forcedFlags - Flags to force (validation bypassed)
 * @param roomOptions - Additional room options
 * @returns Created GameRoom
 */
export async function createRoomWithForcedFlags(
  testServer: ColyseusTestServer,
  forcedFlags: Partial<FeatureFlags>,
  roomOptions?: Record<string, unknown>,
): Promise<GameRoom> {
  // Store original getInstance (if not already stored)
  if (!originalGetInstance) {
    originalGetInstance = FeatureFlagService.getInstance.bind(FeatureFlagService);
  }

  // Store original env (if not already stored)
  if (!originalEnv) {
    originalEnv = captureManagedFlagEnv();
  }

  // Set ALL env vars to false first (clean slate)
  for (const envVarName of Object.values(FLAG_ENV_VARS)) {
    process.env[envVarName] = "false";
  }

  // Create base flags (all disabled)
  const baseFlags: FeatureFlags = {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableDominationSystem: false,
    enableSubUnitSystem: false,
    enableEmblemCells: false,
    enableSpellCard: false,
    enableRumorInfluence: false,
    enableBossExclusiveShop: false,
    enableSharedBoardShadow: false,
    enableTouhouRoster: false,
    enableTouhouFactions: false,
    enablePerUnitSharedPool: false,
  };

  // Merge forced flags
  const mergedFlags = { ...baseFlags, ...forcedFlags };

  // Mock getInstance to return our mock service
  FeatureFlagService.getInstance = () => createMockFeatureFlagService(mergedFlags);

  // Create room - it will use our mock service
  const room = await testServer.createRoom<GameRoom>("game", {
    ...roomOptions,
    forcedFeatureFlags: mergedFlags,
  });
  applyKnownRoomOptions(room, roomOptions);
  
  return room;
}

/**
 * Restore the original FeatureFlagService.getInstance and environment variables after tests.
 * Call this in afterEach to prevent flag/env leakage between tests.
 */
export function restoreForcedFlagFixtures(): void {
  // Restore original getInstance
  if (originalGetInstance) {
    FeatureFlagService.getInstance = originalGetInstance;
    originalGetInstance = undefined;
  }

  // Restore original environment variables
  if (originalEnv) {
    restoreManagedFlagEnv(originalEnv);
    originalEnv = undefined;
  }

  FeatureFlagService.resetForTests();
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
    enableDominationSystem: false,
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
    enableDominationSystem: true,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
    enableDominationSystem: false,
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
