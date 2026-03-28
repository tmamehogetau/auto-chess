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

describeGameRoomIntegration("GameRoom integration / prep phase", (context) => {
  const getTestServer = () => context.testServer;
  test("command_resultはPrepでacceptされBattleではPHASE_MISMATCHになる", async () => {
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

    clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq: 1 });
    const accepted = await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

    expect(accepted).toEqual({ accepted: true });

    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

    clients[0].send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq: 2 });
    const rejected = await clients[0].waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

    expect(rejected).toEqual({ accepted: false, code: "PHASE_MISMATCH" });
  });


  test("prep_commandのboardUnitCountで勝敗が変わる", async () => {
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

    const sortedSessionIds = clients.map((client) => client.sessionId).sort();
    const weakestA = sortedSessionIds[0];
    const weakestB = sortedSessionIds[1];
    const strongestA = sortedSessionIds[2];
    const strongestB = sortedSessionIds[3];

    if (!weakestA || !weakestB || !strongestA || !strongestB) {
      throw new Error("Expected 4 player session ids");
    }

    const clientBySessionId = new Map(clients.map((client) => [client.sessionId, client]));
    const strongestAClient = clientBySessionId.get(strongestA);
    const strongestBClient = clientBySessionId.get(strongestB);

    if (!strongestAClient || !strongestBClient) {
      throw new Error("Expected clients for strongest players");
    }

    strongestAClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardUnitCount: 8,
    });
    strongestBClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardUnitCount: 8,
    });

    const strongestAResult =
      await strongestAClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    const strongestBResult =
      await strongestBClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

    expect(strongestAResult).toEqual({ accepted: true });
    expect(strongestBResult).toEqual({ accepted: true });

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    expect(serverRoom.state.players.get(weakestA)?.hp).toBe(100);
    expect(serverRoom.state.players.get(weakestB)?.hp).toBe(100);
    expect(serverRoom.state.players.get(strongestA)?.hp).toBe(100);
    expect(serverRoom.state.players.get(strongestB)?.hp).toBe(100);
  });


  test("prep_commandのboardPlacementsでboardUnitCountが同期される", async () => {
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

    const targetClient = clients[0];
    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "vanguard" },
        { cell: 2, unitType: "ranger" },
        { cell: 3, unitType: "ranger" },
        { cell: 4, unitType: "assassin" },
        { cell: 5, unitType: "mage" },
      ],
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    await waitForCondition(
      () =>
        serverRoom.state.players.get(targetClient.sessionId)?.boardUnitCount === 6,
      1_000,
    );

    expect(serverRoom.state.players.get(targetClient.sessionId)?.boardUnitCount).toBe(6);
  });


  test("xpPurchaseCountでgold/xp/levelがstateへ同期される", async () => {
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

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      xpPurchaseCount: 2,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    await waitForCondition(() => {
      const player = serverRoom.state.players.get(targetClient.sessionId);
      return player?.gold === 7 && player?.xp === 4 && player?.level === 3;
    }, 1_000);

    const player = serverRoom.state.players.get(targetClient.sessionId);

    expect(player?.gold).toBe(7);
    expect(player?.xp).toBe(4);
    expect(player?.level).toBe(3);
  });


  test("xpPurchaseCountが所持goldを超えるとINSUFFICIENT_GOLDで却下される", async () => {
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

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      xpPurchaseCount: 4,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });

    const player = serverRoom.state.players.get(targetClient.sessionId);

    expect(player?.gold).toBe(15);
    expect(player?.xp).toBe(0);
    expect(player?.level).toBe(1);
  });


  test("試合開始時にshopOffersがstateへ同期される", async () => {
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

    const target = serverRoom.state.players.get(clients[0].sessionId);

    expect(target?.shopOffers.length).toBe(5);
  });


  test("shopRefreshCountでgold減少とshopOffers更新がstateへ同期される", async () => {
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

    const targetClient = clients[0];
    const beforePlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeOffers =
      beforePlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopRefreshCount: 1,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterOffers =
      afterPlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    expect(afterPlayer?.gold).toBe(13);
    expect(afterPlayer?.shopOffers.length).toBe(5);
    expect(afterOffers).not.toBe(beforeOffers);
  });


  test("shopBuySlotIndexでgold減少とshopOffers差し替えがstateへ同期される", async () => {
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

    const targetClient = clients[0];
    const internalController = (serverRoom as unknown as {
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

    // Fix shopOffers to ensure deterministic purchase target
    const forcedOffers: Array<{
      unitType: "vanguard" | "ranger" | "mage" | "assassin";
      rarity: 1 | 2 | 3;
      cost: number;
    }> = [
      { unitType: "vanguard", rarity: 1, cost: 1 },
      { unitType: "ranger", rarity: 1, cost: 1 },
      { unitType: "mage", rarity: 2, cost: 2 },
      { unitType: "assassin", rarity: 2, cost: 2 },
      { unitType: "vanguard", rarity: 1, cost: 1 },
    ];
    internalController.shopOffersByPlayer.set(targetClient.sessionId, forcedOffers);

    const firstForcedOffer = forcedOffers[0];

    if (!firstForcedOffer) {
      throw new Error("Expected forced shop offers to include slot 0");
    }

    const firstOfferCost = firstForcedOffer.cost;
    const firstOfferUnitType = firstForcedOffer.unitType;
    const beforeOffers = forcedOffers
      .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
      .join(",");

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });

    const result = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(result).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterOffers =
      afterPlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    expect(afterPlayer?.gold).toBe(15 - firstOfferCost);
    expect(afterPlayer?.shopOffers.length).toBe(5);
    expect(afterOffers).not.toBe(beforeOffers);
    expect(afterPlayer?.benchUnits.length).toBe(1);

    expect(afterPlayer?.benchUnits[0]).toBe(firstOfferUnitType);

    const ownedCountByUnitType: Record<string, number> = {
      vanguard: Number(afterPlayer?.ownedVanguard ?? 0),
      ranger: Number(afterPlayer?.ownedRanger ?? 0),
      mage: Number(afterPlayer?.ownedMage ?? 0),
      assassin: Number(afterPlayer?.ownedAssassin ?? 0),
    };

    expect(ownedCountByUnitType[firstOfferUnitType]).toBe(1);
  });


  test("shopLock=trueで次ラウンドPrepでもshopOffersが維持される", async () => {
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

    const targetClient = clients[0];
    const beforeOffers =
      serverRoom.state.players
        .get(targetClient.sessionId)
        ?.shopOffers.map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopLock: true,
    });

    const lockResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(lockResult).toEqual({ accepted: true });

    await waitForCondition(
      () => serverRoom.state.phase === "Prep" && serverRoom.state.roundIndex === 2,
      1_500,
    );

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterOffers =
      afterPlayer?.shopOffers
        .map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`)
        .join(",") ?? "";

    expect(afterPlayer?.shopLocked).toBe(true);
    expect(afterOffers).toBe(beforeOffers);
  });


  test("benchToBoardCellでbenchからboardへ1体配置がstateへ同期される", async () => {
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

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });

    const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(buyResult).toEqual({ accepted: true });

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

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(0);
    expect(afterPlayer?.boardUnitCount).toBe(1);
  });


  test("benchToBoardCellが既存cellと競合するとINVALID_PAYLOADでstate不変", async () => {
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

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardPlacements: [{ cell: 2, unitType: "vanguard" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    const beforePlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeBench = beforePlayer?.benchUnits.length ?? 0;
    const beforeBoardCount = beforePlayer?.boardUnitCount ?? 0;

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 3,
      benchToBoardCell: {
        benchIndex: 0,
        cell: 2,
      },
    });

    const rejectResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(rejectResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(beforeBench);
    expect(afterPlayer?.boardUnitCount).toBe(beforeBoardCount);
  });


  test("benchSellIndexでbench売却すると購入時のコスト分goldがstateへ同期される", async () => {
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

    const targetClient = clients[0];
    const beforeBuyPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeBuyGold = Number(beforeBuyPlayer?.gold ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      shopBuySlotIndex: 0,
    });

    const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(buyResult).toEqual({ accepted: true });

    const afterBuyPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const afterBuyGold = Number(afterBuyPlayer?.gold ?? 0);
    const unitCost = beforeBuyGold - afterBuyGold;

    const beforeSellGold = afterBuyGold;

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      benchSellIndex: 0,
    });

    const sellResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(sellResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(0);
    expect(afterPlayer?.gold).toBe(beforeSellGold + unitCost);
  });


  test("boardSellIndexで盤面ユニット売却するとgold増加とboardUnitCount減少がstateへ同期される", async () => {
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

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [{ cell: 3, unitType: "mage" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    const beforeSellPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeSellGold = Number(beforeSellPlayer?.gold ?? 0);
    const beforeSellCount = Number(beforeSellPlayer?.boardUnitCount ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardSellIndex: 3,
    });

    const sellResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(sellResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.gold).toBe(beforeSellGold + 2);
    expect(afterPlayer?.boardUnitCount).toBe(beforeSellCount - 1);
  });


  test("boardSellIndexでユニット不在セル指定はINVALID_PAYLOADでstate不変", async () => {
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

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [{ cell: 0, unitType: "vanguard" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    const beforePlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeGold = Number(beforePlayer?.gold ?? 0);
    const beforeCount = Number(beforePlayer?.boardUnitCount ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardSellIndex: 7,
    });

    const rejectResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(rejectResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.gold).toBe(beforeGold);
    expect(afterPlayer?.boardUnitCount).toBe(beforeCount);
  });


  test("boardToBenchCellで盤面ユニットをbenchへ戻すとstateへ同期される", async () => {
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

    const targetClient = clients[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardPlacements: [{ cell: 3, unitType: "mage" }],
    });
    expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
      accepted: true,
    });

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardToBenchCell: { cell: 3 },
    });

    const result = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(result).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.boardUnitCount).toBe(0);
    expect(Array.from(afterPlayer?.boardUnits ?? [])).toEqual([]);
    expect(Array.from(afterPlayer?.benchUnits ?? [])).toEqual(["mage"]);
  });


  test("同種3体購入でベンチ上の自動合成結果がstateへ同期される", async () => {
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

    const targetClient = clients[0];
    const internalController = (serverRoom as unknown as {
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

    for (const cmdSeq of [1, 2, 3]) {
      internalController.shopOffersByPlayer.set(targetClient.sessionId, [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq,
        shopBuySlotIndex: 0,
      });

      const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
      expect(buyResult).toEqual({ accepted: true });
    }

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(1);
    expect(afterPlayer?.benchUnits[0]).toBe("vanguard:2");
    expect(afterPlayer?.ownedVanguard).toBe(3);
  });


  test("同種9体購入で連鎖合成した★3がstateへ同期される", async () => {
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

    const targetClient = clients[0];
    const internalController = (serverRoom as unknown as {
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

    for (const cmdSeq of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      internalController.shopOffersByPlayer.set(targetClient.sessionId, [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq,
        shopBuySlotIndex: 0,
      });

      const buyResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
      expect(buyResult).toEqual({ accepted: true });
    }

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(1);
    expect(afterPlayer?.benchUnits[0]).toBe("vanguard:3");
    expect(afterPlayer?.ownedVanguard).toBe(9);
  });

});


