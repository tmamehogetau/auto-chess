import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";

import { buildServer } from "../../server";
import { GameRoom } from "../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../src/server/rooms/shared-board-room";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
} from "../../src/shared/room-messages";
import { DEFAULT_SHARED_BOARD_CONFIG, sharedBoardCoordinateToIndex } from "../../src/shared/shared-board-config";

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

describe("runtime shared_board server config", () => {
  let testServer!: ColyseusTestServer;

  beforeAll(async () => {
    const server = buildServer({
      gameRoomOptions: {
        readyAutoStartMs: 2_000,
        prepDurationMs: 1_500,
        battleDurationMs: 800,
        settleDurationMs: 300,
        eliminationDurationMs: 300,
      },
    });
    await server.listen(26_572);
    testServer = new ColyseusTestServer(server);
  });

  afterEach(async () => {
    await testServer.cleanup();
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  test("shared_board room boots with the default 6x6 board and accepts lower-half raid placements", async () => {
    const room = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const bottomLeftRaidCell = sharedBoardCoordinateToIndex({ x: 0, y: 5 });

    expect(room.state.boardWidth).toBe(DEFAULT_SHARED_BOARD_CONFIG.width);
    expect(room.state.boardHeight).toBe(DEFAULT_SHARED_BOARD_CONFIG.height);

    const result = room.applyPlacementsFromGame("player-1", [
      { cell: bottomLeftRaidCell, unitType: "ranger" },
    ]);

    expect(result).toEqual({ applied: 1, skipped: 0 });
    expect(room.state.cells.get(String(bottomLeftRaidCell))?.ownerId).toBe("player-1");
  });

  test("runtime local-play server reflects bench deployments onto shared_board cells", async () => {
    const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const gameRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => gameRoom.state.phase === "Prep", 3_000);

    const ownerClient = clients[0];
    if (!ownerClient) {
      throw new Error("Expected owner client");
    }

    const raidCell = sharedBoardCoordinateToIndex({ x: 1, y: 4 });

    ownerClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });
    expect(await ownerClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    ownerClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      benchToBoardCell: {
        benchIndex: 0,
        cell: raidCell,
      },
    });
    expect(await ownerClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    await waitForCondition(() => {
      const reflectedCell = sharedBoardRoom.state.cells.get(String(raidCell));
      return reflectedCell?.ownerId === ownerClient.sessionId && reflectedCell.unitId !== "";
    }, 3_000);

    expect(sharedBoardRoom.state.cells.get(String(raidCell))?.ownerId).toBe(ownerClient.sessionId);
  });
});
