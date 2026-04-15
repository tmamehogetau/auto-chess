export interface GameRoomTimingOptions {
  readyAutoStartMs: number;
  prepDurationMs: number;
  battleDurationMs: number;
  settleDurationMs: number;
  eliminationDurationMs: number;
  selectionTimeoutMs: number;
  battleTimelineTimeScale: number;
}

export const DEFAULT_GAME_ROOM_OPTIONS: GameRoomTimingOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 45_000,
  battleDurationMs: 40_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
  selectionTimeoutMs: 30_000,
  battleTimelineTimeScale: 1,
};

function scaleDuration(durationMs: number, timeScale: number): number {
  return Math.max(1, Math.round(durationMs * timeScale));
}

export function createFastParityGameRoomOptions(input: {
  timeScale: number;
}): GameRoomTimingOptions {
  const { timeScale } = input;

  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new Error(`timeScale must be a positive finite number: ${String(timeScale)}`);
  }

  return {
    readyAutoStartMs: scaleDuration(DEFAULT_GAME_ROOM_OPTIONS.readyAutoStartMs, timeScale),
    prepDurationMs: scaleDuration(DEFAULT_GAME_ROOM_OPTIONS.prepDurationMs, timeScale),
    battleDurationMs: scaleDuration(DEFAULT_GAME_ROOM_OPTIONS.battleDurationMs, timeScale),
    settleDurationMs: scaleDuration(DEFAULT_GAME_ROOM_OPTIONS.settleDurationMs, timeScale),
    eliminationDurationMs: scaleDuration(DEFAULT_GAME_ROOM_OPTIONS.eliminationDurationMs, timeScale),
    selectionTimeoutMs: scaleDuration(DEFAULT_GAME_ROOM_OPTIONS.selectionTimeoutMs, timeScale),
    battleTimelineTimeScale: timeScale,
  };
}
