import { describe, expect, it } from "vitest";

import { GameLoopState } from "../../../src/domain/game-loop-state";
import {
  PhaseOrchestrator,
  type PhaseOrchestratorDeps,
} from "../../../src/server/match-room-controller/phase-orchestrator";

type Harness = {
  state: GameLoopState;
  calls: string[];
  orchestrator: PhaseOrchestrator;
};

function createHarness(options?: {
  enablePhaseExpansion?: boolean;
  shouldEndAfterElimination?: boolean;
}): Harness {
  const state = new GameLoopState(["p1", "p2"]);
  const calls: string[] = [];
  const deps: PhaseOrchestratorDeps = {
    getState: () => state,
    isRaidMode: () => false,
    enablePhaseExpansion: options?.enablePhaseExpansion ?? false,
    prepDurationMs: 30_000,
    battleDurationMs: 10_000,
    settleDurationMs: 5_000,
    eliminationDurationMs: 2_000,
    resolvePhaseHpTarget: (roundIndex) => 500 + roundIndex * 100,
    onPrepToBattle: () => calls.push("prep->battle"),
    onBattleToSettle: () => calls.push("battle->settle"),
    onBeforeSettleToElimination: () => calls.push("before-settle->elimination"),
    onAfterSettleToElimination: (aliveBeforeElimination) =>
      calls.push(`settle->elimination:${Array.from(aliveBeforeElimination).join(",")}`),
    onEliminationToPrep: () => calls.push("elimination->prep"),
    shouldEndAfterElimination: () => options?.shouldEndAfterElimination ?? false,
    logRoundTransition: (phase, roundIndex) => calls.push(`log:${phase}:${roundIndex}`),
  };

  return {
    state,
    calls,
    orchestrator: new PhaseOrchestrator(deps),
  };
}

describe("PhaseOrchestrator", () => {
  it("starts the prep window and advances to battle when the prep deadline elapses", () => {
    const { state, calls, orchestrator } = createHarness();

    orchestrator.startPrepRound(1_000);

    expect(orchestrator.getPrepDeadlineAtMs()).toBe(31_000);
    expect(orchestrator.advanceByTime(30_999)).toBe(false);
    expect(orchestrator.advanceByTime(31_000)).toBe(true);
    expect(state.phase).toBe("Battle");
    expect(orchestrator.getBattleDeadlineAtMs()).toBe(41_000);
    expect(calls).toEqual(["prep->battle", "log:Battle:1"]);
  });

  it("advances through elimination back to prep and resets phase progress for the next round", () => {
    const { state, calls, orchestrator } = createHarness();

    orchestrator.startPrepRound(1_000);
    orchestrator.advanceByTime(31_000);
    orchestrator.recordPhaseProgress(1, 999);
    orchestrator.advanceByTime(41_000);
    orchestrator.advanceByTime(46_000);
    const advanced = orchestrator.advanceByTime(48_000);

    expect(advanced).toBe(true);
    expect(state.phase).toBe("Prep");
    expect(state.roundIndex).toBe(2);
    expect(orchestrator.getPrepDeadlineAtMs()).toBe(78_000);
    expect(orchestrator.getPhaseProgress()).toEqual({
      targetHp: 700,
      damageDealt: 0,
      result: "pending",
      completionRate: 0,
    });
    expect(calls).toEqual([
      "prep->battle",
      "log:Battle:1",
      "battle->settle",
      "log:Settle:1",
      "before-settle->elimination",
      "settle->elimination:p1,p2",
      "log:Elimination:1",
      "elimination->prep",
      "log:Prep:2",
    ]);
  });

  it("transitions to end and clears deadlines when elimination should finish the match", () => {
    const { state, calls, orchestrator } = createHarness({
      shouldEndAfterElimination: true,
    });

    orchestrator.startPrepRound(1_000);
    orchestrator.advanceByTime(31_000);
    orchestrator.advanceByTime(41_000);
    orchestrator.advanceByTime(46_000);

    expect(orchestrator.advanceByTime(48_000)).toBe(true);
    expect(state.phase).toBe("End");
    expect(orchestrator.getPrepDeadlineAtMs()).toBeNull();
    expect(orchestrator.getBattleDeadlineAtMs()).toBeNull();
    expect(orchestrator.getSettleDeadlineAtMs()).toBeNull();
    expect(orchestrator.getEliminationDeadlineAtMs()).toBeNull();
    expect(calls).toEqual([
      "prep->battle",
      "log:Battle:1",
      "battle->settle",
      "log:Settle:1",
      "before-settle->elimination",
      "settle->elimination:p1,p2",
      "log:Elimination:1",
    ]);
  });
});
