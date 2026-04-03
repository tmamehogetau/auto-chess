import { describe, expect, test } from "vitest";

import { RoundStateReceiver } from "../../src/client/round-state-receiver";
import {
  SERVER_MESSAGE_TYPES,
  type RoundStateMessage,
  type UnitEffectSetId,
} from "../../src/shared/room-messages";

class FakeRoom {
  private readonly messageListeners = new Map<string, Set<(message: unknown) => void>>();

  private readonly stateChangeListeners = new Set<(state: { setId?: UnitEffectSetId }) => void>();

  public state?: { setId?: UnitEffectSetId };

  public onMessage<T>(type: string, callback: (message: T) => void): () => void {
    const currentListeners = this.messageListeners.get(type) ?? new Set<(message: unknown) => void>();
    const listener = callback as (message: unknown) => void;

    currentListeners.add(listener);
    this.messageListeners.set(type, currentListeners);

    return () => {
      currentListeners.delete(listener);
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

  public emit(type: string, message: unknown): void {
    const listeners = this.messageListeners.get(type);

    if (!listeners) {
      return;
    }

    for (const callback of listeners) {
      callback(message);
    }
  }

  public emitStateChange(state: { setId?: UnitEffectSetId }): void {
    this.state = state;

    for (const callback of this.stateChangeListeners) {
      callback(state);
    }
  }
}

describe("RoundStateReceiver", () => {
  test("round_state受信でランキング表示データを更新する", () => {
    const room = new FakeRoom();
    const receiver = new RoundStateReceiver();

    room.state = { setId: "set2" };

    receiver.attach(room);

    const message: RoundStateMessage = {
      phase: "Prep",
      roundIndex: 3,
      phaseDeadlineAtMs: 123_456,
      ranking: ["playerA", "playerB", "playerC", "playerD"],
    };

    room.emit(SERVER_MESSAGE_TYPES.ROUND_STATE, message);

    expect(receiver.roundLabelForDisplay).toBe("Round 4");
    expect(receiver.rankingForDisplay).toEqual([
      "playerA",
      "playerB",
      "playerC",
      "playerD",
    ]);
    expect(receiver.setIdForDisplay).toBe("set2");
  });

  test("未受信時は空表示を返す", () => {
    const room = new FakeRoom();
    const receiver = new RoundStateReceiver();

    receiver.attach(room);

    expect(receiver.roundLabelForDisplay).toBe("Round -");
    expect(receiver.rankingForDisplay).toEqual([]);
    expect(receiver.setIdForDisplay).toBe("-");
  });

  test("未受信でもstateのsetIdがあれば表示できる", () => {
    const room = new FakeRoom();
    const receiver = new RoundStateReceiver();

    room.state = { setId: "set1" };
    receiver.attach(room);

    expect(receiver.roundLabelForDisplay).toBe("Round -");
    expect(receiver.rankingForDisplay).toEqual([]);
    expect(receiver.setIdForDisplay).toBe("set1");
  });

  test("stateにsetIdがない場合はround_state受信後もsetId表示は変わらない", () => {
    const room = new FakeRoom();
    const receiver = new RoundStateReceiver();

    receiver.attach(room);

    const message: RoundStateMessage = {
      phase: "Prep",
      roundIndex: 1,
      phaseDeadlineAtMs: 10_000,
      ranking: ["playerA", "playerB", "playerC", "playerD"],
    };

    room.emit(SERVER_MESSAGE_TYPES.ROUND_STATE, message);

    expect(receiver.roundLabelForDisplay).toBe("Round 2");
    expect(receiver.setIdForDisplay).toBe("-");
  });

  test("state changeイベントでsetId表示を更新できる", () => {
    const room = new FakeRoom();
    const receiver = new RoundStateReceiver();

    room.state = { setId: "set1" };
    receiver.attach(room);

    room.emitStateChange({ setId: "set2" });

    expect(receiver.setIdForDisplay).toBe("set2");
  });

  test("detach後は古いroomイベントで表示が更新されない", () => {
    const room = new FakeRoom();
    const receiver = new RoundStateReceiver();

    room.state = { setId: "set1" };
    receiver.attach(room);

    room.emit(SERVER_MESSAGE_TYPES.ROUND_STATE, {
      phase: "Prep",
      roundIndex: 2,
      phaseDeadlineAtMs: 20_000,
      ranking: ["playerA", "playerB", "playerC", "playerD"],
    } satisfies RoundStateMessage);

    receiver.detach();

    room.emit(SERVER_MESSAGE_TYPES.ROUND_STATE, {
      phase: "Battle",
      roundIndex: 3,
      phaseDeadlineAtMs: 30_000,
      ranking: ["playerD", "playerC", "playerB", "playerA"],
    } satisfies RoundStateMessage);
    room.emitStateChange({ setId: "set2" });

    expect(receiver.roundLabelForDisplay).toBe("Round 3");
    expect(receiver.setIdForDisplay).toBe("set1");
  });

  test("attachし直すと新しいroomの状態を優先する", () => {
    const firstRoom = new FakeRoom();
    const secondRoom = new FakeRoom();
    const receiver = new RoundStateReceiver();

    firstRoom.state = { setId: "set1" };
    secondRoom.state = { setId: "set2" };

    receiver.attach(firstRoom);
    firstRoom.emit(SERVER_MESSAGE_TYPES.ROUND_STATE, {
      phase: "Prep",
      roundIndex: 1,
      phaseDeadlineAtMs: 10_000,
      ranking: ["playerA", "playerB", "playerC", "playerD"],
    } satisfies RoundStateMessage);

    receiver.attach(secondRoom);

    firstRoom.emit(SERVER_MESSAGE_TYPES.ROUND_STATE, {
      phase: "Elimination",
      roundIndex: 9,
      phaseDeadlineAtMs: 90_000,
      ranking: ["playerD", "playerC", "playerB", "playerA"],
    } satisfies RoundStateMessage);
    secondRoom.emit(SERVER_MESSAGE_TYPES.ROUND_STATE, {
      phase: "Prep",
      roundIndex: 2,
      phaseDeadlineAtMs: 20_000,
      ranking: ["playerA", "playerD", "playerB", "playerC"],
    } satisfies RoundStateMessage);

    expect(receiver.roundLabelForDisplay).toBe("Round 3");
    expect(receiver.setIdForDisplay).toBe("set2");
  });
});
