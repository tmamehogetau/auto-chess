import { beforeEach, describe, expect, test } from "vitest";

import {
  renderPlayerPrepSummary,
  renderPlayerResultSummary,
} from "../../src/client/player-surface-renderers.js";

class FakeClassList {
  private readonly owner: FakeElement;

  public constructor(owner: FakeElement) {
    this.owner = owner;
  }

  public add(...tokens: string[]): void {
    for (const token of tokens) {
      if (token.length === 0) {
        continue;
      }

      const current = this.owner.className.split(" ").filter((entry) => entry.length > 0);
      if (!current.includes(token)) {
        current.push(token);
      }
      this.owner.className = current.join(" ");
    }
  }

  public remove(...tokens: string[]): void {
    const current = this.owner.className.split(" ").filter((entry) => entry.length > 0);
    this.owner.className = current.filter((entry) => !tokens.includes(entry)).join(" ");
  }

  public toggle(token: string, force?: boolean): boolean {
    const current = this.owner.className.split(" ").filter((entry) => entry.length > 0);
    const has = current.includes(token);
    const shouldHave = force ?? !has;

    if (shouldHave && !has) {
      current.push(token);
    }

    this.owner.className = shouldHave
      ? current.join(" ")
      : current.filter((entry) => entry !== token).join(" ");

    return shouldHave;
  }
}

class FakeElement {
  public className = "";
  public dataset: Record<string, string> = {};
  public textContent = "";
  public disabled = false;
  public classList: FakeClassList;
  private innerHtmlValue = "";

  public constructor() {
    this.classList = new FakeClassList(this);
  }

  public get innerHTML(): string {
    return this.innerHtmlValue;
  }

  public set innerHTML(value: string) {
    this.innerHtmlValue = value;
  }
}

class FakeButtonElement extends FakeElement {}

describe("player surface renderers", () => {
  beforeEach(() => {
    globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
    globalThis.HTMLButtonElement = FakeButtonElement as unknown as typeof HTMLButtonElement;
  });

  test("prep summary renders player-facing economy and ready copy", () => {
    const boardCopyElement = new FakeElement();
    const shopCopyElement = new FakeElement();
    const benchCopyElement = new FakeElement();
    const readyCopyElement = new FakeElement();
    const shopSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());
    const boardCellElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      boardCopyElement: boardCopyElement as unknown as HTMLElement,
      shopCopyElement: shopCopyElement as unknown as HTMLElement,
      benchCopyElement: benchCopyElement as unknown as HTMLElement,
      shopSlotElements: shopSlotElements as unknown as HTMLButtonElement[],
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      readyCopyElement: readyCopyElement as unknown as HTMLElement,
      boardCellElements: boardCellElements as unknown as HTMLButtonElement[],
      state: {
        phase: "Prep",
        players: {
          p1: { ready: false },
          p2: { ready: true },
        },
      },
      player: {
        ready: false,
        gold: 8,
        shopOffers: [
          { unitType: "mage", cost: 3, displayName: "パチュリー" },
          { unitType: "vanguard", cost: 2, displayName: "美鈴" },
        ],
        benchUnits: ["vanguard-player-1-1", "mage-player-1-2"],
      },
      currentPhase: "Prep",
      selectedBenchIndex: 1,
    });

    expect(shopCopyElement.textContent).toContain("8G");
    expect(shopCopyElement.textContent).toContain("購入");
    expect(benchCopyElement.textContent).toContain("2 / 9");
    expect(benchCopyElement.textContent).toContain("Bench 2");
    expect(readyCopyElement.textContent).toContain("One player is still setting up");
    expect(shopSlotElements[0]?.textContent).toContain("パチュリー");
    expect(benchSlotElements[1]?.className).toContain("selected");
  });

  test("prep summary renders iterable schema-like shop and bench collections", () => {
    const shopCopyElement = new FakeElement();
    const benchCopyElement = new FakeElement();
    const shopSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      shopCopyElement: shopCopyElement as unknown as HTMLElement,
      benchCopyElement: benchCopyElement as unknown as HTMLElement,
      shopSlotElements: shopSlotElements as unknown as HTMLButtonElement[],
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        gold: 12,
        shopOffers: {
          [Symbol.iterator]: function* iterateOffers() {
            yield { unitType: "mage", cost: 3, displayName: "パチュリー" };
            yield { unitType: "vanguard", cost: 2, displayName: "美鈴" };
          },
        },
        benchUnits: {
          [Symbol.iterator]: function* iterateBench() {
            yield "vanguard-player-1-1";
            yield "mage-player-1-2";
          },
        },
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(shopCopyElement.textContent).toContain("12G");
    expect(shopCopyElement.textContent).toContain("購入");
    expect(shopSlotElements[0]?.textContent).toContain("パチュリー");
    expect(benchCopyElement.textContent).toContain("2 / 9");
    expect(benchSlotElements[0]?.textContent).toContain("vanguard");
  });

  test("prep summary renders boss shop, room summary, and deadline copy when provided", () => {
    const shopCopyElement = new FakeElement();
    const bossShopCopyElement = new FakeElement();
    const roomCopyElement = new FakeElement();
    const deadlineCopyElement = new FakeElement();
    const bossShopSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      shopCopyElement: shopCopyElement as unknown as HTMLElement,
      bossShopCopyElement: bossShopCopyElement as unknown as HTMLElement,
      bossShopSlotElements: bossShopSlotElements as unknown as HTMLButtonElement[],
      roomCopyElement: roomCopyElement as unknown as HTMLElement,
      deadlineCopyElement: deadlineCopyElement as unknown as HTMLElement,
      state: {
        phase: "Prep",
        prepDeadlineAtMs: Date.now() + 15_000,
        sharedBoardMode: "half-shared",
        featureFlagsEnableBossExclusiveShop: true,
        bossPlayerId: "boss-player",
      },
      player: {
        role: "boss",
        gold: 19,
        level: 3,
        xp: 2,
        hp: 88,
        remainingLives: 2,
        bossShopOffers: [
          { unitType: "mage", cost: 5, displayName: "パチュリー" },
        ],
      },
      roomSummary: {
        roomId: "room-123",
        sharedBoardRoomId: "shared-456",
      },
      deadlineSummary: {
        label: "Prep deadline",
        valueText: "15s remaining",
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
      sessionId: "boss-player",
    });

    expect(shopCopyElement.textContent).toContain("19G");
    expect(shopCopyElement.textContent).toContain("LV 3");
    expect(shopCopyElement.textContent).toContain("HP 88");
    expect(bossShopCopyElement.textContent).toContain("Boss shop");
    expect(bossShopCopyElement.textContent).toContain("5G");
    expect(bossShopSlotElements[0]?.textContent).toContain("パチュリー");
    expect(roomCopyElement.textContent).toContain("room-123");
    expect(roomCopyElement.textContent).toContain("shared-456");
    expect(deadlineCopyElement.textContent).toContain("Prep deadline");
    expect(deadlineCopyElement.textContent).toContain("15s remaining");
  });

  test("prep summary prefers benchDisplayNames when available", () => {
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        benchUnits: ["vanguard-player-1-1", "mage-player-1-2"],
        benchDisplayNames: ["紅美鈴", "パチュリー・ノーレッジ"],
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(benchSlotElements[0]?.textContent).toContain("紅美鈴");
    expect(benchSlotElements[1]?.textContent).toContain("パチュリー・ノーレッジ");
  });

  test("result summary shows phase hp, battle result, and next-round guidance", () => {
    const resultSurfaceElement = new FakeElement();

    renderPlayerResultSummary({
      resultSurfaceElement: resultSurfaceElement as unknown as HTMLElement,
      state: {
        phase: "Settle",
        roundIndex: 2,
        bossPlayerId: "boss-1",
        raidPlayerIds: ["raid-1", "raid-2", "raid-3"],
        ranking: ["boss-1", "raid-1", "raid-2", "raid-3"],
        players: {
          "boss-1": { lastBattleResult: { damageDealt: 22 } },
          "raid-1": { lastBattleResult: { damageDealt: 8 } },
          "raid-2": { lastBattleResult: { damageDealt: 15 } },
        },
      },
      player: {
        lastBattleResult: {
          won: false,
          damageDealt: 8,
          damageTaken: 12,
          survivors: 1,
          opponentSurvivors: 4,
          survivorSnapshots: [
            {
              unitId: "koishi",
              displayName: "古明地こいし",
              unitType: "assassin",
              hp: 27,
              maxHp: 60,
              sharedBoardCellIndex: 5,
            },
          ],
        },
      },
      phaseHpProgress: {
        targetHp: 600,
        damageDealt: 150,
        completionRate: 0.25,
        result: "failed",
      },
      sessionId: "raid-1",
    });

    expect(resultSurfaceElement.innerHTML).toContain("Boss held this phase");
    expect(resultSurfaceElement.innerHTML).toContain("Round 3: read the result and fix one weak position");
    expect(resultSurfaceElement.innerHTML).toContain("💀 DEFEAT");
    expect(resultSurfaceElement.innerHTML).toContain("trailed by 14 damage");
    expect(resultSurfaceElement.innerHTML).toContain("Surviving Units");
    expect(resultSurfaceElement.innerHTML).toContain("古明地こいし");
    expect(resultSurfaceElement.innerHTML).toContain("27 / 60");
  });

  test("result summary stamps survivor hp onto a shared-board imprint", () => {
    const resultSurfaceElement = new FakeElement();

    renderPlayerResultSummary({
      resultSurfaceElement: resultSurfaceElement as unknown as HTMLElement,
      state: {
        phase: "Settle",
        roundIndex: 2,
        players: {},
      },
      player: {
        lastBattleResult: {
          won: true,
          damageDealt: 18,
          damageTaken: 3,
          survivors: 1,
          opponentSurvivors: 0,
          survivorSnapshots: [
            {
              unitId: "koishi",
              displayName: "古明地こいし",
              unitType: "assassin",
              hp: 27,
              maxHp: 60,
              sharedBoardCellIndex: 5,
            },
          ],
        },
      },
      sessionId: "raid-1",
    });

    expect(resultSurfaceElement.innerHTML).toContain("Shared-board Imprint");
    expect(resultSurfaceElement.innerHTML).toContain("Battle end-state on the 6x6 shared board.");
    expect(resultSurfaceElement.innerHTML).toContain("古明地こいし");
    expect(resultSurfaceElement.innerHTML).toContain("27 / 60");
    expect((resultSurfaceElement.innerHTML.match(/data-result-imprint-cell="/g) ?? []).length).toBe(36);
    expect(resultSurfaceElement.innerHTML).not.toContain("center lane");
  });

  test("result summary derives shared-board imprint from timeline end-state without survivor snapshots", () => {
    const resultSurfaceElement = new FakeElement();

    renderPlayerResultSummary({
      resultSurfaceElement: resultSurfaceElement as unknown as HTMLElement,
      state: {
        phase: "Settle",
        roundIndex: 3,
        players: {},
      },
      player: {
        lastBattleResult: {
          won: true,
          damageDealt: 21,
          damageTaken: 6,
          survivors: 1,
          opponentSurvivors: 0,
          timelineEvents: [
            JSON.stringify({
              type: "battleStart",
              battleId: "battle-raid-3",
              round: 3,
              boardConfig: { width: 6, height: 6 },
              units: [
                {
                  battleUnitId: "raid-vanguard-1",
                  side: "raid",
                  x: 0,
                  y: 5,
                  currentHp: 20,
                  maxHp: 20,
                },
                {
                  battleUnitId: "boss-ranger-1",
                  side: "boss",
                  x: 0,
                  y: 0,
                  currentHp: 18,
                  maxHp: 18,
                },
              ],
            }),
            JSON.stringify({
              type: "move",
              battleId: "battle-raid-3",
              atMs: 120,
              battleUnitId: "raid-vanguard-1",
              from: { x: 0, y: 5 },
              to: { x: 1, y: 4 },
            }),
            JSON.stringify({
              type: "damageApplied",
              battleId: "battle-raid-3",
              atMs: 160,
              sourceBattleUnitId: "boss-ranger-1",
              targetBattleUnitId: "raid-vanguard-1",
              amount: 6,
              remainingHp: 14,
            }),
            JSON.stringify({
              type: "unitDeath",
              battleId: "battle-raid-3",
              atMs: 180,
              battleUnitId: "boss-ranger-1",
            }),
            JSON.stringify({
              type: "battleEnd",
              battleId: "battle-raid-3",
              atMs: 250,
              winner: "raid",
            }),
          ],
        },
      },
      sessionId: "raid-1",
    });

    expect(resultSurfaceElement.innerHTML).toContain("Shared-board Imprint");
    expect(resultSurfaceElement.innerHTML).toContain("Battle end-state on the 6x6 shared board.");
    expect(resultSurfaceElement.innerHTML).toContain('data-result-imprint-cell="25"');
    expect(resultSurfaceElement.innerHTML).toContain("vanguard");
    expect(resultSurfaceElement.innerHTML).toContain("14 / 20");
  });

  test("result summary prefers compact timeline end-state when present", () => {
    const resultSurfaceElement = new FakeElement();

    renderPlayerResultSummary({
      resultSurfaceElement: resultSurfaceElement as unknown as HTMLElement,
      state: {
        phase: "Settle",
        roundIndex: 3,
        players: {},
      },
      player: {
        lastBattleResult: {
          won: true,
          damageDealt: 21,
          damageTaken: 6,
          survivors: 1,
          opponentSurvivors: 0,
          timelineEndState: [
            {
              battleUnitId: "raid-vanguard-1",
              side: "raid",
              x: 1,
              y: 4,
              currentHp: 14,
              maxHp: 20,
              displayName: "前衛",
              unitType: "vanguard",
            },
          ],
        },
      },
      sessionId: "raid-1",
    });

    expect(resultSurfaceElement.innerHTML).toContain("Shared-board Imprint");
    expect(resultSurfaceElement.innerHTML).toContain('data-result-imprint-cell="25"');
    expect(resultSurfaceElement.innerHTML).toContain("前衛");
    expect(resultSurfaceElement.innerHTML).toContain("14 / 20");
  });

  test("result summary reads iterable ranking and raid members for final judgment", () => {
    const resultSurfaceElement = new FakeElement();

    renderPlayerResultSummary({
      resultSurfaceElement: resultSurfaceElement as unknown as HTMLElement,
      state: {
        phase: "End",
        roundIndex: 4,
        bossPlayerId: "boss-1",
        raidPlayerIds: {
          [Symbol.iterator]: function* iterateRaidPlayers() {
            yield "raid-1";
            yield "raid-2";
            yield "raid-3";
          },
        },
        ranking: {
          [Symbol.iterator]: function* iterateRanking() {
            yield "raid-2";
            yield "boss-1";
            yield "raid-1";
          },
        },
        players: {},
      },
      player: {
        lastBattleResult: {
          won: true,
          damageDealt: 22,
          damageTaken: 8,
          survivors: 3,
          opponentSurvivors: 0,
        },
      },
      sessionId: "raid-2",
    });

    expect(resultSurfaceElement.innerHTML).toContain("Final Judgment: Raid Victory");
  });
});
