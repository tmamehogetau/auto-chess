import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import { TOUHOU_UNITS } from "../../../src/data/touhou-units";
import mvpPhase1UnitsData from "../../../src/data/mvp_phase1_units.json";
import { GameRoom } from "../../../src/server/rooms/game-room";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import { createRoomWithForcedFlags, FLAG_CONFIGURATIONS, withFlags } from "../../server/feature-flag-test-helper";
import { waitForCondition } from "../shared-board-bridge/helpers/wait";

describe("E2E: Roster Switch", () => {
  let testServer: ColyseusTestServer;
  const TEST_SERVER_PORT = 4576;
  const mvpUnitTypes = new Set(mvpPhase1UnitsData.units.map((unit) => unit.type));
  const touhouUnitIds = new Set(TOUHOU_UNITS.map((unit) => unit.unitId));

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
    delete process.env.FEATURE_ENABLE_TOUHOU_ROSTER;
    delete process.env.FEATURE_ENABLE_TOUHOU_FACTIONS;
    delete process.env.FEATURE_ENABLE_PER_UNIT_SHARED_POOL;
    (FeatureFlagService as any).instance = undefined;
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown();
    }
  });

  async function setupGameWith4Players(gameRoom: GameRoom) {
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

    await waitForCondition(() => gameRoom.state.phase === "Prep", 5_000);
    return clients;
  }

  it("OFF: MVP roster shop offers を維持する", { timeout: 30_000 }, async () => {
    await withFlags(FLAG_CONFIGURATIONS.ALL_DISABLED, async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);
      const player = gameRoom.state.players.get(clients[0]!.sessionId);
      const offers = player?.shopOffers ?? [];

      expect((gameRoom.state as any).featureFlagsEnableTouhouRoster).toBe(false);
      expect(offers.length).toBeGreaterThan(0);
      expect(offers.every((offer) => mvpUnitTypes.has(offer.unitType))).toBe(true);
      expect(offers.every((offer) => offer.cost >= 1 && offer.cost <= 3)).toBe(true);
      expect(offers.every((offer) => offer.unitId === "")).toBe(true);

      for (const client of clients) {
        client.connection.close();
      }
    });
  });

  it("ON: Touhou roster shop offers を active runtime path で返す", { timeout: 30_000 }, async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_ONLY, async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);
      const player = gameRoom.state.players.get(clients[0]!.sessionId);
      const offers = player?.shopOffers ?? [];

      expect((gameRoom.state as any).featureFlagsEnableTouhouRoster).toBe(true);
      expect(offers.length).toBeGreaterThan(0);
      expect(offers.every((offer) => touhouUnitIds.has(offer.unitId))).toBe(true);
      expect(offers.every((offer) => offer.cost >= 1 && offer.cost <= 5)).toBe(true);

      for (const client of clients) {
        client.connection.close();
      }
    });
  });

  it("Factions ON: Touhou faction synergy が activeSynergies に同期される", { timeout: 30_000 }, async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
      const gameRoom = await testServer.createRoom<GameRoom>("game");
      const clients = await setupGameWith4Players(gameRoom);
      const targetClient = clients[0]!;

      targetClient.send("prep_command", {
        cmdSeq: 1,
        boardPlacements: [
          { cell: 0, unitType: "vanguard", unitId: "rin" },
          { cell: 1, unitType: "mage", unitId: "satori" },
          { cell: 2, unitType: "assassin", unitId: "koishi" },
        ],
      });

      await waitForCondition(() => {
        const player = gameRoom.state.players.get(targetClient.sessionId);
        return (player?.activeSynergies ?? []).some((synergy) => synergy.unitType === "chireiden");
      }, 3_000);

      const player = gameRoom.state.players.get(targetClient.sessionId);
      const factionSynergy = (player?.activeSynergies ?? []).find((synergy) => synergy.unitType === "chireiden");

      expect((gameRoom.state as any).featureFlagsEnableTouhouRoster).toBe(true);
      expect((gameRoom.state as any).featureFlagsEnableTouhouFactions).toBe(true);
      expect(factionSynergy?.count).toBe(3);
      expect(factionSynergy?.tier).toBe(1);

      for (const client of clients) {
        client.connection.close();
      }
    });
  });

  /**
   * Regression coverage: Legacy fallback hard boundary enforcement (E2E level)
   * Uses controlled test fixture to force-set adjacent Touhou flags while keeping roster OFF.
   * This bypasses FeatureFlagService validation to test the provider boundary directly.
   */
  it("LEGACY: TouhouFactions=true without TouhouRoster still offers MVP units (controlled fixture)", { timeout: 30_000 }, async () => {
    // Use controlled fixture: force-set flags after room creation (bypasses validation)
    const gameRoom = await createRoomWithForcedFlags(testServer, {
      enableTouhouRoster: false,
      enableTouhouFactions: true,
    });
    const clients = await setupGameWith4Players(gameRoom);
    const player = gameRoom.state.players.get(clients[0]!.sessionId);
    const offers = player?.shopOffers ?? [];

    // Verify controlled fixture: adjacent flag is ON, main switch is OFF
    const featureFlagService = FeatureFlagService.getInstance();
    expect(featureFlagService.isFeatureEnabled("enableTouhouRoster")).toBe(false);
    expect(featureFlagService.isFeatureEnabled("enableTouhouFactions")).toBe(true);

    // Shop must still offer MVP units (roster provider boundary enforcement)
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => mvpUnitTypes.has(offer.unitType))).toBe(true);
    expect(offers.every((offer) => offer.unitId === "")).toBe(true);

    for (const client of clients) {
      client.connection.close();
    }
  });

  it("LEGACY: PerUnitSharedPool=true without TouhouRoster still offers MVP units (controlled fixture)", { timeout: 30_000 }, async () => {
    const gameRoom = await createRoomWithForcedFlags(testServer, {
      enableTouhouRoster: false,
      enablePerUnitSharedPool: true,
    });
    const clients = await setupGameWith4Players(gameRoom);
    const player = gameRoom.state.players.get(clients[0]!.sessionId);
    const offers = player?.shopOffers ?? [];

    const featureFlagService = FeatureFlagService.getInstance();
    expect(featureFlagService.isFeatureEnabled("enableTouhouRoster")).toBe(false);
    expect(featureFlagService.isFeatureEnabled("enablePerUnitSharedPool")).toBe(true);

    // Shop must still offer MVP units
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => mvpUnitTypes.has(offer.unitType))).toBe(true);
    expect(offers.every((offer) => offer.cost >= 1 && offer.cost <= 3)).toBe(true);

    for (const client of clients) {
      client.connection.close();
    }
  });

  it("LEGACY: All adjacent Touhou flags ON but roster OFF keeps MVP offers (controlled fixture)", { timeout: 30_000 }, async () => {
    const gameRoom = await createRoomWithForcedFlags(testServer, {
      enableTouhouRoster: false,
      enableTouhouFactions: true,
      enablePerUnitSharedPool: true,
      enableSharedPool: true,
    });
    const clients = await setupGameWith4Players(gameRoom);
    const player = gameRoom.state.players.get(clients[0]!.sessionId);
    const offers = player?.shopOffers ?? [];

    // Verify controlled fixture: all adjacent flags are ON, main switch is OFF
    const featureFlagService = FeatureFlagService.getInstance();
    expect(featureFlagService.isFeatureEnabled("enableTouhouRoster")).toBe(false);
    expect(featureFlagService.isFeatureEnabled("enableTouhouFactions")).toBe(true);
    expect(featureFlagService.isFeatureEnabled("enablePerUnitSharedPool")).toBe(true);
    expect(featureFlagService.isFeatureEnabled("enableSharedPool")).toBe(true);

    // MVP offers must be maintained despite adjacent flags (hard boundary)
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => mvpUnitTypes.has(offer.unitType))).toBe(true);
    expect(offers.every((offer) => !touhouUnitIds.has(offer.unitId))).toBe(true);
    expect(offers.every((offer) => offer.unitId === "")).toBe(true);

    for (const client of clients) {
      client.connection.close();
    }
  });
});
