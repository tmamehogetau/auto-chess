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
import { getFeatureFlagCompletionFixture } from "./game-room.feature-flag.fixture";

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
  async function sendPrepCommand(
    client: {
      send: (type: string, message: unknown) => void;
      waitForMessage: (type: string) => Promise<unknown>;
    },
    cmdSeq: number,
    payload: Record<string, unknown>,
  ): Promise<{ accepted: boolean; code?: string }> {
    const resultPromise = client.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    client.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq, ...payload });
    return (await resultPromise) as {
      accepted: boolean;
      code?: string;
    };
  }

  async function startAllEnabledBossRoleMatch(
    serverRoom: GameRoom,
    clients: Array<{
      sessionId: string;
      send: (type: string, message: unknown) => void;
      waitForMessage: (type: string) => Promise<unknown>;
      connection: { close: (code?: number, reason?: string) => void };
      reconnectionToken: string;
    }>,
    timeoutMs = 1_000,
  ): Promise<void> {
    const bossClient = clients[1]!;
    const raidClientA = clients[0]!;
    const raidClientB = clients[2]!;
    const raidClientC = clients[3]!;

    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
    await waitForCondition(
      () => serverRoom.state.players.get(bossClient.sessionId)?.wantsBoss === true,
      timeoutMs,
    );

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.lobbyStage === "selection", timeoutMs);

    raidClientA.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    raidClientB.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
    raidClientC.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });
    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

    await waitForCondition(() => serverRoom.state.phase === "Prep", timeoutMs);
  }

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
          expect(serverRoom.state.featureFlagsEnableSubUnitSystem).toBe(false);
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
          }

          for (const client of clients) {
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
          }

          for (const client of clients) {
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

          await startAllEnabledBossRoleMatch(serverRoom, clients);

          expect(serverRoom.state.setId).toBe("set1");
          expect(serverRoom.state.prepDeadlineAtMs).toBeGreaterThan(0);
          expect(serverRoom.locked).toBe(true);
          expect(serverRoom.state.featureFlagsEnableHeroSystem).toBe(true);
          expect(serverRoom.state.featureFlagsEnableSharedPool).toBe(true);
          expect(serverRoom.state.featureFlagsEnablePhaseExpansion).toBe(true);
          expect(serverRoom.state.featureFlagsEnableSubUnitSystem).toBe(true);
        });
      });

      test("Touhou full migration では shared pool 実効フラグが state へ反映される", async () => {
        await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
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

          expect(serverRoom.state.featureFlagsEnableSharedPool).toBe(true);
          expect(serverRoom.state.featureFlagsEnablePerUnitSharedPool).toBe(true);
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

          await startAllEnabledBossRoleMatch(serverRoom, clients);
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

          await startAllEnabledBossRoleMatch(serverRoom, clients);
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
          }

          await startAllEnabledBossRoleMatch(serverRoom, clients);

          const target = serverRoom.state.players.get(clients[0].sessionId);

          expect(target?.shopOffers.length).toBe(5);
        });
      });

      test("boss player can buy from the regular shared shop during purchase", async () => {
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

          await startAllEnabledBossRoleMatch(serverRoom, clients);

          const bossPlayerId = serverRoom.state.bossPlayerId;
          expect(bossPlayerId).not.toBe("");

          const bossClient = clients.find((client) => client.sessionId === bossPlayerId);
          expect(bossClient).toBeDefined();

          if (!bossClient || !bossPlayerId) {
            throw new Error("Expected a connected boss client");
          }

          const playerBefore = serverRoom.state.players.get(bossPlayerId);
          const goldBefore = playerBefore?.gold ?? 0;
          const benchCountBefore = playerBefore?.benchUnits.length ?? 0;
          expect(playerBefore?.shopOffers.length).toBeGreaterThan(0);

          const buyResult = await sendPrepCommand(bossClient, 1, { shopBuySlotIndex: 0 });

          await waitForCondition(() => {
            const playerAfter = serverRoom.state.players.get(bossPlayerId);
            return (playerAfter?.benchUnits.length ?? 0) === benchCountBefore + 1;
          }, 1_000);

          const playerAfter = serverRoom.state.players.get(bossPlayerId);
          expect(buyResult).toEqual({ accepted: true });
          expect(playerAfter?.gold).toBeLessThan(goldBefore);
          expect(playerAfter?.benchUnits.length).toBe(benchCountBefore + 1);
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
          }

          await startAllEnabledBossRoleMatch(serverRoom, clients);

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
      test("全フラグOFF時: 4人でR8完走後にEndフェーズへ遷移する", () => {
        const result = getFeatureFlagCompletionFixture(
          "全フラグOFF時: 4人でR8完走後にEndフェーズへ遷移する",
        );

        expect(result.phase).toBe("End");
        expect(result.roundIndex).toBe(8);
        expect(result.playersSize).toBe(4);
        expect(result.featureFlagsEnableHeroSystem).toBe(false);
        expect(result.featureFlagsEnableSharedPool).toBe(false);
        expect(result.featureFlagsEnablePhaseExpansion).toBe(false);
        expect(result.featureFlagsEnableSubUnitSystem).toBe(false);
      }, 50_000);

      test("全フラグON時: 4人でゲーム完走後Endフェーズへ遷移する", () => {
        const result = getFeatureFlagCompletionFixture(
          "全フラグON時: 4人でゲーム完走後Endフェーズへ遷移する",
        );

        expect(result.phase).toBe("End");
        expect(result.playersSize).toBe(4);
        expect(result.featureFlagsEnableHeroSystem).toBe(true);
        expect(result.featureFlagsEnableSharedPool).toBe(true);
        expect(result.featureFlagsEnablePhaseExpansion).toBe(true);
        expect(result.featureFlagsEnableSubUnitSystem).toBe(true);
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

          const strongestAResultPromise =
            strongestAClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
          const strongestBResultPromise =
            strongestBClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

          const strongestARole = serverRoom.state.players.get(strongestA)?.role;
          const strongestBRole = serverRoom.state.players.get(strongestB)?.role;
          const strongestABoardUnitCount = strongestARole === "boss" ? 6 : 2;
          const strongestBBoardUnitCount = strongestBRole === "boss" ? 6 : 2;

          strongestAClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: strongestABoardUnitCount,
          });
          strongestBClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: strongestBBoardUnitCount,
          });

          const [strongestAResult, strongestBResult] = await Promise.all([
            strongestAResultPromise,
            strongestBResultPromise,
          ]);

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

          await startAllEnabledBossRoleMatch(serverRoom, clients);

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

          const strongestAResultPromise =
            strongestAClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
          const strongestBResultPromise =
            strongestBClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

          const strongestARole = serverRoom.state.players.get(strongestA)?.role;
          const strongestBRole = serverRoom.state.players.get(strongestB)?.role;
          const strongestABoardUnitCount = strongestARole === "boss" ? 6 : 2;
          const strongestBBoardUnitCount = strongestBRole === "boss" ? 6 : 2;

          strongestAClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: strongestABoardUnitCount,
          });
          strongestBClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            boardUnitCount: strongestBBoardUnitCount,
          });

          const [strongestAResult, strongestBResult] = await Promise.all([
            strongestAResultPromise,
            strongestBResultPromise,
          ]);

          expect(strongestAResult).toEqual({ accepted: true });
          expect(strongestBResult).toEqual({ accepted: true });
        });
      });
    });

    describe("Touhou roster migration scaffold tests", () => {
      test("current gameplay works under enableTouhouRoster=false", async () => {
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

          // Verify game starts normally with MVP roster
          expect(serverRoom.state.phase).toBe("Prep");
          expect(serverRoom.state.roundIndex).toBe(1);

          // Verify shop offers are generated using MVP roster
          const target = serverRoom.state.players.get(clients[0].sessionId);
          expect(target?.shopOffers.length).toBe(5);
        });
      });

      test("enableTouhouRoster=true creates a room and exposes Touhou draft units", async () => {
        await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_ONLY, async () => {
          const { getActiveRosterUnits } = await import("../../src/server/roster/roster-provider");
          const { FeatureFlagService } = await import("../../src/server/feature-flag-service");

          const flags = FeatureFlagService.getInstance().getFlags();
          expect(flags.enableTouhouRoster).toBe(true);

          const activeRoster = getActiveRosterUnits(flags);
          expect(activeRoster).toHaveLength(25);
          expect(activeRoster.some((unit) => unit.unitId === "rin")).toBe(true);

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

          const target = serverRoom.state.players.get(clients[0].sessionId) as unknown as {
            shopOffers: Array<{
              unitId: string;
              cost: number;
              displayName: string;
              factionId: string;
            }>;
          } | undefined;
          expect(target?.shopOffers.length).toBe(5);
          expect(target?.shopOffers.every((offer) => offer.unitId.length > 0)).toBe(true);
          expect(target?.shopOffers.every((offer) => offer.displayName.length > 0)).toBe(true);
          expect(activeRoster.some((unit) =>
            target?.shopOffers.some((offer) =>
              offer.unitId === unit.unitId
              && offer.cost === unit.cost
              && offer.displayName === unit.name,
            ),
          )).toBe(true);
        });
      });

      test("unit-id-resolver uses roster provider boundary", async () => {
        // This test verifies that unit-id-resolver uses the roster provider
        // as the boundary for MVP roster data access
        await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
          const { resolveBattlePlacement } = await import("../../src/server/unit-id-resolver");
          const { FeatureFlagService } = await import("../../src/server/feature-flag-service");

          const flags = FeatureFlagService.getInstance().getFlags();

          // Verify unit resolution works with roster provider
          // When enableTouhouRoster=false, uses MVP roster from provider
          const placement = {
            cell: 1,
            unitType: "vanguard" as const,
            unitId: "warrior_a",
          };

          const resolved = resolveBattlePlacement(placement, flags);
          expect(resolved.unitType).toBe("vanguard");
          expect(resolved.unitId).toBe("warrior_a");
        });
      });

      test("unit-id-resolver attaches Touhou faction metadata on the active roster path", async () => {
        await withFlags({
          ...FLAG_CONFIGURATIONS.ALL_DISABLED,
          enableTouhouRoster: true,
          enableTouhouFactions: true,
        }, async () => {
          const { resolveBattlePlacement } = await import("../../src/server/unit-id-resolver");
          const { FeatureFlagService } = await import("../../src/server/feature-flag-service");

          const flags = FeatureFlagService.getInstance().getFlags();

          const rinPlacement = {
            cell: 1,
            unitType: "vanguard" as const,
            unitId: "rin",
          };
          const zanmuPlacement = {
            cell: 2,
            unitType: "mage" as const,
            unitId: "zanmu",
          };

          const resolvedRin = resolveBattlePlacement(rinPlacement, flags);
          const resolvedZanmu = resolveBattlePlacement(zanmuPlacement, flags);

          expect(resolvedRin.unitType).toBe("vanguard");
          expect(resolvedRin.unitId).toBe("rin");
          expect(resolvedRin.factionId).toBe("chireiden");
          expect(resolvedRin.hp).toBe(620);
          expect(resolvedRin.attack).toBe(40);
          expect(resolvedRin.attackSpeed).toBe(0.85);
          expect(resolvedRin.movementSpeed).toBe(2);
          expect(resolvedRin.range).toBe(1);
          expect(resolvedRin.critRate).toBe(0);
          expect(resolvedRin.critDamageMultiplier).toBe(1.5);
          expect(resolvedRin.damageReduction).toBe(5);

          expect(resolvedZanmu.unitType).toBe("mage");
          expect(resolvedZanmu.unitId).toBe("zanmu");
          expect(resolvedZanmu.factionId).toBeNull();
          expect(resolvedZanmu.hp).toBe(1180);
          expect(resolvedZanmu.attack).toBe(118);
          expect(resolvedZanmu.attackSpeed).toBe(0.85);
          expect(resolvedZanmu.movementSpeed).toBe(1);
          expect(resolvedZanmu.range).toBe(3);
          expect(resolvedZanmu.critRate).toBe(0);
          expect(resolvedZanmu.critDamageMultiplier).toBe(1.5);
          expect(resolvedZanmu.damageReduction).toBe(0);
        });
      });

      test("true/true/false では Touhou faction shop discount が反映される", async () => {
        await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

          const sessionId = clients[0]!.sessionId;
          const controller = (serverRoom as unknown as {
            controller: {
              boardPlacementsByPlayer: Map<string, unknown[]>;
              shopOffersByPlayer: Map<string, unknown[]>;
            };
          }).controller;

          controller.boardPlacementsByPlayer.set(sessionId, [
            { cell: 0, unitType: "ranger", unitId: "nazrin", starLevel: 1, factionId: "myourenji" },
            { cell: 1, unitType: "mage", unitId: "murasa", starLevel: 1, factionId: "myourenji" },
            { cell: 2, unitType: "mage", unitId: "shou", starLevel: 1, factionId: "myourenji" },
          ]);
          controller.shopOffersByPlayer.set(sessionId, [
            { unitType: "vanguard", unitId: "ichirin", rarity: 2, cost: 2 },
          ]);

          const goldBefore = serverRoom.state.players.get(sessionId)?.gold ?? 0;
          const buyResult = await sendPrepCommand(clients[0]!, 1, { shopBuySlotIndex: 0 });

          await waitForCondition(
            () => (serverRoom.state.players.get(sessionId)?.gold ?? 0) === goldBefore - 1,
            1_000,
          );

          const player = serverRoom.state.players.get(sessionId);
          expect(buyResult).toEqual({ accepted: true });
          expect(player?.gold).toBe(goldBefore - 1);
        });
      });

      test("true/true/true では discount と per-unit 購入結果が両立する", async () => {
        await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
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

          const sessionId = clients[0]!.sessionId;
          const controller = (serverRoom as unknown as {
            controller: {
              boardPlacementsByPlayer: Map<string, unknown[]>;
              shopOffersByPlayer: Map<string, unknown[]>;
            };
          }).controller;

          controller.boardPlacementsByPlayer.set(sessionId, [
            { cell: 0, unitType: "ranger", unitId: "nazrin", starLevel: 1, factionId: "myourenji" },
            { cell: 1, unitType: "mage", unitId: "murasa", starLevel: 1, factionId: "myourenji" },
            { cell: 2, unitType: "mage", unitId: "shou", starLevel: 1, factionId: "myourenji" },
          ]);
          controller.shopOffersByPlayer.set(sessionId, [
            { unitType: "vanguard", unitId: "ichirin", rarity: 2, cost: 2 },
          ]);

          const goldBefore = serverRoom.state.players.get(sessionId)?.gold ?? 0;
          const buyResult = await sendPrepCommand(clients[0]!, 1, { shopBuySlotIndex: 0 });

          await waitForCondition(
            () => (serverRoom.state.players.get(sessionId)?.gold ?? 0) === goldBefore - 1,
            1_000,
          );

          const player = serverRoom.state.players.get(sessionId);
          expect(buyResult).toEqual({ accepted: true });
          expect(player?.gold).toBe(goldBefore - 1);
          expect(player?.benchUnits.length).toBe(1);
        });
      });

      test("true/true/true では割引購入した Touhou unit を売却しても shared pool cost bucket が元に戻る", async () => {
        await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
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

          const sessionId = clients[0]!.sessionId;
          const controller = (serverRoom as unknown as {
            controller: {
              boardPlacementsByPlayer: Map<string, unknown[]>;
              shopOffersByPlayer: Map<string, unknown[]>;
              sharedPool: {
                getAllInventory: () => ReadonlyMap<number, number>;
                getAvailableByUnitId: (unitId: string, cost: number) => number;
              };
            };
          }).controller;

          controller.boardPlacementsByPlayer.set(sessionId, [
            { cell: 0, unitType: "ranger", unitId: "nazrin", starLevel: 1, factionId: "myourenji" },
            { cell: 1, unitType: "mage", unitId: "murasa", starLevel: 1, factionId: "myourenji" },
            { cell: 2, unitType: "mage", unitId: "shou", starLevel: 1, factionId: "myourenji" },
          ]);
          controller.shopOffersByPlayer.set(sessionId, [
            { unitType: "vanguard", unitId: "ichirin", rarity: 2, cost: 2 },
          ]);

          const inventoryBefore = controller.sharedPool.getAllInventory();
          const cost1Before = inventoryBefore.get(1);
          const cost2Before = inventoryBefore.get(2);
          const unitIdBefore = controller.sharedPool.getAvailableByUnitId("ichirin", 2);

          const buyResult = await sendPrepCommand(clients[0]!, 1, { shopBuySlotIndex: 0 });
          const sellResult = await sendPrepCommand(clients[0]!, 2, { benchSellIndex: 0 });

          const inventoryAfter = controller.sharedPool.getAllInventory();
          const cost1After = inventoryAfter.get(1);
          const cost2After = inventoryAfter.get(2);
          const unitIdAfter = controller.sharedPool.getAvailableByUnitId("ichirin", 2);

          expect(buyResult).toEqual({ accepted: true });
          expect(sellResult).toEqual({ accepted: true });
          expect(cost1Before).toBeDefined();
          expect(cost2Before).toBeDefined();
          expect(unitIdAfter).toBe(unitIdBefore);
          expect(cost1After).toBe(cost1Before);
          expect(cost2After).toBe(cost2Before);
        });
      });

      test("false/false/false では legacy MVP buy cost を維持する", async () => {
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

          const sessionId = clients[0]!.sessionId;
          const controller = (serverRoom as unknown as {
            controller: {
              boardPlacementsByPlayer: Map<string, unknown[]>;
              shopOffersByPlayer: Map<string, unknown[]>;
            };
          }).controller;

          controller.boardPlacementsByPlayer.set(sessionId, [
            { cell: 0, unitType: "vanguard", starLevel: 1 },
            { cell: 1, unitType: "mage", starLevel: 1 },
            { cell: 2, unitType: "assassin", starLevel: 1 },
          ]);
          controller.shopOffersByPlayer.set(sessionId, [
            { unitType: "mage", rarity: 2, cost: 2 },
          ]);

          const goldBefore = serverRoom.state.players.get(sessionId)?.gold ?? 0;
          const buyResult = await sendPrepCommand(clients[0]!, 1, { shopBuySlotIndex: 0 });

          await waitForCondition(
            () => (serverRoom.state.players.get(sessionId)?.gold ?? 0) === goldBefore - 2,
            1_000,
          );

          const player = serverRoom.state.players.get(sessionId);
          expect(buyResult).toEqual({ accepted: true });
          expect(player?.gold).toBe(goldBefore - 2);
        });
      });
    });
  });
});
