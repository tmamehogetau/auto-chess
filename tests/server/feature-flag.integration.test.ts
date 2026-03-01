import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MatchRoomState } from "../../src/server/schema/match-room-state";
import { FeatureFlagService } from "../../src/server/feature-flag-service";

describe("Feature Flag Integration", () => {
  describe("FeatureFlagService", () => {
    it("should load default flags when no env vars set", () => {
      const originalEnv = process.env;

      process.env.FEATURE_ENABLE_HERO_SYSTEM = undefined;
      process.env.FEATURE_ENABLE_SHARED_POOL = undefined;
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = undefined;

      // Reset singleton instance
      (FeatureFlagService as any).instance = undefined;
      const service = FeatureFlagService.getInstance();

      const flags = service.getFlags();

      expect(flags.enableHeroSystem).toBe(false);
      expect(flags.enableSharedPool).toBe(false);
      expect(flags.enablePhaseExpansion).toBe(false);

      process.env = originalEnv;
    });

    it("should override flags from env vars", () => {
      const originalEnv = process.env;

      process.env.FEATURE_ENABLE_HERO_SYSTEM = "true";
      process.env.FEATURE_ENABLE_SHARED_POOL = "1";
      process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";

      // Reset singleton instance
      (FeatureFlagService as any).instance = undefined;
      const service = FeatureFlagService.getInstance();

      const flags = service.getFlags();

      expect(flags.enableHeroSystem).toBe(true);
      expect(flags.enableSharedPool).toBe(true);
      expect(flags.enablePhaseExpansion).toBe(false);

      process.env = originalEnv;
    });

    it("should handle invalid env var values", () => {
      const originalEnv = process.env;

      process.env.FEATURE_ENABLE_HERO_SYSTEM = "invalid";
      process.env.FEATURE_ENABLE_SHARED_POOL = "FALSE";

      // Reset singleton instance
      (FeatureFlagService as any).instance = undefined;
      const service = FeatureFlagService.getInstance();

      const flags = service.getFlags();

      expect(flags.enableHeroSystem).toBe(false);
      expect(flags.enableSharedPool).toBe(false);

      process.env = originalEnv;
    });

    it("should check feature enabled status", () => {
      const originalEnv = process.env;

      process.env.FEATURE_ENABLE_HERO_SYSTEM = "true";
      process.env.FEATURE_ENABLE_SHARED_POOL = "false";

      // Reset singleton instance
      (FeatureFlagService as any).instance = undefined;
      const service = FeatureFlagService.getInstance();

      expect(service.isFeatureEnabled("enableHeroSystem")).toBe(true);
      expect(service.isFeatureEnabled("enableSharedPool")).toBe(false);
      expect(service.isFeatureEnabled("enablePhaseExpansion")).toBe(false);

      process.env = originalEnv;
    });
  });

  describe("MatchRoomState Feature Flags", () => {
    it("should initialize with default feature flags", () => {
      const state = new MatchRoomState();

      expect(state.featureFlagsEnableHeroSystem).toBe(false);
      expect(state.featureFlagsEnableSharedPool).toBe(false);
      expect(state.featureFlagsEnablePhaseExpansion).toBe(false);
    });

    it("should allow updating feature flags", () => {
      const state = new MatchRoomState();

      state.featureFlagsEnableHeroSystem = true;
      state.featureFlagsEnableSharedPool = true;
      state.featureFlagsEnablePhaseExpansion = true;

      expect(state.featureFlagsEnableHeroSystem).toBe(true);
      expect(state.featureFlagsEnableSharedPool).toBe(true);
      expect(state.featureFlagsEnablePhaseExpansion).toBe(true);
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
