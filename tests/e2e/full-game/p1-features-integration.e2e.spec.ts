/**
 * E2E: P1 Features Integration
 * P1機能（Spell Card / Boss Shop）の統合検証
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";

describe("E2E: P1 Features Integration", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4575;

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
    delete process.env.FEATURE_ENABLE_SPELL_CARD;
    delete process.env.FEATURE_ENABLE_BOSS_EXCLUSIVE_SHOP;
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
   * Spell Card有効時はBattle開始時にスペルが宣言される
   */
  it(
    "Spell Card有効時はdeclaredSpellIdがセットされる",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSpellCard: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");

          const clients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          for (const client of clients) {
            client.onMessage("round_state", () => {});
            client.send("ready", { ready: true });
          }

          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          await waitForPhase(gameRoom, "Battle", 5_000);
          await waitForCondition(() => gameRoom.state.declaredSpellId !== "", 3_000);

          expect(gameRoom.state.featureFlagsEnableSpellCard).toBe(true);
          expect(gameRoom.state.declaredSpellId).not.toBe("");

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Spell Card有効時はSettleまで進むとusedSpellIdsへ同期される",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSpellCard: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");

          const clients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          for (const client of clients) {
            client.onMessage("round_state", () => {});
            client.send("ready", { ready: true });
          }

          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          await waitForPhase(gameRoom, "Battle", 5_000);
          const declaredSpellId = gameRoom.state.declaredSpellId;
          expect(declaredSpellId).not.toBe("");

          await waitForPhase(gameRoom, "Settle", 5_000);
          await waitForCondition(() => gameRoom.state.usedSpellIds.length > 0, 3_000);

          expect(Array.from(gameRoom.state.usedSpellIds)).toContain(declaredSpellId);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Spell Card無効時はdeclaredSpellIdが空のまま",
    { timeout: 30_000 },
    async () => {
      await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
        const gameRoom = await testServer.createRoom<GameRoom>("game");

        const clients = await Promise.all([
          testServer.connectTo(gameRoom),
          testServer.connectTo(gameRoom),
          testServer.connectTo(gameRoom),
          testServer.connectTo(gameRoom),
        ]);

        for (const client of clients) {
          client.onMessage("round_state", () => {});
          client.send("ready", { ready: true });
        }

        await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
        await waitForPhase(gameRoom, "Battle", 5_000);

        expect(gameRoom.state.featureFlagsEnableSpellCard).toBe(false);
        expect(gameRoom.state.declaredSpellId).toBe("");
        expect(Array.from(gameRoom.state.usedSpellIds)).toEqual([]);

        for (const client of clients) {
          client.connection.close();
        }
      });
    },
  );

  /**
   * Boss Exclusive Shop有効時はボスプレイヤーに専用ショップofferが出る
   */
  it(
    "Boss Exclusive Shop有効時はboss playerにbossShopOffersが入る",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");

          const clients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          for (const client of clients) {
            client.onMessage("round_state", () => {});
            client.send("ready", { ready: true });
          }

          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          await waitForPhase(gameRoom, "Prep", 5_000);
          await waitForCondition(() => gameRoom.state.bossPlayerId !== "", 3_000);

          const bossPlayer = gameRoom.state.players.get(gameRoom.state.bossPlayerId);
          expect(gameRoom.state.featureFlagsEnableBossExclusiveShop).toBe(true);
          expect(gameRoom.state.bossPlayerId).not.toBe("");
          expect(bossPlayer).toBeDefined();
          expect((bossPlayer?.bossShopOffers ?? []).length).toBeGreaterThan(0);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Boss Exclusive Shop購入はboss laneだけ更新して通常shop laneを保つ",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableBossExclusiveShop: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");

          const clients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          for (const client of clients) {
            client.onMessage("round_state", () => {});
            client.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, () => {});
            client.send("ready", { ready: true });
          }

          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          await waitForPhase(gameRoom, "Prep", 5_000);
          await waitForCondition(() => gameRoom.state.bossPlayerId !== "", 3_000);

          const bossClient = clients.find((client) => client.sessionId === gameRoom.state.bossPlayerId);
          expect(bossClient).toBeDefined();

          if (!bossClient) {
            return;
          }

          const bossPlayerBefore = gameRoom.state.players.get(bossClient.sessionId);
          const goldBefore = bossPlayerBefore?.gold ?? 0;
          const regularShopBefore = Array.from(bossPlayerBefore?.shopOffers ?? []).map((offer) => ({
            unitType: offer.unitType,
            cost: offer.cost,
            rarity: offer.rarity,
          }));
          const bossCost = bossPlayerBefore?.bossShopOffers[0]?.cost ?? 0;

          bossClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
            cmdSeq: 1,
            bossShopBuySlotIndex: 0,
          });

          const result = await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
          expect(result).toEqual({ accepted: true });

          await waitForCondition(() => {
            const bossPlayer = gameRoom.state.players.get(bossClient.sessionId);
            return (bossPlayer?.gold ?? 0) === goldBefore - bossCost;
          }, 3_000);

          const bossPlayerAfter = gameRoom.state.players.get(bossClient.sessionId);
          expect(bossPlayerAfter).toBeDefined();
          expect(Array.from(bossPlayerAfter?.shopOffers ?? []).map((offer) => ({
            unitType: offer.unitType,
            cost: offer.cost,
            rarity: offer.rarity,
          }))).toEqual(regularShopBefore);
          expect((bossPlayerAfter?.bossShopOffers ?? []).length).toBe(2);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

});
