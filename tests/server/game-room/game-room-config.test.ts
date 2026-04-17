import { describe, expect, test } from "vitest";

import {
  DEFAULT_GAME_ROOM_OPTIONS,
  createFastParityGameRoomOptions,
} from "../../../src/server/rooms/game-room-config";

describe("game room fast parity config", () => {
  test("fast parity timings are derived from production defaults with one shared scale", () => {
    const options = createFastParityGameRoomOptions({ timeScale: 0.005 });

    expect(options).toMatchObject({
      readyAutoStartMs: Math.max(1, Math.round(DEFAULT_GAME_ROOM_OPTIONS.readyAutoStartMs * 0.005)),
      prepDurationMs: Math.max(1, Math.round(DEFAULT_GAME_ROOM_OPTIONS.prepDurationMs * 0.005)),
      battleDurationMs: Math.max(1, Math.round(DEFAULT_GAME_ROOM_OPTIONS.battleDurationMs * 0.005)),
      settleDurationMs: Math.max(1, Math.round(DEFAULT_GAME_ROOM_OPTIONS.settleDurationMs * 0.005)),
      eliminationDurationMs: Math.max(1, Math.round(DEFAULT_GAME_ROOM_OPTIONS.eliminationDurationMs * 0.005)),
      selectionTimeoutMs: Math.max(1, Math.round(DEFAULT_GAME_ROOM_OPTIONS.selectionTimeoutMs * 0.005)),
      battleTimelineTimeScale: 0.005,
    });
  });
});
