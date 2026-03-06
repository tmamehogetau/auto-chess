import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../src/server/rooms/game-room";
import { FLAG_CONFIGURATIONS, withFlags } from "./feature-flag-test-helper";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "../../src/shared/room-messages";

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

describe("Full Game Simulation (R1-R8)", () => {
  let testServer!: ColyseusTestServer;

  const TEST_SERVER_PORT = 2_572;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 300,
          prepDurationMs: 80,
          battleDurationMs: 80,
          settleDurationMs: 50,
          eliminationDurationMs: 50,
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

  test(
    "4人でR8完走後にEndフェーズへ遷移する",
    async () => {
      const serverRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      for (const client of clients) {
        client.onMessage(
          SERVER_MESSAGE_TYPES.ROUND_STATE,
          (_message: unknown) => {},
        );
      }

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      // Wait for game to start
      await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

      // Verify all 4 players are in the game initially
      expect(serverRoom.state.players.size).toBe(4);

      // Wait for game to complete R1-R8 and reach End phase
      const maxDuration = 45_000;
      await waitForCondition(
        () => serverRoom.state.phase === "End" && serverRoom.state.roundIndex === 8,
        maxDuration,
      );

      // Verify final state
      expect(serverRoom.state.phase).toBe("End");
      expect(serverRoom.state.roundIndex).toBe(8);

      // Verify all 4 players are still in the game
      expect(serverRoom.state.players.size).toBe(4);
    },
    50_000,
  );

  test(
    "各ラウンドで正しいフェーズサイクルが実行される",
    async () => {
      const serverRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      for (const client of clients) {
        client.onMessage(
          SERVER_MESSAGE_TYPES.ROUND_STATE,
          (_message: unknown) => {},
        );
      }

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      const phases: string[] = [];

      // Wait for game to start
      await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

      // Track phase changes for 2 rounds
      let lastPhase = "";
      const startTime = Date.now();
      const maxDuration = 8_000;

      while (Date.now() - startTime < maxDuration) {
        const currentPhase = serverRoom.state.phase;

        if (currentPhase !== lastPhase) {
          phases.push(currentPhase);
          lastPhase = currentPhase;
        }

        if (serverRoom.state.phase === "End") {
          break;
        }

        // Stop after we've seen a complete cycle and more
        if (phases.length >= 6) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Verify we saw the expected phases
      expect(phases).toContain("Prep");
      expect(phases).toContain("Battle");
      expect(phases).toContain("Settle");
      expect(phases).toContain("Elimination");
    },
    15_000,
  );

  test(
    "phase expansion有効時は4人でR12完走後にEndフェーズへ遷移する",
    async () => {
      await withFlags(FLAG_CONFIGURATIONS.PHASE_EXPANSION_ONLY, async () => {
        const serverRoom = await testServer.createRoom<GameRoom>("game");
        const clients = await Promise.all([
          testServer.connectTo(serverRoom),
          testServer.connectTo(serverRoom),
          testServer.connectTo(serverRoom),
          testServer.connectTo(serverRoom),
        ]);

        for (const client of clients) {
          client.onMessage(
            SERVER_MESSAGE_TYPES.ROUND_STATE,
            (_message: unknown) => {},
          );
        }

        for (const client of clients) {
          client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
        }

        await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

        expect(serverRoom.state.featureFlagsEnablePhaseExpansion).toBe(true);

        await waitForCondition(
          () => serverRoom.state.phase === "End" && serverRoom.state.roundIndex === 12,
          60_000,
        );

        expect(serverRoom.state.phase).toBe("End");
        expect(serverRoom.state.roundIndex).toBe(12);
      });
    },
    65_000,
  );

  test(
    "プレイヤーが4人接続したままゲームが継続する",
    async () => {
      const serverRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      for (const client of clients) {
        client.onMessage(
          SERVER_MESSAGE_TYPES.ROUND_STATE,
          (_message: unknown) => {},
        );
      }

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      // Wait for game to start
      await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

      // Verify all 4 players are in the game initially
      expect(serverRoom.state.players.size).toBe(4);

      // Wait for 2 rounds and verify players are still connected
      await waitForCondition(
        () => serverRoom.state.roundIndex >= 1 || serverRoom.state.phase === "End",
        8_000,
      );

      // All 4 players should still be in the game (not eliminated yet)
      expect(serverRoom.state.players.size).toBe(4);
    },
    15_000,
  );

  test(
    "round_stateメッセージが各フェーズで送信される",
    async () => {
      const serverRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await Promise.all([
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
        testServer.connectTo(serverRoom),
      ]);

      const receivedRoundStates: Array<{
        phase: string;
        roundIndex: number;
      }> = [];

      for (const client of clients) {
        client.onMessage(
          SERVER_MESSAGE_TYPES.ROUND_STATE,
          (message: { phase: string; roundIndex: number }) => {
            receivedRoundStates.push({
              phase: message.phase,
              roundIndex: message.roundIndex,
            });
          },
        );
      }

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      // Wait for game to start and progress
      await waitForCondition(
        () => serverRoom.state.roundIndex >= 1 || serverRoom.state.phase === "End",
        8_000,
      );

      // Verify we received multiple round_state messages
      expect(receivedRoundStates.length).toBeGreaterThan(0);

      // Verify messages contain valid data
      const uniquePhases = new Set(receivedRoundStates.map((rs) => rs.phase));
      expect(uniquePhases.has("Prep")).toBe(true);
    },
    15_000,
  );
});
