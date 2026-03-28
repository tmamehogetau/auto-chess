import { MatchRoomController } from "../../src/server/match-room-controller";

export type MatchRoomControllerOptions = ConstructorParameters<typeof MatchRoomController>[2];

export const DEFAULT_PLAYER_IDS = ["p1", "p2", "p3", "p4"] as const;

export const DEFAULT_CONTROLLER_OPTIONS: MatchRoomControllerOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 30_000,
  battleDurationMs: 10_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
};

export function createMatchRoomController(params: {
  playerIds?: readonly string[];
  createdAtMs?: number;
  options?: Partial<MatchRoomControllerOptions>;
} = {}): MatchRoomController {
  const {
    playerIds = DEFAULT_PLAYER_IDS,
    createdAtMs = 1_000,
    options = {},
  } = params;

  return new MatchRoomController(
    [...playerIds],
    createdAtMs,
    {
      ...DEFAULT_CONTROLLER_OPTIONS,
      ...options,
    },
  );
}

export function createStartedMatchRoomController(params: {
  playerIds?: readonly string[];
  createdAtMs?: number;
  startAtMs?: number;
  options?: Partial<MatchRoomControllerOptions>;
} = {}): MatchRoomController {
  const createdAtMs = params.createdAtMs ?? 1_000;
  const controller = createMatchRoomController(
    {
      createdAtMs,
      ...(params.playerIds ? { playerIds: params.playerIds } : {}),
      ...(params.options ? { options: params.options } : {}),
    },
  );

  for (const playerId of params.playerIds ?? DEFAULT_PLAYER_IDS) {
    controller.setReady(playerId, true);
  }

  controller.startIfReady(params.startAtMs ?? createdAtMs + 1_000);
  return controller;
}
