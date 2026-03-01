import { describe, expect, it } from "vitest";

import { BridgeMonitor } from "../../src/server/shared-board-bridge-monitor";

describe("BridgeMonitor monitoring extensions", () => {
  it("correlationIdをログに保持する", () => {
    const monitor = new BridgeMonitor("room-1");

    monitor.logEvent({
      eventId: "event-1",
      eventType: "apply_result",
      playerId: "player-1",
      revision: 1,
      source: "shared_board",
      latencyMs: 12,
      success: true,
      timestamp: 1_000,
      correlationId: "corr-123",
    });

    const [latest] = monitor.getRecentLogs(1);
    expect(latest?.correlationId).toBe("corr-123");
  });

  it("dashboard向け集計を返す", () => {
    const monitor = new BridgeMonitor("room-1");
    const nowMs = 10_000;

    monitor.logEvent({
      eventId: "event-1",
      eventType: "apply_result",
      playerId: "player-1",
      revision: 1,
      source: "shared_board",
      latencyMs: 20,
      success: true,
      timestamp: nowMs - 500,
    });
    monitor.logEvent({
      eventId: "event-2",
      eventType: "conflict",
      playerId: "player-2",
      revision: 2,
      source: "shared_board",
      latencyMs: 220,
      success: false,
      errorCode: "conflict",
      errorMessage: "version mismatch",
      timestamp: nowMs - 300,
    });
    monitor.logEvent({
      eventId: "event-3",
      eventType: "error",
      playerId: "player-3",
      revision: 3,
      source: "shared_board",
      latencyMs: 120,
      success: false,
      errorCode: "invalid_phase",
      errorMessage: "not prep",
      timestamp: nowMs - 50,
    });

    const dashboard = monitor.getDashboardMetrics(1_000, nowMs);

    expect(dashboard.windowEventCount).toBe(3);
    expect(dashboard.failureRate).toBeCloseTo(2 / 3, 5);
    expect(dashboard.conflictRate).toBeCloseTo(1 / 3, 5);
    expect(dashboard.avgLatencyMs).toBeCloseTo(120, 5);
    expect(dashboard.p95LatencyMs).toBe(220);
    expect(dashboard.topErrors.map((item) => item.errorCode)).toEqual([
      "conflict",
      "invalid_phase",
    ]);
  });

  it("alert閾値を超えた場合にルールを返す", () => {
    const monitor = new BridgeMonitor("room-1");
    const nowMs = 20_000;

    monitor.logEvent({
      eventId: "event-1",
      eventType: "conflict",
      playerId: "player-1",
      revision: 1,
      source: "shared_board",
      latencyMs: 240,
      success: false,
      errorCode: "conflict",
      timestamp: nowMs - 200,
    });
    monitor.logEvent({
      eventId: "event-2",
      eventType: "error",
      playerId: "player-2",
      revision: 2,
      source: "shared_board",
      latencyMs: 200,
      success: false,
      errorCode: "invalid_phase",
      timestamp: nowMs - 100,
    });

    const alertStatus = monitor.getAlertStatus(
      {
        minEventCount: 1,
        maxFailureRate: 0.5,
        maxConflictRate: 0.2,
        maxP95LatencyMs: 150,
        windowMs: 1_000,
      },
      nowMs,
    );

    expect(alertStatus.hasAlert).toBe(true);
    expect(alertStatus.triggeredRules).toEqual(
      expect.arrayContaining(["failure_rate", "conflict_rate", "p95_latency"]),
    );
  });
});
