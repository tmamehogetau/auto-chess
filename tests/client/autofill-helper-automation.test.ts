import { describe, expect, test } from "vitest";

import {
  AUTO_FILL_BOSS_ID,
  AUTO_FILL_HERO_IDS,
  buildAutoFillHelperActions,
  resolveAutoFillHelperPlayerPhase,
} from "../../src/client/autofill-helper-automation.js";

describe("autofill helper automation", () => {
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

  test("prep phase boss helper prefers patchouli over other affordable boss offers", () => {
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
        payload: { bossShopBuySlotIndex: 1 },
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

  test("prep phase boss helper can buy from the normal shop when it outranks boss-only offers", () => {
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
          { unitId: "tsukasa", unitType: "mage", cost: 2 },
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

  test("prep phase raid helper still prioritizes raw strength when the duplicate signal is absent from bench", () => {
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
        payload: { shopBuySlotIndex: 0 },
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
            cell: 16,
          },
        },
        type: "prep_command",
      },
    ]);
  });

  test("prep phase boss helper places a bench unit into the upper half", () => {
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
            cell: 16,
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
            cell: 16,
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

  test("prep phase boss helper places vanguards in front of backliners", () => {
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
            cell: 16,
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
