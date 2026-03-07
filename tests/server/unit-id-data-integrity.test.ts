import { describe, expect, test } from "vitest";

import { loadMvpPhase1Units } from "../../src/shared/types";
import { SCARLET_MANSION_UNITS } from "../../src/data/scarlet-mansion-units";
import { RUMOR_UNITS_BY_ROUND } from "../../src/data/rumor-units";
import { getActiveRosterUnits, TouhouRosterNotConfiguredError } from "../../src/server/roster/roster-provider";
import { DEFAULT_FLAGS } from "../../src/shared/feature-flags";

const UNIT_ID_PATTERN = /^[a-z0-9_]+$/;

describe("unit id data integrity", () => {
  test("every current unit dataset exposes a stable ASCII unitId and keeps legacy unitType fields", async () => {
    const mvpUnits = await loadMvpPhase1Units();
    const rumorUnits = Object.values(RUMOR_UNITS_BY_ROUND);

    for (const unit of mvpUnits) {
      expect((unit as { unitId?: string }).unitId).toMatch(UNIT_ID_PATTERN);
      expect(unit.type).toBeTruthy();
    }

    for (const unit of SCARLET_MANSION_UNITS) {
      expect((unit as { unitId?: string }).unitId).toMatch(UNIT_ID_PATTERN);
      expect(unit.unitType).toBeTruthy();
    }

    for (const unit of rumorUnits) {
      expect((unit as { unitId?: string }).unitId).toMatch(UNIT_ID_PATTERN);
      expect(unit.unitType).toBeTruthy();
    }
  });

  test("MVP roster data remains the active production source when Touhou roster is disabled", () => {
    // This test documents that current data integrity coverage (MVP + rumor + scarlet)
    // represents the active production dataset. Touhou roster activation requires
    // completing unitType/cost for all 25 units in touhou-units-migration-plan.md.
    const flagsWithTouhouDisabled = { ...DEFAULT_FLAGS, enableTouhouRoster: false };
    const activeRoster = getActiveRosterUnits(flagsWithTouhouDisabled);

    // MVP roster should be returned (8 units from mvp_phase1_units.json)
    expect(activeRoster.length).toBeGreaterThan(0);
    expect(activeRoster.every(u => u.unitId.match(UNIT_ID_PATTERN))).toBe(true);
  });

  test("Touhou roster is intentionally blocked with explicit error until unit data is complete", () => {
    // This test documents the fail-closed scaffold: Touhou roster activation
    // is blocked until all 25 units have concrete unitType/cost values.
    // See: touhou-units-migration-plan.md - all unitType and cost are currently "TBD"
    const flagsWithTouhouEnabled = { ...DEFAULT_FLAGS, enableTouhouRoster: true };

    expect(() => getActiveRosterUnits(flagsWithTouhouEnabled))
      .toThrow(TouhouRosterNotConfiguredError);
    expect(() => getActiveRosterUnits(flagsWithTouhouEnabled))
      .toThrow(/Touhou roster data is not configured yet/);
  });

  test("unitId values are unique across current datasets", async () => {
    const mvpUnits = await loadMvpPhase1Units();
    const rumorUnits = Object.values(RUMOR_UNITS_BY_ROUND);
    const unitIds = [
      ...mvpUnits.map((unit) => (unit as { unitId?: string }).unitId),
      ...SCARLET_MANSION_UNITS.map((unit) => (unit as { unitId?: string }).unitId),
      ...rumorUnits.map((unit) => (unit as { unitId?: string }).unitId),
    ];

    expect(unitIds).not.toContain(undefined);
    expect(new Set(unitIds).size).toBe(unitIds.length);
  });
});
