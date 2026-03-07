import { describe, it, expect } from "vitest";
import {
  getActiveRosterUnits,
  getActiveRosterKind,
  ROSTER_KIND_MVP,
  ROSTER_KIND_TOUHOU,
  TouhouRosterNotConfiguredError,
  type RosterUnit,
} from "../../../src/server/roster/roster-provider";
import type { FeatureFlags } from "../../../src/shared/feature-flags";
import mvpPhase1UnitsData from "../../../src/data/mvp_phase1_units.json";

/**
 * Test helper: Create FeatureFlags with defaults + overrides.
 * Reduces repetitive full FeatureFlags object literals.
 */
function createFeatureFlags(
  overrides: Partial<FeatureFlags> = {},
): FeatureFlags {
  return {
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
    ...overrides,
  };
}

describe("roster-provider", () => {
  describe("getActiveRosterKind", () => {
    it("should return MVP roster kind when enableTouhouRoster is false", () => {
      const flags = createFeatureFlags({ enableTouhouRoster: false });

      const result = getActiveRosterKind(flags);
      expect(result).toBe(ROSTER_KIND_MVP);
    });

    it("should return Touhou roster kind when enableTouhouRoster is true", () => {
      const flags = createFeatureFlags({ enableTouhouRoster: true });

      const result = getActiveRosterKind(flags);
      expect(result).toBe(ROSTER_KIND_TOUHOU);
    });
  });

  describe("getActiveRosterUnits", () => {
    it("should return MVP roster units from existing production data source when enableTouhouRoster is false", () => {
      const flags = createFeatureFlags({ enableTouhouRoster: false });

      const units = getActiveRosterUnits(flags);

      // Should return MVP Phase 1 units from the production JSON source
      expect(units).toBeDefined();
      expect(Array.isArray(units)).toBe(true);
      expect(units.length).toBe(mvpPhase1UnitsData.units.length);

      // Verify the provider returns the actual production data (not hardcoded duplicates)
      const expectedUnitIds = mvpPhase1UnitsData.units.map((u) => u.unitId);
      const actualUnitIds = units.map((u) => u.unitId);
      expect(actualUnitIds).toEqual(expectedUnitIds);

      // Verify specific MVP units exist (sanity check)
      expect(actualUnitIds).toContain("warrior_a");
      expect(actualUnitIds).toContain("dragon");
    });

    it("should throw explicit error when enableTouhouRoster is true", () => {
      const flags = createFeatureFlags({
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      });

      expect(() => getActiveRosterUnits(flags)).toThrow(
        TouhouRosterNotConfiguredError
      );
      expect(() => getActiveRosterUnits(flags)).toThrow(
        /Touhou roster data is not configured yet/
      );
    });

    it("should expose roster unit definitions with required fields from production source", () => {
      const flags = createFeatureFlags();

      const units = getActiveRosterUnits(flags);
      expect(units.length).toBeGreaterThan(0);

      const firstUnit = units[0]!;

      // Verify the roster unit shape matches production data using RosterUnit interface
      expect(firstUnit).toHaveProperty("id");
      expect(firstUnit).toHaveProperty("unitId");
      expect(firstUnit).toHaveProperty("name");
      expect(firstUnit).toHaveProperty("type");
      expect(firstUnit).toHaveProperty("cost");
      expect(firstUnit).toHaveProperty("hp");
      expect(firstUnit).toHaveProperty("attack");
      expect(firstUnit).toHaveProperty("attackSpeed");
      expect(firstUnit).toHaveProperty("range");
      expect(firstUnit).toHaveProperty("synergy");

      // Verify the data matches the production source
      const expectedFirstUnit = mvpPhase1UnitsData.units[0]!;
      expect(firstUnit.unitId).toBe(expectedFirstUnit.unitId);
      expect(firstUnit.name).toBe(expectedFirstUnit.name);
    });

    it("should return units matching RosterUnit interface (future-proof contract)", () => {
      const flags = createFeatureFlags();

      const units = getActiveRosterUnits(flags);

      // Verify all units conform to the generic RosterUnit interface
      // This ensures the API is not MVP-specific and works for future roster sources
      units.forEach((unit: RosterUnit) => {
        expect(typeof unit.id).toBe("string");
        expect(typeof unit.unitId).toBe("string");
        expect(typeof unit.name).toBe("string");
        expect(["vanguard", "ranger", "mage", "assassin"]).toContain(
          unit.type
        );
        expect(typeof unit.cost).toBe("number");
        expect(typeof unit.hp).toBe("number");
        expect(typeof unit.attack).toBe("number");
        expect(typeof unit.attackSpeed).toBe("number");
        expect(typeof unit.range).toBe("number");
        expect(Array.isArray(unit.synergy)).toBe(true);
      });
    });
  });

  describe("TouhouRosterNotConfiguredError", () => {
    it("should be an instance of Error", () => {
      const error = new TouhouRosterNotConfiguredError();
      expect(error).toBeInstanceOf(Error);
    });

    it("should have the correct error message", () => {
      const error = new TouhouRosterNotConfiguredError();
      expect(error.message).toMatch(/Touhou roster data is not configured yet/);
    });

    it("should have the correct name", () => {
      const error = new TouhouRosterNotConfiguredError();
      expect(error.name).toBe("TouhouRosterNotConfiguredError");
    });
  });

  describe("Source selection abstraction", () => {
    it("should use MVP source when enableTouhouRoster is false", () => {
      const flags = createFeatureFlags({ enableTouhouRoster: false });

      // This should not throw and should return MVP data
      const units = getActiveRosterUnits(flags);
      expect(units.length).toBeGreaterThan(0);
      expect(units[0]!.unitId).toBeDefined();
    });

    it("should fail-closed when enableTouhouRoster is true (abstraction boundary)", () => {
      const flags = createFeatureFlags({ enableTouhouRoster: true });

      // The source selection abstraction should route to fail-closed behavior
      expect(() => getActiveRosterUnits(flags)).toThrow(
        TouhouRosterNotConfiguredError
      );
    });
  });
});
