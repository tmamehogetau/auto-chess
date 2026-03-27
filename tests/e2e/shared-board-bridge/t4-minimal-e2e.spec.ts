import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../../src/server/rooms/shared-board-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "./helpers/wait";
import { SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";
import { combatCellToRaidBoardIndex } from "../../../src/shared/board-geometry";

interface TestClient {
  sessionId: string;
  send: (type: string, message?: unknown) => void;
  onMessage: (type: string, cb: (message: unknown) => void) => void;
  connection: {
    close: () => void;
  };
}

/**
 * T4: 最小E2E整備（Prep共有編集 → Battle → Settle）
 * 
 * MVP入力ゲートの受入基準:
 * - 共有盤面変更から戦闘開始までに、各プレイヤーの最終 `player placements` が一意に確定する
 * - 1v1戦闘は確定した `player placements` のみを入力として使用する
 * - 最小E2E（Prep共有編集→Battle→Settle）で回帰が発生しない
 */
describe("T4: SharedBoard → Battle → Settle E2E", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4580;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 500,
          prepDurationMs: 2_000,
          battleDurationMs: 2_000,
          settleDurationMs: 800,
          eliminationDurationMs: 500,
        }),
        shared_board: defineRoom(SharedBoardRoom, { lockDurationMs: 1_000 }),
      },
    });

    await server.listen(TEST_SERVER_PORT);
    testServer = new ColyseusTestServer(server);
  });

  afterEach(async () => {
    if (testServer) {
      await testServer.cleanup();
    }
    delete process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW;
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
  });

  async function joinAsActivePlayer(
    sharedBoardRoom: SharedBoardRoom,
    gamePlayerId: string,
  ): Promise<TestClient> {
    const client = (await testServer.connectTo(sharedBoardRoom, {
      gamePlayerId,
    })) as unknown as TestClient;

    client.onMessage("shared_action_result", () => {});
    client.onMessage("shared_battle_replay", () => {});

    const rolePromise = new Promise<{ isSpectator: boolean; slotIndex: number }>((resolve) => {
      client.onMessage("shared_role", (msg: unknown) => {
        resolve(msg as { isSpectator: boolean; slotIndex: number });
      });
    });
    client.send("shared_request_role");

    const role = await rolePromise;
    expect(role.isSpectator).toBe(false);
    expect(role.slotIndex).toBeGreaterThanOrEqual(0);

    return client;
  }

  function findOwnedUnitId(sharedBoardRoom: SharedBoardRoom, ownerId: string): string {
    for (const cell of sharedBoardRoom.state.cells.values()) {
      if (cell.ownerId === ownerId && typeof cell.unitId === "string" && cell.unitId.length > 0) {
        return cell.unitId;
      }
    }
    throw new Error(`No owned unit found for player ${ownerId}`);
  }

  function findOwnedUnitCellIndex(
    sharedBoardRoom: SharedBoardRoom,
    ownerId: string,
    unitId: string,
  ): number {
    for (const [cellIndex, cell] of sharedBoardRoom.state.cells.entries()) {
      if (cell.ownerId === ownerId && cell.unitId === unitId) {
        return Number(cellIndex);
      }
    }

    throw new Error(`No cell found for unit ${unitId} owned by ${ownerId}`);
  }

  async function placeUnit(
    client: TestClient,
    unitId: string,
    toCell: number,
  ): Promise<{ accepted: boolean }> {
    const resultPromise = new Promise<{ accepted: boolean }>((resolve) => {
      client.onMessage("shared_action_result", (msg: unknown) => {
        const result = msg as { accepted: boolean; action: string };
        if (result.action === "place_unit") {
          resolve(result);
        }
      });
    });

    client.send("shared_place_unit", { unitId, toCell });
    return resultPromise;
  }

  it(
    "T4: 3プレイヤーが共有盤面で配置更新 → Battleで各playerの入力が採用される",
    { timeout: 20_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedBoardShadow: true },
        async () => {
          const originalSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;
          delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
          const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

          // 1. Setup: SharedBoardRoom作成
          const sharedBoardRoom = await testServer.createRoom<SharedBoardRoom>("shared_board");

          // 2. Setup: GameRoom作成（4人参加）
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const gameClients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          // RoundStateリスナー登録 + Ready
          for (const client of gameClients) {
            client.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, () => {});
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
            client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
            client.send("ready", { ready: true });
          }

          // Game開始待機（Prepフェーズへ）
          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          expect(gameRoom.state.phase).toBe("Prep");

          // 3. Setup: Bridge初期化確認
          const gameRoomAny = gameRoom as unknown as {
            sharedBoardBridge?: {
              getState: () => string;
              applySharedBoardPlacement: (playerId: string, placements: unknown[]) => Promise<unknown>;
            };
          };
          await waitForCondition(
            () => gameRoomAny.sharedBoardBridge?.getState() === "READY",
            10_000,
          );

          const gameRoomWithController = gameRoom as unknown as {
            controller?: {
              getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
            };
          };

          const seededPlacements = [
            [{ cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" as const }],
            [{ cell: combatCellToRaidBoardIndex(1), unitType: "ranger" as const }],
            [{ cell: combatCellToRaidBoardIndex(2), unitType: "mage" as const }],
          ];

          for (const [index, gameClient] of gameClients.slice(0, 3).entries()) {
            gameClient.send("prep_command", {
              cmdSeq: 1,
              boardPlacements: seededPlacements[index],
            });
          }

          await waitForCondition(
            () => gameClients.slice(0, 3).every((client, index) => {
              const placements = gameRoomWithController.controller?.getBoardPlacementsForPlayer(client.sessionId) ?? [];
              return placements[0]?.unitType === seededPlacements[index]?.[0]?.unitType;
            }),
            3_000,
          );

          // 4. Action: 3プレイヤーをSharedBoardRoomに接続して配置変更
          const targetPlayers = gameClients.slice(0, 3);
          const editedPlayer = targetPlayers[0]!;
          const editedSbClient = await joinAsActivePlayer(sharedBoardRoom, editedPlayer.sessionId);
          const ownedUnitId = findOwnedUnitId(sharedBoardRoom, editedPlayer.sessionId);

          editedSbClient.send("shared_select_unit", { unitId: ownedUnitId });
          await new Promise((resolve) => setTimeout(resolve, 50));

          const movedCombatCell = 4;
          const movedRaidCell = combatCellToRaidBoardIndex(movedCombatCell);
          const placeResult = await placeUnit(editedSbClient, ownedUnitId, movedRaidCell);
          expect(placeResult.accepted).toBe(true);

          await waitForCondition(
            () => {
              const placements = gameRoomWithController.controller?.getBoardPlacementsForPlayer(editedPlayer.sessionId) ?? [];
              return placements.some((placement) => placement.cell === movedRaidCell && placement.unitType === "vanguard");
            },
            3_000,
          );

          // 5. 全員が配置完了したら準備完了
          for (const [index, client] of gameClients.entries()) {
            client.send("prep_command", {
              cmdSeq: index + 2,
              ready: true,
            });
          }

          // 6. Battleフェーズへの遷移を待機
          await waitForCondition(() => gameRoom.state.phase === "Battle", 50_000);
          expect(gameRoom.state.phase).toBe("Battle");

          // 7. Settleフェーズへの遷移を待機（Battle結果が記録される）
          await waitForCondition(() => gameRoom.state.phase === "Settle", 50_000);
          expect(gameRoom.state.phase).toBe("Settle");

          // 8. 結果が反映されることを確認（lastBattleResultが記録される）
          for (const playerId of targetPlayers.map((c) => c.sessionId)) {
            const player = gameRoom.state.players.get(playerId);
            expect(player).toBeDefined();
            // lastBattleResultが初期値以外に更新されている
            expect(player!.lastBattleResult.opponentId).not.toBe("");
          }

          const battleTraces = logSpy.mock.calls
            .map((call) => call[0])
            .filter((entry): entry is string => typeof entry === "string")
            .filter((entry) => entry.includes('"type":"battle_trace"'))
            .map((entry) => JSON.parse(entry) as {
              leftPlayerId: string;
              rightPlayerId: string;
              leftPlacements: Array<{ cell: number; unitType: string }>;
              rightPlacements: Array<{ cell: number; unitType: string }>;
            });

          const editedPlayerTrace = battleTraces.find(
            (trace) => trace.leftPlayerId === editedPlayer.sessionId || trace.rightPlayerId === editedPlayer.sessionId,
          );

          expect(editedPlayerTrace).toBeDefined();

          const editedPlacements = editedPlayerTrace?.leftPlayerId === editedPlayer.sessionId
            ? editedPlayerTrace.leftPlacements
            : editedPlayerTrace?.rightPlacements ?? [];

          expect(editedPlacements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ cell: movedRaidCell, unitType: "vanguard" }),
            ]),
          );

          // 9. 次のPrepへの遷移を確認
          await waitForCondition(() => gameRoom.state.phase === "Prep", 10_000);
          expect(gameRoom.state.phase).toBe("Prep");
          expect(gameRoom.state.roundIndex).toBe(2); // R2から開始

          logSpy.mockRestore();
          if (originalSuppressVerboseLogs === undefined) {
            delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
          } else {
            process.env.SUPPRESS_VERBOSE_TEST_LOGS = originalSuppressVerboseLogs;
          }
        },
      );
    },
  );
});
