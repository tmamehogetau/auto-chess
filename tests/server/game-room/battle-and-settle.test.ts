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

describeGameRoomIntegration("GameRoom integration / battle and settle", (context) => {
  const getTestServer = () => context.testServer;
  test("Prepの締切を過ぎるとBattleへ自動遷移する", async () => {
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

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

    expect(serverRoom.state.phase).toBe("Battle");
  });

  test("raid phase success bonus syncs to room state without granting the boss extra gold", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(
      getTestServer(),
      {
        prepDurationMs: 10_000,
        battleDurationMs: 10_000,
        settleDurationMs: 10_000,
        eliminationDurationMs: 10_000,
      },
    );
    const roomInternals = serverRoom as unknown as {
      advanceLoop: (nowMs: number) => void;
      controller?: {
        getPhaseProgress: () => {
          targetHp: number;
          damageDealt: number;
          result: "pending" | "success" | "failed";
        };
        didRaidSideLoseAllBattleUnits: () => boolean;
        getTestAccess: () => {
          battleInputSnapshotByPlayer: Map<string, Array<{
            cell: number;
            unitType: string;
            unitId?: string;
          }>>;
          battleResultsByPlayer: Map<string, {
            opponentId: string;
            won: boolean;
            damageDealt: number;
            damageTaken: number;
            survivors: number;
            opponentSurvivors: number;
            survivorSnapshots?: Array<{
              unitId: string;
              displayName: string;
              unitType: string;
              hp: number;
              maxHp: number;
              sharedBoardCellIndex: number;
            }>;
          }>;
        };
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients);

    if (!roomInternals.controller) {
      throw new Error("Expected room controller");
    }

    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);
    expect(serverRoom.state.phase).toBe("Battle");

    serverRoom.setPendingPhaseDamageForTest(600);
    const originalDidRaidSideLoseAllBattleUnits = roomInternals.controller.didRaidSideLoseAllBattleUnits;
    roomInternals.controller.didRaidSideLoseAllBattleUnits = () => false;
    try {
      const bossPlayerId = serverRoom.state.bossPlayerId;
      const raidPlayerIds = Array.from(serverRoom.state.raidPlayerIds);
      expect(bossPlayerId).not.toBe("");
      expect(raidPlayerIds).toHaveLength(3);
      const { battleInputSnapshotByPlayer, battleResultsByPlayer } = roomInternals.controller.getTestAccess();
      for (const raidPlayerId of raidPlayerIds) {
        battleInputSnapshotByPlayer.set(raidPlayerId, [
          {
            cell: 31,
            unitType: "vanguard",
            unitId: `${raidPlayerId}-unit`,
          },
        ]);
        battleResultsByPlayer.set(raidPlayerId, {
          opponentId: bossPlayerId,
          won: true,
          damageDealt: 10,
          damageTaken: 0,
          survivors: 1,
          opponentSurvivors: 0,
          survivorSnapshots: [
            {
              unitId: `${raidPlayerId}-unit`,
              displayName: `${raidPlayerId}-unit`,
              unitType: "vanguard",
              hp: 10,
              maxHp: 10,
              sharedBoardCellIndex: 18,
            },
          ],
        });
      }

      roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);
      expect(serverRoom.state.phase).toBe("Settle");
      expect(roomInternals.controller.getPhaseProgress()).toMatchObject({
        targetHp: 600,
        damageDealt: 600,
        result: "success",
      });
    } finally {
      roomInternals.controller.didRaidSideLoseAllBattleUnits = originalDidRaidSideLoseAllBattleUnits;
    }
    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);
    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);

    const bossPlayer = serverRoom.state.players.get(clients[1]!.sessionId);
    const raidPlayerA = serverRoom.state.players.get(clients[0]!.sessionId);
    const raidPlayerB = serverRoom.state.players.get(clients[2]!.sessionId);
    const raidPlayerC = serverRoom.state.players.get(clients[3]!.sessionId);

    expect(bossPlayer?.gold).toBe(17);
    expect(raidPlayerA?.gold).toBe(12);
    expect(raidPlayerB?.gold).toBe(12);
    expect(raidPlayerC?.gold).toBe(12);
  });

  test("player-facing purchase/deploy/battle phases are exposed and next purchase starts with hero-only board", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(
      getTestServer(),
      {
        prepDurationMs: 240,
        battleDurationMs: 120,
        settleDurationMs: 80,
        eliminationDurationMs: 80,
      },
    );
    const roundStates: RoundStateMessage[] = [];
    const roomInternals = serverRoom as unknown as {
      controller?: {
        getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
        getHeroPlacementForPlayer: (playerId: string) => number | null;
      };
    };

    clients[0]!.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message: unknown) => {
      roundStates.push(message as RoundStateMessage);
    });

    await resolveBossRoleSelectionToPrep(serverRoom, clients);

    const raidPlayerId = clients[0]!.sessionId;

    expect(serverRoom.state.phase).toBe("Prep");
    expect((serverRoom.state as unknown as { playerPhase?: string }).playerPhase).toBe("purchase");
    expect((serverRoom.state as unknown as { playerPhaseDeadlineAtMs?: number }).playerPhaseDeadlineAtMs)
      .toBeGreaterThan(0);
    expect(clients.every((client) => serverRoom.state.players.get(client.sessionId)?.ready === false)).toBe(true);
    expect(roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId)).not.toBeNull();
    expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([]);
    expect(roundStates.some((message) => (message as RoundStateMessage & { playerPhase?: string }).playerPhase === "purchase")).toBe(true);

    await waitForCondition(
      () => (serverRoom.state as unknown as { playerPhase?: string }).playerPhase === "deploy",
      1_000,
    );

    expect((serverRoom.state as unknown as { playerPhase?: string }).playerPhase).toBe("deploy");

    clients[0]!.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [
        { cell: 24, unitType: "vanguard" },
      ],
    });
    await expect(clients[0]!.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).resolves.toEqual({
      accepted: true,
    });

    expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([
      expect.objectContaining({ cell: 24, unitType: "vanguard" }),
    ]);

    await waitForCondition(
      () => serverRoom.state.phase === "Battle"
        && (serverRoom.state as unknown as { playerPhase?: string }).playerPhase === "battle",
      1_000,
    );

    await waitForCondition(
      () => serverRoom.state.phase === "Prep"
        && serverRoom.state.roundIndex === 2
        && (serverRoom.state as unknown as { playerPhase?: string }).playerPhase === "purchase",
      2_000,
    );

    expect(clients.every((client) => serverRoom.state.players.get(client.sessionId)?.ready === false)).toBe(true);
    expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([]);
    expect(roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId)).not.toBeNull();
  });

  test("round 6 battle completion revives eliminated raid players and still advances to round 7 prep", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(
      getTestServer(),
      {
        prepDurationMs: 10_000,
        battleDurationMs: 10_000,
        settleDurationMs: 10_000,
        eliminationDurationMs: 10_000,
      },
    );
    const roomInternals = serverRoom as unknown as {
      advanceLoop: (nowMs: number) => void;
      controller?: {
        roundIndex: number;
        getPlayerStatus: (playerId: string) => {
          remainingLives: number;
          eliminated: boolean;
          benchUnits: string[];
        };
        getBoardPlacementsForPlayer: (playerId: string) => Array<{ cell: number; unitType: string }>;
        getHeroPlacementForPlayer: (playerId: string) => number | null;
        getTestAccess: () => {
          battleResultsByPlayer: Map<string, {
            opponentId: string;
            won: boolean;
            damageDealt: number;
            damageTaken: number;
            survivors: number;
            opponentSurvivors: number;
          }>;
        };
      };
    };
    const controllerInternals = roomInternals.controller as unknown as {
      gameLoopState: {
        roundIndex: number;
        players: Map<string, {
          remainingLives: number;
          eliminated: boolean;
        }>;
      };
      boardPlacementsByPlayer: Map<string, Array<{
        cell: number;
        unitType: string;
        unitLevel: number;
        sellValue: number;
        unitCount: number;
      }>>;
      benchUnitsByPlayer: Map<string, Array<{
        unitType: string;
        cost: number;
        unitLevel: number;
        unitCount: number;
      }>>;
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients);

    const bossPlayerId = clients[1]!.sessionId;
    const revivedRaidPlayerId = clients[2]!.sessionId;
    const survivingRaidPlayerIds = [clients[0]!.sessionId, clients[3]!.sessionId];
    const revivedRaid = controllerInternals.gameLoopState.players.get(revivedRaidPlayerId);
    const survivingRaidA = controllerInternals.gameLoopState.players.get(survivingRaidPlayerIds[0]!);
    const survivingRaidB = controllerInternals.gameLoopState.players.get(survivingRaidPlayerIds[1]!);

    if (!roomInternals.controller || !revivedRaid || !survivingRaidA || !survivingRaidB) {
      throw new Error("Expected room controller and raid player states");
    }

    controllerInternals.gameLoopState.roundIndex = 6;
    survivingRaidA.remainingLives = 2;
    survivingRaidA.eliminated = false;
    revivedRaid.remainingLives = 0;
    revivedRaid.eliminated = true;
    survivingRaidB.remainingLives = 2;
    survivingRaidB.eliminated = false;

    controllerInternals.boardPlacementsByPlayer.set(revivedRaidPlayerId, [
      { cell: 30, unitType: "mage", unitLevel: 1, sellValue: 2, unitCount: 1 },
    ]);
    controllerInternals.benchUnitsByPlayer.set(revivedRaidPlayerId, [
      { unitType: "vanguard", cost: 1, unitLevel: 1, unitCount: 1 },
    ]);

    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);

    expect(serverRoom.state.phase).toBe("Battle");
    serverRoom.setPendingPhaseDamageForTest(100);

    const { battleResultsByPlayer } = roomInternals.controller.getTestAccess();
    for (const raidPlayerId of survivingRaidPlayerIds) {
      battleResultsByPlayer.set(raidPlayerId, {
        opponentId: bossPlayerId,
        won: true,
        damageDealt: 10,
        damageTaken: 0,
        survivors: 1,
        opponentSurvivors: 0,
      });
    }

    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);
    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);
    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);

    const revivedRaidState = serverRoom.state.players.get(revivedRaidPlayerId);

    expect({
      phase: serverRoom.state.phase,
      roundIndex: serverRoom.state.roundIndex,
      playerPhase: (serverRoom.state as unknown as { playerPhase?: string }).playerPhase,
      revivedEliminated: revivedRaidState?.eliminated,
      revivedLives: revivedRaidState?.remainingLives,
      revivedBench: Array.from(revivedRaidState?.benchUnits ?? []),
      revivedBoardUnits: Array.from(revivedRaidState?.boardUnits ?? []),
    }).toMatchObject({
      phase: "Prep",
      roundIndex: 7,
      playerPhase: "purchase",
      revivedEliminated: false,
      revivedLives: 1,
      revivedBench: ["vanguard", "mage"],
      revivedBoardUnits: [],
    });
    expect(roomInternals.controller.getHeroPlacementForPlayer(revivedRaidPlayerId)).not.toBeNull();
  });

  test("round 6 battle completion still advances to round 7 prep when every raider is temporarily at zero lives", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(
      getTestServer(),
      {
        prepDurationMs: 10_000,
        battleDurationMs: 10_000,
        settleDurationMs: 10_000,
        eliminationDurationMs: 10_000,
      },
    );
    const roomInternals = serverRoom as unknown as {
      advanceLoop: (nowMs: number) => void;
      controller?: {
        getPlayerStatus: (playerId: string) => {
          remainingLives: number;
          eliminated: boolean;
          benchUnits: string[];
        };
        getHeroPlacementForPlayer: (playerId: string) => number | null;
        getTestAccess: () => {
          battleResultsByPlayer: Map<string, {
            opponentId: string;
            won: boolean;
            damageDealt: number;
            damageTaken: number;
            survivors: number;
            opponentSurvivors: number;
          }>;
        };
      };
    };
    const controllerInternals = roomInternals.controller as unknown as {
      gameLoopState: {
        roundIndex: number;
        players: Map<string, {
          remainingLives: number;
          eliminated: boolean;
        }>;
      };
    };

    await resolveBossRoleSelectionToPrep(serverRoom, clients);

    const bossPlayerId = clients[1]!.sessionId;
    const raidPlayerIds = [clients[0]!.sessionId, clients[2]!.sessionId, clients[3]!.sessionId];

    if (!roomInternals.controller) {
      throw new Error("Expected room controller");
    }

    controllerInternals.gameLoopState.roundIndex = 6;
    for (const raidPlayerId of raidPlayerIds) {
      const raidState = controllerInternals.gameLoopState.players.get(raidPlayerId);
      if (!raidState) {
        throw new Error(`Expected raid player state for ${raidPlayerId}`);
      }
      raidState.remainingLives = 0;
      raidState.eliminated = false;
    }

    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);

    expect(serverRoom.state.phase).toBe("Battle");
    serverRoom.setPendingPhaseDamageForTest(0);

    const { battleResultsByPlayer } = roomInternals.controller.getTestAccess();
    for (const raidPlayerId of raidPlayerIds) {
      battleResultsByPlayer.set(raidPlayerId, {
        opponentId: bossPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: 10,
        survivors: 0,
        opponentSurvivors: 1,
      });
    }

    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);
    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);
    roomInternals.advanceLoop(serverRoom.state.phaseDeadlineAtMs + 1);

    expect({
      phase: serverRoom.state.phase,
      roundIndex: serverRoom.state.roundIndex,
      playerPhase: (serverRoom.state as unknown as { playerPhase?: string }).playerPhase,
      raidStates: raidPlayerIds.map((playerId) => {
        const playerState = serverRoom.state.players.get(playerId);
        return {
          eliminated: playerState?.eliminated,
          remainingLives: playerState?.remainingLives,
        };
      }),
    }).toMatchObject({
      phase: "Prep",
      roundIndex: 7,
      playerPhase: "purchase",
      raidStates: [
        { eliminated: false, remainingLives: 1 },
        { eliminated: false, remainingLives: 1 },
        { eliminated: false, remainingLives: 1 },
      ],
    });
    expect(raidPlayerIds.every((playerId) => roomInternals.controller?.getHeroPlacementForPlayer(playerId) !== null)).toBe(true);
  });


  test("戦闘結果のtimelineEndStateがroom stateへ同期される", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");
    const clients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    for (const [index, client] of clients.entries()) {
      client.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 1,
        boardPlacements: [
          { cell: index % 2 === 0 ? 0 : 7, unitType: "vanguard" },
        ],
      });

      await expect(client.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).resolves.toEqual({
        accepted: true,
      });
    }

    await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);

    const timelineEndState = serverRoom.state.players.get(clients[0]!.sessionId)?.lastBattleResult.timelineEndState;

    expect(timelineEndState?.length).toBeGreaterThan(0);
    expect(timelineEndState?.[0]).toMatchObject({
      battleUnitId: expect.any(String),
      x: expect.any(Number),
      y: expect.any(Number),
      currentHp: expect.any(Number),
      maxHp: expect.any(Number),
    });
  });


  test("set2ルームのranger編成 fixture は shared-index pathing でも勝利する", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game", {
      setId: "set2",
    });
    const clients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    for (const client of clients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const set2RoundState = await clients[0].waitForMessage(
      SERVER_MESSAGE_TYPES.ROUND_STATE,
    );
    expect(set2RoundState.phase).toBe("Prep");
    expect(serverRoom.state.setId).toBe("set2");

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    const sortedSessionIds = clients.map((client) => client.sessionId).sort();
    const lowId = sortedSessionIds[0];
    const highId = sortedSessionIds[3];

    if (!lowId || !highId) {
      throw new Error("Expected 4 player session ids");
    }

    const clientBySessionId = new Map(clients.map((client) => [client.sessionId, client]));
    const lowClient = clientBySessionId.get(lowId);
    const highClient = clientBySessionId.get(highId);

    if (!lowClient || !highClient) {
      throw new Error("Expected clients for target players");
    }

    const lowResultPromise = lowClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    const highResultPromise = highClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );

    lowClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(4), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(1), unitType: "assassin" },
      ],
    });
    highClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [
        { cell: combatCellToRaidBoardIndex(0), unitType: "vanguard" },
        { cell: combatCellToRaidBoardIndex(2), unitType: "ranger" },
        { cell: combatCellToRaidBoardIndex(5), unitType: "mage" },
        { cell: combatCellToRaidBoardIndex(4), unitType: "assassin" },
      ],
    });

    const lowResult = await lowResultPromise;
    const highResult = await highResultPromise;

    expect(lowResult).toEqual({ accepted: true });
    expect(highResult).toEqual({ accepted: true });

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    expect(serverRoom.state.players.get(lowId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(highId)?.hp).toBe(87);
  });

});


