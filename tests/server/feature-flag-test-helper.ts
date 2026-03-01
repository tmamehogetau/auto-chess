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
    enableEmblemCells: false,
  } satisfies FeatureFlags,

  /** All feature flags enabled (Phase2 behavior) */
  ALL_ENABLED: {
    enableHeroSystem: true,
    enableSharedPool: true,
    enablePhaseExpansion: true,
    enableEmblemCells: true,
  } satisfies FeatureFlags,

  /** Only hero system enabled */
  HERO_ONLY: {
    enableHeroSystem: true,
    enableSharedPool: false,
    enablePhaseExpansion: false,
    enableEmblemCells: false,
  } satisfies FeatureFlags,

  /** Only shared pool enabled */
  SHARED_POOL_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: true,
    enablePhaseExpansion: false,
    enableEmblemCells: false,
  } satisfies FeatureFlags,

  /** Only phase expansion enabled */
  PHASE_EXPANSION_ONLY: {
    enableHeroSystem: false,
    enableSharedPool: false,
    enablePhaseExpansion: true,
    enableEmblemCells: false,
  } satisfies FeatureFlags,
} as const;
