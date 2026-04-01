import { beforeEach, describe, expect, test, vi, afterEach } from "vitest";

// @ts-ignore JS client module has no declaration file.
import { connectSharedBoard, getSelectedSharedUnitId, handleSharedCellClick, initSharedBoardClient, leaveSharedBoardRoom, setSharedBoardGamePlayerId, setSharedBoardRoomId } from "../../src/client/shared-board-client.js";
import { createFakeDocument, FakeElement, findDescendantByClass } from "../helpers/fake-dom";
import { disableFakeTimers, enableFakeTimers } from "../helpers/fake-timers";

describe("shared-board client", () => {
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
    enableFakeTimers();
    globalThis.document = createFakeDocument();
    leaveSharedBoardRoom();
    setSharedBoardRoomId("");
  });

  afterEach(() => {
    disableFakeTimers();
    if (originalDocument === undefined) {
      delete (globalThis as { document?: typeof globalThis.document }).document;
      return;
    }

    globalThis.document = originalDocument;
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

  test("sharedBoardRoomId があるときは joinById で dedicated shared board に入る", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const room = {
      sessionId: "player-1",
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (_handler: (state: unknown) => void) => {},
    };
    const joinCalls: string[] = [];
    const client = {
      joinById: async (roomId: string) => {
        joinCalls.push(roomId);
        return room;
      },
      joinOrCreate: async () => {
        throw new Error("joinOrCreate should not be used");
      },
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
    setSharedBoardRoomId("shared-room-123");

    await connectSharedBoard(client as object);

    expect(joinCalls).toEqual(["shared-room-123"]);
  });

  test("shared board 接続後は listener 登録後に shared_request_role を送る", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const messageHandlers = new Map<string, (message: unknown) => void>();
    const callOrder: string[] = [];

    const room = {
      sessionId: "player-1",
      send: (type: string) => {
        callOrder.push(`send:${type}`);
      },
      onLeave: (_handler: () => void) => {},
      onMessage: (type: string, handler: (message: unknown) => void) => {
        callOrder.push(`onMessage:${type}`);
        messageHandlers.set(type, handler);
      },
      onStateChange: (_handler: (state: unknown) => void) => {
        callOrder.push("onStateChange");
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

    expect(messageHandlers.has("shared_role")).toBe(true);
    expect(callOrder).toEqual(expect.arrayContaining([
      "onMessage:shared_role",
      "onMessage:shared_action_result",
      "onMessage:shared_battle_replay",
      "onStateChange",
      "send:shared_request_role",
    ]));
    expect(callOrder.indexOf("onMessage:shared_role")).toBeLessThan(callOrder.indexOf("send:shared_request_role"));
    expect(callOrder.indexOf("onMessage:shared_action_result")).toBeLessThan(callOrder.indexOf("send:shared_request_role"));
    expect(callOrder.indexOf("onMessage:shared_battle_replay")).toBeLessThan(callOrder.indexOf("send:shared_request_role"));
    expect(callOrder.indexOf("onStateChange")).toBeLessThan(callOrder.indexOf("send:shared_request_role"));
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
    expect(gridElement.children[0]?.className).toContain("active-combat-area");
    expect(gridElement.children[0]?.className).toContain("active-boss-area");
    expect(gridElement.children[17]?.className).toContain("active-boss-area");
    expect(gridElement.children[18]?.className).toContain("active-combat-area");
    expect(gridElement.children[18]?.className).toContain("active-raid-area");
    expect(gridElement.children[35]?.className).toContain("active-raid-area");
    expect(gridElement.children[0]?.className).not.toContain("outside-combat-area");
    expect(gridElement.children[35]?.className).not.toContain("outside-combat-area");
  });

  test("dedicated sharedBoardRoomId があればその room に join する", async () => {
    const gridElement = new FakeElement();
    const joinCalls: Array<{ roomId: string; options: unknown }> = [];

    const room = {
      roomId: "shared-room-123",
      sessionId: "player-1",
      onLeave: (_handler: () => void) => {},
      onMessage: (_type: string, _handler: (message: unknown) => void) => {},
      onStateChange: (_handler: (state: unknown) => void) => {},
    };

    const client = {
      joinById: async (roomId: string, options?: unknown) => {
        joinCalls.push({ roomId, options });
        return room;
      },
    };

    initSharedBoardClient(
      { gridElement: gridElement as unknown as HTMLElement },
      {
        client,
        gamePlayerId: "player-1",
        onLog: () => {},
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object, { roomId: "shared-room-123" });

    expect(joinCalls).toEqual([
      {
        roomId: "shared-room-123",
        options: { gamePlayerId: "player-1" },
      },
    ]);
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
    const movementGhost = findDescendantByClass(
      gridElement as unknown as FakeElement,
      "shared-board-battle-ghost",
    );

    expect(gridElement.children[19]?.className).not.toContain("empty");
    expect(gridElement.children[18]?.className).toContain("empty");
    expect(movedUnit?.className).toContain("shared-board-battle-moving");
    expect(movingTag?.textContent).toBe("Moving");
    expect(movementGhost?.style.gridColumn).toBe("2");
    expect(movementGhost?.style.gridRow).toBe("4");
    expect(movementGhost?.style["--shared-board-ghost-from-x"]).toBe("calc(-1 * (100% + var(--shared-board-gap, 8px)))");
    expect(movementGhost?.style["--shared-board-ghost-from-y"]).toBe("calc(0 * (100% + var(--shared-board-gap, 8px)))");

    vi.advanceTimersByTime(240);

    const settledUnit = findDescendantByClass(
      gridElement.children[19],
      "shared-board-battle-unit",
    );
    expect(settledUnit?.className).not.toContain("shared-board-battle-moving");
    expect(findDescendantByClass(gridElement.children[19], "shared-board-battle-state-tag")).toBeNull();
    expect(findDescendantByClass(gridElement as unknown as FakeElement, "shared-board-battle-ghost")).toBeNull();
  });

  test("shared board battle replay keeps Touhou portrait metadata from the timeline snapshot", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

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
      },
      {
        client,
        gamePlayerId: "raid-player-1",
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
      mode: "battle",
      phase: "Battle",
      battleId: "battle-raid-1",
      boardWidth: 6,
      boardHeight: 6,
      cells: {},
      cursors: {},
      players: {
        "raid-player-1": {
          isSpectator: false,
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
              battleUnitId: "raid-ranger-1",
              sourceUnitId: "nazrin",
              side: "raid",
              x: 0,
              y: 3,
              currentHp: 40,
              maxHp: 40,
              displayName: "ナズーリン",
              portraitKey: "nazrin",
            },
          ],
        },
      ],
    });

    const unit = findDescendantByClass(gridElement.children[18], "shared-board-unit-card");
    const portrait = findDescendantByClass(unit ?? undefined, "shared-board-portrait") as unknown as {
      src?: string;
      alt?: string;
      className?: string;
    };
    const metaWrap = findDescendantByClass(unit ?? undefined, "shared-board-unit-meta-wrap");
    const nameplate = findDescendantByClass(metaWrap ?? undefined, "shared-board-display-name");

    expect(unit?.className).toContain("shared-board-unit-card");
    expect(portrait?.className).toContain("shared-board-portrait");
    expect(portrait?.src).toBe("/pics/processed/front/nazrin.png");
    expect(portrait?.alt).toBe("ナズーリン");
    expect(nameplate?.textContent).toBe("ナズーリン");
  });

  test("shared board ignores only identical replay payloads for the same battle", async () => {
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
      battleId: "battle-raid-dup",
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

    const replayMessage = {
      battleId: "battle-raid-dup",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-dup",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-dup",
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
          battleId: "battle-raid-dup",
          atMs: 120,
          battleUnitId: "raid-vanguard-dup",
          from: { x: 0, y: 3 },
          to: { x: 1, y: 3 },
        },
        {
          type: "battleEnd",
          battleId: "battle-raid-dup",
          atMs: 400,
          winner: "raid",
        },
      ],
    };

    battleReplayHandler(replayMessage);
    vi.advanceTimersByTime(130);

    expect(gridElement.children[19]?.className).not.toContain("empty");
    expect(gridElement.children[18]?.className).toContain("empty");

    battleReplayHandler(replayMessage);

    expect(gridElement.children[19]?.className).not.toContain("empty");
    expect(gridElement.children[18]?.className).toContain("empty");

    battleReplayHandler({
      ...replayMessage,
      timeline: [
        replayMessage.timeline[0],
        replayMessage.timeline[1],
        {
          type: "move",
          battleId: "battle-raid-dup",
          atMs: 240,
          battleUnitId: "raid-vanguard-dup",
          from: { x: 1, y: 3 },
          to: { x: 2, y: 3 },
        },
        replayMessage.timeline[2],
      ],
    });
    vi.advanceTimersByTime(250);

    expect(gridElement.children[20]?.className).not.toContain("empty");
    expect(gridElement.children[19]?.className).toContain("empty");
  });

  test("shared board reapplies replay when the same battle receives a longer timeline", async () => {
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
      battleId: "battle-raid-extend",
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

    const initialReplayMessage = {
      battleId: "battle-raid-extend",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-extend",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-extend",
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
          battleId: "battle-raid-extend",
          atMs: 120,
          battleUnitId: "raid-vanguard-extend",
          from: { x: 0, y: 3 },
          to: { x: 1, y: 3 },
        },
      ],
    };

    const extendedReplayMessage = {
      battleId: "battle-raid-extend",
      phase: "Battle",
      timeline: [
        ...initialReplayMessage.timeline,
        {
          type: "move",
          battleId: "battle-raid-extend",
          atMs: 260,
          battleUnitId: "raid-vanguard-extend",
          from: { x: 1, y: 3 },
          to: { x: 2, y: 3 },
        },
      ],
    };

    battleReplayHandler(initialReplayMessage);
    vi.advanceTimersByTime(130);

    expect(gridElement.children[19]?.className).not.toContain("empty");
    expect(gridElement.children[18]?.className).toContain("empty");

    battleReplayHandler(extendedReplayMessage);
    vi.advanceTimersByTime(300);

    expect(gridElement.children[20]?.className).not.toContain("empty");
    expect(gridElement.children[19]?.className).toContain("empty");
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

    const defeatedUnit = findDescendantByClass(
      gridElement.children[18],
      "shared-board-battle-unit",
    );
    const defeatedTag = findDescendantByClass(
      gridElement.children[18],
      "shared-board-battle-state-tag",
    );

    expect(defeatedUnit?.className).toContain("shared-board-battle-dead");
    expect(defeatedTag?.textContent).toBe("Defeated");

    vi.advanceTimersByTime(260);

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
    const impactBurst = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-hit-burst",
    );

    expect(impactedUnit?.className).toContain("shared-board-battle-impacted");
    expect(impactTag?.textContent).toBe("-12");
    expect(impactBurst).not.toBeNull();

    vi.advanceTimersByTime(330);

    const settledUnit = findDescendantByClass(
      gridElement.children[5],
      "shared-board-battle-unit",
    );
    expect(settledUnit?.className).not.toContain("shared-board-battle-impacted");
    expect(findDescendantByClass(gridElement.children[5], "shared-board-battle-impact-tag")).toBeNull();
    expect(findDescendantByClass(gridElement.children[5], "shared-board-battle-hit-burst")).toBeNull();
  });

  test("shared board battle replay shows castStart with a caster focus before impact", async () => {
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
      battleId: "battle-raid-cast-1",
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
      battleId: "battle-raid-cast-1",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-cast-1",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-mage-cast-1",
              side: "raid",
              x: 2,
              y: 4,
              currentHp: 28,
              maxHp: 28,
            },
            {
              battleUnitId: "boss-vanguard-cast-1",
              side: "boss",
              x: 2,
              y: 1,
              currentHp: 60,
              maxHp: 60,
            },
          ],
        },
        {
          type: "castStart",
          battleId: "battle-raid-cast-1",
          atMs: 100,
          sourceBattleUnitId: "raid-mage-cast-1",
          targetBattleUnitId: "boss-vanguard-cast-1",
        },
        {
          type: "damageApplied",
          battleId: "battle-raid-cast-1",
          atMs: 220,
          sourceBattleUnitId: "raid-mage-cast-1",
          targetBattleUnitId: "boss-vanguard-cast-1",
          amount: 17,
          remainingHp: 43,
        },
      ],
    });

    vi.advanceTimersByTime(110);

    const caster = findDescendantByClass(
      gridElement.children[26],
      "shared-board-battle-unit",
    );
    const castTag = findDescendantByClass(
      gridElement.children[26],
      "shared-board-battle-state-tag",
    );
    const castFocus = findDescendantByClass(
      gridElement.children[26],
      "shared-board-battle-cast-focus",
    );
    const target = findDescendantByClass(
      gridElement.children[8],
      "shared-board-battle-unit",
    );

    expect(caster?.className).toContain("shared-board-battle-casting");
    expect(castTag?.textContent).toBe("Casting");
    expect(castFocus).not.toBeNull();
    expect(target?.className).toContain("shared-board-battle-targeted");

    vi.advanceTimersByTime(120);

    const settledCaster = findDescendantByClass(
      gridElement.children[26],
      "shared-board-battle-unit",
    );
    expect(settledCaster?.className).not.toContain("shared-board-battle-casting");
    expect(findDescendantByClass(gridElement.children[26], "shared-board-battle-cast-focus")).toBeNull();
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

  test("shared board shows a short attack direction line toward the current target", async () => {
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
      battleId: "battle-raid-5",
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
      battleId: "battle-raid-5",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-5",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-vanguard-5",
              side: "raid",
              x: 1,
              y: 3,
              currentHp: 40,
              maxHp: 40,
            },
            {
              battleUnitId: "boss-ranger-5",
              side: "boss",
              x: 3,
              y: 3,
              currentHp: 30,
              maxHp: 30,
            },
          ],
        },
        {
          type: "attackStart",
          battleId: "battle-raid-5",
          atMs: 100,
          sourceBattleUnitId: "raid-vanguard-5",
          targetBattleUnitId: "boss-ranger-5",
        },
        {
          type: "move",
          battleId: "battle-raid-5",
          atMs: 220,
          battleUnitId: "raid-vanguard-5",
          to: { x: 2, y: 3 },
        },
      ],
    });

    vi.advanceTimersByTime(110);

    const attackerAtStrike = findDescendantByClass(
      gridElement.children[19],
      "shared-board-battle-unit",
    );
    const directionLine = findDescendantByClass(
      gridElement.children[19],
      "shared-board-battle-attack-direction",
    );

    expect(attackerAtStrike?.className).toContain("shared-board-battle-attacking");
    expect(attackerAtStrike?.className).toContain("shared-board-battle-lunging");
    expect(attackerAtStrike?.style["--shared-board-attack-lunge-x"]).toBe("10px");
    expect(attackerAtStrike?.style["--shared-board-attack-lunge-y"]).toBe("0px");
    expect(directionLine?.style["--shared-board-attack-angle"]).toBe("0deg");
    expect(directionLine?.style["--shared-board-attack-length"]).toBe("26px");

    vi.advanceTimersByTime(120);

    const movedUnit = findDescendantByClass(
      gridElement.children[20],
      "shared-board-battle-unit",
    );
    expect(movedUnit?.className).not.toContain("shared-board-battle-attacking");
    expect(findDescendantByClass(gridElement.children[20], "shared-board-battle-attack-direction")).toBeNull();
  });

  test("shared board shows a projectile tracer for ranged attacks", async () => {
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
      battleId: "battle-raid-6",
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
      battleId: "battle-raid-6",
      phase: "Battle",
      timeline: [
        {
          type: "battleStart",
          battleId: "battle-raid-6",
          round: 2,
          boardConfig: { width: 6, height: 6 },
          units: [
            {
              battleUnitId: "raid-ranger-6",
              side: "raid",
              x: 1,
              y: 4,
              currentHp: 32,
              maxHp: 32,
            },
            {
              battleUnitId: "boss-vanguard-6",
              side: "boss",
              x: 4,
              y: 2,
              currentHp: 54,
              maxHp: 54,
            },
          ],
        },
        {
          type: "attackStart",
          battleId: "battle-raid-6",
          atMs: 100,
          sourceBattleUnitId: "raid-ranger-6",
          targetBattleUnitId: "boss-vanguard-6",
        },
        {
          type: "damageApplied",
          battleId: "battle-raid-6",
          atMs: 180,
          sourceBattleUnitId: "raid-ranger-6",
          targetBattleUnitId: "boss-vanguard-6",
          amount: 11,
          remainingHp: 43,
        },
      ],
    });

    vi.advanceTimersByTime(110);

    const attackerAtShot = findDescendantByClass(
      gridElement.children[25],
      "shared-board-battle-unit",
    );
    const directionLine = findDescendantByClass(
      gridElement.children[25],
      "shared-board-battle-attack-direction",
    );
    const tracer = findDescendantByClass(
      gridElement.children[25],
      "shared-board-battle-projectile-tracer",
    );

    expect(attackerAtShot?.className).toContain("shared-board-battle-attacking");
    expect(attackerAtShot?.className).not.toContain("shared-board-battle-lunging");
    expect(directionLine).toBeNull();
    expect(tracer?.style["--shared-board-attack-angle"]).toBe("-34deg");
    expect(tracer?.style["--shared-board-attack-length"]).toBe("32px");

    vi.advanceTimersByTime(90);

    expect(findDescendantByClass(gridElement.children[25], "shared-board-battle-projectile-tracer")).toBeNull();
  });

  test("shared board marks the center 4x2 combat area and dims the outer ring", async () => {
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

    expect(gridElement.children[0]?.className).toContain("outside-combat-area");
    expect(gridElement.children[7]?.className).toContain("active-combat-area");
    expect(gridElement.children[7]?.className).toContain("active-boss-area");
    expect(gridElement.children[13]?.className).toContain("active-combat-area");
    expect(gridElement.children[13]?.className).toContain("active-raid-area");
    expect(placementGuideElement.textContent).toContain("center 4x2 combat cells");
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

  test("shared board placement guide explains move state across the full 6x6 raid half", async () => {
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
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
        30: { unitId: "", ownerId: "" },
        2: { unitId: "dummy-boss", ownerId: "boss" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
      boardWidth: 6,
      boardHeight: 6,
    });

    expect(placementGuideElement.textContent).toContain("lower half of the board");

    gridElement.children[19]?.onpointerdown?.();

    expect(placementGuideElement.textContent).toContain("lower raid half");
    expect(gridElement.children[19]?.className).toContain("selected");
    expect(gridElement.children[30]?.className).toContain("drop-target");
    expect(gridElement.children[2]?.className).toContain("blocked-target");
  });

  test("shared board clears selection when the same own unit is clicked again", async () => {
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
      boardHeight: 6,
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
        25: { unitId: "", ownerId: "" },
        26: { unitId: "ranger-ally", ownerId: "ally-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    gridElement.children[19]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");
    expect(gridElement.children[25]?.className).toContain("drop-target");
    expect(gridElement.children[26]?.className).toContain("blocked-target");
    expect(gridElement.children[26]?.className).not.toContain("drop-target");

    gridElement.children[19]?.onpointerdown?.();

    expect(getSelectedSharedUnitId()).toBeNull();
    expect(gridElement.children[19]?.className).not.toContain("selected");
    expect(gridElement.children[25]?.className).not.toContain("drop-target");
    expect(gridElement.children[26]?.className).not.toContain("blocked-target");
  });

  test("shared board clicks another own occupied cell as a swap target when a unit is already selected", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const sendCalls: Array<{ type: string; payload: unknown }> = [];

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
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
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

    const state = {
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
        25: { unitId: "ranger-1", ownerId: "player-1" },
        26: { unitId: "mage-ally", ownerId: "ally-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    };

    (stateChangeHandler as (state: unknown) => void)(state);

    gridElement.children[19]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");
    expect(gridElement.children[25]?.className).toContain("drop-target");
    expect(gridElement.children[26]?.className).toContain("blocked-target");

    gridElement.children[25]?.click();

    expect(sendCalls).toContainEqual({
      type: "shared_place_unit",
      payload: { unitId: "vanguard-1", toCell: 25 },
    });
    expect(sendCalls).not.toContainEqual({
      type: "shared_select_unit",
      payload: { unitId: "ranger-1" },
    });
  });

  test("shared board keeps own hero cell blocked when a normal unit is selected", async () => {
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
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
      },
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

    const state = {
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1" },
        30: { unitId: "hero:player-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    };

    (stateChangeHandler as (state: unknown) => void)(state);

    gridElement.children[24]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");
    expect(gridElement.children[30]?.className).toContain("blocked-target");
    expect(gridElement.children[30]?.className).not.toContain("drop-target");

    gridElement.children[30]?.click();

    expect(sendCalls.filter((entry) => entry.type === "shared_place_unit")).toEqual([]);
    expect(messages).toEqual([{
      message: "Hero cells cannot be replaced. Swap with your own main unit instead.",
      type: "error",
    }]);
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");
  });

  test("shared board shows an empty + sub slot for own deployed raid units in deploy phase", async () => {
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
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => [],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
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
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1" },
        25: { unitId: "ranger-ally", ownerId: "ally-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const ownSubSlot = findDescendantByClass(gridElement.children[24], "shared-board-sub-slot");
    expect(ownSubSlot).not.toBeNull();
    expect(ownSubSlot?.textContent).toBe("+");
    expect(findDescendantByClass(gridElement.children[25], "shared-board-sub-slot")).toBeNull();
  });

  test("shared board renders attached sub units as mini icons instead of a legacy SUB badge", async () => {
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
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => ["24:mage"],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
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
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const subSlot = findDescendantByClass(gridElement.children[24], "shared-board-sub-slot");
    expect(subSlot).not.toBeNull();
    expect(subSlot?.className).toContain("attached");
    expect(subSlot?.className).toContain("shared-board-sub-slot-attached");
    expect(subSlot?.textContent).toContain("✨");
    expect(subSlot?.textContent).not.toContain("SUB");
  });

  test("shared board renders mock-style zone labels and empty sub-slot affordances", async () => {
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
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => [],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
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
      cells: {
        18: { unitId: "hero:player-1", ownerId: "player-1", displayName: "霊夢" },
        19: { unitId: "vanguard-1", ownerId: "player-1", displayName: "美鈴" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const heroZoneLabel = findDescendantByClass(gridElement.children[18], "shared-board-zone-label");
    const slotZoneLabel = findDescendantByClass(gridElement.children[19], "shared-board-zone-label");
    const emptySubSlot = findDescendantByClass(gridElement.children[19], "shared-board-sub-slot");

    expect(heroZoneLabel?.textContent).toBe("hero");
    expect(slotZoneLabel?.textContent).toBe("slot");
    expect(emptySubSlot?.className).toContain("shared-board-sub-slot-empty");
    expect(emptySubSlot?.textContent).toBe("+");
  });

  test("shared board never shows sub slots for boss-side units", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-4",
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
      },
      {
        client,
        gamePlayerId: "player-4",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => ["2:mage"],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "boss",
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
      cells: {
        2: { unitId: "boss:player-4", ownerId: "player-4" },
      },
      cursors: {},
      players: {
        "player-4": { isSpectator: false },
      },
    });

    expect(findDescendantByClass(gridElement.children[2], "shared-board-sub-slot")).toBeNull();
  });

  test("shared board never shows sub slots on hero cells", async () => {
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
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => [],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
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
      cells: {
        30: { unitId: "hero:player-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    expect(findDescendantByClass(gridElement.children[30], "shared-board-sub-slot")).toBeNull();
  });

  test("shared board hides empty sub slots when sub-unit system is disabled", async () => {
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
      {
        gridElement: gridElement as unknown as HTMLElement,
        cursorListElement: cursorListElement as unknown as HTMLElement,
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => false,
        getPlayerBoardSubUnits: () => [],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
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
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    expect(findDescendantByClass(gridElement.children[24], "shared-board-sub-slot")).toBeNull();
  });

  test("shared board hover payload includes sub effect copy when a main unit has an attached sub", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const hoverCalls: unknown[] = [];

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
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => ["24:mage"],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
        onHoverDetailChange: (detail: unknown) => {
          hoverCalls.push(detail);
        },
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
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1", displayName: "美鈴" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    gridElement.children[24]?.onmouseenter?.();
    gridElement.children[24]?.onmouseleave?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({
        title: "美鈴",
        lines: expect.arrayContaining(["サブ効果: Mage"]),
      }),
      null,
    ]);
  });

  test("shared board attached sub slots publish their own hover detail payload", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const hoverCalls: unknown[] = [];

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
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => ["24:mage"],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
        onHoverDetailChange: (detail: unknown) => {
          hoverCalls.push(detail);
        },
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
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1", displayName: "美鈴" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const subSlot = findDescendantByClass(gridElement.children[24], "shared-board-sub-slot");
    if (!subSlot) {
      throw new Error("Expected attached sub slot to be rendered");
    }

    (subSlot as FakeElement & { onmouseenter?: () => void; onmouseleave?: () => void }).onmouseenter?.();
    (subSlot as FakeElement & { onmouseenter?: () => void; onmouseleave?: () => void }).onmouseleave?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({
        kicker: "Sub Unit",
        title: "Mage",
      }),
      null,
    ]);
  });

  test("shared board hover payload resolves attached Okina copy instead of a generic Hero label", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const hoverCalls: unknown[] = [];

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
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => ["24:hero:okina"],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
        onHoverDetailChange: (detail: unknown) => {
          hoverCalls.push(detail);
        },
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
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1", displayName: "美鈴" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    gridElement.children[24]?.onmouseenter?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({
        title: "美鈴",
        lines: expect.arrayContaining([
          "サブ効果: 隠岐奈",
          "他の自軍 unit の sub slot に入れます。",
        ]),
      }),
    ]);
  });

  test("shared board attached Okina sub slot publishes hero-specific hover detail", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const hoverCalls: unknown[] = [];

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
      },
      {
        client,
        gamePlayerId: "player-1",
        joinOrCreate: async () => room,
        isSubUnitSystemEnabled: () => true,
        getPlayerBoardSubUnits: () => ["24:hero:okina"],
        getPlayerFacingPhase: () => "deploy",
        getPlayerPlacementSide: () => "raid",
        onHoverDetailChange: (detail: unknown) => {
          hoverCalls.push(detail);
        },
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
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1", displayName: "美鈴" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const subSlot = findDescendantByClass(gridElement.children[24], "shared-board-sub-slot");
    if (!subSlot) {
      throw new Error("Expected attached sub slot to be rendered");
    }

    (subSlot as FakeElement & { onmouseenter?: () => void }).onmouseenter?.();

    expect(hoverCalls).toEqual([
      expect.objectContaining({
        kicker: "Sub Unit",
        title: "隠岐奈",
        portraitKey: "okina",
        lines: expect.arrayContaining([
          "装着先: 美鈴",
          "他の自軍 unit の sub slot に入れます。",
        ]),
      }),
    ]);
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
    expect(findDescendantByClass(gridElement.children[8], "shared-board-unit-card")).toBeNull();
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
          portraitKey: "koishi",
        },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const unit = findDescendantByClass(gridElement.children[7], "shared-board-unit-card");
    expect(unit?.className).toContain("shared-board-unit");
    expect(unit?.className).toContain("shared-board-unit-card");

    const portrait = unit?.children[1] as unknown as { src?: string; alt?: string; className?: string };
    expect(portrait?.className).toContain("shared-board-portrait");
    expect(portrait?.src).toBe("/pics/processed/front/koishi.png");
    expect(portrait?.alt).toBe("古明地こいし");

    const metaWrap = unit?.children[2];
    expect(metaWrap?.className).toContain("shared-board-unit-meta-wrap");

    const nameplate = metaWrap?.children[1];
    expect(nameplate?.className).toContain("shared-board-display-name");
    expect(nameplate?.className).toContain("shared-board-unit-meta");
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
          portraitKey: "koishi",
        },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    });

    const unit = findDescendantByClass(gridElement.children[7], "shared-board-unit-card");
    expect(unit?.className).toContain("shared-board-unit");

    const portrait = unit?.children[1] as unknown as { src?: string; alt?: string; className?: string };
    expect(portrait?.src).not.toBe("/pics/processed/front/koishi.png");
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
      message: "That cell is occupied by another player. Pick an open cell.",
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
      message: "That cell is outside the center combat area. Pick one of the center cells.",
      type: "error",
    }]);
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");
  });

  test("shared board 6x6 raid placement rejects boss-half cells for ordinary raid units", async () => {
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
    }, 0);

    expect(sendCalls.filter((entry) => entry.type === "shared_place_unit")).toEqual([]);
    expect(messages).toEqual([{
      message: "That cell is outside the lower raid deployment half. Pick an open cell there.",
      type: "error",
    }]);
  });

  test("shared board 6x6 raid placement allows ordinary raid units anywhere in the lower half", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const sendCalls: Array<{ type: string; payload: unknown }> = [];

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
        showMessage: () => {},
      },
    );

    await connectSharedBoard(client as object);
    if (!stateChangeHandler) {
      throw new Error("Expected stateChangeHandler to be registered");
    }

    const state = {
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        19: { unitId: "vanguard-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    };
    const applyStateChange = stateChangeHandler as (state: unknown) => void;
    applyStateChange(state);

    gridElement.children[19]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("vanguard-1");

    handleSharedCellClick(state, 30);

    expect(sendCalls).toContainEqual({
      type: "shared_place_unit",
      payload: { unitId: "vanguard-1", toCell: 30 },
    });
  });

  test("shared board lets hero units move anywhere in the lower raid half", async () => {
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

    const state = {
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        30: { unitId: "hero:player-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    };
    const applyStateChange = stateChangeHandler as (state: unknown) => void;
    applyStateChange(state);

    gridElement.children[30]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("hero:player-1");

    handleSharedCellClick(state, 24);

    expect(sendCalls).toContainEqual({
      type: "shared_place_unit",
      payload: { unitId: "hero:player-1", toCell: 24 },
    });
    expect(messages).toEqual([]);
  });

  test("shared board blocks normal heroes from targeting occupied allied cells", async () => {
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
        getSelectedHeroId: () => "reimu",
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

    const state = {
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1" },
        30: { unitId: "hero:player-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    };
    const applyStateChange = stateChangeHandler as (state: unknown) => void;
    applyStateChange(state);

    gridElement.children[30]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("hero:player-1");

    handleSharedCellClick(state, 24);

    expect(sendCalls.filter((entry) => entry.type === "shared_place_unit")).toEqual([]);
    expect(messages).toEqual([{
      message: "Only Okina can enter an occupied allied cell. Other heroes need an open raid cell.",
      type: "error",
    }]);
  });

  test("shared board lets Okina target occupied allied cells", async () => {
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
        getSelectedHeroId: () => "okina",
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

    const state = {
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        24: { unitId: "vanguard-1", ownerId: "player-1" },
        30: { unitId: "hero:player-1", ownerId: "player-1" },
      },
      cursors: {},
      players: {
        "player-1": { isSpectator: false },
      },
    };
    const applyStateChange = stateChangeHandler as (state: unknown) => void;
    applyStateChange(state);

    gridElement.children[30]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("hero:player-1");

    handleSharedCellClick(state, 24);

    expect(sendCalls).toContainEqual({
      type: "shared_place_unit",
      payload: { unitId: "hero:player-1", toCell: 24 },
    });
    expect(messages).toEqual([]);
  });

  test("shared board lets boss units move anywhere in the upper boss half", async () => {
    const gridElement = new FakeElement();
    const cursorListElement = new FakeElement();
    const sendCalls: Array<{ type: string; payload: unknown }> = [];
    const messages: Array<{ message: string; type: string }> = [];

    let stateChangeHandler: ((state: unknown) => void) | null = null;

    const room = {
      sessionId: "player-2",
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
        gamePlayerId: "player-2",
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

    const state = {
      boardWidth: 6,
      boardHeight: 6,
      cells: {
        2: { unitId: "boss:player-2", ownerId: "player-2" },
      },
      cursors: {},
      players: {
        "player-2": { isSpectator: false },
      },
    };
    const applyStateChange = stateChangeHandler as (state: unknown) => void;
    applyStateChange(state);

    gridElement.children[2]?.onpointerdown?.();
    expect(getSelectedSharedUnitId()).toBe("boss:player-2");

    handleSharedCellClick(state, 16);

    expect(sendCalls).toContainEqual({
      type: "shared_place_unit",
      payload: { unitId: "boss:player-2", toCell: 16 },
    });
    expect(messages).toEqual([]);
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
      "Board cell 0, outside the center combat area",
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
