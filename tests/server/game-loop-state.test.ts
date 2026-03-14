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

  test("setBossPlayer initializes raid lives and allows reassignment", () => {
    const loop = new GameLoopState(["p1", "p2", "p3", "p4"]);

    loop.setBossPlayer("p2");
    loop.setBossPlayer("p4");

    expect(loop.bossPlayerId).toBe("p4");
    expect(loop.raidPlayerIds).toEqual(["p1", "p2", "p3"]);
    expect(loop.getRemainingLives("p4")).toBe(0);
    expect(loop.getRemainingLives("p1")).toBe(3);
    expect(loop.isBoss("p4")).toBe(true);
    expect(loop.isBoss("p2")).toBe(false);
  });

  test("setBossPlayer rejects unknown players", () => {
    const loop = new GameLoopState(["p1", "p2", "p3", "p4"]);

    expect(() => loop.setBossPlayer("missing")).toThrow("Unknown player: missing");
    expect(loop.bossPlayerId).toBeNull();
    expect(loop.raidPlayerIds).toEqual(["p1", "p2", "p3", "p4"]);
  });

  test("consumeLife does not eliminate before elimination phase transition", () => {
    const loop = new GameLoopState(["p1", "p2", "p3", "p4"]);

    loop.setBossPlayer("p2");
    loop.consumeLife("p1", 3);

    expect(loop.getRemainingLives("p1")).toBe(0);
    expect(loop.isPlayerEliminated("p1")).toBe(false);
    expect(loop.alivePlayerIds).toContain("p1");
  });
});
