import { describe, expect, test } from "vitest";

// @ts-expect-error JS client module has no declaration file.
import { handleAdminResponse, initAdminMonitor } from "../../src/client/admin-monitor.js";

class FakeElement {
  public textContent = "";
  public innerHTML = "";
  public className = "";
  public children: FakeElement[] = [];

  public appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  public addEventListener(_event: string, _handler: () => void): void {}
}

describe("admin monitor", () => {
  test("SharedBoardBridge unavailable は combat log へ repeated error を流さない", () => {
    const logs: Array<{ message: string; type: string }> = [];

    initAdminMonitor(
      {
        monitorRefreshBtn: null,
        monitorEventsValue: null,
        monitorFailureValue: null,
        monitorConflictValue: null,
        monitorLatencyValue: null,
        monitorShadowStatusValue: null,
        monitorShadowMismatchValue: null,
        monitorAlertValue: null,
        monitorTopErrorsValue: null,
        monitorTraceValue: null,
        monitorLogList: null,
      },
      {
        getActiveRoom: () => null,
        addCombatLogEntry: (message: string, type: string) => {
          logs.push({ message, type });
        },
        setTraceId: () => {},
      },
    );

    handleAdminResponse({
      ok: false,
      kind: "dashboard",
      error: "SharedBoardBridge is not available",
      timestamp: Date.now(),
    });

    expect(logs).toHaveLength(0);
  });

  test("dashboard/alerts/logs の正常レスポンスを monitor UI へ反映する", () => {
    const monitorEventsValue = new FakeElement();
    const monitorFailureValue = new FakeElement();
    const monitorConflictValue = new FakeElement();
    const monitorLatencyValue = new FakeElement();
    const monitorAlertValue = new FakeElement();
    const monitorTopErrorsValue = new FakeElement();
    const monitorTraceValue = new FakeElement();
    const monitorLogList = new FakeElement();

    globalThis.document = {
      createElement: () => new FakeElement(),
    } as unknown as Document;

    initAdminMonitor(
      {
        monitorRefreshBtn: new FakeElement() as unknown as HTMLElement,
        monitorEventsValue: monitorEventsValue as unknown as HTMLElement,
        monitorFailureValue: monitorFailureValue as unknown as HTMLElement,
        monitorConflictValue: monitorConflictValue as unknown as HTMLElement,
        monitorLatencyValue: monitorLatencyValue as unknown as HTMLElement,
        monitorShadowStatusValue: new FakeElement() as unknown as HTMLElement,
        monitorShadowMismatchValue: new FakeElement() as unknown as HTMLElement,
        monitorAlertValue: monitorAlertValue as unknown as HTMLElement,
        monitorTopErrorsValue: monitorTopErrorsValue as unknown as HTMLElement,
        monitorTraceValue: monitorTraceValue as unknown as HTMLElement,
        monitorLogList: monitorLogList as unknown as HTMLElement,
      },
      {
        getActiveRoom: () => null,
        addCombatLogEntry: () => {},
        setTraceId: () => {},
      },
    );

    handleAdminResponse({
      ok: true,
      kind: "dashboard",
      correlationId: "admin-123",
      data: {
        windowEventCount: 12,
        failureRate: 0.25,
        conflictRate: 0.125,
        avgLatencyMs: 18.5,
        p95LatencyMs: 42.2,
      },
    });
    handleAdminResponse({
      ok: true,
      kind: "alerts",
      data: {
        hasAlert: true,
        triggeredRules: ["failure_rate", "p95_latency"],
      },
    });
    handleAdminResponse({
      ok: true,
      kind: "top_errors",
      data: [
        { errorCode: "invalid_phase", count: 4 },
        { errorCode: "forbidden", count: 2 },
      ],
    });
    handleAdminResponse({
      ok: true,
      kind: "logs",
      data: [
        {
          timestamp: 1_713_000_000_000,
          eventType: "apply_result",
          success: true,
          correlationId: "corr-1",
        },
      ],
    });

    expect(monitorEventsValue.textContent).toBe("12");
    expect(monitorFailureValue.textContent).toBe("25.0%");
    expect(monitorConflictValue.textContent).toBe("12.5%");
    expect(monitorLatencyValue.textContent).toBe("18.5ms / p95 42.2ms");
    expect(monitorTraceValue.textContent).toBe("admin-123");
    expect(monitorAlertValue.textContent).toBe("ALERT: failure_rate, p95_latency");
    expect(monitorTopErrorsValue.textContent).toBe("invalid_phase(4), forbidden(2)");
    expect(monitorLogList.children).toHaveLength(1);
    expect(monitorLogList.children[0]?.textContent).toContain("apply_result");
    expect(monitorLogList.children[0]?.textContent).toContain("corr-1");
  });

  test("alert and shadow status use explicit monitor-friendly labels", async () => {
    const logs: Array<{ message: string; type: string }> = [];
    const monitorAlertValue = new FakeElement();
    const monitorShadowStatusValue = new FakeElement();
    const monitorShadowMismatchValue = new FakeElement();

    initAdminMonitor(
      {
        monitorRefreshBtn: null,
        monitorEventsValue: null,
        monitorFailureValue: null,
        monitorConflictValue: null,
        monitorLatencyValue: null,
        monitorShadowStatusValue: monitorShadowStatusValue as unknown as HTMLElement,
        monitorShadowMismatchValue: monitorShadowMismatchValue as unknown as HTMLElement,
        monitorAlertValue: monitorAlertValue as unknown as HTMLElement,
        monitorTopErrorsValue: null,
        monitorTraceValue: null,
        monitorLogList: null,
      },
      {
        getActiveRoom: () => null,
        addCombatLogEntry: (message: string, type: string) => {
          logs.push({ message, type });
        },
        setTraceId: () => {},
      },
    );

    handleAdminResponse({
      ok: true,
      kind: "alerts",
      data: {
        hasAlert: false,
        triggeredRules: [],
      },
    });

    // @ts-expect-error JS client module has no declaration file.
    const { handleShadowDiff } = await import("../../src/client/admin-monitor.js");
    handleShadowDiff({ status: "ok", mismatchCount: 0 });

    expect(monitorAlertValue.textContent).toBe("OK: healthy");
    expect(monitorShadowStatusValue.textContent).toBe("ok");
    expect(monitorShadowMismatchValue.textContent).toBe("0");
    expect(logs).toEqual([{ message: "Shadow diff: OK", type: "info" }]);
  });
});
