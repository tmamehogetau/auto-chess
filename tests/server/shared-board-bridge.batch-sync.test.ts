import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Room } from "colyseus";

import { SharedBoardBridge } from "../../src/server/shared-board-bridge";
import { BridgeMonitor } from "../../src/server/shared-board-bridge-monitor";
import type { MatchRoomController } from "../../src/server/match-room-controller";
import type { SharedBoardCellState } from "../../src/server/schema/shared-board-state";
import { combatCellToRaidBoardIndex } from "../../src/shared/board-geometry";
import { sharedBoardCoordinateToIndex } from "../../src/shared/shared-board-config";

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
    bridge.getTestAccess().enqueuePlacementChange(playerId, cells);
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

    bridge.getTestAccess().setRuntimeState({ state: "READY" });
    bridge.getTestAccess().setResources({ monitor: new BridgeMonitor("test-game-room") });
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
        index: combatCellToRaidBoardIndex(0),
        unitId: "vanguard-1",
        ownerId: "player-a",
      } as SharedBoardCellState,
    ]);
    enqueuePlacementChange(bridge, "player-a", [
      {
        index: combatCellToRaidBoardIndex(1),
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

  it("flush前にshared board cellが再同期で書き換わっても、enqueue時点の配置を適用する", async () => {
    const { bridge, controller } = createBridge();

    const queuedCell = {
      index: combatCellToRaidBoardIndex(4),
      unitId: "vanguard-queued",
      ownerId: "player-a",
    } as SharedBoardCellState;

    enqueuePlacementChange(bridge, "player-a", [queuedCell]);

    queuedCell.index = combatCellToRaidBoardIndex(0);
    queuedCell.unitId = "vanguard-resynced";

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledWith(
      "player-a",
      expect.arrayContaining([
        expect.objectContaining({
          cell: combatCellToRaidBoardIndex(4),
          unitType: "vanguard",
        }),
      ]),
    );
  });

  it("shared board snapshot の portrait metadata から raw unitId を controller placement へ引き継ぐ", async () => {
    const { bridge, controller } = createBridge();

    enqueuePlacementChange(bridge, "player-a", [
      {
        index: combatCellToRaidBoardIndex(4),
        unitId: "ranger-player-a-queued",
        ownerId: "player-a",
        displayName: "ナズーリン",
        portraitKey: "nazrin",
      } as SharedBoardCellState,
    ]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledWith(
      "player-a",
      expect.arrayContaining([
        expect.objectContaining({
          cell: combatCellToRaidBoardIndex(4),
          unitType: "ranger",
          unitId: "nazrin",
        }),
      ]),
    );
  });

  it("shared board sync は同じ host unit の attached subUnit を落とさない", async () => {
    const { bridge, controller } = createBridge();

    controller.getBoardPlacementsForPlayer.mockReturnValue([
      {
        cell: combatCellToRaidBoardIndex(4),
        unitType: "ranger",
        unitId: "nazrin",
        starLevel: 1,
        subUnit: {
          unitType: "mage",
          unitId: "koakuma",
          starLevel: 1,
          sellValue: 1,
          unitCount: 1,
        },
      },
    ]);

    enqueuePlacementChange(bridge, "player-a", [
      {
        index: combatCellToRaidBoardIndex(4),
        unitId: "ranger-player-a-queued",
        ownerId: "player-a",
        displayName: "ナズーリン",
        portraitKey: "nazrin",
      } as SharedBoardCellState,
    ]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledWith(
      "player-a",
      expect.arrayContaining([
        expect.objectContaining({
          cell: combatCellToRaidBoardIndex(4),
          unitType: "ranger",
          unitId: "nazrin",
          subUnit: expect.objectContaining({
            unitType: "mage",
            unitId: "koakuma",
          }),
        }),
      ]),
    );
  });

  it("shared board sync は重複 host unitId より cell 一致の attached subUnit を優先する", async () => {
    const { bridge, controller } = createBridge();

    controller.getBoardPlacementsForPlayer.mockReturnValue([
      {
        cell: combatCellToRaidBoardIndex(4),
        unitType: "ranger",
        unitId: "nazrin",
        starLevel: 1,
        subUnit: {
          unitType: "mage",
          unitId: "koakuma-a",
          starLevel: 1,
          sellValue: 1,
          unitCount: 1,
        },
      },
      {
        cell: combatCellToRaidBoardIndex(5),
        unitType: "ranger",
        unitId: "nazrin",
        starLevel: 1,
        subUnit: {
          unitType: "mage",
          unitId: "koakuma-b",
          starLevel: 1,
          sellValue: 1,
          unitCount: 1,
        },
      },
    ]);

    enqueuePlacementChange(bridge, "player-a", [
      {
        index: combatCellToRaidBoardIndex(4),
        unitId: "ranger-player-a-left",
        ownerId: "player-a",
        displayName: "ナズーリン",
        portraitKey: "nazrin",
      } as SharedBoardCellState,
      {
        index: combatCellToRaidBoardIndex(5),
        unitId: "ranger-player-a-right",
        ownerId: "player-a",
        displayName: "ナズーリン",
        portraitKey: "nazrin",
      } as SharedBoardCellState,
    ]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledWith(
      "player-a",
      expect.arrayContaining([
        expect.objectContaining({
          cell: combatCellToRaidBoardIndex(4),
          unitId: "nazrin",
          subUnit: expect.objectContaining({
            unitId: "koakuma-a",
          }),
        }),
        expect.objectContaining({
          cell: combatCellToRaidBoardIndex(5),
          unitId: "nazrin",
          subUnit: expect.objectContaining({
            unitId: "koakuma-b",
          }),
        }),
      ]),
    );
  });

  it("旧combat footprint外のshared board cellもそのままplacementへ反映する", async () => {
    const { bridge, controller } = createBridge();
    const sharedCellIndex = sharedBoardCoordinateToIndex({ x: 0, y: 4 });

    enqueuePlacementChange(bridge, "player-a", [
      {
        index: sharedCellIndex,
        unitId: "vanguard-extended",
        ownerId: "player-a",
      } as SharedBoardCellState,
    ]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
    expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledWith(
      "player-a",
      expect.arrayContaining([
        expect.objectContaining({
          cell: sharedCellIndex,
          unitType: "vanguard",
        }),
      ]),
    );
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

  it("上限超過配置はcontrollerのTOO_MANY_UNITSを返す", async () => {
    const { bridge, controller } = createBridge();

    controller.applyPrepPlacementForPlayer.mockImplementation((_playerId, placements) => {
      if (placements.length > 8) {
        return {
          success: false,
          code: "TOO_MANY_UNITS",
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
    expect((result as { code: string }).code).toBe("TOO_MANY_UNITS");
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

  describe("ログ抑制: sendPlacementToSharedBoard", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("sendPlacementToSharedBoard成功時に配置ペイロードを含むログが出力されない", async () => {
      const { bridge } = createBridge();

      // sharedBoardRoomのモックを設定
      const mockApplyPlacementsFromGame = vi.fn(() => ({ applied: 1, skipped: 0 }));
      const mockSharedBoardRoom = {
        applyPlacementsFromGame: mockApplyPlacementsFromGame,
        offPlacementChange: vi.fn(),
      };
      bridge.getTestAccess().setResources({ sharedBoardRoom: mockSharedBoardRoom });
      bridge.getTestAccess().setRuntimeState({ state: "READY" });

      const placements = [{ cell: 0, unitType: "vanguard" as const }];
      await bridge.sendPlacementToSharedBoard("player-a", placements);

      // 実際にapplyPlacementsFromGameが呼ばれたことを確認（no-op化防止）
      expect(mockApplyPlacementsFromGame).toHaveBeenCalledWith("player-a", placements, "raid");

      // placements を持つ object が console.log に渡されていないことを構造的に検証
      const hasPlacementPayload = consoleLogSpy.mock.calls.some((call: unknown[]) =>
        call.some((arg: unknown) => {
          if (typeof arg !== "object" || arg === null) return false;
          const hasPlacementsProp = "placements" in arg && Array.isArray((arg as Record<string, unknown>).placements);
          return hasPlacementsProp;
        }),
      );
      expect(hasPlacementPayload).toBe(false);

      // 削除されたログ prefix が呼ばれていないことも確認
      const hasDeletedLogPrefix = consoleLogSpy.mock.calls.some(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[0].includes("[SharedBoardBridge] Applied placement:") ||
            call[0].includes("[SharedBoardBridge] Sent placement to shared board:")),
      );
      expect(hasDeletedLogPrefix).toBe(false);
    });

    it("sendPlacementToSharedBoard失敗時にエラーログが出力される", async () => {
      const { bridge } = createBridge();

      // sharedBoardRoomのモックを設定（エラーを投げる）
      const mockSharedBoardRoom = {
        applyPlacementsFromGame: vi.fn(() => {
          throw new Error("Test error");
        }),
        offPlacementChange: vi.fn(),
      };
      bridge.getTestAccess().setResources({ sharedBoardRoom: mockSharedBoardRoom });
      bridge.getTestAccess().setRuntimeState({ state: "READY" });

      await bridge.sendPlacementToSharedBoard("player-a", [
        { cell: 0, unitType: "vanguard" },
      ]);

      // "[SharedBoardBridge] Send placement failed:" が出力されることを厳密に検証
      const errorCall = consoleErrorSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          call[0].includes("[SharedBoardBridge] Send placement failed:"),
      );
      expect(errorCall).toBeDefined();
      expect(errorCall![0]).toBe("[SharedBoardBridge] Send placement failed:");
    });
  });
});
