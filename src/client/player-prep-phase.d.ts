export function resolvePlayerFacingPhase(
  state?: {
    phase?: string;
    lobbyStage?: string;
    playerPhase?: string;
    prepDeadlineAtMs?: number;
    selectionDeadlineAtMs?: number;
    phaseDeadlineAtMs?: number;
    playerPhaseDeadlineAtMs?: number;
  } | null,
  roundState?: {
    playerPhase?: string;
    phaseDeadlineAtMs?: number;
    playerPhaseDeadlineAtMs?: number;
  } | null,
  nowMs?: number,
): string;

export function formatDeadlineCountdown(deadlineAtMs: number, nowMs?: number): string;

export function buildDeadlineSummary(
  state?: {
    phase?: string;
    lobbyStage?: string;
    playerPhase?: string;
    prepDeadlineAtMs?: number;
    selectionDeadlineAtMs?: number;
    phaseDeadlineAtMs?: number;
    playerPhaseDeadlineAtMs?: number;
  } | null,
  roundState?: {
    playerPhase?: string;
    phaseDeadlineAtMs?: number;
    playerPhaseDeadlineAtMs?: number;
  } | null,
  nowMs?: number,
): {
  label: string;
  valueText: string;
};

export function canUseShopAction(input: {
  currentPhase?: string;
  playerFacingPhase?: string;
  isReady?: boolean;
}): boolean;

export function canUseBoardAction(input: {
  currentPhase?: string;
  playerFacingPhase?: string;
  isReady?: boolean;
}): boolean;

export function canUseBenchAction(input: {
  currentPhase?: string;
  playerFacingPhase?: string;
  isReady?: boolean;
}): boolean;
