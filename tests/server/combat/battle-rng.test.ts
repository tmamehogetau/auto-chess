import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createDefaultBattleRng,
  createSeededBattleRng,
} from "../../../src/server/combat/battle-rng";

describe("battle-rng", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("same seed returns the same float sequence", () => {
    const left = createSeededBattleRng(12345);
    const right = createSeededBattleRng(12345);

    expect([
      left.nextFloat(),
      left.nextFloat(),
      left.nextFloat(),
    ]).toEqual([
      right.nextFloat(),
      right.nextFloat(),
      right.nextFloat(),
    ]);
  });

  test("different seeds return different float sequences", () => {
    const left = createSeededBattleRng(12345);
    const right = createSeededBattleRng(67890);

    expect([
      left.nextFloat(),
      left.nextFloat(),
      left.nextFloat(),
    ]).not.toEqual([
      right.nextFloat(),
      right.nextFloat(),
      right.nextFloat(),
    ]);
  });

  test("default battle rng delegates to Math.random", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1234);
    const rng = createDefaultBattleRng();

    expect(rng.nextFloat()).toBe(0.1234);
    expect(randomSpy).toHaveBeenCalledTimes(1);
  });
});
