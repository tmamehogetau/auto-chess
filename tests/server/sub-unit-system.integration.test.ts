import { describe, expect, test } from "vitest";

import { FeatureFlagService } from "../../src/server/feature-flag-service";
import { MatchRoomController } from "../../src/server/match-room-controller";

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

describe("Sub Unit System Integration", () => {
  test("enableSubUnitSystem ON時は対応fixed pairだけがsub-unit有効トークンになる", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const commandResult = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard", unitId: "warrior_a", starLevel: 1 }],
      });

      expect(commandResult).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("0:vanguard:1:sub");
    });
  });

  test("enableSubUnitSystem ONでも非対応unitIdは従来トークンのまま", () => {
    withSubUnitFlag(true, () => {
      const controller = createStartedController();

      const commandResult = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard", unitId: "warrior_b", starLevel: 1 }],
      });

      expect(commandResult).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("p1");
      expect(status.boardUnits).toContain("0:vanguard");
      expect(status.boardUnits.some((unit) => unit.includes(":sub"))).toBe(false);
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
    });
  });
});
