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

describeGameRoomIntegration("GameRoom integration / lobby lifecycle", (context) => {
  const getTestServer = () => context.testServer;
  test("4人joinして全員readyでPrep開始し、ルームがlockされる", async () => {
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

    expect(serverRoom.state.setId).toBe("set1");
    expect(serverRoom.state.prepDeadlineAtMs).toBeGreaterThan(0);
    expect(serverRoom.locked).toBe(true);
  });


  test("3人のreadyだけではPrepへ進まない", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");
    const earlyClients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    for (const client of earlyClients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(serverRoom.state.phase).toBe("Waiting");

    for (const client of earlyClients) {
      expect(serverRoom.state.players.get(client.sessionId)?.ready).toBe(true);
    }
  });


  test("5人目のactive player joinは拒否される", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");

    await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    await expect(getTestServer().connectTo(serverRoom)).rejects.toThrow("Active player capacity reached");
    expect(Array.from(serverRoom.state.players.values()).filter((player) => player.isSpectator !== true)).toHaveLength(4);
  });


  test("2人目のspectator joinは拒否される", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");

    await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);
    await getTestServer().connectTo(serverRoom, { spectator: true });

    await expect(getTestServer().connectTo(serverRoom, { spectator: true })).rejects.toThrow("Spectator capacity reached");
    expect(Array.from(serverRoom.state.players.values()).filter((player) => player.isSpectator === true)).toHaveLength(1);
  });


  test("joinOrCreateのsetId指定がroom.stateへ反映される", async () => {
    const firstClient = await getTestServer().sdk.joinOrCreate("game", {
      setId: "set2",
    });
    const serverRoom = getTestServer().getRoomById<GameRoom>(firstClient.roomId);

    if (!serverRoom) {
      throw new Error("Expected room to be created by joinOrCreate");
    }

    const extraClients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);
    const clients = [firstClient, ...extraClients];

    const roundStatePromise = new Promise<RoundStateMessage>((resolve) => {
      firstClient.onMessage<RoundStateMessage>(
        SERVER_MESSAGE_TYPES.ROUND_STATE,
        (message) => {
          resolve(message);
        },
      );
    });

    for (const client of extraClients) {
      client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
    }

    for (const client of clients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    const roundState = await roundStatePromise;

    expect(roundState.phase).toBe("Prep");
    expect(serverRoom.state.setId).toBe("set2");
  });


  test("異常切断後に再接続するとconnectedがtrueへ戻る", async () => {
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

    const droppedClient = clients[0];
    const previousSessionId = droppedClient.sessionId;
    const reconnectionToken = droppedClient.reconnectionToken;

    droppedClient.connection.close(4001, "network drop");

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
  });


  test("connectAndAttachSetIdDisplayでjoinOrCreateからsetId表示できる", async () => {
    const root = new FakeRoot();
    const setIdElement = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");
    const createClient = async (_endpoint: string): Promise<BrowserClient> => {
      return {
        joinOrCreate: async (
          roomName: string,
          roomOptions?: Record<string, unknown>,
        ): Promise<BrowserRoom> => {
          const room = await getTestServer().sdk.joinOrCreate(roomName, roomOptions);
          return room as unknown as BrowserRoom;
        },
      };
    };

    const binding = await connectAndAttachSetIdDisplay({
      endpoint: "ws://unused",
      roomName: "game",
      roomOptions: { setId: "set2" },
      root,
      createClient,
    });

    if (!binding) {
      throw new Error("Expected connected binding");
    }

    await waitForText(setIdElement, "set2", 1_000);
    await binding.leave();
  });


  test("不正setIdでルーム作成するとエラーになる", async () => {
    await expect(
      getTestServer().createRoom<GameRoom>("game", {
        setId: "set3",
      }),
    ).rejects.toThrow("Invalid setId");
  });


  test("不正setIdでjoinOrCreateするとエラーになる", async () => {
    await expect(
      getTestServer().sdk.joinOrCreate("game", {
        setId: "set3",
      }),
    ).rejects.toThrow("Invalid setId");
  });


  test("Waiting中の離脱でghost playerが残らず、補充後に開始できる", async () => {
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

    await waitForCondition(() => serverRoom.state.players.size === 4, 1_000);

    clients[0].connection.close(4000, "refresh");

    await waitForCondition(() => serverRoom.state.players.size === 3, 1_000);

    const remainingClientIds = clients.slice(1).map((c) => c.sessionId);

    for (const clientId of remainingClientIds) {
      const player = serverRoom.state.players.get(clientId);
      expect(player?.ready).toBe(false);
      expect(player?.lastCmdSeq).toBe(0);
    }

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom.state.phaseDeadlineAtMs).toBe(0);
    expect(serverRoom.state.prepDeadlineAtMs).toBe(0);
    expect(serverRoom.state.roundIndex).toBe(0);
    expect(serverRoom.state.ranking.length).toBe(0);

    const newClient = await getTestServer().connectTo(serverRoom);
    newClient.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});

    await waitForCondition(() => serverRoom.state.players.size === 4, 1_000);

    const allClients = [...clients.slice(1), newClient];
    for (const client of allClients) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }

    await waitForCondition(() => serverRoom.state.phase === "Prep", 1_000);
  });


  test("Waitingで4人未満の離脱でもghost playerを残さない", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game");
    const clients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    await waitForCondition(() => serverRoom.state.players.size === 3, 1_000);

    clients[0].connection.close(4000, "refresh");

    await waitForCondition(() => serverRoom.state.players.size === 2, 1_000);
    expect(serverRoom.state.phase).toBe("Waiting");
  });


  test("Waiting中に4人未満へ減ったらlobby ready deadlineをclearして即時auto-startを防ぐ", async () => {
    const serverRoom = await getTestServer().createRoom<GameRoom>("game", {
      readyAutoStartMs: 300,
    });
    const clients = await Promise.all([
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
      getTestServer().connectTo(serverRoom),
    ]);

    await waitForCondition(() => serverRoom.state.players.size === 4, 1_000);
    const initialLobbyDeadline = serverRoom["lobbyReadyDeadlineAtMs"] as number;
    await new Promise((resolve) => setTimeout(resolve, 150));

    clients[0].connection.close(4000, "refresh");

    await waitForCondition(() => serverRoom.state.players.size === 3, 1_000);
    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom["lobbyReadyDeadlineAtMs"]).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(serverRoom.state.phase).toBe("Waiting");
    expect(serverRoom["lobbyReadyDeadlineAtMs"]).toBe(0);
  });

});


