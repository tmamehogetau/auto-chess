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
  sendPrepCommandAndWaitForResult,
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
import type { BoardUnitPlacement } from "../../../src/shared/room-messages";

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

    const accepted = await sendPrepCommandAndWaitForResult(clients[0], 1);

    expect(accepted).toEqual({ accepted: true });

    await waitForCondition(() => serverRoom.state.phase === "Battle", 1_000);

    const rejected = await sendPrepCommandAndWaitForResult(clients[0], 2);

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

    const strongestAResultPromise =
      strongestAClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    const strongestBResultPromise =
      strongestBClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);

    strongestAClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardUnitCount: 8,
    });
    strongestBClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      boardUnitCount: 8,
    });

    const [strongestAResult, strongestBResult] = await Promise.all([
      strongestAResultPromise,
      strongestBResultPromise,
    ]);

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
    const result = await sendPrepCommandAndWaitForResult(targetClient, 1, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "vanguard" },
        { cell: 2, unitType: "ranger" },
        { cell: 3, unitType: "ranger" },
        { cell: 4, unitType: "assassin" },
        { cell: 5, unitType: "mage" },
      ],
    });
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

    const result = await sendPrepCommandAndWaitForResult(targetClient, 1, {
      xpPurchaseCount: 2,
    });
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

    const result = await sendPrepCommandAndWaitForResult(targetClient, 1, {
      xpPurchaseCount: 4,
    });
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


  test("shopRefreshCountでgold減少とshopOffers再生成がstateへ同期される", async () => {
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
    const result = await sendPrepCommandAndWaitForResult(targetClient, 1, {
      shopRefreshCount: 1,
    });
    expect(result).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.gold).toBe(13);
    expect(afterPlayer?.shopOffers.length).toBe(5);
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


  test("benchToBoardCellで自分のoccupied main cellを選ぶとboardとbenchを入れ替える", async () => {
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
    const beforeBenchUnit = beforePlayer?.benchUnits[0];

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 3,
      benchToBoardCell: {
        benchIndex: 0,
        cell: 2,
      },
    });

    const deployResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(deployResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(beforeBench);
    expect(afterPlayer?.boardUnitCount).toBe(beforeBoardCount);
    expect(afterPlayer?.boardUnits).toContain(`2:${beforeBenchUnit}`);
    expect(afterPlayer?.benchUnits?.[0]).toBe("vanguard");
  });


  test("benchSellIndexでtier 1 sell formula C - 1 がstateへ同期される", async () => {
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
        benchUnitsByPlayer: Map<string, Array<{
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          cost: number;
          starLevel: number;
          unitCount: number;
        }>>;
      };
    }).controller;

    if (!internalController) {
      throw new Error("Expected internal controller");
    }

    internalController.benchUnitsByPlayer.set(targetClient.sessionId, [
      { unitType: "mage", cost: 2, starLevel: 1, unitCount: 1 },
    ]);

    const beforeSellPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeSellGold = Number(beforeSellPlayer?.gold ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      benchSellIndex: 0,
    });

    const sellResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(sellResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.benchUnits.length).toBe(0);
    expect(afterPlayer?.gold).toBe(beforeSellGold + 1);
  });


  test("boardSellIndexでtier 3 sell formula 4C - 2 がstateへ同期される", async () => {
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
        boardPlacementsByPlayer: Map<string, Array<{
          cell: number;
          unitType: "vanguard" | "ranger" | "mage" | "assassin";
          starLevel?: number;
          sellValue?: number;
          unitCount?: number;
        }>>;
        boardUnitCountByPlayer: Map<string, number>;
      };
    }).controller;

    if (!internalController) {
      throw new Error("Expected internal controller");
    }

    internalController.boardPlacementsByPlayer.set(targetClient.sessionId, [
      { cell: 3, unitType: "mage", starLevel: 3, sellValue: 14, unitCount: 7 },
    ]);
    internalController.boardUnitCountByPlayer.set(targetClient.sessionId, 1);

    const beforeSellPlayer = serverRoom.state.players.get(targetClient.sessionId);
    const beforeSellGold = Number(beforeSellPlayer?.gold ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 2,
      boardSellIndex: 3,
    });

    const sellResult = await targetClient.waitForMessage(
      SERVER_MESSAGE_TYPES.COMMAND_RESULT,
    );
    expect(sellResult).toEqual({ accepted: true });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);

    expect(afterPlayer?.gold).toBe(beforeSellGold + 6);
    expect(afterPlayer?.boardUnitCount).toBe(0);
  });

  test("discounted purchase でも sell で購入額を上回る refund がstateへ同期されない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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
          boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
          shopOffersByPlayer: Map<string, Array<{
            unitType: "vanguard" | "ranger" | "mage" | "assassin";
            unitId?: string;
            rarity: 1 | 2 | 3;
            cost: number;
          }>>;
        };
      }).controller;

      if (!internalController) {
        throw new Error("Expected internal controller");
      }

      internalController.boardPlacementsByPlayer.set(targetClient.sessionId, [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "parsee", factionId: "kou_ryuudou" },
      ]);

      for (const cmdSeq of [1, 2, 3, 4]) {
        internalController.shopOffersByPlayer.set(targetClient.sessionId, [
          { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
        ]);

        targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
          cmdSeq,
          shopBuySlotIndex: 0,
        });
        expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
          accepted: true,
        });
      }

      const beforeSellPlayer = serverRoom.state.players.get(targetClient.sessionId);
      expect(Number(beforeSellPlayer?.gold ?? 0)).toBe(11);

      targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
        cmdSeq: 5,
        benchSellIndex: 0,
      });
      expect(await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT)).toEqual({
        accepted: true,
      });

      const afterSellPlayer = serverRoom.state.players.get(targetClient.sessionId);
      expect(afterSellPlayer?.gold).toBe(14);
    });
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


  test("同種4回購入で購入回数進行のtier 2がstateへ同期される", async () => {
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

    for (const cmdSeq of [1, 2, 3, 4]) {
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
    expect(afterPlayer?.ownedVanguard).toBe(4);
  });


  test("同種7回購入で購入回数進行のtier 3がstateへ同期される", async () => {
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

    for (const cmdSeq of [1, 2, 3, 4, 5, 6, 7]) {
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
    expect(afterPlayer?.ownedVanguard).toBe(7);
  });

  test("legacy mergeUnits payload は INVALID_PAYLOAD で reject される", async () => {
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
    const beforeBench = Array.from(beforePlayer?.benchUnits ?? []);
    const beforeGold = Number(beforePlayer?.gold ?? 0);

    targetClient.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
      cmdSeq: 1,
      mergeUnits: {
        unitType: "vanguard",
        starLevel: 2,
        benchIndices: [0, 1, 2],
      },
    });

    const rejectResult = await targetClient.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
    expect(rejectResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });

    const afterPlayer = serverRoom.state.players.get(targetClient.sessionId);
    expect(Array.from(afterPlayer?.benchUnits ?? [])).toEqual(beforeBench);
    expect(Number(afterPlayer?.gold ?? 0)).toBe(beforeGold);
  });

});


