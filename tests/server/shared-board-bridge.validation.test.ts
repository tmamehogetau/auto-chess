import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Room } from "colyseus";

import { SharedBoardBridge } from "../../src/server/shared-board-bridge";
import { BridgeMonitor } from "../../src/server/shared-board-bridge-monitor";
import type { MatchRoomController } from "../../src/server/match-room-controller";
import type { SharedBoardCellState } from "../../src/server/schema/shared-board-state";
import {
  createBattleEndEvent,
  createBattleStartEvent,
} from "../../src/server/combat/battle-timeline";
import { combatCellToRaidBoardIndex } from "../../src/shared/board-geometry";

interface BatchSyncGameRoom extends Room {
  syncPlayersFromController: (playerIds: string[]) => void;
}

type MockedController = {
  applyPrepPlacementForPlayer: ReturnType<typeof vi.fn>;
  getGameState: ReturnType<typeof vi.fn>;
  getBoardPlacementsForPlayer: ReturnType<typeof vi.fn>;
  getPlayerIds: ReturnType<typeof vi.fn>;
  getBossPlayerId: ReturnType<typeof vi.fn>;
  getPlayerStatus: ReturnType<typeof vi.fn>;
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

  const invokeConnect = async (bridge: SharedBoardBridge): Promise<void> => {
    const connect = Reflect.get(bridge, "connect") as (() => Promise<void>) | undefined;

    if (!connect) {
      throw new Error("Expected connect to be available");
    }

    await connect.call(bridge);
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
      getBossPlayerId: vi.fn(() => null),
      getPlayerStatus: vi.fn(() => ({})),
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
          index: combatCellToRaidBoardIndex(0),
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

  describe("battle replay sync", () => {
    it("Battleフェーズではshared board roomへbattle replayを同期する", async () => {
      const { bridge, controller } = createBridge();
      const applyBattleReplayFromGame = vi.fn();
      const setModeFromGame = vi.fn();

      controller.getGameState.mockReturnValue({ phase: "Battle", roundIndex: 3 });
      controller.getBossPlayerId.mockReturnValue("boss-player");
      controller.getPlayerStatus.mockImplementation((playerId: string) => {
        if (playerId !== "boss-player") {
          return {};
        }

        return {
          lastBattleResult: {
            timeline: [
              createBattleStartEvent({
                battleId: "battle-raid-1",
                round: 3,
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
                ],
              }),
              createBattleEndEvent({
                type: "battleEnd",
                battleId: "battle-raid-1",
                atMs: 600,
                winner: "raid",
              }),
            ],
          },
        };
      });

      Reflect.set(bridge, "sharedBoardRoom", {
        applyBattleReplayFromGame,
        setModeFromGame,
        offPlacementChange: vi.fn(),
      });

      const syncSharedBoardViewFromController = Reflect.get(bridge, "syncSharedBoardViewFromController") as
        | (() => void)
        | undefined;

      if (!syncSharedBoardViewFromController) {
        throw new Error("Expected syncSharedBoardViewFromController to be available");
      }

      syncSharedBoardViewFromController.call(bridge);

      expect(applyBattleReplayFromGame).toHaveBeenCalledWith(
        expect.objectContaining({
          battleId: "battle-raid-1",
          phase: "Battle",
        }),
      );
      expect(setModeFromGame).not.toHaveBeenCalled();
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

      // placements を持つ object が console.log に渡されていないことを構造的に検証
      const hasPlacementPayload = consoleLogSpy.mock.calls.some((call: unknown[]) =>
        call.some((arg: unknown) => {
          if (typeof arg !== "object" || arg === null) return false;
          // arg が placements プロパティを持つか、削除されたログ prefix があるか
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
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          call[0].includes("[SharedBoardBridge] Apply placement failed:"),
      );
      expect(errorCall).toBeDefined();
      expect(errorCall![0]).toBe("[SharedBoardBridge] Apply placement failed:");
    });
  });

  describe("接続ログ: 想定内の shared_board 未起動ではノイズを出さない", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.useFakeTimers();
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.useRealTimers();
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it("想定外の接続失敗は従来どおり error ログを出す", async () => {
      const { bridge } = createBridge();

      Reflect.set(bridge, "enabled", true);
      Reflect.set(bridge, "state", "CONNECTING");
      Reflect.set(bridge, "sharedBoardRoomId", null);
      Reflect.set(bridge, "maxReconnectAttempts", 0);
      Reflect.set(bridge, "findSharedBoardRoomIdWithRetry", vi.fn(async () => {
        throw new Error("unexpected lookup failure");
      }));

      await invokeConnect(bridge);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[SharedBoardBridge] Connection failed:",
        expect.any(Error),
      );
    });

    it("READY前の想定内 shared_board 未起動では console.error を呼ばない", async () => {
      const { bridge } = createBridge();

      // まだREADYになったことがない状態をシミュレート
      Reflect.set(bridge, "enabled", true);
      Reflect.set(bridge, "state", "CONNECTING");
      Reflect.set(bridge, "sharedBoardRoomId", null);
      Reflect.set(bridge, "maxReconnectAttempts", 0);
      // hasEverBeenReady はデフォルトで false
      Reflect.set(bridge, "findSharedBoardRoomIdWithRetry", vi.fn(async () => {
        throw new Error("No shared_board room found");
      }));

      await invokeConnect(bridge);

      // 想定内のエラーは console.error を呼ばない
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("READY後の同じエラーは console.error を呼ぶ", async () => {
      const { bridge } = createBridge();

      // 一度READYになった後の状態をシミュレート
      Reflect.set(bridge, "enabled", true);
      Reflect.set(bridge, "state", "CONNECTING");
      Reflect.set(bridge, "sharedBoardRoomId", null);
      Reflect.set(bridge, "maxReconnectAttempts", 0);
      Reflect.set(bridge, "hasEverBeenReady", true); // READYになったことがある
      Reflect.set(bridge, "findSharedBoardRoomIdWithRetry", vi.fn(async () => {
        throw new Error("No shared_board room found");
      }));

      await invokeConnect(bridge);

      // READY後は同じエラーでも console.error を呼ぶ
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[SharedBoardBridge] Connection failed:",
        expect.any(Error),
      );
    });
  });
});
