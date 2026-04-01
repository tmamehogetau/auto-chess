/**
 * E2E: Phase HP Progress
 * Phase HP進捗（目標値・与ダメ・成功/失敗）のラウンド遷移を検証
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import type { MatchRoomController } from "../../../src/server/match-room-controller";
import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
import { SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";

describe("E2E: Phase HP Progress", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4573;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 200,
          prepDurationMs: 1_000,
          battleDurationMs: 500,
          settleDurationMs: 200,
          eliminationDurationMs: 100,
        }),
      },
    });

    await server.listen(TEST_SERVER_PORT);
    testServer = new ColyseusTestServer(server);
  }, 15_000);

  afterEach(async () => {
    if (testServer) {
      await testServer.cleanup();
    }
    delete process.env.FEATURE_ENABLE_PHASE_EXPANSION;
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
  });

  async function waitForPhase(gameRoom: GameRoom, targetPhase: string, timeoutMs = 10_000) {
    await waitForCondition(() => gameRoom.state.phase === targetPhase, timeoutMs);
  }

  /**
   * R1のPhase HP進捗がround_stateに含まれ、Battle後に結果が確定する
   */
  it(
    "R1のround_stateにphaseHp進捗が含まれ、Battle後にresultがpending以外になる",
    { timeout: 30_000 },
    async () => {
      await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
        const gameRoom = await testServer.createRoom<GameRoom>("game");

        // メッセージハンドラを先に登録
        const roundStates: any[] = [];
        const client1 = await testServer.connectTo(gameRoom);
        client1.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (msg) => {
          roundStates.push(msg);
        });

        // 残り3人を接続
        const clients = [
          client1,
          await testServer.connectTo(gameRoom),
          await testServer.connectTo(gameRoom),
          await testServer.connectTo(gameRoom),
        ];

        client1.onMessage("command_result", () => {});
        for (const client of clients.slice(1)) {
          client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          client.onMessage("command_result", () => {});
        }

        // 全員Ready
        for (const client of clients) {
          client.send("ready", { ready: true });
        }

        // Prep待機
        await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
        await waitForPhase(gameRoom, "Prep", 5_000);

        // Battle前に片側だけ盤面を置いてダメージを発生させやすくする
        clients[0]!.send("prep_command", {
          cmdSeq: 1,
          boardPlacements: [{ cell: 0, unitType: "vanguard", starLevel: 1 }],
        });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Battle待機
        await waitForPhase(gameRoom, "Battle", 5_000);

        // R1の解決完了まで待機
        await waitForCondition(
          () => gameRoom.state.phase === "Elimination" || gameRoom.state.phase === "Prep" || gameRoom.state.phase === "End",
          5_000,
        );

        const r1PrepOrBattleState = roundStates.find(
          (state) => state.roundIndex === 1 && (state.phase === "Prep" || state.phase === "Battle"),
        );
        expect(r1PrepOrBattleState).toBeDefined();
        expect(r1PrepOrBattleState.phaseHpTarget).toBe(600);

        const r1ResolvedState = roundStates.find(
          (state) => state.roundIndex === 1 && state.phaseResult !== "pending",
        );
        expect(r1ResolvedState).toBeDefined();
        expect(r1ResolvedState.phaseHpTarget).toBe(600);
        expect(r1ResolvedState.phaseDamageDealt).toBeGreaterThanOrEqual(0);
        expect(["success", "failed"]).toContain(r1ResolvedState.phaseResult);
        expect(r1ResolvedState.phaseCompletionRate).toBeGreaterThanOrEqual(0);

        for (const client of clients) {
          client.connection.close();
        }
      });
    },
  );

  /**
   * Phase Expansion有効時はround_stateに値が露出する
   */
  it(
    "Phase Expansion有効時もR2までのphaseHp進捗がround_stateに露出する",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enablePhaseExpansion: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");

          // Phase Expansion フラグが有効であることを確認
          expect(gameRoom.state.featureFlagsEnablePhaseExpansion).toBe(true);

          // メッセージハンドラを先に登録
          const roundStates: any[] = [];
          const client1 = await testServer.connectTo(gameRoom);
          client1.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (msg) => {
            roundStates.push(msg);
          });

          // 残り3人を接続
        const clients = [
          client1,
          await testServer.connectTo(gameRoom),
          await testServer.connectTo(gameRoom),
          await testServer.connectTo(gameRoom),
        ];

        client1.onMessage("command_result", () => {});
        for (const client of clients.slice(1)) {
          client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          client.onMessage("command_result", () => {});
        }

          // 全員Ready
          for (const client of clients) {
            client.send("ready", { ready: true });
          }

          // Prep待機
          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          await waitForPhase(gameRoom, "Prep", 5_000);
          await waitForCondition(
            () => roundStates.some((state) => state.roundIndex === 1 && state.phase === "Prep"),
            5_000,
          );

          const r1State = roundStates.find(
            (state) => state.roundIndex === 1 && state.phase === "Prep",
          );
          expect(r1State).toBeDefined();
          expect(r1State.phaseHpTarget).toBe(10);
          expect(r1State.phaseDamageDealt).toBe(0);
          expect(r1State.phaseResult).toBe("pending");

          await waitForCondition(() => gameRoom.state.roundIndex >= 2, 5_000);
          await waitForPhase(gameRoom, "Prep", 5_000);
          await waitForCondition(
            () => roundStates.some((state) => state.roundIndex === 2 && state.phase === "Prep"),
            5_000,
          );

          const r2State = roundStates.find(
            (state) => state.roundIndex === 2 && state.phase === "Prep",
          );
          expect(r2State).toBeDefined();
          expect(r2State.phaseHpTarget).toBe(10);
          expect(r2State.phaseDamageDealt).toBe(0);
          expect(r2State.phaseResult).toBe("pending");

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "R1 raid result updates phase hp and only wiped players lose a life",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const roundStates: Array<Record<string, unknown>> = [];
          const client1 = await testServer.connectTo(gameRoom);
          client1.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (msg) => {
            roundStates.push(msg as Record<string, unknown>);
          });

          const clients = [
            client1,
            await testServer.connectTo(gameRoom),
            await testServer.connectTo(gameRoom),
            await testServer.connectTo(gameRoom),
          ];

          for (const client of clients) {
            client.onMessage("command_result", () => {});
          }
          for (const client of clients.slice(1)) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send("ready", { ready: true });
          }

          await waitForPhase(gameRoom, "Battle", 5_000);

          // This targeted E2E pins deterministic phase damage and battle survivors through
          // controller internals so round-state exposure can be verified without depending on
          // battle RNG. If controller internals move, this fixture must move with them.
          const roomInternals = gameRoom as unknown as {
            controller?: MatchRoomController;
          };
          const controller = roomInternals.controller;
          expect(controller).toBeDefined();
          const bossPlayerId = gameRoom.state.bossPlayerId;
          const raidClients = clients.filter((client) => client.sessionId !== bossPlayerId);
          const bossClient = clients.find((client) => client.sessionId === bossPlayerId);
          expect(bossClient).toBeDefined();
          expect(raidClients).toHaveLength(3);
          const resolvedBossClient = bossClient!;
          const raidClientA = raidClients[0]!;
          const raidClientB = raidClients[1]!;
          const raidClientC = raidClients[2]!;
          controller?.setPendingPhaseDamageForTest(100);

          await waitForPhase(gameRoom, "Settle", 5_000);

          const { battleResultsByPlayer } = controller!.getTestAccess();

          battleResultsByPlayer.set(raidClientA.sessionId, {
            opponentId: resolvedBossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set(raidClientB.sessionId, {
            opponentId: resolvedBossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 1,
            opponentSurvivors: 1,
          });
          battleResultsByPlayer.set(raidClientC.sessionId, {
            opponentId: resolvedBossClient.sessionId,
            won: false,
            damageDealt: 0,
            damageTaken: 10,
            survivors: 0,
            opponentSurvivors: 1,
          });

          await waitForCondition(
            () => gameRoom.state.phase === "Prep" || gameRoom.state.phase === "End",
            5_000,
          );

          const resolvedState = roundStates.find((state) => state.roundIndex === 1 && state.phaseResult === "failed");
          expect(resolvedState).toBeDefined();
          expect(resolvedState?.phaseHpTarget).toBe(600);
          expect(resolvedState?.phaseDamageDealt).toBe(100);
          expect((gameRoom.state.players.get(raidClientA.sessionId) as { remainingLives?: number } | undefined)?.remainingLives).toBe(1);
          expect((gameRoom.state.players.get(raidClientB.sessionId) as { remainingLives?: number } | undefined)?.remainingLives).toBe(2);
          expect((gameRoom.state.players.get(raidClientC.sessionId) as { remainingLives?: number } | undefined)?.remainingLives).toBe(1);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "raid phase hp uses aggregate combat damage over loser damage in round_state",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const roundStates: Array<Record<string, unknown>> = [];
          const client1 = await testServer.connectTo(gameRoom);
          client1.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (msg) => {
            roundStates.push(msg as Record<string, unknown>);
          });

          const clients = [
            client1,
            await testServer.connectTo(gameRoom),
            await testServer.connectTo(gameRoom),
            await testServer.connectTo(gameRoom),
          ];

          for (const client of clients) {
            client.onMessage("command_result", () => {});
          }
          for (const client of clients.slice(1)) {
            client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
          }

          for (const client of clients) {
            client.send("ready", { ready: true });
          }

          await waitForPhase(gameRoom, "Battle", 5_000);

          const roomInternals = gameRoom as unknown as {
            controller?: MatchRoomController;
          };
          const controller = roomInternals.controller;
          expect(controller).toBeDefined();

          const bossPlayerId = gameRoom.state.bossPlayerId;
          expect(bossPlayerId).toBeDefined();
          const resolvedBossPlayerId = bossPlayerId!;

          gameRoom.setPendingRoundDamageForTest({ [resolvedBossPlayerId]: 23 });

          const { battleResultsByPlayer } = controller!.getTestAccess();
          battleResultsByPlayer.set(resolvedBossPlayerId, {
            opponentId: clients.find((client) => client.sessionId !== resolvedBossPlayerId)?.sessionId ?? "raid",
            won: true,
            damageDealt: 0,
            damageTaken: 0,
            survivors: 1,
            opponentSurvivors: 0,
            phaseDamageToBoss: 180,
          });

          await waitForPhase(gameRoom, "Settle", 5_000);
          await waitForCondition(
            () => roundStates.some((state) => state.roundIndex === 1 && state.phaseResult !== "pending"),
            5_000,
          );

          const resolvedState = roundStates.find(
            (state) => state.roundIndex === 1 && state.phaseResult !== "pending",
          );
          expect(resolvedState).toBeDefined();
          expect(resolvedState?.phaseHpTarget).toBe(600);
          expect(resolvedState?.phaseDamageDealt).toBe(180);
          expect(resolvedState?.phaseResult).toBe("failed");

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );
});
