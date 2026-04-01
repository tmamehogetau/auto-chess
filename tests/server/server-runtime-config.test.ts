import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";

import { buildServer } from "../../server";
import { GameRoom } from "../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../src/server/rooms/shared-board-room";
import { DEFAULT_FLAGS } from "../../src/shared/feature-flags";
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

const registerRoundStateListeners = (
  clients: Array<{ onMessage: (type: string, handler: (_message: unknown) => void) => void }>,
): void => {
  for (const client of clients) {
    client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
  }
};

const resolveBossRoleSelectionToPrep = async (
  gameRoom: GameRoom,
  clients: Array<{
    sessionId: string;
    send: (type: string, message?: unknown) => void;
  }>,
  timeoutMs = 3_000,
): Promise<void> => {
  const bossClient = clients[1];
  const raidClientA = clients[0];
  const raidClientB = clients[2];
  const raidClientC = clients[3];

  if (!bossClient || !raidClientA || !raidClientB || !raidClientC) {
    throw new Error("Expected four clients for role selection");
  }

  bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
  await waitForCondition(
    () => gameRoom.state.players.get(bossClient.sessionId)?.wantsBoss === true,
    timeoutMs,
  );

  for (const client of clients) {
    client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
  }

  await waitForCondition(() => gameRoom.state.lobbyStage === "selection", timeoutMs);

  raidClientA.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
  raidClientB.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
  raidClientC.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });
  bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

  await waitForCondition(() => gameRoom.state.phase === "Prep", timeoutMs);
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

    registerRoundStateListeners(clients);
    await resolveBossRoleSelectionToPrep(gameRoom, clients, 3_000);

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

  test("dedicated game room exposes its sharedBoardRoomId through state and round_state", async () => {
    const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const gameRoom = await testServer.createRoom<GameRoom>("game", {
      sharedBoardRoomId: sharedBoardRoom.roomId,
    });
    const clients = await Promise.all([
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const roundState = await roundStatePromise;

    expect(gameRoom.state.sharedBoardRoomId).toBe(sharedBoardRoom.roomId);
    expect(roundState.sharedBoardRoomId).toBe(sharedBoardRoom.roomId);
    expect(clients[0]?.sessionId.length).toBeGreaterThan(0);
  });

  test("runtime local-play server enables the current player-facing release slice flags", async () => {
    const gameRoom = await testServer.createRoom<GameRoom>("game");
    const clients = await Promise.all([
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
    ]);
    registerRoundStateListeners(clients);

    const roundStates: Array<unknown> = [];
    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message: unknown) => {
        roundStates.push(message);
      });
    }

    await resolveBossRoleSelectionToPrep(gameRoom, clients, 3_000);
    const roundState = roundStates.at(-1) as Record<string, unknown> | undefined;

    expect(gameRoom.state.featureFlagsEnableHeroSystem).toBe(true);
    expect(gameRoom.state.featureFlagsEnableBossExclusiveShop).toBe(true);
    expect(gameRoom.state.featureFlagsEnableSpellCard).toBe(true);
    expect(gameRoom.state.featureFlagsEnableSharedBoardShadow).toBe(true);

    expect(roundState?.phase).toBeDefined();
    expect(roundState?.sharedBoardRoomId).toBe(gameRoom.state.sharedBoardRoomId);
    expect(gameRoom.state.featureFlagsEnableHeroSystem).toBe(DEFAULT_FLAGS.enableHeroSystem);
    expect(gameRoom.state.featureFlagsEnableBossExclusiveShop).toBe(
      DEFAULT_FLAGS.enableBossExclusiveShop,
    );
    expect(gameRoom.state.featureFlagsEnableTouhouRoster).toBe(DEFAULT_FLAGS.enableTouhouRoster);
    expect(gameRoom.state.featureFlagsEnableTouhouFactions).toBe(
      DEFAULT_FLAGS.enableTouhouFactions,
    );
    expect(gameRoom.state.featureFlagsEnableSharedPool).toBe(
      DEFAULT_FLAGS.enableSharedPool || DEFAULT_FLAGS.enablePerUnitSharedPool,
    );
    expect(gameRoom.state.featureFlagsEnableSubUnitSystem).toBe(
      DEFAULT_FLAGS.enableSubUnitSystem,
    );
    expect(gameRoom.state.featureFlagsEnableSpellCard).toBe(DEFAULT_FLAGS.enableSpellCard);
    expect(gameRoom.state.featureFlagsEnableSharedBoardShadow).toBe(true);
  });
});
