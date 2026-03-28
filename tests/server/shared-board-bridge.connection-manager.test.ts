import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => ({
  matchMaker: {
    getLocalRoomById: vi.fn(),
    query: vi.fn(),
  },
}));

import { matchMaker } from "colyseus";

import type { MatchRoomController } from "../../src/server/match-room-controller";
import {
  BridgeConnectionManager,
  type BridgeConnectionManagerDeps,
  type BridgeState,
} from "../../src/server/shared-board-bridge/connection-manager";

type Harness = {
  manager: BridgeConnectionManager;
  deps: BridgeConnectionManagerDeps;
  state: BridgeState;
  enabled: boolean;
  sharedBoardRoomId: string | null;
  sharedBoardRoom: {
    onPlacementChange: ReturnType<typeof vi.fn>;
    offPlacementChange: ReturnType<typeof vi.fn>;
  } | null;
  shadowObserver: { detachSharedBoard: ReturnType<typeof vi.fn> } | null;
  unsubscribeHandle: (() => void) | null;
  placementChangeListener: BridgeConnectionManagerDeps["getPlacementChangeListener"] extends () => infer T ? T : never;
  reconnectAttempts: number;
  hasEverBeenReady: boolean;
  reconnectTimer: NodeJS.Timeout | null;
  findRoomIdOverride: (() => Promise<string>) | null;
};

function createHarness(enabled = true): Harness {
  const harness = {} as Harness;
  harness.state = "DISABLED";
  harness.enabled = enabled;
  harness.sharedBoardRoomId = null;
  harness.sharedBoardRoom = null;
  harness.shadowObserver = null;
  harness.unsubscribeHandle = null;
  harness.placementChangeListener = null;
  harness.reconnectAttempts = 0;
  harness.hasEverBeenReady = false;
  harness.reconnectTimer = null;
  harness.findRoomIdOverride = null;

  const deps: BridgeConnectionManagerDeps = {
    controller: {} as MatchRoomController,
    isEnabled: () => harness.enabled,
    getState: () => harness.state,
    setState: (state) => {
      harness.state = state;
    },
    getSharedBoardRoomId: () => harness.sharedBoardRoomId,
    setSharedBoardRoomId: (roomId) => {
      harness.sharedBoardRoomId = roomId;
    },
    getSharedBoardRoom: () => harness.sharedBoardRoom as never,
    setSharedBoardRoom: (room) => {
      harness.sharedBoardRoom = room as never;
    },
    getShadowObserver: () => harness.shadowObserver as never,
    setShadowObserver: (observer) => {
      harness.shadowObserver = observer as never;
    },
    getUnsubscribeHandle: () => harness.unsubscribeHandle,
    setUnsubscribeHandle: (handle) => {
      harness.unsubscribeHandle = handle;
    },
    getPlacementChangeListener: () => harness.placementChangeListener,
    setPlacementChangeListener: (listener) => {
      harness.placementChangeListener = listener;
    },
    getReconnectAttempts: () => harness.reconnectAttempts,
    setReconnectAttempts: (attempts) => {
      harness.reconnectAttempts = attempts;
    },
    getHasEverBeenReady: () => harness.hasEverBeenReady,
    setHasEverBeenReady: (value) => {
      harness.hasEverBeenReady = value;
    },
    getMaxReconnectAttempts: () => 1,
    getReconnectTimer: () => harness.reconnectTimer,
    setReconnectTimer: (timer) => {
      harness.reconnectTimer = timer;
    },
    getFindSharedBoardRoomIdWithRetryOverride: () => harness.findRoomIdOverride,
    roomLookupRetryCount: 1,
    roomLookupRetryDelayMs: 1,
    reconnectBaseDelayMs: 1,
    reconnectMaxDelayMs: 1,
    onPlacementChange: vi.fn(),
    onDiffObservation: vi.fn(),
    onReadySync: vi.fn(),
  };

  harness.deps = deps;
  harness.manager = new BridgeConnectionManager(deps, enabled);

  return harness;
}

describe("BridgeConnectionManager", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stays CLOSED when dispose races with an in-flight room lookup", async () => {
    const harness = createHarness(false);
    let resolveRoomId: ((roomId: string) => void) | undefined;
    harness.enabled = true;
    harness.findRoomIdOverride = () =>
      new Promise<string>((resolve) => {
        resolveRoomId = resolve;
      });

    const connectPromise = harness.manager.connect();
    harness.manager.dispose();
    if (resolveRoomId) {
      resolveRoomId("shared-room-1");
    }
    await connectPromise;

    expect(matchMaker.getLocalRoomById).not.toHaveBeenCalled();
    expect(harness.state).toBe("CLOSED");
    expect(harness.sharedBoardRoom).toBeNull();
    expect(harness.shadowObserver).toBeNull();
  });

  it("detaches the previous shadow observer before attaching a replacement", async () => {
    const oldSharedBoardRoom = {
      onPlacementChange: vi.fn(),
      offPlacementChange: vi.fn(),
    };
    const newSharedBoardRoom = {
      onPlacementChange: vi.fn(),
      offPlacementChange: vi.fn(),
    };
    const oldShadowObserver = {
      detachSharedBoard: vi.fn(),
    };
    const unsubscribeHandle = vi.fn();
    const harness = createHarness(false);
    harness.enabled = true;
    harness.sharedBoardRoomId = "shared-room-1";
    harness.sharedBoardRoom = oldSharedBoardRoom;
    harness.shadowObserver = oldShadowObserver;
    harness.unsubscribeHandle = unsubscribeHandle;
    vi.mocked(matchMaker.getLocalRoomById).mockReturnValue(newSharedBoardRoom as never);

    await harness.manager.connect();

    expect(unsubscribeHandle).toHaveBeenCalledTimes(1);
    expect(oldSharedBoardRoom.offPlacementChange).toHaveBeenCalledTimes(1);
    expect(oldShadowObserver.detachSharedBoard).toHaveBeenCalledTimes(1);
    expect(newSharedBoardRoom.onPlacementChange).toHaveBeenCalledTimes(1);
    expect(harness.state).toBe("READY");
    expect(harness.sharedBoardRoom).toBe(newSharedBoardRoom);
    expect(harness.shadowObserver).not.toBe(oldShadowObserver);
  });
});
