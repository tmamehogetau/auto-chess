import { describe, expect, it } from "vitest";

import { buildReconnectPlan } from "../../src/server/shared-board-bridge/reconnect-policy";

describe("shared-board-bridge reconnect-policy", () => {
  it("schedules exponential backoff until the max attempt cap", () => {
    expect(
      buildReconnectPlan({
        reconnectAttempts: 1,
        maxReconnectAttempts: 5,
        reconnectBaseDelayMs: 1_000,
        reconnectMaxDelayMs: 10_000,
      }),
    ).toEqual({
      shouldSchedule: true,
      nextState: "CONNECTING",
      attempt: 2,
      delayMs: 2_000,
    });
  });

  it("caps the reconnect delay at the configured maximum", () => {
    expect(
      buildReconnectPlan({
        reconnectAttempts: 4,
        maxReconnectAttempts: 10,
        reconnectBaseDelayMs: 1_000,
        reconnectMaxDelayMs: 5_000,
      }),
    ).toEqual({
      shouldSchedule: true,
      nextState: "CONNECTING",
      attempt: 5,
      delayMs: 5_000,
    });
  });

  it("switches to degraded mode once the max attempt count is reached", () => {
    expect(
      buildReconnectPlan({
        reconnectAttempts: 3,
        maxReconnectAttempts: 3,
        reconnectBaseDelayMs: 1_000,
        reconnectMaxDelayMs: 5_000,
      }),
    ).toEqual({
      shouldSchedule: false,
      nextState: "DEGRADED",
      attempt: 3,
      delayMs: null,
    });
  });
});
