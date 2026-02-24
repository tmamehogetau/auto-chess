import { describe, expect, test } from "vitest";

import {
  DEFAULT_ROOM_NAME,
  DEFAULT_SET_ID_SELECTOR,
  attachSetIdDisplay,
  connectAndAttachSetIdDisplay,
  type BrowserClient,
} from "../../src/client/main";
import { SERVER_MESSAGE_TYPES, type RoundStateMessage, type UnitEffectSetId } from "../../src/shared/room-messages";

const flushMicrotasks = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    queueMicrotask(() => {
      resolve();
    });
  });
};

class FakeRoom {
  private readonly messageListeners = new Map<string, Set<(message: unknown) => void>>();

  private readonly stateChangeListeners = new Set<(state: { setId?: UnitEffectSetId }) => void>();

  public state?: { setId?: UnitEffectSetId };

  public leaveCallCount = 0;

  public lastLeaveConsented: boolean | null = null;

  public onMessage<T>(type: string, callback: (message: T) => void): () => void {
    const listeners =
      this.messageListeners.get(type) ?? new Set<(message: unknown) => void>();
    const listener = callback as (message: unknown) => void;

    listeners.add(listener);
    this.messageListeners.set(type, listeners);

    return () => {
      listeners.delete(listener);
    };
  }

  public onStateChange(
    callback: (state: { setId?: UnitEffectSetId }) => void,
  ): { remove: (listener: (state: { setId?: UnitEffectSetId }) => void) => void } {
    this.stateChangeListeners.add(callback);

    return {
      remove: (listener) => {
        this.stateChangeListeners.delete(listener);
      },
    };
  }

  public emitRoundState(message: RoundStateMessage): void {
    const listeners = this.messageListeners.get(SERVER_MESSAGE_TYPES.ROUND_STATE);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(message);
    }
  }

  public emitStateChange(state: { setId?: UnitEffectSetId }): void {
    this.state = state;

    for (const listener of this.stateChangeListeners) {
      listener(state);
    }
  }

  public leave(consented = true): Promise<void> {
    this.leaveCallCount += 1;
    this.lastLeaveConsented = consented;

    return Promise.resolve();
  }
}

class FakeRoot {
  private readonly elements = new Map<string, { textContent: string | null }>();

  public setElement(selector: string, initialText: string | null = null): { textContent: string | null } {
    const element = { textContent: initialText };
    this.elements.set(selector, element);
    return element;
  }

  public querySelector(selector: string): unknown {
    return this.elements.get(selector) ?? null;
  }
}

class FakeClient implements BrowserClient {
  public joinOrCreateCallCount = 0;

  public lastRoomName = "";

  public lastRoomOptions: Record<string, unknown> | undefined;

  public shouldThrow = false;

  public roomToReturn: FakeRoom;

  public constructor(room: FakeRoom) {
    this.roomToReturn = room;
  }

  public async joinOrCreate(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<FakeRoom> {
    this.joinOrCreateCallCount += 1;
    this.lastRoomName = roomName;
    this.lastRoomOptions = options;

    if (this.shouldThrow) {
      throw new Error("join failed");
    }

    return this.roomToReturn;
  }
}

describe("attachSetIdDisplay", () => {
  test("root未指定かつdocumentがない環境ではnullを返す", () => {
    const room = new FakeRoom();

    const binding = attachSetIdDisplay(room);

    expect(binding).toBeNull();
  });

  test("selectorに一致しない場合はnullを返す", () => {
    const room = new FakeRoom();
    const root = new FakeRoot();

    const binding = attachSetIdDisplay(room, {
      root,
      selector: "#set-id",
    });

    expect(binding).toBeNull();
  });

  test("初期stateのsetIdを表示し、state changeで更新する", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const element = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");

    room.state = { setId: "set1" };

    const binding = attachSetIdDisplay(room, {
      root,
    });

    if (!binding) {
      throw new Error("Expected display binding");
    }

    expect(element.textContent).toBe("set1");

    room.emitStateChange({ setId: "set2" });
    await flushMicrotasks();

    expect(element.textContent).toBe("set2");
  });

  test("stop後は更新されない", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const element = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");

    room.state = { setId: "set1" };
    const binding = attachSetIdDisplay(room, { root });

    if (!binding) {
      throw new Error("Expected display binding");
    }

    binding.stop();
    room.emitStateChange({ setId: "set2" });
    room.emitRoundState({
      phase: "Prep",
      roundIndex: 2,
      phaseDeadlineAtMs: 12_000,
      ranking: ["playerA", "playerB", "playerC", "playerD"],
    });
    await flushMicrotasks();

    expect(element.textContent).toBe("set1");
  });
});

describe("connectAndAttachSetIdDisplay", () => {
  test("joinOrCreate後に表示を接続してbindingを返す", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const element = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");
    const client = new FakeClient(room);

    room.state = { setId: "set1" };

    const binding = await connectAndAttachSetIdDisplay({
      endpoint: "http://localhost:2567",
      root,
      roomName: DEFAULT_ROOM_NAME,
      roomOptions: { setId: "set2" },
      createClient: async (_endpoint) => client,
    });

    if (!binding) {
      throw new Error("Expected connected binding");
    }

    expect(client.joinOrCreateCallCount).toBe(1);
    expect(client.lastRoomName).toBe(DEFAULT_ROOM_NAME);
    expect(client.lastRoomOptions).toEqual({ setId: "set2" });
    expect(element.textContent).toBe("set1");
  });

  test("selectorが見つからない場合はroomをleaveしてnullを返す", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const client = new FakeClient(room);

    const binding = await connectAndAttachSetIdDisplay({
      endpoint: "http://localhost:2567",
      root,
      createClient: async (_endpoint) => client,
    });

    expect(binding).toBeNull();
    expect(room.leaveCallCount).toBe(1);
    expect(room.lastLeaveConsented).toBe(true);
  });

  test("leaveはstopを含めて冪等に動作する", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const element = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");
    const client = new FakeClient(room);

    room.state = { setId: "set1" };

    const binding = await connectAndAttachSetIdDisplay({
      endpoint: "http://localhost:2567",
      root,
      createClient: async (_endpoint) => client,
    });

    if (!binding) {
      throw new Error("Expected connected binding");
    }

    await binding.leave(false);
    await binding.leave(false);

    room.emitStateChange({ setId: "set2" });
    await flushMicrotasks();

    expect(room.leaveCallCount).toBe(1);
    expect(room.lastLeaveConsented).toBe(false);
    expect(element.textContent).toBe("set1");
  });

  test("joinOrCreate失敗時はエラーをそのまま返す", async () => {
    const room = new FakeRoom();
    const client = new FakeClient(room);
    const root = new FakeRoot();

    client.shouldThrow = true;

    await expect(
      connectAndAttachSetIdDisplay({
        endpoint: "http://localhost:2567",
        root,
        createClient: async (_endpoint) => client,
      }),
    ).rejects.toThrow("join failed");
  });
});
