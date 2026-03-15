export interface ReconnectPlan {
  shouldSchedule: boolean;
  nextState: "CONNECTING" | "DEGRADED";
  attempt: number;
  delayMs: number | null;
}

export function buildReconnectPlan(params: {
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
}): ReconnectPlan {
  const {
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectBaseDelayMs,
    reconnectMaxDelayMs,
  } = params;

  if (reconnectAttempts >= maxReconnectAttempts) {
    return {
      shouldSchedule: false,
      nextState: "DEGRADED",
      attempt: reconnectAttempts,
      delayMs: null,
    };
  }

  const attempt = reconnectAttempts + 1;
  return {
    shouldSchedule: true,
    nextState: "CONNECTING",
    attempt,
    delayMs: Math.min(
      reconnectBaseDelayMs * Math.pow(2, attempt - 1),
      reconnectMaxDelayMs,
    ),
  };
}
