import { describe, it, expect } from "vitest";
import { resolveCorrelationId } from "../../../src/server/rooms/game-room/correlation-id";

describe("resolveCorrelationId", () => {
  it("should return the provided correlationId when it's valid", () => {
    const result = resolveCorrelationId("player-1", 1, "valid-correlation-id");
    expect(result).toBe("valid-correlation-id");
  });

  it("should trim whitespace from the provided correlationId", () => {
    const result = resolveCorrelationId("player-1", 1, "  trimmed-id  ");
    expect(result).toBe("trimmed-id");
  });

  it("should truncate correlationId to 128 characters", () => {
    const longId = "a".repeat(200);
    const result = resolveCorrelationId("player-1", 1, longId);
    expect(result).toHaveLength(128);
    expect(result).toBe("a".repeat(128));
  });

  it("should generate fallback correlationId when input is undefined", () => {
    const result = resolveCorrelationId("player-1", 1, undefined);
    expect(result).toMatch(/^corr_player-1_1_\d+_[a-z0-9]+$/);
  });

  it("should generate fallback correlationId when input is empty string", () => {
    const result = resolveCorrelationId("player-1", 1, "");
    expect(result).toMatch(/^corr_player-1_1_\d+_[a-z0-9]+$/);
  });

  it("should generate fallback correlationId when input is whitespace only", () => {
    const result = resolveCorrelationId("player-1", 1, "   ");
    expect(result).toMatch(/^corr_player-1_1_\d+_[a-z0-9]+$/);
  });

  it("should include playerId, cmdSeq, timestamp, and random suffix in fallback", () => {
    const beforeMs = Date.now();
    const result = resolveCorrelationId("test-player", 42, undefined);
    const afterMs = Date.now();

    const parts = result.split("_");
    expect(parts[0]).toBe("corr");
    expect(parts[1]).toBe("test-player");
    expect(parts[2]).toBe("42");
    
    const timestamp = parseInt(parts[3] ?? "0", 10);
    expect(timestamp).toBeGreaterThanOrEqual(beforeMs);
    expect(timestamp).toBeLessThanOrEqual(afterMs);
    
    expect(parts[4]).toHaveLength(6);
  });

  it("should generate unique correlationIds for sequential calls", () => {
    const id1 = resolveCorrelationId("player-1", 1, undefined);
    const id2 = resolveCorrelationId("player-1", 1, undefined);
    expect(id1).not.toBe(id2);
  });
});
