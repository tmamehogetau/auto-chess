import {
  CLIENT_MESSAGE_TYPES,
  DEFAULT_SET_ID_SELECTOR,
  FakeRoot,
  FLAG_CONFIGURATIONS,
  GameRoom,
  SERVER_MESSAGE_TYPES,
  SHARED_BOARD_BOSS_PROPAGATION_TIMEOUT_MS,
  SHARED_BOARD_PROPAGATION_TIMEOUT_MS,
  SharedBoardRoom,
  attachAutoFillHelperAutomationForTest,
  combatCellToRaidBoardIndex,
  connectAndAttachSetIdDisplay,
  connectBossRoleSelectionRoom,
  createRoomWithForcedFlags,
  describe,
  describeGameRoomIntegration,
  expect,
  moveBossRoleSelectionToSelectionStage,
  registerRoundStateListeners,
  resolveBossRoleSelectionToPrep,
  resolveSharedBoardUnitPresentation,
  sharedBoardCoordinateToIndex,
  test,
  vi,
  waitForCondition,
  waitForSharedBoardPropagation,
  waitForText,
  withFlags,
} from "./helpers";
import type {
  AdminResponseMessage,
  BrowserClient,
  BrowserRoom,
  RoundStateMessage,
} from "./helpers";

describeGameRoomIntegration("GameRoom integration / admin and features", (context) => {
  const getTestServer = () => context.testServer;
  test("shared board shadow無効時のadmin_queryはnot availableを返す", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");
    const client = await getTestServer().connectTo(serverRoom);

    const responsePromise = client.waitForMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE);

    client.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
      kind: "metrics",
      correlationId: "corr_admin_disabled",
    });

    const response = (await responsePromise) as AdminResponseMessage;

    expect(response.ok).toBe(false);
    expect(response.kind).toBe("metrics");
    expect(response.correlationId).toBe("corr_admin_disabled");
    expect(response.error).toContain("SharedBoardBridge is not available");
  });


  test("spectator host の player_snapshot admin_query は shared board shadow 無効でも player state を返す", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");
    const spectatorClient = await getTestServer().connectTo(serverRoom, { spectator: true });
    const activeClients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    await waitForCondition(() => serverRoom.state.players.size === 5, 1_000);

    const responsePromise = spectatorClient.waitForMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE);

    spectatorClient.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
      kind: "player_snapshot",
      correlationId: "corr_admin_player_snapshot",
    });

    const response = (await responsePromise) as AdminResponseMessage;

    expect(response.ok).toBe(true);
    expect(response.kind).toBe("player_snapshot");
    expect(response.correlationId).toBe("corr_admin_player_snapshot");
    expect(response.data).toHaveLength(5);
    expect(response.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: spectatorClient.sessionId,
          isSpectator: true,
          benchUnits: expect.any(Array),
        }),
        expect.objectContaining({
          sessionId: activeClients[0].sessionId,
          isSpectator: false,
          benchUnits: expect.any(Array),
          boardUnitCount: expect.any(Number),
          gold: expect.any(Number),
        }),
      ]),
    );
  });


  test("active player の player_snapshot admin_query は FORBIDDEN を返す", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");
    const clients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    await waitForCondition(() => serverRoom.state.players.size === 4, 1_000);

    const responsePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE);

    clients[0].send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
      kind: "player_snapshot",
      correlationId: "corr_admin_forbidden",
    });

    const response = (await responsePromise) as AdminResponseMessage;

    expect(response.ok).toBe(false);
    expect(response.kind).toBe("player_snapshot");
    expect(response.correlationId).toBe("corr_admin_forbidden");
    expect(response.error).toBe("FORBIDDEN");
  });


  test("malformed admin_query payload は INVALID_KIND を返して room を壊さない", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");
    const operator = await getTestServer().connectTo(serverRoom, { spectator: true });

    await waitForCondition(() => serverRoom.state.players.size === 1, 1_000);

    const responsePromise = operator.waitForMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE);

    operator.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, null);

    const response = (await responsePromise) as AdminResponseMessage;

    expect(response.ok).toBe(false);
    expect(response.kind).toBe("dashboard");
    expect(response.error).toBe("INVALID_KIND");
    expect(serverRoom.state.players.get(operator.sessionId)?.isSpectator).toBe(true);
  });


  test("shared board shadow有効時のadmin_queryはdashboard/alerts/logsを返す", async () => {
    await withFlags(FLAG_CONFIGURATIONS.SHARED_BOARD_SHADOW_ONLY, async () => {
      const serverRoom = await getTestServer().createRoom<GameRoom>("game");
      const clients = await Promise.all([
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
      ]);

      const targetClient = clients[0];

      const dashboardPromise = targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.ADMIN_RESPONSE,
      );
      targetClient.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
        kind: "dashboard",
        correlationId: "corr_admin_dashboard",
        windowMs: 60_000,
      });
      const dashboardResponse = (await dashboardPromise) as AdminResponseMessage;

      expect(dashboardResponse.ok).toBe(true);
      expect(dashboardResponse.kind).toBe("dashboard");
      expect(dashboardResponse.correlationId).toBe("corr_admin_dashboard");
      expect(dashboardResponse.data).toEqual(
        expect.objectContaining({
          windowMs: 60_000,
          windowEventCount: expect.any(Number),
          successRate: expect.any(Number),
          failureRate: expect.any(Number),
          conflictRate: expect.any(Number),
          avgLatencyMs: expect.any(Number),
          p95LatencyMs: expect.any(Number),
          topErrors: expect.any(Array),
        }),
      );

      const alertsPromise = targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.ADMIN_RESPONSE,
      );
      targetClient.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
        kind: "alerts",
        correlationId: "corr_admin_alerts",
        thresholds: {
          windowMs: 60_000,
          minEventCount: 1,
          maxFailureRate: 0.5,
          maxConflictRate: 0.5,
          maxP95LatencyMs: 500,
        },
      });
      const alertsResponse = (await alertsPromise) as AdminResponseMessage;

      expect(alertsResponse.ok).toBe(true);
      expect(alertsResponse.kind).toBe("alerts");
      expect(alertsResponse.correlationId).toBe("corr_admin_alerts");
      expect(alertsResponse.data).toEqual(
        expect.objectContaining({
          hasAlert: expect.any(Boolean),
          triggeredRules: expect.any(Array),
          evaluatedAt: expect.any(Number),
          thresholds: expect.objectContaining({
            windowMs: 60_000,
          }),
          dashboard: expect.objectContaining({
            windowMs: 60_000,
          }),
        }),
      );

      const logsPromise = targetClient.waitForMessage(
        SERVER_MESSAGE_TYPES.ADMIN_RESPONSE,
      );
      targetClient.send(CLIENT_MESSAGE_TYPES.ADMIN_QUERY, {
        kind: "logs",
        correlationId: "corr_admin_logs",
        limit: 5,
      });
      const logsResponse = (await logsPromise) as AdminResponseMessage;

      expect(logsResponse.ok).toBe(true);
      expect(logsResponse.kind).toBe("logs");
      expect(logsResponse.correlationId).toBe("corr_admin_logs");
      expect(Array.isArray(logsResponse.data)).toBe(true);
    });
  });


  describe("Rumor Influence - Pre-submit Snapshot Regression", () => {
    test("shopBuySlotIndex preserves isRumorUnit flag in action log after slot replacement", async () => {
      // This test verifies the fix for the bug where isRumorUnit was lost
      // because shop slot was replaced before logging occurred.
      // The fix captures a snapshot of shop offers before submitPrepCommand.

      await withFlags(FLAG_CONFIGURATIONS.ALL_ENABLED, async () => {
        const serverRoom = await getTestServer().createRoom<GameRoom>("game");
        const clients = await Promise.all([
          getTestServer().connectTo(serverRoom),
          getTestServer().connectTo(serverRoom),
          getTestServer().connectTo(serverRoom),
          getTestServer().connectTo(serverRoom),
        ]);

        for (const client of clients) {
          client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
        }

        await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

        // Access the match logger to verify action logging
        const matchLogger = (serverRoom as unknown as {
          matchLogger?: {
            getActionLogs: () => Array<{
              playerId: string;
              roundIndex: number;
              actionType: string;
              details: {
                unitType?: string;
                cost?: number;
                isRumorUnit?: boolean;
                goldBefore?: number;
                goldAfter?: number;
              };
            }>;
          };
        }).matchLogger;

        const targetClient = clients[0];

        // Force a shop offer with isRumorUnit flag via internal controller
        const internalController = (serverRoom as unknown as {
          controller?: {
            shopOffersByPlayer: Map<
              string,
              Array<{
                unitType: "vanguard" | "ranger" | "mage" | "assassin";
                rarity: 1 | 2 | 3;
                cost: number;
                isRumorUnit?: boolean;
              }>
            >;
          };
        }).controller;

        if (!internalController) {
          throw new Error("Expected internal controller");
        }

        // Set up a shop offer with isRumorUnit flag
        const forcedOffers = [
          { unitType: "vanguard" as const, rarity: 1 as const, cost: 3, isRumorUnit: true },
          { unitType: "ranger" as const, rarity: 1 as const, cost: 2 },
          { unitType: "mage" as const, rarity: 2 as const, cost: 4 },
          { unitType: "assassin" as const, rarity: 2 as const, cost: 4 },
          { unitType: "vanguard" as const, rarity: 1 as const, cost: 3 },
        ];
        internalController.shopOffersByPlayer.set(targetClient.sessionId, forcedOffers);

        const resultPromise = targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

        // Buy the rumor unit at slot 0
        targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
          cmdSeq: 1,
          shopBuySlotIndex: 0,
        });

        const result = await resultPromise;
        expect(result).toEqual({ accepted: true });

        // Verify the action was logged with isRumorUnit flag preserved
        // This tests that the pre-submit snapshot captured the flag correctly
        // even though the slot was replaced after purchase
        if (!matchLogger) {
          throw new Error("Expected matchLogger to be available");
        }
        const actionLogs = matchLogger.getActionLogs();
        const buyAction = actionLogs.find(
          (log) =>
            log.playerId === targetClient.sessionId &&
            log.actionType === "buy_unit" &&
            log.details.unitType === "vanguard"
        );

        // The key assertion: isRumorUnit should be preserved in the log
        // even though the shop slot was replaced after purchase
        expect(buyAction).toBeDefined();
        expect(buyAction!.details.isRumorUnit).toBe(true);
        expect(buyAction!.details.cost).toBe(3);
      });
    });
  });
});

