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
        prepDurationMs: 120,
        battleDurationMs: 200,
        settleDurationMs: 80,
        eliminationDurationMs: 80,
      },
    );

    await resolveBossRoleSelectionToPrep(serverRoom, clients);
    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

    serverRoom.setPendingPhaseDamageForTest(600);

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    const bossPlayer = serverRoom.state.players.get(clients[1]!.sessionId);
    const raidPlayerA = serverRoom.state.players.get(clients[0]!.sessionId);
    const raidPlayerB = serverRoom.state.players.get(clients[2]!.sessionId);
    const raidPlayerC = serverRoom.state.players.get(clients[3]!.sessionId);

    expect(bossPlayer?.gold).toBe(24);
    expect(raidPlayerA?.gold).toBe(22);
    expect(raidPlayerB?.gold).toBe(22);
    expect(raidPlayerC?.gold).toBe(22);
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

    expect(roomInternals.controller?.getBoardPlacementsForPlayer(raidPlayerId)).toEqual([]);
    expect(roomInternals.controller?.getHeroPlacementForPlayer(raidPlayerId)).not.toBeNull();
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

    const lowResult = await lowClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    const highResult = await highClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );

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


