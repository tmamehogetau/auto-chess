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

describeGameRoomIntegration("GameRoom integration / boss selection", (context) => {
  const getTestServer = () => context.testServer;
  test("boss1 raid3 roles are exposed after assignment", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      });
      const clients = await Promise.all([
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
        getTestServer().connectTo(serverRoom),
      ]);

      registerRoundStateListeners(clients);

      clients[1]?.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });

      for (const client of clients) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }

      const playerIds = clients.map((client) => client.sessionId);
      const expectedBossPlayerId = playerIds[1];
      const expectedRaidPlayerIds = [playerIds[0], playerIds[2], playerIds[3]];

      await waitForCondition(() => serverRoom.state.bossPlayerId === expectedBossPlayerId, 1_000);

      expect(serverRoom.state.bossPlayerId).toBe(expectedBossPlayerId);
      expect(Array.from(serverRoom.state.raidPlayerIds)).toHaveLength(expectedRaidPlayerIds.length);
      expect(Array.from(serverRoom.state.raidPlayerIds).sort()).toEqual(expectedRaidPlayerIds.sort());
    } finally {
      randomSpy.mockRestore();
    }
  });


  test("boss role flow resolves into selection stage and starts only after role-specific picks complete", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer());
    const bossClient = clients[1]!;
    const raidClientA = clients[0]!;
    const raidClientB = clients[2]!;
    const raidClientC = clients[3]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.lobbyStage).toBe("selection");
    expect(serverRoom.state.bossPlayerId).toBe(bossClient.sessionId);
    expect(serverRoom.state.selectionDeadlineAtMs).toBeGreaterThan(Date.now());
    expect(serverRoom.state.players.get(bossClient.sessionId)?.role).toBe("boss");
    expect(serverRoom.state.players.get(raidClientA.sessionId)?.role).toBe("raid");

    raidClientA.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    raidClientB.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
    raidClientC.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });

    await waitForCondition(() => (
      serverRoom.state.players.get(raidClientA.sessionId)?.selectedHeroId === "reimu"
      && serverRoom.state.players.get(raidClientB.sessionId)?.selectedHeroId === "marisa"
      && serverRoom.state.players.get(raidClientC.sessionId)?.selectedHeroId === "okina"
    ), 500);
    expect(serverRoom.state.phase).toBe("Waiting");

    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

    await waitForCondition(() => serverRoom.state.phase === "Prep", 500);

    expect(serverRoom.state.lobbyStage).toBe("started");
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
    expect(serverRoom.state.players.get(bossClient.sessionId)?.selectedBossId).toBe("remilia");
    expect(serverRoom.state.players.get(raidClientA.sessionId)?.selectedHeroId).toBe("reimu");
    expect(serverRoom.state.players.get(raidClientB.sessionId)?.selectedHeroId).toBe("marisa");
    expect(serverRoom.state.players.get(raidClientC.sessionId)?.selectedHeroId).toBe("okina");
  });


  test("spectator host does not block boss role selection for four active players", async () => {
    const serverRoom = await createRoomWithForcedFlags(getTestServer(), {
      enableBossExclusiveShop: true,
      enableHeroSystem: true,
    });

    const spectatorClient = await getTestServer().connectTo(serverRoom, { spectator: true });
    const activeClients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    registerRoundStateListeners([spectatorClient, ...activeClients]);

    const bossClient = activeClients[1]!;
    const raidClientA = activeClients[0]!;
    const raidClientB = activeClients[2]!;
    const raidClientC = activeClients[3]!;

    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
    for (const client of activeClients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.lobbyStage === "selection", 1_000);

    raidClientA.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    raidClientB.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
    raidClientC.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });
    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);

    expect(serverRoom.state.players.get(spectatorClient.sessionId)?.role).toBe("spectator");
    expect(serverRoom.state.players.get(spectatorClient.sessionId)?.isSpectator).toBe(true);
    expect(serverRoom.state.players.get(raidClientA.sessionId)?.selectedHeroId).toBe("reimu");
    expect(serverRoom.state.players.get(raidClientB.sessionId)?.selectedHeroId).toBe("marisa");
    expect(serverRoom.state.players.get(raidClientC.sessionId)?.selectedHeroId).toBe("okina");
    expect(serverRoom.state.players.get(bossClient.sessionId)?.selectedBossId).toBe("remilia");
    expect(Array.from(serverRoom.state.raidPlayerIds).sort()).toEqual(
      [raidClientA.sessionId, raidClientB.sessionId, raidClientC.sessionId].sort(),
    );
  });


  test("3人ではboss希望を保持したままselectionへ進まない", async () => {
    const serverRoom = await createRoomWithForcedFlags(
      getTestServer(),
      {
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      },
    );
    const earlyClients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    const volunteerClient = earlyClients[1]!;
    volunteerClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
    for (const client of earlyClients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.lobbyStage).toBe("preference");
    expect(serverRoom.state.bossPlayerId).toBe("");
    expect(serverRoom.state.players.get(volunteerClient.sessionId)?.wantsBoss).toBe(true);
  });


  test("boss role flow rejects invalid role-specific selection actions", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer());
    const bossClient = clients[1]!;
    const raidClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    bossClient.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    raidClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });
    expect(await raidClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    const wantsBossBefore = serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss;
    raidClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss).toBe(wantsBossBefore);
    expect(serverRoom.state.lobbyStage).toBe("selection");
  });


  test("selection timeout reset returns the room to preference and clears resolved roles", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer(), {
      selectionTimeoutMs: 120,
    });
    const bossClient = clients[1]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    await waitForCondition(() => serverRoom.state.lobbyStage === "preference", 1_000);

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.bossPlayerId).toBe("");
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
    expect(serverRoom.state.players.get(bossClient.sessionId)?.wantsBoss).toBe(true);

    for (const client of clients) {
      const player = serverRoom.state.players.get(client.sessionId);
      expect(player?.role).toBe("unassigned");
      expect(player?.selectedBossId).toBe("");
      expect(player?.selectedHeroId).toBe("");
      expect(player?.ready).toBe(false);
    }
  });


  test("pre-start disconnect reset preserves connected wantsBoss and clears resolved selections", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer());
    const bossClient = clients[1]!;
    const droppedClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    droppedClient.connection.close(4_001, "pre-start drop");

    await waitForCondition(() => serverRoom.state.lobbyStage === "preference", 1_000);

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.bossPlayerId).toBe("");
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
    expect(serverRoom.state.players.get(droppedClient.sessionId)).toBeUndefined();
    expect(serverRoom.state.players.get(bossClient.sessionId)?.wantsBoss).toBe(true);

    for (const client of clients.slice(1)) {
      const player = serverRoom.state.players.get(client.sessionId);
      expect(player?.role).toBe("unassigned");
      expect(player?.selectedBossId).toBe("");
      expect(player?.selectedHeroId).toBe("");
      expect(player?.ready).toBe(false);
    }
  });


  test("pre-start disconnect reset also clears controller-ready state", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer());
    const remainingClient = clients[1]!;
    const droppedClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    droppedClient.connection.close(4_001, "pre-start drop");

    await waitForCondition(() => serverRoom.state.lobbyStage === "preference", 1_000);

    remainingClient.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.lobbyStage).toBe("preference");
    expect(serverRoom.state.players.get(remainingClient.sessionId)?.ready).toBe(true);
    expect(serverRoom.state.selectionDeadlineAtMs).toBe(0);
  });


  test("boss role handlers reject malformed selection packets without mutating lobby state", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer());
    const bossClient = clients[1]!;
    const raidClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, null);
    expect(await bossClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    raidClient.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, null);
    expect(await raidClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: false,
      code: "INVALID_PAYLOAD",
    });

    const wantsBossBefore = serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss;
    raidClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, null);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(serverRoom.state.players.get(raidClient.sessionId)?.wantsBoss).toBe(wantsBossBefore);
  });


  test("post-start reconnect keeps resolved role selections in synced room state", async () => {
    const { serverRoom, clients } = await connectBossRoleSelectionRoom(getTestServer());
    const bossClient = clients[1]!;
    const raidClient = clients[0]!;

    await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

    clients[0]?.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
    clients[2]?.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
    clients[3]?.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });
    bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

    await waitForCondition(() => serverRoom.state.phase === "Prep", 500);

    const previousSessionId = raidClient.sessionId;
    const reconnectionToken = raidClient.reconnectionToken;
    raidClient.connection.close(4_001, "network drop");

    await waitForCondition(
      () => serverRoom.state.players.get(previousSessionId)?.connected === false,
      1_000,
    );

    const reconnected = await getTestServer().sdk.reconnect(reconnectionToken);

    await waitForCondition(
      () => serverRoom.state.players.get(previousSessionId)?.connected === true,
      1_000,
    );

    expect(reconnected.sessionId).toBe(previousSessionId);
    expect(serverRoom.state.players.get(previousSessionId)?.role).toBe("raid");
    expect(serverRoom.state.players.get(previousSessionId)?.selectedHeroId).toBe("reimu");
    expect(serverRoom.state.players.get(previousSessionId)?.selectedBossId).toBe("");
    expect(serverRoom.state.players.get(previousSessionId)?.wantsBoss).toBe(false);
    expect(serverRoom.state.players.get(bossClient.sessionId)?.role).toBe("boss");
    expect(serverRoom.state.players.get(bossClient.sessionId)?.selectedBossId).toBe("remilia");
  });

});



