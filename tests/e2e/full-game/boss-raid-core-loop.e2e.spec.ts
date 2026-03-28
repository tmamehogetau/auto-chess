import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import type { MatchRoomController } from "../../../src/server/match-room-controller";
import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import {
  FLAG_CONFIGURATIONS,
  captureManagedFlagEnv,
  restoreManagedFlagEnv,
  withFlags,
} from "../../server/feature-flag-test-helper";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";

describe("E2E: Boss Raid Core Loop", () => {
  let testServer: ColyseusTestServer;
  let originalEnv = captureManagedFlagEnv();
  const TEST_SERVER_PORT = 4581;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 100,
          prepDurationMs: 100,
          battleDurationMs: 80,
          settleDurationMs: 50,
          eliminationDurationMs: 50,
        }),
      },
    });

    await server.listen(TEST_SERVER_PORT);
    testServer = new ColyseusTestServer(server);
  }, 15_000);

  beforeEach(() => {
    originalEnv = captureManagedFlagEnv();
    FeatureFlagService.resetForTests();
  });

  afterEach(async () => {
    if (testServer) {
      await testServer.cleanup();
    }
    restoreManagedFlagEnv(originalEnv);
    FeatureFlagService.resetForTests();
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
  });

  async function setupRaidRoom() {
    const gameRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
    ]);

    for (const client of clients) {
      client.onMessage("round_state", () => {});
      client.onMessage("command_result", () => {});
      client.send("ready", { ready: true });
    }

    await waitForCondition(() => gameRoom.state.phase === "Prep", 5_000);
    return { gameRoom, clients };
  }

  function advanceRaidRound(
    controller: MatchRoomController,
    nowMs: number,
    damageValue: number,
    bossPlayerId: string,
    raidPlayerIds: string[],
  ): number {
    controller.advanceByTime(nowMs + 100);
    controller.setPendingPhaseDamageForTest(damageValue);
    controller.advanceByTime(nowMs + 200);
    const { battleResultsByPlayer } = controller.getTestAccess();
    for (const raidPlayerId of raidPlayerIds) {
      battleResultsByPlayer.set(raidPlayerId, {
        opponentId: bossPlayerId,
        won: true,
        damageDealt: 10,
        damageTaken: 0,
        survivors: 1,
        opponentSurvivors: 0,
      });
    }
    controller.advanceByTime(nowMs + 300);
    controller.advanceByTime(nowMs + 400);
    return nowMs + 500;
  }

  it(
    "R12 reaches final judgment for a raid win",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
        async () => {
          const { gameRoom, clients } = await setupRaidRoom();
          const roomInternals = gameRoom as unknown as {
            controller?: MatchRoomController;
            syncStateFromController?: () => void;
          };
          const controller = roomInternals.controller;
          expect(controller).toBeDefined();
          const bossPlayerId = gameRoom.state.bossPlayerId;
          const raidPlayerIds = Array.from(gameRoom.state.raidPlayerIds);
          const { battleResultsByPlayer } = controller!.getTestAccess();

          let nowMs = Date.now();
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRound(controller!, nowMs, 10_000, bossPlayerId, raidPlayerIds);
            roomInternals.syncStateFromController?.();
          }

          const bossClient = clients.find((client) => client.sessionId === bossPlayerId)!;
          const raidClients = clients.filter((client) => raidPlayerIds.includes(client.sessionId));

          controller?.advanceByTime(nowMs + 100);
          controller?.setPendingPhaseDamageForTest(3_000);
          controller?.advanceByTime(nowMs + 200);
          battleResultsByPlayer.set(raidClients[0]!.sessionId, {
            opponentId: bossClient.sessionId,
            won: true,
            damageDealt: 10,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
          });
          battleResultsByPlayer.set(raidClients[1]!.sessionId, {
            opponentId: bossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set(raidClients[2]!.sessionId, {
            opponentId: bossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          controller?.advanceByTime(nowMs + 300);
          controller?.advanceByTime(nowMs + 400);
          roomInternals.syncStateFromController?.();

          expect(gameRoom.state.phase).toBe("End");
          expect(gameRoom.state.ranking[0]).toBe(raidClients[0]!.sessionId);
          expect(gameRoom.state.players.get(raidClients[0]!.sessionId)?.eliminated).toBe(false);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "R12 reaches final judgment for a boss win on simultaneous wipe",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
        async () => {
          const { gameRoom, clients } = await setupRaidRoom();
          const roomInternals = gameRoom as unknown as {
            controller?: MatchRoomController;
            syncStateFromController?: () => void;
          };
          const controller = roomInternals.controller;
          expect(controller).toBeDefined();
          const bossPlayerId = gameRoom.state.bossPlayerId;
          const raidPlayerIds = Array.from(gameRoom.state.raidPlayerIds);
          const { gameLoopState, battleResultsByPlayer } = controller!.getTestAccess();
          if (!gameLoopState) {
            throw new Error("Expected gameLoopState");
          }

          let nowMs = Date.now();
          for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
            nowMs = advanceRaidRound(controller!, nowMs, 10_000, bossPlayerId, raidPlayerIds);
            roomInternals.syncStateFromController?.();
          }

          const bossClient = clients.find((client) => client.sessionId === bossPlayerId)!;
          const raidClients = clients.filter((client) => raidPlayerIds.includes(client.sessionId));

          gameLoopState.consumeLife(raidClients[0]!.sessionId, 2);
          gameLoopState.consumeLife(raidClients[1]!.sessionId, 2);
          gameLoopState.consumeLife(raidClients[2]!.sessionId, 2);

          controller?.advanceByTime(nowMs + 100);
          controller?.setPendingPhaseDamageForTest(3_000);
          controller?.advanceByTime(nowMs + 200);
          battleResultsByPlayer.set(raidClients[0]!.sessionId, {
            opponentId: bossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set(raidClients[1]!.sessionId, {
            opponentId: bossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set(raidClients[2]!.sessionId, {
            opponentId: bossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          controller?.advanceByTime(nowMs + 300);
          controller?.advanceByTime(nowMs + 400);
          roomInternals.syncStateFromController?.();

          expect(gameRoom.state.phase).toBe("End");
          expect(gameRoom.state.ranking[0]).toBe(bossClient.sessionId);
          expect(gameRoom.state.players.get(raidClients[0]!.sessionId)?.eliminated).toBe(true);
          expect(gameRoom.state.players.get(raidClients[1]!.sessionId)?.eliminated).toBe(true);
          expect(gameRoom.state.players.get(raidClients[2]!.sessionId)?.eliminated).toBe(true);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );
});
