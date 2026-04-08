import { expect, test } from "vitest";

import { DEFAULT_FLAGS } from "../../src/shared/feature-flags";
import type { BoardUnitPlacement } from "../../src/shared/room-messages";
import {
  sharedBoardCoordinateToIndex,
  sharedBoardIndexToCoordinate,
} from "../../src/shared/board-geometry";
import { BattleSimulator, createBattleUnit } from "../../src/server/combat/battle-simulator";
import {
  createBattleStartEvent,
  createKeyframeEvent,
  isBattleTimelineEvent,
} from "../../src/server/combat/battle-timeline";

test("battle timeline contract supports event-driven replay with keyframes", () => {
  const event = createBattleStartEvent({
    battleId: "battle-1",
    round: 3,
    boardConfig: { width: 6, height: 6 },
    units: [{ battleUnitId: "raid-0", side: "raid", x: 0, y: 5, currentHp: 20, maxHp: 20 }],
  });

  expect(isBattleTimelineEvent(event)).toBe(true);

  const keyframe = createKeyframeEvent({
    battleId: "battle-1",
    atMs: 250,
    units: [{ battleUnitId: "raid-0", x: 0, y: 4, currentHp: 18, maxHp: 20, alive: true, state: "moving" }],
  });

  expect(keyframe.type).toBe("keyframe");
});

test("simulateBattle emits move, attack, damage, death, and keyframe events in order", () => {
  const flags = { ...DEFAULT_FLAGS, enableBossExclusiveShop: true };
  const simulator = new BattleSimulator();

  const leftPlacements: BoardUnitPlacement[] = [{
    cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }),
    unitType: "vanguard",
    hp: 50,
    attack: 10,
    attackSpeed: 10,
    range: 1,
  }];
  const rightPlacements: BoardUnitPlacement[] = [{
    cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }),
    unitType: "mage",
    hp: 1,
    attack: 1,
    attackSpeed: 10,
    range: 1,
  }];

  const leftUnits = [createBattleUnit(leftPlacements[0]!, "left", 0, true, flags)];
  const rightUnits = [createBattleUnit(rightPlacements[0]!, "right", 0, false, flags)];

  const result = simulator.simulateBattle(
    leftUnits,
    rightUnits,
    leftPlacements,
    rightPlacements,
    3_000,
    null,
    null,
    null,
    flags,
  );

  expect(result.timeline?.some((event) => event.type === "move")).toBe(true);
  expect(result.timeline?.some((event) => event.type === "attackStart")).toBe(true);
  expect(result.timeline?.some((event) => event.type === "damageApplied")).toBe(true);
  expect(result.timeline?.some((event) => event.type === "unitDeath")).toBe(true);
  expect(result.timeline?.some((event) => event.type === "keyframe")).toBe(true);
  expect(result.timeline?.at(0)?.type).toBe("battleStart");
  expect(result.timeline?.at(-1)?.type).toBe("battleEnd");
});

test("simulateBattle keeps full 6x6 shared-board coordinates in battleStart snapshots", () => {
  const flags = { ...DEFAULT_FLAGS, enableBossExclusiveShop: true };
  const simulator = new BattleSimulator();

  const leftPlacements: BoardUnitPlacement[] = [{
    cell: 11,
    unitType: "vanguard",
  }];
  const rightPlacements: BoardUnitPlacement[] = [{
    cell: 24,
    unitType: "ranger",
  }];

  const leftUnits = [createBattleUnit(leftPlacements[0]!, "left", 0, true, flags)];
  const rightUnits = [createBattleUnit(rightPlacements[0]!, "right", 0, false, flags)];

  const result = simulator.simulateBattle(
    leftUnits,
    rightUnits,
    leftPlacements,
    rightPlacements,
    3_000,
    null,
    null,
    null,
    flags,
  );

  const battleStart = result.timeline.find((event) => event.type === "battleStart");

  expect(battleStart?.type).toBe("battleStart");
  expect(battleStart?.units).toEqual(expect.arrayContaining([
    expect.objectContaining({
      battleUnitId: "left-vanguard-0",
      x: 5,
      y: 1,
    }),
    expect.objectContaining({
      battleUnitId: "right-ranger-0",
      x: 0,
      y: 4,
    }),
  ]));
});

test("simulateBattle preserves shared-board indices in battleStart coordinates", () => {
  const flags = { ...DEFAULT_FLAGS, enableBossExclusiveShop: true };
  const simulator = new BattleSimulator();

  const leftPlacements: BoardUnitPlacement[] = [{
    cell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }),
    unitType: "vanguard",
  }];
  const rightPlacements: BoardUnitPlacement[] = [{
    cell: sharedBoardCoordinateToIndex({ x: 3, y: 2 }),
    unitType: "ranger",
  }];

  const leftUnits = [createBattleUnit(leftPlacements[0]!, "left", 0, false, flags)];
  const rightUnits = [createBattleUnit(rightPlacements[0]!, "right", 0, false, flags)];

  const result = simulator.simulateBattle(
    leftUnits,
    rightUnits,
    leftPlacements,
    rightPlacements,
    3_000,
    null,
    null,
    null,
    flags,
  );

  const battleStart = result.timeline.find((event) => event.type === "battleStart");
  const leftCoordinate = sharedBoardIndexToCoordinate(leftPlacements[0]!.cell);
  const rightCoordinate = sharedBoardIndexToCoordinate(rightPlacements[0]!.cell);

  expect(battleStart?.type).toBe("battleStart");
  expect(battleStart?.units).toEqual(expect.arrayContaining([
    expect.objectContaining({
      battleUnitId: "left-vanguard-0",
      x: leftCoordinate.x,
      y: leftCoordinate.y,
    }),
    expect.objectContaining({
      battleUnitId: "right-ranger-0",
      x: rightCoordinate.x,
      y: rightCoordinate.y,
    }),
  ]));
});

test("simulateBattle keeps raid replay ownership when battleSide is remapped", () => {
  const flags = { ...DEFAULT_FLAGS, enableBossExclusiveShop: true };
  const simulator = new BattleSimulator();

  const raidPlacement: BoardUnitPlacement = {
    cell: sharedBoardCoordinateToIndex({ x: 3, y: 3 }),
    unitType: "vanguard",
    unitId: "raid-a",
  };
  const bossPlacement: BoardUnitPlacement = {
    cell: sharedBoardCoordinateToIndex({ x: 2, y: 1 }),
    unitType: "mage",
    archetype: "remilia",
  };

  const raidUnit = {
    ...createBattleUnit(raidPlacement, "left", 0, false, flags),
    ownerPlayerId: "p1",
    battleSide: "right" as const,
  };
  const bossUnit = createBattleUnit(bossPlacement, "right", 0, true, flags);

  const result = simulator.simulateBattle(
    [raidUnit],
    [bossUnit],
    [raidPlacement],
    [bossPlacement],
    3_000,
    null,
    null,
    null,
    flags,
  );

  const battleStart = result.timeline.find((event) => event.type === "battleStart");
  const raidSnapshot = battleStart?.type === "battleStart"
    ? battleStart.units.find((unit) => unit.battleUnitId === raidUnit.id)
    : null;

  expect(raidSnapshot?.side).toBe("raid");
});
