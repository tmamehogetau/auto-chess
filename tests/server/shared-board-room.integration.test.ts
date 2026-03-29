import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import {
  SharedBoardRoom,
  type PlacementChangeListener,
} from "../../src/server/rooms/shared-board-room";
import { combatCellToRaidBoardIndex, raidBoardIndexToCombatCell } from "../../src/shared/board-geometry";
import {
  DEFAULT_SHARED_BOARD_CONFIG,
  sharedBoardCoordinateToIndex,
} from "../../src/shared/shared-board-config";
import type { SharedBoardCellState } from "../../src/server/schema/shared-board-state";
import {
  createBattleEndEvent,
  createBattleStartEvent,
} from "../../src/server/combat/battle-timeline";

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

const sendConcurrently = async (
  operations: Array<() => void>,
): Promise<void> => {
  await Promise.all(
    operations.map(
      (operation) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            operation();
            resolve();
          }, 0);
        }),
    ),
  );
};

const seedSharedBoardUnit = (
  serverRoom: SharedBoardRoom,
  playerId: string,
  cellIndex: number,
  unitType: "vanguard" | "ranger" | "mage" | "assassin" = "vanguard",
): { unitId: string; cellIndex: number } => {
  const result = serverRoom.applyPlacementsFromGame(playerId, [{ cell: cellIndex, unitType }]);

  expect(result).toEqual({ applied: 1, skipped: 0 });

  const targetCell = serverRoom.state.cells.get(String(cellIndex));

  if (!targetCell || targetCell.unitId === "") {
    throw new Error(`Expected seeded unit for ${playerId} at shared cell ${cellIndex}`);
  }

  return {
    unitId: targetCell.unitId,
    cellIndex,
  };
};

const findFirstEmptyCellIndex = (
  serverRoom: SharedBoardRoom,
  excludedIndexes: number[] = [],
): number => {
  const excludedSet = new Set(excludedIndexes);
  const candidate = [...serverRoom.state.cells.values()].reverse().find(
    (cell) =>
      cell.index !== serverRoom.state.dummyBossCell
      && raidBoardIndexToCombatCell(cell.index) !== null
      && cell.unitId === ""
      && !excludedSet.has(cell.index),
  );

  if (!candidate) {
    throw new Error("Expected an empty target cell");
  }

  return candidate.index;
};

const findOwnedUnit = (
  serverRoom: SharedBoardRoom,
  ownerId: string,
): SharedBoardCellState => {
  const cell = [...serverRoom.state.cells.values()].find(
    (entry) => entry.ownerId === ownerId && entry.unitId !== "",
  );

  if (!cell) {
    throw new Error(`Expected ${ownerId} to own a unit`);
  }

  return cell;
};

describe("SharedBoardRoom integration", () => {
  let testServer!: ColyseusTestServer;

  const TEST_SERVER_PORT = 2_571;

  const CLIENT_MESSAGE_TYPES = {
    CURSOR_MOVE: "shared_cursor_move",
    SELECT_UNIT: "shared_select_unit",
    DRAG_STATE: "shared_drag_state",
    PLACE_UNIT: "shared_place_unit",
    RESET: "shared_reset",
    REQUEST_ROLE: "shared_request_role",
  } as const;

  const SERVER_MESSAGE_TYPES = {
    ROLE: "shared_role",
    ACTION_RESULT: "shared_action_result",
  } as const;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        shared_board: defineRoom(SharedBoardRoom, {
          lockDurationMs: 500,
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

  test("6x6 board defaults expose the full raid lower half as playable", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const roomInternals = serverRoom as unknown as {
      isPlayablePlacementCellIndex: (cellIndex: number) => boolean;
    };

    expect(serverRoom.state.boardWidth).toBe(6);
    expect(serverRoom.state.boardHeight).toBe(6);
    expect(serverRoom.state.cells.size).toBe(36);
    expect(
      roomInternals.isPlayablePlacementCellIndex(
        combatCellToRaidBoardIndex(0),
      ),
    ).toBe(true);
    expect(roomInternals.isPlayablePlacementCellIndex(18)).toBe(true);
    expect(roomInternals.isPlayablePlacementCellIndex(1)).toBe(false);
  });

  test("battle replay mode seeds battle units and rejects board edits", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom, { gamePlayerId: "raid-player-1" });

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    const role = await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE, 5_000);
    expect(role.isSpectator).toBe(false);

    serverRoom.applyBattleReplayFromGame({
      phase: "Battle",
      phaseDeadlineAtMs: Date.now() + 2_000,
      battleId: "battle-raid-1",
      timeline: [
        createBattleStartEvent({
          battleId: "battle-raid-1",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-1",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
            {
              battleUnitId: "boss-ranger-1",
              side: "boss",
              x: 5,
              y: 0,
              currentHp: 50,
              maxHp: 50,
            },
          ],
        }),
        createBattleEndEvent({
          type: "battleEnd",
          battleId: "battle-raid-1",
          atMs: 900,
          winner: "raid",
        }),
      ],
    });

    expect(serverRoom.state.mode).toBe("battle");
    expect(serverRoom.state.battleId).toBe("battle-raid-1");
    expect(serverRoom.state.cells.get("18")?.unitId).toContain("battle:");
    expect(serverRoom.state.cells.get("5")?.unitId).toContain("battle:");

    client.send(CLIENT_MESSAGE_TYPES.RESET);
    const result = await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT, 5_000);
    expect(result).toEqual({
      accepted: false,
      action: "reset",
      code: "PHASE_MISMATCH",
    });
  });

  test("最初の4接続がactiveで5人目がspectatorになる", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");

    const clientPromises = [
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ];

    const clients = await Promise.all(clientPromises);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    const rolePromises = clients.map((client) =>
      client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE, 5000),
    );

    const roles = await Promise.all(rolePromises);

    const activeRoles = roles.filter((role) => !role.isSpectator);
    const spectatorRoles = roles.filter((role) => role.isSpectator);

    expect(activeRoles).toHaveLength(4);
    expect(spectatorRoles).toHaveLength(1);
    expect(spectatorRoles[0].slotIndex).toBe(-1);

    const activeSlots = activeRoles
      .map((role) => role.slotIndex)
      .sort((left, right) => left - right);
    expect(activeSlots).toEqual([0, 1, 2, 3]);
  });

  test("spectator join option は active 枠を消費せず operator を観戦専用にする", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");

    const operatorClient = await testServer.connectTo(serverRoom, { spectator: true });
    const activeClients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    await waitForCondition(() => serverRoom.state.players.size === 5, 1_000);

    const operatorState = serverRoom.state.players.get(operatorClient.sessionId);
    expect(operatorState).toMatchObject({
      isSpectator: true,
      slotIndex: -1,
    });

    const activeStates = activeClients
      .map((client) => serverRoom.state.players.get(client.sessionId))
      .filter((player): player is NonNullable<typeof player> => player !== undefined);

    expect(activeStates).toHaveLength(4);
    expect(activeStates.every((player) => player.isSpectator === false)).toBe(true);
    expect(
      activeStates.map((player) => player.slotIndex).sort((left, right) => left - right),
    ).toEqual([0, 1, 2, 3]);
  });

  test("spectator leave does not clear the live owner's units", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const activeClient = await testServer.connectTo(serverRoom, { gamePlayerId: "raid-player-1" });
    const seededUnit = seedSharedBoardUnit(serverRoom, activeClient.sessionId, 18);

    const spectatorClient = await testServer.connectTo(serverRoom, {
      gamePlayerId: "raid-player-1",
      spectator: true,
    });

    spectatorClient.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    const spectatorRole = await spectatorClient.waitForMessage(SERVER_MESSAGE_TYPES.ROLE, 5_000);
    expect(spectatorRole).toMatchObject({
      isSpectator: true,
      slotIndex: -1,
    });

    await spectatorClient.leave(true);
    await waitForCondition(() => !serverRoom.state.players.has(spectatorClient.sessionId), 1_000);

    expect(serverRoom.state.cells.get(String(seededUnit.cellIndex))).toMatchObject({
      ownerId: activeClient.sessionId,
      unitId: seededUnit.unitId,
    });
  });

  test("join時にdummy-boss以外の初期トークンを生成しない", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");

    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));
    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE, 5_000)),
    );

    const occupiedCells = Array.from(serverRoom.state.cells.values()).filter(
      (cell) => cell.unitId !== "" && cell.unitId !== "dummy-boss",
    );

    expect(occupiedCells).toHaveLength(0);
  });

  test("同意離脱でactive枠が即時解放され新規接続がactiveになる", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    const roles = await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const leavingIndex = roles.findIndex((role) => !role.isSpectator);

    if (leavingIndex < 0) {
      throw new Error("Expected one active player to leave");
    }

    const leavingClient = clients[leavingIndex];

    if (!leavingClient) {
      throw new Error("Expected resolved active client");
    }

    const leavingSessionId = leavingClient.sessionId;

    leavingClient.connection.close(4000, "leave");

    await waitForCondition(() => !serverRoom.state.players.get(leavingSessionId), 1_000);

    const newClient = await testServer.connectTo(serverRoom);
    newClient.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    const newRole = await newClient.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    expect(newRole.isSpectator).toBe(false);
    expect(newRole.slotIndex).toBeGreaterThanOrEqual(0);
  });

  test("異常切断後の再接続でactive枠を維持しROLEが再送される", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    const roles = await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const droppedClient = clients[0];
    const previousSessionId = droppedClient.sessionId;
    const previousSlotIndex = roles[0].slotIndex;
    const reconnectionToken = droppedClient.reconnectionToken;

    droppedClient.connection.close(4001, "network drop");

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(previousSessionId);
      return player?.connected === false;
    }, 1_000);

    const reconnectedClient = await testServer.sdk.reconnect(reconnectionToken);
    reconnectedClient.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    const roleAfterReconnect =
      await reconnectedClient.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    expect(reconnectedClient.sessionId).toBe(previousSessionId);
    expect(roleAfterReconnect.isSpectator).toBe(false);
    expect(roleAfterReconnect.slotIndex).toBe(previousSlotIndex);

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(previousSessionId);
      return player?.connected === true;
    }, 1_000);
  });

  test("spectatorがplace/resetするとNOT_ACTIVE_PLAYERで拒否される", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    const roles = await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const spectatorIndex = roles.findIndex((role) => role.isSpectator);
    const activeIndex = roles.findIndex((role) => !role.isSpectator);

    if (spectatorIndex < 0 || activeIndex < 0) {
      throw new Error("Expected one spectator and at least one active player");
    }

    const spectatorClient = clients[spectatorIndex];
    const activeClient = clients[activeIndex];

    if (!spectatorClient || !activeClient) {
      throw new Error("Expected resolved clients for spectator and active players");
    }

    spectatorClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: "any-unit-id",
      toCell: 0,
    });

    const placeReject =
      await spectatorClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "NOT_ACTIVE_PLAYER",
    });

    spectatorClient.send(CLIENT_MESSAGE_TYPES.RESET);

    const resetReject =
      await spectatorClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(resetReject).toEqual({
      accepted: false,
      action: "reset",
      code: "NOT_ACTIVE_PLAYER",
    });

    activeClient.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, {
      unitId: "any-unit-id",
    });

    const selectReject =
      await activeClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(selectReject).toEqual({
      accepted: false,
      action: "select_unit",
      code: "UNIT_NOT_OWNED",
    });
  });

  test("activeプレイヤーが他人ユニットをselect/placeするとUNIT_NOT_OWNED", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const firstClient = clients[0];
    const secondClient = clients[1];

    await waitForCondition(() => {
      const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);
      return firstPlayer !== undefined;
    }, 1_000);

    const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);

    if (!firstPlayer) {
      throw new Error("Expected first player to exist");
    }

    const firstUnitId = seedSharedBoardUnit(
      serverRoom,
      firstClient.sessionId,
      combatCellToRaidBoardIndex(0),
    ).unitId;

    secondClient.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, {
      unitId: firstUnitId,
    });

    const selectReject =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(selectReject).toEqual({
      accepted: false,
      action: "select_unit",
      code: "UNIT_NOT_OWNED",
    });

    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: 5,
    });

    const placeReject =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "UNIT_NOT_OWNED",
    });
  });

  test("place は unitId が衝突しても所有者の source cell を優先する", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const [firstClient, secondClient] = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    const firstSeed = seedSharedBoardUnit(serverRoom, firstClient.sessionId, 19, "vanguard");
    const secondSeed = seedSharedBoardUnit(serverRoom, secondClient.sessionId, 31, "ranger");
    const secondSourceCell = serverRoom.state.cells.get(String(secondSeed.cellIndex));

    if (!secondSourceCell) {
      throw new Error("Expected second source cell");
    }

    secondSourceCell.unitId = firstSeed.unitId;

    const targetCellIndex = 33;

    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstSeed.unitId,
      toCell: targetCellIndex,
    });

    expect(await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT)).toEqual({
      accepted: true,
      action: "place_unit",
    });

    expect(serverRoom.state.cells.get(String(firstSeed.cellIndex))?.ownerId).toBe(firstClient.sessionId);
    expect(serverRoom.state.cells.get(String(secondSeed.cellIndex))?.unitId).toBe("");
    expect(serverRoom.state.cells.get(String(targetCellIndex))?.ownerId).toBe(secondClient.sessionId);
  });

  test("occupiedセルへのplaceでTARGET_OCCUPIED", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const firstClient = clients[0];
    const secondClient = clients[1];

    await waitForCondition(() => {
      const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);
      const secondPlayer = serverRoom.state.players.get(secondClient.sessionId);
      return firstPlayer !== undefined && secondPlayer !== undefined;
    }, 1_000);

    const { cellIndex: firstCellIndex } = seedSharedBoardUnit(
      serverRoom,
      firstClient.sessionId,
      combatCellToRaidBoardIndex(0),
    );
    const { unitId: secondUnitId } = seedSharedBoardUnit(
      serverRoom,
      secondClient.sessionId,
      combatCellToRaidBoardIndex(1),
      "ranger",
    );

    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: secondUnitId,
      toCell: firstCellIndex,
    });

    const placeReject =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_OCCUPIED",
    });
  });

  test("自分の occupied cell へのplaceは board swap として受理する", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(client.sessionId);
      return player !== undefined;
    }, 1_000);

    const firstCellIndex = combatCellToRaidBoardIndex(0);
    const secondCellIndex = combatCellToRaidBoardIndex(1);
    expect(
      serverRoom.applyPlacementsFromGame(
        client.sessionId,
        [
          { cell: firstCellIndex, unitType: "vanguard" },
          { cell: secondCellIndex, unitType: "ranger" },
        ],
      ),
    ).toEqual({ applied: 2, skipped: 0 });

    const firstUnitId = serverRoom.state.cells.get(String(firstCellIndex))?.unitId;
    const secondUnitId = serverRoom.state.cells.get(String(secondCellIndex))?.unitId;

    if (!firstUnitId || !secondUnitId) {
      throw new Error("Expected two owned units to be seeded");
    }

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: secondCellIndex,
    });

    expect(await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT)).toEqual({
      accepted: true,
      action: "place_unit",
    });

    expect(serverRoom.state.cells.get(String(firstCellIndex))?.unitId).toBe(secondUnitId);
    expect(serverRoom.state.cells.get(String(secondCellIndex))?.unitId).toBe(firstUnitId);
    expect(serverRoom.state.cells.get(String(firstCellIndex))?.ownerId).toBe(client.sessionId);
    expect(serverRoom.state.cells.get(String(secondCellIndex))?.ownerId).toBe(client.sessionId);
  });

  test("通常ユニットで自分の hero occupied cell を選んでも TARGET_OCCUPIED で拒否する", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(client.sessionId);
      return player !== undefined;
    }, 1_000);

    const heroCellIndex = sharedBoardCoordinateToIndex({ x: 0, y: 5 });
    expect(
      serverRoom.applyPlacementsFromGame(
        client.sessionId,
        [
          { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
          { cell: heroCellIndex, unitType: "ranger" },
        ],
      ),
    ).toEqual({ applied: 2, skipped: 0 });

    const heroCell = serverRoom.state.cells.get(String(heroCellIndex));
    if (!heroCell) {
      throw new Error("Expected hero cell to exist");
    }
    heroCell.unitId = `hero:${client.sessionId}`;
    heroCell.ownerId = client.sessionId;
    heroCell.displayName = "Hero";
    heroCell.portraitKey = "reimu";

    const vanguardUnitId = serverRoom.state.cells.get(String(combatCellToRaidBoardIndex(0)))?.unitId;

    if (!vanguardUnitId) {
      throw new Error("Expected normal unit to be seeded");
    }

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: vanguardUnitId,
      toCell: heroCellIndex,
    });

    expect(await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT)).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_OCCUPIED",
    });
  });

  test("無効セルへのplaceでTARGET_OCCUPIED", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(client.sessionId);
      return player !== undefined;
    }, 1_000);

    const unitId = seedSharedBoardUnit(serverRoom, client.sessionId, combatCellToRaidBoardIndex(0)).unitId;

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId,
      toCell: -1,
    });

    const outOfRangeReject =
      await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(outOfRangeReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_OCCUPIED",
    });

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId,
      toCell: serverRoom.state.dummyBossCell,
    });

    const bossCellReject = await client.waitForMessage(
      SERVER_MESSAGE_TYPES.ACTION_RESULT,
    );
    expect(bossCellReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_OCCUPIED",
    });
  });

  test("中央4x2の外へのplaceでTARGET_OCCUPIED", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(client.sessionId);
      return player !== undefined;
    }, 1_000);

    const unitId = seedSharedBoardUnit(serverRoom, client.sessionId, combatCellToRaidBoardIndex(0)).unitId;

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId,
      toCell: 0,
    });

    const nonPlayableReject =
      await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(nonPlayableReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_OCCUPIED",
    });
  });

  test("ロック中セルへの他プレイヤーplaceでTARGET_LOCKED", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const firstClient = clients[0];
    const secondClient = clients[1];

    await waitForCondition(() => {
      const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);
      return firstPlayer !== undefined;
    }, 1_000);

    const { unitId: firstUnitId, cellIndex: firstCellIndex } = seedSharedBoardUnit(
      serverRoom,
      firstClient.sessionId,
      combatCellToRaidBoardIndex(0),
    );
    const emptyCellIndex = findFirstEmptyCellIndex(serverRoom, [firstCellIndex]);

    firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: emptyCellIndex,
    });

    const placeResult =
      await firstClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeResult).toEqual({ accepted: true, action: "place_unit" });

    const secondUnitId = seedSharedBoardUnit(serverRoom, secondClient.sessionId, combatCellToRaidBoardIndex(1), "ranger").unitId;

    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: secondUnitId,
      toCell: emptyCellIndex,
    });

    const lockedReject =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(lockedReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_LOCKED",
    });
  });

  test("lockDuration後は同じセルにplaceはTARGET_OCCUPIEDで拒否", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const firstClient = clients[0];
    const secondClient = clients[1];

    await waitForCondition(() => {
      const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);
      return firstPlayer !== undefined;
    }, 1_000);

    const { unitId: firstUnitId, cellIndex: firstCellIndex } = seedSharedBoardUnit(
      serverRoom,
      firstClient.sessionId,
      combatCellToRaidBoardIndex(0),
    );
    const emptyCellIndex = findFirstEmptyCellIndex(serverRoom, [firstCellIndex]);

    firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: emptyCellIndex,
    });

    await firstClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);

    const secondUnitId = seedSharedBoardUnit(serverRoom, secondClient.sessionId, combatCellToRaidBoardIndex(1), "ranger").unitId;

    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: secondUnitId,
      toCell: emptyCellIndex,
    });

    const lockedReject =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(lockedReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_LOCKED",
    });

    await waitForCondition(
      () => {
        const cell = serverRoom.state.cells.get(String(emptyCellIndex));
        return (
          cell !== undefined &&
          (cell.lockedBy === "" || cell.lockUntilMs <= Date.now())
        );
      },
      1_000,
    );

    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: secondUnitId,
      toCell: emptyCellIndex,
    });

    const occupiedReject =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(occupiedReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_OCCUPIED",
    });

    await waitForCondition(
      () => {
        const cell = serverRoom.state.cells.get(String(emptyCellIndex));
        return cell !== undefined && cell.ownerId === firstClient.sessionId;
      },
      1_000,
    );

    const finalCell = serverRoom.state.cells.get(String(emptyCellIndex));
    expect(finalCell?.ownerId).toBe(firstClient.sessionId);
    expect(finalCell?.unitId).toBe(firstUnitId);
  });

  test("lockDuration後、空きセルへの再試行は成功", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const firstClient = clients[0];
    const secondClient = clients[1];

    await waitForCondition(() => {
      const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);
      return firstPlayer !== undefined;
    }, 1_000);

    const { unitId: firstUnitId, cellIndex: firstSourceCellIndex } = seedSharedBoardUnit(
      serverRoom,
      firstClient.sessionId,
      combatCellToRaidBoardIndex(0),
    );
    const cellAIndex = findFirstEmptyCellIndex(serverRoom, [firstSourceCellIndex]);
    const cellBIndex = findFirstEmptyCellIndex(serverRoom, [firstSourceCellIndex, cellAIndex]);

    // P1が空きセルAへ配置
    firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: cellAIndex,
    });

    await firstClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);

    const secondUnitId = seedSharedBoardUnit(serverRoom, secondClient.sessionId, combatCellToRaidBoardIndex(1), "ranger").unitId;

    // P2がAへ即時配置でTARGET_LOCKED
    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: secondUnitId,
      toCell: cellAIndex,
    });

    const lockedReject =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(lockedReject).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_LOCKED",
    });

    // lock切れ待ち
    await waitForCondition(
      () => {
        const cell = serverRoom.state.cells.get(String(cellAIndex));
        return (
          cell !== undefined &&
          (cell.lockedBy === "" || cell.lockUntilMs <= Date.now())
        );
      },
      1_000,
    );

    // P1がAから空きセルBへ移動してAを空ける
    firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: cellBIndex,
    });

    await firstClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);

    // P2がAへ再試行で成功
    secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: secondUnitId,
      toCell: cellAIndex,
    });

    const placeResult =
      await secondClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeResult).toEqual({ accepted: true, action: "place_unit" });

    await waitForCondition(
      () => {
        const cell = serverRoom.state.cells.get(String(cellAIndex));
        return cell !== undefined && cell.ownerId === secondClient.sessionId;
      },
      1_000,
    );

    const finalCellA = serverRoom.state.cells.get(String(cellAIndex));
    expect(finalCellA?.ownerId).toBe(secondClient.sessionId);
    expect(finalCellA?.unitId).toBe(secondUnitId);

    const finalCellB = serverRoom.state.cells.get(String(cellBIndex));
    expect(finalCellB?.ownerId).toBe(firstClient.sessionId);
    expect(finalCellB?.unitId).toBe(firstUnitId);
  });

  test("同時place送信で1件成功し他方はTARGET_LOCKED", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const firstClient = clients[0];
    const secondClient = clients[1];

    await waitForCondition(() => {
      const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);
      const secondPlayer = serverRoom.state.players.get(secondClient.sessionId);
      return firstPlayer !== undefined && secondPlayer !== undefined;
    }, 1_000);

    const { unitId: firstUnitId, cellIndex: firstCellIndex } = seedSharedBoardUnit(
      serverRoom,
      firstClient.sessionId,
      combatCellToRaidBoardIndex(0),
    );
    const { unitId: secondUnitId, cellIndex: secondCellIndex } = seedSharedBoardUnit(
      serverRoom,
      secondClient.sessionId,
      combatCellToRaidBoardIndex(1),
      "ranger",
    );
    const emptyCellIndex = findFirstEmptyCellIndex(serverRoom, [firstCellIndex, secondCellIndex]);

    const firstResultPromise = firstClient.waitForMessage(
      SERVER_MESSAGE_TYPES.ACTION_RESULT,
      5_000,
    );
    const secondResultPromise = secondClient.waitForMessage(
      SERVER_MESSAGE_TYPES.ACTION_RESULT,
      5_000,
    );

    await sendConcurrently([
      () => {
        firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
          unitId: firstUnitId,
          toCell: emptyCellIndex,
        });
      },
      () => {
        secondClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
          unitId: secondUnitId,
          toCell: emptyCellIndex,
        });
      },
    ]);

    // 両方のアクション結果を待機
    const [firstResult, secondResult] = await Promise.all([
      firstResultPromise,
      secondResultPromise,
    ]);

    // 1件は成功、もう1件はTARGET_LOCKEDであること
    const acceptedResult = firstResult.accepted ? firstResult : secondResult;
    const rejectedResult = firstResult.accepted ? secondResult : firstResult;

    expect(acceptedResult).toEqual({ accepted: true, action: "place_unit" });
    expect(rejectedResult).toEqual({
      accepted: false,
      action: "place_unit",
      code: "TARGET_LOCKED",
    });

    // 最終的に空きセルのownerIdは成功した側であること
    await waitForCondition(
      () => {
        const cell = serverRoom.state.cells.get(String(emptyCellIndex));
        const winnerId = firstResult.accepted ? firstClient.sessionId : secondClient.sessionId;
        return cell !== undefined && cell.ownerId === winnerId;
      },
      1_000,
    );

    const finalCell = serverRoom.state.cells.get(String(emptyCellIndex));
    const winnerSessionId = firstResult.accepted ? firstClient.sessionId : secondClient.sessionId;
    expect(finalCell?.ownerId).toBe(winnerSessionId);
  });

  test("同時select送信で所有者のみ成功し他方はUNIT_NOT_OWNED", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    clients.forEach((client) => client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE));

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const firstClient = clients[0];
    const secondClient = clients[1];

    await waitForCondition(() => {
      const firstPlayer = serverRoom.state.players.get(firstClient.sessionId);
      return firstPlayer !== undefined;
    }, 1_000);

    const firstUnitId = seedSharedBoardUnit(serverRoom, firstClient.sessionId, combatCellToRaidBoardIndex(0)).unitId;

    const firstResultPromise = firstClient.waitForMessage(
      SERVER_MESSAGE_TYPES.ACTION_RESULT,
      5_000,
    );
    const secondResultPromise = secondClient.waitForMessage(
      SERVER_MESSAGE_TYPES.ACTION_RESULT,
      5_000,
    );

    await sendConcurrently([
      () => {
        firstClient.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, {
          unitId: firstUnitId,
        });
      },
      () => {
        secondClient.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, {
          unitId: firstUnitId,
        });
      },
    ]);

    // 両方のアクション結果を待機
    const [firstResult, secondResult] = await Promise.all([
      firstResultPromise,
      secondResultPromise,
    ]);

    // 所有者（firstClient）は成功、他方（secondClient）はUNIT_NOT_OWNEDであること
    expect(firstResult).toEqual({ accepted: true, action: "select_unit" });
    expect(secondResult).toEqual({
      accepted: false,
      action: "select_unit",
      code: "UNIT_NOT_OWNED",
    });
  });

  test("サーバー同期APIでGameRoom配置をSharedBoardへ反映できる", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    const targetCellIndex = combatCellToRaidBoardIndex(0);
    const result = serverRoom.applyPlacementsFromGame(client.sessionId, [
      {
        cell: targetCellIndex,
        unitType: "vanguard",
      },
    ]);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);

    const targetCell = serverRoom.state.cells.get(String(targetCellIndex));
    expect(targetCell?.ownerId).toBe(client.sessionId);
    expect(targetCell?.unitId.startsWith("vanguard-")).toBe(true);
  });

  test("server sync API keeps boss-side placements on the upper half", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    const bossCellIndex = sharedBoardCoordinateToIndex({ x: 4, y: 1 });
    const result = serverRoom.applyPlacementsFromGame(client.sessionId, [
      {
        cell: bossCellIndex,
        unitType: "mage",
      },
    ], "boss");

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);

    const targetCell = serverRoom.state.cells.get(String(bossCellIndex));
    expect(targetCell?.ownerId).toBe(client.sessionId);
    expect(targetCell?.unitId.startsWith("mage-")).toBe(true);
  });

  test("server sync API derives deployment rows from the live board height", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board", {
      boardWidth: 6,
      boardHeight: 8,
    });
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    const raidCellIndex = sharedBoardCoordinateToIndex(
      { x: 2, y: 6 },
      {
        ...DEFAULT_SHARED_BOARD_CONFIG,
        width: 6,
        height: 8,
        deploymentRows: {
          boss: [0, 1, 2, 3],
          raid: [4, 5, 6, 7],
        },
      },
    );
    const result = serverRoom.applyPlacementsFromGame(client.sessionId, [
      {
        cell: raidCellIndex,
        unitType: "vanguard",
      },
    ]);

    expect(result).toEqual({ applied: 1, skipped: 0 });

    const targetCell = serverRoom.state.cells.get(String(raidCellIndex));
    expect(targetCell?.ownerId).toBe(client.sessionId);
  });

  test("boss purchased unit can be repositioned across the upper half via shared-board direct moves", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    const bossAnchorCell = sharedBoardCoordinateToIndex({ x: 1, y: 1 });
    const genericBossCell = sharedBoardCoordinateToIndex({ x: 4, y: 1 });
    const targetBossCell = sharedBoardCoordinateToIndex({ x: 4, y: 2 });

    serverRoom.applyBossPlacementFromGame({
      playerId: client.sessionId,
      bossId: "remilia",
      cellIndex: bossAnchorCell,
    });
    const result = serverRoom.applyPlacementsFromGame(client.sessionId, [
      {
        cell: genericBossCell,
        unitType: "mage",
      },
    ], "boss");

    expect(result).toEqual({ applied: 1, skipped: 0 });

    const sourceCell = serverRoom.state.cells.get(String(genericBossCell));
    if (!sourceCell?.unitId) {
      throw new Error("Expected boss-side purchased unit");
    }

    client.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, { unitId: sourceCell.unitId });
    expect(await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT)).toEqual({
      accepted: true,
      action: "select_unit",
    });

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: sourceCell.unitId,
      toCell: targetBossCell,
    });
    expect(await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT)).toEqual({
      accepted: true,
      action: "place_unit",
    });

    expect(serverRoom.state.cells.get(String(genericBossCell))?.unitId).toBe("");
    expect(serverRoom.state.cells.get(String(targetBossCell))?.ownerId).toBe(client.sessionId);
  });

  test("server sync API derives Touhou display metadata from unitId", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const client = await testServer.connectTo(serverRoom);

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    const targetCellIndex = combatCellToRaidBoardIndex(0);
    const result = serverRoom.applyPlacementsFromGame(client.sessionId, [
      {
        cell: targetCellIndex,
        unitType: "assassin",
        unitId: "koishi",
      },
    ]);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);

    const targetCell = serverRoom.state.cells.get(String(targetCellIndex)) as SharedBoardCellState & {
      displayName?: string;
      portraitKey?: string;
    };
    expect(targetCell?.displayName).toBe("古明地こいし");
    expect(targetCell?.portraitKey).toBe("koishi");
  });

  test("join options の gamePlayerId を bridge向け配置イベントに反映する", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const mappedGamePlayerId = "game-player-1";
    const client = await testServer.connectTo(serverRoom, {
      gamePlayerId: mappedGamePlayerId,
    });

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    const { unitId, cellIndex: sourceCellIndex } = seedSharedBoardUnit(
      serverRoom,
      mappedGamePlayerId,
      combatCellToRaidBoardIndex(0),
    );
    const targetCellIndex = findFirstEmptyCellIndex(serverRoom, [sourceCellIndex]);

    let emittedPlayerId: string | null = null;
    serverRoom.onPlacementChange((playerId) => {
      emittedPlayerId = playerId;
    });

    client.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, { unitId });
    const selectResult = await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(selectResult).toEqual({ accepted: true, action: "select_unit" });

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId,
      toCell: targetCellIndex,
    });
    const placeResult = await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeResult).toEqual({ accepted: true, action: "place_unit" });

    await waitForCondition(() => emittedPlayerId !== null, 1_000);
    expect(emittedPlayerId).toBe(mappedGamePlayerId);
  });

  test("offPlacementChange は指定 listener だけを解除して他 listener を残す", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const mappedGamePlayerId = "game-player-2";
    const client = await testServer.connectTo(serverRoom, {
      gamePlayerId: mappedGamePlayerId,
    });

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    const { unitId, cellIndex: sourceCellIndex } = seedSharedBoardUnit(
      serverRoom,
      mappedGamePlayerId,
      combatCellToRaidBoardIndex(0),
    );
    const targetCellIndex = findFirstEmptyCellIndex(serverRoom, [sourceCellIndex]);

    let removedListenerCalls = 0;
    let retainedListenerPlayerId: string | null = null;
    const removedListener: PlacementChangeListener = () => {
      removedListenerCalls += 1;
    };
    const retainedListener: PlacementChangeListener = (playerId) => {
      retainedListenerPlayerId = playerId;
    };

    serverRoom.onPlacementChange(removedListener);
    serverRoom.onPlacementChange(retainedListener);
    serverRoom.offPlacementChange(removedListener);

    client.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, { unitId });
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);

    client.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId,
      toCell: targetCellIndex,
    });
    const placeResult = await client.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeResult).toEqual({ accepted: true, action: "place_unit" });

    await waitForCondition(() => retainedListenerPlayerId !== null, 1_000);
    expect(removedListenerCalls).toBe(0);
    expect(retainedListenerPlayerId).toBe(mappedGamePlayerId);
  });
});
