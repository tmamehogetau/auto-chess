import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  renderPlayerLobbySummary,
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
  public onclick: (() => void) | null = null;
  public onmouseenter: (() => void) | null = null;
  public onmouseleave: (() => void) | null = null;
  public onfocus: (() => void) | null = null;
  public onblur: (() => void) | null = null;
  public classList: FakeClassList;
  public children: FakeElement[] = [];
  public attributes: Record<string, string> = {};
  private innerHtmlValue = "";

  public constructor() {
    this.classList = new FakeClassList(this);
  }

  public get innerHTML(): string {
    return this.innerHtmlValue;
  }

  public set innerHTML(value: string) {
    this.innerHtmlValue = value;
    if (value === "") {
      this.children = [];
    }
  }

  public appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  public append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  public setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
}

class FakeButtonElement extends FakeElement {}

describe("player surface renderers", () => {
  let originalDocument: typeof globalThis.document;
  let originalHTMLElement: typeof globalThis.HTMLElement | undefined;
  let originalHTMLButtonElement: typeof globalThis.HTMLButtonElement | undefined;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalHTMLElement = globalThis.HTMLElement;
    originalHTMLButtonElement = globalThis.HTMLButtonElement;
    globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
    globalThis.HTMLButtonElement = FakeButtonElement as unknown as typeof HTMLButtonElement;
    globalThis.document = {
      createElement: () => new FakeElement(),
    } as unknown as Document;
  });

  afterEach(() => {
    if (originalDocument === undefined) {
      delete (globalThis as { document?: typeof globalThis.document }).document;
    } else {
      globalThis.document = originalDocument;
    }

    if (originalHTMLElement === undefined) {
      delete (globalThis as { HTMLElement?: typeof globalThis.HTMLElement }).HTMLElement;
    } else {
      globalThis.HTMLElement = originalHTMLElement;
    }

    if (originalHTMLButtonElement === undefined) {
      delete (globalThis as { HTMLButtonElement?: typeof globalThis.HTMLButtonElement }).HTMLButtonElement;
    } else {
      globalThis.HTMLButtonElement = originalHTMLButtonElement;
    }
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

  test("lobby summary shows remaining seats when the room is not full yet", () => {
    const participantSummaryElement = new FakeElement();

    renderPlayerLobbySummary({
      participantSummaryElement: participantSummaryElement as unknown as HTMLElement,
      state: {
        maxPlayers: 4,
        players: {
          p1: { ready: true },
          p2: { ready: true },
        },
      },
    });

    expect(participantSummaryElement.textContent).toContain("2 / 4 ready");
    expect(participantSummaryElement.textContent).toContain("あと 2 人の参加待ち");
  });

  test("lobby summary does not imply a host-start flow once the room is full", () => {
    const participantSummaryElement = new FakeElement();

    renderPlayerLobbySummary({
      participantSummaryElement: participantSummaryElement as unknown as HTMLElement,
      state: {
        maxPlayers: 4,
        players: {
          p1: { ready: true },
          p2: { ready: false },
          p3: { ready: true },
          p4: { ready: false },
        },
      },
    });

    expect(participantSummaryElement.textContent).toContain("2 / 4 ready");
    expect(participantSummaryElement.textContent).not.toContain("進行役の開始待ち");
    expect(participantSummaryElement.textContent).toContain("role selection");
  });

  test("prep summary renders boss shop, room summary, and deadline copy when provided", () => {
    const shopCopyElement = new FakeElement();
    const bossShopCopyElement = new FakeElement();
    const heroUpgradeCopyElement = new FakeElement();
    const refreshCopyElement = new FakeElement();
    const roomCopyElement = new FakeElement();
    const deadlineCopyElement = new FakeElement();
    const bossShopSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      shopCopyElement: shopCopyElement as unknown as HTMLElement,
      bossShopCopyElement: bossShopCopyElement as unknown as HTMLElement,
      heroUpgradeCopyElement: heroUpgradeCopyElement as unknown as HTMLElement,
      refreshCopyElement: refreshCopyElement as unknown as HTMLElement,
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
    expect(heroUpgradeCopyElement.textContent).toContain("主人公強化");
    expect(heroUpgradeCopyElement.textContent).toContain("LV 3");
    expect(refreshCopyElement.textContent).toContain("リロード");
    expect(bossShopCopyElement.textContent).toContain("Boss shop");
    expect(bossShopCopyElement.textContent).toContain("5G");
    expect(bossShopSlotElements[0]?.textContent).toContain("パチュリー");
    expect(roomCopyElement.textContent).toContain("room-123");
    expect(roomCopyElement.textContent).toContain("shared-456");
    expect(deadlineCopyElement.textContent).toContain("Prep deadline");
    expect(deadlineCopyElement.textContent).toContain("15s remaining");
  });

  test("prep summary renders purchase shop entries with icons for the four-section shop surface", () => {
    const shopSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      shopSlotElements: shopSlotElements as unknown as HTMLButtonElement[],
      player: {
        gold: 8,
        shopOffers: [
          { unitType: "mage", cost: 3, displayName: "パチュリー" },
          { unitType: "vanguard", cost: 2, displayName: "美鈴" },
        ],
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(shopSlotElements[0]?.textContent).toContain("✨");
    expect(shopSlotElements[0]?.textContent).toContain("パチュリー");
    expect(shopSlotElements[1]?.textContent).toContain("🛡️");
    expect(shopSlotElements[1]?.textContent).toContain("美鈴");
  });

  test("prep summary renders special unit, spell, and synergies", () => {
    const specialUnitCopyElement = new FakeElement();
    const spellCopyElement = new FakeElement();
    const synergyCopyElement = new FakeElement();

    renderPlayerPrepSummary({
      specialUnitCopyElement: specialUnitCopyElement as unknown as HTMLElement,
      spellCopyElement: spellCopyElement as unknown as HTMLElement,
      synergyCopyElement: synergyCopyElement as unknown as HTMLElement,
      state: {
        phase: "Prep",
        featureFlagsEnableHeroSystem: true,
        featureFlagsEnableSpellCard: true,
        declaredSpellId: "instant-1",
        usedSpellIds: ["area-1"],
        players: {},
      },
      player: {
        role: "raid",
        selectedHeroId: "reimu",
        activeSynergies: [{ unitType: "mage", count: 2, tier: 1 }],
      },
      sessionId: "raid-1",
      currentPhase: "Prep",
      selectedBenchIndex: 0,
    });

    expect(specialUnitCopyElement.textContent).toContain("霊夢");
    expect(spellCopyElement.textContent).toContain("スカーレットシュート");
    expect(spellCopyElement.textContent).toContain("used");
    expect(synergyCopyElement.textContent).toContain("mage x2");
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

  test("prep summary renders idle guidance in the left detail card when nothing is hovered", () => {
    const detailCardElement = new FakeElement();

    renderPlayerPrepSummary({
      detailCardElement: detailCardElement as unknown as HTMLElement,
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(detailCardElement.innerHTML).toContain("Unit Detail");
    expect(detailCardElement.innerHTML).toContain("hover");
  });

  test("prep summary renders hovered hero detail in the same left detail card", () => {
    const detailCardElement = new FakeElement();

    renderPlayerPrepSummary({
      detailCardElement: detailCardElement as unknown as HTMLElement,
      hoverDetail: {
        kicker: "Your Hero",
        title: "霊夢",
        lines: ["balance", "HP 120", "ATK 18"],
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(detailCardElement.innerHTML).toContain("霊夢");
    expect(detailCardElement.innerHTML).toContain("HP 120");
    expect(detailCardElement.innerHTML).toContain("ATK 18");
  });

  test("prep summary adds Matara Okina exception copy to hero detail", () => {
    const allyRailElement = new FakeElement();
    const hoverCalls: unknown[] = [];

    renderPlayerPrepSummary({
      allyRailElement: allyRailElement as unknown as HTMLElement,
      onHoverDetailChange: (detail: unknown) => {
        hoverCalls.push(detail);
      },
      state: {
        phase: "Prep",
        players: {
          "raid-1": {
            selectedHeroId: "okina",
          },
        },
      },
      player: {
        role: "raid",
        selectedHeroId: "okina",
      },
      sessionId: "raid-1",
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    const selfHeroChip = allyRailElement.children.find((child) => child.dataset.hoverDetailTarget === "self-hero");
    expect(selfHeroChip).toBeDefined();

    selfHeroChip?.onmouseenter?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({
        title: "隠岐奈",
        lines: expect.arrayContaining(["他の自軍 unit の sub slot に入れます。"]),
      }),
    ]);
  });

  test("prep summary wires player hero, ally hero, and ally bench hover targets into one detail callback", () => {
    const allyRailElement = new FakeElement();
    const hoverCalls: unknown[] = [];

    renderPlayerPrepSummary({
      allyRailElement: allyRailElement as unknown as HTMLElement,
      onHoverDetailChange: (detail: unknown) => {
        hoverCalls.push(detail);
      },
      state: {
        phase: "Prep",
        players: {
          "raid-1": {
            selectedHeroId: "reimu",
            benchUnits: ["vanguard"],
            benchDisplayNames: ["紅美鈴"],
          },
          "ally-2": {
            selectedHeroId: "marisa",
            benchUnits: ["mage"],
            benchDisplayNames: ["パチュリー・ノーレッジ"],
          },
        },
      },
      player: {
        role: "raid",
        selectedHeroId: "reimu",
      },
      sessionId: "raid-1",
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    const selfHeroChip = allyRailElement.children.find((child) => child.dataset.hoverDetailTarget === "self-hero");
    const allyHeroChip = allyRailElement.children.find((child) => child.dataset.hoverDetailTarget === "ally-hero");
    const allyBenchChip = allyRailElement.children.find((child) => child.dataset.hoverDetailTarget === "ally-bench");

    expect(selfHeroChip).toBeDefined();
    expect(allyHeroChip).toBeDefined();
    expect(allyBenchChip).toBeDefined();

    selfHeroChip?.onmouseenter?.();
    allyHeroChip?.onmouseenter?.();
    allyBenchChip?.onmouseenter?.();
    allyBenchChip?.onmouseleave?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({ title: "霊夢" }),
      expect.objectContaining({ title: "魔理沙" }),
      expect.objectContaining({ title: "パチュリー・ノーレッジ" }),
      null,
    ]);
  });

  test("prep summary exposes hover detail from keyboard focus too", () => {
    const allyRailElement = new FakeElement();
    const hoverCalls: unknown[] = [];

    renderPlayerPrepSummary({
      allyRailElement: allyRailElement as unknown as HTMLElement,
      onHoverDetailChange: (detail: unknown) => {
        hoverCalls.push(detail);
      },
      state: {
        phase: "Prep",
        players: {
          "raid-1": {
            selectedHeroId: "reimu",
          },
        },
      },
      player: {
        role: "raid",
        selectedHeroId: "reimu",
      },
      sessionId: "raid-1",
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    const selfHeroChip = allyRailElement.children.find((child) => child.dataset.hoverDetailTarget === "self-hero");
    selfHeroChip?.onfocus?.();
    selfHeroChip?.onblur?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({ title: "霊夢" }),
      null,
    ]);
  });

  test("prep summary labels boss-side chips with boss-specific kickers", () => {
    const allyRailElement = new FakeElement();
    const hoverCalls: unknown[] = [];

    renderPlayerPrepSummary({
      allyRailElement: allyRailElement as unknown as HTMLElement,
      onHoverDetailChange: (detail: unknown) => {
        hoverCalls.push(detail);
      },
      state: {
        phase: "Prep",
        players: {
          "boss-1": {
            role: "boss",
            selectedBossId: "remilia",
          },
          "raid-2": {
            role: "raid",
            selectedHeroId: "marisa",
          },
        },
      },
      player: {
        role: "boss",
        selectedBossId: "remilia",
      },
      sessionId: "boss-1",
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    const selfChip = allyRailElement.children.find((child) => child.dataset.hoverDetailTarget === "self-hero");
    const allyChip = allyRailElement.children.find((child) => child.dataset.hoverDetailTarget === "ally-hero");

    selfChip?.onmouseenter?.();
    allyChip?.onmouseenter?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({
        kicker: "Your Boss",
        title: "レミリア",
      }),
      expect.objectContaining({
        kicker: "Ally Hero",
        title: "魔理沙",
      }),
    ]);
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
