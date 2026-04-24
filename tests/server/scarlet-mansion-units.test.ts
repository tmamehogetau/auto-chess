import { describe, expect, test } from "vitest";

import mvpPhase1UnitsData from "../../src/data/mvp_phase1_units.json";
import { getScarletMansionUnitById } from "../../src/data/scarlet-mansion-units";
import { getTouhouUnitById } from "../../src/data/touhou-units";

describe("scarlet mansion unit migration", () => {
  test("preserves non-zero built-in mitigation for legacy tank profiles", () => {
    expect(getScarletMansionUnitById("meiling")?.damageReduction).toBe(42);
    expect(getScarletMansionUnitById("sakuya")?.damageReduction).toBe(25);
    expect(getScarletMansionUnitById("patchouli")?.damageReduction).toBe(20);
  });

  test("keeps Patchouli as utility mage instead of an overwhelming carry", () => {
    expect(getScarletMansionUnitById("patchouli")).toMatchObject({
      hp: 520,
      attack: 95,
      attackSpeed: 0.65,
    });
  });

  test("keeps legacy vanguard mitigation for MVP and Touhou rosters", () => {
    expect(
      mvpPhase1UnitsData.units.find((unit) => unit.unitId === "warrior_a")?.damageReduction,
    ).toBe(5);
    expect(
      mvpPhase1UnitsData.units.find((unit) => unit.unitId === "knight")?.damageReduction,
    ).toBe(5);
    expect(getTouhouUnitById("rin")?.damageReduction).toBe(5);
    expect(getTouhouUnitById("byakuren")?.damageReduction).toBe(5);
    expect(getTouhouUnitById("junko")?.damageReduction).toBe(5);
  });

  test("requires explicit damageReduction on every MVP phase 1 unit and boss entry", () => {
    expect(mvpPhase1UnitsData.units.every((unit) => typeof unit.damageReduction === "number")).toBe(true);
    expect(typeof mvpPhase1UnitsData.boss.damageReduction).toBe("number");
  });
});
