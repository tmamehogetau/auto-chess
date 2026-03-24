/**
 * E2E: Player Elimination Scenario
 * 実戦闘でHPが0になったプレイヤーの排除を検証
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import {
  SERVER_MESSAGE_TYPES,
  type BoardUnitPlacement,
} from "../../../src/shared/room-messages";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
import {
  FLAG_CONFIGURATIONS,
  FLAG_ENV_VARS,
} from "../../server/feature-flag-test-helper";

describe("E2E: Player Elimination Scenario", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4572;
  const originalEnv = { ...process.env };

  const STRONG_PLACEMENTS: BoardUnitPlacement[] = [
    { cell: 0, unitType: "vanguard", starLevel: 3 },
    { cell: 1, unitType: "vanguard", starLevel: 3 },
    { cell: 2, unitType: "ranger", starLevel: 3 },
    { cell: 3, unitType: "ranger", starLevel: 3 },
    { cell: 4, unitType: "mage", starLevel: 3 },
    { cell: 5, unitType: "mage", starLevel: 3 },
    { cell: 6, unitType: "assassin", starLevel: 3 },
    { cell: 7, unitType: "assassin", starLevel: 3 },
  ];

  beforeAll(async () => {
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      process.env[envVarName] = String(
        FLAG_CONFIGURATIONS.ALL_DISABLED[flagName as keyof typeof FLAG_CONFIGURATIONS.ALL_DISABLED],
      );
    }
    (FeatureFlagService as unknown as { instance?: unknown }).instance = undefined;

    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 200,
          prepDurationMs: 1_000,
          battleDurationMs: 500,
          settleDurationMs: 200,
          eliminationDurationMs: 100,
        }),
      },
    });

    await server.listen(TEST_SERVER_PORT);
    testServer = new ColyseusTestServer(server);
  }, 15_000);

  afterEach(async () => {
    if (testServer) {
      await testServer.cleanup();
    }
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
    process.env = originalEnv;
    (FeatureFlagService as unknown as { instance?: unknown }).instance = undefined;
  });

  async function waitForPhase(gameRoom: GameRoom, targetPhase: string, timeoutMs = 10_000) {
    await waitForCondition(() => gameRoom.state.phase === targetPhase, timeoutMs);
  }

  async function setupGameWith4Players(gameRoom: GameRoom) {
    const clients = await Promise.all([
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
      client.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, () => {});
      client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
      client.send("ready", { ready: true });
    }

    await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
    await waitForPhase(gameRoom, "Prep", 5_000);

    return clients;
  }

  function nextCmdSeq(counterBySessionId: Map<string, number>, sessionId: string): number {
    const current = counterBySessionId.get(sessionId) ?? 1;
    counterBySessionId.set(sessionId, current + 1);
    return current;
  }

  function submitPrepCommandsForRound(
    clients: Array<{ sessionId: string; send: (type: string, message: unknown) => void }>,
    targetLoserSessionId: string,
    cmdSeqBySessionId: Map<string, number>,
  ): void {
    for (const client of clients) {
      const boardPlacements =
        client.sessionId === targetLoserSessionId ? [] : STRONG_PLACEMENTS;

      client.send("prep_command", {
        cmdSeq: nextCmdSeq(cmdSeqBySessionId, client.sessionId),
        boardPlacements,
      });
    }
  }

  async function forceEliminationByRealBattles(
    gameRoom: GameRoom,
    clients: Array<{ sessionId: string; send: (type: string, message: unknown) => void }>,
    targetLoserSessionId: string,
  ): Promise<{ eliminated: boolean; hp: number; roundIndex: number }> {
    const cmdSeqBySessionId = new Map<string, number>(
      clients.map((client) => [client.sessionId, 1]),
    );

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (gameRoom.state.phase === "End") {
        break;
      }

      await waitForPhase(gameRoom, "Prep", 5_000);

      submitPrepCommandsForRound(clients, targetLoserSessionId, cmdSeqBySessionId);

      await waitForCondition(() => gameRoom.state.phase !== "Prep", 2_000);

      await waitForCondition(
        () => gameRoom.state.phase === "Prep" || gameRoom.state.phase === "End",
        8_000,
      );

      const targetPlayer = gameRoom.state.players.get(targetLoserSessionId);
      if (targetPlayer?.eliminated) {
        return {
          eliminated: true,
          hp: targetPlayer.hp,
          roundIndex: gameRoom.state.roundIndex,
        };
      }
    }

    const targetPlayer = gameRoom.state.players.get(targetLoserSessionId);
    return {
      eliminated: targetPlayer?.eliminated ?? false,
      hp: targetPlayer?.hp ?? 0,
      roundIndex: gameRoom.state.roundIndex,
    };
  }

  it(
    "4人ゲーム: 実戦闘で1人がHP 0になり排除される",
    { timeout: 60_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);
      const targetLoserSessionId = clients[0]!.sessionId;

      const result = await forceEliminationByRealBattles(
        gameRoom,
        clients,
        targetLoserSessionId,
      );

      expect(result.eliminated).toBe(true);
      expect(result.hp).toBeLessThanOrEqual(0);

      const aliveCount = Array.from(gameRoom.state.players.values()).filter(
        (player) => !player.eliminated,
      ).length;
      expect(aliveCount).toBe(3);

      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "排除後の次ラウンドで排除プレイヤーHPが変化せず、マッチ進行から外れる",
    { timeout: 60_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);
      const targetLoserSessionId = clients[0]!.sessionId;

      const eliminationResult = await forceEliminationByRealBattles(
        gameRoom,
        clients,
        targetLoserSessionId,
      );

      expect(eliminationResult.eliminated).toBe(true);

      const hpAfterElimination = eliminationResult.hp;
      const roundAfterElimination = eliminationResult.roundIndex;

      if (gameRoom.state.phase !== "End") {
        const cmdSeqBySessionId = new Map<string, number>(
          clients.map((client) => [client.sessionId, 100]),
        );

        await waitForPhase(gameRoom, "Prep", 5_000);
        submitPrepCommandsForRound(clients, targetLoserSessionId, cmdSeqBySessionId);
        await waitForCondition(
          () => gameRoom.state.phase === "Prep" || gameRoom.state.phase === "End",
          8_000,
        );
      }

      const targetPlayerAfter = gameRoom.state.players.get(targetLoserSessionId);

      expect(targetPlayerAfter?.eliminated).toBe(true);
      expect(targetPlayerAfter?.hp).toBe(hpAfterElimination);
      expect(gameRoom.state.roundIndex).toBeGreaterThanOrEqual(roundAfterElimination);

      for (const client of clients) {
        client.connection.close();
      }
    },
  );
});
