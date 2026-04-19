import type { Room } from "colyseus";

import type {
  BattleTimelineEvent,
  BoardUnitPlacement,
  ShadowDiffMessage,
} from "../../shared/room-messages";
import type { ShadowDiffResult } from "../shared-board-shadow-observer";
import type { BridgeMonitor } from "../shared-board-bridge-monitor";
import type { BridgeState } from "./connection-manager";

type SharedBoardRoomLike = {
  applyBattleReplayFromGame?: (input: {
    phase: string;
    phaseDeadlineAtMs?: number;
    battleId: string;
    timeline: BattleTimelineEvent[];
  }) => { applied: number };
  setModeFromGame?: (input: {
    phase: string;
    phaseDeadlineAtMs?: number;
    mode?: "prep" | "battle";
  }) => void;
  applyPlacementsFromGame?: (
    playerId: string,
    placements: BoardUnitPlacement[],
    placementSide?: "boss" | "raid",
  ) => { applied: number; skipped: number };
  applyHeroPlacementFromGame?: (input: {
    playerId: string;
    heroId: string;
    cellIndex: number | null;
    unitLevel?: number;
  }) => void;
  applyBossPlacementFromGame?: (input: {
    playerId: string;
    bossId: string;
    cellIndex: number | null;
    unitLevel?: number;
  }) => void;
};

type ControllerLike = {
  phaseDeadlineAtMs?: number | null;
  getGameState?: () => { phase: string; roundIndex: number } | null;
  getSharedBattleReplay?: (phase: "Battle" | "Settle") => {
    phase: string;
    battleId: string;
    timeline: BattleTimelineEvent[];
  } | null;
  getPlayerIds?: () => string[];
  getBossPlayerId?: () => string | null;
  getBoardPlacementsForPlayer?: (playerId: string) => BoardUnitPlacement[];
  getSelectedHero?: (playerId: string) => string;
  getHeroPlacementForPlayer?: (playerId: string) => number | null;
  getSelectedBoss?: (playerId: string) => string;
  getBossPlacementForPlayer?: (playerId: string) => number | null;
  getSpecialUnitLevelForPlayer?: (playerId: string) => number;
};

type ShadowObserverLike = {
  observeAndCompare(): ShadowDiffResult;
};

export interface BridgeDiffBroadcasterDeps {
  gameRoom: Pick<Room, "broadcast">;
  controller: ControllerLike;
  getState(): BridgeState;
  getSharedBoardRoom(): SharedBoardRoomLike | null;
  getSharedBoardRoomId(): string | null;
  getShadowObserver(): ShadowObserverLike | null;
  getCurrentVersion(): number;
  getMonitor(): BridgeMonitor | null;
  getSeq(): number;
  setSeq(value: number): void;
  getLastObservationTime(): number;
  setLastObservationTime(value: number): void;
  minObservationIntervalMs: number;
  getLastSharedBoardPhase(): string | null;
  setLastSharedBoardPhase(value: string | null): void;
  getLastSharedBattleId(): string | null;
  setLastSharedBattleId(value: string | null): void;
  onScheduleReconnect(): void;
}

export class BridgeDiffBroadcaster {
  public constructor(
    private readonly deps: BridgeDiffBroadcasterDeps,
  ) {}

  public checkAndBroadcastDiff(): void {
    const now = Date.now();

    if (now - this.deps.getLastObservationTime() < this.deps.minObservationIntervalMs) {
      return;
    }
    this.deps.setLastObservationTime(now);

    if (!this.deps.getShadowObserver() || this.deps.getState() !== "READY") {
      return;
    }

    this.syncSharedBoardViewFromController();

    const gameState = this.deps.controller.getGameState?.();
    if (gameState?.phase !== "Prep") {
      return;
    }

    try {
      const diffResult = this.deps.getShadowObserver()!.observeAndCompare();

      if (diffResult.status !== "ok" || this.deps.getSeq() === 0) {
        this.broadcastDiff(diffResult);
      }
    } catch (error) {
      console.error("[SharedBoardBridge] Diff observation failed:", error);
      if (this.deps.getState() === "READY") {
        this.deps.onScheduleReconnect();
      }
    }
  }

  public syncSharedBoardViewFromController(forcePrepSync = false): void {
    const sharedBoardRoom = this.deps.getSharedBoardRoom();
    if (this.deps.getState() !== "READY" || !sharedBoardRoom) {
      return;
    }

    const gameState = this.deps.controller.getGameState?.();
    if (!gameState) {
      return;
    }

    const phase = gameState.phase;
    const phaseDeadlineAtMs = this.deps.controller.phaseDeadlineAtMs ?? 0;

    if (phase === "Battle" || phase === "Settle") {
      const replayMessage = this.deps.controller.getSharedBattleReplay?.(phase);

      if (replayMessage) {
        if (replayMessage.battleId !== this.deps.getLastSharedBattleId()) {
          sharedBoardRoom.applyBattleReplayFromGame?.({
            phase: replayMessage.phase,
            phaseDeadlineAtMs,
            battleId: replayMessage.battleId,
            timeline: replayMessage.timeline,
          });
          this.deps.setLastSharedBattleId(replayMessage.battleId);
        } else if (phase !== this.deps.getLastSharedBoardPhase()) {
          sharedBoardRoom.setModeFromGame?.({
            phase,
            phaseDeadlineAtMs,
            mode: "battle",
          });
        }

        this.deps.setLastSharedBoardPhase(phase);
        return;
      }
    }

    sharedBoardRoom.setModeFromGame?.({
      phase,
      phaseDeadlineAtMs,
      mode: "prep",
    });

    if (
      forcePrepSync
      || this.deps.getLastSharedBoardPhase() !== phase
      || this.deps.getLastSharedBattleId() !== null
    ) {
      this.syncAllPrepPlacementsToSharedBoard(sharedBoardRoom);
    }

    this.deps.setLastSharedBoardPhase(phase);
    this.deps.setLastSharedBattleId(null);
  }

  private syncAllPrepPlacementsToSharedBoard(sharedBoardRoom: SharedBoardRoomLike): void {
    const playerIds = this.deps.controller.getPlayerIds?.() ?? [];
    const bossPlayerId = this.deps.controller.getBossPlayerId?.() ?? null;

    for (const playerId of playerIds) {
      const placements = this.deps.controller.getBoardPlacementsForPlayer?.(playerId) ?? [];
      sharedBoardRoom.applyPlacementsFromGame?.(
        playerId,
        placements,
        playerId === bossPlayerId ? "boss" : "raid",
      );

      const heroId = this.deps.controller.getSelectedHero?.(playerId) ?? "";
      const heroCellIndex = this.deps.controller.getHeroPlacementForPlayer?.(playerId) ?? null;
      sharedBoardRoom.applyHeroPlacementFromGame?.({
        playerId,
        heroId,
        cellIndex: heroCellIndex,
        unitLevel: this.deps.controller.getSpecialUnitLevelForPlayer?.(playerId) ?? 1,
      });

      const bossId = this.deps.controller.getSelectedBoss?.(playerId) ?? "";
      const bossCellIndex = this.deps.controller.getBossPlacementForPlayer?.(playerId) ?? null;
      sharedBoardRoom.applyBossPlacementFromGame?.({
        playerId,
        bossId,
        cellIndex: bossCellIndex,
        unitLevel: this.deps.controller.getSpecialUnitLevelForPlayer?.(playerId) ?? 1,
      });
    }
  }

  private broadcastDiff(diffResult: ShadowDiffResult): void {
    const nextSeq = this.deps.getSeq() + 1;
    this.deps.setSeq(nextSeq);
    const timestamp = Date.now();

    const message: ShadowDiffMessage = {
      type: "shadow_diff",
      seq: nextSeq,
      roomId: this.deps.getSharedBoardRoomId() ?? "",
      sourceVersion: this.deps.getCurrentVersion(),
      ts: timestamp,
      status: diffResult.status,
      mismatchCount: diffResult.mismatchCount,
      mismatchedCells: diffResult.mismatchedCells,
    };

    const correlationId = `shadow_${nextSeq}`;
    const eventType: "apply_result" | "conflict" | "error" =
      diffResult.status === "ok"
        ? "apply_result"
        : diffResult.status === "mismatch"
          ? "conflict"
          : "error";

    const monitor = this.deps.getMonitor();
    const monitorEventBase = {
      eventId: `shadow_${nextSeq}_${timestamp}`,
      eventType,
      playerId: "system",
      revision: this.deps.getCurrentVersion(),
      source: "shared_board" as const,
      latencyMs: 0,
      success: diffResult.status === "ok",
      correlationId,
      timestamp,
    };

    if (diffResult.status === "ok") {
      monitor?.logEvent(monitorEventBase);
    } else {
      const errorCode =
        diffResult.status === "mismatch" ? "shadow_mismatch" : `shadow_${diffResult.status}`;
      const fallbackMessage =
        diffResult.status === "mismatch"
          ? `mismatch_count=${diffResult.mismatchCount}`
          : `shadow status=${diffResult.status}`;

      monitor?.logEvent({
        ...monitorEventBase,
        errorCode,
        ...(diffResult.lastError !== undefined
          ? { errorMessage: diffResult.lastError }
          : { errorMessage: fallbackMessage }),
      });
    }

    this.deps.gameRoom.broadcast("shadow_diff", message);
  }
}
