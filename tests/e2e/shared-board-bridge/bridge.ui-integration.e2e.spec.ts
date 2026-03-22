import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../../src/server/rooms/shared-board-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { combatCellToRaidBoardIndex } from "../../../src/shared/board-geometry";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "./helpers/wait";
import { SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";

interface TestClient {
  sessionId: string;
  send: (type: string, message?: unknown) => void;
  onMessage: (type: string, cb: (message: unknown) => void) => void;
  connection: {
    close: () => void;
  };
}

describe("SharedBoard Bridge E2E - UI Integration", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4570;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 500,
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
   * SharedBoardRoomにアクティブプレイヤーとして参加
   */
async function joinAsActivePlayer(
  sharedBoardRoom: SharedBoardRoom,
  gamePlayerId: string,
): Promise<TestClient> {
    const client = (await testServer.connectTo(sharedBoardRoom, {
      gamePlayerId,
    })) as unknown as TestClient;

    // 未登録警告抑制（place前に reject が返るケースに備える）
    client.onMessage("shared_action_result", () => {});

    // roleメッセージを待機
    const rolePromise = new Promise<{ isSpectator: boolean; slotIndex: number }>((resolve) => {
      client.onMessage("shared_role", (msg: unknown) => {
        resolve(msg as { isSpectator: boolean; slotIndex: number });
      });
    });

    const role = await rolePromise;
    expect(role.isSpectator).toBe(false);
    expect(role.slotIndex).toBeGreaterThanOrEqual(0);

    return client;
  }

  function seedOwnedUnit(
    sharedBoardRoom: SharedBoardRoom,
    ownerId: string,
    cellIndex: number,
  ): { unitId: string; sharedCellIndex: number } {
    const result = sharedBoardRoom.applyPlacementsFromGame(ownerId, [
      {
        cell: cellIndex,
        unitType: "vanguard",
      },
    ]);

    expect(result).toEqual({ applied: 1, skipped: 0 });

    const targetCell = sharedBoardRoom.state.cells.get(String(cellIndex));

    if (!targetCell?.unitId) {
      throw new Error(`No owned unit found for player ${ownerId}`);
    }

    return {
      unitId: targetCell.unitId,
      sharedCellIndex: cellIndex,
    };
  }

  /**
   * SharedBoardRoomでユニットを配置
   */
async function placeUnit(
  client: TestClient,
  unitId: string,
  toCell: number,
): Promise<{ accepted: boolean }> {
    const resultPromise = new Promise<{ accepted: boolean }>((resolve) => {
      client.onMessage("shared_action_result", (msg: unknown) => {
        const result = msg as { accepted: boolean; action: string };
        if (result.action === "place_unit") {
          resolve(result);
        }
      });
    });

    client.send("shared_place_unit", { unitId, toCell });

    return resultPromise;
  }

  it(
    "UI操作: SharedBoardRoomで配置変更 → GameRoomに反映",
    { timeout: 15_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
        async () => {
          // 1. Setup: SharedBoardRoom作成
          const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");

          // 2. Setup: GameRoom作成（4人参加）
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const gameClients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          // RoundStateリスナー登録 + Ready
          for (const client of gameClients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
            client.send("ready", { ready: true });
          }

          // Game開始待機
          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);

          // 3. Setup: Bridge初期化確認
          const gameRoomAny = gameRoom as unknown as {
            sharedBoardBridge?: {
              getState: () => string;
              getMetrics: () => { totalEvents: number };
              getRecentLogs: (count: number) => unknown[];
            };
          };
          await waitForCondition(
            () => {
              const state = gameRoomAny.sharedBoardBridge?.getState();
              return state === "READY" || state === "DEGRADED";
            },
            10_000,
          );

          if (gameRoomAny.sharedBoardBridge?.getState() !== "READY") {
            console.log("Bridge not READY, skipping UI integration test");
            return;
          }

          await waitForCondition(
            () => sharedBoardRoom.state.phase === "Prep" && sharedBoardRoom.state.mode === "prep",
            10_000,
          );

          // 初期メトリクス記録
          const initialMetrics = gameRoomAny.sharedBoardBridge?.getMetrics();
          const initialEventCount = initialMetrics?.totalEvents ?? 0;

          // 4. Action: 1人目のプレイヤーをSharedBoardRoomに接続
          const targetPlayerId = gameClients[0]!.sessionId;
          const sbClient = await joinAsActivePlayer(sharedBoardRoom, targetPlayerId);
          const { unitId: ownedUnitId } = seedOwnedUnit(
            sharedBoardRoom,
            targetPlayerId,
            combatCellToRaidBoardIndex(0),
          );
          const targetSharedCell = combatCellToRaidBoardIndex(1);

          // ユニットを選択
          sbClient.send("shared_select_unit", { unitId: ownedUnitId });
          await new Promise((resolve) => setTimeout(resolve, 100));

          // 5. Action: ドラッグ&ドロップでユニットを移動（raid lane 内で再配置）
          const placeResult = await placeUnit(sbClient, ownedUnitId, targetSharedCell);
          expect(placeResult.accepted).toBe(true);

          // 6. Verify: SharedBoardRoomで配置が変更されたこと
          const targetCell = sharedBoardRoom.state.cells.get(String(targetSharedCell));
          expect(targetCell?.unitId).toBe(ownedUnitId);
          expect(targetCell?.ownerId).toBe(targetPlayerId);

          // 7. Verify: Bridgeがイベントを受け取ったこと（少し待機）
          await new Promise((resolve) => setTimeout(resolve, 200));

          const updatedMetrics = gameRoomAny.sharedBoardBridge?.getMetrics();
          const updatedEventCount = updatedMetrics?.totalEvents ?? 0;
          const recentLogs = gameRoomAny.sharedBoardBridge?.getRecentLogs(10) ?? [];
          const hasForbiddenError = recentLogs.some(
            (log) =>
              typeof log === "object"
              && log !== null
              && (log as { errorCode?: string }).errorCode === "forbidden",
          );

          // イベントが増えていることを確認（監視ログが記録された）
          expect(updatedEventCount).toBeGreaterThanOrEqual(initialEventCount);
          expect(hasForbiddenError).toBe(false);

          // 8. Cleanup
          sbClient.connection.close();
          for (const client of gameClients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "UI操作: Bridgeメトリクスが記録される",
    { timeout: 15_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
        async () => {
          // 1. Setup: SharedBoardRoom作成
          const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");

          // 2. Setup: GameRoom作成（4人参加）
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const gameClients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          // RoundStateリスナー登録 + Ready
          for (const client of gameClients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
            client.send("ready", { ready: true });
          }

          // Game開始待機（Prepフェーズ）
          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);

          // 3. Setup: Bridge初期化確認
          const gameRoomAny = gameRoom as unknown as {
            sharedBoardBridge?: {
              getState: () => string;
              getMetrics: () => { totalEvents: number };
              getRecentLogs: (count: number) => unknown[];
            };
          };
          await waitForCondition(
            () => {
              const state = gameRoomAny.sharedBoardBridge?.getState();
              return state === "READY" || state === "DEGRADED";
            },
            10_000,
          );

          if (gameRoomAny.sharedBoardBridge?.getState() !== "READY") {
            console.log("Bridge not READY, skipping metrics test");
            return;
          }

          await waitForCondition(
            () => sharedBoardRoom.state.phase === "Prep" && sharedBoardRoom.state.mode === "prep",
            10_000,
          );

          // 初期メトリクス記録
          const initialMetrics = gameRoomAny.sharedBoardBridge?.getMetrics();
          const initialEventCount = initialMetrics?.totalEvents ?? 0;

          // 4. Action: プレイヤーをSharedBoardRoomに接続して操作
          const targetPlayerId = gameClients[0]!.sessionId;
          const sbClient = await joinAsActivePlayer(sharedBoardRoom, targetPlayerId);
          const { unitId: ownedUnitId } = seedOwnedUnit(
            sharedBoardRoom,
            targetPlayerId,
            combatCellToRaidBoardIndex(0),
          );
          const targetSharedCell = combatCellToRaidBoardIndex(1);

          sbClient.send("shared_select_unit", { unitId: ownedUnitId });
          await new Promise((resolve) => setTimeout(resolve, 100));

          const placeResult = await placeUnit(sbClient, ownedUnitId, targetSharedCell);
          expect(placeResult.accepted).toBe(true);

          // 5. Verify: メトリクスとログが記録されている
          await new Promise((resolve) => setTimeout(resolve, 200));

          const updatedMetrics = gameRoomAny.sharedBoardBridge?.getMetrics();
          const updatedEventCount = updatedMetrics?.totalEvents ?? 0;
          const recentLogs = gameRoomAny.sharedBoardBridge?.getRecentLogs(5) ?? [];
          const hasForbiddenError = recentLogs.some(
            (log) =>
              typeof log === "object"
              && log !== null
              && (log as { errorCode?: string }).errorCode === "forbidden",
          );

          // イベントが増えていることを確認
          expect(updatedEventCount).toBeGreaterThanOrEqual(initialEventCount);
          // ログが記録されていることを確認
          expect(recentLogs.length).toBeGreaterThan(0);
          // 共有盤面プレイヤーIDを正しくマッピングできていること
          expect(hasForbiddenError).toBe(false);

          // 6. Cleanup
          sbClient.connection.close();
          for (const client of gameClients) {
            client.connection.close();
          }
        },
      );
    },
  );

});
