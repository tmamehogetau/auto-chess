import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "colyseus";
import {
  handleAdminQuery,
  type AdminQueryDependencies,
} from "../../../src/server/rooms/game-room/admin-query-handler";
import {
  type AdminPlayerSnapshot,
  type AdminQueryMessage,
  type AdminResponseMessage,
  SERVER_MESSAGE_TYPES,
} from "../../../src/shared/room-messages";
import type { SharedBoardBridge } from "../../../src/server/shared-board-bridge";

describe("admin-query-handler", () => {
  let mockClient: Client;
  let mockBridge: SharedBoardBridge;
  let deps: AdminQueryDependencies;
  let sentMessages: Array<{ type: string; payload: AdminResponseMessage }>;

  beforeEach(() => {
    sentMessages = [];

    mockClient = {
      sessionId: "test-session",
      send: vi.fn((type: string, payload: AdminResponseMessage) => {
        sentMessages.push({ type, payload });
      }),
    } as unknown as Client;

    mockBridge = {
      getMetrics: vi.fn(() => ({ latency: 100, errors: 0 })),
      getDashboardMetrics: vi.fn((windowMs) => ({
        windowMs: windowMs ?? 60000,
        events: 10,
      })),
      getAlertStatus: vi.fn((thresholds) => ({
        hasAlerts: false,
        thresholds: thresholds ?? {},
      })),
      getTopErrors: vi.fn((limit, windowMs) => ({
        limit: limit ?? 5,
        windowMs: windowMs ?? 3600000,
        errors: [],
      })),
      getRecentLogs: vi.fn((limit) => ({
        limit: limit ?? 100,
        logs: [],
      })),
    } as unknown as SharedBoardBridge;

    deps = {
      bridge: mockBridge,
      getPlayerSnapshots: vi.fn<() => AdminPlayerSnapshot[]>(() => ([
        {
          sessionId: "player-1",
          name: "helper-1",
          role: "raid",
          ready: true,
          connected: true,
          isSpectator: false,
          wantsBoss: false,
          gold: 14,
          boardUnitCount: 3,
          benchUnits: ["vanguard:2"],
          selectedHeroId: "reimu",
          selectedBossId: null,
        },
      ])),
    };
  });

  describe("handleAdminQuery", () => {
    it("should return metrics data for 'metrics' query kind", () => {
      const message: AdminQueryMessage = {
        kind: "metrics",
      };

      handleAdminQuery(mockClient, message, deps);

      expect(mockBridge.getMetrics).toHaveBeenCalled();
      expect(sentMessages).toHaveLength(1);
      const firstMessage = sentMessages[0]!;
      expect(firstMessage.type).toBe(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE);
      expect(firstMessage.payload.ok).toBe(true);
      expect(firstMessage.payload.kind).toBe("metrics");
      expect(firstMessage.payload.data).toEqual({ latency: 100, errors: 0 });
    });

    it("should return dashboard data with windowMs for 'dashboard' query", () => {
      const message: AdminQueryMessage = {
        kind: "dashboard",
        windowMs: 120000,
      };

      handleAdminQuery(mockClient, message, deps);

      expect(mockBridge.getDashboardMetrics).toHaveBeenCalledWith(120000);
      const firstMessage = sentMessages[0]!;
      expect(firstMessage.payload.ok).toBe(true);
      expect(firstMessage.payload.kind).toBe("dashboard");
      expect(firstMessage.payload.data).toEqual({
        windowMs: 120000,
        events: 10,
      });
    });

    it("should return alert status for 'alerts' query", () => {
      const message: AdminQueryMessage = {
        kind: "alerts",
        thresholds: {
          maxFailureRate: 0.1,
        },
      };

      handleAdminQuery(mockClient, message, deps);

      expect(mockBridge.getAlertStatus).toHaveBeenCalledWith({
        maxFailureRate: 0.1,
      });
      const firstMessage = sentMessages[0]!;
      expect(firstMessage.payload.ok).toBe(true);
      expect(firstMessage.payload.kind).toBe("alerts");
    });

    it("should return top errors for 'top_errors' query", () => {
      const message: AdminQueryMessage = {
        kind: "top_errors",
        limit: 10,
        windowMs: 7200000,
      };

      handleAdminQuery(mockClient, message, deps);

      expect(mockBridge.getTopErrors).toHaveBeenCalledWith(10, 7200000);
      const firstMessage = sentMessages[0]!;
      expect(firstMessage.payload.ok).toBe(true);
      expect(firstMessage.payload.kind).toBe("top_errors");
    });

    it("should return recent logs for 'logs' query", () => {
      const message: AdminQueryMessage = {
        kind: "logs",
        limit: 50,
      };

      handleAdminQuery(mockClient, message, deps);

      expect(mockBridge.getRecentLogs).toHaveBeenCalledWith(50);
      const firstMessage = sentMessages[0]!;
      expect(firstMessage.payload.ok).toBe(true);
      expect(firstMessage.payload.kind).toBe("logs");
    });

    it("should return player snapshots for 'player_snapshot' query without bridge metrics", () => {
      const message = {
        kind: "player_snapshot",
        correlationId: "corr-player-snapshot",
      } as AdminQueryMessage;

      handleAdminQuery(mockClient, message, {
        bridge: null,
        getPlayerSnapshots: deps.getPlayerSnapshots!,
      });

      expect(deps.getPlayerSnapshots).toHaveBeenCalled();
      const firstMessage = sentMessages[0]!;
      expect(firstMessage.payload.ok).toBe(true);
      expect(firstMessage.payload.kind).toBe("player_snapshot");
      expect(firstMessage.payload.correlationId).toBe("corr-player-snapshot");
      expect(firstMessage.payload.data).toEqual([
        expect.objectContaining({
          sessionId: "player-1",
          name: "helper-1",
          role: "raid",
          benchUnits: ["vanguard:2"],
        }),
      ]);
    });

    it("should include correlationId when provided", () => {
      const message: AdminQueryMessage = {
        kind: "metrics",
        correlationId: "corr-123",
      };

      handleAdminQuery(mockClient, message, deps);

      expect(sentMessages[0]!.payload.correlationId).toBe("corr-123");
    });

    it("should include correlationId when provided with whitespace", () => {
      const message: AdminQueryMessage = {
        kind: "metrics",
        correlationId: "  corr-456  ",
      };

      handleAdminQuery(mockClient, message, deps);

      expect(sentMessages[0]!.payload.correlationId).toBe("corr-456");
    });

    it("should not include correlationId when empty", () => {
      const message: AdminQueryMessage = {
        kind: "metrics",
        correlationId: "   ",
      };

      handleAdminQuery(mockClient, message, deps);

      expect(sentMessages[0]!.payload.correlationId).toBeUndefined();
    });

    it("should return error when bridge is not available", () => {
      deps.bridge = null;

      const message: AdminQueryMessage = {
        kind: "metrics",
      };

      handleAdminQuery(mockClient, message, deps);

      const firstMessage = sentMessages[0]!;
      expect(firstMessage.payload.ok).toBe(false);
      expect(firstMessage.payload.error).toBe(
        "SharedBoardBridge is not available",
      );
    });

    it("should handle unknown query kinds with error", () => {
      const message = {
        kind: "unknown_kind",
      } as unknown as AdminQueryMessage;

      handleAdminQuery(mockClient, message, deps);

      const firstMessage = sentMessages[0]!;
      expect(firstMessage.payload.ok).toBe(false);
      expect(firstMessage.payload.error).toContain("Unknown admin query kind");
    });

    it("should set timestamp on all responses", () => {
      const beforeTimestamp = Date.now();

      const message: AdminQueryMessage = {
        kind: "metrics",
      };

      handleAdminQuery(mockClient, message, deps);

      const afterTimestamp = Date.now();
      const firstMessage = sentMessages[0]!;
      const responseTimestamp = firstMessage.payload.timestamp;

      expect(responseTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(responseTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it("should default kind to 'metrics' in error response when kind is missing", () => {
      const message = {} as AdminQueryMessage;

      handleAdminQuery(mockClient, message, deps);

      expect(sentMessages[0]!.payload.kind).toBe("metrics");
    });
  });
});
