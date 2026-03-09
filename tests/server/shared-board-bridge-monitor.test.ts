import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { BridgeMonitor } from "../../src/server/shared-board-bridge-monitor";

describe("BridgeMonitor structured logging opt-in", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("default monitor does not emit structured console output", () => {
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
    });

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("debug-enabled monitor emits structured console output for success", () => {
    const monitor = new BridgeMonitor("room-1", { enableDebugLogs: true });

    monitor.logEvent({
      eventId: "event-1",
      eventType: "apply_result",
      playerId: "player-1",
      revision: 1,
      source: "shared_board",
      latencyMs: 12,
      success: true,
      timestamp: 1_000,
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[BridgeMonitor] apply_result",
      expect.stringContaining("event-1"),
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("debug-enabled monitor emits structured console output for failure", () => {
    const monitor = new BridgeMonitor("room-1", { enableDebugLogs: true });

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
      timestamp: 2_000,
    });

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[BridgeMonitor] conflict FAILED",
      expect.stringContaining("event-2"),
    );
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("metrics remain unchanged when logging is disabled", () => {
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
      timestamp: 2_000,
    });

    const metrics = monitor.getMetrics();
    expect(metrics.totalEvents).toBe(2);
    expect(metrics.successEvents).toBe(1);
    expect(metrics.failedEvents).toBe(1);
    expect(metrics.conflictEvents).toBe(1);
    expect(metrics.avgLatencyMs).toBe(116);
    expect(metrics.lastEventAt).toBe(2_000);
  });

  it("recent event history remains unchanged when logging is disabled", () => {
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
    });

    const recentLogs = monitor.getRecentLogs(1);
    expect(recentLogs).toHaveLength(1);
    expect(recentLogs[0]?.eventId).toBe("event-1");
  });

  it("dashboard and alert behavior preserved when logging is disabled", () => {
    const monitor = new BridgeMonitor("room-1");
    const nowMs = 10_000;

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

    const dashboard = monitor.getDashboardMetrics(1_000, nowMs);
    expect(dashboard.windowEventCount).toBe(2);
    expect(dashboard.failureRate).toBe(1);
    expect(dashboard.conflictRate).toBe(0.5);

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
    expect(alertStatus.triggeredRules).toContain("failure_rate");
    expect(alertStatus.triggeredRules).toContain("conflict_rate");
  });
});

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
