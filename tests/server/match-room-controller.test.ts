import { describe, expect, test } from "vitest";

import { MatchRoomController } from "../../src/server/match-room-controller";

const controllerOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 30_000,
  battleDurationMs: 10_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
};

describe("MatchRoomController", () => {
  test("4人全員Readyなら締切前でも試合開始できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);

    const started = controller.startIfReady(2_000);

    expect(started).toBe(true);
    expect(controller.phase).toBe("Prep");
    expect(controller.prepDeadlineAtMs).toBe(32_000);
  });

  test("Ready締切を過ぎたら未Readyがいても試合開始できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);

    const started = controller.startIfReady(61_000);

    expect(started).toBe(true);
    expect(controller.phase).toBe("Prep");
  });

  test("Prep締切前のコマンドは受理される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 31_999);

    expect(result).toEqual({ accepted: true });
  });

  test("試合開始時の経済ステータス初期値を返す", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    expect(controller.getPlayerStatus("p1")).toMatchObject({
      gold: 15,
      xp: 0,
      level: 1,
      benchUnits: [],
      ownedUnits: {
        vanguard: 0,
        ranger: 0,
        mage: 0,
        assassin: 0,
      },
    });
  });

  test("Prep締切以降のコマンドはLATE_INPUTで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 32_000);

    expect(result).toEqual({ accepted: false, code: "LATE_INPUT" });
  });

  test("Battle中のコマンドはPHASE_MISMATCHで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.transitionTo("Battle");

    const result = controller.submitPrepCommand("p1", 1, 3_000);

    expect(result).toEqual({ accepted: false, code: "PHASE_MISMATCH" });
  });

  test("Prep締切に達したらBattleへ自動遷移できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const progressed = controller.advanceByTime(32_000);

    expect(progressed).toBe(true);
    expect(controller.phase).toBe("Battle");
    expect(controller.roundPairings).toEqual([
      { leftPlayerId: "p1", rightPlayerId: "p4", ghostSourcePlayerId: null },
      { leftPlayerId: "p2", rightPlayerId: "p3", ghostSourcePlayerId: null },
    ]);
  });

  test("ラウンドが進むと対戦ペアがローテーションする", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);
    controller.advanceByTime(79_000);

    expect(controller.phase).toBe("Battle");
    expect(controller.roundPairings).toEqual([
      { leftPlayerId: "p1", rightPlayerId: "p3", ghostSourcePlayerId: null },
      { leftPlayerId: "p4", rightPlayerId: "p2", ghostSourcePlayerId: null },
    ]);
  });

  test("生存者が奇数のときはゴースト対戦ペアが作られる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.setPlayerHp("p4", 0);

    controller.advanceByTime(32_000);

    expect(controller.roundPairings).toEqual([
      { leftPlayerId: "p1", rightPlayerId: "p2", ghostSourcePlayerId: null },
      { leftPlayerId: "p3", rightPlayerId: null, ghostSourcePlayerId: "p1" },
    ]);
  });

  test("時間経過でBattle->Settle->Elimination->Prepへ進む", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(2);
    expect(controller.getPlayerStatus("p1").gold).toBe(20);
  });

  test("xpPurchaseCountでゴールド消費とXP/レベル上昇が適用される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      xpPurchaseCount: 2,
    });

    expect(result).toEqual({ accepted: true });
    expect(controller.getPlayerStatus("p1")).toMatchObject({
      gold: 7,
      xp: 4,
      level: 3,
    });
  });

  test("ゴールド不足のxpPurchaseCountはINSUFFICIENT_GOLDで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      xpPurchaseCount: 4,
    });

    expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });
    expect(controller.getPlayerStatus("p1")).toMatchObject({
      gold: 15,
      xp: 0,
      level: 1,
    });
  });

  test("試合開始時にshopOffersが5枠生成される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const offers = controller.getPlayerStatus("p1").shopOffers;

    expect(offers).toHaveLength(5);
    for (const offer of offers) {
      expect(offer.cost).toBeGreaterThanOrEqual(1);
      expect(offer.cost).toBeLessThanOrEqual(3);
      expect(["vanguard", "ranger", "mage", "assassin"]).toContain(offer.unitType);
    }
  });

  test("shopRefreshCountでgold減少とshopOffers更新が適用される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const beforeOffers = controller
      .getPlayerStatus("p1")
      .shopOffers.map((offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`);
    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      shopRefreshCount: 1,
    });
    const afterStatus = controller.getPlayerStatus("p1");
    const afterOffers = afterStatus.shopOffers.map(
      (offer) => `${offer.unitType}:${offer.rarity}:${offer.cost}`,
    );

    expect(result).toEqual({ accepted: true });
    expect(afterStatus.gold).toBe(13);
    expect(afterOffers).not.toEqual(beforeOffers);
  });

  test("xpPurchaseCountとshopRefreshCountの合計コスト不足はINSUFFICIENT_GOLDで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      xpPurchaseCount: 2,
      shopRefreshCount: 5,
    });

    expect(result).toEqual({ accepted: false, code: "INSUFFICIENT_GOLD" });
    expect(controller.getPlayerStatus("p1").gold).toBe(15);
  });

  test("shopBuySlotIndexでベンチと所持ユニットが増える", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const beforeStatus = controller.getPlayerStatus("p1");
    const firstUnitType = beforeStatus.shopOffers[0]?.unitType;
    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });
    const afterStatus = controller.getPlayerStatus("p1");

    expect(result).toEqual({ accepted: true });
    expect(afterStatus.benchUnits.length).toBe(1);
    expect(firstUnitType).toBeDefined();
    expect(afterStatus.benchUnits[0]).toBe(firstUnitType);

    if (!firstUnitType) {
      throw new Error("expected first shop unit type");
    }

    expect(afterStatus.ownedUnits[firstUnitType]).toBe(1);
  });

  test("ベンチ満杯でshopBuySlotIndexはBENCH_FULLで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internalBenchMap = (controller as unknown as {
      benchUnitsByPlayer: Map<string, ("vanguard" | "ranger" | "mage" | "assassin")[]>;
    }).benchUnitsByPlayer;
    internalBenchMap.set("p1", [
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
      "vanguard",
    ]);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });

    expect(result).toEqual({ accepted: false, code: "BENCH_FULL" });
  });

  test("benchToBoardCellでベンチユニットを盤面に配置できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const buyResult = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });
    const deployResult = controller.submitPrepCommand("p1", 2, 3_100, {
      benchToBoardCell: {
        benchIndex: 0,
        cell: 3,
      },
    });
    const status = controller.getPlayerStatus("p1");

    expect(buyResult).toEqual({ accepted: true });
    expect(deployResult).toEqual({ accepted: true });
    expect(status.benchUnits.length).toBe(0);
    expect(status.boardUnitCount).toBe(1);
  });

  test("benchSellIndexでベンチ売却すると購入時のコスト分goldが増える", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const beforeBuyGold = controller.getPlayerStatus("p1").gold;
    const buyResult = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });
    const afterBuyGold = controller.getPlayerStatus("p1").gold;
    const unitCost = beforeBuyGold - afterBuyGold;
    const beforeSellOwned = controller.getPlayerStatus("p1").ownedUnits;
    const soldUnitType = controller.getPlayerStatus("p1").benchUnits[0];
    const soldOwnedKey = (["vanguard", "ranger", "mage", "assassin"] as const).find(
      (unitType) => unitType === soldUnitType,
    );

    if (!soldUnitType || !soldOwnedKey) {
      throw new Error("expected bench unit to sell");
    }

    const beforeSellGold = controller.getPlayerStatus("p1").gold;
    const sellResult = controller.submitPrepCommand("p1", 2, 3_100, {
      benchSellIndex: 0,
    });
    const status = controller.getPlayerStatus("p1");

    expect(buyResult).toEqual({ accepted: true });
    expect(sellResult).toEqual({ accepted: true });
    expect(status.gold).toBe(beforeSellGold + unitCost);
    expect(status.benchUnits.length).toBe(0);
    expect(status.ownedUnits[soldOwnedKey]).toBe(beforeSellOwned[soldOwnedKey] - 1);
  });

  test("同種3体購入でベンチ上で自動合成されて★2になる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internalOffersMap = (controller as unknown as {
      shopOffersByPlayer: Map<
        string,
        Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; rarity: 1 | 2 | 3; cost: number }>
      >;
    }).shopOffersByPlayer;

    for (const cmdSeq of [1, 2, 3]) {
      internalOffersMap.set("p1", [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      const result = controller.submitPrepCommand("p1", cmdSeq, 3_000 + cmdSeq, {
        shopBuySlotIndex: 0,
      });

      expect(result).toEqual({ accepted: true });
    }

    const status = controller.getPlayerStatus("p1");

    expect(status.benchUnits).toEqual(["vanguard★2"]);
    expect(status.ownedUnits.vanguard).toBe(3);
  });

  test("同種9体購入でベンチ上で連鎖合成されて★3になる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const internalOffersMap = (controller as unknown as {
      shopOffersByPlayer: Map<
        string,
        Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; rarity: 1 | 2 | 3; cost: number }>
      >;
    }).shopOffersByPlayer;

    for (const cmdSeq of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      internalOffersMap.set("p1", [
        { unitType: "vanguard", rarity: 1, cost: 1 },
        { unitType: "ranger", rarity: 1, cost: 1 },
        { unitType: "mage", rarity: 2, cost: 2 },
        { unitType: "assassin", rarity: 2, cost: 2 },
        { unitType: "vanguard", rarity: 1, cost: 1 },
      ]);

      const result = controller.submitPrepCommand("p1", cmdSeq, 3_000 + cmdSeq, {
        shopBuySlotIndex: 0,
      });

      expect(result).toEqual({ accepted: true });
    }

    const status = controller.getPlayerStatus("p1");

    expect(status.benchUnits).toEqual(["vanguard★3"]);
    expect(status.ownedUnits.vanguard).toBe(9);
  });

  test("benchToBoardCellとbenchSellIndexを同時指定するとINVALID_PAYLOAD", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });

    const result = controller.submitPrepCommand("p1", 2, 3_100, {
      benchToBoardCell: {
        benchIndex: 0,
        cell: 1,
      },
      benchSellIndex: 0,
    });

    expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
  });

  test("boardUnitCountが8のときbenchToBoardCellはINVALID_PAYLOAD", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const buyResult = controller.submitPrepCommand("p1", 1, 3_000, {
      shopBuySlotIndex: 0,
    });
    const setBoardFullResult = controller.submitPrepCommand("p1", 2, 3_100, {
      boardUnitCount: 8,
    });
    const deployResult = controller.submitPrepCommand("p1", 3, 3_200, {
      benchToBoardCell: {
        benchIndex: 0,
        cell: 7,
      },
    });

    expect(buyResult).toEqual({ accepted: true });
    expect(setBoardFullResult).toEqual({ accepted: true });
    expect(deployResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
  });

  test("boardSellIndexで盤面ユニット売却するとunitTypeに応じてgoldが増える", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const setBoardResult = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [{ cell: 2, unitType: "mage" }],
    });
    const beforeSell = controller.getPlayerStatus("p1");
    const sellResult = controller.submitPrepCommand("p1", 2, 3_100, {
      boardSellIndex: 2,
    });
    const afterSell = controller.getPlayerStatus("p1");

    expect(setBoardResult).toEqual({ accepted: true });
    expect(sellResult).toEqual({ accepted: true });
    expect(beforeSell.boardUnitCount).toBe(1);
    expect(afterSell.boardUnitCount).toBe(0);
    expect(afterSell.gold).toBe(beforeSell.gold + 2);
  });

  test("boardSellIndexでユニット不在セル指定はINVALID_PAYLOAD", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const setBoardResult = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [{ cell: 1, unitType: "vanguard" }],
    });
    const beforeStatus = controller.getPlayerStatus("p1");
    const sellResult = controller.submitPrepCommand("p1", 2, 3_100, {
      boardSellIndex: 7,
    });
    const afterStatus = controller.getPlayerStatus("p1");

    expect(setBoardResult).toEqual({ accepted: true });
    expect(sellResult).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
    expect(afterStatus.boardUnitCount).toBe(beforeStatus.boardUnitCount);
    expect(afterStatus.gold).toBe(beforeStatus.gold);
  });

  test("Eliminationで生存者1人ならEndへ遷移する", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);
    controller.setPlayerHp("p2", 0);
    controller.setPlayerHp("p3", 0);
    controller.setPlayerHp("p4", -10);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    expect(controller.phase).toBe("End");
  });

  test("Battle終了時にpendingダメージがHPへ反映される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.setPendingRoundDamage({
      p1: 12,
      p2: 5,
    });

    controller.advanceByTime(42_000);

    expect(controller.phase).toBe("Settle");
    expect(controller.getPlayerHp("p1")).toBe(88);
    expect(controller.getPlayerHp("p2")).toBe(95);
    expect(controller.getPlayerHp("p3")).toBe(100);
  });

  test("pendingダメージ未設定でもBattle終了時に自動ダメージが反映される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.advanceByTime(42_000);

    expect(controller.phase).toBe("Settle");
    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p2")).toBe(100);
    expect(controller.getPlayerHp("p3")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("同時脱落時はpostBattleHp->roundStartHp->playerIdで順位が決まる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.advanceByTime(32_000);

    controller.setPlayerHp("p2", 10);
    controller.setPlayerHp("p3", 8);
    controller.setPlayerHp("p4", 8);
    controller.setPendingRoundDamage({
      p2: 15,
      p3: 12,
      p4: 10,
    });

    controller.advanceByTime(42_000);
    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    expect(controller.phase).toBe("End");
    expect(controller.rankingTopToBottom).toEqual(["p1", "p4", "p3", "p2"]);
  });

  test("prep_commandでboardUnitCountを更新できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand(
      "p4",
      1,
      3_000,
      { boardUnitCount: 8 },
    );

    expect(result).toEqual({ accepted: true });
    expect(controller.getPlayerStatus("p4").boardUnitCount).toBe(8);

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("同系統ユニットのシナジーで低基礎パワー側が逆転できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "assassin" },
        { cell: 4, unitType: "ranger" },
        { cell: 5, unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "ranger" },
        { cell: 4, unitType: "vanguard" },
        { cell: 5, unitType: "ranger" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(91);
  });

  test("後列assassin2体の奇襲で不利マッチアップを逆転できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: 4, unitType: "assassin" },
        { cell: 5, unitType: "assassin" },
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: 4, unitType: "mage" },
        { cell: 5, unitType: "ranger" },
        { cell: 6, unitType: "ranger" },
        { cell: 0, unitType: "vanguard" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p4")).toBe(91);
  });

  test("後列ranger2体の援護射撃で不利マッチアップを逆転できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: 4, unitType: "ranger" },
        { cell: 5, unitType: "ranger" },
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "assassin" },
        { cell: 5, unitType: "ranger" },
        { cell: 6, unitType: "ranger" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(93);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("set2ではrangerスキル条件が緩くなりset1と勝敗が変わる", () => {
    const set1Controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      {
        ...controllerOptions,
        setId: "set1",
      },
    );
    const set2Controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      {
        ...controllerOptions,
        setId: "set2",
      },
    );

    for (const controller of [set1Controller, set2Controller]) {
      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [
          { cell: 4, unitType: "ranger" },
          { cell: 5, unitType: "ranger" },
          { cell: 0, unitType: "vanguard" },
          { cell: 1, unitType: "assassin" },
        ],
      });
      controller.submitPrepCommand("p4", 1, 3_000, {
        boardPlacements: [
          { cell: 0, unitType: "vanguard" },
          { cell: 2, unitType: "ranger" },
          { cell: 5, unitType: "mage" },
          { cell: 4, unitType: "assassin" },
        ],
      });

      controller.advanceByTime(32_000);
      controller.advanceByTime(42_000);
    }

    expect(set1Controller.getPlayerHp("p1")).toBe(100);
    expect(set1Controller.getPlayerHp("p4")).toBe(91);
    expect(set2Controller.getPlayerHp("p1")).toBe(100);
    expect(set2Controller.getPlayerHp("p4")).toBe(91);
  });

  test("前列vanguard2体の防衛陣形で不利マッチアップを逆転できる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const p1Result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 1, unitType: "vanguard" },
        { cell: 2, unitType: "assassin" },
        { cell: 3, unitType: "mage" },
      ],
    });
    const p4Result = controller.submitPrepCommand("p4", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 4, unitType: "ranger" },
        { cell: 5, unitType: "mage" },
        { cell: 6, unitType: "assassin" },
      ],
    });

    expect(p1Result).toEqual({ accepted: true });
    expect(p4Result).toEqual({ accepted: true });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p1")).toBe(89);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("boardPlacementsで不正セル重複はINVALID_PAYLOADで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand("p1", 1, 3_000, {
      boardPlacements: [
        { cell: 0, unitType: "vanguard" },
        { cell: 0, unitType: "mage" },
      ],
    });

    expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
  });

  test("ゴースト対戦で敗北側にダメージが適用される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);
    controller.setPlayerHp("p4", 0);

    controller.submitPrepCommand("p1", 1, 3_000, {
      boardUnitCount: 8,
    });
    controller.submitPrepCommand("p3", 1, 3_000, {
      boardUnitCount: 1,
    });

    controller.advanceByTime(32_000);
    controller.advanceByTime(42_000);

    expect(controller.getPlayerHp("p3")).toBe(100);
    expect(controller.getPlayerHp("p1")).toBe(100);
    expect(controller.getPlayerHp("p2")).toBe(100);
  });

  test("boardUnitCountが範囲外ならINVALID_PAYLOADで却下される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    const result = controller.submitPrepCommand(
      "p1",
      1,
      3_000,
      { boardUnitCount: 99 },
    );

    expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
  });
});
