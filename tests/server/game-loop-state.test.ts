import { describe, expect, test } from "vitest";

import { GameLoopState } from "../../src/domain/game-loop-state";

describe("GameLoopState", () => {
  test("boss1 raid3 roles are stable after assignment", () => {
    const loop = new GameLoopState(["p1", "p2", "p3", "p4"]);

    loop.setBossPlayer("p2");

    expect(loop.bossPlayerId).toBe("p2");
    expect(loop.raidPlayerIds).toEqual(["p1", "p3", "p4"]);
    expect(loop.isBoss("p2")).toBe(true);
  });
});
