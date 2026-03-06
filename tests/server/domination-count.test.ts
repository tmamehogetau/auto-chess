import { describe, expect, test } from "vitest";

import { GameLoopState } from "../../src/domain/game-loop-state";
import { MatchRoomController } from "../../src/server/match-room-controller";

const controllerOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 30_000,
  battleDurationMs: 10_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
  featureFlags: {
    enablePhaseExpansion: true,
  },
};

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

function getPhaseTarget(roundIndex: number): number {
  const targets: Record<number, number> = {
    1: 600,
    2: 750,
    3: 900,
    4: 1050,
    5: 1250,
    6: 1450,
    7: 1650,
    8: 1850,
    9: 2100,
    10: 2400,
    11: 2700,
    12: 0,
  };

  return targets[roundIndex] ?? 0;
}

function advanceOneRound(
  controller: MatchRoomController,
  nowMs: number,
  damageByPlayer: Record<string, number>,
): number {
  controller.advanceByTime(nowMs + 30_000);
  expect(controller.phase).toBe("Battle");
  controller.setPendingRoundDamage(damageByPlayer);
  controller.advanceByTime(nowMs + 40_000);
  expect(controller.phase).toBe("Settle");
  controller.advanceByTime(nowMs + 45_000);
  expect(controller.phase).toBe("Elimination");
  controller.advanceByTime(nowMs + 47_000);

  return nowMs + 47_000;
}

describe("Domination Count", () => {
  test("初期値は0", () => {
    const controller = createStartedController();

    expect(controller.getDominationCount()).toBe(0);
  });

  test("GameLoopStateの初期値も0", () => {
    const state = new GameLoopState(["p1", "p2"]);

    expect(state.dominationCount).toBe(0);
  });

  test("ボス優勢時にインクリメントされる", () => {
    const controller = createStartedController();

    advanceOneRound(controller, 2_000, {});

    expect(controller.getDominationCount()).toBe(1);
    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(2);
  });

  test("レイド成功時はインクリメントされない", () => {
    const controller = createStartedController();

    advanceOneRound(controller, 2_000, { p1: getPhaseTarget(1) });

    expect(controller.getDominationCount()).toBe(0);
    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(2);
  });

  test("5到達でボス勝利になる", () => {
    const controller = createStartedController();
    let nowMs = 2_000;

    for (let index = 0; index < 4; index += 1) {
      nowMs = advanceOneRound(controller, nowMs, {});
      expect(controller.phase).toBe("Prep");
      expect(controller.getDominationCount()).toBe(index + 1);
    }

    advanceOneRound(controller, nowMs, {});

    expect(controller.getDominationCount()).toBe(5);
    expect(controller.phase).toBe("End");
  });

  test("R12ではカウントが進まない", () => {
    const controller = createStartedController();
    let nowMs = 2_000;

    for (let index = 0; index < 4; index += 1) {
      nowMs = advanceOneRound(controller, nowMs, {});
    }

    expect(controller.getDominationCount()).toBe(4);

    for (let roundIndex = 5; roundIndex <= 11; roundIndex += 1) {
      nowMs = advanceOneRound(controller, nowMs, { p1: getPhaseTarget(roundIndex) });
    }

    expect(controller.roundIndex).toBe(12);
    expect(controller.getDominationCount()).toBe(4);

    controller.advanceByTime(nowMs + 30_000);
    expect(controller.phase).toBe("Battle");
    controller.setPendingRoundDamage({});
    controller.advanceByTime(nowMs + 40_000);
    expect(controller.getDominationCount()).toBe(4);
    controller.advanceByTime(nowMs + 45_000);
    controller.advanceByTime(nowMs + 47_000);

    expect(controller.phase).toBe("End");
    expect(controller.getDominationCount()).toBe(4);
  });
});
