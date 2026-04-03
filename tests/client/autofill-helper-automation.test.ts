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
        selectedHeroId: AUTO_FILL_HERO_IDS[1]!,
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
          benchToBoardCell: {
            benchIndex: 0,
            cell: 33,
          },
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
        selectedHeroId: AUTO_FILL_HERO_IDS[1]!,
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
            cell: 33,
          },
        },
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
      },
    })).toEqual([
      {
        payload: { bossShopBuySlotIndex: 1 },
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
            cell: 4,
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
            cell: 4,
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
            cell: 4,
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
          benchToBoardCell: {
            benchIndex: 0,
            cell: 33,
          },
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
            benchIndex: 0,
            cell: 33,
          },
        },
        type: "prep_command",
      },
      {
        payload: {
          benchToBoardCell: {
            benchIndex: 1,
            cell: 27,
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
        boardUnits: ["30:reimu", "31:ranger", "25:mage", "19:assassin"],
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
        boardUnits: ["2:remilia", "4:vanguard", "10:ranger", "16:mage"],
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
