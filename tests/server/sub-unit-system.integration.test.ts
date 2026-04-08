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

  test("subUnitToBenchCellではhostを残したまま通常subだけbenchへ戻せる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [createAttachedPlacement(24, "vanguard", "mage")],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const returnSubCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        subUnitToBenchCell: { cell: 24 },
      });

      expect(returnSubCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toEqual(["24:vanguard"]);
      expect((status as any).boardSubUnits).toEqual([]);
      expect(status.benchUnits).toEqual(["mage"]);
    });
  });

  test("subUnitMove slot=main では通常subを独立した盤面ユニットとして出せる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [createAttachedPlacement(24, "vanguard", "mage")],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const moveCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        subUnitMove: { fromCell: 24, toCell: 25, slot: "main" },
      });

      expect(moveCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toEqual(["24:vanguard", "25:mage"]);
      expect((status as any).boardSubUnits).toEqual([]);
    });
  });

  test("subUnitMove slot=main は attached metadata を独立ユニットへ引き継ぐ", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{
          cell: 24,
          unitType: "vanguard",
          starLevel: 1,
          subUnit: {
            unitType: "mage",
            starLevel: 1,
            unitId: "murasa",
            factionId: "myourenji",
            archetype: "remilia",
          },
        }],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const moveCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        subUnitMove: { fromCell: 24, toCell: 25, slot: "main" },
      });

      expect(moveCommand).toEqual({ accepted: true });

      const internals = controller.getTestAccess() as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };
      expect(internals.boardPlacementsByPlayer.get("p1")).toEqual(expect.arrayContaining([
        expect.objectContaining({
          cell: 25,
          unitType: "mage",
          unitId: "murasa",
          factionId: "myourenji",
          archetype: "remilia",
        }),
      ]));
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

  test("通常 sub unit の unitId は player status の token に保持される", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        boardUnitCountByPlayer: Map<string, number>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        {
          cell: 24,
          unitType: "vanguard",
          unitId: "meiling",
          starLevel: 1,
          sellValue: 1,
          unitCount: 1,
          subUnit: {
            unitType: "mage",
            unitId: "koakuma",
            starLevel: 1,
            sellValue: 1,
            unitCount: 1,
          },
        },
      ]);
      internals.boardUnitCountByPlayer.set("p1", 1);

      const status = controller.getPlayerStatus("p1");
      expect((status as any).boardSubUnits).toEqual(["24:mage:koakuma"]);
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

  test("subUnitMove slot=sub で board 上の sub-unit 同士を交換できる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [
          createAttachedPlacement(24, "vanguard", "mage"),
          createAttachedPlacement(25, "ranger", "assassin"),
        ],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const moveCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        subUnitMove: { fromCell: 24, toCell: 25, slot: "sub" },
      });

      expect(moveCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("24:vanguard:1:sub");
      expect(status.boardUnits).toContain("25:ranger:1:sub");
      expect((status as any).boardSubUnits).toEqual(["24:assassin", "25:mage"]);
    });
  });

  test("boardUnitMove slot=sub で通常 board unit を別hostのsub slotに入れられる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [
          { cell: 24, unitType: "vanguard", unitId: "meiling", starLevel: 1, sellValue: 1, unitCount: 1 },
          { cell: 25, unitType: "ranger", unitId: "nazrin", starLevel: 1, sellValue: 1, unitCount: 1 },
        ],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const moveCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        boardUnitMove: { fromCell: 24, toCell: 25, slot: "sub" },
      });

      expect(moveCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toEqual(["25:ranger:1:sub"]);
      expect((status as any).boardSubUnits).toEqual(["25:vanguard:meiling"]);
    });
  });

  test("boardUnitMove slot=sub は hero sub-host 済みの host cell を対象にできない", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "ranger" },
        { cell: 25, unitType: "vanguard" },
      ])).toMatchObject({ success: true });
      expect(controller.applyHeroPlacementForPlayer("p1", 25)).toMatchObject({ success: true });

      const moveCommand = controller.submitPrepCommand("p1", 1, 3_100, {
        boardUnitMove: { fromCell: 24, toCell: 25, slot: "sub" },
      });

      expect(moveCommand).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("24:ranger");
      expect(status.boardUnits).toContain("25:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual(["25:hero:okina"]);
    });
  });

  test("boardUnitMove slot omitted で通常 board unit を main board 上で移動できる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const firstCommand = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [
          { cell: 24, unitType: "vanguard", unitId: "meiling", starLevel: 1, sellValue: 1, unitCount: 1 },
        ],
      });
      expect(firstCommand).toEqual({ accepted: true });

      const moveCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        boardUnitMove: { fromCell: 24, toCell: 25 },
      });

      expect(moveCommand).toEqual({ accepted: true });
      expect(controller.getPlayerStatus("p1").boardUnits).toEqual(["25:vanguard"]);
    });
  });

  test("subUnitMove slot=main は occupied cell への detach を拒否する", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      expect(controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [
          createAttachedPlacement(24, "vanguard", "mage"),
          { cell: 25, unitType: "ranger", unitId: "nazrin", starLevel: 1, sellValue: 1, unitCount: 1 },
        ],
      })).toEqual({ accepted: true });

      const moveCommand = controller.submitPrepCommand("p1", 2, 3_100, {
        subUnitMove: { fromCell: 24, toCell: 25, slot: "main" },
      });

      expect(moveCommand).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect((controller.getPlayerStatus("p1") as any).boardSubUnits).toEqual(["24:mage"]);
    });
  });

  test("subUnitSwapBench で bench の unit と入れ替えても inventory が壊れない", () => {
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

      const swapCommand = controller.submitPrepCommand("p1", 1, 3_100, {
        subUnitSwapBench: { cell: 24, benchIndex: 0 },
      });

      expect(swapCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect((status as any).boardSubUnits).toEqual(["24:ranger"]);
      expect(status.benchUnits).toEqual(["mage"]);
      expect(status.benchUnits).not.toContain("ranger");
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

  test("通常主人公は自分のセルを sub-unit の host にできる", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("reimu");

      const internals = controller as unknown as {
        benchUnitsByPlayer: Map<string, Array<{
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          unitId?: string;
          cost: number;
          starLevel: number;
          unitCount: number;
        }>>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "mage", unitId: "koakuma", cost: 1, starLevel: 1, unitCount: 1 },
      ]);

      const heroCell = controller.getHeroPlacementForPlayer("p1");
      expect(heroCell).toBe(30);

      const result = controller.submitPrepCommand("p1", 1, 3_100, {
        benchToBoardCell: {
          benchIndex: 0,
          cell: heroCell ?? -1,
          slot: "sub",
        },
      });

      expect(result).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardSubUnits).toEqual([`${heroCell}:mage:koakuma`]);
      expect(status.benchUnits).toEqual([]);
      expect(controller.getHeroPlacementForPlayer("p1")).toBe(heroCell);
    });
  });

  test("主人公に付けた sub-unit は次の Prep で Bench に戻る", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("reimu");

      const internals = controller as unknown as {
        benchUnitsByPlayer: Map<string, Array<{
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          unitId?: string;
          cost: number;
          starLevel: number;
          unitCount: number;
        }>>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "mage", unitId: "koakuma", cost: 1, starLevel: 1, unitCount: 1 },
      ]);

      const heroCell = controller.getHeroPlacementForPlayer("p1");
      expect(heroCell).toBe(30);

      const attachResult = controller.submitPrepCommand("p1", 1, 3_100, {
        benchToBoardCell: {
          benchIndex: 0,
          cell: heroCell ?? -1,
          slot: "sub",
        },
      });

      expect(attachResult).toEqual({ accepted: true });
      expect(controller.getPlayerStatus("p1").boardSubUnits).toEqual([`${heroCell}:mage:koakuma`]);

      controller.advanceByTime(32_000);
      controller.advanceByTime(42_000);
      controller.advanceByTime(47_000);
      controller.advanceByTime(49_000);

      const status = controller.getPlayerStatus("p1");
      expect(controller.phase).toBe("Prep");
      expect(controller.roundIndex).toBe(2);
      expect(status.boardSubUnits).toEqual([]);
      expect(status.benchUnits).toContain("mage");
      expect(status.benchUnitIds).toContain("koakuma");
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

  test("摩多羅隠岐奈subはsubUnitMove slot=mainで通常盤面へ戻せる", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
      ])).toMatchObject({ success: true });
      expect(controller.applyHeroPlacementForPlayer("p1", 24)).toMatchObject({ success: true });

      const moveCommand = controller.submitPrepCommand("p1", 1, 3_100, {
        subUnitMove: { fromCell: 24, toCell: 25, slot: "main" },
      });

      expect(moveCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(controller.getHeroPlacementForPlayer("p1")).toBe(25);
      expect(status.boardUnits).toContain("24:vanguard");
      expect(status.boardUnits).not.toContain("24:vanguard:1:sub");
      expect((status as any).boardSubUnits).toEqual([]);
    });
  });

  test("摩多羅隠岐奈subはsubUnitMove slot=subで別hostのsub slotへ移せる", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
        { cell: 25, unitType: "ranger" },
      ])).toMatchObject({ success: true });
      expect(controller.applyHeroPlacementForPlayer("p1", 24)).toMatchObject({ success: true });

      const moveCommand = controller.submitPrepCommand("p1", 1, 3_100, {
        subUnitMove: { fromCell: 24, toCell: 25, slot: "sub" },
      });

      expect(moveCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(controller.getHeroPlacementForPlayer("p1")).toBeNull();
      expect(status.boardUnits).toContain("24:vanguard");
      expect(status.boardUnits).toContain("25:ranger:1:sub");
      expect((status as any).boardSubUnits).toEqual(["25:hero:okina"]);
    });
  });

  test("摩多羅隠岐奈はheroPlacementCell経由でもhostと入れ替わらずsubに入る", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
      ])).toMatchObject({ success: true });

      const attachCommand = controller.submitPrepCommand("p1", 1, 3_100, {
        heroPlacementCell: 24,
      } as any);

      expect(attachCommand).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(controller.getHeroPlacementForPlayer("p1")).toBeNull();
      expect(status.boardUnits).toEqual(["24:vanguard:1:sub"]);
      expect((status as any).boardSubUnits).toEqual(["24:hero:okina"]);

      const detachCommand = controller.submitPrepCommand("p1", 2, 3_200, {
        subUnitMove: { fromCell: 24, toCell: 25, slot: "main" },
      });

      expect(detachCommand).toEqual({ accepted: true });

      const detachedStatus = controller.getPlayerStatus("p1");
      expect(controller.getHeroPlacementForPlayer("p1")).toBe(25);
      expect(detachedStatus.boardUnits).toEqual(["24:vanguard"]);
      expect((detachedStatus as any).boardSubUnits).toEqual([]);
    });
  });

  test("摩多羅隠岐奈subはsubUnitMove slot=main で boss 側 row へは戻せない", () => {
    withSubUnitHeroMode(() => {
      const controller = createStartedHeroModeController("okina");

      expect(controller.applyPrepPlacementForPlayer("p1", [
        { cell: 24, unitType: "vanguard" },
      ])).toMatchObject({ success: true });
      expect(controller.applyHeroPlacementForPlayer("p1", 24)).toMatchObject({ success: true });

      const moveCommand = controller.submitPrepCommand("p1", 1, 3_100, {
        subUnitMove: { fromCell: 24, toCell: 5, slot: "main" },
      });

      expect(moveCommand).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(controller.getHeroPlacementForPlayer("p1")).toBeNull();
      expect((controller.getPlayerStatus("p1") as any).boardSubUnits).toEqual(["24:hero:okina"]);
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
