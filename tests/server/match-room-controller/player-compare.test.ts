import { describe, it, expect } from "vitest";
import { comparePlayerIds } from "../../../src/server/match-room-controller/player-compare";

describe("player-compare", () => {
  describe("comparePlayerIds", () => {
    it("should return -1 when left < right (lexicographic)", () => {
      expect(comparePlayerIds("alice", "bob")).toBe(-1);
      expect(comparePlayerIds("player1", "player2")).toBe(-1);
      expect(comparePlayerIds("a", "b")).toBe(-1);
    });

    it("should return 1 when left > right (lexicographic)", () => {
      expect(comparePlayerIds("bob", "alice")).toBe(1);
      expect(comparePlayerIds("player2", "player1")).toBe(1);
      expect(comparePlayerIds("b", "a")).toBe(1);
    });

    it("should return 0 when left === right", () => {
      expect(comparePlayerIds("player1", "player1")).toBe(0);
      expect(comparePlayerIds("alice", "alice")).toBe(0);
      expect(comparePlayerIds("", "")).toBe(0);
    });

    it("should handle empty strings", () => {
      expect(comparePlayerIds("", "a")).toBe(-1);
      expect(comparePlayerIds("a", "")).toBe(1);
    });

    it("should be consistent with Array.sort", () => {
      const ids = ["charlie", "alice", "bob"];
      const sorted = [...ids].sort(comparePlayerIds);
      expect(sorted).toEqual(["alice", "bob", "charlie"]);
    });

    it("should handle UUID-like strings", () => {
      const ids = [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655439999",
      ];
      const sorted = [...ids].sort(comparePlayerIds);
      expect(sorted[0]).toBe("550e8400-e29b-41d4-a716-446655439999");
      expect(sorted[1]).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(sorted[2]).toBe("550e8400-e29b-41d4-a716-446655440001");
    });

    it("should be transitive: if a<b and b<c then a<c", () => {
      const a = "alice";
      const b = "bob";
      const c = "charlie";
      expect(comparePlayerIds(a, b)).toBe(-1);
      expect(comparePlayerIds(b, c)).toBe(-1);
      expect(comparePlayerIds(a, c)).toBe(-1);
    });

    it("should be antisymmetric: if a<b then b>a", () => {
      const a = "alice";
      const b = "bob";
      expect(comparePlayerIds(a, b)).toBe(-1);
      expect(comparePlayerIds(b, a)).toBe(1);
    });
  });
});
