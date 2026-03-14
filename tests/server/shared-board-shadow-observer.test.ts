import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SharedBoardShadowObserver } from "../../src/server/shared-board-shadow-observer";

function createControllerMock() {
  return {
    getPlayerIds: vi.fn(() => ["player-a"]),
    getBoardPlacementsForPlayer: vi.fn(() => [
      { cell: 0, unitType: "vanguard", starLevel: 1 },
    ]),
  };
}

function createSharedBoardRoomMock(ownerId = "player-a") {
  return {
    state: {
      cells: new Map([
        ["7", { unitId: "vanguard-1", ownerId }],
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
});
