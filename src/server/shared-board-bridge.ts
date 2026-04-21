import { type Room } from "colyseus";
import type { SharedBoardRoom, PlacementChangeListener } from "./rooms/shared-board-room";
import type { SharedBoardCellState } from "./schema/shared-board-state";
import type { MatchRoomController } from "./match-room-controller";
import { SharedBoardShadowObserver } from "./shared-board-shadow-observer";
import type {
  BoardUnitPlacement,
  SharedBattleReplayMessage,
  ShadowDiffMessage,
} from "../shared/room-messages";
import {
  BridgeMonitor,
  DEFAULT_DASHBOARD_WINDOW_MS,
  type AlertStatus,
  type AlertThresholds,
  type DashboardMetrics,
  type ErrorSummary,
} from "./shared-board-bridge-monitor";
import {
  BridgeConnectionManager,
  type BridgeState,
} from "./shared-board-bridge/connection-manager";
import { BridgeDiffBroadcaster } from "./shared-board-bridge/diff-broadcaster";
import { validateRolePlacements } from "./shared-board-bridge/placement-sync";
import {
  getBridgeAlertStatus,
  getBridgeDashboardMetrics,
  getBridgeMetrics,
  getBridgeTopErrors,
  getRecentBridgeLogs,
} from "./shared-board-bridge/monitoring-queries";

/**
 * GameRoom側の部分同期インターフェース
 */
interface PlacementBatchSyncTarget extends Room {
  syncPlayersFromController?: (playerIds: string[]) => void;
}

interface QueuedSharedBoardCellSnapshot {
  index: number;
  unitId: string;
  ownerId: string;
  displayName?: string;
  portraitKey?: string;
  unitLevel?: number;
}

/**
 * SharedBoard接続状態
 */
export type SharedBoardBridgeState = BridgeState;

type SharedBoardBridgeShadowObserverLike = Pick<SharedBoardShadowObserver, "detachSharedBoard">;

type SharedBoardBridgeRoomLike = {
  offPlacementChange: (listener?: PlacementChangeListener) => void;
  applyBattleReplayFromGame?: (input: SharedBattleReplayMessage) => { applied: number };
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
};

export interface SharedBoardBridgeTestResources {
  sharedBoardRoom: SharedBoardBridgeRoomLike | null;
  shadowObserver: SharedBoardBridgeShadowObserverLike | null;
  unsubscribeHandle: (() => void) | null;
  monitor: BridgeMonitor | null;
}

export interface SharedBoardBridgeTestAccess {
  enqueuePlacementChange: (playerId: string, cells: SharedBoardCellState[]) => void;
  connect: () => Promise<void>;
  syncSharedBoardViewFromController: (forcePrepSync?: boolean) => void;
  setRuntimeState: (params: Partial<{
    enabled: boolean;
    state: SharedBoardBridgeState;
    sharedBoardRoomId: string | null;
    maxReconnectAttempts: number;
    hasEverBeenReady: boolean;
  }>) => void;
  setFindSharedBoardRoomIdWithRetry: (fn: (() => Promise<string>) | null) => void;
  setResources: (params: Partial<SharedBoardBridgeTestResources>) => void;
  getResources: () => SharedBoardBridgeTestResources & { state: SharedBoardBridgeState };
}

/**
 * 同期操作リクエスト
 */
export interface SyncOperationRequest {
  /** 操作ID（冪等性用） */
  opId: string;
  /** 相関ID（トレース用） */
  correlationId?: string;
  /** ベースバージョン（競合検出用） */
  baseVersion: number;
  /** 操作タイムスタンプ */
  timestamp: number;
  /** 操作者ID */
  actorId: string;
  /** プレイヤーID */
  playerId: string;
  /** 配置データ */
  placements: BoardUnitPlacement[];
  /** 主人公セル */
  heroCellIndex?: number | null;
  /** ボスセル */
  bossCellIndex?: number | null;
}

/**
 * 同期操作結果
 */
export interface SyncOperationResult {
  /** 成功/失敗 */
  success: boolean;
  /** 結果コード */
  code: "success" | "conflict" | "forbidden" | "invalid_phase" | "error";
  /** 現在のバージョン */
  currentVersion: number;
  /** 競合時の最新配置 */
  currentPlacements?: BoardUnitPlacement[];
  /** エラーメッセージ */
  error?: string;
}

/**
 * GameRoomとSharedBoardRoom間の双方向同期を管理
 * Feature Flag制御下で動作し、game本体には影響を与えない
 */
export class SharedBoardBridge {
  private readonly gameRoom: PlacementBatchSyncTarget;
  private readonly controller: MatchRoomController;
  private enabled: boolean;

  private state: BridgeState = "DISABLED";
  private sharedBoardRoomId: string | null = null;
  private sharedBoardRoom: SharedBoardRoom | null = null;
  private shadowObserver: SharedBoardShadowObserver | null = null;
  private unsubscribeHandle: (() => void) | null = null;
  private placementChangeListener: PlacementChangeListener | null = null;
  
  private seq = 0;
  private lastObservationTime = 0;
  private readonly minObservationIntervalMs = 100;
  private reconnectAttempts = 0;
  private hasEverBeenReady = false;
  private maxReconnectAttempts = 5;
  private readonly reconnectBaseDelayMs = 250;
  private readonly reconnectMaxDelayMs = 30_000;
  private readonly roomLookupRetryCount = 5;
  private readonly roomLookupRetryDelayMs = 100;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastSharedBoardPhase: string | null = null;
  private lastSharedBattleId: string | null = null;
  
  // 双方向同期用
  private currentVersion = 0;
  private appliedOpIds = new Set<string>();
  private readonly maxAppliedOpIds = 1000;

  // 配置変更バッチ同期用
  private readonly pendingPlacementChanges = new Map<string, QueuedSharedBoardCellSnapshot[]>();
  private placementBatchTimer: NodeJS.Timeout | null = null;
  private readonly placementBatchWindowMs = 25;
  private isFlushingPlacementBatch = false;

  // 監視用
  private monitor: BridgeMonitor | null = null;
  private findSharedBoardRoomIdWithRetryOverride: (() => Promise<string>) | null = null;
  private readonly connectionManager: BridgeConnectionManager;
  private readonly diffBroadcaster: BridgeDiffBroadcaster;

  constructor(
    gameRoom: PlacementBatchSyncTarget,
    controller: MatchRoomController,
    enabled: boolean,
    sharedBoardRoomId?: string,
  ) {
    this.gameRoom = gameRoom;
    this.controller = controller;
    this.enabled = enabled;
    
    if (sharedBoardRoomId) {
      this.sharedBoardRoomId = sharedBoardRoomId;
    }

    // 監視初期化
    if (enabled) {
      this.monitor = new BridgeMonitor(gameRoom.roomId);
    }

    this.diffBroadcaster = new BridgeDiffBroadcaster({
      gameRoom: this.gameRoom,
      controller: this.controller,
      getState: () => this.state,
      getSharedBoardRoom: () => this.sharedBoardRoom,
      getSharedBoardRoomId: () => this.sharedBoardRoomId,
      getShadowObserver: () => this.shadowObserver,
      getCurrentVersion: () => this.currentVersion,
      getMonitor: () => this.monitor,
      getSeq: () => this.seq,
      setSeq: (value) => {
        this.seq = value;
      },
      getLastObservationTime: () => this.lastObservationTime,
      setLastObservationTime: (value) => {
        this.lastObservationTime = value;
      },
      minObservationIntervalMs: this.minObservationIntervalMs,
      getLastSharedBoardPhase: () => this.lastSharedBoardPhase,
      setLastSharedBoardPhase: (value) => {
        this.lastSharedBoardPhase = value;
      },
      getLastSharedBattleId: () => this.lastSharedBattleId,
      setLastSharedBattleId: (value) => {
        this.lastSharedBattleId = value;
      },
      onScheduleReconnect: () => {
        this.connectionManager.scheduleReconnect();
      },
    });
    this.connectionManager = new BridgeConnectionManager({
      controller: this.controller,
      isEnabled: () => this.enabled,
      getState: () => this.state,
      setState: (state) => {
        this.state = state;
      },
      getSharedBoardRoomId: () => this.sharedBoardRoomId,
      setSharedBoardRoomId: (roomId) => {
        this.sharedBoardRoomId = roomId;
      },
      getSharedBoardRoom: () => this.sharedBoardRoom,
      setSharedBoardRoom: (room) => {
        this.sharedBoardRoom = room;
      },
      getShadowObserver: () => this.shadowObserver,
      setShadowObserver: (observer) => {
        this.shadowObserver = observer;
      },
      getUnsubscribeHandle: () => this.unsubscribeHandle,
      setUnsubscribeHandle: (handle) => {
        this.unsubscribeHandle = handle;
      },
      getPlacementChangeListener: () => this.placementChangeListener,
      setPlacementChangeListener: (listener) => {
        this.placementChangeListener = listener;
      },
      getReconnectAttempts: () => this.reconnectAttempts,
      setReconnectAttempts: (attempts) => {
        this.reconnectAttempts = attempts;
      },
      getHasEverBeenReady: () => this.hasEverBeenReady,
      setHasEverBeenReady: (value) => {
        this.hasEverBeenReady = value;
      },
      getMaxReconnectAttempts: () => this.maxReconnectAttempts,
      getReconnectTimer: () => this.reconnectTimer,
      setReconnectTimer: (timer) => {
        this.reconnectTimer = timer;
      },
      getFindSharedBoardRoomIdWithRetryOverride: () => this.findSharedBoardRoomIdWithRetryOverride,
      roomLookupRetryCount: this.roomLookupRetryCount,
      roomLookupRetryDelayMs: this.roomLookupRetryDelayMs,
      reconnectBaseDelayMs: this.reconnectBaseDelayMs,
      reconnectMaxDelayMs: this.reconnectMaxDelayMs,
      onPlacementChange: (playerId, cells) => {
        this.enqueuePlacementChange(playerId, cells);
      },
      onDiffObservation: () => {
        this.diffBroadcaster.checkAndBroadcastDiff();
      },
      onReadySync: () => {
        this.diffBroadcaster.syncSharedBoardViewFromController();
      },
    }, enabled);
  }

  /**
   * 現在の接続状態を取得
   */
  public getState(): BridgeState {
    return this.state;
  }

  /**
   * 現在のバージョンを取得
   */
  public getCurrentVersion(): number {
    return this.currentVersion;
  }

  public getTestAccess(): SharedBoardBridgeTestAccess {
    return {
      enqueuePlacementChange: (playerId, cells) => {
        this.enqueuePlacementChange(playerId, cells);
      },
      connect: async () => {
        await this.connectionManager.connect();
      },
      syncSharedBoardViewFromController: (forcePrepSync = false) => {
        this.diffBroadcaster.syncSharedBoardViewFromController(forcePrepSync);
      },
      setRuntimeState: (params) => {
        if (params.enabled !== undefined) {
          this.enabled = params.enabled;
        }
        if (params.state !== undefined) {
          this.state = params.state;
        }
        if ("sharedBoardRoomId" in params) {
          this.sharedBoardRoomId = params.sharedBoardRoomId ?? null;
        }
        if (params.maxReconnectAttempts !== undefined) {
          this.maxReconnectAttempts = params.maxReconnectAttempts;
        }
        if (params.hasEverBeenReady !== undefined) {
          this.hasEverBeenReady = params.hasEverBeenReady;
        }
      },
      setFindSharedBoardRoomIdWithRetry: (fn) => {
        this.findSharedBoardRoomIdWithRetryOverride = fn;
      },
      setResources: (params) => {
        if ("sharedBoardRoom" in params) {
          this.sharedBoardRoom = (params.sharedBoardRoom ?? null) as SharedBoardRoom | null;
        }
        if ("shadowObserver" in params) {
          this.shadowObserver = (params.shadowObserver ?? null) as SharedBoardShadowObserver | null;
        }
        if ("unsubscribeHandle" in params) {
          this.unsubscribeHandle = params.unsubscribeHandle ?? null;
        }
        if ("monitor" in params) {
          this.monitor = params.monitor ?? null;
        }
      },
      getResources: () => ({
        sharedBoardRoom: this.sharedBoardRoom,
        shadowObserver: this.shadowObserver,
        unsubscribeHandle: this.unsubscribeHandle,
        monitor: this.monitor,
        state: this.state,
      }),
    };
  }

  /**
   * 配置変更をバッチキューに追加
   * @param playerId プレイヤーID
   * @param cells 変更されたセル一覧
   */
  private enqueuePlacementChange(
    playerId: string,
    cells: SharedBoardCellState[],
  ): void {
    if (this.state !== "READY") {
      return;
    }

    // Colyseus state cell は mutable なので、flush までに再同期で上書きされないよう snapshot 化する。
    this.pendingPlacementChanges.set(playerId, this.snapshotPlacementCells(cells));

    if (this.placementBatchTimer) {
      return;
    }

    this.placementBatchTimer = setTimeout(() => {
      this.placementBatchTimer = null;
      void this.flushPlacementChangeBatch();
    }, this.placementBatchWindowMs);
  }

  /**
   * キューされた配置変更を一括適用
   */
  private async flushPlacementChangeBatch(): Promise<void> {
    if (
      this.state !== "READY"
      || this.isFlushingPlacementBatch
      || this.pendingPlacementChanges.size === 0
    ) {
      return;
    }

    this.isFlushingPlacementBatch = true;
    const batchEntries = [...this.pendingPlacementChanges.entries()];
    this.pendingPlacementChanges.clear();

    const syncedPlayerIds: string[] = [];

    try {
      for (const [playerId, cells] of batchEntries) {
        const applied = await this.handlePlacementChange(playerId, cells);
        if (applied) {
          syncedPlayerIds.push(playerId);
        }
      }

      if (syncedPlayerIds.length > 0) {
        this.gameRoom.syncPlayersFromController?.(syncedPlayerIds);
      }
    } finally {
      this.isFlushingPlacementBatch = false;

      if (this.pendingPlacementChanges.size > 0 && !this.placementBatchTimer) {
        this.placementBatchTimer = setTimeout(() => {
          this.placementBatchTimer = null;
          void this.flushPlacementChangeBatch();
        }, this.placementBatchWindowMs);
      }
    }
  }

  /**
   * 配置変更を処理（SharedBoardRoom → GameRoom）
   * @param playerId プレイヤーID
   * @param cells 変更されたセル一覧
   */
  private async handlePlacementChange(
    playerId: string,
    cells: QueuedSharedBoardCellSnapshot[],
  ): Promise<boolean> {
    if (this.state !== "READY") {
      return false;
    }

    const startTime = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    const eventId = `sb_${playerId}_${startTime}_${suffix}`;
    const correlationId = `corr_${playerId}_${startTime}_${suffix}`;

    try {
      // SharedBoardセルをBoardUnitPlacementに変換
      const placements = this.preserveExistingAttachedSubUnits(
        playerId,
        this.convertCellsToPlacements(cells),
      );
      const heroCellIndex = this.extractHeroCellIndex(playerId, cells);
      const bossCellIndex = this.extractBossCellIndex(playerId, cells);
      const normalizedPlacements = this.normalizeHeroAttachmentPlacements(
        playerId,
        placements,
        heroCellIndex,
      );

      // 同期リクエスト作成
      const request: SyncOperationRequest = {
        opId: eventId,
        correlationId,
        baseVersion: this.currentVersion,
        timestamp: startTime,
        actorId: playerId,
        playerId,
        placements: normalizedPlacements,
        ...(heroCellIndex !== null ? { heroCellIndex } : {}),
        ...(bossCellIndex !== null ? { bossCellIndex } : {}),
      };

      // 配置を適用
      const result = await this.applySharedBoardPlacement(request);

      const latencyMs = Date.now() - startTime;
      const monitorEventType: "apply_result" | "conflict" | "error" = result.success
        ? "apply_result"
        : result.code === "conflict"
          ? "conflict"
          : "error";

      // 監視ログ記録
      const monitorEventBase = {
        eventId,
        eventType: monitorEventType,
        playerId,
        revision: result.currentVersion,
        source: "shared_board",
        latencyMs,
        success: result.success,
        correlationId,
        timestamp: Date.now(),
      };

      if (result.success) {
        this.monitor?.logEvent(monitorEventBase);
      } else {
        this.monitor?.logEvent({
          ...monitorEventBase,
          errorCode: result.code,
          ...(result.error !== undefined ? { errorMessage: result.error } : {}),
        });
      }

      if (!result.success) {
        const logMethod = result.code === "forbidden" ? console.info : console.warn;
        logMethod("[SharedBoardBridge] Placement change failed:", {
          playerId,
          code: result.code,
          error: result.error,
        });
      }

      return result.success;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // エラーログ記録
      this.monitor?.logEvent({
        eventId,
        eventType: "error",
        playerId,
        revision: this.currentVersion,
        source: "shared_board",
        latencyMs,
        success: false,
        errorCode: "exception",
        errorMessage: error instanceof Error ? error.message : String(error),
        correlationId,
        timestamp: Date.now(),
      });

      console.error("[SharedBoardBridge] Handle placement change failed:", error);
      // fail-open: エラー時も継続
      return false;
    }
  }

  /**
   * SharedBoardセルをBoardUnitPlacementに変換
   * @param cells SharedBoardセル一覧
   * @returns BoardUnitPlacement配列
   */
  private convertCellsToPlacements(cells: QueuedSharedBoardCellSnapshot[]): BoardUnitPlacement[] {
    const placements: BoardUnitPlacement[] = [];

    for (const cell of cells) {
      if (!cell.unitId || cell.unitId.length === 0) {
        continue;
      }

      if (this.isSpecialUnitId(cell.unitId)) {
        continue;
      }

      // unitIdからunitTypeを抽出（例: "vanguard-1" → "vanguard"）
      const unitType = this.extractUnitTypeFromId(cell.unitId);
      if (!this.isBoardUnitType(unitType)) {
        continue;
      }

      const portraitKey = typeof cell.portraitKey === "string" && cell.portraitKey.length > 0
        ? cell.portraitKey
        : undefined;

      placements.push({
        cell: cell.index,
        unitType,
        ...(portraitKey ? { unitId: portraitKey } : {}),
        unitLevel: cell.unitLevel ?? 1,
      });
    }

    return placements;
  }

  private preserveExistingAttachedSubUnits(
    playerId: string,
    placements: BoardUnitPlacement[],
  ): BoardUnitPlacement[] {
    if (placements.length === 0) {
      return placements;
    }

    const existingPlacements = this.controller.getBoardPlacementsForPlayer(playerId);
    if (!existingPlacements.some((placement) => placement.subUnit !== undefined)) {
      return placements;
    }

    const existingSubUnitByUnitId = new Map<string, Array<NonNullable<BoardUnitPlacement["subUnit"]>>>();
    const existingSubUnitByCell = new Map<number, NonNullable<BoardUnitPlacement["subUnit"]>>();
    const usedUnitIdFallbacks = new Set<string>();

    for (const placement of existingPlacements) {
      if (!placement?.subUnit) {
        continue;
      }

      if (typeof placement.unitId === "string" && placement.unitId.length > 0) {
        const subUnits = existingSubUnitByUnitId.get(placement.unitId) ?? [];
        subUnits.push(placement.subUnit);
        existingSubUnitByUnitId.set(placement.unitId, subUnits);
      }

      if (Number.isInteger(placement.cell)) {
        existingSubUnitByCell.set(placement.cell, placement.subUnit);
      }
    }

    return placements.map((placement) => {
      if (placement.subUnit) {
        return placement;
      }

      const preservedSubUnitByCell = existingSubUnitByCell.get(placement.cell);
      const preservedSubUnitByUnitId = typeof placement.unitId === "string" && placement.unitId.length > 0
        ? existingSubUnitByUnitId.get(placement.unitId)
        : undefined;
      const preservedSubUnit = preservedSubUnitByCell
        ?? (
          preservedSubUnitByUnitId?.length === 1
          && typeof placement.unitId === "string"
          && !usedUnitIdFallbacks.has(placement.unitId)
            ? preservedSubUnitByUnitId[0]
            : undefined
        );

      if (!preservedSubUnit) {
        return placement;
      }

      if (
        !preservedSubUnitByCell
        && typeof placement.unitId === "string"
        && placement.unitId.length > 0
      ) {
        usedUnitIdFallbacks.add(placement.unitId);
      }

      return {
        ...placement,
        subUnit: { ...preservedSubUnit },
      };
    });
  }

  private extractHeroCellIndex(
    playerId: string,
    cells: QueuedSharedBoardCellSnapshot[],
  ): number | null {
    const heroUnitId = `hero:${playerId}`;

    for (const cell of cells) {
      if (cell.unitId === heroUnitId) {
        return cell.index;
      }
    }

    return null;
  }

  private normalizeHeroAttachmentPlacements(
    playerId: string,
    placements: BoardUnitPlacement[],
    heroCellIndex: number | null,
  ): BoardUnitPlacement[] {
    if (
      typeof heroCellIndex !== "number"
      || !Number.isInteger(heroCellIndex)
      || heroCellIndex < 0
    ) {
      return placements;
    }

    const targetHeroCellIndex: number = heroCellIndex;

    if (this.controller.getSelectedHero(playerId) !== "okina") {
      return placements;
    }

    const previousHeroCellIndex = this.controller.getHeroPlacementForPlayer(playerId);
    if (
      typeof previousHeroCellIndex !== "number"
      || !Number.isInteger(previousHeroCellIndex)
      || previousHeroCellIndex < 0
      || previousHeroCellIndex === targetHeroCellIndex
    ) {
      return placements;
    }

    const sourceHeroCellIndex: number = previousHeroCellIndex;

    if (placements.some((placement) => placement.cell === targetHeroCellIndex)) {
      return placements;
    }

    const sourcePlacementIndex = placements.findIndex(
      (placement) => placement.cell === sourceHeroCellIndex,
    );
    if (sourcePlacementIndex < 0) {
      return placements;
    }

    return placements.map((placement, index) => (
      index === sourcePlacementIndex
        ? { ...placement, cell: targetHeroCellIndex }
        : placement
    ));
  }

  private extractBossCellIndex(
    playerId: string,
    cells: QueuedSharedBoardCellSnapshot[],
  ): number | null {
    const bossUnitId = `boss:${playerId}`;

    for (const cell of cells) {
      if (cell.unitId === bossUnitId) {
        return cell.index;
      }
    }

    return null;
  }

  private snapshotPlacementCells(
    cells: SharedBoardCellState[],
  ): QueuedSharedBoardCellSnapshot[] {
    return cells.map((cell) => ({
      index: cell.index,
      unitId: cell.unitId,
      ownerId: cell.ownerId,
      displayName: cell.displayName,
      portraitKey: cell.portraitKey,
      unitLevel: cell.unitLevel,
    }));
  }

  private isBoardUnitType(unitType: string): unitType is BoardUnitPlacement["unitType"] {
    return (
      unitType === "vanguard"
      || unitType === "ranger"
      || unitType === "mage"
      || unitType === "assassin"
    );
  }

  /**
   * unitIdからunitTypeを抽出
   * @param unitId ユニットID（例: "vanguard-1", "ranger-slot2"）
   * @returns unitType（"vanguard", "ranger", "mage", "assassin", "unknown"）
   */
  private extractUnitTypeFromId(unitId: string): string {
    const types = ["vanguard", "ranger", "mage", "assassin"];
    for (const type of types) {
      if (unitId.toLowerCase().includes(type)) {
        return type;
      }
    }
    return "unknown";
  }

  private isHeroUnitId(unitId: string): boolean {
    return unitId.startsWith("hero:");
  }

  private isBossUnitId(unitId: string): boolean {
    return unitId.startsWith("boss:");
  }

  private isSpecialUnitId(unitId: string): boolean {
    return this.isHeroUnitId(unitId) || this.isBossUnitId(unitId);
  }

  /**
   * 操作が既に適用済みかチェック（冪等性）
   */
  private isOpApplied(opId: string): boolean {
    return this.appliedOpIds.has(opId);
  }

  /**
   * 操作を適用済みとして記録
   */
  private markOpApplied(opId: string): void {
    // メモリ使用量制限のため、一定数以上になったら古いものを削除
    if (this.appliedOpIds.size >= this.maxAppliedOpIds) {
      const firstKey = this.appliedOpIds.values().next().value;
      if (firstKey !== undefined) {
        this.appliedOpIds.delete(firstKey);
      }
    }
    this.appliedOpIds.add(opId);
  }

  /**
   * SharedBoardRoomからの配置変更をGameRoomに適用（双方向同期）
   * @param request 同期リクエスト
   * @returns 同期結果
   */
  public async applySharedBoardPlacement(
    request: SyncOperationRequest,
  ): Promise<SyncOperationResult> {
    // READY状態でない場合は拒否
    if (this.state !== "READY") {
      return {
        success: false,
        code: "error",
        currentVersion: this.currentVersion,
        error: "Bridge not ready",
      };
    }

    // 冪等性チェック
    if (this.isOpApplied(request.opId)) {
      return {
        success: true,
        code: "success",
        currentVersion: this.currentVersion,
      };
    }

    try {
      // GameRoom既知プレイヤー以外は適用しない（fail-openで無視）
      const knownPlayerIds = this.controller.getPlayerIds?.();
      if (Array.isArray(knownPlayerIds) && !knownPlayerIds.includes(request.playerId)) {
        return {
          success: false,
          code: "forbidden",
          currentVersion: this.currentVersion,
          error: `Unknown player: ${request.playerId}`,
        };
      }

      // バージョンチェック（競合検出）
      if (request.baseVersion !== this.currentVersion) {
        return {
          success: false,
          code: "conflict",
          currentVersion: this.currentVersion,
          currentPlacements: this.controller.getBoardPlacementsForPlayer(request.playerId),
          error: `Version mismatch: expected ${this.currentVersion}, got ${request.baseVersion}`,
        };
      }

      // Prepフェーズチェック
      const gameState = this.controller.getGameState?.();
      if (gameState?.phase !== "Prep") {
        return {
          success: false,
          code: "invalid_phase",
          currentVersion: this.currentVersion,
          error: "Not in Prep phase",
        };
      }

      const roleValidationError = validateRolePlacements(
        request.playerId,
        this.controller.getBossPlayerId?.() ?? undefined,
        request.placements,
      );
      if (roleValidationError !== null) {
        return {
          success: false,
          code: "forbidden",
          currentVersion: this.currentVersion,
          error: roleValidationError,
        };
      }

      // 配置を実際に適用（MatchRoomController経由）
      const result = this.controller.applyPrepPlacementForPlayer(
        request.playerId,
        request.placements,
      );

      if (!result.success) {
        const failureResult: SyncOperationResult = {
          success: false,
          code: result.code as SyncOperationResult["code"],
          currentVersion: this.currentVersion,
        };

        if (result.error !== undefined) {
          failureResult.error = result.error;
        }

        return {
          ...failureResult,
        };
      }

      if (request.heroCellIndex !== undefined && request.heroCellIndex !== null) {
        const heroResult = this.controller.applyHeroPlacementForPlayer(
          request.playerId,
          request.heroCellIndex,
        );

        if (!heroResult.success) {
          return {
            success: false,
            code: heroResult.code === "PHASE_MISMATCH" ? "invalid_phase" : "forbidden",
            currentVersion: this.currentVersion,
            ...(heroResult.error !== undefined ? { error: heroResult.error } : {}),
          };
        }
      }

      if (request.bossCellIndex !== undefined && request.bossCellIndex !== null) {
        const bossResult = this.controller.applyBossPlacementForPlayer(
          request.playerId,
          request.bossCellIndex,
        );

        if (!bossResult.success) {
          return {
            success: false,
            code: bossResult.code === "PHASE_MISMATCH" ? "invalid_phase" : "forbidden",
            currentVersion: this.currentVersion,
            ...(bossResult.error !== undefined ? { error: bossResult.error } : {}),
          };
        }
      }

      // バージョンインクリメント
      this.currentVersion += 1;
      this.markOpApplied(request.opId);

      return {
        success: true,
        code: "success",
        currentVersion: this.currentVersion,
      };
    } catch (error) {
      console.error("[SharedBoardBridge] Apply placement failed:", error);
      return {
        success: false,
        code: "error",
        currentVersion: this.currentVersion,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }


  /**
   * GameRoomの配置をSharedBoardRoomに送信
   * @param playerId プレイヤーID
   * @param placements 配置データ
   */
  public async sendPlacementToSharedBoard(
    playerId: string,
    placements: BoardUnitPlacement[],
  ): Promise<void> {
    if (this.state !== "READY" || !this.sharedBoardRoom) {
      return;
    }

    try {
      this.sharedBoardRoom.applyPlacementsFromGame(
        playerId,
        placements,
        playerId === (this.controller.getBossPlayerId?.() ?? null) ? "boss" : "raid",
      );
    } catch (error) {
      console.error("[SharedBoardBridge] Send placement failed:", error);
      // fail-open: エラー時もGameRoom動作は継続
    }
  }

  public syncSharedBoardViewFromController(forcePrepSync = false): void {
    if (this.state !== "READY") {
      return;
    }

    this.diffBroadcaster.syncSharedBoardViewFromController(forcePrepSync);
  }

  /**
   * 手動で差分チェックをトリガー（外部から呼び出し用）
   */
  public forceCheck(): void {
    if (this.state === "READY") {
      this.diffBroadcaster.checkAndBroadcastDiff();
    }
  }

  /**
   * 現在のメトリクスを取得
   * @returns メトリクス情報
   */
  public getMetrics() {
    return getBridgeMetrics(this.monitor);
  }

  /**
   * 最近のイベントログを取得
   * @param count 取得件数（デフォルト10）
   * @returns イベントログ配列
   */
  public getRecentLogs(count = 10) {
    return getRecentBridgeLogs(this.monitor, count);
  }

  /**
   * dashboard表示向けメトリクスを取得
   */
  public getDashboardMetrics(
    windowMs = DEFAULT_DASHBOARD_WINDOW_MS,
    nowMs = Date.now(),
  ): DashboardMetrics {
    return getBridgeDashboardMetrics(this.monitor, windowMs, nowMs);
  }

  /**
   * 頻出エラー上位を取得
   */
  public getTopErrors(
    limit = 5,
    windowMs = DEFAULT_DASHBOARD_WINDOW_MS,
    nowMs = Date.now(),
  ): ErrorSummary[] {
    return getBridgeTopErrors(this.monitor, limit, windowMs, nowMs);
  }

  /**
   * GameRoom由来のコマンド処理トレースを記録
   */
  public logGameCommandEvent(params: {
    playerId: string;
    eventType: "apply_request" | "apply_result" | "error";
    success: boolean;
    latencyMs: number;
    correlationId: string;
    errorCode?: string;
    errorMessage?: string;
  }): void {
    if (!this.monitor) {
      return;
    }

    const nowMs = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);

    this.monitor.logEvent({
      eventId: `game_${params.playerId}_${nowMs}_${suffix}`,
      eventType: params.eventType,
      playerId: params.playerId,
      revision: this.currentVersion,
      source: "game",
      latencyMs: params.latencyMs,
      success: params.success,
      correlationId: params.correlationId,
      timestamp: nowMs,
      ...(params.errorCode !== undefined ? { errorCode: params.errorCode } : {}),
      ...(params.errorMessage !== undefined ? { errorMessage: params.errorMessage } : {}),
    });
  }

  /**
   * 閾値ベースのalert状態を取得
   */
  public getAlertStatus(
    thresholds: Partial<AlertThresholds> = {},
    nowMs = Date.now(),
  ): AlertStatus {
    return getBridgeAlertStatus(this.monitor, thresholds, nowMs);
  }

  /**
   * 接続を終了
   */
  public dispose(): void {
    this.pendingPlacementChanges.clear();

    if (this.placementBatchTimer) {
      clearTimeout(this.placementBatchTimer);
      this.placementBatchTimer = null;
    }
    this.connectionManager.dispose();
    this.monitor = null;
  }
}

