/**
 * SharedBoardBridge監視・メトリクス
 * 
 * 最小監視（P1）実装:
 * - 構造化ログ（event_id, revision, source, latency, error）
 * - メトリクス（成功率、反映遅延）
 */

export interface SyncEventLog {
  /** イベントID（一意） */
  eventId: string;
  /** イベントタイプ */
  eventType: "placement_change" | "apply_request" | "apply_result" | "conflict" | "error";
  /** ルームID */
  roomId: string;
  /** プレイヤーID */
  playerId: string;
  /** リビジョン（バージョン） */
  revision: number;
  /** ソース（shared_board | game） */
  source: string;
  /** 処理レイテンシ（ms） */
  latencyMs: number;
  /** 成功/失敗 */
  success: boolean;
  /** エラーコード（失敗時） */
  errorCode?: string;
  /** エラーメッセージ（失敗時） */
  errorMessage?: string;
  /** 相関ID（トレース用） */
  correlationId?: string;
  /** タイムスタンプ */
  timestamp: number;
}

export interface BridgeMetrics {
  /** 総イベント数 */
  totalEvents: number;
  /** 成功イベント数 */
  successEvents: number;
  /** 失敗イベント数 */
  failedEvents: number;
  /** 競合イベント数 */
  conflictEvents: number;
  /** 平均レイテンシ（ms） */
  avgLatencyMs: number;
  /** 最後のイベント時刻 */
  lastEventAt: number;
}

export interface ErrorSummary {
  errorCode: string;
  count: number;
  lastMessage?: string;
}

export interface DashboardMetrics {
  windowMs: number;
  generatedAt: number;
  windowEventCount: number;
  successRate: number;
  failureRate: number;
  conflictRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  topErrors: ErrorSummary[];
}

export interface AlertThresholds {
  /** 判定対象の時間窓 */
  windowMs: number;
  /** alert判定を開始する最小イベント数 */
  minEventCount: number;
  /** 失敗率上限（0.0-1.0） */
  maxFailureRate: number;
  /** 競合率上限（0.0-1.0） */
  maxConflictRate: number;
  /** p95レイテンシ上限（ms） */
  maxP95LatencyMs: number;
}

export type AlertRule = "failure_rate" | "conflict_rate" | "p95_latency";

export interface AlertStatus {
  hasAlert: boolean;
  triggeredRules: AlertRule[];
  evaluatedAt: number;
  thresholds: AlertThresholds;
  dashboard: DashboardMetrics;
}

export interface BridgeMonitorOptions {
  /** デバッグ用構造化ログ出力を有効にする (default: false) */
  enableDebugLogs?: boolean;
}

export const DEFAULT_DASHBOARD_WINDOW_MS = 5 * 60_000;

export function clampWindowMs(windowMs: number): number {
  return Number.isFinite(windowMs) && windowMs > 0
    ? windowMs
    : DEFAULT_DASHBOARD_WINDOW_MS;
}

export const DEFAULT_MONITOR_OPTIONS: Required<BridgeMonitorOptions> = {
  enableDebugLogs: false,
};

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  windowMs: DEFAULT_DASHBOARD_WINDOW_MS,
  minEventCount: 10,
  maxFailureRate: 0.2,
  maxConflictRate: 0.1,
  maxP95LatencyMs: 200,
};

/**
 * SharedBoardBridge監視クラス
 */
export class BridgeMonitor {
  private readonly roomId: string;
  private readonly options: Required<BridgeMonitorOptions>;
  private eventLogs: SyncEventLog[] = [];
  private readonly maxLogSize = 100;

  // メトリクス
  private totalEvents = 0;
  private successEvents = 0;
  private failedEvents = 0;
  private conflictEvents = 0;
  private totalLatencyMs = 0;
  private lastEventAt = 0;

  constructor(roomId: string, options?: BridgeMonitorOptions) {
    this.roomId = roomId;
    this.options = { ...DEFAULT_MONITOR_OPTIONS, ...options };
  }

  /**
   * 同期イベントを記録
   */
  public logEvent(event: Omit<SyncEventLog, "roomId">): void {
    const fullEvent: SyncEventLog = {
      ...event,
      roomId: this.roomId,
    };

    // ログに追加（上限管理）
    this.eventLogs.push(fullEvent);
    if (this.eventLogs.length > this.maxLogSize) {
      this.eventLogs.shift();
    }

    // メトリクス更新
    this.totalEvents++;
    this.totalLatencyMs += event.latencyMs;
    this.lastEventAt = event.timestamp;

    if (event.success) {
      this.successEvents++;
    } else {
      this.failedEvents++;
    }

    if (event.eventType === "conflict") {
      this.conflictEvents++;
    }

    // 構造化ログ出力（デバッグが有効な場合のみ）
    if (this.options.enableDebugLogs) {
      this.outputStructuredLog(fullEvent);
    }
  }

  /**
   * 構造化ログを出力
   */
  private outputStructuredLog(event: SyncEventLog): void {
    const logEntry = {
      ...event,
      _meta: {
        service: "shared-board-bridge",
        version: "1.0.0",
      },
    };

    if (event.success) {
      console.log(`[BridgeMonitor] ${event.eventType}`, JSON.stringify(logEntry));
    } else {
      console.warn(`[BridgeMonitor] ${event.eventType} FAILED`, JSON.stringify(logEntry));
    }
  }

  /**
   * 現在のメトリクスを取得
   */
  public getMetrics(): BridgeMetrics {
    return {
      totalEvents: this.totalEvents,
      successEvents: this.successEvents,
      failedEvents: this.failedEvents,
      conflictEvents: this.conflictEvents,
      avgLatencyMs: this.totalEvents > 0 ? this.totalLatencyMs / this.totalEvents : 0,
      lastEventAt: this.lastEventAt,
    };
  }

  /**
   * 最近のイベントログを取得
   */
  public getRecentLogs(count = 10): SyncEventLog[] {
    return this.eventLogs.slice(-count);
  }

  /**
   * dashboard向けメトリクスを取得
   */
  public getDashboardMetrics(
    windowMs = DEFAULT_DASHBOARD_WINDOW_MS,
    nowMs = Date.now(),
  ): DashboardMetrics {
    const safeWindowMs = clampWindowMs(windowMs);
    const logs = this.getWindowLogs(safeWindowMs, nowMs);
    const eventCount = logs.length;
    const successEvents = logs.filter((log) => log.success).length;
    const failedEvents = eventCount - successEvents;
    const conflictEvents = logs.filter((log) => log.eventType === "conflict").length;
    const totalLatency = logs.reduce((sum, log) => sum + log.latencyMs, 0);

    return {
      windowMs: safeWindowMs,
      generatedAt: nowMs,
      windowEventCount: eventCount,
      successRate: this.calculateRate(successEvents, eventCount),
      failureRate: this.calculateRate(failedEvents, eventCount),
      conflictRate: this.calculateRate(conflictEvents, eventCount),
      avgLatencyMs: eventCount > 0 ? totalLatency / eventCount : 0,
      p95LatencyMs: this.calculateP95Latency(logs),
      topErrors: this.getTopErrors(5, safeWindowMs, nowMs),
    };
  }

  /**
   * 発生頻度の高いエラーを取得
   */
  public getTopErrors(
    limit = 5,
    windowMs = DEFAULT_DASHBOARD_WINDOW_MS,
    nowMs = Date.now(),
  ): ErrorSummary[] {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
    const logs = this.getWindowLogs(windowMs, nowMs).filter((log) => !log.success);

    const summaries = new Map<
      string,
      { count: number; lastTimestamp: number; lastMessage?: string }
    >();

    for (const log of logs) {
      const key = log.errorCode ?? "unknown";
      const prev = summaries.get(key);

      if (!prev) {
        const nextSummary: { count: number; lastTimestamp: number; lastMessage?: string } = {
          count: 1,
          lastTimestamp: log.timestamp,
        };

        if (log.errorMessage !== undefined) {
          nextSummary.lastMessage = log.errorMessage;
        }

        summaries.set(key, nextSummary);
        continue;
      }

      prev.count += 1;
      if (log.timestamp >= prev.lastTimestamp) {
        prev.lastTimestamp = log.timestamp;
        if (log.errorMessage !== undefined) {
          prev.lastMessage = log.errorMessage;
        } else {
          delete prev.lastMessage;
        }
      }
    }

    return [...summaries.entries()]
      .map(([errorCode, value]) => {
        const summary: ErrorSummary = {
          errorCode,
          count: value.count,
        };

        if (value.lastMessage !== undefined) {
          summary.lastMessage = value.lastMessage;
        }

        return summary;
      })
      .sort((left, right) => {
        if (left.count !== right.count) {
          return right.count - left.count;
        }
        return left.errorCode.localeCompare(right.errorCode);
      })
      .slice(0, safeLimit);
  }

  /**
   * alert閾値に基づく監視状態を返す
   */
  public getAlertStatus(
    thresholds: Partial<AlertThresholds> = {},
    nowMs = Date.now(),
  ): AlertStatus {
    const mergedThresholds: AlertThresholds = {
      ...DEFAULT_ALERT_THRESHOLDS,
      ...thresholds,
    };

    const dashboard = this.getDashboardMetrics(mergedThresholds.windowMs, nowMs);
    const triggeredRules: AlertRule[] = [];

    if (dashboard.windowEventCount >= mergedThresholds.minEventCount) {
      if (dashboard.failureRate > mergedThresholds.maxFailureRate) {
        triggeredRules.push("failure_rate");
      }

      if (dashboard.conflictRate > mergedThresholds.maxConflictRate) {
        triggeredRules.push("conflict_rate");
      }

      if (dashboard.p95LatencyMs > mergedThresholds.maxP95LatencyMs) {
        triggeredRules.push("p95_latency");
      }
    }

    return {
      hasAlert: triggeredRules.length > 0,
      triggeredRules,
      evaluatedAt: nowMs,
      thresholds: mergedThresholds,
      dashboard,
    };
  }

  /**
   * メトリクスをリセット
   */
  public resetMetrics(): void {
    this.totalEvents = 0;
    this.successEvents = 0;
    this.failedEvents = 0;
    this.conflictEvents = 0;
    this.totalLatencyMs = 0;
    this.lastEventAt = 0;
    this.eventLogs = [];
  }

  private getWindowLogs(windowMs: number, nowMs: number): SyncEventLog[] {
    const safeWindowMs = clampWindowMs(windowMs);
    const windowStart = nowMs - safeWindowMs;

    return this.eventLogs.filter((log) => log.timestamp >= windowStart);
  }

  private calculateRate(numerator: number, denominator: number): number {
    if (denominator <= 0) {
      return 0;
    }

    return numerator / denominator;
  }

  private calculateP95Latency(logs: SyncEventLog[]): number {
    if (logs.length === 0) {
      return 0;
    }

    const sorted = logs
      .map((log) => log.latencyMs)
      .sort((left, right) => left - right);

    const p95Index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
    );

    return sorted[p95Index] ?? 0;
  }
}
