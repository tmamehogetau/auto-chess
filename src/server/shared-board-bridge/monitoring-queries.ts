import {
  DEFAULT_DASHBOARD_WINDOW_MS,
  clampWindowMs,
  type AlertStatus,
  type AlertThresholds,
  type BridgeMetrics,
  type DashboardMetrics,
  type ErrorSummary,
  type SyncEventLog,
} from "../shared-board-bridge-monitor";
import {
  createEmptyBridgeMetrics,
  createEmptyDashboardMetrics,
  createNoAlertStatus,
} from "./monitoring-fallback";

export interface BridgeMonitorQueries {
  getMetrics(): BridgeMetrics;
  getRecentLogs(count?: number): SyncEventLog[];
  getDashboardMetrics(windowMs: number, nowMs: number): DashboardMetrics;
  getTopErrors(limit: number, windowMs: number, nowMs: number): ErrorSummary[];
  getAlertStatus(thresholds: Partial<AlertThresholds>, nowMs: number): AlertStatus;
}

export function getBridgeMetrics(
  monitor: BridgeMonitorQueries | null,
): BridgeMetrics {
  return monitor?.getMetrics() ?? createEmptyBridgeMetrics();
}

export function getRecentBridgeLogs(
  monitor: BridgeMonitorQueries | null,
  count = 10,
): SyncEventLog[] {
  return monitor?.getRecentLogs(count) ?? [];
}

export function getBridgeDashboardMetrics(
  monitor: BridgeMonitorQueries | null,
  windowMs = DEFAULT_DASHBOARD_WINDOW_MS,
  nowMs = Date.now(),
): DashboardMetrics {
  const safeWindowMs = clampWindowMs(windowMs);
  return monitor?.getDashboardMetrics(safeWindowMs, nowMs)
    ?? createEmptyDashboardMetrics(safeWindowMs, nowMs);
}

export function getBridgeTopErrors(
  monitor: BridgeMonitorQueries | null,
  limit = 5,
  windowMs = DEFAULT_DASHBOARD_WINDOW_MS,
  nowMs = Date.now(),
): ErrorSummary[] {
  return monitor?.getTopErrors(limit, windowMs, nowMs) ?? [];
}

export function getBridgeAlertStatus(
  monitor: BridgeMonitorQueries | null,
  thresholds: Partial<AlertThresholds> = {},
  nowMs = Date.now(),
): AlertStatus {
  return monitor?.getAlertStatus(thresholds, nowMs)
    ?? createNoAlertStatus(thresholds, nowMs);
}
