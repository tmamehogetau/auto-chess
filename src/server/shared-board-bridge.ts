import { type Room, matchMaker } from "colyseus";
import type { SharedBoardRoom, PlacementChangeListener } from "./rooms/shared-board-room";
import type { SharedBoardCellState } from "./schema/shared-board-state";
import type { MatchRoomController } from "./match-room-controller";
import { SharedBoardShadowObserver, type ShadowDiffResult } from "./shared-board-shadow-observer";
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
import { buildReconnectPlan } from "./shared-board-bridge/reconnect-policy";
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
}

/**
 * SharedBoard接続状態
 */
type BridgeState = 
  | "DISABLED"      // Feature Flag OFF
  | "CONNECTING"    // 接続試行中
  | "READY"         // 接続完了・監視中
  | "DEGRADED"      // 接続失敗・再試行中
  | "CLOSED";       // 接続終了

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
  private readonly enabled: boolean;

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
  private readonly maxReconnectAttempts = 5;
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

    if (!enabled) {
      this.state = "DISABLED";
      return;
    }

    // 監視初期化
    this.monitor = new BridgeMonitor(gameRoom.roomId);

    this.state = "CONNECTING";
    // 非同期で接続開始（fail-openのためawaitしない）
    void this.connect();
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

  /**
   * SharedBoardRoomへの接続
   */
  private async connect(): Promise<void> {
    if (!this.enabled || this.state === "CLOSED") {
      return;
    }

    this.state = "CONNECTING";

    try {
      // roomIdが未設定の場合は検索（デフォルトのshared_boardルーム）
      if (!this.sharedBoardRoomId) {
        this.sharedBoardRoomId = await this.findSharedBoardRoomIdWithRetry();
      }

      // 同じプロセス内でルームインスタンスを取得
      const resolvedRoomId = this.sharedBoardRoomId;
      const room = matchMaker.getLocalRoomById(resolvedRoomId);
      if (!room) {
        this.sharedBoardRoomId = null;
        throw new Error(`SharedBoard room ${resolvedRoomId} not found in local process`);
      }

      const sharedBoardRoom = room as unknown as SharedBoardRoom;

      if (this.unsubscribeHandle) {
        this.unsubscribeHandle();
        this.unsubscribeHandle = null;
      }

      if (this.sharedBoardRoom) {
        this.sharedBoardRoom.offPlacementChange(this.placementChangeListener ?? undefined);
      }

      this.sharedBoardRoom = sharedBoardRoom;
      this.shadowObserver = new SharedBoardShadowObserver(this.controller);
      this.shadowObserver.attachSharedBoard(sharedBoardRoom);

      // 配置変更イベント購読（双方向同期）
      this.setupPlacementChangeListener();

      // state change購読
      this.setupStateChangeListener();

      this.state = "READY";
      this.hasEverBeenReady = true;
      this.reconnectAttempts = 0;
      this.syncSharedBoardViewFromController();

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    } catch (error) {
      const shouldSuppressConnectLogs = !this.hasEverBeenReady && this.isExpectedSharedBoardUnavailableError(error);

      if (!shouldSuppressConnectLogs) {
        console.error("[SharedBoardBridge] Connection failed:", error);
      }

      this.scheduleReconnect({ silent: shouldSuppressConnectLogs });
    }
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
    for (let attempt = 1; attempt <= this.roomLookupRetryCount; attempt += 1) {
      const rooms = await matchMaker.query<SharedBoardRoom>({ name: "shared_board" });
      const roomId = rooms[0]?.roomId;

      if (roomId) {
        return roomId;
      }

      if (attempt < this.roomLookupRetryCount) {
        await this.delay(this.roomLookupRetryDelayMs);
      }
    }

    throw new Error("No shared_board room found");
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * SharedBoard state changeリスナー設定
   */
  private setupStateChangeListener(): void {
    if (!this.sharedBoardRoom) return;

    // Colyseusのstate change購読（簡易実装）
    // 実際の購読解除用にハンドラを保持
    const checkInterval = setInterval(() => {
      void this.checkAndBroadcastDiff();
    }, 100);

    this.unsubscribeHandle = () => {
      clearInterval(checkInterval);
    };
  }

  /**
   * 配置変更リスナー設定（双方向同期・バッチ処理）
   */
  private setupPlacementChangeListener(): void {
    if (!this.sharedBoardRoom) return;

    this.placementChangeListener = (playerId, cells) => {
      this.enqueuePlacementChange(playerId, cells);
    };

    this.sharedBoardRoom.onPlacementChange(this.placementChangeListener);
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
      const placements = this.convertCellsToPlacements(cells);
      const heroCellIndex = this.extractHeroCellIndex(playerId, cells);
      const bossCellIndex = this.extractBossCellIndex(playerId, cells);

      // 同期リクエスト作成
      const request: SyncOperationRequest = {
        opId: eventId,
        correlationId,
        baseVersion: this.currentVersion,
        timestamp: startTime,
        actorId: playerId,
        playerId,
        placements,
        ...(heroCellIndex !== undefined ? { heroCellIndex } : {}),
        ...(bossCellIndex !== undefined ? { bossCellIndex } : {}),
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

      placements.push({
        cell: cell.index,
        unitType,
        starLevel: 1,
      });
    }

    return placements;
  }

  private extractHeroCellIndex(
    playerId: string,
    cells: QueuedSharedBoardCellSnapshot[],
  ): number | null | undefined {
    const heroUnitId = `hero:${playerId}`;

    for (const cell of cells) {
      if (cell.unitId === heroUnitId) {
        return cell.index;
      }
    }

    return undefined;
  }

  private extractBossCellIndex(
    playerId: string,
    cells: QueuedSharedBoardCellSnapshot[],
  ): number | null | undefined {
    const bossUnitId = `boss:${playerId}`;

    for (const cell of cells) {
      if (cell.unitId === bossUnitId) {
        return cell.index;
      }
    }

    return undefined;
  }

  private snapshotPlacementCells(
    cells: SharedBoardCellState[],
  ): QueuedSharedBoardCellSnapshot[] {
    return cells.map((cell) => ({
      index: cell.index,
      unitId: cell.unitId,
      ownerId: cell.ownerId,
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

  /**
   * 差分を検知して配信
   */
  private async checkAndBroadcastDiff(): Promise<void> {
    const now = Date.now();
    
    // 最低観測間隔の制限
    if (now - this.lastObservationTime < this.minObservationIntervalMs) {
      return;
    }
    this.lastObservationTime = now;

    if (!this.shadowObserver || this.state !== "READY") {
      return;
    }

    this.syncSharedBoardViewFromController();

    const gameState = this.controller.getGameState?.();
    if (gameState?.phase !== "Prep") {
      return;
    }

    try {
      const diffResult = this.shadowObserver.observeAndCompare();
      
      // 差分があれば配信（または定期的に状態配信）
      if (diffResult.status !== "ok" || this.seq === 0) {
        this.broadcastDiff(diffResult);
      }
    } catch (error) {
      console.error("[SharedBoardBridge] Diff observation failed:", error);
      // fail-open: まずは再接続を試行し、上限到達時のみDEGRADEDへ遷移
      if (this.state === "READY") {
        this.scheduleReconnect();
      }
    }
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

  private syncSharedBoardViewFromController(forcePrepSync = false): void {
    if (this.state !== "READY" || !this.sharedBoardRoom) {
      return;
    }

    const gameState = this.controller.getGameState?.();
    if (!gameState) {
      return;
    }

    const phase = gameState.phase;
    const phaseDeadlineAtMs = this.controller.phaseDeadlineAtMs ?? 0;

    if (phase === "Battle" || phase === "Settle") {
      const replayMessage = this.controller.getSharedBattleReplay(phase);

      if (replayMessage) {
        if (replayMessage.battleId !== this.lastSharedBattleId) {
          this.sharedBoardRoom.applyBattleReplayFromGame({
            phase: replayMessage.phase,
            phaseDeadlineAtMs,
            battleId: replayMessage.battleId,
            timeline: replayMessage.timeline,
          });
          this.lastSharedBattleId = replayMessage.battleId;
        } else if (phase !== this.lastSharedBoardPhase) {
          this.sharedBoardRoom.setModeFromGame({
            phase,
            phaseDeadlineAtMs,
            mode: "battle",
          });
        }

        this.lastSharedBoardPhase = phase;
        return;
      }
    }

    this.sharedBoardRoom.setModeFromGame({
      phase,
      phaseDeadlineAtMs,
      mode: "prep",
    });

    if (forcePrepSync || this.lastSharedBoardPhase !== phase || this.lastSharedBattleId !== null) {
      this.syncAllPrepPlacementsToSharedBoard();
    }

    this.lastSharedBoardPhase = phase;
    this.lastSharedBattleId = null;
  }

  private syncAllPrepPlacementsToSharedBoard(): void {
    if (!this.sharedBoardRoom) {
      return;
    }

    const playerIds = this.controller.getPlayerIds?.() ?? [];
    const bossPlayerId = this.controller.getBossPlayerId?.() ?? null;
    for (const playerId of playerIds) {
      const placements = this.controller.getBoardPlacementsForPlayer?.(playerId) ?? [];
      this.sharedBoardRoom.applyPlacementsFromGame(
        playerId,
        placements,
        playerId === bossPlayerId ? "boss" : "raid",
      );

      const heroId = this.controller.getSelectedHero?.(playerId) ?? "";
      const heroCellIndex = this.controller.getHeroPlacementForPlayer?.(playerId) ?? null;
      this.sharedBoardRoom.applyHeroPlacementFromGame({
        playerId,
        heroId,
        cellIndex: heroCellIndex,
      });

      const bossId = this.controller.getSelectedBoss?.(playerId) ?? "";
      const bossCellIndex = this.controller.getBossPlacementForPlayer?.(playerId) ?? null;
      this.sharedBoardRoom.applyBossPlacementFromGame({
        playerId,
        bossId,
        cellIndex: bossCellIndex,
      });
    }
  }

  /**
   * 差分をクライアントへ配信
   */
  private broadcastDiff(diffResult: ShadowDiffResult): void {
    this.seq += 1;
    const timestamp = Date.now();

    const message: ShadowDiffMessage = {
      type: "shadow_diff",
      seq: this.seq,
      roomId: this.sharedBoardRoomId ?? "",
      sourceVersion: this.currentVersion,
      ts: timestamp,
      status: diffResult.status,
      mismatchCount: diffResult.mismatchCount,
      mismatchedCells: diffResult.mismatchedCells,
    };

    const correlationId = `shadow_${this.seq}`;
    const eventType: "apply_result" | "conflict" | "error" =
      diffResult.status === "ok"
        ? "apply_result"
        : diffResult.status === "mismatch"
          ? "conflict"
          : "error";

    const monitorEventBase = {
      eventId: `shadow_${this.seq}_${timestamp}`,
      eventType,
      playerId: "system",
      revision: this.currentVersion,
      source: "shared_board",
      latencyMs: 0,
      success: diffResult.status === "ok",
      correlationId,
      timestamp,
    };

    if (diffResult.status === "ok") {
      this.monitor?.logEvent(monitorEventBase);
    } else {
      const errorCode =
        diffResult.status === "mismatch" ? "shadow_mismatch" : `shadow_${diffResult.status}`;
      const fallbackMessage =
        diffResult.status === "mismatch"
          ? `mismatch_count=${diffResult.mismatchCount}`
          : `shadow status=${diffResult.status}`;

      this.monitor?.logEvent({
        ...monitorEventBase,
        errorCode,
        ...(diffResult.lastError !== undefined
          ? { errorMessage: diffResult.lastError }
          : { errorMessage: fallbackMessage }),
      });
    }

    // 全クライアントへブロードキャスト
    this.gameRoom.broadcast("shadow_diff", message);
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

  /**
   * 再接続スケジュール
   */
  private scheduleReconnect(options: { silent?: boolean } = {}): void {
    const silent = options.silent ?? false;

    if (this.reconnectTimer) {
      return;
    }

    const reconnectPlan = buildReconnectPlan({
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      reconnectBaseDelayMs: this.reconnectBaseDelayMs,
      reconnectMaxDelayMs: this.reconnectMaxDelayMs,
    });

    this.state = reconnectPlan.nextState;

    if (!reconnectPlan.shouldSchedule || reconnectPlan.delayMs === null) {
      if (!silent) {
        console.error("[SharedBoardBridge] Max reconnection attempts reached");
      }
      return;
    }

    this.reconnectAttempts = reconnectPlan.attempt;

    if (!silent) {
      console.log(
        `[SharedBoardBridge] Reconnecting in ${reconnectPlan.delayMs}ms (attempt ${this.reconnectAttempts})`,
      );
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, reconnectPlan.delayMs);
  }

  /**
   * 手動で差分チェックをトリガー（外部から呼び出し用）
   */
  public forceCheck(): void {
    if (this.state === "READY") {
      void this.checkAndBroadcastDiff();
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
    this.state = "CLOSED";

    this.pendingPlacementChanges.clear();

    if (this.placementBatchTimer) {
      clearTimeout(this.placementBatchTimer);
      this.placementBatchTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.unsubscribeHandle) {
      this.unsubscribeHandle();
      this.unsubscribeHandle = null;
    }

    // 配置変更リスナー解除
    if (this.sharedBoardRoom) {
      this.sharedBoardRoom.offPlacementChange(this.placementChangeListener ?? undefined);
    }
    this.placementChangeListener = null;

    if (this.shadowObserver) {
      this.shadowObserver.detachSharedBoard();
      this.shadowObserver = null;
    }

    this.sharedBoardRoom = null;
    this.monitor = null;
  }
}

