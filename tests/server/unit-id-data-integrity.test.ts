import { describe, expect, test } from "vitest";

import { loadMvpPhase1Units } from "../../src/shared/types";
import { SCARLET_MANSION_UNITS } from "../../src/data/scarlet-mansion-units";
import { RUMOR_UNITS_BY_ROUND } from "../../src/data/rumor-units";

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
