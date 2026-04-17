import { describe, expect, test } from "vitest";

import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";
import { sharedBoardCoordinateToIndex } from "../../../src/shared/board-geometry";
import {
  BattleSimulator,
  createBattleUnit,
  type BattleUnit,
} from "../../../src/server/combat/battle-simulator";
import {
  buildAppliedDamageSummary,
  calculateAttackDamage,
  calculatePhaseDamageOnUnitDefeat,
  calculateReflectedDamage,
  resolveUnitDefeatConsequences,
} from "../../../src/server/combat/battle-resolution-helpers";
import type { BoardUnitPlacement } from "../../../src/shared/room-messages";

const LEGACY_RAID_COORDINATES = [
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
] as const;

const LEGACY_BOSS_COORDINATES = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 4, y: 2 },
] as const;

function legacySlotToSharedIndex(cell: number, side: "left" | "right"): number {
  const coordinate = side === "left"
    ? LEGACY_RAID_COORDINATES[cell]!
    : LEGACY_BOSS_COORDINATES[cell]!;
  return sharedBoardCoordinateToIndex(coordinate);
}

function createTestBattleUnit(
  placement: BoardUnitPlacement,
  side: "left" | "right",
  index: number,
  isBoss: boolean = false,
): BattleUnit {
  return createBattleUnit(
    {
      ...placement,
      cell: legacySlotToSharedIndex(placement.cell, side),
    },
    side,
    index,
    isBoss,
    DEFAULT_FLAGS,
  );
}

describe("battle contracts", () => {
  test("damage helper applies damageReduction as percentage and keeps a minimum of 1", () => {
    const attacker = createTestBattleUnit({ cell: 0, unitType: "ranger", starLevel: 1, attack: 20 }, "left", 0);
    const target = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 0);
    target.damageReduction = 50;

    expect(calculateAttackDamage(attacker, target, false, false)).toBe(10);

    target.damageReduction = 99;
    expect(calculateAttackDamage(attacker, target, false, false)).toBe(1);
  });

  test("damage helper still honors defenseMultiplier buffs", () => {
    const attacker = createTestBattleUnit({ cell: 0, unitType: "ranger", starLevel: 1, attack: 20 }, "left", 0);
    const target = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 0);
    target.damageReduction = 20;

    expect(calculateAttackDamage(attacker, target, false, false)).toBe(16);

    target.buffModifiers.defenseMultiplier = 1.25;
    expect(calculateAttackDamage(attacker, target, false, false)).toBe(12);
  });

  test("reflection helper never returns less than 1 damage when reflection applies", () => {
    expect(calculateReflectedDamage(10, 0.1)).toBe(1);
    expect(calculateReflectedDamage(37, 0.2)).toBe(7);
    expect(calculateReflectedDamage(0, 0.2)).toBe(0);
  });

  test("phase damage helper adds half max HP only for boss-side escort defeats", () => {
    const escort = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 0);
    escort.maxHp = 80;

    expect(calculatePhaseDamageOnUnitDefeat(escort, "right")).toBe(40);
    expect(calculatePhaseDamageOnUnitDefeat(escort, "left")).toBe(0);

    const boss = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
      "right",
      1,
      true,
    );
    expect(calculatePhaseDamageOnUnitDefeat(boss, "right")).toBe(0);
  });

  test("applied damage helper reports boss break and boss-side damage increments", () => {
    const boss = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
      "right",
      0,
      true,
    );
    boss.hp = 0;
    boss.maxHp = 100;

    expect(buildAppliedDamageSummary("left", boss, 25, "right")).toEqual({
      damageDealtLeftIncrement: 25,
      damageDealtRightIncrement: 0,
      bossDamageIncrement: 25,
      phaseDamageIncrement: 25,
      defeatedTarget: true,
      bossBreakTriggered: true,
    });
  });

  test("defeat consequence helper awards escort bonus without boss break", () => {
    const escort = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 0);
    escort.hp = 0;
    escort.maxHp = 80;

    expect(resolveUnitDefeatConsequences(escort, "right")).toEqual({
      defeatedUnit: true,
      bossBreakTriggered: false,
      phaseDamageIncrement: 40,
    });
  });

  test("normal-round timeout chooses the side with more surviving HP", () => {
    const simulator = new BattleSimulator();
    const leftUnit = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 3 }, "left", 0);
    const rightUnit = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 0);

    const result = simulator.simulateBattle([leftUnit], [rightUnit], [], [], 100);

    expect(result.winner).toBe("left");
    expect(result.durationMs).toBeGreaterThanOrEqual(100);
  });

  test("R12 no-timeout battle continues until resolution even past the normal timeout ceiling", () => {
    const simulator = new BattleSimulator();
    const leftUnit = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 3 }, "left", 0);
    const rightUnit = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 0);

    const result = simulator.simulateBattle([leftUnit], [rightUnit], [], [], 100, null, null, null, DEFAULT_FLAGS, 12);

    expect(result.winner).toBe("left");
    expect(result.durationMs).toBeGreaterThan(100);
    expect(result.leftSurvivors.length).toBeGreaterThan(0);
    expect(result.rightSurvivors).toHaveLength(0);
  });

  test("boss defeat ends the battle immediately even if escorts survive", () => {
    const simulator = new BattleSimulator();
    const raidAttacker = createTestBattleUnit(
      { cell: 0, unitType: "ranger", starLevel: 3, attack: 999 },
      "left",
      0,
    );
    raidAttacker.attackPower = 999;
    raidAttacker.attackRange = 6;
    raidAttacker.attackSpeed = 99;

    const boss = createTestBattleUnit(
      { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
      "right",
      0,
      true,
    );
    boss.hp = 1;
    boss.maxHp = 1;

    const escort = createTestBattleUnit({ cell: 7, unitType: "vanguard", starLevel: 3 }, "right", 1);

    const result = simulator.simulateBattle([raidAttacker], [boss, escort], [], [], 5_000);

    expect(result.winner).toBe("left");
    expect(result.rightSurvivors.some((unit) => unit.id === escort.id)).toBe(true);
    expect(result.combatLog.some((entry) => entry.includes("phase HP depleted"))).toBe(true);
  });

  test("escort defeat adds half of the escort max HP to phaseDamageToBossSide", () => {
    const simulator = new BattleSimulator();
    const raidAttacker = createTestBattleUnit(
      { cell: 0, unitType: "ranger", starLevel: 3, attack: 999 },
      "left",
      0,
    );
    raidAttacker.attackPower = 999;
    raidAttacker.attackRange = 6;
    raidAttacker.attackSpeed = 99;

    const boss = createTestBattleUnit(
      { cell: 7, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
      "right",
      0,
      true,
    );
    boss.attackRange = 0;
    boss.attackSpeed = 0;

    const escort = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 1);
    escort.hp = 1;
    escort.maxHp = 80;

    const result = simulator.simulateBattle([raidAttacker], [boss, escort], [], [], 10);

    expect(result.phaseDamageToBossSide).toBe(40);
    expect(result.bossDamage).toBe(0);
  });

  test("same-timestamp lethal attacks resolve as a draw when both units should die", () => {
    const simulator = new BattleSimulator();
    const leftUnit = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "left", 0);
    const rightUnit = createTestBattleUnit({ cell: 0, unitType: "vanguard", starLevel: 1 }, "right", 0);

    leftUnit.attackPower = 999;
    leftUnit.attackSpeed = 1;
    leftUnit.attackRange = 6;
    leftUnit.hp = 10;
    leftUnit.maxHp = 10;

    rightUnit.attackPower = 999;
    rightUnit.attackSpeed = 1;
    rightUnit.attackRange = 6;
    rightUnit.hp = 10;
    rightUnit.maxHp = 10;

    const result = simulator.simulateBattle([leftUnit], [rightUnit], [], [], 5_000);

    expect(result.winner).toBe("draw");
    expect(result.leftSurvivors).toHaveLength(0);
    expect(result.rightSurvivors).toHaveLength(0);
  });
});
