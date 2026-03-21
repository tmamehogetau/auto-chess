import { beforeEach, describe, expect, test, vi, afterEach } from "vitest";

// @ts-ignore JS client module has no declaration file.
import { connectSharedBoard, getSelectedSharedUnitId, handleSharedCellClick, initSharedBoardClient, leaveSharedBoardRoom, setSharedBoardGamePlayerId } from "../../src/client/shared-board-client.js";

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
  public style: Record<string, string> = {};
  public textContent = "";
  public tabIndex = -1;
  public draggable = false;
  public title = "";
  public role = "";
  public ariaLabel = "";
  public onclick: (() => void) | null = null;
  public onpointerdown: (() => void) | null = null;
  public ondragstart: ((event: unknown) => void) | null = null;
  public ondragend: (() => void) | null = null;
  public ondragover: ((event: unknown) => void) | null = null;
  public ondragleave: (() => void) | null = null;
  public ondrop: ((event: unknown) => void) | null = null;
  public onkeydown: ((event: { key: string; preventDefault: () => void }) => void) | null = null;
  public classList: FakeClassList;
  public children: FakeElement[] = [];
  public attributes: Record<string, string> = {};
  public clickCount = 0;
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

  public append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  public appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  public setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name === "aria-label") {
      this.ariaLabel = value;
    }
    if (name === "role") {
      this.role = value;
    }
  }

  public getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  public click(): void {
    this.clickCount += 1;
    this.onclick?.();
  }
}

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

describe("shared-board client", () => {
  beforeEach(() => {
    leaveSharedBoardRoom();
    vi.useFakeTimers();
    globalThis.document = {
      createElement: () => new FakeElement(),
    } as unknown as Document;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("undefined cursor entry を含む shared board state change でも落ちない", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);

    expect(stateChangeHandler).not.toBeNull();
    expect(() => {
      stateChangeHandler?.({
        boardWidth: 6,
        boardHeight: 4,
        cells: {},
        cursors: {
          "player-1": undefined,
        },
        players: {},
      });
    }).not.toThrow();
  });

  test("MapSchema 内部キーを cursor 一覧へ表示しない", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);

    const handler = stateChangeHandler as ((state: unknown) => void) | null;
    expect(handler).not.toBeNull();
    if (handler) {
      handler({
        boardWidth: 6,
        boardHeight: 4,
        cells: {},
        cursors: {
          $items: {
            "player-1": { color: "#ffffff" },
          },
          childT: "cursor-schema",
          $indexes: {},
          delete: () => {},
        },
        players: {},
      });
    }

    expect(cursorListElement.children).toHaveLength(1);
    expect(cursorListElement.children[0]?.textContent).toContain("player");
  });

  test("shared board marks boss top half and raid bottom half zones", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "boss-player",
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "boss-player",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);

    const handler = stateChangeHandler as ((state: unknown) => void) | null;
    expect(handler).not.toBeNull();
    handler?.({
      boardWidth: 6,
      boardHeight: 6,
      cells: {},
      cursors: {},
      players: {},
    });

    expect(gridElement.children).toHaveLength(36);
    expect(gridElement.children[0]?.dataset.raidRegion).toBe("boss-top");
    expect(gridElement.children[17]?.dataset.raidRegion).toBe("boss-top");
    expect(gridElement.children[18]?.dataset.raidRegion).toBe("raid-bottom");
    expect(gridElement.children[35]?.dataset.raidRegion).toBe("raid-bottom");
  });

  test("shared board cells expose zone classes for visual affordances", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 6,
      cells: {},
      cursors: {},
      players: {},
    });

    expect(gridElement.children[0]?.className).toContain("zone-boss");
    expect(gridElement.children[35]?.className).toContain("zone-raid");
  });

  test("shared board enters battle replay watch mode and replays unit movement", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    const messageHandlers = new Map<string, (message: unknown) => void>();

    const room = {
      sessionId: "raid-player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (type: string, handler: (message: unknown) => void) => {
        messageHandlers.set(type, handler);
      },
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "raid-player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const handleStateChange = stateChangeHandler as (state: unknown) => void;
    handleStateChange({
      mode: "battle",
      phase: "Battle",
      battleId: "battle-raid-1",
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        "18": {
          index: 18,
          unitId: "battle:raid-vanguard-1",
          ownerId: "raid",
          displayName: "raid-vanguard-1",
        },
      },
      cursors: {},
      players: {
        "raid-player-1": {
          isSpectator: false,
          color: "#4ECDC4",
        },
      },
    });

    const battleReplayHandler = messageHandlers.get("shared_battle_replay");
    if (!battleReplayHandler) {
      throw new Error("Expected shared battle replay handler to be registered");
    }

    battleReplayHandler({
      battleId: "battle-raid-1",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-1",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-1",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
          ],
        },
        {
          type: "move",
          battleId: "battle-raid-1",
          atMs: 120,
          battleUnitId: "raid-vanguard-1",
          from: { x: 0, y: 3 },
          to: { x: 1, y: 3 },
        },
        {
          type: "battleEnd",
          battleId: "battle-raid-1",
          atMs: 400,
          winner: "raid",
        },
      ],
    });

    expect(placementGuideElement.textContent).toContain("Watching live shared-board replay");
    expect(gridElement.children).toHaveLength(36);
    expect(gridElement.children[18]?.className).not.toContain("empty");

    vi.advanceTimersByTime(130);

    const movedUnit = findDescendantByClass(
      gridElement.children[19],
      "shared-board-battle-unit",
    );
    const movingTag = findDescendantByClass(
      gridElement.children[19],
      "shared-board-battle-state-tag",
    );

    expect(gridElement.children[19]?.className).not.toContain("empty");
    expect(gridElement.children[18]?.className).toContain("empty");
    expect(movedUnit?.className).toContain("shared-board-battle-moving");
    expect(movingTag?.textContent).toBe("Moving");

    vi.advanceTimersByTime(240);

    const settledUnit = findDescendantByClass(
      gridElement.children[19],
      "shared-board-battle-unit",
    );
    expect(settledUnit?.className).not.toContain("shared-board-battle-moving");
    expect(findDescendantByClass(gridElement.children[19], "shared-board-battle-state-tag")).toBeNull();
  });

  test("shared board battle replay updates HP bars and removes dead units", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    const messageHandlers = new Map<string, (message: unknown) => void>();

    const room = {
      sessionId: "raid-player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (type: string, handler: (message: unknown) => void) => {
        messageHandlers.set(type, handler);
      },
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "raid-player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const handleStateChange = stateChangeHandler as (state: unknown) => void;
    handleStateChange({
      mode: "battle",
      phase: "Battle",
      battleId: "battle-raid-2",
      boardWidth: 6,
      boardHeight: 6,
      cells: {},
      cursors: {},
      players: {
        "raid-player-1": {
          isSpectator: false,
          color: "#4ECDC4",
        },
      },
    });

    const battleReplayHandler = messageHandlers.get("shared_battle_replay");
    if (!battleReplayHandler) {
      throw new Error("Expected shared battle replay handler to be registered");
    }

    battleReplayHandler({
      battleId: "battle-raid-2",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-2",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-2",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
          ],
        },
        {
          type: "damageApplied",
          battleId: "battle-raid-2",
          atMs: 100,
          sourceBattleUnitId: "boss-ranger-1",
          targetBattleUnitId: "raid-vanguard-2",
          amount: 30,
          remainingHp: 10,
        },
        {
          type: "unitDeath",
          battleId: "battle-raid-2",
          atMs: 200,
          battleUnitId: "raid-vanguard-2",
        },
      ],
    });

    const initialFill = findDescendantByClass(
      gridElement.children[18],
      "shared-board-battle-hp-bar-fill",
    );
    expect(initialFill?.style.width).toBe("100%");

    vi.advanceTimersByTime(110);

    const damagedFill = findDescendantByClass(
      gridElement.children[18],
      "shared-board-battle-hp-bar-fill",
    );
    expect(damagedFill?.style.width).toBe("25%");

    vi.advanceTimersByTime(110);

    expect(gridElement.children[18]?.className).toContain("empty");
    expect(findDescendantByClass(gridElement.children[18], "shared-board-battle-unit")).toBeNull();
  });

  test("shared board battle replay shows a short impact tag when damage lands", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    const messageHandlers = new Map<string, (message: unknown) => void>();

    const room = {
      sessionId: "raid-player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (type: string, handler: (message: unknown) => void) => {
        messageHandlers.set(type, handler);
      },
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "raid-player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const handleStateChange = stateChangeHandler as (state: unknown) => void;
    handleStateChange({
      mode: "battle",
      phase: "Battle",
      battleId: "battle-raid-impact-1",
      boardWidth: 6,
      boardHeight: 6,
      cells: {},
      cursors: {},
      players: {
        "raid-player-1": {
          isSpectator: false,
          color: "#4ECDC4",
        },
      },
    });

    const battleReplayHandler = messageHandlers.get("shared_battle_replay");
    if (!battleReplayHandler) {
      throw new Error("Expected shared battle replay handler to be registered");
    }

    battleReplayHandler({
      battleId: "battle-raid-impact-1",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-impact-1",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "boss-ranger-impact-1",
              side: "boss",
              x: 5,
              y: 0,
              currentHp: 30,
              maxHp: 30,
            },
          ],
        },
        {
          type: "damageApplied",
          battleId: "battle-raid-impact-1",
          atMs: 100,
          sourceBattleUnitId: "raid-vanguard-impact-1",
          targetBattleUnitId: "boss-ranger-impact-1",
          amount: 12,
          remainingHp: 18,
        },
      ],
    });

    vi.advanceTimersByTime(110);

    const impactedUnit = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-unit",
    );
    const impactTag = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-impact-tag",
    );

    expect(impactedUnit?.className).toContain("shared-board-battle-impacted");
    expect(impactTag?.textContent).toBe("-12");

    vi.advanceTimersByTime(330);

    const settledUnit = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-unit",
    );
    expect(settledUnit?.className).not.toContain("shared-board-battle-impacted");
    expect(findDescendantByClass(gridElement.children[5], "shared-board-battle-impact-tag")).toBeNull();
  });

  test("shared board battle replay marks attacker and target during attackStart", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    const messageHandlers = new Map<string, (message: unknown) => void>();

    const room = {
      sessionId: "raid-player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (type: string, handler: (message: unknown) => void) => {
        messageHandlers.set(type, handler);
      },
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "raid-player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const handleStateChange = stateChangeHandler as (state: unknown) => void;
    handleStateChange({
      mode: "battle",
      phase: "Battle",
      battleId: "battle-raid-3",
      boardWidth: 6,
      boardHeight: 6,
      cells: {},
      cursors: {},
      players: {
        "raid-player-1": {
          isSpectator: false,
          color: "#4ECDC4",
        },
      },
    });

    const battleReplayHandler = messageHandlers.get("shared_battle_replay");
    if (!battleReplayHandler) {
      throw new Error("Expected shared battle replay handler to be registered");
    }

    battleReplayHandler({
      battleId: "battle-raid-3",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-3",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-3",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
            {
              battleUnitId: "boss-ranger-3",
              side: "boss",
              x: 5,
              y: 0,
              currentHp: 30,
              maxHp: 30,
            },
          ],
        },
        {
          type: "attackStart",
          battleId: "battle-raid-3",
          atMs: 100,
          sourceBattleUnitId: "raid-vanguard-3",
          targetBattleUnitId: "boss-ranger-3",
        },
      ],
    });

    vi.advanceTimersByTime(110);

    const attackerUnit = findDescendantByClass(
      gridElement.children[18],
      "shared-board-battle-unit",
    );
    const attackerTag = findDescendantByClass(
      gridElement.children[18],
      "shared-board-battle-state-tag",
    );
    const targetUnit = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-unit",
    );
    const targetTag = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-state-tag",
    );

    expect(attackerUnit?.className).toContain("shared-board-battle-attacking");
    expect(attackerTag?.textContent).toBe("Attacking");
    expect(targetUnit?.className).toContain("shared-board-battle-targeted");
    expect(targetTag?.textContent).toBe("Targeted");
  });

  test("shared board keeps attack markers through same-tick damage and clears them on the next replay tick", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    const messageHandlers = new Map<string, (message: unknown) => void>();

    const room = {
      sessionId: "raid-player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (type: string, handler: (message: unknown) => void) => {
        messageHandlers.set(type, handler);
      },
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "raid-player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const handleStateChange = stateChangeHandler as (state: unknown) => void;
    handleStateChange({
      mode: "battle",
      phase: "Battle",
      battleId: "battle-raid-4",
      boardWidth: 6,
      boardHeight: 6,
      cells: {},
      cursors: {},
      players: {
        "raid-player-1": {
          isSpectator: false,
          color: "#4ECDC4",
        },
      },
    });

    const battleReplayHandler = messageHandlers.get("shared_battle_replay");
    if (!battleReplayHandler) {
      throw new Error("Expected shared battle replay handler to be registered");
    }

    battleReplayHandler({
      battleId: "battle-raid-4",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-4",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-4",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
            {
              battleUnitId: "boss-ranger-4",
              side: "boss",
              x: 5,
              y: 0,
              currentHp: 30,
              maxHp: 30,
            },
          ],
        },
        {
          type: "attackStart",
          battleId: "battle-raid-4",
          atMs: 100,
          sourceBattleUnitId: "raid-vanguard-4",
          targetBattleUnitId: "boss-ranger-4",
        },
        {
          type: "damageApplied",
          battleId: "battle-raid-4",
          atMs: 100,
          sourceBattleUnitId: "raid-vanguard-4",
          targetBattleUnitId: "boss-ranger-4",
          amount: 12,
          remainingHp: 18,
        },
        {
          type: "move",
          battleId: "battle-raid-4",
          atMs: 200,
          battleUnitId: "raid-vanguard-4",
          to: { x: 1, y: 3 },
        },
      ],
    });

    vi.advanceTimersByTime(110);

    const attackerAtImpact = findDescendantByClass(
      gridElement.children[18],
      "shared-board-battle-unit",
    );
    const targetAtImpact = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-unit",
    );
    const targetHpFillAtImpact = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-hp-bar-fill",
    );

    expect(attackerAtImpact?.className).toContain("shared-board-battle-attacking");
    expect(targetAtImpact?.className).toContain("shared-board-battle-targeted");
    expect(targetHpFillAtImpact?.style.width).toBe("60%");

    vi.advanceTimersByTime(110);

    expect(findDescendantByClass(gridElement.children[18], "shared-board-battle-unit")).toBeNull();
    const movedUnit = findDescendantByClass(
      gridElement.children[19],
      "shared-board-battle-unit",
    );
    expect(movedUnit?.className).not.toContain("shared-board-battle-attacking");
    const oldTargetUnit = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-unit",
    );
    expect(oldTargetUnit?.className).not.toContain("shared-board-battle-targeted");
  });

  test("shared board marks center 4x2 as playable lane and dims the outer ring", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "raid-player",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "raid-player",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {},
      cursors: {},
      players: {
        "raid-player": { isSpectator: false },
      },
    });

    expect(gridElement.children[0]?.className).toContain("outside-playable");
    expect(gridElement.children[7]?.className).toContain("playable-lane");
    expect(gridElement.children[7]?.className).toContain("playable-boss-lane");
    expect(gridElement.children[13]?.className).toContain("playable-lane");
    expect(gridElement.children[13]?.className).toContain("playable-raid-lane");
    expect(placementGuideElement.textContent).toContain("center 4x2");
  });

  test("shared board cells distinguish own units and ally units for readability", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        6: { unitId: "vanguard-1", ownerId: "player-1" },
        7: { unitId: "ranger-1", ownerId: "player-2" },
      },
      cursors: {},
      players: {},
    });

    expect(gridElement.children[6]?.className).toContain("occupied-own");
    expect(gridElement.children[6]?.className).toContain("draggable");
    expect(gridElement.children[7]?.className).toContain("occupied-ally");
  });

  test("shared board treats gamePlayerId-owned units as own units even when shared room session differs", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "shared-session-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );
    setSharedBoardGamePlayerId("game-player-1");

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        13: { unitId: "vanguard-1", ownerId: "game-player-1" },
      },
      cursors: {},
      players: {
        "shared-session-1": { isSpectator: false },
      },
    });

    expect(gridElement.children[13]?.className).toContain("occupied-own");
    expect(gridElement.children[13]?.className).not.toContain("occupied-ally");
  });

  test("shared board placement guide explains move state and highlights open and blocked lanes", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
        8: { unitId: "", ownerId: "" },
        9: { unitId: "ranger-1", ownerId: "player-2" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    expect(placementGuideElement.textContent).toContain("center 4x2");

    gridElement.children[7]?.onpointerdown?.();

    expect(placementGuideElement.textContent).toContain("center 4x2");
    expect(gridElement.children[7]?.className).toContain("selected");
    expect(gridElement.children[8]?.className).toContain("drop-target");
    expect(gridElement.children[9]?.className).toContain("blocked-target");
  });

  test("shared board shows an empty board until real units are placed", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const placementGuideElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
        placementGuideElement: placementGuideElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {},
      cursors: {
        "player-1": { cellIndex: 8, color: "#ffffff" },
      },
      players: {
        "player-1": { isSpectator: false },
      },
    });

    expect(gridElement.children[8]?.className).toContain("empty");
    expect(gridElement.children[8]?.children).toHaveLength(0);
    expect(placementGuideElement.textContent).toContain("Buy a unit into your Bench");
  });

  test("shared board renders Touhou display name and portrait metadata when roster is enabled", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isTouhouRosterEnabled: () => true,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: {
          unitId: "koishi-player-1-4",
          ownerId: "player-1",
          displayName: "古明地こいし",
          portraitKey: "Koishi",
        },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const unit = gridElement.children[7]?.children[0];
    expect(unit?.className).toContain("shared-board-unit");

    const portrait = unit?.children[1] as unknown as { src?: string; alt?: string; className?: string };
    expect(portrait?.className).toContain("shared-board-portrait");
    expect(portrait?.src).toBe("/pics/Koishi.png");
    expect(portrait?.alt).toBe("古明地こいし");

    const nameplate = unit?.children[2];
    expect(nameplate?.className).toContain("shared-board-display-name");
    expect(nameplate?.textContent).toBe("古明地こいし");
  });

  test("shared board does not apply Touhou portrait metadata when roster is disabled", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isTouhouRosterEnabled: () => false,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: {
          unitId: "koishi-player-1-4",
          ownerId: "player-1",
          displayName: "古明地こいし",
          portraitKey: "Koishi",
        },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const unit = gridElement.children[7]?.children[0];
    expect(unit?.className).toContain("shared-board-unit");

    const portrait = unit?.children[1] as unknown as { src?: string; alt?: string; className?: string };
    expect(portrait?.src).not.toBe("/pics/Koishi.png");
    expect(portrait?.alt).not.toBe("古明地こいし");

    const nameplate = unit?.children[2];
    expect(nameplate?.textContent).not.toBe("古明地こいし");
  });

  test("shared board dragover marks valid and invalid drop zones", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
        8: { unitId: "", ownerId: "" },
        9: { unitId: "ranger-1", ownerId: "player-2" },
      },
      cursors: {},
      players: {},
    });

    const sourceCell = gridElement.children[7];
    const validTargetCell = gridElement.children[8];
    const invalidTargetCell = gridElement.children[9];

    sourceCell?.ondragstart?.({
      dataTransfer: {
        effectAllowed: "",
        setData: () => {},
      },
      preventDefault: () => {},
    });

    validTargetCell?.ondragover?.({
      preventDefault: () => {},
    });
    invalidTargetCell?.ondragover?.({
      preventDefault: () => {},
    });

    expect(validTargetCell?.dataset.dropValid).toBe("true");
    expect(validTargetCell?.dataset.dropInvalid).toBeUndefined();
    expect(validTargetCell?.className).toContain("drag-over");

    expect(invalidTargetCell?.dataset.dropInvalid).toBe("true");
    expect(invalidTargetCell?.dataset.dropValid).toBeUndefined();
    expect(invalidTargetCell?.className).toContain("drag-over");
  });

  test("shared board drop ignores invalid targets and clears highlight", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const sendCalls: Array<{ type: string; payload: unknown }> = [];
    const messages: Array<{ message: string; type: string }> = [];

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: (type: string, payload: unknown) => {
        sendCalls.push({ type, payload });
      },
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: (message: string, type: string) => {
          messages.push({ message, type });
        },
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
        9: { unitId: "ranger-1", ownerId: "player-2" },
      },
      cursors: {},
      players: {},
    });

    const sourceCell = gridElement.children[7];
    const invalidTargetCell = gridElement.children[9];

    sourceCell?.ondragstart?.({
      dataTransfer: {
        effectAllowed: "",
        setData: () => {},
      },
      preventDefault: () => {},
    });

    invalidTargetCell?.ondragover?.({ preventDefault: () => {} });
    invalidTargetCell?.ondrop?.({ preventDefault: () => {} });

    expect(sendCalls.filter((entry) => entry.type === "shared_place_unit")).toEqual([]);
    expect(messages).toEqual([{
      message: "That lane is occupied by another player. Pick an open cell.",
      type: "error",
    }]);
    expect(invalidTargetCell?.dataset.dropInvalid).toBeUndefined();
    expect(invalidTargetCell?.className).not.toContain("drag-over");
  });

  test("click placement keeps the selected unit until the server accepts the move", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const sendCalls: Array<{ type: string; payload: unknown }> = [];

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    let sharedActionResultHandler: ((message: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: (type: string, payload: unknown) => {
        sendCalls.push({ type, payload });
      },
      onLeave: (_handler: () => void) => {},
      onMessage: (type: string, handler: (message: unknown) => void) => {
        if (type === "shared_action_result") {
          sharedActionResultHandler = handler;
        }
      },
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const applyStateChange = stateChangeHandler as (state: unknown) => void;

    applyStateChange({
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
        20: { unitId: "", ownerId: "" },
      },
      cursors: {},
      players: {},
    });

    gridElement.children[19]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");

    handleSharedCellClick({
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
        20: { unitId: "", ownerId: "" },
      },
    }, 20);

    expect(sendCalls).toContainEqual({
      type: "shared_place_unit",
      payload: { unitId: "vanguard-1", toCell: 20 },
    });
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");

    const applySharedActionResult = sharedActionResultHandler as unknown as (message: unknown) => void;

    applySharedActionResult({
      accepted: false,
      action: "place_unit",
      code: "INVALID_PAYLOAD",
    });
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");

    applySharedActionResult({
      accepted: true,
      action: "place_unit",
    });
    expect(getSelectedSharedUnitId()).toBeNull();
  });

  test("shared board click placement rejects non-playable cells before sending", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const sendCalls: Array<{ type: string; payload: unknown }> = [];
    const messages: Array<{ message: string; type: string }> = [];

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: (type: string, payload: unknown) => {
        sendCalls.push({ type, payload });
      },
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: (message: string, type: string) => {
          messages.push({ message, type });
        },
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const applyStateChange = stateChangeHandler as (state: unknown) => void;
    applyStateChange({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {},
    });

    gridElement.children[7]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");

    handleSharedCellClick({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
      },
    }, 0);

    expect(sendCalls.filter((entry) => entry.type === "shared_place_unit")).toEqual([]);
    expect(messages).toEqual([{
      message: "That lane is outside the playable combat area. Pick one of the center cells.",
      type: "error",
    }]);
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");
  });

  test("shared board 6x6 staging rejects lower-half cells outside the active raid footprint", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const sendCalls: Array<{ type: string; payload: unknown }> = [];
    const messages: Array<{ message: string; type: string }> = [];

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: (type: string, payload: unknown) => {
        sendCalls.push({ type, payload });
      },
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: (message: string, type: string) => {
          messages.push({ message, type });
        },
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const applyStateChange = stateChangeHandler as (state: unknown) => void;
    applyStateChange({
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    gridElement.children[19]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");

    handleSharedCellClick({
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
      },
    }, 18);

    expect(sendCalls.filter((entry) => entry.type === "shared_place_unit")).toEqual([]);
    expect(messages).toEqual([{
      message: "That cell is outside the active raid combat footprint. Pick one of the highlighted raid cells.",
      type: "error",
    }]);
  });

  test("shared board treats sparse cells as valid empty drop targets", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {},
    });

    const sourceCell = gridElement.children[7];
    const sparseTargetCell = gridElement.children[8];

    sourceCell?.ondragstart?.({
      dataTransfer: {
        effectAllowed: "",
        setData: () => {},
      },
      preventDefault: () => {},
    });

    sparseTargetCell?.ondragover?.({ preventDefault: () => {} });

    expect(sparseTargetCell?.dataset.dropValid).toBe("true");
    expect(sparseTargetCell?.dataset.dropInvalid).toBeUndefined();
  });

  test("shared board cells expose keyboard button semantics after render", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-1",
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {},
      cursors: {},
      players: {},
    });

    const firstCell = gridElement.children[0];
    expect(firstCell?.tabIndex).toBe(0);
    expect(firstCell?.getAttribute("role")).toBe("button");
    expect(firstCell?.ariaLabel).toBe(
      "Board cell 0, outside the playable lane",
    );
    expect(typeof firstCell?.onkeydown).toBe("function");
  });

  test("shared board keyboard activation reuses cell click flow for select and place", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    const sendCalls: Array<{ type: string; payload: unknown }> = [];

    const room = {
      sessionId: "player-1",
      send: (type: string, payload: unknown) => {
        sendCalls.push({ type, payload });
      },
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
        8: { unitId: "", ownerId: "" },
      },
      cursors: {},
      players: {},
    });

    const sourceCell = gridElement.children[7];

    let preventedSelection = false;
    sourceCell?.onkeydown?.({
      key: "Enter",
      preventDefault: () => {
        preventedSelection = true;
      },
    });

    expect(preventedSelection).toBe(true);
    expect(sourceCell?.clickCount).toBe(1);
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");

    const targetCell = gridElement.children[8];
    let preventedPlacement = false;
    targetCell?.onkeydown?.({
      key: " ",
      preventDefault: () => {
        preventedPlacement = true;
      },
    });

    expect(preventedPlacement).toBe(true);
    expect(targetCell?.clickCount).toBe(1);
    expect(sendCalls).toContainEqual({
      type: "shared_place_unit",
      payload: { unitId: "vanguard-1", toCell: 8 },
    });
  });

  test("shared board drag start treats gamePlayerId ownership as own unit", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;
    let preventDefaultCalled = false;
    const transferred: Array<{ type: string; value: string }> = [];

    const room = {
      sessionId: "shared-room-session",
      send: () => {},
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (handler: (state: unknown) => void) => {
        stateChangeHandler = handler;
      },
    };

    const client = {
      joinOrCreate: async () => room,
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement, cursorListElement: cursorListElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    (stateChangeHandler as (state: unknown) => void)({
      boardWidth: 6,
      boardHeight: 4,
      cells: {
        7: { unitId: "vanguard-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {},
    });

    const sourceCell = gridElement.children[7];
    sourceCell?.ondragstart?.({
      dataTransfer: {
        effectAllowed: "",
        setData: (type: string, value: string) => {
          transferred.push({ type, value });
        },
      },
      preventDefault: () => {
        preventDefaultCalled = true;
      },
    });

    expect(preventDefaultCalled).toBe(false);
    expect(transferred).toEqual([{ type: "text/plain", value: "vanguard-1" }]);
  });
});
