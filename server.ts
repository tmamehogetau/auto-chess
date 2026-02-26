import { defineServer, defineRoom } from "colyseus";
import { GameRoom } from "./src/server/rooms/game-room";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 2567;

const server = defineServer({
  rooms: {
    game: defineRoom(GameRoom, {
      readyAutoStartMs: 30_000,      // 30秒でReady締切
      prepDurationMs: 60_000,        // 60秒の準備フェーズ
      battleDurationMs: 30_000,      // 30秒の戦闘フェーズ
      settleDurationMs: 5_000,       // 5秒の決算フェーズ
      eliminationDurationMs: 5_000,  // 5秒の脱落処理
    }),
  },
});

server.listen(PORT).then(() => {
  console.log(`🎮 Auto-Chess MVP Server running on ws://localhost:${PORT}`);
  console.log(`📱 Client check: http://localhost:8080/src/client/index.html`);
  console.log(`🎯 To play: open client check in 4 browser tabs`);
});
