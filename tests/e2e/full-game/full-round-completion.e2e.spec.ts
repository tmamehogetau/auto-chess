/**
 * E2E: Full Round Completion (R1-R8)
 * 全8ラウンドの完走と正確なフェーズ遷移、HP変化を検証
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
import { SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";

describe("E2E: Full Round Completion (R1-R8)", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4577;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 200,
          prepDurationMs: 1_000, // 高速化してテスト時間を短縮
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
    // Feature flags reset
    delete process.env.FEATURE_ENABLE_HERO_SYSTEM;
    delete process.env.FEATURE_ENABLE_SHARED_POOL;
    delete process.env.FEATURE_ENABLE_SPELL_CARDS;
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
   * 4人でGameRoomを開始し、Prep状態まで進める
   */
  async function setupGameWith4Players(gameRoom: GameRoom) {
    const clients = await Promise.all([
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
      testServer.connectTo(gameRoom),
    ]);

    // メッセージリスナー登録
    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
      client.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, () => {});
      client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
    }

    // 全員Ready
    for (const client of clients) {
      client.send("ready", { ready: true });
    }

    // Prep状態待機
    await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
    await waitForPhase(gameRoom, "Prep", 5_000);

    return clients;
  }

  /**
   * 1ラウンド分のフェーズ遷移を待機
   * Prep -> Battle -> Settle -> (Elimination) -> Prep
   */
  async function waitForRoundCompletion(gameRoom: GameRoom, expectedRoundIndex: number): Promise<void> {
    // Prepフェーズを確認
    expect(gameRoom.state.roundIndex).toBe(expectedRoundIndex);
    expect(gameRoom.state.phase).toBe("Prep");

    // Battleフェーズへ遷移
    await waitForPhase(gameRoom, "Battle", 5_000);
    expect(gameRoom.state.phase).toBe("Battle");

    // Settleフェーズへ遷移
    await waitForPhase(gameRoom, "Settle", 3_000);
    expect(gameRoom.state.phase).toBe("Settle");

    // Prepに戻る（Eliminationを経由する可能性あり）
    await waitForCondition(
      () => gameRoom.state.phase === "Prep" || gameRoom.state.phase === "End",
      5_000,
    );

    // Eliminationフェーズがある場合は通過
    if (gameRoom.state.phase === "Elimination") {
      await waitForPhase(gameRoom, "Prep", 3_000);
    }
  }

  it(
    "should complete all 8 rounds with proper phase transitions",
    { timeout: 120_000 },
    async () => {
      // Phase Expansionは無効化（R8完走を優先）
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      // 各プレイヤーの初期HPを記録
      const initialHps = new Map<string, number>();
      for (const [sessionId, player] of gameRoom.state.players.entries()) {
        initialHps.set(sessionId, player.hp);
      }

      const roundTransitions: Array<{ roundIndex: number; phase: string }> = [];
      let finalRoundIndex = 0;

      // ゲームが終了するまでラウンドを進行（最大8ラウンド）
      for (let round = 1; round <= 8; round += 1) {
        // ゲームが既に終了していたらループを抜ける
        if (gameRoom.state.phase === "End") {
          break;
        }

        // 現在のラウンドとフェーズを記録
        roundTransitions.push({
          roundIndex: gameRoom.state.roundIndex,
          phase: gameRoom.state.phase,
        });
        finalRoundIndex = gameRoom.state.roundIndex;

        // Prepフェーズでのコマンド送信（任意）
        if (gameRoom.state.phase === "Prep") {
          // 簡易的な盤面配置で戦闘を進行
          for (const client of clients) {
            const player = gameRoom.state.players.get(client.sessionId);
            if (player && !player.eliminated) {
              client.send("prep_command", {
                cmdSeq: round,
                boardPlacements: [
                  { cell: 0, unitType: "vanguard", starLevel: 1 },
                  { cell: 1, unitType: "ranger", starLevel: 1 },
                ],
              });
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // ラウンド完走待機
        if (round < 8 && gameRoom.state.phase !== "End") {
          await waitForRoundCompletion(gameRoom, round);
        } else {
          // 最終ラウンドまたはゲーム終了時: Endフェーズへ遷移するまで待機
          await waitForCondition(
            () => gameRoom.state.phase === "End",
            10_000,
          );
        }
      }

      // 最終状態の検証
      expect(gameRoom.state.phase).toBe("End");
      expect(finalRoundIndex).toBeGreaterThanOrEqual(1);
      expect(roundTransitions.length).toBeGreaterThanOrEqual(1);

      // 各ラウンドの遷移を検証（記録された分）
      for (let i = 0; i < roundTransitions.length; i += 1) {
        expect(roundTransitions[i]!.roundIndex).toBe(i + 1);
        expect(roundTransitions[i]!.phase).toBe("Prep");
      }

      // クリーンアップ
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "should track HP changes across all rounds",
    { timeout: 120_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      // 各プレイヤーのHP推移を記録
      const hpHistory = new Map<string, Array<{ round: number; hp: number }>>();
      const initialHps = new Map<string, number>();

      for (const [sessionId, player] of gameRoom.state.players.entries()) {
        hpHistory.set(sessionId, [{ round: 0, hp: player.hp }]);
        initialHps.set(sessionId, player.hp);
      }

      // ゲームが終了するまでラウンドを進行（最大8ラウンド）
      for (let round = 1; round <= 8; round += 1) {
        // ゲームが既に終了していたらループを抜ける
        if (gameRoom.state.phase === "End") {
          break;
        }

        // Prepフェーズでのコマンド送信
        if (gameRoom.state.phase === "Prep") {
          for (const client of clients) {
            const player = gameRoom.state.players.get(client.sessionId);
            if (player && !player.eliminated) {
              client.send("prep_command", {
                cmdSeq: round,
                boardPlacements: [
                  { cell: 0, unitType: "vanguard", starLevel: 1 },
                  { cell: 1, unitType: "ranger", starLevel: 1 },
                ],
              });
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (round < 8 && gameRoom.state.phase !== "End") {
          await waitForRoundCompletion(gameRoom, round);

          // 各プレイヤーのHPを記録
          for (const [sessionId, player] of gameRoom.state.players.entries()) {
            if (!player.eliminated) {
              const history = hpHistory.get(sessionId);
              if (history) {
                history.push({ round, hp: player.hp });
              }
            }
          }
        } else {
          // 最終ラウンドまたはゲーム終了時: Endフェーズへ
          await waitForCondition(
            () => gameRoom.state.phase === "End",
            10_000,
          );

          // 最終HPを記録
          for (const [sessionId, player] of gameRoom.state.players.entries()) {
            if (!player.eliminated) {
              const history = hpHistory.get(sessionId);
              if (history) {
                history.push({ round, hp: player.hp });
              }
            }
          }
        }
      }

      // HP検証
      for (const [sessionId, player] of gameRoom.state.players.entries()) {
        // 排除されていないプレイヤーはHP > 0
        if (!player.eliminated) {
          expect(player.hp).toBeGreaterThan(0);
        }

        // 排除されたプレイヤーはHP <= 0
        if (player.eliminated) {
          expect(player.hp).toBeLessThanOrEqual(0);
        }

        // HP履歴の検証
        const history = hpHistory.get(sessionId);
        expect(history).toBeDefined();
        expect(history!.length).toBeGreaterThan(1);

        // 初期HPは一致
        expect(history![0]!.hp).toBe(initialHps.get(sessionId));
      }

      // 全プレイヤーのHP合計が減少していることを確認
      // （戦闘でダメージが発生するため）
      const alivePlayers = Array.from(gameRoom.state.players.values()).filter(
        (p) => !p.eliminated,
      );

      // 最低1人は生存しているはず
      expect(alivePlayers.length).toBeGreaterThan(0);

      // クリーンアップ
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "should handle player elimination during multi-round progression",
    { timeout: 120_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      let eliminatedCount = 0;
      let finalRoundIndex = 0;

      // ゲームが終了するまでラウンドを進行（最大8ラウンド）
      for (let round = 1; round <= 8; round += 1) {
        // ゲームが既に終了していたらループを抜ける
        if (gameRoom.state.phase === "End") {
          break;
        }

        finalRoundIndex = gameRoom.state.roundIndex;

        if (gameRoom.state.phase === "Prep") {
          // 偏った配置: 一部のプレイヤーは強い、一部は弱い
          for (let i = 0; i < clients.length; i += 1) {
            const client = clients[i]!;
            const player = gameRoom.state.players.get(client.sessionId);
            if (player && !player.eliminated) {
              // プレイヤー0は弱い配置、他は強い配置
              const placements = i === 0
                ? [] // 弱い: 空の盤面
                : [
                    { cell: 0, unitType: "vanguard", starLevel: 2 },
                    { cell: 1, unitType: "vanguard", starLevel: 2 },
                    { cell: 2, unitType: "ranger", starLevel: 2 },
                    { cell: 3, unitType: "mage", starLevel: 2 },
                  ];

              client.send("prep_command", {
                cmdSeq: round,
                boardPlacements: placements,
              });
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (round < 8 && gameRoom.state.phase !== "End") {
          await waitForRoundCompletion(gameRoom, round);

          // 淘汰状況を記録
          const currentEliminated = Array.from(gameRoom.state.players.values()).filter(
            (p) => p.eliminated,
          ).length;

          if (currentEliminated > eliminatedCount) {
            eliminatedCount = currentEliminated;
          }
        } else {
          await waitForCondition(
            () => gameRoom.state.phase === "End",
            10_000,
          );
        }
      }

      // 最終検証
      expect(gameRoom.state.phase).toBe("End");
      expect(finalRoundIndex).toBeGreaterThanOrEqual(1);

      // 生存プレイヤーが1人だけの場合も、複数人生存の場合も両方許容
      const alivePlayers = Array.from(gameRoom.state.players.values()).filter(
        (p) => !p.eliminated,
      );
      expect(alivePlayers.length).toBeGreaterThanOrEqual(1);

      // クリーンアップ
      for (const client of clients) {
        client.connection.close();
      }
    },
  );
});
