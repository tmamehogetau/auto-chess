/**
 * E2E: Unit Operations Flow
 * ユニット操作のE2Eテスト: buy/deploy/sell/synthesis/shop_refresh
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
import {
  SERVER_MESSAGE_TYPES,
  CLIENT_MESSAGE_TYPES,
} from "../../../src/shared/room-messages";
import {
  FLAG_CONFIGURATIONS,
  FLAG_ENV_VARS,
} from "../../server/feature-flag-test-helper";

describe("E2E: Unit Operations Flow", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4578;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
      process.env[envVarName] = String(
        FLAG_CONFIGURATIONS.ALL_DISABLED[
          flagName as keyof typeof FLAG_CONFIGURATIONS.ALL_DISABLED
        ],
      );
    }
    (FeatureFlagService as unknown as { instance?: unknown }).instance = undefined;

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
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
    process.env = originalEnv;
    (FeatureFlagService as unknown as { instance?: unknown }).instance = undefined;
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
      client.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, () => {});
      client.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
    }

    // 全員Ready
    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    // Prep状態待機
    await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
    await waitForCondition(() => gameRoom.state.phase === "Prep", 5_000);

    return clients;
  }

  /**
   * Controllerに強制的にshop offersを設定する（合成テスト用）
   */
  function forceShopOffers(
    gameRoom: GameRoom,
    sessionId: string,
    unitType: "vanguard" | "ranger" | "mage" | "assassin",
    overrideOffers?: Array<{
      unitType: "vanguard" | "ranger" | "mage" | "assassin";
      rarity: 1 | 2 | 3;
      cost: number;
    }>,
  ): void {
    const internalController = (gameRoom as unknown as {
      controller?: {
        shopOffersByPlayer: Map<
          string,
          Array<{
            unitType: "vanguard" | "ranger" | "mage" | "assassin";
            rarity: 1 | 2 | 3;
            cost: number;
          }>
        >;
      };
    }).controller;

    if (!internalController) {
      throw new Error("Expected internal controller");
    }

    internalController.shopOffersByPlayer.set(sessionId, overrideOffers ?? [
      { unitType, rarity: 1, cost: 1 },
      { unitType, rarity: 1, cost: 1 },
      { unitType: "ranger", rarity: 1, cost: 1 },
      { unitType: "mage", rarity: 2, cost: 2 },
      { unitType: "assassin", rarity: 2, cost: 2 },
    ]);

    gameRoom.syncPlayersFromController([sessionId]);
  }

  it(
    "should complete buy->deploy->sell flow",
    { timeout: 30_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      const targetClient = clients[0];
      const playerBefore = gameRoom.state.players.get(targetClient.sessionId);
      const initialGold = Number(playerBefore?.gold ?? 0);

      // Step 1: Buy a unit from shop
      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        shopBuySlotIndex: 0,
      });

      const buyResult = await targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.COMMAND_RESULT,
      );
      expect(buyResult).toEqual({ accepted: true });

      // Verify: unit appears on bench, gold decreased
      const playerAfterBuy = gameRoom.state.players.get(targetClient.sessionId);
      expect(playerAfterBuy?.benchUnits.length).toBe(1);
      expect(Number(playerAfterBuy?.gold)).toBeLessThan(initialGold);

      const unitCost = initialGold - Number(playerAfterBuy?.gold);
      const goldAfterBuy = Number(playerAfterBuy?.gold);

      // Step 2: Deploy unit from bench to board
      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: 6,
        },
      });

      const deployResult = await targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.COMMAND_RESULT,
      );
      expect(deployResult).toEqual({ accepted: true });

      // Verify: unit moved from bench to board
      const playerAfterDeploy = gameRoom.state.players.get(targetClient.sessionId);
      expect(playerAfterDeploy?.benchUnits.length).toBe(0);
      expect(playerAfterDeploy?.boardUnitCount).toBe(1);
      expect(Number(playerAfterDeploy?.gold)).toBe(goldAfterBuy); // Gold unchanged

      // Step 3: Sell the unit from board
      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 3,
        boardSellIndex: 6, // Sell from cell 6
      });

      const sellResult = await targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.COMMAND_RESULT,
      );
      expect(sellResult).toEqual({ accepted: true });

      // Verify: unit removed from board, gold increases by tier 1 sell formula (C - 1)
      const playerAfterSell = gameRoom.state.players.get(targetClient.sessionId);
      expect(playerAfterSell?.benchUnits.length).toBe(0);
      expect(playerAfterSell?.boardUnitCount).toBe(0);
      expect(Number(playerAfterSell?.gold)).toBe(goldAfterBuy + Math.max(unitCost - 1, 0));

      // Cleanup
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "should advance unit level through repeated purchases",
    { timeout: 30_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      const targetClient = clients[0];
      const playerBefore = gameRoom.state.players.get(targetClient.sessionId);
      const initialGold = Number(playerBefore?.gold ?? 0);

      // Buy 3 identical vanguard units (with forced shop offers)
      for (let i = 1; i <= 3; i++) {
        forceShopOffers(gameRoom, targetClient.sessionId, "vanguard");

        targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
          cmdSeq: i,
          shopBuySlotIndex: 0,
        });

        const buyResult = await targetClient.waitForMessage(
          SERVER_MESSAGE_TYPES.COMMAND_RESULT,
        );
        expect(buyResult).toEqual({ accepted: true });
      }

      // Verify purchase-count progression: 3 buys advance the single stack to Lv3
      const playerAfter = gameRoom.state.players.get(targetClient.sessionId);
      expect(playerAfter?.benchUnits.length).toBe(1);
      expect(playerAfter?.benchUnits[0]).toBe("vanguard:3");
      expect(playerAfter?.ownedVanguard).toBe(3);

      // Gold should be decreased by 3 (1 gold per unit)
      expect(Number(playerAfter?.gold)).toBe(initialGold - 3);

      // Cleanup
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "should cap unit level through repeated purchases",
    { timeout: 30_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      const targetClient = clients[0];
      const playerBefore = gameRoom.state.players.get(targetClient.sessionId);
      const initialGold = Number(playerBefore?.gold ?? 0);

      // Buy 9 identical vanguard units and verify the stack caps at Lv7
      for (let i = 1; i <= 9; i++) {
        forceShopOffers(gameRoom, targetClient.sessionId, "vanguard");

        targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
          cmdSeq: i,
          shopBuySlotIndex: 0,
        });

        const buyResult = await targetClient.waitForMessage(
          SERVER_MESSAGE_TYPES.COMMAND_RESULT,
        );
        expect(buyResult).toEqual({ accepted: true });
      }

      // Verify level cap: 9 units should still merge into 1 Lv7 unit
      const playerAfter = gameRoom.state.players.get(targetClient.sessionId);
      expect(playerAfter?.benchUnits.length).toBe(1);
      expect(playerAfter?.benchUnits[0]).toBe("vanguard:7");
      expect(playerAfter?.ownedVanguard).toBe(9);

      // Gold should be decreased by 9 (1 gold per unit)
      expect(Number(playerAfter?.gold)).toBe(initialGold - 9);

      // Cleanup
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "should handle shop refresh",
    { timeout: 30_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      const targetClient = clients[0];
      forceShopOffers(gameRoom, targetClient.sessionId, "vanguard", [
        { unitType: "vanguard", rarity: 3, cost: 91 },
        { unitType: "ranger", rarity: 3, cost: 92 },
        { unitType: "mage", rarity: 3, cost: 93 },
        { unitType: "assassin", rarity: 3, cost: 94 },
        { unitType: "vanguard", rarity: 3, cost: 95 },
      ]);
      const playerBefore = gameRoom.state.players.get(targetClient.sessionId);
      const initialGold = Number(playerBefore?.gold ?? 0);
      const initialOffers = playerBefore?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

      // Refresh shop
      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        shopRefreshCount: 1,
      });

      const refreshResult = await targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.COMMAND_RESULT,
      );
      expect(refreshResult).toEqual({ accepted: true });

      // Verify: gold decreased by 2 (shop refresh cost)
      const playerAfter = gameRoom.state.players.get(targetClient.sessionId);
      expect(Number(playerAfter?.gold)).toBe(initialGold - 2);

      // Verify: new offers appear (different from initial)
      const afterOffers = playerAfter?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";
      expect(playerAfter?.shopOffers.length).toBe(5);
      // ダミーの不正ショップ内容から、通常の再生成結果へ差し替わったことを検証する。
      expect(afterOffers).not.toBe(initialOffers);

      // Cleanup
      for (const client of clients) {
        client.connection.close();
      }
    },
  );

  it(
    "should handle bench sell (sell from bench)",
    { timeout: 30_000 },
    async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);

      const targetClient = clients[0];
      const playerBefore = gameRoom.state.players.get(targetClient.sessionId);
      const initialGold = Number(playerBefore?.gold ?? 0);

      // Step 1: Buy a unit
      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        shopBuySlotIndex: 0,
      });

      const buyResult = await targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.COMMAND_RESULT,
      );
      expect(buyResult).toEqual({ accepted: true });

      const playerAfterBuy = gameRoom.state.players.get(targetClient.sessionId);
      expect(playerAfterBuy?.benchUnits.length).toBe(1);
      const unitCost = initialGold - Number(playerAfterBuy?.gold);
      const goldAfterBuy = Number(playerAfterBuy?.gold);

      // Step 2: Sell from bench
      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 2,
        benchSellIndex: 0,
      });

      const sellResult = await targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.COMMAND_RESULT,
      );
      expect(sellResult).toEqual({ accepted: true });

      // Verify: unit removed from bench, gold follows tier 1 sell formula (C - 1)
      const playerAfterSell = gameRoom.state.players.get(targetClient.sessionId);
      expect(playerAfterSell?.benchUnits.length).toBe(0);
      expect(Number(playerAfterSell?.gold)).toBe(goldAfterBuy + Math.max(unitCost - 1, 0));

      // Cleanup
      for (const client of clients) {
        client.connection.close();
      }
    },
  );
});
