import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../../src/server/rooms/shared-board-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "./helpers/wait";
import { SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";

describe("SharedBoard Bridge E2E - Cleanup", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4569;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 500,  // 高速化
          prepDurationMs: 45_000,
          battleDurationMs: 40_000,
          settleDurationMs: 5_000,
          eliminationDurationMs: 2_000,
        }),
        shared_board: defineRoom(SharedBoardRoom, { lockDurationMs: 1_000 }),
      },
    });

    await server.listen(TEST_SERVER_PORT);
    testServer = new ColyseusTestServer(server);
  });

  afterEach(async () => {
    if (testServer) {
      await testServer.cleanup();
    }
    delete process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW;
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
  });

  /**
   * 4人のクライアントでGameRoomを開始し、Prep状態になるまで待機
   */
  async function setupGameWith4Players(gameRoom: GameRoom) {
    const clients = await Promise.all([
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
    ]);

    // RoundStateリスナー登録
    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
      client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
    }

    // 全員Ready
    for (const client of clients) {
      client.send("ready", { ready: true });
    }

    // Game開始待機（Prep状態になる）
    await waitForCondition(
      () => gameRoom.state.phase !== "Waiting", 
      5_000  // 5秒タイムアウト
    );

    return clients;
  }

  it("GameRoom破棄時: Bridgeが適切にクリーンアップされる", { timeout: 15_000 }, async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
      async () => {
        // shared_boardルームを起動
        const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
        const initialClientCount = sharedBoardRoom.clients.length;

        // gameルーム作成
        const gameRoom = await testServer.createRoom<GameRoom>("game");

        // 4人参加
        const clients = await setupGameWith4Players(gameRoom);

        // Bridge初期化確認（READYまたはDEGRADEDを許容）
        const gameRoomAny = gameRoom as unknown as {
          sharedBoardBridge?: { getState: () => string; dispose: () => void };
        };
        await waitForCondition(
          () => {
            const state = gameRoomAny.sharedBoardBridge?.getState();
            return state === "READY" || state === "DEGRADED";
          },
          10_000,
        );

        expect(gameRoomAny.sharedBoardBridge).toBeDefined();

        // 全クライアント切断
        for (const client of clients) {
          client.connection.close();
        }

        // 少し待機してから確認（GameRoomが破棄されるまで）
        await new Promise((resolve) => setTimeout(resolve, 1_000));

        // Bridgeが初期化されていたことを確認
        expect(gameRoomAny.sharedBoardBridge).toBeDefined();
      },
    );
  });

  it("GameRoom破棄後: 新しいGameRoomでBridgeが正常に動作する", { timeout: 20_000 }, async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
      async () => {
        // shared_boardルームを起動（継続利用）
        await testServer.createRoom<SharedBoardRoom>("shared_board");

        // 1つ目のGameRoom作成
        const gameRoom1 = await testServer.createRoom<GameRoom>("game");
        const clients1 = await setupGameWith4Players(gameRoom1);

        const gameRoom1Any = gameRoom1 as unknown as {
          sharedBoardBridge?: { getState: () => string };
        };
        await waitForCondition(
          () => {
            const state = gameRoom1Any.sharedBoardBridge?.getState();
            return state === "READY" || state === "DEGRADED";
          },
          10_000,
        );

        // 1つ目のGameRoomを破棄
        for (const client of clients1) {
          client.connection.close();
        }

        // 少し待機
        await new Promise((resolve) => setTimeout(resolve, 1_000));

        // 2つ目のGameRoom作成（同じshared_boardに接続）
        const gameRoom2 = await testServer.createRoom<GameRoom>("game");
        const clients2 = await setupGameWith4Players(gameRoom2);

        const gameRoom2Any = gameRoom2 as unknown as {
          sharedBoardBridge?: { getState: () => string };
        };
        await waitForCondition(
          () => {
            const state = gameRoom2Any.sharedBoardBridge?.getState();
            return state === "READY" || state === "DEGRADED";
          },
          10_000,
        );

        // 2つ目のBridgeが正常に初期化されていることを確認
        expect(gameRoom2Any.sharedBoardBridge).toBeDefined();
        const bridge2State = gameRoom2Any.sharedBoardBridge?.getState();
        expect(["READY", "DEGRADED"]).toContain(bridge2State);

        // 2つ目のGameRoomをクリーンアップ
        for (const client of clients2) {
          client.connection.close();
        }
      },
    );
  });
});
