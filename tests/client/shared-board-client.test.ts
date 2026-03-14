import { beforeEach, describe, expect, test } from "vitest";

// @ts-expect-error JS client module has no declaration file.
import { connectSharedBoard, initSharedBoardClient, leaveSharedBoardRoom } from "../../src/client/shared-board-client.js";

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
  public innerHTML = "";
  public draggable = false;
  public title = "";
  public onpointerdown: (() => void) | null = null;
  public ondragstart: ((event: unknown) => void) | null = null;
  public ondragend: (() => void) | null = null;
  public ondragover: ((event: unknown) => void) | null = null;
  public ondragleave: (() => void) | null = null;
  public ondrop: ((event: unknown) => void) | null = null;
  public classList: FakeClassList;
  public children: FakeElement[] = [];

  public constructor() {
    this.classList = new FakeClassList(this);
  }

  public append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  public appendChild(child: FakeElement): void {
    this.children.push(child);
  }
}

describe("shared-board client", () => {
  beforeEach(() => {
    leaveSharedBoardRoom();
    globalThis.document = {
      createElement: () => new FakeElement(),
    } as unknown as Document;
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
      boardHeight: 4,
      cells: {},
      cursors: {},
      players: {},
    });

    expect(gridElement.children).toHaveLength(24);
    expect(gridElement.children[0]?.dataset.raidRegion).toBe("boss-top");
    expect(gridElement.children[5]?.dataset.raidRegion).toBe("boss-top");
    expect(gridElement.children[18]?.dataset.raidRegion).toBe("raid-bottom");
    expect(gridElement.children[23]?.dataset.raidRegion).toBe("raid-bottom");
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
      boardHeight: 4,
      cells: {},
      cursors: {},
      players: {},
    });

    expect(gridElement.children[0]?.className).toContain("zone-boss");
    expect(gridElement.children[23]?.className).toContain("zone-raid");
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
    expect(messages).toEqual([{ message: "Invalid shared board drop target", type: "error" }]);
    expect(invalidTargetCell?.dataset.dropInvalid).toBeUndefined();
    expect(invalidTargetCell?.className).not.toContain("drag-over");
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
});
