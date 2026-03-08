import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("SharedBoardBridge validation (T1-2)", () => {
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
      getPlayerIds: vi.fn(() => ["player-a"]),
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

  describe("正常系: Prep中の共有編集が戦闘入力へ反映される", () => {
    it("Prepフェーズで有効な配置がapplyPrepPlacementForPlayerへ渡される", async () => {
      const { bridge, controller } = createBridge();

      enqueuePlacementChange(bridge, "player-a", [
        {
          index: 0,
          unitId: "vanguard-1",
          ownerId: "player-a",
        } as SharedBoardCellState,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledTimes(1);
      expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledWith(
        "player-a",
        expect.arrayContaining([
          expect.objectContaining({ unitType: "vanguard" }),
        ]),
      );
    });
  });

  describe("フェーズ系: Prep以外で同期要求を拒否する", () => {
    it("Battleフェーズでは配置が拒否される", async () => {
      const { bridge, controller } = createBridge();

      // Battleフェーズに変更
      controller.getGameState.mockReturnValue({ phase: "Battle", roundIndex: 1 });

      enqueuePlacementChange(bridge, "player-a", []);

      await new Promise((resolve) => setTimeout(resolve, 80));

      // 配置が適用されないことを確認
      expect(controller.applyPrepPlacementForPlayer).not.toHaveBeenCalled();
    });

    it("Settleフェーズでは配置が拒否される", async () => {
      const { bridge, controller } = createBridge();

      // Settleフェーズに変更
      controller.getGameState.mockReturnValue({ phase: "Settle", roundIndex: 1 });

      enqueuePlacementChange(bridge, "player-a", []);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(controller.applyPrepPlacementForPlayer).not.toHaveBeenCalled();
    });

    it("Endフェーズでは配置が拒否される", async () => {
      const { bridge, controller } = createBridge();

      // Endフェーズに変更
      controller.getGameState.mockReturnValue({ phase: "End", roundIndex: 1 });

      enqueuePlacementChange(bridge, "player-a", []);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(controller.applyPrepPlacementForPlayer).not.toHaveBeenCalled();
    });
  });

  describe("境界系: state !== READYで拒否する", () => {
    it("CONNECTING状態では配置が拒否される", async () => {
      const { bridge, controller } = createBridge();

      // CONNECTING状態に変更
      Reflect.set(bridge, "state", "CONNECTING");

      enqueuePlacementChange(bridge, "player-a", []);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(controller.applyPrepPlacementForPlayer).not.toHaveBeenCalled();
    });

    it("DEGRADED状態では配置が拒否される", async () => {
      const { bridge, controller } = createBridge();

      // DEGRADED状態に変更
      Reflect.set(bridge, "state", "DEGRADED");

      enqueuePlacementChange(bridge, "player-a", []);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(controller.applyPrepPlacementForPlayer).not.toHaveBeenCalled();
    });

    it("CLOSED状態では配置が拒否される", async () => {
      const { bridge, controller } = createBridge();

      // CLOSED状態に変更
      Reflect.set(bridge, "state", "CLOSED");

      enqueuePlacementChange(bridge, "player-a", []);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(controller.applyPrepPlacementForPlayer).not.toHaveBeenCalled();
    });
  });

  describe("競合系: 未知プレイヤーで拒否する", () => {
    it("未知プレイヤーの配置は拒否される", async () => {
      const { bridge, controller } = createBridge();

      // getPlayerIdsを明示的に設定（空配列 = 既知プレイヤーなし）
      controller.getPlayerIds.mockReturnValue(["known-player"]);

      enqueuePlacementChange(bridge, "unknown-player", []);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(controller.applyPrepPlacementForPlayer).not.toHaveBeenCalled();
    });
  });

  describe("ログ抑制: 成功時は配置ペイロードを出力しない", () => {
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

    it("applySharedBoardPlacement成功時に配置ペイロードを含むログが出力されない", async () => {
      const { bridge, controller } = createBridge();

      const result = await bridge.applySharedBoardPlacement({
        opId: "op-1",
        correlationId: "corr-1",
        baseVersion: 0,
        timestamp: Date.now(),
        actorId: "player-a",
        playerId: "player-a",
        placements: [{ cell: 0, unitType: "vanguard" }],
      });

      // 実処理が呼ばれ、成功していることを確認（no-op化防止）
      expect(result.success).toBe(true);
      expect(result.code).toBe("success");
      expect(controller.applyPrepPlacementForPlayer).toHaveBeenCalledWith(
        "player-a",
        expect.arrayContaining([expect.objectContaining({ unitType: "vanguard" })]),
      );

      // placement payload（unitType等）がstdoutに出力されていないことを直接検証
      const allLogs = consoleLogSpy.mock.calls.map((call) =>
        call.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
      );
      const hasPlacementPayload = allLogs.some(
        (log) => log.includes("vanguard") || log.includes('"cell":') || log.includes('"unitType":'),
      );
      expect(hasPlacementPayload).toBe(false);
    });

    it("applySharedBoardPlacement失敗時にエラーログが出力される", async () => {
      const { bridge, controller } = createBridge();

      // controller.applyPrepPlacementForPlayer で例外を投げて catch path を通す
      controller.applyPrepPlacementForPlayer.mockImplementation(() => {
        throw new Error("Test exception from applyPrepPlacementForPlayer");
      });

      const result = await bridge.applySharedBoardPlacement({
        opId: "op-1",
        correlationId: "corr-1",
        baseVersion: 0,
        timestamp: Date.now(),
        actorId: "player-a",
        playerId: "player-a",
        placements: [{ cell: 0, unitType: "vanguard" }],
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("error");
      // catch path で "[SharedBoardBridge] Apply placement failed:" が出力されることを厳密に検証
      const errorCall = consoleErrorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("[SharedBoardBridge] Apply placement failed:"),
      );
      expect(errorCall).toBeDefined();
      expect(errorCall![0]).toBe("[SharedBoardBridge] Apply placement failed:");
    });
  });
});
