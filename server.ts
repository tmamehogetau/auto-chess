import { defineServer, defineRoom } from "colyseus";
import { GameRoom } from "./src/server/rooms/game-room";
import { SharedBoardRoom } from "./src/server/rooms/shared-board-room";
import { FeatureFlagService } from "./src/server/feature-flag-service";
import { DEFAULT_FLAGS } from "./src/shared/feature-flags";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 2567;

export const GAME_ROOM_OPTIONS = {
  readyAutoStartMs: 30_000,
  prepDurationMs: 45_000,
  battleDurationMs: 30_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 5_000,
  forcedFeatureFlags: {
    ...DEFAULT_FLAGS,
    enableHeroSystem: true,
    enableSpellCard: true,
    enableBossExclusiveShop: true,
    enableSharedBoardShadow: true,
  },
} as const;

export const SHARED_BOARD_ROOM_OPTIONS = {
  lockDurationMs: 1000,
} as const;

export function buildServer(overrides = {}) {
  FeatureFlagService.getInstance().validateFlagConfiguration();

  const {
    gameRoomOptions = {},
    sharedBoardRoomOptions = {},
  } = overrides as {
    gameRoomOptions?: Record<string, unknown>;
    sharedBoardRoomOptions?: Record<string, unknown>;
  };

  return defineServer({
    rooms: {
      game: defineRoom(GameRoom, {
        ...GAME_ROOM_OPTIONS,
        ...gameRoomOptions,
      }),
      shared_board: defineRoom(SharedBoardRoom, {
        ...SHARED_BOARD_ROOM_OPTIONS,
        ...sharedBoardRoomOptions,
      }),
    },
  });
}

if (require.main === module) {
  const server = buildServer();

  server.listen(PORT).then(() => {
    console.log(`🎮 Auto-Chess MVP Server running on ws://localhost:${PORT}`);
    console.log(`📱 Client check: http://localhost:8080/src/client/index.html`);
    console.log(`🎯 To play: open client check in 4 browser tabs`);
    console.log(`🔄 Shared-board tech check: http://localhost:8080/src/client/shared-board-check.html?endpoint=ws://localhost:${PORT}&roomName=shared_board&autoconnect=1`);
  });
}
