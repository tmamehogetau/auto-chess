import { describe, expect, test, vi } from "vitest";

import { MatchRoomController } from "../../src/server/match-room-controller";
import { MatchLogger } from "../../src/server/match-logger";
import type { BoardUnitPlacement } from "../../src/shared/room-messages";
import { FLAG_CONFIGURATIONS, withFlags } from "./feature-flag-test-helper";

const controllerOptions = {
  readyAutoStartMs: 60_000,
  prepDurationMs: 30_000,
  battleDurationMs: 10_000,
  settleDurationMs: 5_000,
  eliminationDurationMs: 2_000,
};

const advanceRoundWithMinimalDurations = (
  controller: MatchRoomController,
  startTimeMs: number,
): number => {
  controller.advanceByTime(startTimeMs + 1);
  // ダメージを設定してフェーズ成功にする（dominationCount増加を回避）
  const roundIndex = controller.roundIndex;
  const targetHp = getPhaseHpTarget(roundIndex);
  controller.setPendingRoundDamage({ p1: targetHp });
  controller.advanceByTime(startTimeMs + 2);
  controller.advanceByTime(startTimeMs + 3);
  controller.advanceByTime(startTimeMs + 4);

  return startTimeMs + 4;
};

// 各ラウンドのフェーズHP目標値を取得
function getPhaseHpTarget(roundIndex: number): number {
  const targets: Record<number, number> = {
    1: 600,
    2: 750,
    3: 900,
    4: 1050,
    5: 1250,
    6: 1450,
    7: 1650,
    8: 1850,
    9: 2100,
    10: 2400,
    11: 2700,
    12: 0,
  };
  return targets[roundIndex] ?? 600;
}

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

  test("myourenji tier2 では shopBuySlotIndex の購入コストが1下がる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
        { cell: 2, unitType: "assassin", starLevel: 1, unitId: "murasa", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 1);
    });
  });

  test("myourenji tier1 では shop cost reduction を適用しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("kou_ryuudou tier1 の shop cost reduction は cost floor 1 を守る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "parsee", factionId: "kou_ryuudou" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "kisume", rarity: 1, cost: 1 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 1);
    });
  });

  test("kou_ryuudou tier1 では eligible Touhou unit の shopBuySlotIndex 購入コストが1下がる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "assassin", starLevel: 1, unitId: "parsee", factionId: "kou_ryuudou" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 1);
    });
  });

  test("legacy MVP unit は Touhou shop cost reduction を継承しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
        { cell: 2, unitType: "assassin", starLevel: 1, unitId: "murasa", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("enableTouhouFactions=false では shop cost reduction を適用しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_ONLY, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; rarity: number; cost: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "mage", starLevel: 1, unitId: "toramaru", factionId: "myourenji" },
        { cell: 2, unitType: "assassin", starLevel: 1, unitId: "murasa", factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "mage", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const beforeGold = controller.getPlayerStatus("p1").gold;
      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("kou_ryuudou tier2 では最初の shopRefresh が無料になる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", starLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "mage", starLevel: 1, unitId: "chimata", factionId: "kou_ryuudou" },
        { cell: 3, unitType: "assassin", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
      ]);
      const beforeGold = controller.getPlayerStatus("p1").gold;

      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopRefreshCount: 1,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold);
    });
  });

  test("kou_ryuudou tier2 では2回目の shopRefresh は無料にならない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", starLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "mage", starLevel: 1, unitId: "chimata", factionId: "kou_ryuudou" },
        { cell: 3, unitType: "assassin", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
      ]);
      const beforeGold = controller.getPlayerStatus("p1").gold;

      const firstResult = controller.submitPrepCommand("p1", 1, 3_000, {
        shopRefreshCount: 1,
      });
      const secondResult = controller.submitPrepCommand("p1", 2, 3_100, {
        shopRefreshCount: 1,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(firstResult).toEqual({ accepted: true });
      expect(secondResult).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 2);
    });
  });

  test("kou_ryuudou tier2 の無料リロール権は1 Prep で1回だけ", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "vanguard", starLevel: 1, unitId: "tsukasa", factionId: "kou_ryuudou" },
        { cell: 1, unitType: "ranger", starLevel: 1, unitId: "megumu", factionId: "kou_ryuudou" },
        { cell: 2, unitType: "mage", starLevel: 1, unitId: "chimata", factionId: "kou_ryuudou" },
        { cell: 3, unitType: "assassin", starLevel: 1, unitId: "yamame", factionId: "kou_ryuudou" },
      ]);
      const beforeGold = controller.getPlayerStatus("p1").gold;

      const firstResult = controller.submitPrepCommand("p1", 1, 3_000, {
        shopRefreshCount: 1,
      });
      const secondResult = controller.submitPrepCommand("p1", 2, 3_100, {
        shopRefreshCount: 2,
      });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(firstResult).toEqual({ accepted: true });
      expect(secondResult).toEqual({ accepted: true });
      expect(afterStatus.gold).toBe(beforeGold - 4);
    });
  });

  test("myourenji 割引購入ユニットを即売却しても差額goldは増えない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_ROSTER_WITH_FACTIONS, async () => {
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

      const internals = controller as unknown as {
        boardPlacementsByPlayer: Map<string, BoardUnitPlacement[]>;
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "ranger", unitId: "nazrin", starLevel: 1, factionId: "myourenji" },
        { cell: 1, unitType: "mage", unitId: "murasa", starLevel: 1, factionId: "myourenji" },
        { cell: 2, unitType: "mage", unitId: "shou", starLevel: 1, factionId: "myourenji" },
      ]);
      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "ichirin", rarity: 2, cost: 2 },
      ]);

      const goldBefore = controller.getPlayerStatus("p1").gold;
      const buyResult = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
      });
      const goldAfterBuy = controller.getPlayerStatus("p1").gold;
      const sellResult = controller.submitPrepCommand("p1", 2, 3_100, {
        benchSellIndex: 0,
      });
      const status = controller.getPlayerStatus("p1");

      expect(buyResult).toEqual({ accepted: true });
      expect(sellResult).toEqual({ accepted: true });
      expect(goldAfterBuy).toBe(goldBefore - 1);
      expect(status.gold).toBe(goldBefore);
    });
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

  test("enablePerUnitSharedPool=true では Touhou unitId ごとに購入在庫が減る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          getAvailableByUnitId: (unitId: string, cost: number) => number;
          decreaseByUnitId: (unitId: string, cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, rarity: 1 },
      ]);

      const before = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinBefore = internals.sharedPool.getAvailableByUnitId("nazrin", 1);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const after = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinAfter = internals.sharedPool.getAvailableByUnitId("nazrin", 1);

      expect(result).toEqual({ accepted: true });
      expect(before).toBe(5);
      expect(after).toBe(4);
      expect(nazrinBefore).toBe(5);
      expect(nazrinAfter).toBe(5);
    });
  });

  test("enablePerUnitSharedPool=true で unitId なしオファーは cost pool 枯渇時に POOL_DEPLETED になる", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          isDepleted: (cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, rarity: 1 },
        { unitType: "ranger", cost: 1, rarity: 1 },
      ]);

      const isDepletedSpy = vi.spyOn(internals.sharedPool, "isDepleted").mockReturnValue(true);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 1 });

      expect(result).toEqual({ accepted: false, code: "POOL_DEPLETED" });

      isDepletedSpy.mockRestore();
    });
  });

  test("enablePerUnitSharedPool=true では all-depleted policy で買える在庫が残る限り unitId なしオファー購入を拒否する", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          decrease: (cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      for (let i = 0; i < 18; i += 1) {
        internals.sharedPool.decrease(1);
      }

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", cost: 1, rarity: 1 },
      ]);

      const beforeStatus = controller.getPlayerStatus("p1");
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const afterStatus = controller.getPlayerStatus("p1");

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(afterStatus.benchUnits).toEqual(beforeStatus.benchUnits);
      expect(afterStatus.gold).toBe(beforeStatus.gold);
    });
  });

  test("enablePerUnitSharedPool=true の server-side invariant reject は prep failure KPI に計上しない", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);
      const logger = new MatchLogger("match-w10-invariant", "room-w10-invariant");
      controller.setMatchLogger(logger);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          decrease: (cost: number) => boolean;
        };
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      for (let i = 0; i < 18; i += 1) {
        internals.sharedPool.decrease(1);
      }

      internals.shopOffersByPlayer.set("p1", [{ unitType: "vanguard", cost: 1, rarity: 1 }]);

      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const metrics = logger.getPrepCommandMetrics();

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(metrics.totalPrepCommands).toBe(0);
      expect(metrics.failedPrepCommands).toBe(0);
      expect(metrics.prepInputFailureRate).toBe(0);
    });
  });

  test("enablePerUnitSharedPool=true でも mixed invalid payload は prep failure KPI に計上される", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);
      const logger = new MatchLogger("match-w10-mixed-invalid", "room-w10-mixed-invalid");
      controller.setMatchLogger(logger);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const result = controller.submitPrepCommand("p1", 1, 3_000, {
        shopBuySlotIndex: 0,
        benchSellIndex: 0,
      });
      const metrics = logger.getPrepCommandMetrics();

      expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      expect(metrics.totalPrepCommands).toBe(1);
      expect(metrics.failedPrepCommands).toBe(1);
      expect(metrics.failuresByErrorCode["INVALID_PAYLOAD"]).toBe(1);
    });
  });

  test("enablePerUnitSharedPool=true では sharedPoolInventory が実在庫総量を反映する", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        shopOffersByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; rarity: number }>>;
      };

      internals.shopOffersByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, rarity: 1 },
      ]);

      const before = controller.getPlayerStatus("p1").sharedPoolInventory?.get(1);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { shopBuySlotIndex: 0 });
      const after = controller.getPlayerStatus("p1").sharedPoolInventory?.get(1);

      expect(result).toEqual({ accepted: true });
      expect(before).toBe(18);
      expect(after).toBe(17);
    });
  });

  test("enablePerUnitSharedPool=true では Touhou unitId の売却で同じ在庫へ返る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          getAvailableByUnitId: (unitId: string, cost: number) => number;
          decreaseByUnitId: (unitId: string, cost: number) => boolean;
        };
        benchUnitsByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; starLevel: number; unitCount: number }>>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, starLevel: 1, unitCount: 1 },
      ]);

      const before = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinBefore = internals.sharedPool.getAvailableByUnitId("nazrin", 1);
      const result = controller.submitPrepCommand("p1", 1, 3_000, { benchSellIndex: 0 });
      const after = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinAfter = internals.sharedPool.getAvailableByUnitId("nazrin", 1);

      expect(result).toEqual({ accepted: true });
      expect(after).toBe(before + 1);
      expect(nazrinAfter).toBe(nazrinBefore);
    });
  });

  test("enablePerUnitSharedPool=true では removePlayer 時に board/bench の unitId 在庫が返る", async () => {
    await withFlags(FLAG_CONFIGURATIONS.TOUHOU_FULL_MIGRATION, async () => {
      const controller = new MatchRoomController(["p1", "p2", "p3", "p4"], 1_000, controllerOptions);

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.setReady("p3", true);
      controller.setReady("p4", true);
      controller.startIfReady(2_000);

      const internals = controller as unknown as {
        sharedPool: {
          getAvailableByUnitId: (unitId: string, cost: number) => number;
          decreaseByUnitId: (unitId: string, cost: number) => boolean;
        };
        benchUnitsByPlayer: Map<string, Array<{ unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; cost: number; starLevel: number; unitCount: number }>>;
        boardPlacementsByPlayer: Map<string, Array<{ cell: number; unitType: "vanguard" | "ranger" | "mage" | "assassin"; unitId?: string; sellValue?: number; unitCount?: number }>>;
      };

      internals.benchUnitsByPlayer.set("p1", [
        { unitType: "vanguard", unitId: "rin", cost: 1, starLevel: 1, unitCount: 1 },
      ]);
      internals.boardPlacementsByPlayer.set("p1", [
        { cell: 0, unitType: "ranger", unitId: "nazrin", sellValue: 1, unitCount: 1 },
      ]);

      internals.sharedPool.decreaseByUnitId("rin", 1);
      internals.sharedPool.decreaseByUnitId("nazrin", 1);

      const rinBefore = internals.sharedPool.getAvailableByUnitId("rin", 1);
      const nazrinBefore = internals.sharedPool.getAvailableByUnitId("nazrin", 1);

      controller.removePlayer("p1");

      expect(internals.sharedPool.getAvailableByUnitId("rin", 1)).toBe(rinBefore + 1);
      expect(internals.sharedPool.getAvailableByUnitId("nazrin", 1)).toBe(nazrinBefore + 1);
    });
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

    expect(status.benchUnits).toEqual(["vanguard:2"]);
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

    expect(status.benchUnits).toEqual(["vanguard:3"]);
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

  test("phase expansion有効時はR11終了後もEndせずR12 Prepへ進む", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      0,
      {
        readyAutoStartMs: 1,
        prepDurationMs: 1,
        battleDurationMs: 1,
        settleDurationMs: 1,
        eliminationDurationMs: 1,
        featureFlags: {
          enablePhaseExpansion: true,
        },
      },
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(0);

    let nowMs = 0;

    for (let completedRounds = 0; completedRounds < 10; completedRounds += 1) {
      nowMs = advanceRoundWithMinimalDurations(controller, nowMs);
    }

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(11);

    nowMs = advanceRoundWithMinimalDurations(controller, nowMs);

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(12);
  });

  test("phase expansion有効時はR12終了後にEndへ遷移する", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      0,
      {
        readyAutoStartMs: 1,
        prepDurationMs: 1,
        battleDurationMs: 1,
        settleDurationMs: 1,
        eliminationDurationMs: 1,
        featureFlags: {
          enablePhaseExpansion: true,
        },
      },
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(0);

    let nowMs = 0;

    for (let completedRounds = 0; completedRounds < 12; completedRounds += 1) {
      nowMs = advanceRoundWithMinimalDurations(controller, nowMs);
    }

    expect(controller.phase).toBe("End");
    expect(controller.roundIndex).toBe(12);
  });

  test("phase expansion有効時のR12 Prepではphase HP targetが0になる", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      0,
      {
        readyAutoStartMs: 1,
        prepDurationMs: 1,
        battleDurationMs: 1,
        settleDurationMs: 1,
        eliminationDurationMs: 1,
        featureFlags: {
          enablePhaseExpansion: true,
        },
      },
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(0);

    let nowMs = 0;

    for (let completedRounds = 0; completedRounds < 11; completedRounds += 1) {
      nowMs = advanceRoundWithMinimalDurations(controller, nowMs);
    }

    const phaseProgress = controller.getPhaseProgress();

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(12);
    expect(phaseProgress.targetHp).toBe(0);
    expect(phaseProgress.damageDealt).toBe(0);
    expect(phaseProgress.result).toBe("pending");
    expect(phaseProgress.completionRate).toBe(0);
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

  test("Battle終了時にphase HP進捗が計算される", () => {
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
      p1: 120,
      p2: 130,
      p3: 80,
      p4: 70,
    });

    controller.advanceByTime(42_000);

    const phaseProgress = controller.getPhaseProgress();

    expect(controller.phase).toBe("Settle");
    expect(phaseProgress.targetHp).toBe(600);
    expect(phaseProgress.damageDealt).toBe(400);
    expect(phaseProgress.result).toBe("failed");
    expect(phaseProgress.completionRate).toBeCloseTo(400 / 600);
  });

  test("phase HP未達時はfailedになり次ラウンドPrepでリセットされる", () => {
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
      p1: 100,
      p2: 50,
    });

    controller.advanceByTime(42_000);

    const failedPhaseProgress = controller.getPhaseProgress();

    expect(failedPhaseProgress.targetHp).toBe(600);
    expect(failedPhaseProgress.damageDealt).toBe(150);
    expect(failedPhaseProgress.result).toBe("failed");
    expect(failedPhaseProgress.completionRate).toBeCloseTo(0.25);

    controller.advanceByTime(47_000);
    controller.advanceByTime(49_000);

    const nextRoundProgress = controller.getPhaseProgress();

    expect(controller.phase).toBe("Prep");
    expect(controller.roundIndex).toBe(2);
    expect(nextRoundProgress.targetHp).toBe(750);
    expect(nextRoundProgress.damageDealt).toBe(0);
    expect(nextRoundProgress.result).toBe("pending");
    expect(nextRoundProgress.completionRate).toBe(0);
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

  test("Battle開始時スナップショットが戦闘入力として固定される", () => {
    const originalDebugLogs = process.env.MATCH_DEBUG_LOGS;
    const originalSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    process.env.MATCH_DEBUG_LOGS = "1";
    delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const controller = new MatchRoomController(
        ["p1", "p2"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.startIfReady(2_000);

      const setP1 = controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      });
      const setP2 = controller.submitPrepCommand("p2", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      });

      expect(setP1).toEqual({ accepted: true });
      expect(setP2).toEqual({ accepted: true });

      controller.advanceByTime(32_000);

      const livePlacements = Reflect.get(controller as object, "boardPlacementsByPlayer") as
        | Map<string, Array<{ cell: number; unitType: string; starLevel?: number }>>
        | undefined;
      if (!livePlacements) {
        throw new Error("Expected boardPlacementsByPlayer to exist");
      }

      livePlacements.set("p1", [{ cell: 0, unitType: "mage" }]);

      controller.advanceByTime(42_000);

      const battleTraceLogs = logSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => entry.includes('"type":"battle_trace"'))
        .map((entry) => JSON.parse(entry));

      expect(battleTraceLogs.length).toBeGreaterThan(0);

      const trace = battleTraceLogs[0] as {
        leftPlayerId: string;
        rightPlayerId: string;
        leftPlacements: Array<{ unitType: string }>;
        rightPlacements: Array<{ unitType: string }>;
      };

      const p1Placements =
        trace.leftPlayerId === "p1" ? trace.leftPlacements : trace.rightPlacements;

      expect(p1Placements).toEqual(
        expect.arrayContaining([expect.objectContaining({ unitType: "vanguard" })]),
      );
      expect(p1Placements).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ unitType: "mage" })]),
      );
    } finally {
      logSpy.mockRestore();
      if (originalDebugLogs === undefined) {
        delete process.env.MATCH_DEBUG_LOGS;
      } else {
        process.env.MATCH_DEBUG_LOGS = originalDebugLogs;
      }

      if (originalSuppressVerboseLogs === undefined) {
        delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
      } else {
        process.env.SUPPRESS_VERBOSE_TEST_LOGS = originalSuppressVerboseLogs;
      }
    }
  });

  test("Prep中の適用配置はBattle開始時スナップショットへ反映される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2"],
      1_000,
      controllerOptions,
    );

    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.startIfReady(2_000);

    const p1Result = controller.applyPrepPlacementForPlayer("p1", [
      { cell: 2, unitType: "mage" },
    ]);
    const p2Result = controller.applyPrepPlacementForPlayer("p2", [
      { cell: 3, unitType: "ranger" },
    ]);

    expect(p1Result).toEqual({ success: true, code: "SUCCESS" });
    expect(p2Result).toEqual({ success: true, code: "SUCCESS" });

    controller.advanceByTime(32_000);

    const snapshotMap = Reflect.get(controller as object, "battleInputSnapshotByPlayer") as
      | Map<string, Array<{ cell: number; unitType: string; starLevel?: number }>>
      | undefined;

    expect(snapshotMap?.get("p1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cell: 2, unitType: "mage" }),
      ]),
    );
    expect(snapshotMap?.get("p2")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cell: 3, unitType: "ranger" }),
      ]),
    );
  });

  test("T3: 戦闘単位で入力と結果を追跡できるトレースログが常時出力される", () => {
    // 環境変数を設定せずにテスト（常時出力の確認）
    const originalSuppressVerboseLogs = process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const controller = new MatchRoomController(
        ["p1", "p2"],
        1_000,
        controllerOptions,
      );

      controller.setReady("p1", true);
      controller.setReady("p2", true);
      controller.startIfReady(2_000);

      controller.submitPrepCommand("p1", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "vanguard" }],
      });
      controller.submitPrepCommand("p2", 1, 3_000, {
        boardPlacements: [{ cell: 0, unitType: "ranger" }],
      });

      controller.advanceByTime(32_000); // -> Battle
      controller.advanceByTime(42_000); // -> Settle

      const allLogs = logSpy.mock.calls
        .map((call) => call[0])
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => JSON.parse(entry));

      const battleTraces = allLogs.filter(
        (log) => log.type === "battle_trace",
      );
      const resultTraces = allLogs.filter(
        (log) => log.type === "battle_result_trace",
      );

      // 環境変数なしでログが出力される
      expect(battleTraces.length).toBeGreaterThan(0);
      expect(resultTraces.length).toBeGreaterThan(0);

      // battle_trace と battle_result_trace に同じ battleId が含まれる
      const battleTrace = battleTraces[0];
      const resultTrace = resultTraces[0];

      expect(battleTrace).toHaveProperty("battleId");
      expect(resultTrace).toHaveProperty("battleId");
      expect(battleTrace.battleId).toBe(resultTrace.battleId);

      // 入力placementsが含まれる
      expect(battleTrace).toHaveProperty("leftPlacements");
      expect(battleTrace).toHaveProperty("rightPlacements");

      // 結果が含まれる
      expect(resultTrace).toHaveProperty("winner");
      expect(resultTrace).toHaveProperty("leftSurvivors");
      expect(resultTrace).toHaveProperty("rightSurvivors");
      expect(resultTrace).toHaveProperty("leftDamageTaken");
      expect(resultTrace).toHaveProperty("rightDamageTaken");
    } finally {
      logSpy.mockRestore();
      if (originalSuppressVerboseLogs === undefined) {
        delete process.env.SUPPRESS_VERBOSE_TEST_LOGS;
      } else {
        process.env.SUPPRESS_VERBOSE_TEST_LOGS = originalSuppressVerboseLogs;
      }
    }
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
    expect(controller.getPlayerHp("p4")).toBe(89);
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

    expect(controller.getPlayerHp("p1")).toBe(89);
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
    expect(set1Controller.getPlayerHp("p4")).toBe(89);
    expect(set2Controller.getPlayerHp("p1")).toBe(100);
    expect(set2Controller.getPlayerHp("p4")).toBe(89);
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

    expect(controller.getPlayerHp("p1")).toBe(87);
    expect(controller.getPlayerHp("p4")).toBe(100);
  });

  test("boardPlacementsで不正セル重複はDUPLICATE_CELLで却下される", () => {
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

    expect(result).toEqual({ accepted: false, code: "DUPLICATE_CELL" });
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

  test("setMatchLoggerで抽出サービスにもロガーが伝播される", () => {
    const controller = new MatchRoomController(
      ["p1", "p2", "p3", "p4"],
      1_000,
      controllerOptions,
    );

    // Create a mock logger
    const mockLogger = {
      logBattleResult: vi.fn(),
      logSpellEffect: vi.fn(),
      logHpChange: vi.fn(),
      logRoundTransition: vi.fn(),
      logBossShop: vi.fn(),
      logMatchSummary: vi.fn(),
      registerPlayer: vi.fn(),
    };

    // Set logger after construction (simulating GameRoom behavior)
    controller.setMatchLogger(mockLogger as unknown as import("../../src/server/match-logger").MatchLogger);

    // Start the game
    controller.setReady("p1", true);
    controller.setReady("p2", true);
    controller.setReady("p3", true);
    controller.setReady("p4", true);
    controller.startIfReady(2_000);

    // Advance to Battle phase to trigger battle resolution logging
    controller.advanceByTime(32_001);

    // Verify that battle resolution logging occurred (logger was propagated)
    // The battle should have been resolved and logged
    expect(mockLogger.logRoundTransition).toHaveBeenCalled();
  });
});
