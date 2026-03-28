import { matchMaker } from "colyseus";

import type { MatchRoomController } from "../match-room-controller";
import type { SharedBoardCellState } from "../schema/shared-board-state";
import { SharedBoardShadowObserver } from "../shared-board-shadow-observer";
import { buildReconnectPlan } from "./reconnect-policy";
import type { PlacementChangeListener, SharedBoardRoom } from "../rooms/shared-board-room";

export type BridgeState =
  | "DISABLED"
  | "CONNECTING"
  | "READY"
  | "DEGRADED"
  | "CLOSED";

export interface BridgeConnectionManagerDeps {
  controller: MatchRoomController;
  isEnabled(): boolean;
  getState(): BridgeState;
  setState(state: BridgeState): void;
  getSharedBoardRoomId(): string | null;
  setSharedBoardRoomId(roomId: string | null): void;
  getSharedBoardRoom(): SharedBoardRoom | null;
  setSharedBoardRoom(room: SharedBoardRoom | null): void;
  getShadowObserver(): SharedBoardShadowObserver | null;
  setShadowObserver(observer: SharedBoardShadowObserver | null): void;
  getUnsubscribeHandle(): (() => void) | null;
  setUnsubscribeHandle(handle: (() => void) | null): void;
  getPlacementChangeListener(): PlacementChangeListener | null;
  setPlacementChangeListener(listener: PlacementChangeListener | null): void;
  getReconnectAttempts(): number;
  setReconnectAttempts(attempts: number): void;
  getHasEverBeenReady(): boolean;
  setHasEverBeenReady(value: boolean): void;
  getMaxReconnectAttempts(): number;
  getReconnectTimer(): NodeJS.Timeout | null;
  setReconnectTimer(timer: NodeJS.Timeout | null): void;
  getFindSharedBoardRoomIdWithRetryOverride(): (() => Promise<string>) | null;
  roomLookupRetryCount: number;
  roomLookupRetryDelayMs: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  onPlacementChange(playerId: string, cells: SharedBoardCellState[]): void;
  onDiffObservation(): void;
  onReadySync(): void;
}

export class BridgeConnectionManager {
  public constructor(
    private readonly deps: BridgeConnectionManagerDeps,
    enabled: boolean,
  ) {
    if (!enabled) {
      this.deps.setState("DISABLED");
      return;
    }

    this.deps.setState("CONNECTING");
    void this.connect();
  }

  public async connect(): Promise<void> {
    if (!this.deps.isEnabled() || this.deps.getState() === "CLOSED") {
      return;
    }

    this.deps.setState("CONNECTING");

    try {
      if (!this.deps.getSharedBoardRoomId()) {
        const roomId = this.deps.getFindSharedBoardRoomIdWithRetryOverride()
          ? await this.deps.getFindSharedBoardRoomIdWithRetryOverride()!()
          : await this.findSharedBoardRoomIdWithRetry();
        this.deps.setSharedBoardRoomId(roomId);
      }

      const resolvedRoomId = this.deps.getSharedBoardRoomId();
      if (!resolvedRoomId) {
        throw new Error("No shared_board room found");
      }
      const room = matchMaker.getLocalRoomById(resolvedRoomId);
      if (!room) {
        this.deps.setSharedBoardRoomId(null);
        throw new Error(`SharedBoard room ${resolvedRoomId} not found in local process`);
      }

      const sharedBoardRoom = room as unknown as SharedBoardRoom;
      this.clearExistingSubscriptions();

      this.deps.setSharedBoardRoom(sharedBoardRoom);
      const shadowObserver = new SharedBoardShadowObserver(this.deps.controller);
      shadowObserver.attachSharedBoard(sharedBoardRoom);
      this.deps.setShadowObserver(shadowObserver);

      this.setupPlacementChangeListener(sharedBoardRoom);
      this.setupStateChangeListener();

      this.deps.setState("READY");
      this.deps.setHasEverBeenReady(true);
      this.deps.setReconnectAttempts(0);
      this.deps.onReadySync();

      const reconnectTimer = this.deps.getReconnectTimer();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        this.deps.setReconnectTimer(null);
      }
    } catch (error) {
      const shouldSuppressConnectLogs =
        !this.deps.getHasEverBeenReady() && this.isExpectedSharedBoardUnavailableError(error);

      if (!shouldSuppressConnectLogs) {
        console.error("[SharedBoardBridge] Connection failed:", error);
      }

      this.scheduleReconnect({ silent: shouldSuppressConnectLogs });
    }
  }

  public scheduleReconnect(options: { silent?: boolean } = {}): void {
    const silent = options.silent ?? false;

    if (this.deps.getReconnectTimer()) {
      return;
    }

    const reconnectPlan = buildReconnectPlan({
      reconnectAttempts: this.deps.getReconnectAttempts(),
      maxReconnectAttempts: this.deps.getMaxReconnectAttempts(),
      reconnectBaseDelayMs: this.deps.reconnectBaseDelayMs,
      reconnectMaxDelayMs: this.deps.reconnectMaxDelayMs,
    });

    this.deps.setState(reconnectPlan.nextState);

    if (!reconnectPlan.shouldSchedule || reconnectPlan.delayMs === null) {
      if (!silent) {
        console.error("[SharedBoardBridge] Max reconnection attempts reached");
      }
      return;
    }

    this.deps.setReconnectAttempts(reconnectPlan.attempt);

    if (!silent) {
      console.log(
        `[SharedBoardBridge] Reconnecting in ${reconnectPlan.delayMs}ms (attempt ${reconnectPlan.attempt})`,
      );
    }

    const timer = setTimeout(() => {
      this.deps.setReconnectTimer(null);
      void this.connect();
    }, reconnectPlan.delayMs);
    this.deps.setReconnectTimer(timer);
  }

  public dispose(): void {
    this.deps.setState("CLOSED");

    const reconnectTimer = this.deps.getReconnectTimer();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      this.deps.setReconnectTimer(null);
    }

    const unsubscribeHandle = this.deps.getUnsubscribeHandle();
    if (unsubscribeHandle) {
      unsubscribeHandle();
      this.deps.setUnsubscribeHandle(null);
    }

    const sharedBoardRoom = this.deps.getSharedBoardRoom();
    if (sharedBoardRoom) {
      sharedBoardRoom.offPlacementChange(this.deps.getPlacementChangeListener() ?? undefined);
    }
    this.deps.setPlacementChangeListener(null);

    const shadowObserver = this.deps.getShadowObserver();
    if (shadowObserver) {
      shadowObserver.detachSharedBoard();
      this.deps.setShadowObserver(null);
    }

    this.deps.setSharedBoardRoom(null);
  }

  private clearExistingSubscriptions(): void {
    const unsubscribeHandle = this.deps.getUnsubscribeHandle();
    if (unsubscribeHandle) {
      unsubscribeHandle();
      this.deps.setUnsubscribeHandle(null);
    }

    const sharedBoardRoom = this.deps.getSharedBoardRoom();
    if (sharedBoardRoom) {
      sharedBoardRoom.offPlacementChange(this.deps.getPlacementChangeListener() ?? undefined);
    }
  }

  private setupStateChangeListener(): void {
    const checkInterval = setInterval(() => {
      this.deps.onDiffObservation();
    }, 100);

    this.deps.setUnsubscribeHandle(() => {
      clearInterval(checkInterval);
    });
  }

  private setupPlacementChangeListener(sharedBoardRoom: SharedBoardRoom): void {
    const listener: PlacementChangeListener = (playerId, cells) => {
      this.deps.onPlacementChange(playerId, cells);
    };

    this.deps.setPlacementChangeListener(listener);
    sharedBoardRoom.onPlacementChange(listener);
  }

  private isExpectedSharedBoardUnavailableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message === "No shared_board room found"
      || error.message.includes("not found in local process")
    );
  }

  private async findSharedBoardRoomIdWithRetry(): Promise<string> {
    for (let attempt = 1; attempt <= this.deps.roomLookupRetryCount; attempt += 1) {
      const rooms = await matchMaker.query<SharedBoardRoom>({ name: "shared_board" });
      const roomId = rooms[0]?.roomId;

      if (roomId) {
        return roomId;
      }

      if (attempt < this.deps.roomLookupRetryCount) {
        await this.delay(this.deps.roomLookupRetryDelayMs);
      }
    }

    throw new Error("No shared_board room found");
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
