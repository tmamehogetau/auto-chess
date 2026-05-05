import { describe, expect, test } from "vitest";

import { resolveDeterministicBattleSeed } from "../../../src/server/match-room-controller/battle-seed";

describe("resolveDeterministicBattleSeed", () => {
  test("returns stable battle-specific seeds when a base seed is configured", () => {
    const input = {
      battleId: "r12-boss-raid",
      roundIndex: 12,
      battleIndex: 0,
    };

    expect(resolveDeterministicBattleSeed(20260504, input))
      .toBe(resolveDeterministicBattleSeed(20260504, input));
    expect(resolveDeterministicBattleSeed(20260504, { ...input, battleIndex: 1 }))
      .not.toBe(resolveDeterministicBattleSeed(20260504, input));
  });

  test("stays disabled when no finite base seed is configured", () => {
    const input = {
      battleId: "r12-boss-raid",
      roundIndex: 12,
      battleIndex: 0,
    };

    expect(resolveDeterministicBattleSeed(undefined, input)).toBeUndefined();
    expect(resolveDeterministicBattleSeed(Number.NaN, input)).toBeUndefined();
  });
});
