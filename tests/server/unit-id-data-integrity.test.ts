import { describe, expect, test } from "vitest";

import { loadMvpPhase1Units } from "../../src/shared/types";
import { SCARLET_MANSION_UNITS } from "../../src/data/scarlet-mansion-units";
import { RUMOR_UNITS_BY_ROUND } from "../../src/data/rumor-units";
import { TOUHOU_UNITS } from "../../src/data/touhou-units";
import { getActiveRosterUnits } from "../../src/server/roster/roster-provider";
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

  test("Touhou roster draft data is available through the active roster provider path", () => {
    const flagsWithTouhouEnabled = { ...DEFAULT_FLAGS, enableTouhouRoster: true };
    const activeRoster = getActiveRosterUnits(flagsWithTouhouEnabled);

    expect(activeRoster).toHaveLength(25);
    expect(activeRoster.every((unit) => unit.unitId.match(UNIT_ID_PATTERN))).toBe(true);
    expect(activeRoster.some((unit) => unit.unitId === "zanmu")).toBe(true);
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

  test("Touhou draft data exposes stable ids and fully concrete roster fields", () => {
    expect(TOUHOU_UNITS).toHaveLength(25);

    for (const unit of TOUHOU_UNITS) {
      expect(unit.unitId).toMatch(UNIT_ID_PATTERN);
      expect(unit.displayName.length).toBeGreaterThan(0);
      expect(unit.unitType).toBeTruthy();
      expect(unit.cost).toBeGreaterThanOrEqual(1);
      expect(unit.cost).toBeLessThanOrEqual(5);
      expect(unit.hp).toBeGreaterThan(0);
      expect(unit.attack).toBeGreaterThan(0);
      expect(unit.attackSpeed).toBeGreaterThan(0);
      expect(unit.range).toBeGreaterThanOrEqual(1);
    }
  });

  test("Touhou draft preserves expected faction counts and unique unitIds", () => {
    const unitIds = TOUHOU_UNITS.map((unit) => unit.unitId);
    const factionCounts = TOUHOU_UNITS.reduce<Record<string, number>>((counts, unit) => {
      const key = unit.factionId ?? "none";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});

    expect(new Set(unitIds).size).toBe(unitIds.length);
    expect(factionCounts).toEqual({
      chireiden: 4,
      myourenji: 5,
      shinreibyou: 5,
      grassroot_network: 3,
      niji_ryuudou: 4,
      kanjuden: 3,
      none: 1,
    });
  });
});
