import { describe, expect, test } from "vitest";

import {
  calculateBoardPower,
  normalizeBoardPlacements,
} from "../../../src/server/combat/unit-effects";
import type { BoardUnitPlacement } from "../../../src/shared/room-messages";

describe("unit-effects", () => {
  test("normalizeBoardPlacementsはセル順へ正規化する", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 5, unitType: "mage" },
      { cell: 1, unitType: "vanguard" },
      { cell: 4, unitType: "ranger" },
    ];

    const normalized = normalizeBoardPlacements(placements);

    expect(normalized).toEqual([
      { cell: 1, unitType: "vanguard" },
      { cell: 4, unitType: "ranger" },
      { cell: 5, unitType: "mage" },
    ]);
  });

  test("normalizeBoardPlacementsは重複セルをrejectする", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 0, unitType: "vanguard" },
      { cell: 0, unitType: "mage" },
    ];

    const normalized = normalizeBoardPlacements(placements);

    expect(normalized).toBeNull();
  });

  test("後列mage2体でスキルボーナスが発動する", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 4, unitType: "mage" },
      { cell: 5, unitType: "mage" },
      { cell: 0, unitType: "vanguard" },
      { cell: 1, unitType: "ranger" },
    ];

    const power = calculateBoardPower(placements);

    expect(power).toBe(31);
  });

  test("後列ranger2体は前列mageがないとスキル不発", () => {
    const withMageSpotter: BoardUnitPlacement[] = [
      { cell: 4, unitType: "ranger" },
      { cell: 5, unitType: "ranger" },
      { cell: 0, unitType: "mage" },
      { cell: 1, unitType: "vanguard" },
    ];
    const withoutMageSpotter: BoardUnitPlacement[] = [
      { cell: 4, unitType: "ranger" },
      { cell: 5, unitType: "ranger" },
      { cell: 0, unitType: "vanguard" },
      { cell: 1, unitType: "assassin" },
    ];

    const withSpotterPower = calculateBoardPower(withMageSpotter);
    const withoutSpotterPower = calculateBoardPower(withoutMageSpotter);

    expect(withSpotterPower).toBe(26);
    expect(withoutSpotterPower).toBe(24);
  });

  test("前列vanguard2体で防衛陣形ボーナスが発動する", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 0, unitType: "vanguard" },
      { cell: 1, unitType: "vanguard" },
      { cell: 4, unitType: "assassin" },
      { cell: 5, unitType: "mage" },
    ];

    const power = calculateBoardPower(placements);

    expect(power).toBe(33);
  });

  test("set2ではrangerの条件が緩くなり同じ配置で火力が上がる", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 4, unitType: "ranger" },
      { cell: 5, unitType: "ranger" },
      { cell: 0, unitType: "vanguard" },
      { cell: 1, unitType: "assassin" },
    ];

    const set1Power = calculateBoardPower(placements, { setId: "set1" });
    const set2Power = calculateBoardPower(placements, { setId: "set2" });

    expect(set1Power).toBe(24);
    expect(set2Power).toBe(27);
  });

  test("set1は前列mageがあっても後列に非rangerがいるとrangerスキル不発", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 0, unitType: "mage" },
      { cell: 4, unitType: "ranger" },
      { cell: 5, unitType: "ranger" },
      { cell: 6, unitType: "vanguard" },
    ];

    const set1Power = calculateBoardPower(placements, { setId: "set1" });
    const set2Power = calculateBoardPower(placements, { setId: "set2" });

    expect(set1Power).toBe(20);
    expect(set2Power).toBe(23);
  });

  test("set1条件を満たす後列ranger2体構成ではset1/set2の火力は一致する", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 4, unitType: "ranger" },
      { cell: 5, unitType: "ranger" },
      { cell: 0, unitType: "mage" },
      { cell: 1, unitType: "vanguard" },
    ];

    const set1Power = calculateBoardPower(placements, { setId: "set1" });
    const set2Power = calculateBoardPower(placements, { setId: "set2" });

    expect(set1Power).toBe(26);
    expect(set2Power).toBe(26);
  });
});
