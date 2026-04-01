import { describe, expect, test } from "vitest";

import {
  buildDeadlineSummary,
  canUseBenchAction,
  canUseBoardAction,
  canUseShopAction,
  formatDeadlineCountdown,
  resolvePlayerFacingPhase,
} from "../../src/client/player-prep-phase.js";

describe("player prep phase helpers", () => {
  test("resolvePlayerFacingPhase prefers synced state over stale round state", () => {
    expect(resolvePlayerFacingPhase(
      { playerPhase: "purchase", phase: "Prep" },
      { playerPhase: "deploy" },
    )).toBe("purchase");
  });

  test("resolvePlayerFacingPhase keeps explicit purchase until server sync advances it", () => {
    expect(resolvePlayerFacingPhase(
      {
        phase: "Prep",
        playerPhase: "purchase",
        prepDeadlineAtMs: 30_000,
        playerPhaseDeadlineAtMs: 20_000,
      },
      null,
      25_000,
    )).toBe("purchase");
  });

  test("buildDeadlineSummary uses player-facing deadline during prep splits", () => {
    expect(buildDeadlineSummary(
      {
        phase: "Prep",
        playerPhase: "deploy",
        playerPhaseDeadlineAtMs: 35_000,
      },
      null,
      30_000,
    )).toEqual({
      label: "Deploy",
      valueText: "5s",
    });
  });

  test("buildDeadlineSummary keeps active countdown at one second until battle sync lands", () => {
    expect(buildDeadlineSummary(
      {
        phase: "Battle",
        playerPhase: "battle",
        phaseDeadlineAtMs: 10_000,
      },
      null,
      10_050,
    )).toEqual({
      label: "Battle",
      valueText: "1s",
    });
  });

  test("buildDeadlineSummary labels Settle as a result countdown", () => {
    expect(buildDeadlineSummary(
      {
        phase: "Settle",
        phaseDeadlineAtMs: 14_000,
      },
      null,
      10_000,
    )).toEqual({
      label: "Result",
      valueText: "4s",
    });
  });

  test("buildDeadlineSummary shows final battle as timeout-free when no deadline is synced", () => {
    expect(buildDeadlineSummary(
      {
        phase: "Battle",
        playerPhase: "battle",
      },
      null,
      10_000,
    )).toEqual({
      label: "Final Battle",
      valueText: "until resolution",
    });
  });

  test("resolvePlayerFacingPhase treats End as a result-facing phase", () => {
    expect(resolvePlayerFacingPhase(
      {
        phase: "End",
        playerPhase: "result",
      },
      null,
      10_000,
    )).toBe("result");
  });

  test("resolvePlayerFacingPhase prefers raw End over stale battle-facing sync", () => {
    expect(resolvePlayerFacingPhase(
      {
        phase: "End",
        playerPhase: "battle",
      },
      {
        playerPhase: "battle",
      },
      10_000,
    )).toBe("result");
  });

  test("buildDeadlineSummary shows final judgment once the match ends", () => {
    expect(buildDeadlineSummary(
      {
        phase: "End",
        playerPhase: "result",
      },
      null,
      10_000,
    )).toEqual({
      label: "Final Judgment",
      valueText: "complete",
    });
  });

  test("formatDeadlineCountdown clamps expired deadlines to zero", () => {
    expect(formatDeadlineCountdown(10_000, 12_000)).toBe("0s");
  });

  test("shop actions are allowed only during purchase while unlocked", () => {
    expect(canUseShopAction({ currentPhase: "Prep", playerFacingPhase: "purchase", isReady: false })).toBe(true);
    expect(canUseShopAction({ currentPhase: "Prep", playerFacingPhase: "deploy", isReady: false })).toBe(false);
    expect(canUseShopAction({ currentPhase: "Prep", playerFacingPhase: "purchase", isReady: true })).toBe(false);
  });

  test("board actions are allowed only during deploy while unlocked", () => {
    expect(canUseBoardAction({ currentPhase: "Prep", playerFacingPhase: "deploy", isReady: false })).toBe(true);
    expect(canUseBoardAction({ currentPhase: "Prep", playerFacingPhase: "purchase", isReady: false })).toBe(false);
    expect(canUseBoardAction({ currentPhase: "Prep", playerFacingPhase: "deploy", isReady: true })).toBe(false);
  });

  test("bench actions lock after Ready even during prep", () => {
    expect(canUseBenchAction({ currentPhase: "Prep", playerFacingPhase: "purchase", isReady: false })).toBe(true);
    expect(canUseBenchAction({ currentPhase: "Prep", playerFacingPhase: "deploy", isReady: false })).toBe(true);
    expect(canUseBenchAction({ currentPhase: "Prep", playerFacingPhase: "deploy", isReady: true })).toBe(false);
  });
});
