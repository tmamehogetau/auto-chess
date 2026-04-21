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
  public hidden = false;
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

function findDescendantByClass(root: FakeElement | undefined, className: string): FakeElement | null {
  if (!root) {
    return null;
  }

  const classes = root.className.split(" ").filter((entry) => entry.length > 0);
  if (classes.includes(className)) {
    return root;
  }

  for (const child of root.children) {
    const found = findDescendantByClass(child, className);
    if (found) {
      return found;
    }
  }

  return null;
}

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
    expect(benchCopyElement.textContent).toContain("2 / 8");
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
    expect(benchCopyElement.textContent).toContain("2 / 8");
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
        specialUnitLevel: 3,
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
    expect(heroUpgradeCopyElement.textContent).toContain("ボス強化");
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

  test("prep summary renders raid hero-exclusive shop copy and slot when offers are present", () => {
    const heroExclusiveShopElement = new FakeElement();
    const heroExclusiveShopCopyElement = new FakeElement();
    const heroExclusiveShopSlotElements = Array.from({ length: 1 }, () => new FakeButtonElement());
    const player: Parameters<typeof renderPlayerPrepSummary>[0]["player"] = {
      role: "raid",
      ready: false,
      selectedHeroId: "keiki",
      gold: 9,
      heroExclusiveShopOffers: [
        { unitType: "vanguard", cost: 3, rarity: 3, unitId: "mayumi", displayName: "杖刀偶磨弓" },
      ],
    };

    renderPlayerPrepSummary({
      heroExclusiveShopElement: heroExclusiveShopElement as unknown as HTMLElement,
      heroExclusiveShopCopyElement: heroExclusiveShopCopyElement as unknown as HTMLElement,
      heroExclusiveShopSlotElements: heroExclusiveShopSlotElements as unknown as HTMLButtonElement[],
      state: {
        featureFlagsEnableHeroSystem: true,
      },
      player,
      currentPhase: "Prep",
      playerFacingPhase: "purchase",
      selectedBenchIndex: null,
    });

    expect(heroExclusiveShopElement.hidden).toBe(false);
    expect(heroExclusiveShopCopyElement.textContent).toContain("EXCLUSIVE");
    expect(heroExclusiveShopCopyElement.textContent).toContain("通常配置可能");
    expect(heroExclusiveShopCopyElement.textContent).toContain("main/sub");
    expect(heroExclusiveShopSlotElements[0]?.textContent).toContain("杖刀偶磨弓");
    expect(heroExclusiveShopSlotElements[0]?.textContent).toContain("3G");
    expect(heroExclusiveShopSlotElements[0]?.disabled).toBe(false);
  });

  test("prep summary hides raid hero-exclusive shop when no hero is selected", () => {
    const heroExclusiveShopElement = new FakeElement();
    const heroExclusiveShopCopyElement = new FakeElement();
    const player: Parameters<typeof renderPlayerPrepSummary>[0]["player"] = {
      role: "raid",
      gold: 9,
      selectedHeroId: "",
      heroExclusiveShopOffers: [],
    };

    renderPlayerPrepSummary({
      heroExclusiveShopElement: heroExclusiveShopElement as unknown as HTMLElement,
      heroExclusiveShopCopyElement: heroExclusiveShopCopyElement as unknown as HTMLElement,
      state: {
        featureFlagsEnableHeroSystem: true,
      },
      player,
      currentPhase: "Prep",
      playerFacingPhase: "purchase",
      selectedBenchIndex: null,
    });

    expect(heroExclusiveShopElement.hidden).toBe(true);
    expect(heroExclusiveShopCopyElement.textContent).toContain("主人公選択後");
  });

  test("prep summary hides raid hero-exclusive shop when the hero system flag is disabled", () => {
    const heroExclusiveShopElement = new FakeElement();
    const heroExclusiveShopCopyElement = new FakeElement();
    const player: Parameters<typeof renderPlayerPrepSummary>[0]["player"] = {
      role: "raid",
      gold: 9,
      selectedHeroId: "keiki",
      heroExclusiveShopOffers: [
        { unitType: "vanguard", cost: 3, rarity: 3, unitId: "mayumi", displayName: "杖刀偶磨弓" },
      ],
    };

    renderPlayerPrepSummary({
      heroExclusiveShopElement: heroExclusiveShopElement as unknown as HTMLElement,
      heroExclusiveShopCopyElement: heroExclusiveShopCopyElement as unknown as HTMLElement,
      state: {
        featureFlagsEnableHeroSystem: false,
      },
      player,
      currentPhase: "Prep",
      playerFacingPhase: "purchase",
      selectedBenchIndex: null,
    });

    expect(heroExclusiveShopElement.hidden).toBe(true);
    expect(heroExclusiveShopCopyElement.textContent).toContain("このルールセットでは無効");
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

  test("prep summary shows unit level in bench labels when a reserve unit is upgraded", () => {
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        benchUnits: ["vanguard:2", "mage"],
        benchDisplayNames: ["紅美鈴", "パチュリー・ノーレッジ"],
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(benchSlotElements[0]?.textContent).toContain("紅美鈴 Lv2");
    expect(benchSlotElements[1]?.textContent).toContain("パチュリー・ノーレッジ");
    expect(benchSlotElements[1]?.textContent).not.toContain("Lv");
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
    expect(detailCardElement.innerHTML).toContain("player-detail-head");
    expect(detailCardElement.innerHTML).toContain("player-detail-portrait");
    expect(detailCardElement.innerHTML).toContain("player-detail-tags");
    expect(detailCardElement.innerHTML).toContain("player-detail-stats");
    expect(detailCardElement.innerHTML).toContain("player-detail-effect");
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
    expect(detailCardElement.innerHTML).toContain("<strong>HP</strong>");
    expect(detailCardElement.innerHTML).toContain(">120<");
    expect(detailCardElement.innerHTML).toContain("<strong>ATK</strong>");
    expect(detailCardElement.innerHTML).toContain(">18<");
    expect(detailCardElement.innerHTML).toContain("player-detail-portrait-img");
    expect(detailCardElement.innerHTML).toContain("player-detail-kicker");
    expect(detailCardElement.innerHTML).toContain("player-detail-title");
    expect(detailCardElement.innerHTML).toContain("player-detail-lines");
    expect(detailCardElement.innerHTML).toContain("player-detail-stat");
  });

  test("prep summary adds Matara Okina exception copy to allied hero detail", () => {
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
          "ally-2": {
            selectedHeroId: "okina",
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

    const allyHeroPanel = allyRailElement.children.filter((child) => child.className.includes("player-ally-panel"))[1];
    const allyHeroChip = allyHeroPanel?.children.find((child) => child.dataset.hoverDetailTarget === "ally-hero");
    expect(allyHeroChip).toBeDefined();

    allyHeroChip?.onmouseenter?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({
        title: "隠岐奈",
        lines: expect.arrayContaining(["他の自軍 unit の sub slot に入れます。"]),
      }),
    ]);
  });

  test("prep summary keeps Allies rail focused on allied raid heroes only", () => {
    const allyRailElement = new FakeElement();

    renderPlayerPrepSummary({
      allyRailElement: allyRailElement as unknown as HTMLElement,
      state: {
        phase: "Prep",
        bossPlayerId: "boss-1",
        players: {
          "raid-1": {
            selectedHeroId: "reimu",
            benchUnits: ["vanguard"],
            benchDisplayNames: ["紅美鈴"],
          },
          "raid-2": {
            selectedHeroId: "marisa",
            benchUnits: ["mage"],
            benchDisplayNames: ["パチュリー・ノーレッジ"],
          },
          "boss-1": {
            role: "boss",
            selectedBossId: "remilia",
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

    const allyPanels = allyRailElement.children.filter((child) => child.className.includes("player-ally-panel"));
    const firstChip = allyPanels[0]?.children[1];
    const secondChip = allyPanels[1]?.children[1];

    expect(allyRailElement.children[0]?.textContent).toBe("Allies");
    expect(allyPanels.map((child) => child.children[0]?.textContent)).toEqual(["You", "Ally A"]);
    expect(firstChip?.dataset.hoverDetailTarget).toBe("self-hero");
    expect(secondChip?.dataset.hoverDetailTarget).toBe("ally-hero");
    expect(firstChip?.textContent).toContain("霊夢");
    expect(secondChip?.textContent).toContain("魔理沙");
    expect(firstChip?.className).toContain("player-ally-card");
    expect(firstChip?.className).toContain("player-ally-chip-self");
    expect(secondChip?.className).toContain("player-ally-card");
    expect(secondChip?.className).toContain("player-ally-chip-ally");
  });

  test("prep summary renders self summary as compact placement/state cards", () => {
    const specialUnitCopyElement = new FakeElement();
    const playerStatsCopyElement = new FakeElement();
    const roomCopyElement = new FakeElement();

    renderPlayerPrepSummary({
      specialUnitCopyElement: specialUnitCopyElement as unknown as HTMLElement,
      playerStatsCopyElement: playerStatsCopyElement as unknown as HTMLElement,
      roomCopyElement: roomCopyElement as unknown as HTMLElement,
      state: {
        phase: "Prep",
        players: {
          "raid-1": { ready: false },
          "raid-2": { ready: true },
        },
      },
      player: {
        role: "raid",
        selectedHeroId: "reimu",
        boardUnitCount: 1,
        gold: 11,
        hp: 92,
        specialUnitLevel: 3,
        remainingLives: 2,
        ready: false,
      },
      roomSummary: {
        roomId: "room-123",
        sharedBoardRoomId: "shared-456",
      },
      sessionId: "raid-1",
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: null,
    });

    expect(specialUnitCopyElement.textContent).toContain("霊夢");
    expect(specialUnitCopyElement.textContent).toContain("主人公");
    expect(specialUnitCopyElement.textContent).toContain("hover で詳細");
    expect(specialUnitCopyElement.innerHTML).toContain("player-special-unit-panel");
    expect(specialUnitCopyElement.innerHTML).toContain("player-special-unit-avatar-img");
    expect(specialUnitCopyElement.innerHTML).toContain("player-special-unit-lives");
    expect(playerStatsCopyElement.textContent).toContain("Placement");
    expect(playerStatsCopyElement.textContent).toContain("1 / 2");
    expect(playerStatsCopyElement.textContent).toContain("State");
    expect(playerStatsCopyElement.textContent).toContain("Deploy");
    expect(playerStatsCopyElement.textContent).not.toContain("Gold");
    expect(playerStatsCopyElement.textContent).not.toContain("HP");
    expect(playerStatsCopyElement.textContent).not.toContain("LV");
    expect(playerStatsCopyElement.innerHTML).toContain("player-player-stat-grid");
    expect(roomCopyElement.textContent).toContain("room-123");
  });

  test("prep summary renders bench copy as a compact right-rail handoff summary", () => {
    const benchCopyElement = new FakeElement();

    renderPlayerPrepSummary({
      benchCopyElement: benchCopyElement as unknown as HTMLElement,
      player: {
        benchUnits: ["vanguard-player-1-1", "mage-player-1-2"],
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: 1,
    });

    expect(benchCopyElement.textContent).toContain("2 / 8");
    expect(benchCopyElement.textContent).toContain("Bench 2");
    expect(benchCopyElement.textContent).toContain("target slot");
    expect(benchCopyElement.innerHTML).not.toContain("player-bench-summary-panel");
  });

  test("prep summary renders bench slots as mock-style reserve cards", () => {
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        benchUnits: ["ranger", "mage"],
        benchUnitIds: ["nazrin", "patchouli"],
        benchDisplayNames: ["紅美鈴", "パチュリー・ノーレッジ"],
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: 1,
    });

    expect(benchSlotElements[0]?.className).toContain("player-bench-slot-filled");
    expect(benchSlotElements[1]?.className).toContain("player-bench-slot-filled");
    expect(benchSlotElements[1]?.className).toContain("player-bench-slot-selected");
    expect(benchSlotElements[0]?.textContent).toContain("紅美鈴");
    expect(benchSlotElements[1]?.textContent).toContain("パチュリー・ノーレッジ");
    const firstAvatar = findDescendantByClass(benchSlotElements[0], "player-bench-slot-avatar-img") as unknown as { src?: string } | null;
    const secondAvatar = findDescendantByClass(benchSlotElements[1], "player-bench-slot-avatar-img") as unknown as { src?: string } | null;
    expect(firstAvatar?.src).toBe("/pics/processed/front/nazrin.png");
    expect(secondAvatar?.src).toBe("/pics/processed/front/patchouli.png");
  });

  test("prep summary keeps bench portrait nodes when only selection changes", () => {
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        benchUnits: ["ranger", "mage"],
        benchUnitIds: ["nazrin", "patchouli"],
        benchDisplayNames: ["紅美鈴", "パチュリー・ノーレッジ"],
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: 0,
    });

    const firstAvatar = findDescendantByClass(benchSlotElements[0], "player-bench-slot-avatar-img");
    const secondAvatar = findDescendantByClass(benchSlotElements[1], "player-bench-slot-avatar-img");
    expect(firstAvatar).not.toBeNull();
    expect(secondAvatar).not.toBeNull();

    renderPlayerPrepSummary({
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        benchUnits: ["ranger", "mage"],
        benchUnitIds: ["nazrin", "patchouli"],
        benchDisplayNames: ["紅美鈴", "パチュリー・ノーレッジ"],
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: 1,
    });

    expect(findDescendantByClass(benchSlotElements[0], "player-bench-slot-avatar-img")).toBe(firstAvatar);
    expect(findDescendantByClass(benchSlotElements[1], "player-bench-slot-avatar-img")).toBe(secondAvatar);
  });

  test("prep summary keeps bench slot structure while exposing fallback text for fake buttons", () => {
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        benchUnits: ["ranger"],
        benchUnitIds: ["nazrin"],
        benchDisplayNames: ["ナズーリン"],
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: null,
    });

    expect(findDescendantByClass(benchSlotElements[0], "player-bench-slot-copy")).not.toBeNull();
    expect(findDescendantByClass(benchSlotElements[0], "player-bench-slot-avatar-img")).not.toBeNull();
    expect(benchSlotElements[0]?.textContent).toContain("ナズーリン");
    expect(findDescendantByClass(benchSlotElements[1], "player-bench-slot-empty-copy")).not.toBeNull();
    expect(benchSlotElements[1]?.textContent).toContain("empty");
  });

  test("prep summary keeps empty bench slots clickable when a selected board unit can return", () => {
    const benchSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      player: {
        benchUnits: [],
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: null,
      canReturnBoard: true,
    });

    expect(benchSlotElements[0]?.disabled).toBe(false);
    expect(benchSlotElements[1]?.disabled).toBe(false);
    expect(benchSlotElements[0]?.className).toContain("player-bench-slot-empty");
  });

  test("prep summary omits inactive tier-zero synergies", () => {
    const synergyCopyElement = new FakeElement();

    renderPlayerPrepSummary({
      synergyCopyElement: synergyCopyElement as unknown as HTMLElement,
      player: {
        activeSynergies: [
          { unitType: "ranger", count: 1, tier: 0 },
          { unitType: "mage", count: 2, tier: 1 },
        ],
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(synergyCopyElement.textContent).toContain("mage x2 (T1)");
    expect(synergyCopyElement.textContent).not.toContain("ranger x1 (T0)");
  });

  test("prep summary presents hero upgrades without XP wording", () => {
    const heroUpgradeCopyElement = new FakeElement();

    renderPlayerPrepSummary({
      heroUpgradeCopyElement: heroUpgradeCopyElement as unknown as HTMLElement,
      player: {
        specialUnitLevel: 3,
      },
      currentPhase: "Prep",
      selectedBenchIndex: null,
    });

    expect(heroUpgradeCopyElement.textContent).toContain("主人公強化");
    expect(heroUpgradeCopyElement.textContent).toContain("LV 3");
    expect(heroUpgradeCopyElement.textContent).not.toContain("XP");
    expect(heroUpgradeCopyElement.textContent).not.toContain("経験値");
  });

  test("prep summary locks purchase controls after Ready and outside purchase phase", () => {
    const shopSlotElements = Array.from({ length: 2 }, () => new FakeButtonElement());
    const bossShopSlotElements = Array.from({ length: 1 }, () => new FakeButtonElement());
    const benchSlotElements = Array.from({ length: 1 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      shopSlotElements: shopSlotElements as unknown as HTMLButtonElement[],
      bossShopSlotElements: bossShopSlotElements as unknown as HTMLButtonElement[],
      benchSlotElements: benchSlotElements as unknown as HTMLButtonElement[],
      state: {
        phase: "Prep",
        featureFlagsEnableBossExclusiveShop: true,
        bossPlayerId: "boss-1",
      },
      player: {
        ready: true,
        role: "boss",
        shopOffers: [{ unitType: "mage", cost: 3, displayName: "パチュリー" }],
        bossShopOffers: [{ unitType: "mage", cost: 4, displayName: "咲夜" }],
        benchUnits: ["mage"],
      },
      sessionId: "boss-1",
      currentPhase: "Prep",
      playerFacingPhase: "purchase",
      selectedBenchIndex: null,
    });

    expect(shopSlotElements[0]?.disabled).toBe(true);
    expect(bossShopSlotElements[0]?.disabled).toBe(true);
    expect(benchSlotElements[0]?.disabled).toBe(true);

    renderPlayerPrepSummary({
      shopSlotElements: shopSlotElements as unknown as HTMLButtonElement[],
      state: {
        phase: "Prep",
      },
      player: {
        ready: false,
        shopOffers: [{ unitType: "mage", cost: 3, displayName: "パチュリー" }],
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: null,
    });

    expect(shopSlotElements[0]?.disabled).toBe(true);
  });

  test("prep summary keeps deploy board locked until deploy and unlocks it for raiders", () => {
    const boardCellElements = Array.from({ length: 2 }, () => new FakeButtonElement());

    renderPlayerPrepSummary({
      boardCellElements: boardCellElements as unknown as HTMLButtonElement[],
      currentPhase: "Prep",
      playerFacingPhase: "purchase",
      selectedBenchIndex: null,
    });

    expect(boardCellElements[0]?.disabled).toBe(true);

    renderPlayerPrepSummary({
      boardCellElements: boardCellElements as unknown as HTMLButtonElement[],
      player: {
        role: "raid",
        ready: false,
      },
      currentPhase: "Prep",
      playerFacingPhase: "deploy",
      selectedBenchIndex: null,
    });

    expect(boardCellElements[0]?.disabled).toBe(false);
  });

  test("prep summary wires allied hero hover targets into one detail callback", () => {
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
          "ally-2": {
            selectedHeroId: "marisa",
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

    const allyHeroPanel = allyRailElement.children.filter((child) => child.className.includes("player-ally-panel"))[1];
    const allyHeroChip = allyHeroPanel?.children.find((child) => child.dataset.hoverDetailTarget === "ally-hero");

    expect(allyHeroChip).toBeDefined();

    allyHeroChip?.onmouseenter?.();
    allyHeroChip?.onmouseleave?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({ title: "魔理沙" }),
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
          "ally-2": {
            selectedHeroId: "marisa",
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

    const allyHeroPanel = allyRailElement.children.filter((child) => child.className.includes("player-ally-panel"))[1];
    const allyHeroChip = allyHeroPanel?.children.find((child) => child.dataset.hoverDetailTarget === "ally-hero");
    allyHeroChip?.onfocus?.();
    allyHeroChip?.onblur?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({ title: "魔理沙" }),
      null,
    ]);
  });

  test("prep summary excludes boss chips and keeps allied hero kickers", () => {
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

    const allyPanel = allyRailElement.children.filter((child) => child.className.includes("player-ally-panel"))[1];
    const allyChip = allyPanel?.children.find((child) => child.dataset.hoverDetailTarget === "ally-hero");

    allyChip?.onmouseenter?.();

    expect(hoverCalls).toEqual([
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
    expect(resultSurfaceElement.innerHTML).toContain("Result phase");
    expect(resultSurfaceElement.innerHTML).toContain("Round 3: read the result and fix one weak position");
    expect(resultSurfaceElement.innerHTML).toContain("💀 DEFEAT");
    expect(resultSurfaceElement.innerHTML).toContain("trailed by 14 damage");
    expect(resultSurfaceElement.innerHTML).toContain("player-result-hero-card");
    expect(resultSurfaceElement.innerHTML).toContain("player-result-support-card");
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
              endReason: "annihilation",
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
