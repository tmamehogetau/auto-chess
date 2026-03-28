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

describeGameRoomIntegration("GameRoom integration / round state sync", (context) => {
  const getTestServer = () => context.testServer;
  test("round_stateメッセージに順位とラウンド情報が含まれる", async () => {
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

    const roundStatePromise = clients[0].waitForMessage(SERVER_MESSAGE_TYPES.ROUND_STATE);

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const roundState = await roundStatePromise;

    expect(roundState.phase).toBe("Prep");
    expect(roundState.roundIndex).toBe(1);
    expect(roundState.ranking.length).toBe(4);
    expect(roundState.phaseDeadlineAtMs).toBeGreaterThan(0);
    expect(roundState.phaseHpTarget).toBe(600);
    expect(roundState.phaseDamageDealt).toBe(0);
    expect(roundState.phaseResult).toBe("pending");
    expect(roundState.phaseCompletionRate).toBe(0);
    expect(roundState).not.toHaveProperty("setId");
    expect(serverRoom.state.setId).toBe("set1");
  });


  test("Prep->Battle->Settle->Elimination->PrepでroundIndexが進む", async () => {
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
    await waitForCondition(() => serverRoom.state.phase === "Settle", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Elimination", 1_000);
    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    expect(serverRoom.state.roundIndex).toBe(2);
  });


  test("自動戦闘ダメージが次Prepでstateに反映される", async () => {
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

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    const sortedPlayerIds = clients.map((client) => client.sessionId).sort();
    const firstWinnerId = sortedPlayerIds[0];
    const secondWinnerId = sortedPlayerIds[1];
    const firstLoserId = sortedPlayerIds[2];
    const secondLoserId = sortedPlayerIds[3];

    if (
      !firstWinnerId ||
      !firstLoserId ||
      !secondWinnerId ||
      !secondLoserId
    ) {
      throw new Error("Expected 4 player session ids");
    }

    expect(serverRoom.state.players.get(firstLoserId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(secondLoserId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(firstWinnerId)?.hp).toBe(100);
    expect(serverRoom.state.players.get(secondWinnerId)?.hp).toBe(100);
  });

});


