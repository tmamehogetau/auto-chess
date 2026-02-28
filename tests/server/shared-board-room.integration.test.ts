import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { SharedBoardRoom } from "../../src/server/rooms/shared-board-room";

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

describe("SharedBoardRoom integration", () => {
  let testServer!: ColyseusTestServer;

  const TEST_SERVER_PORT = 2_571;

  const CLIENT_MESSAGE_TYPES = {
    CURSOR_MOVE: "shared_cursor_move",
    SELECT_UNIT: "shared_select_unit",
    DRAG_STATE: "shared_drag_state",
    PLACE_UNIT: "shared_place_unit",
    RESET: "shared_reset",
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
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    const rolePromises = clients.map((client) =>
      client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE),
    );

    const roles = await Promise.all(rolePromises);

    expect(roles[0].isSpectator).toBe(false);
    expect(roles[0].slotIndex).toBe(0);
    expect(roles[1].isSpectator).toBe(false);
    expect(roles[1].slotIndex).toBe(1);
    expect(roles[2].isSpectator).toBe(false);
    expect(roles[2].slotIndex).toBe(2);
    expect(roles[3].isSpectator).toBe(true);
    expect(roles[3].slotIndex).toBe(-1);
  });

  test("spectatorがplace/resetするとNOT_ACTIVE_PLAYERで拒否される", async () => {
    const serverRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");
    const clients = await Promise.all([
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
      testServer.connectTo(serverRoom),
    ]);

    await Promise.all(
      clients.map((client) => client.waitForMessage(SERVER_MESSAGE_TYPES.ROLE)),
    );

    const spectatorClient = clients[3];
    const activeClient = clients[0];

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
});
