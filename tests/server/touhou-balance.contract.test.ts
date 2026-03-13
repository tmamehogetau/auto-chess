import { describe, expect, test } from "vitest";

import { TOUHOU_UNITS, type TouhouUnit } from "../../src/data/touhou-units";

interface StatBand {
  hp: readonly [number, number];
  attack: readonly [number, number];
}

const NON_OUTLIER_BANDS: Readonly<Record<TouhouUnit["cost"], StatBand>> = {
  1: { hp: [390, 620], attack: [40, 45] },
  2: { hp: [540, 740], attack: [52, 64] },
  3: { hp: [680, 820], attack: [66, 76] },
  4: { hp: [900, 1120], attack: [84, 104] },
  5: { hp: [1060, 1450], attack: [108, 118] },
};

const EXPLICIT_OUTLIER_IDS = new Set<TouhouUnit["unitId"]>([
  "koishi",
  "ichirin",
  "sekibanki",
  "seiga",
  "utsuho",
  "shou",
]);

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("touhou balance contract", () => {
  test("same-cost non-outlier Touhou units は W11 stat band に収まる", () => {
    for (const unit of TOUHOU_UNITS) {
      if (EXPLICIT_OUTLIER_IDS.has(unit.unitId)) {
        continue;
      }

      const band = NON_OUTLIER_BANDS[unit.cost];

      expect(unit.hp, `${unit.unitId} hp`).toBeGreaterThanOrEqual(band.hp[0]);
      expect(unit.hp, `${unit.unitId} hp`).toBeLessThanOrEqual(band.hp[1]);
      expect(unit.attack, `${unit.unitId} attack`).toBeGreaterThanOrEqual(band.attack[0]);
      expect(unit.attack, `${unit.unitId} attack`).toBeLessThanOrEqual(band.attack[1]);
    }
  });

  test("named Touhou outliers は意図した stat profile を維持する", () => {
    const futo = TOUHOU_UNITS.find((unit) => unit.unitId === "futo");
    const chimata = TOUHOU_UNITS.find((unit) => unit.unitId === "chimata");
    const koishi = TOUHOU_UNITS.find((unit) => unit.unitId === "koishi");
    const ichirin = TOUHOU_UNITS.find((unit) => unit.unitId === "ichirin");
    const seiga = TOUHOU_UNITS.find((unit) => unit.unitId === "seiga");
    const sekibanki = TOUHOU_UNITS.find((unit) => unit.unitId === "sekibanki");
    const utsuho = TOUHOU_UNITS.find((unit) => unit.unitId === "utsuho");
    const shou = TOUHOU_UNITS.find((unit) => unit.unitId === "shou");

    expect(futo).toMatchObject({ hp: 900, attack: 90, cost: 4 });
    expect(chimata).toMatchObject({ hp: 900, attack: 84, cost: 4 });
    expect(koishi).toMatchObject({ hp: 580, attack: 68, cost: 2 });
    expect(ichirin).toMatchObject({ hp: 820, attack: 50, cost: 2 });
    expect(sekibanki).toMatchObject({ hp: 520, attack: 64, cost: 2 });
    expect(seiga).toMatchObject({ hp: 650, attack: 80, cost: 3 });
    expect(utsuho).toMatchObject({ hp: 960, attack: 108, cost: 4 });
    expect(shou).toMatchObject({ hp: 1010, attack: 81, cost: 4 });
  });

  test("higher-cost Touhou units は直下 cost 平均を hp/attack 両方で同時に下回らない", () => {
    const unitsByCost = new Map<TouhouUnit["cost"], TouhouUnit[]>();

    for (const unit of TOUHOU_UNITS) {
      const current = unitsByCost.get(unit.cost) ?? [];
      current.push(unit);
      unitsByCost.set(unit.cost, current);
    }

    for (const cost of [2, 3, 4, 5] as const) {
      const previousCostUnits = unitsByCost.get((cost - 1) as TouhouUnit["cost"]);
      const currentCostUnits = unitsByCost.get(cost);

      expect(previousCostUnits).toBeDefined();
      expect(currentCostUnits).toBeDefined();

      const previousHpAverage = average(previousCostUnits!.map((unit) => unit.hp));
      const previousAttackAverage = average(previousCostUnits!.map((unit) => unit.attack));

      for (const unit of currentCostUnits!) {
        expect(
          unit.hp < previousHpAverage && unit.attack < previousAttackAverage,
          `${unit.unitId} should not trail cost ${cost - 1} averages on both hp and attack`,
        ).toBe(false);
      }
    }
  });
});
