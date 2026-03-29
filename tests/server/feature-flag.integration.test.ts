import { Metadata } from "@colyseus/schema";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MatchRoomState, PlayerPresenceState } from "../../src/server/schema/match-room-state";
import { FeatureFlagService } from "../../src/server/feature-flag-service";
import { DEFAULT_FLAGS } from "../../src/shared/feature-flags";
import {
  MVP_FLAGS,
  MIGRATION_FLAGS,
  FLAG_ENV_VARS,
  captureManagedFlagEnv,
  restoreManagedFlagEnv,
} from "./feature-flag-test-helper";

/**
 * Helper to set env vars from flag configuration.
 * Reduces duplication and drift risk in test setup.
 */
function setFlagEnvVars(
  mvpConfig: Partial<Record<string, boolean>> = {},
  migrationConfig: Partial<Record<string, boolean>> = {},
): void {
  // Set MVP flags
  for (const flag of MVP_FLAGS) {
    const value = mvpConfig[flag] ?? false;
    process.env[FLAG_ENV_VARS[flag]] = String(value);
  }
  // Set migration flags
  for (const flag of MIGRATION_FLAGS) {
    const value = migrationConfig[flag] ?? false;
    process.env[FLAG_ENV_VARS[flag]] = String(value);
  }
}

/**
 * Helper to clear all feature flag environment variables.
 */
function clearFlagEnvVars(): void {
  for (const envVarName of Object.values(FLAG_ENV_VARS)) {
    delete process.env[envVarName];
  }
}

describe("Feature Flag Integration", () => {
  let originalEnvVars = captureManagedFlagEnv();

  beforeEach(() => {
    originalEnvVars = captureManagedFlagEnv();
    // Clear all flag env vars for clean state
    clearFlagEnvVars();
    // Reset singleton instance
    FeatureFlagService.resetForTests();
  });

  afterEach(() => {
    restoreManagedFlagEnv(originalEnvVars);
    // Reset singleton instance
    FeatureFlagService.resetForTests();
  });

  describe("FeatureFlagService", () => {
    it("should load default flags when no env vars set", () => {
      const service = FeatureFlagService.getInstance();
      const flags = service.getFlags();

      expect(flags.enableHeroSystem).toBe(true);
      expect(flags.enableSharedPool).toBe(true);
      expect(flags.enablePhaseExpansion).toBe(true);
      expect(flags.enableSubUnitSystem).toBe(false);
      expect(flags.enableBossExclusiveShop).toBe(true);
      expect(flags.enableSpellCard).toBe(true);
      expect(flags.enableTouhouRoster).toBe(true);
      expect(flags.enableTouhouFactions).toBe(true);
    });

    it("should override flags from env vars", () => {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = "true";
      process.env.FEATURE_ENABLE_SHARED_POOL = "1";
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";
      process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "1";

      // Reset singleton instance to pick up new env vars
      FeatureFlagService.resetForTests();
      const service = FeatureFlagService.getInstance();

      const flags = service.getFlags();

      expect(flags.enableHeroSystem).toBe(true);
      expect(flags.enableSharedPool).toBe(true);
      expect(flags.enablePhaseExpansion).toBe(false);
      expect(flags.enableSubUnitSystem).toBe(true);
    });

    it("should handle invalid env var values", () => {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = "invalid";
      process.env.FEATURE_ENABLE_SHARED_POOL = "FALSE";

      // Reset singleton instance to pick up new env vars
      FeatureFlagService.resetForTests();
      const service = FeatureFlagService.getInstance();

      const flags = service.getFlags();

      expect(flags.enableHeroSystem).toBe(false);
      expect(flags.enableSharedPool).toBe(false);
    });

    it("should check feature enabled status", () => {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = "true";
      process.env.FEATURE_ENABLE_SHARED_POOL = "false";
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";
      process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "true";

      // Reset singleton instance to pick up new env vars
      FeatureFlagService.resetForTests();
      const service = FeatureFlagService.getInstance();

      expect(service.isFeatureEnabled("enableHeroSystem")).toBe(true);
      expect(service.isFeatureEnabled("enableSharedPool")).toBe(false);
      expect(service.isFeatureEnabled("enablePhaseExpansion")).toBe(false);
      expect(service.isFeatureEnabled("enableSubUnitSystem")).toBe(true);
    });

    it("should accept all disabled configuration", () => {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = "false";
      process.env.FEATURE_ENABLE_SHARED_POOL = "false";
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";
      process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "false";
      process.env.FEATURE_ENABLE_EMBLEM_CELLS = "false";
      process.env.FEATURE_ENABLE_SPELL_CARD = "false";
      process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "false";
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "false";
      process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = "false";

      FeatureFlagService.resetForTests();
      const service = FeatureFlagService.getInstance();

      expect(() => service.validateFlagConfiguration()).not.toThrow();
    });

    it("should accept the Touhou mainline default bundle", () => {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = "true";
      process.env.FEATURE_ENABLE_SHARED_POOL = "true";
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = "true";
      process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "false";
      process.env.FEATURE_ENABLE_EMBLEM_CELLS = "false";
      process.env.FEATURE_ENABLE_SPELL_CARD = "true";
      process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "false";
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
      process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = "false";
      process.env.FEATURE_ENABLE_TOUHOU_ROSTER = "true";
      process.env.FEATURE_ENABLE_TOUHOU_FACTIONS = "true";
      process.env.FEATURE_ENABLE_PER_UNIT_SHARED_POOL = "false";

      FeatureFlagService.resetForTests();
      const service = FeatureFlagService.getInstance();

      expect(() => service.validateFlagConfiguration()).not.toThrow();
    });

    it("should reject emblem-only configuration without phase expansion", () => {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = "false";
      process.env.FEATURE_ENABLE_SHARED_POOL = "false";
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";
      process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "false";
      process.env.FEATURE_ENABLE_EMBLEM_CELLS = "true";
      process.env.FEATURE_ENABLE_SPELL_CARD = "false";
      process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "false";
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "false";
      process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = "false";

      FeatureFlagService.resetForTests();
      const service = FeatureFlagService.getInstance();

      expect(() => service.validateFlagConfiguration()).toThrow(
        /enableEmblemCells requires enablePhaseExpansion/,
      );
    });

    it("should accept all enabled configuration", () => {
      process.env.FEATURE_ENABLE_HERO_SYSTEM = "true";
      process.env.FEATURE_ENABLE_SHARED_POOL = "true";
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = "true";
      process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "true";
      process.env.FEATURE_ENABLE_EMBLEM_CELLS = "true";
      process.env.FEATURE_ENABLE_SPELL_CARD = "true";
      process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "true";
      process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
      process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = "true";
      // Explicit env values should override the Touhou-mainline defaults.
      process.env.FEATURE_ENABLE_TOUHOU_ROSTER = "false";
      process.env.FEATURE_ENABLE_TOUHOU_FACTIONS = "false";
      process.env.FEATURE_ENABLE_PER_UNIT_SHARED_POOL = "false";

      FeatureFlagService.resetForTests();
      const service = FeatureFlagService.getInstance();

      expect(() => service.validateFlagConfiguration()).not.toThrow();
    });

    describe("Migration flags (enableTouhouRoster, enableTouhouFactions, enablePerUnitSharedPool)", () => {
      it("should have default values for migration flags", () => {
        const flags = DEFAULT_FLAGS;
        expect(flags.enableTouhouRoster).toBe(true);
        expect(flags.enableTouhouFactions).toBe(true);
        expect(flags.enablePerUnitSharedPool).toBe(false);
      });

      it("should load migration flags from env vars", () => {
        process.env.FEATURE_ENABLE_TOUHOU_ROSTER = "true";
        process.env.FEATURE_ENABLE_TOUHOU_FACTIONS = "true";
        process.env.FEATURE_ENABLE_PER_UNIT_SHARED_POOL = "true";

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        const flags = service.getFlags();
        expect(flags.enableTouhouRoster).toBe(true);
        expect(flags.enableTouhouFactions).toBe(true);
        expect(flags.enablePerUnitSharedPool).toBe(true);
      });

      it("should accept false/false/false migration configuration", () => {
        // Use helper to set all flags, reducing duplication
        setFlagEnvVars({}, {
          enableTouhouRoster: false,
          enableTouhouFactions: false,
          enablePerUnitSharedPool: false,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).not.toThrow();
      });

      it("should accept true/false/false migration configuration", () => {
        // Use helper to set all flags, reducing duplication
        setFlagEnvVars({}, {
          enableTouhouRoster: true,
          enableTouhouFactions: false,
          enablePerUnitSharedPool: false,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).not.toThrow();
      });

      it("should accept true/true/false migration configuration", () => {
        // Use helper to set all flags, reducing duplication
        setFlagEnvVars({}, {
          enableTouhouRoster: true,
          enableTouhouFactions: true,
          enablePerUnitSharedPool: false,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).not.toThrow();
      });

      it("should accept true/true/true migration configuration", () => {
        // Use helper to set all flags, reducing duplication
        setFlagEnvVars({}, {
          enableTouhouRoster: true,
          enableTouhouFactions: true,
          enablePerUnitSharedPool: true,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).not.toThrow();
      });

      it("should reject false/true/false migration configuration", () => {
        // Use helper to set all flags, reducing duplication
        setFlagEnvVars({}, {
          enableTouhouRoster: false,
          enableTouhouFactions: true,
          enablePerUnitSharedPool: false,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).toThrow(
          /enableTouhouFactions requires enableTouhouRoster/,
        );
      });

      it("should reject false/false/true migration configuration", () => {
        // Use helper to set all flags, reducing duplication
        setFlagEnvVars({}, {
          enableTouhouRoster: false,
          enableTouhouFactions: false,
          enablePerUnitSharedPool: true,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).toThrow(
          /enablePerUnitSharedPool requires both enableTouhouRoster and enableTouhouFactions/,
        );
      });

      it("should reject true/false/true migration configuration", () => {
        // Use helper to set all flags, reducing duplication
        setFlagEnvVars({}, {
          enableTouhouRoster: true,
          enableTouhouFactions: false,
          enablePerUnitSharedPool: true,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).toThrow(
          /enablePerUnitSharedPool requires both enableTouhouRoster and enableTouhouFactions/,
        );
      });

      it("should reject emblem-only with migration flags active", () => {
        // Use helper to set all flags, reducing duplication
        // Emblem enabled (should fail), other MVP disabled, migration active
        setFlagEnvVars({
          enableEmblemCells: true,
        }, {
          enableTouhouRoster: true,
          enableTouhouFactions: false,
          enablePerUnitSharedPool: false,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).toThrow(
          /enableEmblemCells requires enablePhaseExpansion/,
        );
      });

      it("should accept partial Touhou mainline bundles with migration flags active", () => {
        // Use helper to set all flags, reducing duplication
        // Partial MVP config (hero + shared pool only), migration active
        setFlagEnvVars({
          enableHeroSystem: true,
          enableSharedPool: true,
        }, {
          enableTouhouRoster: true,
          enableTouhouFactions: false,
          enablePerUnitSharedPool: false,
        });

        FeatureFlagService.resetForTests();
        const service = FeatureFlagService.getInstance();

        expect(() => service.validateFlagConfiguration()).not.toThrow();
      });
    });
  });

  describe("MatchRoomState Feature Flags", () => {
    it("should initialize with default feature flags", () => {
      const state = new MatchRoomState();

      expect(state.featureFlagsEnableHeroSystem).toBe(false);
      expect(state.featureFlagsEnableSharedPool).toBe(false);
      expect(state.featureFlagsEnablePhaseExpansion).toBe(false);
      expect(state.featureFlagsEnableSubUnitSystem).toBe(false);
    });

    it("should allow updating feature flags", () => {
      const state = new MatchRoomState();

      state.featureFlagsEnableHeroSystem = true;
      state.featureFlagsEnableSharedPool = true;
      state.featureFlagsEnablePhaseExpansion = true;
      state.featureFlagsEnableSubUnitSystem = true;

      expect(state.featureFlagsEnableHeroSystem).toBe(true);
      expect(state.featureFlagsEnableSharedPool).toBe(true);
      expect(state.featureFlagsEnablePhaseExpansion).toBe(true);
      expect(state.featureFlagsEnableSubUnitSystem).toBe(true);
    });

    it("should register finalRoundShield in PlayerPresenceState schema metadata", () => {
      expect(Metadata.getFields(PlayerPresenceState)).toMatchObject({
        finalRoundShield: "number",
      });
    });
  });

  describe("Feature Flag Branching", () => {
    it("should execute hero system logic when flag is enabled", () => {
      const service = FeatureFlagService.getInstance();

      // Simulate enabling flag
      (service as any).flags.enableHeroSystem = true;

      let heroSystemExecuted = false;

      if (service.isFeatureEnabled("enableHeroSystem")) {
        heroSystemExecuted = true;
      }

      expect(heroSystemExecuted).toBe(true);
    });

    it("should skip hero system logic when flag is disabled", () => {
      const service = FeatureFlagService.getInstance();

      // Simulate disabling flag
      (service as any).flags.enableHeroSystem = false;

      let heroSystemExecuted = false;

      if (service.isFeatureEnabled("enableHeroSystem")) {
        heroSystemExecuted = true;
      }

      expect(heroSystemExecuted).toBe(false);
    });

    it("should execute shared pool logic when flag is enabled", () => {
      const service = FeatureFlagService.getInstance();

      // Simulate enabling flag
      (service as any).flags.enableSharedPool = true;

      let sharedPoolExecuted = false;

      if (service.isFeatureEnabled("enableSharedPool")) {
        sharedPoolExecuted = true;
      }

      expect(sharedPoolExecuted).toBe(true);
    });

    it("should skip shared pool logic when flag is disabled", () => {
      const service = FeatureFlagService.getInstance();

      // Simulate disabling flag
      (service as any).flags.enableSharedPool = false;

      let sharedPoolExecuted = false;

      if (service.isFeatureEnabled("enableSharedPool")) {
        sharedPoolExecuted = true;
      }

      expect(sharedPoolExecuted).toBe(false);
    });

    it("should execute phase expansion logic when flag is enabled", () => {
      const service = FeatureFlagService.getInstance();

      // Simulate enabling flag
      (service as any).flags.enablePhaseExpansion = true;

      let phaseExpansionExecuted = false;

      if (service.isFeatureEnabled("enablePhaseExpansion")) {
        phaseExpansionExecuted = true;
      }

      expect(phaseExpansionExecuted).toBe(true);
    });

    it("should skip phase expansion logic when flag is disabled", () => {
      const service = FeatureFlagService.getInstance();

      // Simulate disabling flag
      (service as any).flags.enablePhaseExpansion = false;

      let phaseExpansionExecuted = false;

      if (service.isFeatureEnabled("enablePhaseExpansion")) {
        phaseExpansionExecuted = true;
      }

      expect(phaseExpansionExecuted).toBe(false);
    });
  });
});
