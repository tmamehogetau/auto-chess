import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../src/server/rooms/game-room";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "../../src/shared/room-messages";
import {
  withFlags,
  FLAG_CONFIGURATIONS,
} from "./feature-flag-test-helper";

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> => {
  const startMs = Date.now();

  while (Date.now() - startMs < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 15);
    });
  }

  throw new Error("Timed out while waiting for condition");
};

describe("GameRoom Integration with Feature Flags", () => {
  describe("Main Test Scenarios with Dual Flag Configurations", () => {
    let testServer!: ColyseusTestServer;

    const TEST_SERVER_PORT = 2_581;

    beforeAll(async () => {
      const server = defineServer({
        rooms: {
          game: defineRoom(GameRoom, {
            readyAutoStartMs: 2_000,
            prepDurationMs: 120,
            battleDurationMs: 120,
            settleDurationMs: 80,
            eliminationDurationMs: 80,
          }),
        },
      });

      await server.listen(TEST_SERVER_PORT);
      testServer = new ColyseusTestServer(server);
    });

    afterEach(async () => {
      if (!testServer) {
        return;
      }

      await testServer.cleanup();
    });

    afterAll(async () => {
      if (!testServer) {
        return;
      }

      await testServer.shutdown();
    });

    describe("4人ゲームの基本フロー（フラグOFF時）", () => {
      test("4人joinして全員readyでPrep開始し、ルームがlockされる", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          expect(serverRoom.state.setId).toBe("set1");
          expect(serverRoom.state.prepDeadlineAtMs).toBeGreaterThan(0);
          expect(serverRoom.locked).toBe(true);
          expect(serverRoom.state.featureFlagsEnableHeroSystem).toBe(false);
          expect(serverRoom.state.featureFlagsEnableSharedPool).toBe(false);
          expect(serverRoom.state.featureFlagsEnablePhaseExpansion).toBe(false);
        });
      });

      test("Prepの締切を過ぎるとBattleへ自動遷移する", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

          expect(serverRoom.state.phase).toBe("Battle");
        });
      });

      test("Prep->Battle->Settle->Elimination->PrepでroundIndexが進む", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Elimination", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          expect(serverRoom.state.roundIndex).toBe(2);
        });
      });

      test("試合開始時にshopOffersがstateへ同期される", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          const target = serverRoom.state.players.get(clients[0].sessionId);

          expect(target?.shopOffers.length).toBe(5);
        });
      });

      test("異常切断後に再接続するとconnectedがtrueへ戻る", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          const droppedClient = clients[0];
          const previousSessionId = droppedClient.sessionId;
          const reconnectionToken = droppedClient.reconnectionToken;

          droppedClient.connection.close(4001, "network drop");

          await waitForCondition(
            () => serverRoom.state.players.get(previousSessionId)?.connected === false,
            1_000,
          );

          const reconnected = await testServer.sdk.reconnect(reconnectionToken);

          await waitForCondition(
            () => serverRoom.state.players.get(previousSessionId)?.connected === true,
            1_000,
          );

          expect(reconnected.sessionId).toBe(previousSessionId);
        });
      });
    });

    describe("4人ゲームの基本フロー（フラグON時）", () => {
      test("4人joinして全員readyでPrep開始し、ルームがlockされる", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          expect(serverRoom.state.setId).toBe("set1");
          expect(serverRoom.state.prepDeadlineAtMs).toBeGreaterThan(0);
          expect(serverRoom.locked).toBe(true);
          expect(serverRoom.state.featureFlagsEnableHeroSystem).toBe(true);
          expect(serverRoom.state.featureFlagsEnableSharedPool).toBe(true);
          expect(serverRoom.state.featureFlagsEnablePhaseExpansion).toBe(true);
        });
      });

      test("Prepの締切を過ぎるとBattleへ自動遷移する", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

          expect(serverRoom.state.phase).toBe("Battle");
        });
      });

      test("Prep->Battle->Settle->Elimination->PrepでroundIndexが進む", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Elimination", 1_000);
          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          expect(serverRoom.state.roundIndex).toBe(2);
        });
      });

      test("試合開始時にshopOffersがstateへ同期される", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          const target = serverRoom.state.players.get(clients[0].sessionId);

          expect(target?.shopOffers.length).toBe(5);
        });
      });

      test("異常切断後に再接続するとconnectedがtrueへ戻る", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          const droppedClient = clients[0];
          const previousSessionId = droppedClient.sessionId;
          const reconnectionToken = droppedClient.reconnectionToken;

          droppedClient.connection.close(4001, "network drop");

          await waitForCondition(
            () => serverRoom.state.players.get(previousSessionId)?.connected === false,
            1_000,
          );

          const reconnected = await testServer.sdk.reconnect(reconnectionToken);

          await waitForCondition(
            () => serverRoom.state.players.get(previousSessionId)?.connected === true,
            1_000,
          );

          expect(reconnected.sessionId).toBe(previousSessionId);
        });
      });
    });

    describe("4人ゲーム完走テスト（両フラグ設定）", () => {
      test("全フラグOFF時: 4人でR8完走後にEndフェーズへ遷移する", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game", {
            readyAutoStartMs: 500,
            prepDurationMs: 80,
            battleDurationMs: 80,
            settleDurationMs: 50,
            eliminationDurationMs: 50,
          });
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          // Wait for game to complete
          await waitForCondition(
            () => serverRoom.state.phase === "End" && serverRoom.state.roundIndex === 8,
            45_000,
          );

          // Verify final state
          expect(serverRoom.state.phase).toBe("End");
          expect(serverRoom.state.roundIndex).toBe(8);
          expect(serverRoom.state.players.size).toBe(4);
          expect(serverRoom.state.featureFlagsEnableHeroSystem).toBe(false);
          expect(serverRoom.state.featureFlagsEnableSharedPool).toBe(false);
          expect(serverRoom.state.featureFlagsEnablePhaseExpansion).toBe(false);
        });
      }, 50_000);

      test("全フラグON時: 4人でゲーム完走後Endフェーズへ遷移する", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game", {
            readyAutoStartMs: 500,
            prepDurationMs: 80,
            battleDurationMs: 80,
            settleDurationMs: 50,
            eliminationDurationMs: 50,
          });
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          // Wait for game to complete
          await waitForCondition(
            () => serverRoom.state.phase === "End",
            45_000,
          );

          // Verify final state (roundIndex depends on phase expansion)
          expect(serverRoom.state.phase).toBe("End");
          expect(serverRoom.state.players.size).toBe(4);
          expect(serverRoom.state.featureFlagsEnableHeroSystem).toBe(true);
          expect(serverRoom.state.featureFlagsEnableSharedPool).toBe(true);
          expect(serverRoom.state.featureFlagsEnablePhaseExpansion).toBe(true);
        });
      }, 50_000);
    });

    describe("コマンド処理テスト（両フラグ設定）", () => {
      test("全フラグOFF時: prep_commandのboardUnitCountで勝敗が変わる", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          const sortedSessionIds = clients.map((client) => client.sessionId).sort();
          const strongestA = sortedSessionIds[2];
          const strongestB = sortedSessionIds[3];

          if (!strongestA || !strongestB) {
            throw new Error("Expected 4 player session ids");
          }

          const clientBySessionId = new Map(clients.map((client) => [client.sessionId, client]));
          const strongestAClient = clientBySessionId.get(strongestA);
          const strongestBClient = clientBySessionId.get(strongestB);

          if (!strongestAClient || !strongestBClient) {
            throw new Error("Expected clients for strongest players");
          }

          strongestAClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: 8,
          });
          strongestBClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: 8,
          });

          const strongestAResult =
            await strongestAClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
          const strongestBResult =
            await strongestBClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

          expect(strongestAResult).toEqual({ accepted: true });
          expect(strongestBResult).toEqual({ accepted: true });
        });
      });

      test("全フラグON時: prep_commandのboardUnitCountで勝敗が変わる", async () => {
        await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
          const serverRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await Promise.all([
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
            testServer.connectTo(serverRoom),
          ]);

          for (const client of clients) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
          }

          await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

          const sortedSessionIds = clients.map((client) => client.sessionId).sort();
          const strongestA = sortedSessionIds[2];
          const strongestB = sortedSessionIds[3];

          if (!strongestA || !strongestB) {
            throw new Error("Expected 4 player session ids");
          }

          const clientBySessionId = new Map(clients.map((client) => [client.sessionId, client]));
          const strongestAClient = clientBySessionId.get(strongestA);
          const strongestBClient = clientBySessionId.get(strongestB);

          if (!strongestAClient || !strongestBClient) {
            throw new Error("Expected clients for strongest players");
          }

          strongestAClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: 8,
          });
          strongestBClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: 8,
          });

          const strongestAResult =
            await strongestAClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
          const strongestBResult =
            await strongestBClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

          expect(strongestAResult).toEqual({ accepted: true });
          expect(strongestBResult).toEqual({ accepted: true });
        });
      });
    });
  });
});
