import { describe, it, expect } from "vitest";
import {
  hashToUint32,
  seedToUnitFloat,
  pickRarity,
  type UnitRarity,
} from "../../../src/server/match-room-utils/random-utils";

describe("random-utils", () => {
  describe("hashToUint32", () => {
    it("should return deterministic hash for same input", () => {
      const input = "player1:1:0:0:set1";
      const hash1 = hashToUint32(input);
      const hash2 = hashToUint32(input);
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThanOrEqual(0);
      expect(hash1).toBeLessThan(2 ** 32);
    });

    it("should return different hashes for different inputs", () => {
      const hash1 = hashToUint32("player1");
      const hash2 = hashToUint32("player2");
      expect(hash1).not.toBe(hash2);
    });

    it("should return uint32 range values", () => {
      const hash = hashToUint32("test");
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(4294967296); // 2^32
    });

    it("should handle empty string", () => {
      const hash = hashToUint32("");
      expect(typeof hash).toBe("number");
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });

  describe("seedToUnitFloat", () => {
    it("should return deterministic float for same seed", () => {
      const seed = 12345;
      const float1 = seedToUnitFloat(seed);
      const float2 = seedToUnitFloat(seed);
      expect(float1).toBe(float2);
    });

    it("should return values in [0, 1) range", () => {
      for (let i = 0; i < 100; i++) {
        const float = seedToUnitFloat(i);
        expect(float).toBeGreaterThanOrEqual(0);
        expect(float).toBeLessThan(1);
      }
    });

    it("should handle seed=0", () => {
      const float = seedToUnitFloat(0);
      expect(float).toBeGreaterThanOrEqual(0);
      expect(float).toBeLessThan(1);
    });

    it("should handle large seeds", () => {
      const float = seedToUnitFloat(2 ** 32 - 1);
      expect(float).toBeGreaterThanOrEqual(0);
      expect(float).toBeLessThan(1);
    });

    it("should produce different values for different seeds", () => {
      const values = new Set<number>();
      for (let i = 0; i < 10; i++) {
        values.add(seedToUnitFloat(i));
      }
      expect(values.size).toBeGreaterThan(1);
    });
  });

  describe("pickRarity", () => {
    it("should return 1 when roll < oneCostRate", () => {
      const odds: readonly [number, number, number] = [0.7, 0.2, 0.1];
      const result = pickRarity(odds, 0.5);
      expect(result).toBe(1);
    });

    it("should return 2 when roll is between oneCostRate and oneCostRate+twoCostRate", () => {
      const odds: readonly [number, number, number] = [0.7, 0.2, 0.1];
      const result = pickRarity(odds, 0.75);
      expect(result).toBe(2);
    });

    it("should return 3 when roll >= oneCostRate+twoCostRate", () => {
      const odds: readonly [number, number, number] = [0.7, 0.2, 0.1];
      const result = pickRarity(odds, 0.95);
      expect(result).toBe(3);
    });

    it("should handle boundary at oneCostRate", () => {
      const odds: readonly [number, number, number] = [0.7, 0.2, 0.1];
      const result = pickRarity(odds, 0.7);
      expect(result).toBe(2);
    });

    it("should handle boundary at oneCostRate+twoCostRate", () => {
      const odds: readonly [number, number, number] = [0.7, 0.2, 0.1];
      const result = pickRarity(odds, 0.9);
      expect(result).toBe(3);
    });

    it("should return 1 for roll=0", () => {
      const odds: readonly [number, number, number] = [0.7, 0.2, 0.1];
      const result = pickRarity(odds, 0);
      expect(result).toBe(1);
    });

    it("should return 3 for roll close to 1", () => {
      const odds: readonly [number, number, number] = [0.7, 0.2, 0.1];
      const result = pickRarity(odds, 0.999);
      expect(result).toBe(3);
    });

    it("should work with level 1 odds (1, 0, 0)", () => {
      const odds: readonly [number, number, number] = [1, 0, 0];
      const result1 = pickRarity(odds, 0);
      const result2 = pickRarity(odds, 0.5);
      const result3 = pickRarity(odds, 0.999);
      expect(result1).toBe(1);
      expect(result2).toBe(1);
      expect(result3).toBe(1);
    });

    it("should work with level 6 odds (0.2, 0.45, 0.35)", () => {
      const odds: readonly [number, number, number] = [0.2, 0.45, 0.35];
      expect(pickRarity(odds, 0.1)).toBe(1);
      expect(pickRarity(odds, 0.2)).toBe(2);
      expect(pickRarity(odds, 0.5)).toBe(2);
      expect(pickRarity(odds, 0.649)).toBe(2);
      expect(pickRarity(odds, 0.65)).toBe(3);
      expect(pickRarity(odds, 0.66)).toBe(3);
    });
  });
});
