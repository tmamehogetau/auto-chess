import { describe, expect, test } from "vitest";

import { scaleBattleTimeline } from "../../../src/server/combat/battle-timeline-scale";

describe("scaleBattleTimeline", () => {
  test("scales atMs without changing non-time payload", () => {
    const timeline = [
      { type: "battleStart", battleId: "battle-1", round: 1, atMs: 0, units: [] },
      { type: "damageApplied", battleId: "battle-1", atMs: 250, sourceBattleUnitId: "a", targetBattleUnitId: "b", amount: 12, remainingHp: 88 },
      { type: "unitDeath", battleId: "battle-1", atMs: 1000, battleUnitId: "b" },
    ];

    expect(scaleBattleTimeline(timeline, 0.1)).toEqual([
      { type: "battleStart", battleId: "battle-1", round: 1, atMs: 0, units: [] },
      { type: "damageApplied", battleId: "battle-1", atMs: 25, sourceBattleUnitId: "a", targetBattleUnitId: "b", amount: 12, remainingHp: 88 },
      { type: "unitDeath", battleId: "battle-1", atMs: 100, battleUnitId: "b" },
    ]);
  });
});
