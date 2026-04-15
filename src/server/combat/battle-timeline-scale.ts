export function scaleBattleTimeline<T extends object>(
  timeline: readonly T[] | undefined,
  timeScale: number,
): T[] | undefined {
  if (!Array.isArray(timeline)) {
    return undefined;
  }

  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new Error(`timeScale must be a positive finite number: ${String(timeScale)}`);
  }

  if (timeScale === 1) {
    return timeline.map((event) => ({ ...event }));
  }

  return timeline.map((event) => {
    const maybeTimedEvent = event as { atMs?: unknown };

    if (typeof maybeTimedEvent.atMs !== "number" || !Number.isFinite(maybeTimedEvent.atMs)) {
      return { ...event };
    }

    return {
      ...event,
      atMs: Math.max(0, Math.round(maybeTimedEvent.atMs * timeScale)),
    };
  });
}
