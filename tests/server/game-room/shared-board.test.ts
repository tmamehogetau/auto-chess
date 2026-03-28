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

describeGameRoomIntegration("GameRoom integration / shared board", (context) => {
  const getTestServer = () => context.testServer;
  test("raid prep uses shared board as the authoritative placement source", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      await getTestServer().createRoom<SharedBoardRoom>("shared_board");
      const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        controller?: {
          getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
        };
        sharedBoardBridge?: {
          getState: () => string;
          applySharedBoardPlacement: (request: {
            opId: string;
            correlationId: string;
            baseVersion: number;
            timestamp: number;
            actorId: string;
            playerId: string;
            placements: Array<{ cell: number; unitType: "vanguard" | "ranger" | "mage" | "assassin" }>;
          }) => Promise<{ success: boolean; code: string }>;
        };
      };

      for (const client of clients.slice(1)) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await roundStatePromise;

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
        500,
      );

      const raidPlayerId = clients[0].sessionId;
      clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        boardPlacements: [{ cell: 4, unitType: "ranger" }],
      });
      await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

      expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([]);

      const bridgeResult = await roomInternals.sharedBoardBridge?.applySharedBoardPlacement({
        opId: "raid-shared-board-source",
        correlationId: "corr-raid-shared-board-source",
        baseVersion: 0,
        timestamp: Date.now(),
        actorId: raidPlayerId,
        playerId: raidPlayerId,
        placements: [{ cell: 18, unitType: "ranger" }],
      });

      expect(bridgeResult).toMatchObject({ success: true, code: "success" });
      expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([
        expect.objectContaining({ cell: 18, unitType: "ranger" }),
      ]);
      expect(serverRoom.state.sharedBoardAuthorityEnabled).toBe(true);
      expect(serverRoom.state.sharedBoardMode).toBe("half-shared");
    } finally {
      randomSpy.mockRestore();
    }
  });


  test("benchToBoardCell accepted in authoritative prep is reflected to shared board cells", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const sharedBoardRoom = await getTestServer().createRoom<SharedBoardRoom>("shared_board");
      const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        sharedBoardBridge?: {
          getState: () => string;
        };
      };

      for (const client of clients.slice(1)) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await roundStatePromise;

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
        500,
      );

      const targetClient = clients[0];
      const targetPlayerId = targetClient.sessionId;
      const targetRaidCell = combatCellToRaidBoardIndex(4);

      const occupiedBeforePlacement = Array.from(sharedBoardRoom.state.cells.values()).filter(
        (cell) => cell.unitId !== "" && cell.unitId !== "dummy-boss",
      );
      expect(occupiedBeforePlacement).toHaveLength(0);

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        shopBuySlotIndex: 0,
      });
      expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: targetRaidCell,
        },
      });
      expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      await waitForCondition(() => {
        const sharedCell = sharedBoardRoom.state.cells.get(String(targetRaidCell));
        return sharedCell?.ownerId === targetPlayerId && sharedCell.unitId !== "";
      }, 500);

      const reflectedCell = sharedBoardRoom.state.cells.get(String(targetRaidCell));
      expect(reflectedCell?.ownerId).toBe(targetPlayerId);
      expect(reflectedCell?.unitId).not.toBe("");
      expect(reflectedCell?.unitId).not.toBe("dummy-boss");
    } finally {
      randomSpy.mockRestore();
    }
  });


  test("boss benchToBoardCell reflects scarlet display metadata to shared board cells", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const sharedBoardRoom = await getTestServer().createRoom<SharedBoardRoom>("shared_board");
      const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        sharedBoardBridge?: {
          getState: () => string;
        };
      };

      for (const client of clients) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
        500,
      );

      const bossPlayerId = serverRoom.state.bossPlayerId;
      const bossClient = clients.find((client) => client.sessionId === bossPlayerId);
      expect(bossClient).toBeDefined();
      if (!bossClient) {
        throw new Error("Expected boss client after Prep start");
      }
      const targetBossCell = sharedBoardCoordinateToIndex({ x: 1, y: 1 });

      const expectedOffer = serverRoom.state.players.get(bossPlayerId)?.bossShopOffers[0];
      if (!expectedOffer) {
        throw new Error("Expected boss shop offer at slot 0");
      }
      const expectedPresentation = resolveSharedBoardUnitPresentation(
        expectedOffer.unitId,
        expectedOffer.unitType,
      );
      if (!expectedPresentation) {
        throw new Error("Expected presentation metadata for purchased boss unit");
      }

      bossClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        bossShopBuySlotIndex: 0,
      });
      expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      bossClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: targetBossCell,
        },
      });
      expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      await waitForCondition(() => {
        const sharedCell = sharedBoardRoom.state.cells.get(String(targetBossCell)) as {
          ownerId?: string;
          unitId?: string;
          displayName?: string;
          portraitKey?: string;
        } | undefined;
        return sharedCell?.ownerId === bossPlayerId && (sharedCell.unitId?.length ?? 0) > 0;
      }, 500);

      const reflectedCell = sharedBoardRoom.state.cells.get(String(targetBossCell)) as {
        ownerId?: string;
        unitId?: string;
        displayName?: string;
        portraitKey?: string;
      } | undefined;
      expect(reflectedCell?.ownerId).toBe(bossPlayerId);
      expect(reflectedCell?.unitId).not.toBe("");
      expect(reflectedCell?.displayName).toBe(expectedPresentation.displayName);
      expect(reflectedCell?.portraitKey).toBe(expectedPresentation.portraitKey);
    } finally {
      randomSpy.mockRestore();
    }
  });


  test("boss role-selection prep keeps boss bench units on shared board upper half", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const sharedBoardRoom = await getTestServer().createRoom<SharedBoardRoom>("shared_board");
      const { serverRoom, clients } = await connectBossRoleSelectionRoom(
        getTestServer(),
        undefined,
        {
          enableSharedBoardShadow: true,
        },
      );

      const roomInternals = serverRoom as unknown as {
        sharedBoardBridge?: {
          getState: () => string;
          flushPlacementChangeBatch?: () => Promise<void>;
          syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
        };
      };

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY",
        500,
      );

      await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

      const bossPlayerId = serverRoom.state.bossPlayerId;
      const bossClient = clients.find((client) => client.sessionId === bossPlayerId);
      expect(bossClient).toBeDefined();
      if (!bossClient || !bossPlayerId) {
        throw new Error("Expected boss client after role selection");
      }

      const expectedOffer = serverRoom.state.players.get(bossPlayerId)?.bossShopOffers[0];
      if (!expectedOffer) {
        throw new Error("Expected boss shop offer at slot 0");
      }

      const targetBossCell = sharedBoardCoordinateToIndex({ x: 4, y: 1 });

      bossClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        bossShopBuySlotIndex: 0,
      });
      expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      bossClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: targetBossCell,
        },
      });
      expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      await waitForSharedBoardPropagation(
        roomInternals.sharedBoardBridge,
        () => {
          const sharedCell = sharedBoardRoom.state.cells.get(String(targetBossCell)) as {
            ownerId?: string;
            unitId?: string;
            displayName?: string;
          } | undefined;
          return sharedCell?.ownerId === bossPlayerId && (sharedCell.unitId?.length ?? 0) > 0;
        },
        SHARED_BOARD_BOSS_PROPAGATION_TIMEOUT_MS,
      );

      const reflectedCell = sharedBoardRoom.state.cells.get(String(targetBossCell)) as {
        ownerId?: string;
        unitId?: string;
        displayName?: string;
      } | undefined;

      expect(reflectedCell?.ownerId).toBe(bossPlayerId);
      expect(reflectedCell?.unitId).not.toBe("");
      expect(reflectedCell?.displayName).toBe(
        resolveSharedBoardUnitPresentation(
          expectedOffer.unitId,
          expectedOffer.unitType,
        )?.displayName ?? "",
      );
    } finally {
      randomSpy.mockRestore();
    }
  });


  test("raid prep falls back to local placements until shared board bridge is ready", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
        enableBossExclusiveShop: true,
        enableSharedBoardShadow: true,
      });
      const clients = await Promise.all([
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
      ]);

      const roomInternals = serverRoom as unknown as {
        controller?: {
          getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
        };
        sharedBoardBridge?: {
          getState: () => string;
        };
      };

      for (const client of clients.slice(1)) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      const roundState = (await roundStatePromise) as RoundStateMessage & {
        sharedBoardAuthorityEnabled?: boolean;
        sharedBoardMode?: string;
      };

      const raidPlayerId = clients[0].sessionId;
      clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        boardPlacements: [{ cell: 4, unitType: "ranger" }],
      });
      await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

      expect(roomInternals.sharedBoardBridge?.getState()).not.toBe("READY");
      expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([
        expect.objectContaining({ cell: 4, unitType: "ranger" }),
      ]);
      expect(roundState.sharedBoardAuthorityEnabled).toBe(false);
      expect(roundState.sharedBoardMode).toBe("shadow");
    } finally {
      randomSpy.mockRestore();
    }
  });


  test("role-resolved Prep reflects raid heroes onto fixed shared-board cells", async () => {
    const sharedBoardRoom = await getTestServer().createRoom<SharedBoardRoom>("shared_board");
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer(), {
      prepDurationMs: 12_000,
      battleDurationMs: 12_000,
      settleDurationMs: 1_000,
      eliminationDurationMs: 1_000,
      sharedBoardRoomId: sharedBoardRoom.roomId,
    }, {
      enableSharedBoardShadow: true,
    });

    const roomInternals = serverRoom as unknown as {
      sharedBoardBridge?: {
        getState: () => string;
        syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

    await waitForCondition(
      () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
      1_000,
    );
    roomInternals.sharedBoardBridge?.syncSharedBoardViewFromController?.(true);

    const raidPlayerIds = [
      clients[0]!.sessionId,
      clients[2]!.sessionId,
      clients[3]!.sessionId,
    ].sort();
    const heroCellIndexes = [
      sharedBoardCoordinateToIndex({ x: 0, y: 5 }),
      sharedBoardCoordinateToIndex({ x: 2, y: 5 }),
      sharedBoardCoordinateToIndex({ x: 4, y: 5 }),
    ];

    await waitForCondition(() => heroCellIndexes.every((index) => {
      const cell = sharedBoardRoom.state.cells.get(String(index));
      return (
        cell !== undefined
        && raidPlayerIds.includes(cell.ownerId)
        && (cell.unitId?.startsWith("hero:") ?? false)
        && cell.displayName !== ""
      );
    }), 1_000);

    const heroOwnerIds = heroCellIndexes.map((index) => {
      const cell = sharedBoardRoom.state.cells.get(String(index));
      expect(cell?.unitId).toContain("hero:");
      expect(cell?.displayName).not.toBe("");
      return cell?.ownerId ?? "";
    }).sort();

    expect(heroOwnerIds).toEqual(raidPlayerIds);
  });


    test("3 helper bots and 1 real player can auto-buy and auto-place helper units during Prep", async () => {
      const sharedBoardRoom = await getTestServer().createRoom<SharedBoardRoom>("shared_board");
      const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
        enableSharedBoardShadow: true,
        enableTouhouRoster: true,
      }, {
        prepDurationMs: 4_000,
        battleDurationMs: 4_000,
        settleDurationMs: 1_000,
        eliminationDurationMs: 1_000,
        sharedBoardRoomId: sharedBoardRoom.roomId,
      });
      const clients = await Promise.all([
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
      ]);

      const helperClients = [clients[0]!, clients[1]!, clients[2]!];
      const realPlayer = clients[3]!;
      const helperMonitors = helperClients.map((helperClient, helperIndex) =>
        attachAutoFillHelperAutomationForTest(helperClient, helperIndex));
      const roomInternals = serverRoom as unknown as {
        controller?: {
          getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
        };
        sharedBoardBridge?: {
          getState: () => string;
          syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
        };
      };

      for (const client of clients) {
        client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      }

      realPlayer.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });

      for (const helperClient of helperClients) {
        helperClient.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }
      realPlayer.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });

      await waitForCondition(() => serverRoom.state.lobbyStage === "selection", 1_000);

      realPlayer.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

      await waitForCondition(
        () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
        1_500,
      );

      await waitForCondition(() => helperClients.every((helperClient) => {
        const placements = roomInternals.controller?.getBoardPlacementsForPlayer(helperClient.sessionId) ?? [];
        return placements.length >= 1;
      }), 1_500);

      roomInternals.sharedBoardBridge?.syncSharedBoardViewFromController?.(true);
      await waitForSharedBoardPropagation(
        roomInternals.sharedBoardBridge,
        () =>
          helperClients.every((helperClient) => {
            const placements =
              roomInternals.controller?.getBoardPlacementsForPlayer(helperClient.sessionId) ?? [];
            return placements.length >= 1;
          }),
        SHARED_BOARD_PROPAGATION_TIMEOUT_MS,
      );

      for (const helperClient of helperClients) {
        const placements = roomInternals.controller?.getBoardPlacementsForPlayer(helperClient.sessionId) ?? [];
        expect(placements.length).toBeGreaterThanOrEqual(1);
        expect(placements.every((placement) => placement.cell >= 18)).toBe(true);
      }

      const helperOccupiedCells = Array.from(sharedBoardRoom.state.cells.values())
        .filter((cell) => helperClients.some((helperClient) => cell.ownerId === helperClient.sessionId))
        .map((cell) => cell.index)
        .sort((left, right) => left - right);

      expect(helperOccupiedCells).toEqual(expect.arrayContaining([31, 33, 35]));

      const helperResults = helperMonitors.flatMap((monitor) => monitor.getResults());
      expect(helperResults).toEqual(expect.arrayContaining([{ accepted: true }]));
    });


    test("shared board hero move updates hero placement outside the old raid footprint", async () => {
      const sharedBoardRoom = await getTestServer().createRoom<SharedBoardRoom>("shared_board");
      const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer(), {
        prepDurationMs: 4_000,
      battleDurationMs: 4_000,
      settleDurationMs: 1_000,
      eliminationDurationMs: 1_000,
      sharedBoardRoomId: sharedBoardRoom.roomId,
    }, {
      enableSharedBoardShadow: true,
    });

    const raidPlayerId = clients[0]!.sessionId;
    const targetHeroCell = sharedBoardCoordinateToIndex({ x: 0, y: 4 });
    const roomInternals = serverRoom as unknown as {
      controller?: {
        getHeroPlacementForPlayer: (playerId: string) => number | null;
      };
      sharedBoardBridge?: {
        getState: () => string;
        syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
        flushPlacementChangeBatch?: () => Promise<void>;
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);

    await waitForCondition(
      () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
      1_000,
    );
    roomInternals.sharedBoardBridge?.syncSharedBoardViewFromController?.(true);

    await waitForCondition(
      () => (roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId) ?? -1) >= 0,
      1_000,
    );

    const initialHeroCell = roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId);
    if (typeof initialHeroCell !== "number") {
      throw new Error("Expected hero placement to be available");
    }

    await waitForCondition(() => {
      const cell = sharedBoardRoom.state.cells.get(String(initialHeroCell));
      return cell?.ownerId === raidPlayerId && cell.unitId === `hero:${raidPlayerId}`;
    }, SHARED_BOARD_PROPAGATION_TIMEOUT_MS);

    const sharedClient = await getTestServer().connectTo(sharedBoardRoom, {
      gamePlayerId: raidPlayerId,
    });
    sharedClient.onMessage("shared_role", (_message: unknown) => {});
    sharedClient.send("shared_request_role");
    const sharedRole = await sharedClient.waitForMessage("shared_role");
    expect(sharedRole).toMatchObject({
      isSpectator: false,
    });

    await waitForCondition(() => {
      const sharedPlayer = sharedBoardRoom.state.players.get(sharedClient.sessionId);
      return sharedPlayer?.isSpectator === false;
    }, 1_000);

    sharedClient.send("shared_place_unit", {
      unitId: `hero:${raidPlayerId}`,
      toCell: targetHeroCell,
    });

    const placeResult = await sharedClient.waitForMessage("shared_action_result");
    expect(placeResult).toEqual({
      accepted: true,
      action: "place_unit",
    });

    await waitForSharedBoardPropagation(
      roomInternals.sharedBoardBridge,
      () => roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId) === targetHeroCell,
      SHARED_BOARD_PROPAGATION_TIMEOUT_MS,
    );

    await waitForSharedBoardPropagation(roomInternals.sharedBoardBridge, () => {
      const targetCell = sharedBoardRoom.state.cells.get(String(targetHeroCell));
      const sourceCell = sharedBoardRoom.state.cells.get(String(initialHeroCell));
      return (
        targetCell?.ownerId === raidPlayerId
        && targetCell?.unitId === `hero:${raidPlayerId}`
        && sourceCell?.unitId === ""
      );
    }, SHARED_BOARD_PROPAGATION_TIMEOUT_MS);
  }, 15_000);


  test("shared board boss move updates boss placement from its fixed top-row cell", async () => {
    const sharedBoardRoom = await getTestServer().createRoom<SharedBoardRoom>("shared_board");
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer(), {
      prepDurationMs: 12_000,
      battleDurationMs: 12_000,
      settleDurationMs: 1_000,
      eliminationDurationMs: 1_000,
      sharedBoardRoomId: sharedBoardRoom.roomId,
    }, {
      enableSharedBoardShadow: true,
    });

    const targetBossCell = sharedBoardCoordinateToIndex({ x: 4, y: 2 });
    const roomInternals = serverRoom as unknown as {
      controller?: {
        getBossPlacementForPlayer: (playerId: string) => number | null;
      };
      sharedBoardBridge?: {
        getState: () => string;
        syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
        flushPlacementChangeBatch?: () => Promise<void>;
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients, 1_000);
    const bossPlayerId = serverRoom.state.bossPlayerId;
    if (!bossPlayerId) {
      throw new Error("Expected boss player after role selection");
    }

    await waitForCondition(
      () => roomInternals.sharedBoardBridge?.getState() === "READY" && serverRoom.state.phase === "Prep",
      1_000,
    );
    roomInternals.sharedBoardBridge?.syncSharedBoardViewFromController?.(true);

    await waitForCondition(
      () => (roomInternals.controller?.getBossPlacementForPlayer(bossPlayerId) ?? -1) >= 0,
      1_000,
    );

    const initialBossCell = roomInternals.controller?.getBossPlacementForPlayer(bossPlayerId);
    if (typeof initialBossCell !== "number") {
      throw new Error("Expected boss placement to be available");
    }

    await waitForCondition(() => {
      const cell = sharedBoardRoom.state.cells.get(String(initialBossCell));
      return cell?.ownerId === bossPlayerId && cell.unitId === `boss:${bossPlayerId}`;
    }, SHARED_BOARD_PROPAGATION_TIMEOUT_MS);

    const sharedClient = await getTestServer().connectTo(sharedBoardRoom, {
      gamePlayerId: bossPlayerId,
    });
    sharedClient.onMessage("shared_role", (_message: unknown) => {});
    sharedClient.send("shared_request_role");
    const sharedRole = await sharedClient.waitForMessage("shared_role");
    expect(sharedRole).toMatchObject({
      isSpectator: false,
    });

    await waitForCondition(() => {
      const sharedPlayer = sharedBoardRoom.state.players.get(sharedClient.sessionId);
      return sharedPlayer?.isSpectator === false;
    }, 1_000);

    sharedClient.send("shared_place_unit", {
      unitId: `boss:${bossPlayerId}`,
      toCell: targetBossCell,
    });

    const placeResult = await sharedClient.waitForMessage("shared_action_result");
    expect(placeResult).toEqual({
      accepted: true,
      action: "place_unit",
    });
    await waitForSharedBoardPropagation(
      roomInternals.sharedBoardBridge,
      () => roomInternals.controller?.getBossPlacementForPlayer(bossPlayerId) === targetBossCell,
      SHARED_BOARD_BOSS_PROPAGATION_TIMEOUT_MS,
    );

    await waitForSharedBoardPropagation(roomInternals.sharedBoardBridge, () => {
      const targetCell = sharedBoardRoom.state.cells.get(String(targetBossCell));
      const sourceCell = sharedBoardRoom.state.cells.get(String(initialBossCell));
      return (
        targetCell?.ownerId === bossPlayerId
        && targetCell?.unitId === `boss:${bossPlayerId}`
        && sourceCell?.unitId === ""
      );
    }, SHARED_BOARD_BOSS_PROPAGATION_TIMEOUT_MS);
  }, 20_000);

});



