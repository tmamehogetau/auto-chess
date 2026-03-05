import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { SharedBoardRoom } from "../../src/server/rooms/shared-board-room";
import { combatCellToRaidBoardIndex } from "../../src/shared/board-geometry";

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

  test("最初の3接続がactiveで4人目がspectatorになる", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");

    // Set up message waiting before connecting (server sends ROLE via setTimeout)
    const clientPromises = [
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

    expect(activeRoles).toHaveLength(3);
    expect(spectatorRoles).toHaveLength(1);
    expect(spectatorRoles[0].slotIndex).toBe(-1);

    const activeSlots = activeRoles
      .map((role) => role.slotIndex)
      .sort((left, right) => left - right);
    expect(activeSlots).toEqual([0, 1, 2]);
  });

  test("同意離脱でactive枠が即時解放され新規接続がactiveになる", async () => {
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

    let firstUnitId = "";

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === firstClient.sessionId && cell.unitId !== "") {
        firstUnitId = cell.unitId;
        break;
      }
    }

    if (firstUnitId === "") {
      throw new Error("Expected first player to have a unit");
    }

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

    let firstUnitId = "";
    let firstCellIndex = -1;
    let secondUnitId = "";
    let secondCellIndex = -1;

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.unitId !== "") {
        if (cell.ownerId === firstClient.sessionId && firstUnitId === "") {
          firstUnitId = cell.unitId;
          firstCellIndex = cell.index;
        } else if (
          cell.ownerId === secondClient.sessionId &&
          secondUnitId === ""
        ) {
          secondUnitId = cell.unitId;
          secondCellIndex = cell.index;
        }
      }
    }

    if (firstUnitId === "" || secondUnitId === "") {
      throw new Error("Expected both players to have units");
    }

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

    let firstUnitId = "";
    let firstCellIndex = -1;
    let emptyCellIndex = -1;

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === firstClient.sessionId && cell.unitId !== "") {
        firstUnitId = cell.unitId;
        firstCellIndex = cell.index;
      }
      if (cell.unitId === "" && emptyCellIndex === -1) {
        emptyCellIndex = cell.index;
      }
    }

    if (firstUnitId === "") {
      throw new Error("Expected first player to have a unit");
    }

    if (emptyCellIndex === -1) {
      throw new Error("Expected an empty cell");
    }

    firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: emptyCellIndex,
    });

    const placeResult =
      await firstClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);
    expect(placeResult).toEqual({ accepted: true, action: "place_unit" });

    let secondUnitId = "";
    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === secondClient.sessionId && cell.unitId !== "") {
        secondUnitId = cell.unitId;
        break;
      }
    }

    if (secondUnitId === "") {
      throw new Error("Expected second player to have a unit");
    }

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

    let firstUnitId = "";
    let emptyCellIndex = -1;

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === firstClient.sessionId && cell.unitId !== "") {
        firstUnitId = cell.unitId;
      }
      if (cell.unitId === "" && emptyCellIndex === -1) {
        emptyCellIndex = cell.index;
      }
    }

    if (firstUnitId === "") {
      throw new Error("Expected first player to have a unit");
    }

    if (emptyCellIndex === -1) {
      throw new Error("Expected an empty cell");
    }

    firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: emptyCellIndex,
    });

    await firstClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);

    let secondUnitId = "";
    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === secondClient.sessionId && cell.unitId !== "") {
        secondUnitId = cell.unitId;
        break;
      }
    }

    if (secondUnitId === "") {
      throw new Error("Expected second player to have a unit");
    }

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

    let firstUnitId = "";
    let cellAIndex = -1;
    let cellBIndex = -1;

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === firstClient.sessionId && cell.unitId !== "") {
        firstUnitId = cell.unitId;
      }
      if (cell.unitId === "") {
        if (cellAIndex === -1) {
          cellAIndex = cell.index;
        } else if (cellBIndex === -1) {
          cellBIndex = cell.index;
        }
      }
    }

    if (firstUnitId === "") {
      throw new Error("Expected first player to have a unit");
    }

    if (cellAIndex === -1 || cellBIndex === -1) {
      throw new Error("Expected two empty cells");
    }

    // P1が空きセルAへ配置
    firstClient.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, {
      unitId: firstUnitId,
      toCell: cellAIndex,
    });

    await firstClient.waitForMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT);

    let secondUnitId = "";
    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === secondClient.sessionId && cell.unitId !== "") {
        secondUnitId = cell.unitId;
        break;
      }
    }

    if (secondUnitId === "") {
      throw new Error("Expected second player to have a unit");
    }

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

    let firstUnitId = "";
    let secondUnitId = "";
    let emptyCellIndex = -1;

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === firstClient.sessionId && cell.unitId !== "" && firstUnitId === "") {
        firstUnitId = cell.unitId;
      } else if (cell.ownerId === secondClient.sessionId && cell.unitId !== "" && secondUnitId === "") {
        secondUnitId = cell.unitId;
      }
      if (cell.unitId === "" && emptyCellIndex === -1) {
        emptyCellIndex = cell.index;
      }
    }

    if (firstUnitId === "") {
      throw new Error("Expected first player to have a unit");
    }

    if (secondUnitId === "") {
      throw new Error("Expected second player to have a unit");
    }

    if (emptyCellIndex === -1) {
      throw new Error("Expected an empty cell");
    }

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

    let firstUnitId = "";

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === firstClient.sessionId && cell.unitId !== "") {
        firstUnitId = cell.unitId;
        break;
      }
    }

    if (firstUnitId === "") {
      throw new Error("Expected first player to have a unit");
    }

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
        cell: 0,
        unitType: "vanguard",
      },
    ]);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);

    const targetCell = serverRoom.state.cells.get(String(targetCellIndex));
    expect(targetCell?.ownerId).toBe(client.sessionId);
    expect(targetCell?.unitId.startsWith("vanguard-")).toBe(true);
  });

  test("join options の gamePlayerId を bridge向け配置イベントに反映する", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const mappedGamePlayerId = "game-player-1";
    const client = await testServer.connectTo(serverRoom, {
      gamePlayerId: mappedGamePlayerId,
    });

    client.send(CLIENT_MESSAGE_TYPES.REQUEST_ROLE);
    await client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE);

    let unitId = "";
    let sourceCellIndex = -1;

    for (const cell of serverRoom.state.cells.values()) {
      if (cell.ownerId === client.sessionId && cell.unitId !== "") {
        unitId = cell.unitId;
        sourceCellIndex = cell.index;
        break;
      }
    }

    if (unitId === "") {
      throw new Error("Expected connected player to have an initial unit");
    }

    const targetCellIndex = [...serverRoom.state.cells.values()].find(
      (cell) =>
        cell.index !== sourceCellIndex
        && cell.index !== serverRoom.state.dummyBossCell
        && cell.unitId === "",
    )?.index;

    if (typeof targetCellIndex !== "number") {
      throw new Error("Expected at least one empty target cell");
    }

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
});
