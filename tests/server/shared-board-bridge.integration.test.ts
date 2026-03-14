import { afterEach, describe, expect, test, vi } from "vitest";

import type { Room } from "colyseus";

import { MatchRoomController } from "../../src/server/match-room-controller";
import { SharedBoardBridge } from "../../src/server/shared-board-bridge";
import { BridgeMonitor } from "../../src/server/shared-board-bridge-monitor";
import type { SharedBoardCellState } from "../../src/server/schema/shared-board-state";
import { withFlags } from "./feature-flag-test-helper";

interface BatchSyncGameRoom extends Room {
  syncPlayersFromController: (playerIds: string[]) => void;
}

const controllerOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 30_000,
  battleDurationMs: 10_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
};

describe("SharedBoardBridge integration", () => {
  const createdBridges: SharedBoardBridge[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const bridge of createdBridges) {
      bridge.dispose();
    }
    createdBridges.length = 0;
  });

  const enqueuePlacementChange = (
    bridge: SharedBoardBridge,
    playerId: string,
    cells: SharedBoardCellState[],
  ): void => {
    const enqueue = Reflect.get(bridge, "enqueuePlacementChange") as
      | ((targetPlayerId: string, targetCells: SharedBoardCellState[]) => void)
      | undefined;

    if (!enqueue) {
      throw new Error("Expected enqueuePlacementChange to be available");
    }

    enqueue.call(bridge, playerId, cells);
  };

  const createReadyBridge = async () => {
    const syncPlayersFromController = vi.fn();
    const gameRoom = {
      roomId: "test-game-room",
      broadcast: vi.fn(),
      syncPlayersFromController,
    } as unknown as BatchSyncGameRoom;

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );
    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    randomSpy.mockRestore();

    const bridge = new SharedBoardBridge(
      gameRoom,
      controller,
      false,
    );

    Reflect.set(bridge, "state", "READY");
    Reflect.set(bridge, "monitor", new BridgeMonitor("test-game-room"));
    createdBridges.push(bridge);

    return { bridge, controller, syncPlayersFromController };
  };

  test("shared board border cells are ignored instead of collapsing to combat cell 0", async () => {
    await withFlags(
      { enableBossExclusiveShop: true },
      async () => {
        const { bridge, controller } = await createReadyBridge();

        enqueuePlacementChange(bridge, "p1", [
          {
            index: 0,
            unitId: "vanguard-p1",
            ownerId: "p1",
          } as SharedBoardCellState,
        ]);

        await new Promise((resolve) => setTimeout(resolve, 80));

        expect(controller.getBoardPlacementsForPlayer("p1")).toEqual([]);
      },
    );
  });

  test("boss and raid placements are limited to their board halves", async () => {
    await withFlags(
      { enableBossExclusiveShop: true },
      async () => {
        const { bridge } = await createReadyBridge();

        await expect(
          bridge.applySharedBoardPlacement({
            opId: "boss-bottom-half",
            correlationId: "corr-boss-bottom-half",
            baseVersion: 0,
            timestamp: Date.now(),
            actorId: "p2",
            playerId: "p2",
            placements: [{ cell: 4, unitType: "vanguard" }],
          }),
        ).resolves.toMatchObject({
          success: false,
          code: "forbidden",
        });

        await expect(
          bridge.applySharedBoardPlacement({
            opId: "raid-top-half",
            correlationId: "corr-raid-top-half",
            baseVersion: 0,
            timestamp: Date.now(),
            actorId: "p1",
            playerId: "p1",
            placements: [{ cell: 0, unitType: "ranger" }],
          }),
        ).resolves.toMatchObject({
          success: false,
          code: "forbidden",
        });

        await expect(
          bridge.applySharedBoardPlacement({
            opId: "boss-top-half",
            correlationId: "corr-boss-top-half",
            baseVersion: 0,
            timestamp: Date.now(),
            actorId: "p2",
            playerId: "p2",
            placements: [{ cell: 0, unitType: "vanguard" }],
          }),
        ).resolves.toMatchObject({
          success: true,
          code: "success",
        });

        await expect(
          bridge.applySharedBoardPlacement({
            opId: "raid-bottom-half",
            correlationId: "corr-raid-bottom-half",
            baseVersion: 1,
            timestamp: Date.now(),
            actorId: "p1",
            playerId: "p1",
            placements: [{ cell: 4, unitType: "ranger" }],
          }),
        ).resolves.toMatchObject({
          success: true,
          code: "success",
        });
      },
    );
  });
});
