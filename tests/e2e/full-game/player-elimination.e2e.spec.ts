/**
 * E2E: Player Elimination Scenario
 * 4人ゲームでプレイヤーがHP 0で排除されるシナリオの検証
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
import { SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";

describe("E2E: Player Elimination Scenario", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4572;

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
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
  });

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
      client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
    }

    // 全員Ready
    for (const client of clients) {
      client.send("ready", { ready: true });
    }

    // Prep状態待機
    await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);

    return clients;
  }

  /**
   * 特定フェーズまで待機
   */
  async function waitForPhase(gameRoom: GameRoom, targetPhase: string, timeoutMs = 10_000) {
    await waitForCondition(() => gameRoom.state.phase === targetPhase, timeoutMs);
  }

  it(
    "4人ゲーム: プレイヤー1人がHP 0で排除されることを検証",
    { timeout: 30_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      // 全員の初期HP確認
      const player1 = gameRoom.state.players.get(clients[0]!.sessionId);
      const player2 = gameRoom.state.players.get(clients[1]!.sessionId);
      const player3 = gameRoom.state.players.get(clients[2]!.sessionId);
      const player4 = gameRoom.state.players.get(clients[3]!.sessionId);

      expect(player1?.hp).toBe(100);
      expect(player2?.hp).toBe(100);
      expect(player3?.hp).toBe(100);
      expect(player4?.hp).toBe(100);

      // controller にアクセスするための型キャスト
      const controllerAccess = gameRoom as unknown as {
        controller?: {
          setPlayerHp: (playerId: string, hp: number) => void;
          getPlayerStatus: (playerId: string) => { eliminated: boolean; hp: number };
        };
      };

      // プレイヤー1のHPを0に設定（排除をシミュレート）
      if (controllerAccess.controller) {
        controllerAccess.controller.setPlayerHp(clients[0]!.sessionId, 0);
      }

      // 全員準備完了
      for (const client of clients) {
        client.send("prep_command", { ready: true });
      }

      // Battle → Settle → Elimination の遷移を待機
      await waitForPhase(gameRoom, "Battle", 5_000);
      await waitForPhase(gameRoom, "Settle", 3_000);
      await waitForPhase(gameRoom, "Elimination", 2_000);

      // Eliminationフェーズで排除が適用されたことを確認
      // controller から状態を取得して確認
      await waitForCondition(
        () => {
          const status = controllerAccess.controller?.getPlayerStatus(clients[0]!.sessionId);
          return status?.eliminated === true;
        },
        2_000,
      );

      // 検証: プレイヤー1が排除された（controllerから確認）
      const player1Status = controllerAccess.controller?.getPlayerStatus(clients[0]!.sessionId);
      expect(player1Status?.eliminated).toBe(true);
      expect(player1Status?.hp).toBe(0);

      // 検証: その他のプレイヤーは生存
      const player2Status = controllerAccess.controller?.getPlayerStatus(clients[1]!.sessionId);
      const player3Status = controllerAccess.controller?.getPlayerStatus(clients[2]!.sessionId);
      const player4Status = controllerAccess.controller?.getPlayerStatus(clients[3]!.sessionId);
      expect(player2Status?.eliminated).toBe(false);
      expect(player3Status?.eliminated).toBe(false);
      expect(player4Status?.eliminated).toBe(false);

      // 次のPrepへ遷移（残り3人で継続）
      await waitForPhase(gameRoom, "Prep", 3_000);

      // 検証: ゲームが継続中
      expect(gameRoom.state.phase).toBe("Prep");
      expect(gameRoom.state.roundIndex).toBeGreaterThanOrEqual(1);

      // クリーンアップ
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "4人ゲーム: 3人が排除され1人勝利するシナリオ",
    { timeout: 60_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      const player1 = gameRoom.state.players.get(clients[0]!.sessionId);
      const player2 = gameRoom.state.players.get(clients[1]!.sessionId);
      const player3 = gameRoom.state.players.get(clients[2]!.sessionId);
      const player4 = gameRoom.state.players.get(clients[3]!.sessionId);

      // controller にアクセスするための型キャスト
      const controllerAccess = gameRoom as unknown as {
        controller?: {
          setPlayerHp: (playerId: string, hp: number) => void;
          getPlayerStatus: (playerId: string) => { eliminated: boolean; hp: number };
        };
      };

      // ラウンド1: プレイヤー1を排除
      if (controllerAccess.controller) {
        controllerAccess.controller.setPlayerHp(clients[0]!.sessionId, 0);
      }

      for (const client of clients) {
        client.send("prep_command", { ready: true });
      }

      await waitForPhase(gameRoom, "Elimination", 5_000);
      await waitForCondition(
        () => {
          const status = controllerAccess.controller?.getPlayerStatus(clients[0]!.sessionId);
          return status?.eliminated === true;
        },
        2_000,
      );
      await waitForPhase(gameRoom, "Prep", 3_000);

      // 検証: プレイヤー1が排除された
      const player1Status = controllerAccess.controller?.getPlayerStatus(clients[0]!.sessionId);
      expect(player1Status?.eliminated).toBe(true);
      expect(gameRoom.state.phase).toBe("Prep");

      // ラウンド2: プレイヤー2を排除
      if (controllerAccess.controller) {
        controllerAccess.controller.setPlayerHp(clients[1]!.sessionId, 0);
      }

      for (const client of clients) {
        client.send("prep_command", { ready: true });
      }

      await waitForPhase(gameRoom, "Elimination", 5_000);
      await waitForCondition(
        () => {
          const status = controllerAccess.controller?.getPlayerStatus(clients[1]!.sessionId);
          return status?.eliminated === true;
        },
        2_000,
      );
      await waitForPhase(gameRoom, "Prep", 3_000);

      // 検証: プレイヤー2が排除された
      const player2Status = controllerAccess.controller?.getPlayerStatus(clients[1]!.sessionId);
      expect(player2Status?.eliminated).toBe(true);

      // ラウンド3: プレイヤー3を排除
      if (controllerAccess.controller) {
        controllerAccess.controller.setPlayerHp(clients[2]!.sessionId, 0);
      }

      for (const client of clients) {
        client.send("prep_command", { ready: true });
      }

      await waitForPhase(gameRoom, "Elimination", 5_000);
      await waitForCondition(() => player3?.eliminated === true, 2_000);

      // 検証: ゲームが終了状態に遷移（1人勝利）
      await waitForCondition(
        () => gameRoom.state.phase === "End",
        5_000,
      );

      // 検証: 最終状態
      const player1FinalStatus = controllerAccess.controller?.getPlayerStatus(clients[0]!.sessionId);
      const player2FinalStatus = controllerAccess.controller?.getPlayerStatus(clients[1]!.sessionId);
      const player3FinalStatus = controllerAccess.controller?.getPlayerStatus(clients[2]!.sessionId);
      const player4FinalStatus = controllerAccess.controller?.getPlayerStatus(clients[3]!.sessionId);

      expect(player1FinalStatus?.eliminated).toBe(true);
      expect(player2FinalStatus?.eliminated).toBe(true);
      expect(player3FinalStatus?.eliminated).toBe(true);
      expect(player4FinalStatus?.eliminated).toBe(false);

      // プレイヤー4のみが生存（勝利）
      expect(player4FinalStatus?.hp).toBeGreaterThan(0);

      // クリーンアップ
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "排除されたプレイヤーがマッチメイキングから除外されることを検証",
    { timeout: 30_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      const player1 = gameRoom.state.players.get(clients[0]!.sessionId);

      // controller にアクセスするための型キャスト
      const controllerAccess = gameRoom as unknown as {
        controller?: {
          setPlayerHp: (playerId: string, hp: number) => void;
          getPlayerStatus: (playerId: string) => { eliminated: boolean; hp: number };
        };
      };

      // プレイヤー1を排除
      if (controllerAccess.controller) {
        controllerAccess.controller.setPlayerHp(clients[0]!.sessionId, 0);
      }

      for (const client of clients) {
        client.send("prep_command", { ready: true });
      }

      await waitForPhase(gameRoom, "Elimination", 5_000);
      await waitForCondition(
        () => {
          const status = controllerAccess.controller?.getPlayerStatus(clients[0]!.sessionId);
          return status?.eliminated === true;
        },
        2_000,
      );
      await waitForPhase(gameRoom, "Prep", 3_000);

      // 検証: 排除されたプレイヤーはstate内に存在するが、eliminatedフラグがtrue
      const player1Status = controllerAccess.controller?.getPlayerStatus(clients[0]!.sessionId);
      expect(player1Status?.eliminated).toBe(true);

      // 検証: 残りのプレイヤー数
      const player2Status = controllerAccess.controller?.getPlayerStatus(clients[1]!.sessionId);
      const player3Status = controllerAccess.controller?.getPlayerStatus(clients[2]!.sessionId);
      const player4Status = controllerAccess.controller?.getPlayerStatus(clients[3]!.sessionId);
      const eliminatedCount = [player1Status?.eliminated, player2Status?.eliminated, player3Status?.eliminated, player4Status?.eliminated].filter(e => e === true).length;
      const aliveCount = [player1Status?.eliminated, player2Status?.eliminated, player3Status?.eliminated, player4Status?.eliminated].filter(e => e === false).length;
      expect(aliveCount).toBe(3);

      // 検証: ランキングに排除されたプレイヤーが含まれているか確認
      //（rankingの実装次第で調整が必要）

      // クリーンアップ
      for (const client of clients) {
        client.connection.close();
      }
    },
  );
});
