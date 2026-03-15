import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_DASHBOARD_WINDOW_MS,
  type AlertStatus,
  type DashboardMetrics,
  type ErrorSummary,
  type SyncEventLog,
} from "../../src/server/shared-board-bridge-monitor";
import {
  getBridgeAlertStatus,
  getBridgeDashboardMetrics,
  getBridgeMetrics,
  getBridgeTopErrors,
  getRecentBridgeLogs,
  type BridgeMonitorQueries,
} from "../../src/server/shared-board-bridge/monitoring-queries";

describe("shared-board-bridge monitoring-queries", () => {
  it("returns fallback metrics when the monitor is unavailable", () => {
    expect(getBridgeMetrics(null)).toEqual({
      totalEvents: 0,
      successEvents: 0,
      failedEvents: 0,
      conflictEvents: 0,
      avgLatencyMs: 0,
      lastEventAt: 0,
    });
    expect(getRecentBridgeLogs(null)).toEqual([]);
    expect(getBridgeTopErrors(null)).toEqual([]);
  });

  it("clamps invalid dashboard windows before querying the monitor", () => {
    const dashboard: DashboardMetrics = {
      windowMs: DEFAULT_DASHBOARD_WINDOW_MS,
      generatedAt: 123,
      windowEventCount: 1,
      successRate: 1,
      failureRate: 0,
      conflictRate: 0,
      avgLatencyMs: 10,
      p95LatencyMs: 10,
      topErrors: [],
    };
    const monitor: BridgeMonitorQueries = {
      getMetrics: vi.fn(),
      getRecentLogs: vi.fn(),
      getDashboardMetrics: vi.fn(() => dashboard),
      getTopErrors: vi.fn(),
      getAlertStatus: vi.fn(),
    };

    expect(getBridgeDashboardMetrics(monitor, 0, 123)).toEqual(dashboard);
    expect(monitor.getDashboardMetrics).toHaveBeenCalledWith(DEFAULT_DASHBOARD_WINDOW_MS, 123);
  });

  it("delegates logs, errors, and alerts when the monitor exists", () => {
    const logs: SyncEventLog[] = [{
      eventId: "e1",
      eventType: "apply_result",
      roomId: "room",
      playerId: "player",
      revision: 1,
      source: "shared_board",
      latencyMs: 12,
      success: true,
      timestamp: 999,
    }];
    const errors: ErrorSummary[] = [{ errorCode: "E_TIMEOUT", count: 2 }];
    const alertStatus: AlertStatus = {
      hasAlert: true,
      triggeredRules: ["failure_rate"],
      evaluatedAt: 456,
      thresholds: {
        windowMs: 60_000,
        minEventCount: 5,
        maxFailureRate: 0.2,
        maxConflictRate: 0.1,
        maxP95LatencyMs: 200,
      },
      dashboard: {
        windowMs: 60_000,
        generatedAt: 456,
        windowEventCount: 10,
        successRate: 0.7,
        failureRate: 0.3,
        conflictRate: 0,
        avgLatencyMs: 20,
        p95LatencyMs: 80,
        topErrors: errors,
      },
    };
    const monitor: BridgeMonitorQueries = {
      getMetrics: vi.fn(() => ({
        totalEvents: 5,
        successEvents: 4,
        failedEvents: 1,
        conflictEvents: 0,
        avgLatencyMs: 11,
        lastEventAt: 321,
      })),
      getRecentLogs: vi.fn(() => logs),
      getDashboardMetrics: vi.fn(() => alertStatus.dashboard),
      getTopErrors: vi.fn(() => errors),
      getAlertStatus: vi.fn(() => alertStatus),
    };

    expect(getRecentBridgeLogs(monitor, 1)).toEqual(logs);
    expect(getBridgeTopErrors(monitor, 3, 60_000, 456)).toEqual(errors);
    expect(getBridgeAlertStatus(monitor, { maxFailureRate: 0.25 }, 456)).toEqual(alertStatus);
  });

  it("returns a no-alert fallback when the monitor is unavailable", () => {
    expect(getBridgeAlertStatus(null, { maxFailureRate: 0.15 }, 999)).toEqual({
      hasAlert: false,
      triggeredRules: [],
      evaluatedAt: 999,
      thresholds: {
        windowMs: DEFAULT_DASHBOARD_WINDOW_MS,
        minEventCount: 10,
        maxFailureRate: 0.15,
        maxConflictRate: 0.1,
        maxP95LatencyMs: 200,
      },
      dashboard: {
        windowMs: DEFAULT_DASHBOARD_WINDOW_MS,
        generatedAt: 999,
        windowEventCount: 0,
        successRate: 0,
        failureRate: 0,
        conflictRate: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        topErrors: [],
      },
    });
  });
});
