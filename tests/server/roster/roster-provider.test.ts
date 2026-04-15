import { describe, it, expect } from "vitest";
import {
  getActiveRosterUnits,
  getActiveRosterKind,
  getTouhouDraftRosterUnits,
  ROSTER_KIND_MVP,
  ROSTER_KIND_TOUHOU,
  TouhouRosterNotConfiguredError,
  type RosterUnit,
} from "../../../src/server/roster/roster-provider";
import type { FeatureFlags } from "../../../src/shared/feature-flags";
import mvpPhase1UnitsData from "../../../src/data/mvp_phase1_units.json";
import { TOUHOU_UNITS } from "../../../src/data/touhou-units";

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

    it("should return Touhou draft roster units when enableTouhouRoster is true", () => {
      const flags = createFeatureFlags({
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      });

      const units = getActiveRosterUnits(flags);
      expect(units).toHaveLength(TOUHOU_UNITS.length);
      expect(units[0]).toMatchObject({
        unitId: "rin",
        name: "火焔猫燐",
        type: "vanguard",
      });
    });

    it("should expose Touhou draft roster data through a separate wiring path", () => {
      const draftUnits = getTouhouDraftRosterUnits();

      expect(draftUnits).toHaveLength(25);
      expect(draftUnits[0]).toMatchObject({
        unitId: "rin",
        name: "火焔猫燐",
        type: "vanguard",
        cost: 1,
      });
      expect(draftUnits.some((unit) => unit.unitId === "zanmu")).toBe(true);
      expect(draftUnits.every((unit) => Array.isArray(unit.synergy))).toBe(true);

      const flags = createFeatureFlags({ enableTouhouRoster: true });
      const activeUnits = getActiveRosterUnits(flags);
      expect(activeUnits).toHaveLength(draftUnits.length);
    });

    it("should expose factionId for Touhou draft roster units", () => {
      const draftUnits = getTouhouDraftRosterUnits();

      const rin = draftUnits.find((unit) => unit.unitId === "rin");
      const zanmu = draftUnits.find((unit) => unit.unitId === "zanmu");

      expect(rin?.factionId).toBe("chireiden");
      expect(zanmu?.factionId).toBeNull();
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
      expect(firstUnit).toHaveProperty("movementSpeed");
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
        expect(typeof unit.movementSpeed).toBe("number");
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

    it("should switch source when enableTouhouRoster is true (abstraction boundary)", () => {
      const flags = createFeatureFlags({ enableTouhouRoster: true });

      const units = getActiveRosterUnits(flags);
      expect(units.some((unit) => unit.unitId === "zanmu")).toBe(true);
    });
  });

  /**
   * Regression coverage: Legacy fallback hard boundary enforcement
   * These tests ensure that enableTouhouRoster=false is the absolute gate.
   * Adjacent flags must NOT affect roster selection when the main switch is OFF.
   */
  describe("Legacy fallback hard boundary (enableTouhouRoster=false)", () => {
    it("should return MVP roster when enableTouhouFactions=true WITHOUT enableTouhouRoster", () => {
      // Regression test: Touhou factions flag alone must NOT activate Touhou roster
      const flags = createFeatureFlags({
        enableTouhouRoster: false,
        enableTouhouFactions: true,
      });

      const kind = getActiveRosterKind(flags);
      const units = getActiveRosterUnits(flags);

      expect(kind).toBe(ROSTER_KIND_MVP);
      expect(units).toHaveLength(mvpPhase1UnitsData.units.length);
      expect(units.some((unit) => unit.unitId === "warrior_a")).toBe(true);
      expect(units.some((unit) => unit.unitId === "rin")).toBe(false);
    });

    it("should return MVP roster when enablePerUnitSharedPool=true WITHOUT enableTouhouRoster", () => {
      // Regression test: Per-unit shared pool flag alone must NOT affect roster selection
      const flags = createFeatureFlags({
        enableTouhouRoster: false,
        enablePerUnitSharedPool: true,
      });

      const kind = getActiveRosterKind(flags);
      const units = getActiveRosterUnits(flags);

      expect(kind).toBe(ROSTER_KIND_MVP);
      expect(units).toHaveLength(mvpPhase1UnitsData.units.length);
      expect(units[0]!.unitId).toBe(mvpPhase1UnitsData.units[0]!.unitId);
    });

    it("should return MVP roster when ALL adjacent Touhou flags are true BUT enableTouhouRoster is false", () => {
      // Comprehensive regression: Even with all adjacent flags forced ON,
      // the legacy boundary (enableTouhouRoster=false) must remain intact.
      const flags = createFeatureFlags({
        enableTouhouRoster: false,
        enableTouhouFactions: true,
        enablePerUnitSharedPool: true,
        enableSharedPool: true,
      });

      const kind = getActiveRosterKind(flags);
      const units = getActiveRosterUnits(flags);

      expect(kind).toBe(ROSTER_KIND_MVP);
      // Verify MVP units are returned, not Touhou units
      expect(units.some((unit) => unit.unitId === "warrior_a")).toBe(true);
      expect(units.some((unit) => unit.unitId === "dragon")).toBe(true);
      expect(units.some((unit) => unit.unitId === "rin")).toBe(false);
      expect(units.some((unit) => unit.unitId === "zanmu")).toBe(false);
    });

    it("should maintain MVP roster even with complex mixed flag combinations", () => {
      // Edge case: Mixed legacy and new flags should not break the boundary
      const flags = createFeatureFlags({
        enableTouhouRoster: false,
        enableTouhouFactions: true,
        enablePerUnitSharedPool: true,
        enableHeroSystem: true,
        enablePhaseExpansion: true,
      });

      const kind = getActiveRosterKind(flags);
      const units = getActiveRosterUnits(flags);

      expect(kind).toBe(ROSTER_KIND_MVP);
      expect(units.length).toBe(mvpPhase1UnitsData.units.length);
    });
  });
});
