import {
  DEFAULT_ALERT_THRESHOLDS,
  type AlertStatus,
  type AlertThresholds,
  type BridgeMetrics,
  type DashboardMetrics,
} from "../shared-board-bridge-monitor";

export function createEmptyBridgeMetrics(): BridgeMetrics {
  return {
    totalEvents: 0,
    successEvents: 0,
    failedEvents: 0,
    conflictEvents: 0,
    avgLatencyMs: 0,
    lastEventAt: 0,
  };
}

export function createEmptyDashboardMetrics(
  windowMs: number,
  nowMs: number,
): DashboardMetrics {
  return {
    windowMs,
    generatedAt: nowMs,
    windowEventCount: 0,
    successRate: 0,
    failureRate: 0,
    conflictRate: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    topErrors: [],
  };
}

export function createNoAlertStatus(
  thresholds: Partial<AlertThresholds>,
  nowMs: number,
): AlertStatus {
  const mergedThresholds: AlertThresholds = {
    ...DEFAULT_ALERT_THRESHOLDS,
    ...thresholds,
  };

  return {
    hasAlert: false,
    triggeredRules: [],
    evaluatedAt: nowMs,
    thresholds: mergedThresholds,
    dashboard: createEmptyDashboardMetrics(mergedThresholds.windowMs, nowMs),
  };
}
