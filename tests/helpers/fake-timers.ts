import { vi } from "vitest";

export function enableFakeTimers(): void {
  vi.useFakeTimers();
}

export function disableFakeTimers(): void {
  vi.useRealTimers();
}

export function advanceFakeTimersByTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}
