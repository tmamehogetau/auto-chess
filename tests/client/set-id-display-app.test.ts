import { describe, expect, test } from "vitest";

import type { RoundStateMessage, UnitEffectSetId } from "../../src/shared/room-messages";
import { SERVER_MESSAGE_TYPES } from "../../src/shared/room-messages";
import type { TextDisplayTarget } from "../../src/client/ui/round-state-display-controller";
import { SetIdDisplayApp } from "../../src/client/ui/set-id-display-app";

const flushMicrotasks = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    queueMicrotask(() => {
      resolve();
    });
  });
};

class FakeDisplay implements TextDisplayTarget {
  public value = "";

  public setText(value: string): void {
    this.value = value;
  }
}

class FakeRoom {
  private readonly messageListeners = new Map<string, Set<(message: unknown) => void>>();

  private readonly stateChangeListeners = new Set<(state: { setId?: UnitEffectSetId }) => void>();

  public state?: { setId?: UnitEffectSetId };

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
}

describe("SetIdDisplayApp", () => {
  test("start時に現在のsetIdを表示する", () => {
    const display = new FakeDisplay();
    const app = new SetIdDisplayApp(display);
    const room = new FakeRoom();

    room.state = { setId: "set1" };
    app.start(room);

    expect(display.value).toBe("set1");
  });

  test("state change後に表示を更新する", async () => {
    const display = new FakeDisplay();
    const app = new SetIdDisplayApp(display);
    const room = new FakeRoom();

    room.state = { setId: "set1" };
    app.start(room);
    room.emitStateChange({ setId: "set2" });
    await flushMicrotasks();

    expect(display.value).toBe("set2");
  });

  test("stop後は古いroomのイベントで表示が更新されない", async () => {
    const display = new FakeDisplay();
    const app = new SetIdDisplayApp(display);
    const room = new FakeRoom();

    room.state = { setId: "set1" };
    app.start(room);
    app.stop();

    room.emitStateChange({ setId: "set2" });
    room.emitRoundState({
      phase: "Prep",
      roundIndex: 2,
      phaseDeadlineAtMs: 20_000,
      ranking: ["playerA", "playerB", "playerC", "playerD"],
    });
    await flushMicrotasks();

    expect(display.value).toBe("set1");
  });

  test("startし直すと新しいroomの表示を優先する", async () => {
    const display = new FakeDisplay();
    const app = new SetIdDisplayApp(display);
    const firstRoom = new FakeRoom();
    const secondRoom = new FakeRoom();

    firstRoom.state = { setId: "set1" };
    secondRoom.state = { setId: "set2" };

    app.start(firstRoom);
    app.start(secondRoom);

    firstRoom.emitStateChange({ setId: "set1" });
    secondRoom.emitStateChange({ setId: "set2" });
    await flushMicrotasks();

    expect(display.value).toBe("set2");
  });
});
