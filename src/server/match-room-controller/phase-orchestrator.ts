import type { GameLoopState } from "../../domain/game-loop-state";
import {
  beginBattlePhaseWindow,
  beginEliminationPhaseWindow,
  beginPrepPhaseWindow,
  beginSettlePhaseWindow,
  clearPhaseTiming,
  hasDeadlineElapsed,
} from "./phase-timing";

export type PhaseResult = "pending" | "success" | "failed";

export interface PhaseProgressSnapshot {
  targetHp: number;
  damageDealt: number;
  result: PhaseResult;
  completionRate: number;
}

export interface PhaseOrchestratorDeps {
  getState(): GameLoopState | null;
  isRaidMode(): boolean;
  enablePhaseExpansion: boolean;
  prepDurationMs: number;
  battleDurationMs: number;
  settleDurationMs: number;
  eliminationDurationMs: number;
  resolvePhaseHpTarget(roundIndex: number): number;
  onPrepToBattle(nowMs: number): void;
  onBattleToSettle(): void;
  onBeforeSettleToElimination(): void;
  onAfterSettleToElimination(aliveBeforeElimination: Set<string>): void;
  onEliminationToPrep(): void;
  shouldEndAfterElimination(maxRounds: number): boolean;
  resolveBattleDeadlineAtMs?(nowMs: number, roundIndex: number): number | null;
  shouldAdvanceBattlePhase?(input: {
    nowMs: number;
    roundIndex: number;
    battleDeadlineAtMs: number | null;
  }): boolean;
  logRoundTransition?(
    phase: "Prep" | "Battle" | "Settle" | "Elimination",
    roundIndex: number,
    nowMs: number,
  ): void;
}

export class PhaseOrchestrator {
  private prepDeadlineAtMs: number | null = null;
  private battleDeadlineAtMs: number | null = null;
  private settleDeadlineAtMs: number | null = null;
  private eliminationDeadlineAtMs: number | null = null;
  private phaseProgress: PhaseProgressSnapshot = {
    targetHp: 0,
    damageDealt: 0,
    result: "pending",
    completionRate: 0,
  };

  public constructor(
    private readonly deps: PhaseOrchestratorDeps,
  ) {}

  public getPrepDeadlineAtMs(): number | null {
    return this.prepDeadlineAtMs;
  }

  public getBattleDeadlineAtMs(): number | null {
    return this.battleDeadlineAtMs;
  }

  public getSettleDeadlineAtMs(): number | null {
    return this.settleDeadlineAtMs;
  }

  public getEliminationDeadlineAtMs(): number | null {
    return this.eliminationDeadlineAtMs;
  }

  public getPhaseProgress(): PhaseProgressSnapshot {
    return { ...this.phaseProgress };
  }

  public startPrepRound(nowMs: number): void {
    const state = this.deps.getState();
    if (!state) {
      return;
    }

    this.resetPhaseProgressForRound(state.roundIndex);
    const update = beginPrepPhaseWindow(nowMs, this.deps.prepDurationMs);
    this.prepDeadlineAtMs = update.prepDeadlineAtMs;
    this.battleDeadlineAtMs = update.battleDeadlineAtMs;
    this.settleDeadlineAtMs = update.settleDeadlineAtMs;
    this.eliminationDeadlineAtMs = update.eliminationDeadlineAtMs;
  }

  public resetPhaseProgressForRound(roundIndex: number): void {
    this.phaseProgress = {
      targetHp: this.deps.resolvePhaseHpTarget(roundIndex),
      damageDealt: 0,
      result: "pending",
      completionRate: 0,
    };
  }

  public recordPhaseProgress(roundIndex: number, damageDealt: number): PhaseProgressSnapshot {
    const targetHp = this.deps.resolvePhaseHpTarget(roundIndex);
    this.phaseProgress = {
      targetHp,
      damageDealt,
      result: damageDealt >= targetHp ? "success" : "failed",
      completionRate: targetHp > 0 ? damageDealt / targetHp : 0,
    };
    return this.getPhaseProgress();
  }

  public advanceByTime(nowMs: number): boolean {
    const state = this.deps.getState();
    if (!state) {
      return false;
    }

    switch (state.phase) {
      case "Prep":
        return this.advancePrepPhase(state, nowMs);
      case "Battle":
        return this.advanceBattlePhase(state, nowMs);
      case "Settle":
        return this.advanceSettlePhase(state, nowMs);
      case "Elimination":
        return this.advanceEliminationPhase(state, nowMs);
      case "End":
        return false;
      default:
        return false;
    }
  }

  private advancePrepPhase(state: GameLoopState, nowMs: number): boolean {
    if (!hasDeadlineElapsed(this.prepDeadlineAtMs, nowMs)) {
      return false;
    }

    this.deps.onPrepToBattle(nowMs);
    state.transitionTo("Battle");
    const battleDeadlineAtMs = this.deps.resolveBattleDeadlineAtMs?.(nowMs, state.roundIndex)
      ?? beginBattlePhaseWindow(nowMs, this.deps.battleDurationMs).battleDeadlineAtMs;
    const update = clearPhaseTiming();
    this.prepDeadlineAtMs = update.prepDeadlineAtMs;
    this.battleDeadlineAtMs = battleDeadlineAtMs;
    this.settleDeadlineAtMs = update.settleDeadlineAtMs;
    this.eliminationDeadlineAtMs = update.eliminationDeadlineAtMs;
    this.deps.logRoundTransition?.("Battle", state.roundIndex, nowMs);
    return true;
  }

  private advanceBattlePhase(state: GameLoopState, nowMs: number): boolean {
    const shouldAdvance = this.deps.shouldAdvanceBattlePhase?.({
      nowMs,
      roundIndex: state.roundIndex,
      battleDeadlineAtMs: this.battleDeadlineAtMs,
    }) ?? hasDeadlineElapsed(this.battleDeadlineAtMs, nowMs);

    if (!shouldAdvance) {
      return false;
    }

    this.deps.onBattleToSettle();
    state.transitionTo("Settle");
    const update = beginSettlePhaseWindow(nowMs, this.deps.settleDurationMs);
    this.prepDeadlineAtMs = update.prepDeadlineAtMs;
    this.battleDeadlineAtMs = update.battleDeadlineAtMs;
    this.settleDeadlineAtMs = update.settleDeadlineAtMs;
    this.eliminationDeadlineAtMs = update.eliminationDeadlineAtMs;
    this.deps.logRoundTransition?.("Settle", state.roundIndex, nowMs);
    return true;
  }

  private advanceSettlePhase(state: GameLoopState, nowMs: number): boolean {
    if (!hasDeadlineElapsed(this.settleDeadlineAtMs, nowMs)) {
      return false;
    }

    const aliveBeforeElimination = new Set(state.alivePlayerIds);
    this.deps.onBeforeSettleToElimination();
    state.transitionTo("Elimination");
    this.deps.onAfterSettleToElimination(aliveBeforeElimination);
    const update = beginEliminationPhaseWindow(nowMs, this.deps.eliminationDurationMs);
    this.prepDeadlineAtMs = update.prepDeadlineAtMs;
    this.battleDeadlineAtMs = update.battleDeadlineAtMs;
    this.settleDeadlineAtMs = update.settleDeadlineAtMs;
    this.eliminationDeadlineAtMs = update.eliminationDeadlineAtMs;
    this.deps.logRoundTransition?.("Elimination", state.roundIndex, nowMs);
    return true;
  }

  private advanceEliminationPhase(state: GameLoopState, nowMs: number): boolean {
    if (!hasDeadlineElapsed(this.eliminationDeadlineAtMs, nowMs)) {
      return false;
    }

    this.eliminationDeadlineAtMs = null;

    if (this.deps.shouldEndAfterElimination(this.resolveMaxRounds())) {
      state.transitionTo("End");
      const update = clearPhaseTiming();
      this.prepDeadlineAtMs = update.prepDeadlineAtMs;
      this.battleDeadlineAtMs = update.battleDeadlineAtMs;
      this.settleDeadlineAtMs = update.settleDeadlineAtMs;
      this.eliminationDeadlineAtMs = update.eliminationDeadlineAtMs;
      return true;
    }

    this.deps.onEliminationToPrep();
    state.transitionTo("Prep");
    this.resetPhaseProgressForRound(state.roundIndex);
    const update = beginPrepPhaseWindow(nowMs, this.deps.prepDurationMs);
    this.prepDeadlineAtMs = update.prepDeadlineAtMs;
    this.battleDeadlineAtMs = update.battleDeadlineAtMs;
    this.settleDeadlineAtMs = update.settleDeadlineAtMs;
    this.eliminationDeadlineAtMs = update.eliminationDeadlineAtMs;
    this.deps.logRoundTransition?.("Prep", state.roundIndex, nowMs);
    return true;
  }

  private resolveMaxRounds(): number {
    return this.deps.isRaidMode() || this.deps.enablePhaseExpansion ? 12 : 8;
  }
}
