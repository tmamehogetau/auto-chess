import { afterEach, describe, expect, it, vi } from "vitest";

import type { Room } from "colyseus";

import { SharedBoardBridge } from "../../src/server/shared-board-bridge";
import { BridgeMonitor } from "../../src/server/shared-board-bridge-monitor";
import type { MatchRoomController } from "../../src/server/match-room-controller";
import type { SharedBoardCellState } from "../../src/server/schema/shared-board-state";

interface BatchSyncGameRoom extends Room {
  syncPlayersFromController: (playerIds: string[]) => void;
}

type MockedController = {
  applyPrepPlacementForPlayer: ReturnType<typeof vi.fn>;
  getGameState: ReturnType<typeof vi.fn>;
  getBoardPlacementsForPlayer: ReturnType<typeof vi.fn>;
  getPlayerIds: ReturnType<typeof vi.fn>;
};

describe("SharedBoardBridge batch sync", () => {
  const createdBridges: SharedBoardBridge[] = [];

  afterEach(() => {
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

  const createBridge = (): {
    bridge: SharedBoardBridge;
    syncPlayersFromController: ReturnType<typeof vi.fn>;
    controller: MockedController;
  } => {
    const syncPlayersFromController = vi.fn();
    const gameRoom = {
      roomId: "test-game-room",
      broadcast: vi.fn(),
      syncPlayersFromController,
    } as unknown as BatchSyncGameRoom;

    const controller: MockedController = {
      applyPrepPlacementForPlayer: vi.fn(() => ({ success: true, code: "SUCCESS" })),
      getGameState: vi.fn(() => ({ phase: "Prep", roundIndex: 1 })),
      getBoardPlacementsForPlayer: vi.fn(() => []),
      getPlayerIds: vi.fn(() => ["player-a", "player-b", "player-c"]),
    };

    const bridge = new SharedBoardBridge(
      gameRoom,
      controller as unknown as MatchRoomController,
      false,
    );

    Reflect.set(bridge, "state", "READY");
    Reflect.set(bridge, "monitor", new BridgeMonitor("test-game-room"));
    createdBridges.push(bridge);

    return {
      bridge,
      syncPlayersFromController,
      controller,
    };
  };

  it("3プレイヤーの変更を1回のバッチ同期で反映する", async () => {
    const { bridge, syncPlayersFromController, controller } = createBridge();

    enqueuePlacementChange(bridge, "player-a", []);
    enqueuePlacementChange(bridge, "player-b", []);
    enqueuePlacementChange(bridge, "player-c", []);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(3);
    expect(syncPlayersFromController).toHaveBeenCalledTimes(1);

    const [batchedPlayerIds] = syncPlayersFromController.mock.calls[0] as [string[]];
    expect(new Set(batchedPlayerIds)).toEqual(new Set(["player-a", "player-b", "player-c"]));
  });

  it("同一プレイヤーの連続変更は最新状態のみ適用する", async () => {
    const { bridge, syncPlayersFromController, controller } = createBridge();

    enqueuePlacementChange(bridge, "player-a", [
      {
        index: 0,
        unitId: "vanguard-1",
        ownerId: "player-a",
      } as SharedBoardCellState,
    ]);
    enqueuePlacementChange(bridge, "player-a", [
      {
        index: 3,
        unitId: "ranger-1",
        ownerId: "player-a",
      } as SharedBoardCellState,
    ]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
    expect(syncPlayersFromController).toHaveBeenCalledTimes(1);

    const [playerId, placements] = controller.applyPrepPlacementForPlayer.mock.calls[0] as [
      string,
      Array<{ unitType: string }>,
    ];

    expect(playerId).toBe("player-a");
    expect(placements[0]?.unitType).toBe("ranger");
  });

  it("古いbaseVersionの同期要求はconflictで拒否される", async () => {
    const { bridge, controller } = createBridge();

    const first = await bridge.applySharedBoardPlacement({
      opId: "op-1",
      correlationId: "corr-1",
      baseVersion: 0,
      timestamp: Date.now(),
      actorId: "player-a",
      playerId: "player-a",
      placements: [{ cell: 0, unitType: "vanguard" }],
    });

    expect(first).toMatchObject({
      success: true,
      code: "success",
      currentVersion: 1,
    });

    const second = await bridge.applySharedBoardPlacement({
      opId: "op-2",
      correlationId: "corr-2",
      baseVersion: 0,
      timestamp: Date.now(),
      actorId: "player-a",
      playerId: "player-a",
      placements: [{ cell: 1, unitType: "ranger" }],
    });

    expect(second).toMatchObject({
      success: false,
      code: "conflict",
      currentVersion: 1,
      currentPlacements: [],
    });
    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
  });

  it("上限超過配置はcontrollerのINVALID_PAYLOADを返す", async () => {
    const { bridge, controller } = createBridge();

    controller.applyPrepPlacementForPlayer.mockImplementation((_playerId, placements) => {
      if (placements.length > 8) {
        return {
          success: false,
          code: "INVALID_PAYLOAD",
          error: "Too many units (max 8)",
        };
      }

      return { success: true, code: "SUCCESS" };
    });

    const overLimitPlacements = Array.from({ length: 9 }, (_, index) => ({
      cell: index,
      unitType: "vanguard" as const,
    }));

    const result = await bridge.applySharedBoardPlacement({
      opId: "op-over-limit",
      correlationId: "corr-over-limit",
      baseVersion: 0,
      timestamp: Date.now(),
      actorId: "player-a",
      playerId: "player-a",
      placements: overLimitPlacements,
    });

    expect(result.success).toBe(false);
    expect((result as { code: string }).code).toBe("INVALID_PAYLOAD");
    expect(result.error).toBe("Too many units (max 8)");
  });

  it("P4: correlationId付きログとdashboard/alert APIを取得できる", async () => {
    const { bridge } = createBridge();
    const nowMs = Date.now();

    enqueuePlacementChange(bridge, "player-a", []);

    await new Promise((resolve) => setTimeout(resolve, 80));

    const [latest] = bridge.getRecentLogs(1);
    expect(latest?.correlationId).toMatch(/^corr_/);

    const dashboard = bridge.getDashboardMetrics(60_000, nowMs + 100);
    expect(dashboard.windowEventCount).toBeGreaterThan(0);

    const topErrors = bridge.getTopErrors(5, 60_000, nowMs + 100);
    expect(Array.isArray(topErrors)).toBe(true);

    const alertStatus = bridge.getAlertStatus(
      {
        minEventCount: 1,
        maxFailureRate: 1,
        maxConflictRate: 1,
        maxP95LatencyMs: -1,
        windowMs: 60_000,
      },
      nowMs + 100,
    );
    expect(alertStatus.hasAlert).toBe(true);
    expect(alertStatus.triggeredRules).toContain("p95_latency");
  });
});
