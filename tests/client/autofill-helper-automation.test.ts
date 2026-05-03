import { describe, expect, test } from "vitest";

import {
  AUTO_FILL_BOSS_ID,
  AUTO_FILL_HERO_IDS,
  buildBossBodyGuardDecisionDiagnostic,
  buildBoardRefitDecision,
  buildAutoFillHelperActions,
  buildOptimizationCandidate,
  buildOkinaHeroSubDecisionDiagnostic,
  getBoardCurrentPowerScore,
  getFutureValueScore,
  getReplacementProtectionScore,
  getTransitionReadinessScore,
  resolveAutoFillHelperPlayerPhase,
} from "../../src/client/autofill-helper-automation.js";

describe("autofill helper automation", () => {
  test("auto-fill hero pool includes yuiman", () => {
    expect(AUTO_FILL_HERO_IDS).toContain("yuiman");
  });

  test("shared board refit scoring primitives expose independent deterministic components", () => {
    const lowLevelHighCost = { source: "bench", unitId: "hecatia", unitType: "mage", unitLevel: 1, cost: 5 };
    const readyHighCost = { ...lowLevelHighCost, unitLevel: 4 };
    const leveledLowCost = { source: "board", cell: 31, unitId: "nazrin", unitType: "ranger", unitLevel: 7, cost: 1 };
    const raidContext = {
      player: {
        role: "raid",
        selectedHeroId: "reimu",
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
          leveledLowCost,
        ],
        benchUnits: [lowLevelHighCost],
        benchUnitIds: ["hecatia"],
      },
      state: { roundIndex: 7 },
    };

    expect(getBoardCurrentPowerScore(readyHighCost, raidContext))
      .toBeGreaterThan(getBoardCurrentPowerScore(lowLevelHighCost, raidContext));
    expect(getFutureValueScore(lowLevelHighCost, raidContext))
      .toBeGreaterThan(getFutureValueScore(leveledLowCost, raidContext));
    expect(getTransitionReadinessScore(readyHighCost, raidContext))
      .toBeGreaterThan(getTransitionReadinessScore(lowLevelHighCost, raidContext));
    expect(getReplacementProtectionScore(leveledLowCost, raidContext)).toEqual(expect.objectContaining({
      reasons: expect.arrayContaining(["leveled_low_cost"]),
    }));
    expect(getReplacementProtectionScore({
      source: "board",
      cell: 30,
      unitId: "reimu",
      unitType: "hero",
      unitLevel: 3,
    }, raidContext).score).toBeGreaterThan(9_000);
    expect(getReplacementProtectionScore(lowLevelHighCost, raidContext).score).toBe(0);
  });

  test("board refit scoring separates current power, future value, transition readiness, and protection", () => {
    const diagnostic = buildBoardRefitDecision({
      role: "raid",
      selectedHeroId: "reimu",
      boardUnits: [
        { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
        { cell: 31, unitId: "nazrin", unitType: "ranger", unitLevel: 7 },
        { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 7 },
      ],
      benchUnits: [{ unitId: "megumu", unitType: "ranger", unitLevel: 1, cost: 4 }],
      benchUnitIds: ["megumu"],
    }, { roundIndex: 5 });

    expect(diagnostic.boardAtCapacity).toBe(true);
    expect(diagnostic.incomingCandidate?.futureValueScore ?? 0)
      .toBeGreaterThan(diagnostic.outgoingCandidate?.futureValueScore ?? 0);
    expect(diagnostic.outgoingCandidate?.currentPowerScore ?? 0)
      .toBeGreaterThan(diagnostic.incomingCandidate?.currentPowerScore ?? 0);
    expect(diagnostic.outgoingCandidate?.protectionScore ?? 0).toBeGreaterThan(0);
    expect(diagnostic.decision).toBe("hold");
    expect(diagnostic.reason).toBe("insufficient_margin");
  });

  test("board refit scoring marks a matured high-cost bench candidate as replacement-ready", () => {
    const diagnostic = buildBoardRefitDecision({
      role: "raid",
      selectedHeroId: "reimu",
      boardUnits: [
        { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
        { cell: 31, unitId: "momoyo", unitType: "assassin", unitLevel: 1 },
        { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
      ],
      benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
      benchUnitIds: ["hecatia"],
    }, { roundIndex: 9 });

    expect(diagnostic.decision).toBe("replace");
    expect(diagnostic.reason).toBe("replacement_ready");
    expect(diagnostic.incomingCandidate?.transitionReadinessScore ?? 0).toBeGreaterThan(0);
    expect(diagnostic.replacementScore ?? 0).toBeGreaterThan(0);
  });

  test("boss board refit accepts a frontline screen when the final-round body is under-protected", () => {
    const diagnostic = buildBoardRefitDecision({
      role: "boss",
      selectedBossId: "remilia",
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 6 },
        { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
        { cell: 9, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
        { cell: 10, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
        { cell: 4, unitId: "hecatia", unitType: "mage", unitLevel: 1 },
        { cell: 16, unitId: "junko", unitType: "mage", unitLevel: 1 },
        { cell: 1, unitId: "utsuho", unitType: "mage", unitLevel: 1 },
      ],
      benchUnits: [{ unitId: "yoshika", unitType: "vanguard", unitLevel: 1, cost: 1 }],
      benchUnitIds: ["yoshika"],
    }, { roundIndex: 12 });

    expect(diagnostic.decision).toBe("replace");
    expect(diagnostic.reason).toBe("replacement_ready");
    expect(diagnostic.incomingCandidate).toMatchObject({
      unitId: "yoshika",
      unitType: "vanguard",
    });
    expect(diagnostic.outgoingCandidate?.unitId).not.toBe("meiling");
  });

  test("boss board refit keeps mature high-cost carries once the frontline screen is established", () => {
    const diagnostic = buildBoardRefitDecision({
      role: "boss",
      selectedBossId: "remilia",
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7 },
        { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
        { cell: 14, unitId: "junko", unitType: "vanguard", unitLevel: 7 },
        { cell: 7, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
        { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
        { cell: 1, unitId: "hecatia", unitType: "mage", unitLevel: 7 },
        { cell: 15, unitId: "utsuho", unitType: "mage", unitLevel: 7 },
      ],
      benchUnits: [{ unitId: "byakuren", unitType: "vanguard", unitLevel: 1, cost: 5 }],
      benchUnitIds: ["byakuren"],
    }, { roundIndex: 12 });

    expect(diagnostic.decision).toBe("hold");
    expect(diagnostic.outgoingCandidate?.unitId).not.toBe("hecatia");
    expect(diagnostic.outgoingCandidate?.unitId).not.toBe("utsuho");
    expect(diagnostic.outgoingCandidate?.unitId).not.toBe("patchouli");
  });

  test("boss board refit can pivot low-level Meiling into a mature carry after Sakuya and Patchouli are established", () => {
    const diagnostic = buildBoardRefitDecision({
      role: "boss",
      selectedBossId: "remilia",
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7 },
        { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 3 },
        { cell: 14, unitId: "junko", unitType: "vanguard", unitLevel: 7 },
        { cell: 20, unitId: "byakuren", unitType: "vanguard", unitLevel: 7 },
        { cell: 7, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
        { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
        { cell: 15, unitId: "utsuho", unitType: "mage", unitLevel: 7 },
      ],
      benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
      benchUnitIds: ["hecatia"],
    }, { roundIndex: 12 });

    expect(diagnostic.decision).toBe("replace");
    expect(diagnostic.outgoingCandidate?.unitId).toBe("meiling");
    expect(diagnostic.outgoingCandidate?.protectionReasons).not.toContain("boss_exclusive_core");
  });

  test("boss board refit can pivot maxed Meiling into a mature normal carry after the late frontline is covered", () => {
    const diagnostic = buildBoardRefitDecision({
      role: "boss",
      selectedBossId: "remilia",
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7 },
        { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
        { cell: 14, unitId: "junko", unitType: "vanguard", unitLevel: 7 },
        { cell: 20, unitId: "byakuren", unitType: "vanguard", unitLevel: 7 },
        { cell: 7, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
        { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
        { cell: 15, unitId: "utsuho", unitType: "mage", unitLevel: 7 },
      ],
      benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 7, cost: 5 }],
      benchUnitIds: ["hecatia"],
    }, { roundIndex: 12 });

    expect(diagnostic.decision).toBe("replace");
    expect(diagnostic.outgoingCandidate?.unitId).toBe("meiling");
    expect(diagnostic.outgoingCandidate?.protectionReasons).not.toContain("boss_exclusive_core");
    expect(diagnostic.outgoingCandidate?.protectionReasons).not.toContain("frontline_anchor");
  });

  test("board refit scoring protects pair and sub-host anchors", () => {
    const protectedCandidate = buildOptimizationCandidate({
      source: "board",
      cell: 31,
      unitId: "miko",
      unitType: "mage",
      unitLevel: 2,
      subUnit: { unitId: "futo", unitType: "mage" },
    }, {
      player: {
        role: "raid",
        selectedHeroId: "reimu",
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
          { cell: 31, unitId: "miko", unitType: "mage", unitLevel: 2, subUnit: { unitId: "futo", unitType: "mage" } },
        ],
        boardSubUnits: ["31:hero:futo"],
      },
      state: { roundIndex: 6 },
    });

    expect(protectedCandidate.protectionScore).toBeGreaterThan(0);
    expect(protectedCandidate.protectionReasons).toEqual(expect.arrayContaining([
      "sub_host",
      "pair_anchor",
    ]));
  });

  test("purchase phase boss helper reserves a high-future carry when board slots are full but bench pressure is low", () => {
    const player = {
      ready: false,
      role: "boss",
      gold: 5,
      selectedBossId: "remilia",
      specialUnitLevel: 7,
      benchUnits: ["ranger"],
      benchUnitIds: ["nazrin"],
      boardSubUnits: [],
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7 },
        { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
        { cell: 9, unitId: "sakuya", unitType: "assassin", unitLevel: 5 },
        { cell: 10, unitId: "patchouli", unitType: "mage", unitLevel: 5 },
        { cell: 3, unitId: "junko", unitType: "vanguard", unitLevel: 7 },
        { cell: 4, unitId: "byakuren", unitType: "vanguard", unitLevel: 7 },
        { cell: 5, unitId: "utsuho", unitType: "mage", unitLevel: 7 },
      ],
      shopOffers: [
        { unitId: "hecatia", unitType: "mage", cost: 5 },
        { unitId: "kagerou", unitType: "vanguard", cost: 1 },
      ],
      bossShopOffers: [],
    };
    const state = { phase: "Prep", playerPhase: "purchase", roundIndex: 10 };

    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player,
      state,
    })).toEqual([{
      type: "prep_command",
      payload: { shopBuySlotIndex: 0 },
    }]);
  });

  test("purchase phase boss helper starts reserving a high-future carry at the midgame pivot once its core is established", () => {
    const player = {
      ready: false,
      role: "boss",
      gold: 5,
      selectedBossId: "remilia",
      specialUnitLevel: 4,
      benchUnits: ["ranger"],
      benchUnitIds: ["nazrin"],
      boardSubUnits: [],
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 4 },
        { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
        { cell: 9, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
        { cell: 10, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
        { cell: 3, unitId: "junko", unitType: "vanguard", unitLevel: 7 },
        { cell: 4, unitId: "byakuren", unitType: "vanguard", unitLevel: 7 },
        { cell: 5, unitId: "utsuho", unitType: "mage", unitLevel: 7 },
      ],
      shopOffers: [
        { unitId: "hecatia", unitType: "mage", cost: 5 },
        { unitId: "kagerou", unitType: "vanguard", cost: 1 },
      ],
      bossShopOffers: [],
    };
    const state = { phase: "Prep", playerPhase: "purchase", roundIndex: 6 };

    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player,
      state,
    })).toEqual([{
      type: "prep_command",
      payload: { shopBuySlotIndex: 0 },
    }]);
  });

  test("deploy phase sells one weak board unit when a ready bench candidate clearly improves a full board", () => {
    const player = {
      ready: false,
      role: "raid",
      gold: 0,
      selectedHeroId: "reimu",
      specialUnitLevel: 3,
      benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
      benchUnitIds: ["hecatia"],
      boardSubUnits: [],
      boardUnits: [
        { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
        { cell: 31, unitId: "momoyo", unitType: "assassin", unitLevel: 1 },
        { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
      ],
      shopOffers: [],
      bossShopOffers: [],
    };
    const state = { phase: "Prep", playerPhase: "deploy", roundIndex: 9 };
    const diagnostic = buildBoardRefitDecision(player, state);

    expect(diagnostic.decision).toBe("replace");
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player,
      state,
    })).toEqual([{
      type: "prep_command",
      payload: { boardSellIndex: diagnostic.outgoingCandidate?.cell },
    }]);
  });

  test("deploy phase does not refit twice in the same round", () => {
    const actions = buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 0,
        selectedHeroId: "reimu",
        specialUnitLevel: 3,
        lastBoardRefitRoundIndex: 9,
        benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
        benchUnitIds: ["hecatia"],
        boardSubUnits: [],
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
          { cell: 31, unitId: "momoyo", unitType: "assassin", unitLevel: 1 },
          { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
        ],
        shopOffers: [],
        bossShopOffers: [],
      },
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    });

    expect(actions[0]?.payload).not.toHaveProperty("boardSellIndex");
  });

  test("boss optimization-off keeps a full board closed instead of selling for a refit", () => {
    const actions = buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "boss-optimization-off",
      player: {
        ready: false,
        role: "boss",
        gold: 0,
        selectedBossId: "remilia",
        specialUnitLevel: 3,
        benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
        benchUnitIds: ["hecatia"],
        boardSubUnits: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 3 },
          { cell: 3, unitId: "momoyo", unitType: "assassin", unitLevel: 1 },
          { cell: 4, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
        ],
        shopOffers: [],
        bossShopOffers: [],
      },
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    });

    expect(actions[0]?.payload).not.toHaveProperty("boardSellIndex");
  });

  test("board-refit-off keeps full boards closed while preserving future reserve buys", () => {
    const basePlayer = {
      ready: false,
      role: "raid",
      gold: 5,
      specialUnitLevel: 7,
      selectedHeroId: "reimu",
      benchUnits: ["ranger"],
      benchUnitIds: ["nazrin"],
      boardSubUnits: ["30:okina", "31:koishi", "32:satori"],
      boardUnits: [
        { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 7 },
        { cell: 31, unitId: "yoshika", unitType: "vanguard", unitLevel: 3 },
        { cell: 32, unitId: "momoyo", unitType: "assassin", unitLevel: 2 },
      ],
      heroExclusiveShopOffers: [],
      shopOffers: [
        { unitId: "hecatia", unitType: "mage", cost: 5 },
        { unitId: "kagerou", unitType: "vanguard", cost: 1 },
      ],
      bossShopOffers: [],
    };

    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "board-refit-off",
      player: {
        ...basePlayer,
        gold: 0,
        shopOffers: [],
      },
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    })[0]?.payload).not.toHaveProperty("boardSellIndex");
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "board-refit-off",
      player: basePlayer,
      state: { phase: "Prep", playerPhase: "purchase", roundIndex: 9 },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("role-specific board refit variants only close the targeted role", () => {
    const raidPlayer = {
      ready: false,
      role: "raid",
      gold: 0,
      selectedHeroId: "reimu",
      specialUnitLevel: 3,
      benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
      benchUnitIds: ["hecatia"],
      boardSubUnits: [],
      boardUnits: [
        { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
        { cell: 31, unitId: "momoyo", unitType: "assassin", unitLevel: 1 },
        { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
      ],
      shopOffers: [],
      bossShopOffers: [],
    };
    const bossPlayer = {
      ready: false,
      role: "boss",
      gold: 0,
      selectedBossId: "remilia",
      specialUnitLevel: 3,
      benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
      benchUnitIds: ["hecatia"],
      boardSubUnits: [],
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 3 },
        { cell: 3, unitId: "momoyo", unitType: "assassin", unitLevel: 1 },
        { cell: 4, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
        { cell: 8, unitId: "nazrin", unitType: "ranger", unitLevel: 1 },
        { cell: 9, unitId: "rin", unitType: "vanguard", unitLevel: 1 },
        { cell: 10, unitId: "wakasagihime", unitType: "ranger", unitLevel: 1 },
        { cell: 11, unitId: "clownpiece", unitType: "assassin", unitLevel: 1 },
      ],
      shopOffers: [],
      bossShopOffers: [],
    };

    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "raid-board-refit-off",
      player: raidPlayer,
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    })[0]?.payload).not.toHaveProperty("boardSellIndex");
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "raid-board-refit-off",
      player: bossPlayer,
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    })[0]?.payload).toHaveProperty("boardSellIndex");
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "boss-board-refit-off",
      player: bossPlayer,
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    })[0]?.payload).not.toHaveProperty("boardSellIndex");
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "boss-board-refit-off",
      player: raidPlayer,
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    })[0]?.payload).toHaveProperty("boardSellIndex");
  });

  test("purchase phase raid helper reserves a high-future shop candidate when board and sub slots are full but bench pressure is low", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        specialUnitLevel: 7,
        selectedHeroId: "reimu",
        benchUnits: ["ranger"],
        benchUnitIds: ["nazrin"],
        boardSubUnits: ["30:okina", "31:koishi", "32:satori"],
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 7 },
          { cell: 31, unitId: "yoshika", unitType: "vanguard", unitLevel: 3 },
          { cell: 32, unitId: "momoyo", unitType: "assassin", unitLevel: 2 },
        ],
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
        bossShopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 9,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("raid optimization-off skips high-future reserve buys that need no immediate deploy slot", () => {
    const actions = buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "raid-optimization-off",
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        specialUnitLevel: 7,
        selectedHeroId: "reimu",
        benchUnits: ["ranger"],
        benchUnitIds: ["nazrin"],
        boardSubUnits: ["30:okina", "31:koishi", "32:satori"],
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 7 },
          { cell: 31, unitId: "yoshika", unitType: "vanguard", unitLevel: 3 },
          { cell: 32, unitId: "momoyo", unitType: "assassin", unitLevel: 2 },
        ],
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
        bossShopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 9,
      },
    });

    expect(actions[0]?.payload).not.toHaveProperty("shopBuySlotIndex");
  });

  test("future-shop-off skips no-slot reserve buys while preserving board refit", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "future-shop-off",
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        specialUnitLevel: 7,
        selectedHeroId: "reimu",
        benchUnits: ["ranger"],
        benchUnitIds: ["nazrin"],
        boardSubUnits: ["30:okina", "31:koishi", "32:satori"],
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 7 },
          { cell: 31, unitId: "yoshika", unitType: "vanguard", unitLevel: 3 },
          { cell: 32, unitId: "momoyo", unitType: "assassin", unitLevel: 2 },
        ],
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
        bossShopOffers: [],
      },
      state: { phase: "Prep", playerPhase: "purchase", roundIndex: 9 },
    })[0]?.payload).not.toHaveProperty("shopBuySlotIndex");
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "future-shop-off",
      player: {
        ready: false,
        role: "raid",
        gold: 0,
        selectedHeroId: "reimu",
        specialUnitLevel: 3,
        benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
        benchUnitIds: ["hecatia"],
        boardSubUnits: [],
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 3 },
          { cell: 31, unitId: "momoyo", unitType: "assassin", unitLevel: 1 },
          { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
        ],
        shopOffers: [],
        bossShopOffers: [],
      },
      state: { phase: "Prep", playerPhase: "deploy", roundIndex: 9 },
    })[0]?.payload).toHaveProperty("boardSellIndex");
  });

  test("all-optimization-off disables both role-specific no-slot reserves and board refits", () => {
    const actions = buildAutoFillHelperActions({
      helperIndex: 0,
      optimizationVariant: "all-optimization-off",
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        selectedHeroId: "reimu",
        specialUnitLevel: 7,
        benchUnits: [{ unitId: "hecatia", unitType: "mage", unitLevel: 4, cost: 5 }],
        benchUnitIds: ["hecatia"],
        boardSubUnits: ["30:okina", "31:koishi", "32:satori"],
        boardUnits: [
          { cell: 30, unitId: "reimu", unitType: "hero", unitLevel: 7 },
          { cell: 31, unitId: "yoshika", unitType: "vanguard", unitLevel: 3 },
          { cell: 32, unitId: "momoyo", unitType: "assassin", unitLevel: 2 },
        ],
        heroExclusiveShopOffers: [],
        shopOffers: [{ unitId: "hecatia", unitType: "mage", cost: 5 }],
        bossShopOffers: [],
      },
      state: { phase: "Prep", playerPhase: "purchase", roundIndex: 9 },
    });

    expect(actions[0]?.payload).not.toHaveProperty("shopBuySlotIndex");
    expect(actions[0]?.payload).not.toHaveProperty("boardSellIndex");
  });

  test("preference stage auto-readies a helper so bot-only lobbies can start", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "unassigned",
      },
      state: {
        lobbyStage: "preference",
        phase: "Waiting",
      },
    })).toEqual([
      {
        payload: { ready: true },
        type: "ready",
      },
    ]);
  });

  test("preference stage keeps an already-readied helper idle", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: true,
        role: "unassigned",
      },
      state: {
        lobbyStage: "preference",
        phase: "Waiting",
      },
    })).toEqual([]);
  });

  test("selection phase auto-selects the default boss for a boss helper", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: true,
        role: "boss",
        selectedBossId: null,
      },
      state: {
        featureFlagsEnableTouhouRoster: true,
        lobbyStage: "selection",
        phase: "Waiting",
      },
    })).toEqual([
      {
        payload: { bossId: AUTO_FILL_BOSS_ID },
        type: "boss_select",
      },
    ]);
  });

  test("selection phase auto-selects a deterministic hero for a raid helper", () => {
    const helperIndex = 3;

    expect(buildAutoFillHelperActions({
      helperIndex,
      player: {
        ready: true,
        role: "raid",
        selectedHeroId: null,
      },
      state: {
        featureFlagsEnableTouhouRoster: true,
        lobbyStage: "selection",
        phase: "Waiting",
      },
    })).toEqual([
      {
        payload: { heroId: AUTO_FILL_HERO_IDS[helperIndex % AUTO_FILL_HERO_IDS.length]! },
        type: "HERO_SELECT",
      },
    ]);
  });

  test("selection phase uses explicit hero override when provided", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      heroId: "jyoon",
      player: {
        ready: true,
        role: "raid",
        selectedHeroId: null,
      },
      state: {
        featureFlagsEnableTouhouRoster: true,
        lobbyStage: "selection",
        phase: "Waiting",
      },
    })).toEqual([
      {
        payload: { heroId: "jyoon" },
        type: "HERO_SELECT",
      },
    ]);
  });

  test("selection phase stays neutral when Touhou roster is disabled", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: true,
        role: "raid",
        selectedHeroId: null,
      },
      state: {
        featureFlagsEnableTouhouRoster: false,
        lobbyStage: "selection",
        phase: "Waiting",
      },
    })).toEqual([]);
  });

  test("prep phase auto-readies a helper once it has already deployed a purchased unit", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 0,
        boardUnits: ["30:reimu", "33:ranger"],
        selectedHeroId: "reimu",
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { ready: true },
        type: "ready",
      },
    ]);
  });

  test("prep phase waits for the first shop sync before readying an empty raid helper", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 2,
        benchUnits: [],
        boardUnits: [],
        selectedHeroId: AUTO_FILL_HERO_IDS[1]!,
        shopOffers: [],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([]);
  });

  test("prep phase deploys an already purchased bench unit even before deploy phase is announced", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        benchUnits: ["vanguard"],
        boardUnits: ["30:reimu"],
        selectedHeroId: AUTO_FILL_HERO_IDS[1]!,
        shopOffers: [{ unitType: "mage", cost: 3 }],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        playerPhaseDeadlineAtMs: Date.now() + 1_000,
      },
    })).toEqual([
      {
        payload: {
          shopBuySlotIndex: 0,
        },
        type: "prep_command",
      },
    ]);
  });

  test("purchase phase deadline crossing is treated as deploy even before room state catches up", () => {
    const nowMs = 1_000;

    expect(resolveAutoFillHelperPlayerPhase({
      playerPhase: "purchase",
      playerPhaseDeadlineAtMs: nowMs - 1,
    }, nowMs)).toBe("deploy");

    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        benchUnits: ["vanguard"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        playerPhaseDeadlineAtMs: nowMs - 1,
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 21,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("raid helper can keep shopping when only sub-slot deploy capacity remains", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 3,
        benchUnits: [],
        boardUnits: [
          { cell: 30, unitId: "okina" },
          { cell: 31, unitId: "front-a" },
          { cell: 32, unitId: "front-b" },
          { cell: 33, unitId: "front-c" },
        ],
        boardSubUnits: [],
        selectedHeroId: "okina",
        shopOffers: [{ unitType: "mage", cost: 3 }],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("raid helper deploys Okina as a hero sub-unit during deploy phase", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        benchUnits: [],
        boardUnits: [
          { cell: 31, unitId: "hecatia", unitType: "mage", unitLevel: 4 },
          { cell: 32, unitId: "yoshika", unitType: "vanguard" },
        ],
        boardSubUnits: [],
        selectedHeroId: "okina",
        specialUnitLevel: 4,
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: { heroPlacementCell: 31 },
        type: "prep_command",
      },
    ]);
  });

  test("raid optimization-off skips Okina host attachment optimization", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      optimizationVariant: "raid-optimization-off",
      player: {
        ready: false,
        role: "raid",
        benchUnits: [],
        boardUnits: [
          { cell: 31, unitId: "hecatia", unitType: "mage" },
          { cell: 32, unitId: "yoshika", unitType: "vanguard" },
        ],
        boardSubUnits: [],
        selectedHeroId: "okina",
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: { ready: true },
        type: "ready",
      },
    ]);
  });

  test("Okina sub decision diagnostic explains the best host boundary", () => {
    const diagnostic = buildOkinaHeroSubDecisionDiagnostic({
      role: "raid",
      selectedHeroId: "okina",
      specialUnitLevel: 4,
      boardUnits: [
        { cell: 31, unitId: "hecatia", unitType: "mage", unitLevel: 4 },
        { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 2 },
      ],
      boardSubUnits: [],
    });

    expect(diagnostic).toEqual(expect.objectContaining({
      candidateCount: 2,
      decision: "attach",
      reason: "attach_best_host",
      bestHostUnitId: "hecatia",
      bestHostLevel: 4,
      specialUnitStage: 4,
      bestHostOptimizationCandidate: expect.objectContaining({
        source: "board",
        cell: 31,
        unitId: "hecatia",
        currentPowerScore: expect.any(Number),
        futureValueScore: expect.any(Number),
        transitionReadinessScore: expect.any(Number),
        protectionScore: expect.any(Number),
        protectionReasons: expect.any(Array),
      }),
    }));
    expect(diagnostic?.bestHostGain ?? 0).toBeGreaterThan(0);
    expect(diagnostic?.frontEquivalentValue ?? 0).toBeGreaterThan(0);
    expect(diagnostic?.bestToFrontRatio ?? 0).toBeGreaterThan(1);
    expect(diagnostic?.bestHostOptimizationCandidate?.currentPowerScore ?? 0).toBeGreaterThan(0);
    expect(diagnostic?.bestHostOptimizationCandidate?.futureValueScore ?? 0).toBeGreaterThan(0);
  });

  test("Okina sub decision keeps front support against moderate standard hosts", () => {
    const diagnostic = buildOkinaHeroSubDecisionDiagnostic({
      role: "raid",
      selectedHeroId: "okina",
      specialUnitLevel: 7,
      boardUnits: [
        { cell: 31, unitId: "rin", unitType: "vanguard", unitLevel: 3 },
        { cell: 32, unitId: "yoshika", unitType: "vanguard", unitLevel: 3 },
      ],
      boardSubUnits: [],
    });

    expect(diagnostic).toEqual(expect.objectContaining({
      candidateCount: 2,
      decision: "keep_front",
      reason: "front_value_preferred",
      bestHostUnitId: "yoshika",
      bestHostLevel: 3,
      specialUnitStage: 7,
    }));
  });

  test("Okina sub decision keeps front support against mid-level standard ranged hosts", () => {
    const diagnostic = buildOkinaHeroSubDecisionDiagnostic({
      role: "raid",
      selectedHeroId: "okina",
      specialUnitLevel: 7,
      boardUnits: [
        { cell: 31, unitId: "wakasagihime", unitType: "ranger", unitLevel: 3 },
        { cell: 32, unitId: "tojiko", unitType: "ranger", unitLevel: 2 },
      ],
      boardSubUnits: [],
    });

    expect(diagnostic).toEqual(expect.objectContaining({
      candidateCount: 2,
      decision: "keep_front",
      reason: "front_value_preferred",
      bestHostUnitId: "tojiko",
      bestHostLevel: 2,
      specialUnitStage: 7,
    }));
  });

  test("Okina sub decision diagnostic recognizes an already attached host from board units", () => {
    const diagnostic = buildOkinaHeroSubDecisionDiagnostic({
      role: "raid",
      selectedHeroId: "okina",
      specialUnitLevel: 4,
      boardUnits: [
        {
          cell: 31,
          unitId: "hecatia",
          unitType: "mage",
          unitLevel: 4,
          attachedSubUnitId: "okina",
          attachedSubUnitType: "hero",
        },
      ],
      boardSubUnits: [],
    });

    expect(diagnostic).toEqual(expect.objectContaining({
      attachedHostCell: 31,
      candidateCount: 0,
      currentHostUnitId: "hecatia",
      decision: "keep_current",
      reason: "current_host_only",
    }));
    expect(diagnostic?.currentHostGain ?? 0).toBeGreaterThan(0);
  });

  test("raid helper can attach Okina to an existing host before explicit deploy phase", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        benchUnits: [],
        boardUnits: [
          { cell: 31, unitId: "hecatia", unitType: "mage", unitLevel: 4 },
        ],
        boardSubUnits: [],
        selectedHeroId: "okina",
        specialUnitLevel: 4,
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { heroPlacementCell: 31 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper buys from boss shop before readying", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [],
        boardUnits: [],
        bossShopOffers: [
          { unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper skips already purchased boss-shop offers", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: [],
        boardUnits: [],
        selectedBossId: "remilia",
        bossShopOffers: [
          { unitId: "sakuya", unitType: "assassin", cost: 3, purchased: true },
          { unitId: "meiling", unitType: "vanguard", cost: 2 },
        ],
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 1,
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper skips already purchased normal-shop offers", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "8:meiling", "9:sakuya"],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5, purchased: true },
          { unitId: "kagerou", unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 3,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper upgrades its special unit when reserve shops are empty", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 4,
        specialUnitLevel: 3,
        benchUnits: [],
        boardUnits: [],
        bossShopOffers: [],
        shopOffers: [],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper can keep leveling Remilia while a bench unit waits for deploy", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 4,
        specialUnitLevel: 4,
        benchUnits: ["mage"],
        benchUnitIds: ["patchouli"],
        boardUnits: [
          "2:remilia",
          { cell: 4, unitType: "vanguard", unitId: "meiling", unitLevel: 7 },
          { cell: 10, unitType: "assassin", unitId: "sakuya" },
          { cell: 16, unitType: "mage", unitId: "patchouli" },
        ],
        bossShopOffers: [],
        shopOffers: [],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper buys another reserve carry while board slots are open", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 1,
        benchUnits: [],
        boardUnits: [
          "2:remilia",
          { cell: 4, unitType: "vanguard", unitId: "meiling", unitLevel: 7 },
          { cell: 10, unitType: "assassin", unitId: "sakuya" },
          { cell: 16, unitType: "mage", unitId: "patchouli" },
        ],
        bossShopOffers: [
          { unitId: "patchouli", unitType: "mage", cost: 4 },
          { unitId: "meiling", unitType: "vanguard", cost: 2 },
        ],
        shopOffers: [],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 5,
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper upgrades Remilia before a non-stacking reserve carry once board slots are full", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 1,
        benchUnits: [],
        boardUnits: [
          "2:remilia",
          { cell: 4, unitType: "vanguard", unitId: "meiling", unitLevel: 7 },
          { cell: 10, unitType: "assassin", unitId: "sakuya" },
          { cell: 16, unitType: "mage", unitId: "patchouli" },
          { cell: 8, unitType: "vanguard", unitId: "yoshika", unitLevel: 4 },
          { cell: 14, unitType: "vanguard", unitId: "rin", unitLevel: 4 },
          { cell: 15, unitType: "vanguard", unitId: "junko", unitLevel: 4 },
        ],
        bossShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 5,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper buys a normal duplicate even when board slots are full", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 2,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          "2:remilia",
          "8:meiling",
          "9:sakuya",
          "10:patchouli",
          "3:junko",
          "4:hecatia",
          "5:byakuren",
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "junko", unitType: "vanguard", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 7,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper matures a normal high-cost duplicate over another saturated Scarlet duplicate", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 4,
        specialUnitLevel: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7 },
          { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 9, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
          { cell: 10, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
          { cell: 3, unitId: "junko", unitType: "vanguard", unitLevel: 4 },
          { cell: 4, unitId: "utsuho", unitType: "mage", unitLevel: 4 },
          { cell: 5, unitId: "byakuren", unitType: "vanguard", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
        bossShopOffers: [
          { unitId: "patchouli", unitType: "mage", cost: 4 },
        ],
        shopOffers: [
          { unitId: "junko", unitType: "vanguard", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("late boss helper refreshes past a new high-cost first copy once normal carries are already online", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7 },
          { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 9, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
          { cell: 10, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
          { cell: 3, unitId: "junko", unitType: "vanguard", unitLevel: 4 },
          { cell: 4, unitId: "utsuho", unitType: "mage", unitLevel: 4 },
          { cell: 5, unitId: "byakuren", unitType: "vanguard", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "futo", unitType: "mage", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 9,
      },
    })).toEqual([
      {
        payload: { shopRefreshCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper chases duplicates once two normal high-cost carries are seeded", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7 },
          { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 9, unitId: "sakuya", unitType: "assassin", unitLevel: 7 },
          { cell: 10, unitId: "patchouli", unitType: "mage", unitLevel: 7 },
          { cell: 3, unitId: "junko", unitType: "vanguard", unitLevel: 2 },
          { cell: 4, unitId: "utsuho", unitType: "mage", unitLevel: 2 },
          { cell: 5, unitId: "yoshika", unitType: "vanguard", unitLevel: 1 },
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "futo", unitType: "mage", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { shopRefreshCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper refreshes past a weak normal offer after its Scarlet core is established", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          "2:remilia",
          "8:meiling",
          "9:sakuya",
          "10:patchouli",
          "3:junko",
          "4:utsuho",
          "5:byakuren",
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", cost: 1 },
          { unitId: "wakasagihime", unitType: "ranger", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { shopRefreshCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame bench-full boss helper sells a weak bench unit for a stronger normal offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: ["vanguard", "ranger", "mage", "assassin", "ranger", "vanguard", "mage", "assassin"],
        benchUnitIds: ["nazrin", "wakasagihime", "rin", "clownpiece", "chimata", "utsuho", "byakuren", "momoyo"],
        boardUnits: [
          "2:remilia",
          "8:meiling",
          "9:sakuya",
          "10:patchouli",
          "4:hecatia",
          "5:byakuren",
          "3:utsuho",
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "junko", unitType: "vanguard", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { benchSellIndex: 7 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame board-full boss helper sells a weak board unit for a stronger normal offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          "2:remilia",
          "8:meiling",
          "9:sakuya",
          "10:patchouli",
          { cell: 3, unitType: "vanguard", unitId: "momoyo" },
          { cell: 4, unitType: "vanguard", unitId: "rin" },
          { cell: 5, unitType: "vanguard", unitId: "yoshika", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { boardSellIndex: 3 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper buys the stronger normal offer after opening a board slot", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          "2:remilia",
          "8:meiling",
          "9:sakuya",
          "10:patchouli",
          { cell: 4, unitType: "vanguard", unitId: "rin" },
          { cell: 5, unitType: "vanguard", unitId: "yoshika", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper can sell non-max Meiling after Sakuya and Patchouli core is online", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          "2:remilia",
          { cell: 8, unitType: "vanguard", unitId: "meiling", unitLevel: 4 },
          "9:sakuya",
          "10:patchouli",
          { cell: 4, unitType: "vanguard", unitId: "yoshika", unitLevel: 4 },
          { cell: 5, unitType: "vanguard", unitId: "junko", unitLevel: 4 },
          { cell: 14, unitType: "mage", unitId: "byakuren", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
        bossShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { boardSellIndex: 8 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper opens an empty board with Meiling as a frontline guard", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: [],
        boardUnits: [],
        bossShopOffers: [
          { unitId: "meiling", unitType: "vanguard", cost: 2 },
          { unitId: "patchouli", unitType: "mage", cost: 4 },
          { unitId: "sakuya", unitType: "assassin", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper completes the Scarlet core with Sakuya before upgrading Remilia in early rounds", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "8:meiling", "14:yoshika"],
        bossShopOffers: [
          { unitId: "sakuya", unitType: "assassin", cost: 3 },
          { unitId: "patchouli", unitType: "mage", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 1,
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper avoids a fragile backline-only third unit in early rounds", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "8:meiling", "14:yoshika"],
        bossShopOffers: [
          { unitId: "patchouli", unitType: "mage", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 1,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper chases an owned duplicate over a slightly stronger new offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "4:meiling"],
        bossShopOffers: [
          { unitId: "meiling", unitType: "vanguard", cost: 2 },
          { unitId: "patchouli", unitType: "mage", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper completes the Scarlet core with Sakuya before another Meiling duplicate", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "8:meiling"],
        bossShopOffers: [
          { unitId: "meiling", unitType: "vanguard", cost: 2 },
          { unitId: "sakuya", unitType: "assassin", cost: 3 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 2,
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper upgrades Remilia instead of forcing a third boss-exclusive unit", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        specialUnitLevel: 1,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "8:meiling", "9:sakuya"],
        bossShopOffers: [
          { unitId: "patchouli", unitType: "mage", cost: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 5,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper can buy from the normal shop when it outranks boss-only offers", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: [],
        boardUnits: ["2:remilia", "8:meiling", "10:patchouli", "14:sakuya"],
        bossShopOffers: [
          { unitId: "patchouli", unitType: "mage", cost: 2 },
        ],
        shopOffers: [
          { unitId: "junko", unitType: "vanguard", cost: 4 },
          { unitId: "nazrin", unitType: "ranger", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper prefers a high-value normal offer over a third-core duplicate", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        specialUnitLevel: 7,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "8:meiling", "9:sakuya", "4:patchouli"],
        bossShopOffers: [
          { unitId: "patchouli", unitType: "mage", cost: 4 },
        ],
        shopOffers: [
          { unitId: "junko", unitType: "vanguard", cost: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper buys from normal shop before readying", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        benchUnits: [],
        boardUnits: [],
        shopOffers: [
          { unitType: "mage", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper buys an affordable hero-exclusive offer before a weak normal offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        specialUnitLevel: 2,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["30:keiki"],
        selectedHeroId: "keiki",
        heroExclusiveShopOffers: [
          { unitId: "mayumi", unitType: "vanguard", cost: 3 },
        ],
        shopOffers: [
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { heroExclusiveShopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper upgrades its hero after reserve shops are exhausted", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        specialUnitLevel: 4,
        benchUnits: [],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        heroExclusiveShopOffers: [],
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper upgrades its hero before a weak normal offer in early progression", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        specialUnitLevel: 1,
        benchUnits: [],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "momoyo", unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper prefers a hero upgrade once its early raid roster is established", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 6,
        specialUnitLevel: 1,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
          { cell: 25, unitType: "vanguard", unitId: "yoshika" },
        ],
        selectedHeroId: "reimu",
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 5,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper can upgrade its hero even with a bench unit waiting to deploy", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 6,
        specialUnitLevel: 1,
        benchUnits: ["ranger"],
        benchUnitIds: ["nazrin"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
          { cell: 25, unitType: "vanguard", unitId: "yoshika" },
        ],
        selectedHeroId: "reimu",
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 5,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper can upgrade its hero when real room state omits hero from boardUnits", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        specialUnitLevel: 1,
        benchUnits: [],
        boardUnits: [{ cell: 31, unitType: "vanguard", unitId: "yoshika" }],
        selectedHeroId: "reimu",
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 4,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper upgrades its hero before rerolling when no reserve buy is worth taking", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        specialUnitLevel: 1,
        benchUnits: [],
        boardUnits: ["30:reimu", { cell: 31, unitType: "vanguard", unitId: "yoshika" }],
        selectedHeroId: "reimu",
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "hecatia", unitType: "mage", cost: 5 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 4,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper still bootstraps with a normal buy before its hero is selected", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        specialUnitLevel: 1,
        benchUnits: [],
        boardUnits: [],
        selectedHeroId: null,
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper can prefer an early hero upgrade over a top-tier normal offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        specialUnitLevel: 1,
        benchUnits: [],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper still values jyoon's expensive late upgrade over a weak offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: [],
        boardUnits: [
          "30:jyoon",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
          { cell: 25, unitType: "vanguard", unitId: "yoshika" },
        ],
        selectedHeroId: "jyoon",
        heroExclusiveShopOffers: [],
        shopOffers: [
          { unitId: "kagerou", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper prefers nazrin over other affordable raid offers", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: [],
        boardUnits: [],
        shopOffers: [
          { unitId: "sekibanki", unitType: "assassin", cost: 2 },
          { unitId: "nazrin", unitType: "ranger", cost: 1 },
          { unitId: "tsukasa", unitType: "mage", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper prefers a frontline offer when its roster is backline-heavy", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["ranger"],
        benchUnitIds: ["nazrin"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
        ],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", cost: 1 },
          { unitId: "yoshika", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper counts bench unit types when balancing the roster", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["ranger"],
        benchUnitIds: ["nazrin"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", cost: 1 },
          { unitId: "yoshika", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper normalizes upgraded bench unit suffixes when balancing the roster", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["ranger:2"],
        benchUnitIds: ["nazrin"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", cost: 1 },
          { unitId: "yoshika", unitType: "vanguard", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper prefers a frontline offer when its roster is backline-heavy", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 8,
        benchUnits: ["ranger"],
        benchUnitIds: ["clownpiece"],
        boardUnits: ["2:remilia", { cell: 4, unitType: "ranger", unitId: "clownpiece" }],
        bossShopOffers: [
          { unitId: "clownpiece", unitType: "ranger", cost: 2 },
          { unitId: "meiling", unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 1 },
      type: "prep_command",
    },
    ]);
  });

  test("prep phase boss helper counts string-serialized Meiling escorts before filling backline", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 4,
        specialUnitLevel: 7,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["2:remilia", "8:meiling", "14:meiling"],
        bossShopOffers: [],
        shopOffers: [
          { unitId: "yoshika", unitType: "vanguard", cost: 1 },
          { unitId: "utsuho", unitType: "mage", cost: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 3,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper stops buying reserve units once its main board cap is already full", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: [],
        boardSubUnits: ["30:sub", "31:sub", "33:sub"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitId: "yoshika", factionId: "shinreibyou" },
          { cell: 33, unitId: "tojiko", factionId: "shinreibyou" },
        ],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", factionId: "myourenji", cost: 1 },
          { unitId: "yoshika", unitType: "vanguard", factionId: "shinreibyou", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { ready: true },
        type: "ready",
      },
    ]);
  });

  test("prep phase raid helper still prioritizes raw strength before a faction is established", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: [],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitId: "yoshika", factionId: "shinreibyou" },
        ],
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", factionId: "myourenji", cost: 1 },
          { unitId: "yoshika", unitType: "vanguard", factionId: "shinreibyou", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper plans around bench units that can complete a faction tier", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 2,
        benchUnits: ["ranger"],
        benchUnitIds: ["megumu"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitId: "tsukasa", factionId: "kou_ryuudou" },
          { cell: 32, unitId: "momoyo", factionId: "kou_ryuudou" },
        ],
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", factionId: "myourenji", cost: 1 },
          { unitId: "chimata", unitType: "mage", factionId: "kou_ryuudou", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper prefers a matching bench duplicate when upgrade odds outweigh small base-score gaps", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["reserve"],
        benchUnitIds: ["yoshika"],
        boardUnits: ["30:reimu"],
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", factionId: "myourenji", cost: 1 },
          { unitId: "yoshika", unitType: "vanguard", factionId: "shinreibyou", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper can upgrade a deployed board-token hero without a bench duplicate", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: [],
        boardUnits: ["30:reimu"],
        shopOffers: [
          { unitId: "nazrin", unitType: "ranger", factionId: "myourenji", cost: 1 },
          { unitId: "yoshika", unitType: "vanguard", factionId: "shinreibyou", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid upgrade helper keeps chasing a bench duplicate over an affordable higher-cost pivot", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      strategy: "upgrade",
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["reserve"],
        benchUnitIds: ["yoshika"],
        boardUnits: ["30:reimu"],
        shopOffers: [
          { unitId: "yoshika", unitType: "vanguard", factionId: "shinreibyou", cost: 1 },
          { unitId: "junko", unitType: "mage", factionId: "lunarian", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid high-cost helper pivots into an affordable higher-cost offer over a bench duplicate", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      strategy: "highCost",
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["reserve"],
        benchUnitIds: ["yoshika"],
        boardUnits: ["30:reimu"],
        shopOffers: [
          { unitId: "yoshika", unitType: "vanguard", factionId: "shinreibyou", cost: 1 },
          { unitId: "junko", unitType: "mage", factionId: "lunarian", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase last raid helper defaults into the high-cost route during mixed bot runs", () => {
    const raidPlayer = {
      ready: false,
      role: "raid",
      gold: 5,
      benchUnits: ["reserve"],
      benchUnitIds: ["yoshika"],
      boardUnits: ["30:reimu"],
      shopOffers: [
        { unitId: "yoshika", unitType: "vanguard", factionId: "shinreibyou", cost: 1 },
        { unitId: "junko", unitType: "mage", factionId: "lunarian", cost: 3 },
      ],
    };

    expect(buildAutoFillHelperActions({
      helperIndex: 3,
      sessionId: "p4",
      player: raidPlayer,
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        players: new Map([
          ["p1", { role: "raid" }],
          ["p2", { role: "boss" }],
          ["p3", { role: "raid" }],
          ["p4", { role: "raid" }],
        ]),
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep purchase phase buys a second raid unit before deploying the first one", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 4,
        benchUnits: ["nazrin"],
        benchUnitIds: ["nazrin"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitId: "yoshika", unitType: "vanguard", cost: 1, factionId: "shinreibyou" },
          { unitId: "rin", unitType: "vanguard", cost: 1, factionId: "chireiden" },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper still buys when only the hero is already on board", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        benchUnits: [],
        boardUnits: ["30:reimu"],
        shopOffers: [
          { unitType: "mage", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper still buys when only the boss is already on board", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [],
        boardUnits: ["2:remilia"],
        bossShopOffers: [
          { unitType: "assassin", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper keeps buying even if it was pre-readied in the lobby", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: true,
        role: "raid",
        benchUnits: [],
        boardUnits: ["30:reimu"],
        shopOffers: [
          { unitType: "mage", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper keeps placing even if it was pre-readied in the lobby", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: true,
        role: "boss",
        benchUnits: ["vanguard"],
        boardUnits: ["2:remilia"],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper places a frontline bench unit in front of Remilia", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["vanguard"],
        boardUnits: [],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper still places a purchased bench unit after the boss is already on board", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["vanguard"],
        boardUnits: ["2:remilia"],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper places a bench unit into a deterministic lower-half cell that avoids the default hero lane", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        benchUnits: ["ranger"],
        boardUnits: [],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 33,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper still places a purchased bench unit after the hero is already on board", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        benchUnits: ["ranger"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 33,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep purchase phase deploys bench units before buying more", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["ranger"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: {
          shopBuySlotIndex: 0,
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep deploy phase places bench units instead of buying more", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["ranger"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 33,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep deploy phase queues multiple deploys to fill the helper lane", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 1,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["ranger", "vanguard"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "mage", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 1,
            cell: 21,
          },
        },
        type: "prep_command",
      },
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 30,
            slot: "sub",
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep deploy phase uses sub slots for extra raid bench units after the main lane is full", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["assassin"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
          { cell: 25, unitType: "vanguard", unitId: "yoshika" },
          { cell: 19, unitType: "mage", unitId: "rin" },
        ],
        selectedHeroId: "reimu",
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 31,
            slot: "sub",
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep deploy phase prefers a sub slot after the first raid host is online", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["assassin"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
        ],
        selectedHeroId: "reimu",
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 31,
            slot: "sub",
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep deploy phase prefers sub slots before the third raid lane cell once two hosts are online", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["assassin"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
          { cell: 25, unitType: "vanguard", unitId: "yoshika" },
        ],
        selectedHeroId: "reimu",
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 31,
            slot: "sub",
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep deploy phase can use the hero host sub slot when the raid lane is already full", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["assassin"],
        boardUnits: [
          "30:reimu",
          { cell: 31, unitType: "ranger", unitId: "nazrin", subUnit: { unitType: "mage" } },
          { cell: 25, unitType: "vanguard", unitId: "yoshika", subUnit: { unitType: "assassin" } },
          { cell: 19, unitType: "mage", unitId: "rin", subUnit: { unitType: "ranger" } },
        ],
        boardSubUnits: [
          "31:mage",
          "25:assassin",
          "19:ranger",
        ],
        selectedHeroId: "reimu",
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 30,
            slot: "sub",
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep deploy phase prioritizes hero-exclusive pair sub attachment onto its hero host", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: ["vanguard", "vanguard"],
        benchUnitIds: ["yoshika", "mayumi"],
        boardUnits: [
          "30:keiki",
          { cell: 31, unitType: "ranger", unitId: "nazrin" },
        ],
        selectedHeroId: "keiki",
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 1,
            cell: 30,
            slot: "sub",
          },
        },
        type: "prep_command",
      },
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 31,
            slot: "sub",
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase raid helper buys another affordable unit when only part of its deploy lane is filled", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 5,
        benchUnits: [],
        boardUnits: ["30:reimu", "31:ranger"],
        shopOffers: [
          { unitType: "assassin", cost: 7 },
          { unitType: "mage", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("purchase phase refreshes a raid shop when nothing is affordable and reroll reserve remains", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 6,
        benchUnits: [],
        benchUnitIds: [],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "assassin", unitId: "miko", cost: 7 },
          { unitType: "mage", unitId: "hecatia", cost: 8 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
      },
    })).toEqual([
      {
        payload: { shopRefreshCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame bench-full raid helper can upgrade its hero before opening space for a high-cost reserve", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        specialUnitLevel: 5,
        gold: 5,
        benchUnits: ["vanguard", "vanguard", "ranger", "ranger", "mage", "vanguard", "ranger", "assassin"],
        benchUnitIds: ["yoshika", "rin", "wakasagihime", "momoyo", "tojiko", "kagerou", "megumu", "miko"],
        boardUnits: ["30:reimu"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "mage", unitId: "hecatia", factionId: "kanjuden", cost: 5 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame bench-full raid helper sells a weak bench unit for a hero-exclusive offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        specialUnitLevel: 5,
        gold: 5,
        benchUnits: ["vanguard", "vanguard", "ranger", "ranger", "mage", "vanguard", "ranger", "assassin"],
        benchUnitIds: ["yoshika", "rin", "wakasagihime", "momoyo", "tojiko", "kagerou", "megumu", "miko"],
        boardUnits: ["30:keiki"],
        selectedHeroId: "keiki",
        heroExclusiveShopOffers: [
          { unitType: "vanguard", unitId: "mayumi", cost: 3 },
        ],
        shopOffers: [],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { benchSellIndex: 4 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame strength raid helper pivots into a 4-cost offer over a cheap duplicate", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 6,
        specialUnitLevel: 5,
        benchUnits: ["vanguard", "ranger"],
        benchUnitIds: ["rin", "nazrin"],
        boardUnits: ["30:reimu", "31:yoshika"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "ranger", unitId: "nazrin", factionId: "myourenji", cost: 1 },
          { unitType: "vanguard", unitId: "junko", factionId: "kanjuden", cost: 4 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame strength raid helper upgrades its hero instead of rerolling past an unstacked 1-cost offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 8,
        specialUnitLevel: 5,
        benchUnits: ["vanguard", "ranger"],
        benchUnitIds: ["rin", "nazrin"],
        boardUnits: ["30:reimu", "31:yoshika"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "vanguard", unitId: "kagerou", factionId: "grassroot_network", cost: 1 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("midgame strength raid helper upgrades its hero instead of rerolling past an unstacked 2-cost offer", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 8,
        specialUnitLevel: 5,
        benchUnits: ["vanguard", "ranger", "mage"],
        benchUnitIds: ["rin", "nazrin", "megumu"],
        boardUnits: ["30:reimu", "31:yoshika", "25:tojiko"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "assassin", unitId: "sekibanki", factionId: "grassroot_network", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
        playerPhase: "purchase",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { specialUnitUpgradeCount: 1 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper places the next purchased unit into the next free deploy cell", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["assassin"],
        boardUnits: ["2:remilia", "4:vanguard"],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 10,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper places vanguards in front of Remilia", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["vanguard"],
        boardUnits: ["2:remilia"],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper deepens Remilia's direct guard lane when the direct guard cell is occupied", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["vanguard"],
        boardUnits: ["2:remilia", { cell: 8, unitType: "vanguard", unitId: "meiling" }],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 14,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("late boss helper moves a second direct guard onto a body flank", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 5 },
          { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 14, unitId: "junko", unitType: "vanguard", unitLevel: 4 },
          { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
        roundIndex: 11,
      },
    })).toEqual([
      {
        payload: {
          boardUnitMove: {
            fromCell: 14,
            toCell: 9,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("late boss helper keeps an occupied direct guard instead of opening the lane for a reserve", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [
          { unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
        ],
        benchUnitIds: ["meiling"],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 5 },
          { cell: 8, unitId: "yoshika", unitType: "vanguard", unitLevel: 2 },
          { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
        roundIndex: 11,
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 14,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("late boss helper moves the strongest existing guard into an open direct lane", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 5 },
          { cell: 9, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 14, unitId: "junko", unitType: "vanguard", unitLevel: 3 },
          { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
        roundIndex: 11,
      },
    })).toEqual([
      {
        payload: {
          boardUnitMove: {
            fromCell: 9,
            toCell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("late boss helper swaps a stronger existing guard into an occupied direct lane", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 5 },
          { cell: 8, unitId: "yoshika", unitType: "vanguard", unitLevel: 2 },
          { cell: 9, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
        roundIndex: 11,
      },
    })).toEqual([
      {
        payload: {
          boardUnitSwap: {
            fromCell: 9,
            toCell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("late boss helper prioritizes a stronger direct-guard swap before bench deployment", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [
          { unitId: "patchouli", unitType: "mage", unitLevel: 1 },
        ],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 5 },
          { cell: 8, unitId: "yoshika", unitType: "vanguard", unitLevel: 2 },
          { cell: 9, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 3, unitId: "sakuya", unitType: "assassin", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
        roundIndex: 11,
      },
    })).toEqual([
      {
        payload: {
          boardUnitSwap: {
            fromCell: 9,
            toCell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("boss body guard diagnostic explains a stronger direct-guard swap", () => {
    expect(buildBossBodyGuardDecisionDiagnostic({
      role: "boss",
      benchUnits: [],
      boardUnits: [
        { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 5 },
        { cell: 8, unitId: "yoshika", unitType: "vanguard", unitLevel: 2 },
        { cell: 9, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
        { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 4 },
      ],
      selectedBossId: "remilia",
    }, {
      roundIndex: 11,
      playerPhase: "deploy",
    })).toEqual(expect.objectContaining({
      decision: "direct_swap",
      reason: "stronger_board_guard",
      directGuardCell: 8,
      directGuardUnitId: "yoshika",
      directGuardLevel: 2,
      strongestGuardCell: 9,
      strongestGuardUnitId: "meiling",
      strongestGuardLevel: 7,
      actionFromCell: 9,
      actionToCell: 8,
      strongerOffDirect: true,
    }));
  });

  test("late boss helper reads tokenized board levels before swapping a direct guard", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [],
        boardUnits: [
          "2:boss:5",
          "8:vanguard:2",
          "9:vanguard:7",
          "3:mage:4",
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
        roundIndex: 11,
      },
    })).toEqual([
      {
        payload: {
          boardUnitSwap: {
            fromCell: 9,
            toCell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("midgame boss helper keeps a second direct guard in the lane", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: [],
        boardUnits: [
          { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 4 },
          { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 7 },
          { cell: 14, unitId: "junko", unitType: "vanguard", unitLevel: 4 },
          { cell: 3, unitId: "patchouli", unitType: "mage", unitLevel: 4 },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
        roundIndex: 8,
      },
    })).toEqual([
      {
        payload: { ready: true },
        type: "ready",
      },
    ]);
  });

  test("prep phase boss helper places Sakuya on a frontline flank instead of a backline slot", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["assassin"],
        benchUnitIds: ["sakuya"],
        boardUnits: ["2:remilia", { cell: 8, unitType: "vanguard", unitId: "meiling" }],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 7,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper keeps Sakuya off the weak right-front flank when the left-front flank is occupied", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["assassin"],
        benchUnitIds: ["sakuya"],
        boardUnits: [
          "2:remilia",
          { cell: 7, unitType: "mage", unitId: "byakuren" },
          { cell: 8, unitType: "vanguard", unitId: "meiling" },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 15,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper uses the direct guard lane for Sakuya before a deeper flank", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["assassin"],
        benchUnitIds: ["sakuya"],
        boardUnits: [
          "2:remilia",
          { cell: 7, unitType: "mage", unitId: "byakuren" },
        ],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 8,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper places backline support beside Remilia instead of the far flank", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["mage"],
        benchUnitIds: ["patchouli"],
        boardUnits: ["2:remilia", { cell: 8, unitType: "vanguard", unitId: "meiling" }],
        selectedBossId: "remilia",
      },
      state: {
        phase: "Prep",
        playerPhase: "deploy",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 3,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper can keep filling a six-unit shared-board lane", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        benchUnits: ["assassin"],
        boardUnits: ["2:remilia", "4:vanguard", "10:ranger", "16:mage", "1:assassin", "7:mage"],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 0,
            cell: 3,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase waits until the helper role is known", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "unassigned",
        benchUnits: ["assassin"],
        boardUnits: [],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([]);
  });

  test("prep phase raid helper readies instead of buying reserve units when its deploy lane is full", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: 9,
        benchUnits: [],
        boardSubUnits: ["30:sub", "31:sub", "25:sub", "19:sub"],
        boardUnits: ["30:reimu", "31:ranger", "25:mage", "19:assassin"],
        selectedHeroId: "reimu",
        shopOffers: [
          { unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { ready: true },
        type: "ready",
      },
    ]);
  });

  test("prep phase boss helper readies after buying a reserve unit once the deploy lane stays full", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "boss",
        gold: 5,
        benchUnits: ["assassin"],
        boardUnits: ["2:remilia", "4:vanguard", "10:ranger", "16:mage", "1:assassin", "7:mage", "13:ranger"],
        bossShopOffers: [
          { unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { ready: true },
        type: "ready",
      },
    ]);
  });

  test("prep phase bootstrap owns the unknown-gold first buy path", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: Number.NaN,
        benchUnits: [],
        boardUnits: ["30:reimu"],
        shopOffers: [
          { unitType: "vanguard", cost: 2 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([
      {
        payload: { shopBuySlotIndex: 0 },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase does not auto-ready after the first purchased unit when gold is still unknown", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 0,
      player: {
        ready: false,
        role: "raid",
        gold: Number.NaN,
        benchUnits: [],
        boardUnits: ["30:reimu", "31:vanguard"],
        shopOffers: [
          { unitType: "mage", cost: 3 },
        ],
      },
      state: {
        phase: "Prep",
      },
    })).toEqual([]);
  });

  test("already-selected and ready helpers stay idle", () => {
    expect(buildAutoFillHelperActions({
      helperIndex: 2,
      player: {
        ready: true,
        role: "raid",
        selectedHeroId: AUTO_FILL_HERO_IDS[2]!,
      },
      state: {
        featureFlagsEnableTouhouRoster: true,
        lobbyStage: "selection",
        phase: "Waiting",
      },
    })).toEqual([]);
  });
});
