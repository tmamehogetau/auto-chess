import type { Client } from "colyseus";
import type {
  AdminQueryMessage,
  AdminQueryKind,
  AdminResponseMessage,
} from "../../../shared/room-messages";
import type { SharedBoardBridge } from "../../shared-board-bridge";
import { SERVER_MESSAGE_TYPES } from "../../../shared/room-messages";

export interface AdminQueryDependencies {
  bridge: SharedBoardBridge | null;
}

/**
 * Adminクエリを処理し、適切なレスポンスを送信する
 * @param client - Colyseusクライアント
 * @param message - Adminクエリメッセージ
 * @param deps - 依存関係（SharedBoardBridge）
 */
export function handleAdminQuery(
  client: Client,
  message: AdminQueryMessage,
  deps: AdminQueryDependencies,
): void {
  const correlationId =
    typeof message?.correlationId === "string" && message.correlationId.trim().length > 0
      ? message.correlationId.trim()
      : undefined;
  const correlationMeta = correlationId ? { correlationId } : {};

  if (!deps.bridge) {
    sendAdminResponse(client, {
      ok: false,
      kind: message?.kind ?? "metrics",
      timestamp: Date.now(),
      ...correlationMeta,
      error: "SharedBoardBridge is not available",
    });
    return;
  }

  switch (message.kind) {
    case "metrics": {
      sendAdminResponse(client, {
        ok: true,
        kind: "metrics",
        timestamp: Date.now(),
        ...correlationMeta,
        data: deps.bridge.getMetrics(),
      });
      return;
    }

    case "dashboard": {
      sendAdminResponse(client, {
        ok: true,
        kind: "dashboard",
        timestamp: Date.now(),
        ...correlationMeta,
        data: deps.bridge.getDashboardMetrics(message.windowMs),
      });
      return;
    }

    case "alerts": {
      sendAdminResponse(client, {
        ok: true,
        kind: "alerts",
        timestamp: Date.now(),
        ...correlationMeta,
        data: deps.bridge.getAlertStatus(message.thresholds),
      });
      return;
    }

    case "top_errors": {
      sendAdminResponse(client, {
        ok: true,
        kind: "top_errors",
        timestamp: Date.now(),
        ...correlationMeta,
        data: deps.bridge.getTopErrors(message.limit, message.windowMs),
      });
      return;
    }

    case "logs": {
      sendAdminResponse(client, {
        ok: true,
        kind: "logs",
        timestamp: Date.now(),
        ...correlationMeta,
        data: deps.bridge.getRecentLogs(message.limit),
      });
      return;
    }

    default: {
      sendAdminResponse(client, {
        ok: false,
        kind: "metrics",
        timestamp: Date.now(),
        ...correlationMeta,
        error: `Unknown admin query kind: ${String((message as { kind?: unknown }).kind)}`,
      });
    }
  }
}

/**
 * Adminレスポンスをクライアントに送信する
 * @param client - Colyseusクライアント
 * @param message - 送信するレスポンスメッセージ
 */
export function sendAdminResponse(
  client: Client,
  message: AdminResponseMessage,
): void {
  client.send(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, message);
}
