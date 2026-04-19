/**
 * E2E: Sub Unit System
 * サブユニットシステムの親子連携・効果適用を検証
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { withFlags, FLAG_CONFIGURATIONS } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";
describe("E2E: Sub Unit System", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4574;

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
    delete process.env.FEATURE_ENABLE_SUB_UNIT_SYSTEM;
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
   * Sub Unit System有効時のフラグ確認
   */
  it(
    "Sub Unit System有効時にフラグが正しく設定される",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSubUnitSystem: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");

          // Sub Unit System フラグが有効であることを確認
          expect(gameRoom.state.featureFlagsEnableSubUnitSystem).toBe(true);

          // クリーンアップ
          await testServer.cleanup();
        },
      );
    },
  );

  /**
   * Sub Unit System有効時、host attachmentが盤面トークンに反映される
   */
  it(
    "Sub Unit System有効時、host unitにsub attachmentがあるとsub-unit有効トークンになる",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSubUnitSystem: true },
        async () => {
          const gameRoom = await testServer.createRoom<GameRoom>("game");

          // クライアント接続
          const clients = await Promise.all([
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
            testServer.connectTo(gameRoom),
          ]);

          for (const client of clients) {
            client.onMessage("round_state", () => {});
            client.onMessage("command_result", () => {});
            client.send("ready", { ready: true });
          }

          // Prep待機
          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          await waitForPhase(gameRoom, "Prep", 5_000);

          // host + sub attachment を直接送信
          clients[0]!.send("prep_command", {
            cmdSeq: 1,
            boardPlacements: [{
              cell: 0,
              unitType: "vanguard",
              unitLevel: 1,
              subUnit: {
                unitType: "mage",
                unitLevel: 1,
                sellValue: 1,
                unitCount: 1,
              },
            }],
          });

          await waitForCondition(() => {
            const currentPlayer = gameRoom.state.players.get(clients[0]!.sessionId);
            return (currentPlayer?.boardUnits ?? []).length > 0;
          }, 3_000);

          const playerAfter = gameRoom.state.players.get(clients[0]!.sessionId);
          expect(playerAfter).toBeDefined();

          const boardUnits = Array.from(playerAfter?.boardUnits ?? []);
          expect(boardUnits).toContain("0:vanguard:1:sub");

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Sub Unit System有効時でも非対応unitIdはsub-unitトークンにならない",
    { timeout: 30_000 },
    async () => {
      await withFlags(
        { ...FLAG_CONFIGURATIONS.ALL_DISABLED, enableSubUnitSystem: true },
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
            client.onMessage("command_result", () => {});
            client.send("ready", { ready: true });
          }

          await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
          await waitForPhase(gameRoom, "Prep", 5_000);

          clients[0]!.send("prep_command", {
            cmdSeq: 1,
            boardPlacements: [{ cell: 0, unitType: "vanguard", unitId: "warrior_b", unitLevel: 1 }],
          });

          await waitForCondition(() => {
            const currentPlayer = gameRoom.state.players.get(clients[0]!.sessionId);
            return (currentPlayer?.boardUnits ?? []).length > 0;
          }, 3_000);

          const playerAfter = gameRoom.state.players.get(clients[0]!.sessionId);
          const boardUnits = Array.from(playerAfter?.boardUnits ?? []);
          expect(boardUnits).toContain("0:vanguard");
          expect(boardUnits.some((unit) => unit.includes(":sub"))).toBe(false);

          for (const client of clients) {
            client.connection.close();
          }
        },
      );
    },
  );

  it(
    "Sub Unit System無効時、vanguard配置は従来トークンを維持する",
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
          client.onMessage("command_result", () => {});
          client.send("ready", { ready: true });
        }

        await waitForCondition(() => gameRoom.state.phase !== "Waiting", 5_000);
        await waitForPhase(gameRoom, "Prep", 5_000);

        clients[0]!.send("prep_command", {
          cmdSeq: 1,
          boardPlacements: [{ cell: 0, unitType: "vanguard", unitLevel: 1 }],
        });

        await waitForCondition(() => {
          const currentPlayer = gameRoom.state.players.get(clients[0]!.sessionId);
          return (currentPlayer?.boardUnits ?? []).length > 0;
        }, 3_000);

        const playerAfter = gameRoom.state.players.get(clients[0]!.sessionId);
        const boardUnits = Array.from(playerAfter?.boardUnits ?? []);
        expect(boardUnits).toContain("0:vanguard");
        expect(boardUnits.some((unit) => unit.includes(":sub"))).toBe(false);

        for (const client of clients) {
          client.connection.close();
        }
      });
    },
  );
});
