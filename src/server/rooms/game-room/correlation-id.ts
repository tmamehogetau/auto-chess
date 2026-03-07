/**
 * Resolves a correlation ID from the incoming message, with fallback generation.
 * If the incoming correlationId is valid (non-empty string after trimming),
 * it is returned (truncated to 128 characters).
 * Otherwise, a fallback correlationId is generated using playerId, cmdSeq, timestamp, and random suffix.
 */
export function resolveCorrelationId(
  playerId: string,
  cmdSeq: number,
  incomingCorrelationId?: string,
): string {
  if (typeof incomingCorrelationId === "string") {
    const normalized = incomingCorrelationId.trim();
    if (normalized.length > 0) {
      return normalized.slice(0, 128);
    }
  }

  const nowMs = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `corr_${playerId}_${cmdSeq}_${nowMs}_${suffix}`;
}
