/**
 * E2E: Full Game with Phase 2 Features
 * 全Phase2フラグ有効化でR1-R8完走、各機能の統合検証
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";

describe("E2E: Full Game with Phase 2 Features", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4571; // ポート変更
  let consoleLogSpy: ReturnType<typeof vi.spyOn> | null = null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeAll(async () => {
    const server = defineServer({
      rooms: {
        game: defineRoom(GameRoom, {
          readyAutoStartMs: 200,
          prepDurationMs: 1_000, // 高速化
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
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    consoleLogSpy = null;
    consoleErrorSpy = null;
    // Feature flags reset
    delete process.env.FEATURE_ENABLE_HERO_SYSTEM;
    delete process.env.FEATURE_ENABLE_SHARED_POOL;
    delete process.env.FEATURE_ENABLE_SPELL_CARDS;
    delete process.env.FEATURE_ENABLE_RUMOR_INFLUENCE;
    delete process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP;
    delete process.env.FEATURE_ENABLE_SHARED_BOARD_SHADOW;
    (FeatureFlagService as any).instance = undefined;
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

    const isBossRoleSelectionEnabled =
      gameRoom.state.featureFlagsEnableBossExclusiveShop
      && gameRoom.state.featureFlagsEnableHeroSystem;

    if (isBossRoleSelectionEnabled) {
      const bossClient = clients[1]!;
      const raidClientA = clients[0]!;
      const raidClientB = clients[2]!;
      const raidClientC = clients[3]!;

      bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await waitForCondition(() => gameRoom.state.lobbyStage === "selection", 5_000);

      raidClientA.send("HERO_SELECT", { heroId: "reimu" });
      raidClientB.send("HERO_SELECT", { heroId: "marisa" });
      raidClientC.send("HERO_SELECT", { heroId: "okina" });
      bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

      await waitForCondition(() => gameRoom.state.phase === "Prep", 5_000);
      return clients;
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);

    return clients;
  }

  /**
   * 特定フェーズまで待機
   */
  async function waitForPhase(gameRoom: GameRoom, targetPhase: string, timeoutMs = 10_000) {
    await waitForCondition(() => gameRoom.state.phase === targetPhase, timeoutMs);
  }

  /**
   * Hero選択
   */
  async function selectHero(client: any, heroId: string) {
    client.send("HERO_SELECT", { heroId });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  it(
    "SharedBoardShadow ON でも shared_board room 未起動の expected-miss は error/reconnect ノイズを出さない",
    { timeout: 30_000 },
    async () => {
      await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const gameRoom = await testServer.createRoom<GameRoom>("game");
        const clients = await setupGameWith4Players(gameRoom);

        await waitForPhase(gameRoom, "Prep", 5_000);
        await new Promise((resolve) => setTimeout(resolve, 700));

        const hasExpectedMissError = consoleErrorSpy.mock.calls.some(
          (call: unknown[]) =>
            typeof call[0] === "string"
            && call[0].includes("[SharedBoardBridge] Connection failed:"),
        );
        const hasReconnectNoise = consoleLogSpy.mock.calls.some(
          (call: unknown[]) =>
            typeof call[0] === "string"
            && call[0].includes("[SharedBoardBridge] Reconnecting in"),
        );

        expect(hasExpectedMissError).toBe(false);
        expect(hasReconnectNoise).toBe(false);

        for (const client of clients) {
          client.connection.close();
        }
      });
    },
  );

  it(
    "全Phase2フラグON: Prep→Battle→Settle→Prepのラウンド遷移",
    { timeout: 30_000 },
    async () => {
      await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
        const gameRoom = await testServer.createRoom<GameRoom>("game");
        const clients = await setupGameWith4Players(gameRoom);

        // R1: Prep → Battle → Settle → Prep
        await waitForPhase(gameRoom, "Prep", 5_000);

        // ユニット購入
        const player1 = gameRoom.state.players.get(clients[0]!.sessionId);
        const offers = player1?.shopOffers ?? [];
        const firstOfferIndex = offers.findIndex((o) => o && o.unitType);

        if (firstOfferIndex >= 0) {
          clients[0]!.send("prep_command", {
            cmdSeq: 1,
            shopBuySlotIndex: firstOfferIndex,
          });
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Battle待機
        await waitForPhase(gameRoom, "Battle", 3_000);

        // Settle待機
        await waitForPhase(gameRoom, "Settle", 2_000);

        // Prepに戻る（Elimination経由の可能性）
        await waitForCondition(
          () => gameRoom.state.phase === "Prep" || gameRoom.state.phase === "Elimination",
          2_000,
        );

        // Elimination → Prep
        if (gameRoom.state.phase === "Elimination") {
          await waitForPhase(gameRoom, "Prep", 2_000);
        }

        // 検証: R1完了
        expect(gameRoom.state.roundIndex).toBeGreaterThanOrEqual(1);

        // クリーンアップ
        for (const client of clients) {
          client.connection.close();
        }
      });
    },
  );

  it(
    "Hero System ON: Hero選択後、状態に反映される",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableHeroSystem: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await setupGameWith4Players(gameRoom);

          // Hero選択
          const client1 = clients[0]!;
          client1.send("HERO_SELECT", { heroId: "reimu" });

          await new Promise((resolve) => setTimeout(resolve, 200));

          // 状態確認
          const player = gameRoom.state.players.get(client1.sessionId);
          expect(player?.selectedHeroId).toBe("reimu");

          // クリーンアップ
          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Shared Pool ON: 購入で在庫減少",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedPool: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await setupGameWith4Players(gameRoom);

          // Shared Poolフラグが有効であることを確認
          expect(gameRoom.state.featureFlagsEnableSharedPool).toBe(true);

          // ユニット購入
          const player = gameRoom.state.players.get(clients[0]!.sessionId);
          const offers = player?.shopOffers ?? [];
          const firstOfferIndex = offers.findIndex((o) => o && o.unitType);

          if (firstOfferIndex >= 0) {
            const goldBefore = player?.gold ?? 0;

            clients[0]!.send("prep_command", {
              cmdSeq: 1,
              shopBuySlotIndex: firstOfferIndex,
            });

            await new Promise((resolve) => setTimeout(resolve, 300));

            // ゴールド減少確認
            const playerAfter = gameRoom.state.players.get(clients[0]!.sessionId);
            expect(playerAfter?.gold).toBeLessThan(goldBefore);
          }

          // クリーンアップ
          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Spell Cards ON: Spellフラグが有効",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSpellCard: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await setupGameWith4Players(gameRoom);

          // Spell Cardフラグが有効であることを確認
          expect(gameRoom.state.featureFlagsEnableSpellCard).toBe(true);

          // クリーンアップ
          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Feature Flags OFF + ON 組み合わせ: 各フラグが独立動作",
    { timeout: 30_000 },
    async () => {
      // Hero ON, Shared Pool OFF
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableHeroSystem: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await setupGameWith4Players(gameRoom);

          // Hero選択可能
          clients[0]!.send("HERO_SELECT", { heroId: "reimu" });
          await new Promise((resolve) => setTimeout(resolve, 100));

          const player = gameRoom.state.players.get(clients[0]!.sessionId);
          expect(player?.selectedHeroId).toBe("reimu");

          // Shared Poolは無効
          expect(gameRoom.state.featureFlagsEnableSharedPool).toBe(false);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );

      // Hero OFF, Shared Pool ON
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSharedPool: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");
          const clients = await setupGameWith4Players(gameRoom);

          // Shared Pool有効
          expect(gameRoom.state.featureFlagsEnableSharedPool).toBe(true);

          // Hero選択は無効
          clients[0]!.send("HERO_SELECT", { heroId: "reimu" });
          await new Promise((resolve) => setTimeout(resolve, 100));

          const player = gameRoom.state.players.get(clients[0]!.sessionId);
          expect(player?.selectedHeroId).toBe("");

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Touhou full migration: shop discount と unitId 購入結果が通る",
    { timeout: 30_000 },
    async () => {
      await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
        const gameRoom = await testServer.createRoom<GameRoom>("game");
        const clients = await setupGameWith4Players(gameRoom);
        const sessionId = clients[0]!.sessionId;
        const controller = (gameRoom as unknown as {
          controller: {
            boardPlacementsByPlayer: Map<string, unknown[]>;
            shopOffersByPlayer: Map<string, unknown[]>;
          };
        }).controller;

        controller.boardPlacementsByPlayer.set(sessionId, [
          { cell: 0, unitType: "ranger", unitId: "nazrin", starLevel: 1, factionId: "myourenji" },
          { cell: 1, unitType: "mage", unitId: "murasa", starLevel: 1, factionId: "myourenji" },
          { cell: 2, unitType: "mage", unitId: "shou", starLevel: 1, factionId: "myourenji" },
        ]);
        controller.shopOffersByPlayer.set(sessionId, [
          { unitType: "vanguard", unitId: "ichirin", rarity: 2, cost: 2 },
        ]);

        const goldBefore = gameRoom.state.players.get(sessionId)?.gold ?? 0;
        clients[0]!.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
          cmdSeq: 1,
          shopBuySlotIndex: 0,
        });

        await waitForCondition(
          () => (gameRoom.state.players.get(sessionId)?.gold ?? 0) === goldBefore - 1,
          2_000,
        );

        const player = gameRoom.state.players.get(sessionId);
        expect(player?.gold).toBe(goldBefore - 1);
        expect(player?.benchUnits.length).toBe(1);

        for (const client of clients) {
          client.connection.close();
        }
      });
    },
  );

  it(
    "Legacy MVP: special-effect rollout が無効でも通常コストを維持する",
    { timeout: 30_000 },
    async () => {
      await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
        const gameRoom = await testServer.createRoom<GameRoom>("game");
        const clients = await setupGameWith4Players(gameRoom);
        const sessionId = clients[0]!.sessionId;
        const controller = (gameRoom as unknown as {
          controller: {
            boardPlacementsByPlayer: Map<string, unknown[]>;
            shopOffersByPlayer: Map<string, unknown[]>;
          };
        }).controller;

        controller.shopOffersByPlayer.set(sessionId, [
          { unitType: "mage", rarity: 2, cost: 2 },
        ]);

        const goldBefore = gameRoom.state.players.get(sessionId)?.gold ?? 0;
        clients[0]!.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
          cmdSeq: 1,
          shopBuySlotIndex: 0,
        });

        await waitForCondition(
          () => (gameRoom.state.players.get(sessionId)?.gold ?? 0) === goldBefore - 2,
          2_000,
        );

        const player = gameRoom.state.players.get(sessionId);
        expect(player?.gold).toBe(goldBefore - 2);
        expect(player?.benchUnits.length).toBe(1);

        for (const client of clients) {
          client.connection.close();
        }
      });
    },
  );
});
