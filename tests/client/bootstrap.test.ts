import { describe, expect, test } from "vitest";

import { DEFAULT_ROOM_NAME, DEFAULT_SET_ID_SELECTOR, type BrowserClient } from "../../src/client/main";
import { startSetIdDisplayBootstrap } from "../../src/client/bootstrap";
import type { RoundStateMessage, UnitEffectSetId } from "../../src/shared/room-messages";
import { SERVER_MESSAGE_TYPES } from "../../src/shared/room-messages";

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

  public leave(): Promise<void> {
    this.leaveCallCount += 1;
    return Promise.resolve();
  }
}

class FakeRoot {
  private readonly elements = new Map<string, { textContent: string | null }>();

  public setElement(
    selector: string,
    initialText: string | null = null,
  ): { textContent: string | null } {
    const element = { textContent: initialText };
    this.elements.set(selector, element);
    return element;
  }

  public querySelector(selector: string): unknown {
    return this.elements.get(selector) ?? null;
  }
}

class FakeClient implements BrowserClient {
  public lastRoomName = "";

  public lastRoomOptions: Record<string, unknown> | undefined;

  public constructor(private readonly room: FakeRoom) {}

  public async joinOrCreate(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<FakeRoom> {
    this.lastRoomName = roomName;
    this.lastRoomOptions = options;
    return this.room;
  }
}

describe("startSetIdDisplayBootstrap", () => {
  test("setId付きで接続するとroomOptionsにsetIdが渡る", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const element = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");
    const client = new FakeClient(room);

    room.state = { setId: "set2" };

    const binding = await startSetIdDisplayBootstrap({
      endpoint: "http://localhost:2567",
      setId: "set2",
      root,
      createClient: async (_endpoint) => client,
    });

    if (!binding) {
      throw new Error("Expected bootstrap binding");
    }

    expect(client.lastRoomName).toBe(DEFAULT_ROOM_NAME);
    expect(client.lastRoomOptions).toEqual({ setId: "set2" });
    expect(element.textContent).toBe("set2");
  });

  test("setId未指定ではroomOptionsなしで接続する", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    root.setElement(DEFAULT_SET_ID_SELECTOR, "-");
    const client = new FakeClient(room);

    room.state = { setId: "set1" };

    const binding = await startSetIdDisplayBootstrap({
      endpoint: "http://localhost:2567",
      root,
      createClient: async (_endpoint) => client,
    });

    if (!binding) {
      throw new Error("Expected bootstrap binding");
    }

    expect(client.lastRoomName).toBe(DEFAULT_ROOM_NAME);
    expect(client.lastRoomOptions).toBeUndefined();
  });

  test("selector不一致時はnullを返してroomをleaveする", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const client = new FakeClient(room);

    const binding = await startSetIdDisplayBootstrap({
      endpoint: "http://localhost:2567",
      root,
      createClient: async (_endpoint) => client,
    });

    expect(binding).toBeNull();
    expect(room.leaveCallCount).toBe(1);
  });

  test("binding.leave後は表示が更新されない", async () => {
    const room = new FakeRoom();
    const root = new FakeRoot();
    const element = root.setElement(DEFAULT_SET_ID_SELECTOR, "-");
    const client = new FakeClient(room);

    room.state = { setId: "set1" };

    const binding = await startSetIdDisplayBootstrap({
      endpoint: "http://localhost:2567",
      root,
      createClient: async (_endpoint) => client,
    });

    if (!binding) {
      throw new Error("Expected bootstrap binding");
    }

    await binding.leave();
    room.emitStateChange({ setId: "set2" });
    await flushMicrotasks();

    expect(element.textContent).toBe("set1");
  });
});
