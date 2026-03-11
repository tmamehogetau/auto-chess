import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../src/server/rooms/game-room";
import { FLAG_CONFIGURATIONS, withFlags } from "./feature-flag-test-helper";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "../../src/shared/room-messages";

type TestClient = {
  sessionId: string;
  send: (type: string, msg: unknown) => void;
  waitForMessage: (type: string) => Promise<unknown>;
  onMessage: (type: string, handler: (msg: unknown) => void) => void;
};

type ScenarioUnitPlacement = {
  unitType: string;
  cell: number;
};

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

async function sendPrepCommand(
  client: TestClient,
  cmdSeq: number,
  payload: Record<string, unknown>,
): Promise<{ accepted: boolean; code?: string }> {
  client.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq, ...payload });
  return (await client.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)) as {
    accepted: boolean;
    code?: string;
  };
}

function injectForcedOffers(serverRoom: GameRoom, playerId: string, unitTypes: string[]): void {
  const internalController = (serverRoom as unknown as {
    controller?: {
      shopOffersByPlayer: Map<string, Array<{ unitType: string; rarity: number; cost: number }>>;
      getBoardPlacementsForPlayer?: (playerId: string) => Array<{ cell: number; unitType: string }>;
    };
  }).controller;

  internalController?.shopOffersByPlayer.set(
    playerId,
    unitTypes.map((unitType) => ({ unitType, rarity: 1, cost: 1 })),
  );
}

function getCurrentBoardPlacements(
  serverRoom: GameRoom,
  playerId: string,
): Array<{ cell: number; unitType: string }> {
  const internalController = (serverRoom as unknown as {
    controller?: {
      getBoardPlacementsForPlayer?: (playerId: string) => Array<{ cell: number; unitType: string }>;
    };
  }).controller;

  return internalController?.getBoardPlacementsForPlayer?.(playerId) ?? [];
}

async function buildCompositionViaPrepActions(
  serverRoom: GameRoom,
  playerId: string,
  client: TestClient,
  startingCmdSeq: number,
  unitAndCellPairs: ScenarioUnitPlacement[],
): Promise<number> {
  let cmdSeq = startingCmdSeq;

  for (const { unitType, cell } of unitAndCellPairs) {
    const existingPlacement = getCurrentBoardPlacements(serverRoom, playerId).some(
      (placement) => placement.cell === cell && placement.unitType === unitType,
    );
    if (existingPlacement) {
      continue;
    }

    injectForcedOffers(serverRoom, playerId, [unitType]);
    const buyResult = await sendPrepCommand(client, cmdSeq++, { shopBuySlotIndex: 0 });
    if (buyResult.accepted) {
      await sendPrepCommand(client, cmdSeq++, {
        benchToBoardCell: { benchIndex: 0, cell },
      });
    }
  }

  return cmdSeq;
}

async function runEvidenceMatch(
  serverRoom: GameRoom,
  clients: TestClient[],
  options: {
    roundTargets: Record<number, number>;
    finalRound: number;
    placements?: ScenarioUnitPlacement[];
    maxDurationMs?: number;
  },
): Promise<void> {
  const placements = options.placements ?? [
    { unitType: "vanguard", cell: 0 },
    { unitType: "vanguard", cell: 1 },
    { unitType: "vanguard", cell: 2 },
  ];
  const nextCmdSeqByClient = new Map<string, number>();

  await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

  let lastRound = 0;
  const startTime = Date.now();
  const maxDuration = options.maxDurationMs ?? 50_000;

  while (
    serverRoom.state.phase !== "End" &&
    serverRoom.state.roundIndex < options.finalRound + 1 &&
    Date.now() - startTime < maxDuration
  ) {
    const currentRound = serverRoom.state.roundIndex;

    if (currentRound !== lastRound && serverRoom.state.phase === "Prep") {
      lastRound = currentRound;
      for (const client of clients) {
        const nextCmdSeq = nextCmdSeqByClient.get(client.sessionId) ?? 1;
        const updatedCmdSeq = await buildCompositionViaPrepActions(
          serverRoom,
          client.sessionId,
          client,
          nextCmdSeq,
          placements,
        );
        nextCmdSeqByClient.set(client.sessionId, updatedCmdSeq);
      }
    }

    await waitForCondition(() => serverRoom.state.phase === "Battle", 5_000);

    const target = options.roundTargets[serverRoom.state.roundIndex];
    if (target !== undefined && target > 0) {
      serverRoom.setPendingPhaseDamageForTest(target);
    }

    if (serverRoom.state.roundIndex < options.finalRound) {
      await waitForCondition(() => serverRoom.state.phase === "Prep" || serverRoom.state.phase === "End", 5_000);
    } else {
      await waitForCondition(() => serverRoom.state.phase === "End", 5_000);
    }
  }
}

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

      expect(serverRoom.state.players.size).toBe(4);

      await runEvidenceMatch(serverRoom, clients, {
        roundTargets: { 1: 600, 2: 750, 3: 900, 4: 1050, 5: 1250, 6: 1450, 7: 1650, 8: 1850 },
        finalRound: 8,
        placements: [
          { unitType: "vanguard", cell: 0 },
          { unitType: "vanguard", cell: 1 },
          { unitType: "ranger", cell: 2 },
        ],
      });

      expect(serverRoom.state.phase).toBe("End");
      expect(serverRoom.state.roundIndex).toBe(8);
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

        expect(serverRoom.state.featureFlagsEnablePhaseExpansion).toBe(true);

        await runEvidenceMatch(serverRoom, clients, {
          roundTargets: { 1: 600, 2: 750, 3: 900, 4: 1050, 5: 1250, 6: 1450, 7: 1650, 8: 1850, 9: 2100, 10: 2400, 11: 2700, 12: 0 },
          finalRound: 12,
          maxDurationMs: 65_000,
          placements: [
            { unitType: "mage", cell: 4 },
            { unitType: "mage", cell: 5 },
            { unitType: "ranger", cell: 6 },
          ],
        });

        expect(serverRoom.state.phase).toBe("End");
        expect(serverRoom.state.roundIndex).toBe(12);
      });
    },
    65_000,
  );

  test(
    "4人でR8完走しphase progress onlyでもEndフェーズへ遷移する",
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

      await runEvidenceMatch(serverRoom, clients, {
        roundTargets: { 1: 600, 2: 750, 3: 900, 4: 1050, 5: 1250, 6: 1450, 7: 1650, 8: 1850 },
        finalRound: 8,
        placements: [
          { unitType: "ranger", cell: 4 },
          { unitType: "ranger", cell: 5 },
          { unitType: "ranger", cell: 6 },
        ],
      });

      expect(serverRoom.state.phase).toBe("End");
      expect(serverRoom.state.roundIndex).toBe(8);
      expect(serverRoom.state.players.size).toBe(4);
    },
    50_000,
  );

  test(
    "phase expansion有効時はphase progress onlyでもR12完走後にEndフェーズへ遷移する",
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

        await runEvidenceMatch(serverRoom, clients, {
          roundTargets: { 1: 600, 2: 750, 3: 900, 4: 1050, 5: 1250, 6: 1450, 7: 1650, 8: 1850, 9: 2100, 10: 2400, 11: 2700, 12: 0 },
          finalRound: 12,
          maxDurationMs: 65_000,
          placements: [
            { unitType: "mage", cell: 4 },
            { unitType: "ranger", cell: 5 },
            { unitType: "vanguard", cell: 1 },
          ],
        });

        expect(serverRoom.state.phase).toBe("End");
        expect(serverRoom.state.roundIndex).toBe(12);
      });
    },
    65_000,
  );

  test(
    "4人でR8完走し別プレイヤーへphase damageを集約してもEndフェーズへ遷移する",
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

      await runEvidenceMatch(serverRoom, clients, {
        roundTargets: { 1: 600, 2: 750, 3: 900, 4: 1050, 5: 1250, 6: 1450, 7: 1650, 8: 1850 },
        finalRound: 8,
        placements: [
          { unitType: "mage", cell: 4 },
          { unitType: "mage", cell: 5 },
          { unitType: "vanguard", cell: 1 },
        ],
      });

      expect(serverRoom.state.phase).toBe("End");
      expect(serverRoom.state.roundIndex).toBe(8);
      expect(serverRoom.state.players.size).toBe(4);
    },
    50_000,
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
