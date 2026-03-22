import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SharedBoardShadowObserver } from "../../src/server/shared-board-shadow-observer";
import { sharedBoardCoordinateToIndex } from "../../src/shared/shared-board-config";

function createControllerMock() {
  const sharedCellIndex = sharedBoardCoordinateToIndex({ x: 1, y: 3 });
  return {
    getPlayerIds: vi.fn(() => ["player-a"]),
    getBoardPlacementsForPlayer: vi.fn(() => [
      { cell: sharedCellIndex, unitType: "vanguard", starLevel: 1 },
    ]),
  };
}

function createSharedBoardRoomMock(ownerId = "player-a") {
  const sharedCellIndex = sharedBoardCoordinateToIndex({ x: 1, y: 3 });
  return {
    state: {
      cells: new Map([
        [String(sharedCellIndex), { unitId: "vanguard-1", ownerId }],
      ]),
    },
  };
}

function createSharedBoardRoomWithExtraUnitMock() {
  const leftCellIndex = sharedBoardCoordinateToIndex({ x: 1, y: 3 });
  const extraCellIndex = sharedBoardCoordinateToIndex({ x: 2, y: 3 });
  return {
    state: {
      cells: new Map([
        [String(leftCellIndex), { unitId: "vanguard-1", ownerId: "player-a" }],
        [String(extraCellIndex), { unitId: "ranger-1", ownerId: "player-a" }],
      ]),
    },
  };
}

function createBrokenSharedBoardRoomMock() {
  return {
    state: {
      cells: {
        get: () => {
          throw new Error("shadow read failed");
        },
      },
    },
  };
}

function createExtendedFootprintControllerMock() {
  const sharedCellIndex = sharedBoardCoordinateToIndex({ x: 0, y: 4 });
  return {
    getPlayerIds: vi.fn(() => ["player-a"]),
    getBoardPlacementsForPlayer: vi.fn(() => [
      { cell: sharedCellIndex, unitType: "vanguard", starLevel: 1 },
    ]),
  };
}

function createExtendedFootprintSharedBoardRoomMock(ownerId = "player-a") {
  const sharedCellIndex = sharedBoardCoordinateToIndex({ x: 0, y: 4 });
  return {
    state: {
      cells: new Map([
        [String(sharedCellIndex), { unitId: "vanguard-extended", ownerId }],
      ]),
    },
  };
}

describe("SharedBoardShadowObserver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-observes immediately after attaching shared board instead of returning stale unavailable result", () => {
    const controller = createControllerMock();
    const observer = new SharedBoardShadowObserver(controller as never);

    const firstResult = observer.observeAndCompare();

    expect(firstResult.status).toBe("unavailable");

    observer.attachSharedBoard(createSharedBoardRoomMock() as never);

    const secondResult = observer.observeAndCompare();

    expect(secondResult.status).toBe("ok");
    expect(secondResult.mismatchCount).toBe(0);
  });

  it("re-observes immediately after detaching shared board instead of returning stale ok result", () => {
    const controller = createControllerMock();
    const observer = new SharedBoardShadowObserver(controller as never);

    observer.attachSharedBoard(createSharedBoardRoomMock() as never);

    const firstResult = observer.observeAndCompare();
    expect(firstResult.status).toBe("ok");

    observer.detachSharedBoard();

    const secondResult = observer.observeAndCompare();

    expect(secondResult.status).toBe("unavailable");
    expect(secondResult.lastError).toBe("SharedBoard room not attached");
  });

  it("observePlayer detects units that exist only on shared board for that player", () => {
    const controller = createControllerMock();
    const observer = new SharedBoardShadowObserver(controller as never);

    observer.attachSharedBoard(createSharedBoardRoomWithExtraUnitMock() as never);

    const result = observer.observePlayer("player-a");

    expect(result.status).toBe("mismatch");
    expect(result.mismatchCount).toBe(1);
    expect(result.mismatchedCells).toEqual([
      {
        combatCell: sharedBoardCoordinateToIndex({ x: 2, y: 3 }),
        gameUnitType: null,
        sharedUnitType: "exists_in_shared_only",
      },
    ]);
    expect(observer.getLastDiffResult()).toEqual(result);
  });

  it("observePlayer escalates repeated read failures to degraded", () => {
    const controller = createControllerMock();
    const observer = new SharedBoardShadowObserver(controller as never);

    observer.attachSharedBoard(createBrokenSharedBoardRoomMock() as never);

    const firstResult = observer.observePlayer("player-a");
    const secondResult = observer.observePlayer("player-a");
    const thirdResult = observer.observePlayer("player-a");

    expect(firstResult.status).toBe("unavailable");
    expect(secondResult.status).toBe("unavailable");
    expect(thirdResult.status).toBe("degraded");
    expect(thirdResult.lastError).toBe("shadow read failed");
    expect(observer.getLastDiffResult()).toEqual(thirdResult);
  });

  it("observePlayer accepts shared-board placements outside the old raid footprint", () => {
    const controller = createExtendedFootprintControllerMock();
    const observer = new SharedBoardShadowObserver(controller as never);

    observer.attachSharedBoard(createExtendedFootprintSharedBoardRoomMock() as never);

    const result = observer.observePlayer("player-a");

    expect(result.status).toBe("ok");
    expect(result.mismatchCount).toBe(0);
  });

  it("observePlayer no longer auto-converts legacy combat cells into shared-board indexes", () => {
    const observer = new SharedBoardShadowObserver({
      getPlayerIds: vi.fn(() => ["player-a"]),
      getBoardPlacementsForPlayer: vi.fn(() => [
        { cell: 0, unitType: "vanguard", starLevel: 1 },
      ]),
    } as never);

    observer.attachSharedBoard({
      state: {
        cells: new Map([
          [String(sharedBoardCoordinateToIndex({ x: 1, y: 3 })), { unitId: "vanguard-1", ownerId: "player-a" }],
        ]),
      },
    } as never);

    const result = observer.observePlayer("player-a");

    expect(result.status).toBe("mismatch");
    expect(result.mismatchCount).toBe(2);
    expect(result.mismatchedCells).toEqual([
      {
        combatCell: 0,
        gameUnitType: "vanguard",
        sharedUnitType: null,
      },
      {
        combatCell: sharedBoardCoordinateToIndex({ x: 1, y: 3 }),
        gameUnitType: null,
        sharedUnitType: "exists_in_shared_only",
      },
    ]);
  });

  it("observePlayer ignores boss tokens when checking shared-only mismatches", () => {
    const controller = createControllerMock();
    const observer = new SharedBoardShadowObserver(controller as never);
    const sharedCellIndex = sharedBoardCoordinateToIndex({ x: 2, y: 0 });

    observer.attachSharedBoard({
      state: {
        cells: new Map([
          [String(sharedBoardCoordinateToIndex({ x: 1, y: 3 })), { unitId: "vanguard-1", ownerId: "player-a" }],
          [String(sharedCellIndex), { unitId: "boss:player-b", ownerId: "player-b" }],
        ]),
      },
    } as never);

    const result = observer.observePlayer("player-a");

    expect(result.status).toBe("ok");
    expect(result.mismatchCount).toBe(0);
  });
});
