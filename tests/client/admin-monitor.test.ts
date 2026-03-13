import { describe, expect, test } from "vitest";

// @ts-expect-error JS client module has no declaration file.
import { handleAdminResponse, initAdminMonitor } from "../../src/client/admin-monitor.js";

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
});
