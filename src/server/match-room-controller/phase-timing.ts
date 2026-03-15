export interface PhaseTimingUpdate {
  prepDeadlineAtMs: number | null;
  battleDeadlineAtMs: number | null;
  settleDeadlineAtMs: number | null;
  eliminationDeadlineAtMs: number | null;
}

const EMPTY_PHASE_TIMING: PhaseTimingUpdate = {
  prepDeadlineAtMs: null,
  battleDeadlineAtMs: null,
  settleDeadlineAtMs: null,
  eliminationDeadlineAtMs: null,
};

export function hasDeadlineElapsed(
  deadlineAtMs: number | null,
  nowMs: number,
): boolean {
  return deadlineAtMs !== null && nowMs >= deadlineAtMs;
}

export function beginBattlePhaseWindow(
  nowMs: number,
  battleDurationMs: number,
): PhaseTimingUpdate {
  return {
    ...EMPTY_PHASE_TIMING,
    battleDeadlineAtMs: nowMs + battleDurationMs,
  };
}

export function beginSettlePhaseWindow(
  nowMs: number,
  settleDurationMs: number,
): PhaseTimingUpdate {
  return {
    ...EMPTY_PHASE_TIMING,
    settleDeadlineAtMs: nowMs + settleDurationMs,
  };
}

export function beginEliminationPhaseWindow(
  nowMs: number,
  eliminationDurationMs: number,
): PhaseTimingUpdate {
  return {
    ...EMPTY_PHASE_TIMING,
    eliminationDeadlineAtMs: nowMs + eliminationDurationMs,
  };
}

export function beginPrepPhaseWindow(
  nowMs: number,
  prepDurationMs: number,
): PhaseTimingUpdate {
  return {
    ...EMPTY_PHASE_TIMING,
    prepDeadlineAtMs: nowMs + prepDurationMs,
  };
}

export function clearPhaseTiming(): PhaseTimingUpdate {
  return {
    ...EMPTY_PHASE_TIMING,
  };
}
