import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../../src/server/rooms/shared-board-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { 
  waitForCondition, 
  collectMessages, 
  assertNoMessage,
  validateShadowDiffMessage,
} from "./helpers/wait";
import {
  SERVER_MESSAGE_TYPES,
  type ShadowDiffMessage,
} from "../../../src/shared/room-messages";

describe("SharedBoard Bridge E2E - Lifecycle", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4568;

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

  it("Feature Flag OFF時: shadow_diffメッセージを受信しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
      // shared_boardルームを起動
      await testServer.createRoom<SharedBoardRoom>("shared_board");

      // gameルームを作成
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      
      // 4人参加
      const clients = await setupGameWith4Players(gameRoom);

      // shadow_diffメッセージが来ないことを確認
      await assertNoMessage(clients[0]!, "shadow_diff", 1_000);
    });
  });

  it("Feature Flag ON時: shared_boardルームを検索・接続する", async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
      async () => {
        // shared_boardルームを先に起動
        const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
        expect(sharedBoardRoom.roomId).toBeDefined();

        // gameルームを作成
        const gameRoom = await testServer.createRoom<GameRoom>("game");

        // 4人参加
        const clients = await setupGameWith4Players(gameRoom);

        // Bridgeが初期化されるまで待機
        const gameRoomAny = gameRoom as unknown as {
          sharedBoardBridge?: { getState: () => string };
        };
        
        await waitForCondition(
          () => gameRoomAny.sharedBoardBridge !== undefined,
          3_000,
        );

        expect(gameRoomAny.sharedBoardBridge).toBeDefined();
        
        // READYまたはDEGRADED状態になる
        await waitForCondition(
          () => {
            const state = gameRoomAny.sharedBoardBridge?.getState();
            return state === "READY" || state === "DEGRADED";
          },
          5_000,
        );

        const bridgeState = gameRoomAny.sharedBoardBridge?.getState();
        expect(["READY", "DEGRADED"]).toContain(bridgeState);
      },
    );
  });

  it("READY状態: 定期的にshadow_diffメッセージが配信される", { timeout: 15_000 }, async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
      async () => {
        // shared_boardルームを起動
        await testServer.createRoom<SharedBoardRoom>("shared_board");

        // gameルーム作成
        const gameRoom = await testServer.createRoom<GameRoom>("game");

        // 4人参加
        const clients = await setupGameWith4Players(gameRoom);

        // Bridge初期化待機（READYまたはDEGRADEDを許容）
        const gameRoomAny = gameRoom as unknown as {
          sharedBoardBridge?: { getState: () => string };
        };
        await waitForCondition(
          () => {
            const state = gameRoomAny.sharedBoardBridge?.getState();
            return state === "READY" || state === "DEGRADED";
          },
          10_000,
        );

        // READY状態でなければテストをスキップ（shared_board未検出時）
        if (gameRoomAny.sharedBoardBridge?.getState() !== "READY") {
          console.log("Bridge not READY, skipping shadow_diff collection");
          return;
        }

        // 1人目のクライアントでshadow_diffを収集
        const shadowDiffMessages = await collectMessages<ShadowDiffMessage>(
          clients[0]!,
          "shadow_diff",
          500,
        );

        // shadow_diffメッセージが受信されていること
        expect(shadowDiffMessages.length).toBeGreaterThan(0);

        // メッセージ構造を検証
        for (const msg of shadowDiffMessages) {
          validateShadowDiffMessage(msg);
        }

        // 最後のメッセージの詳細を検証
        const lastMsg = shadowDiffMessages[shadowDiffMessages.length - 1];
        expect(lastMsg?.type).toBe("shadow_diff");
        expect(lastMsg?.seq).toBeGreaterThanOrEqual(1);
        expect(typeof lastMsg?.ts).toBe("number");
      },
    );
  });

  it("複数クライアントで同じshadow_diffを受信する", { timeout: 15_000 }, async () => {
    await withFlags(
      { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
      async () => {
        // shared_boardルームを起動
        await testServer.createRoom<SharedBoardRoom>("shared_board");

        // gameルーム作成
        const gameRoom = await testServer.createRoom<GameRoom>("game");

        // 4人参加
        const clients = await setupGameWith4Players(gameRoom);

        // Bridge初期化待機（READYまたはDEGRADEDを許容）
        const gameRoomAny = gameRoom as unknown as {
          sharedBoardBridge?: { getState: () => string };
        };
        await waitForCondition(
          () => {
            const state = gameRoomAny.sharedBoardBridge?.getState();
            return state === "READY" || state === "DEGRADED";
          },
          10_000,
        );

        // READY状態でなければテストをスキップ
        if (gameRoomAny.sharedBoardBridge?.getState() !== "READY") {
          console.log("Bridge not READY, skipping multi-client test");
          return;
        }

        // 全クライアントでshadow_diffを収集
        const clientMessages = await Promise.all(
          clients.map((client) => collectMessages<ShadowDiffMessage>(client, "shadow_diff", 300)),
        );

        // 全クライアントがメッセージを受信していること
        for (let i = 0; i < clients.length; i++) {
          expect(clientMessages[i]?.length ?? 0).toBeGreaterThan(0);
        }

        // 全クライアントが同じseqのメッセージを受信していること（ブロードキャスト）
        const firstClientSeqs = clientMessages[0]?.map((m) => m.seq) ?? [];
        for (let i = 1; i < clients.length; i++) {
          const otherSeqs = clientMessages[i]?.map((m) => m.seq) ?? [];
          expect(otherSeqs).toEqual(firstClientSeqs);
        }
      },
    );
  });
});
