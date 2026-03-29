import { describe, expect, test } from "vitest";

import { FeatureFlagService } from "../../src/server/feature-flag-service";
import { MatchRoomController } from "../../src/server/match-room-controller";
import type { BoardUnitPlacement } from "../../src/shared/room-messages";

const controllerOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 30_000,
  battleDurationMs: 10_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
};

function withSubUnitFlag(enabled: boolean, run: () => void): void {
  const originalEnv = { ...process.env };

  try {
    process.env.FEATURE_ENABLE_HERO_SYSTEM = "false";
    process.env.FEATURE_ENABLE_SHARED_POOL = "false";
    process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";
    process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = String(enabled);
    process.env.FEATURE_ENABLE_EMBLEM_CELLS = "false";
    process.env.FEATURE_ENABLE_SPELL_CARD = "false";
    process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "false";
    process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "false";
    process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = "false";

    (FeatureFlagService as any).instance = undefined;
    run();
  } finally {
    process.env = originalEnv;
    (FeatureFlagService as any).instance = undefined;
  }
}

function withSubUnitBossMode(run: () => void): void {
  const originalEnv = { ...process.env };

  try {
    process.env.FEATURE_ENABLE_HERO_SYSTEM = "false";
    process.env.FEATURE_ENABLE_SHARED_POOL = "false";
    process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";
    process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "true";
    process.env.FEATURE_ENABLE_EMBLEM_CELLS = "false";
    process.env.FEATURE_ENABLE_SPELL_CARD = "false";
    process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "false";
    process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
    process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = "false";

    (FeatureFlagService as any).instance = undefined;
    run();
  } finally {
    process.env = originalEnv;
    (FeatureFlagService as any).instance = undefined;
  }
}

function withSubUnitHeroMode(run: () => void): void {
  const originalEnv = { ...process.env };

  try {
    process.env.FEATURE_ENABLE_HERO_SYSTEM = "true";
    process.env.FEATURE_ENABLE_SHARED_POOL = "false";
    process.env.FEATURE_ENABLE_PHASE_EXPANSION = "false";
    process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM = "true";
    process.env.FEATURE_ENABLE_EMBLEM_CELLS = "false";
    process.env.FEATURE_ENABLE_SPELL_CARD = "false";
    process.env.FEATURE_ENABLE_RUMOR_INFLUENCE = "false";
    process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP = "true";
    process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW = "false";

    (FeatureFlagService as any).instance = undefined;
    run();
  } finally {
    process.env = originalEnv;
    (FeatureFlagService as any).instance = undefined;
  }
}

function createStartedController(): MatchRoomController {
  const controller = new MatchRoomController(
    ["p1", "p2", "p3", "p4"],
    1_000,
    controllerOptions,
  );

  controller.setReady("p1", true);
  controller.setReady("p2", true);
  controller.setReady("p3", true);
  controller.setReady("p4", true);
  controller.startIfReady(2_000);

  return controller;
}

function createStartedBossModeController(): MatchRoomController {
  const controller = new MatchRoomController(
    ["p1", "p2", "p3", "p4"],
    1_000,
    controllerOptions,
  );

  const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3", "p4"], {
    bossPlayerId: "p4",
    selectedHeroByPlayer: new Map(),
    selectedBossByPlayer: new Map([["p4", "remilia"]]),
  });

  expect(started).toBe(true);

  return controller;
}

function createStartedHeroModeController(heroId: "reimu" | "okina"): MatchRoomController {
  const controller = new MatchRoomController(
    ["p1", "p2", "p3", "p4"],
    1_000,
    controllerOptions,
  );

  const started = controller.startWithResolvedRoles(2_000, ["p1", "p2", "p3", "p4"], {
    bossPlayerId: "p4",
    selectedHeroByPlayer: new Map([
      ["p1", heroId],
      ["p2", "reimu"],
      ["p3", "marisa"],
    ]),
    selectedBossByPlayer: new Map([["p4", "remilia"]]),
  });

  expect(started).toBe(true);

  return controller;
}

function createAttachedPlacement(
  cell: number,
  hostUnitType: "vanguard" | "ranger" | "mage" | "assassin",
  subUnitType: "vanguard" | "ranger" | "mage" | "assassin",
): BoardUnitPlacement {
  return {
    cell,
    unitType: hostUnitType,
    starLevel: 1,
    sellValue: 1,
    unitCount: 1,
    subUnit: {
      unitType: subUnitType,
      starLevel: 1,
      sellValue: 1,
      unitCount: 1,
    },
  } as unknown as BoardUnitPlacement;
}

describe("Sub Unit System Integration", () => {
  test("enableSubUnitSystem ON時はhost unitにattachable sub stateを持てる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const commandResult = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [createAttachedPlacement(0, "vanguard", "mage")],
      });

      expect(commandResult).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("0:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual(["0:mage"]);
    });
  });

  test("board-to-board moveではhostとsubが一緒に移動する", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [createAttachedPlacement(0, "vanguard", "mage")],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const moveCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        boardPlacements: [createAttachedPlacement(5, "vanguard", "mage")],
      });

      expect(moveCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("5:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual(["5:mage"]);
    });
  });

  test("board-to-benchでは通常subが分離してbenchへ戻る", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [createAttachedPlacement(0, "vanguard", "mage")],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const returnCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        boardToBenchCell: { cell: 0 },
      });

      expect(returnCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toEqual([]);
      expect((status as any).boardSubUnits).toEqual([]);
      expect(status.benchUnits).toEqual(["vanguard", "mage"]);
    });
  });

  test("benchToBoardCell slot=sub で自分の main に sub を装着できる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const internals = controller as unknown as {
        benchUnitsByPlayer: Map<string, Array<{
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          cost: number;
          starLevel: number;
          unitCount: number;
        }>>;
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        boardUnitCountByPlayer: Map<string, number>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "mage", cost: 1, starLevel: 1, unitCount: 1 },
      ]);
      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 24, unitType: "vanguard", starLevel: 1, sellValue: 1, unitCount: 1 },
      ]);
      internals.boardUnitCountByPlayer.set("p1", 1);

      const result = controller.submitPrepCommand("p1", 1, 3_100, {
        benchToBoardCell: {
          benchIndex: 0,
          cell: 24,
          slot: "sub",
        },
      });

      expect(result).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("24:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual(["24:mage"]);
      expect(status.benchUnits).toEqual([]);
    });
  });

  test("benchToBoardCell slot=sub で既存 sub を即座に入れ替えられる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const internals = controller as unknown as {
        benchUnitsByPlayer: Map<string, Array<{
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          cost: number;
          starLevel: number;
          unitCount: number;
        }>>;
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        boardUnitCountByPlayer: Map<string, number>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "ranger", cost: 1, starLevel: 1, unitCount: 1 },
      ]);
      internals.boardPlacementsByPlayer.set("p1", [
        createAttachedPlacement(24, "vanguard", "mage"),
      ]);
      internals.boardUnitCountByPlayer.set("p1", 1);

      const result = controller.submitPrepCommand("p1", 1, 3_100, {
        benchToBoardCell: {
          benchIndex: 0,
          cell: 24,
          slot: "sub",
        },
      });

      expect(result).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("24:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual(["24:ranger"]);
      expect(status.benchUnits).toEqual(["mage"]);
    });
  });

  test("boss sideはsub attachmentを持てない", () => {
    withSubUnitBossMode(() => {
      const controller = createStartedBossModeController();

      const commandResult = controller.submitPrepCommand("p4", 1, 3_000, {
        boardPlacements: [createAttachedPlacement(0, "vanguard", "mage")],
      });

      expect(commandResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });
  });

  test("boss sideは benchToBoardCell slot=sub でも sub 装着できない", () => {
    withSubUnitBossMode(() => {
      const controller = createStartedBossModeController();

      const internals = controller as unknown as {
        benchUnitsByPlayer: Map<string, Array<{
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          cost: number;
          starLevel: number;
          unitCount: number;
        }>>;
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        boardUnitCountByPlayer: Map<string, number>;
      };

      internals.benchUnitsByPlayer.set("p4", [
        { unitType: "mage", cost: 1, starLevel: 1, unitCount: 1 },
      ]);
      internals.boardPlacementsByPlayer.set("p4", [
        { cell: 0, unitType: "vanguard", starLevel: 1, sellValue: 1, unitCount: 1 },
      ]);
      internals.boardUnitCountByPlayer.set("p4", 1);

      const result = controller.submitPrepCommand("p4", 1, 3_100, {
        benchToBoardCell: {
          benchIndex: 0,
          cell: 0,
          slot: "sub",
        },
      });

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    });
  });

  test("enableSubUnitSystem OFF時は従来トークンを維持する", () => {
    withSubUnitFlag(false, () => {
      const controller = createStartedController();

      const commandResult = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard", starLevel: 1 }],
      });

      expect(commandResult).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("0:vanguard");
      expect(status.boardUnits.some((unit) => unit.includes(":sub"))).toBe(false);
      expect((status as any).boardSubUnits ?? []).toEqual([]);
    });
  });

  test("通常主人公はoccupied host cellのsub slotには入れない", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("reimu");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
      ])).toMatchObject({ success: true });

      const initialHeroCell = controller.getHeroPlacementForPlayer("p1");
      expect(initialHeroCell).toBe(30);

      const result = controller.applyHeroPlacementForPlayer("p1", 24);

      expect(result).toMatchObject({ success: false, code: "INVALID_CELL" });
      expect(controller.getHeroPlacementForPlayer("p1")).toBe(initialHeroCell);
      expect((controller.getPlayerStatus("p1") as any).boardSubUnits).toEqual([]);
    });
  });

  test("摩多羅隠岐奈だけは自分の他ユニットのsub slotに入れる", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
      ])).toMatchObject({ success: true });

      const result = controller.applyHeroPlacementForPlayer("p1", 24);

      expect(result).toMatchObject({ success: true, code: "SUCCESS" });
      expect(controller.getHeroPlacementForPlayer("p1")).toBeNull();

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("24:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual(["24:hero:okina"]);
      expect(status.benchUnits).toEqual([]);
    });
  });

  test("摩多羅隠岐奈subはhostのboard-to-board moveに追従する", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
      ])).toMatchObject({ success: true });
      expect(controller.applyHeroPlacementForPlayer("p1", 24)).toMatchObject({ success: true });

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 25, unitType: "vanguard" },
      ])).toMatchObject({ success: true });

      const status = controller.getPlayerStatus("p1");
      expect(controller.getHeroPlacementForPlayer("p1")).toBeNull();
      expect(status.boardUnits).toContain("25:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual(["25:hero:okina"]);
    });
  });

  test("摩多羅隠岐奈hostをbenchへ戻した時はsubからmainに変化しbenchには入らない", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
      ])).toMatchObject({ success: true });
      expect(controller.applyHeroPlacementForPlayer("p1", 24)).toMatchObject({ success: true });

      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        boardToBenchCell: { cell: 24 },
      });

      expect(result).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toEqual([]);
      expect((status as any).boardSubUnits).toEqual([]);
      expect(status.benchUnits).toEqual(["vanguard"]);
      expect(controller.getHeroPlacementForPlayer("p1")).toBe(24);
    });
  });
});
