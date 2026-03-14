import { beforeEach, describe, expect, test } from "vitest";

// @ts-expect-error JS client module has no declaration file.
import { connectSharedBoard, initSharedBoardClient, leaveSharedBoardRoom } from "../../src/client/shared-board-client.js";

class FakeClassList {
  public add(..._tokens: string[]): void {}
  public remove(..._tokens: string[]): void {}
  public toggle(_token: string, _force?: boolean): void {}
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
  public classList = new FakeClassList();
  public children: FakeElement[] = [];

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
});
