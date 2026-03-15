import { describe, expect, it } from "vitest";

import {
  beginBattlePhaseWindow,
  beginEliminationPhaseWindow,
  beginPrepPhaseWindow,
  beginSettlePhaseWindow,
  clearPhaseTiming,
  hasDeadlineElapsed,
} from "../../../src/server/match-room-controller/phase-timing";

describe("phase-timing", () => {
  it("detects elapsed deadlines only when a deadline exists", () => {
    expect(hasDeadlineElapsed(null, 1000)).toBe(false);
    expect(hasDeadlineElapsed(1001, 1000)).toBe(false);
    expect(hasDeadlineElapsed(1000, 1000)).toBe(true);
  });

  it("creates a prep phase window without leaking other deadlines", () => {
    expect(beginPrepPhaseWindow(1_000, 25_000)).toEqual({
      prepDeadlineAtMs: 26_000,
      battleDeadlineAtMs: null,
      settleDeadlineAtMs: null,
      eliminationDeadlineAtMs: null,
    });
  });

  it("creates battle, settle, and elimination windows with isolated deadlines", () => {
    expect(beginBattlePhaseWindow(2_000, 30_000)).toEqual({
      prepDeadlineAtMs: null,
      battleDeadlineAtMs: 32_000,
      settleDeadlineAtMs: null,
      eliminationDeadlineAtMs: null,
    });
    expect(beginSettlePhaseWindow(3_000, 5_000)).toEqual({
      prepDeadlineAtMs: null,
      battleDeadlineAtMs: null,
      settleDeadlineAtMs: 8_000,
      eliminationDeadlineAtMs: null,
    });
    expect(beginEliminationPhaseWindow(4_000, 6_000)).toEqual({
      prepDeadlineAtMs: null,
      battleDeadlineAtMs: null,
      settleDeadlineAtMs: null,
      eliminationDeadlineAtMs: 10_000,
    });
  });

  it("clears every phase deadline", () => {
    expect(clearPhaseTiming()).toEqual({
      prepDeadlineAtMs: null,
      battleDeadlineAtMs: null,
      settleDeadlineAtMs: null,
      eliminationDeadlineAtMs: null,
    });
  });
});
