import { describe, it, expect } from "vitest";
import { buildLoserDamage } from "../../../src/server/match-room-utils/damage-calculator";

describe("damage-calculator", () => {
  describe("buildLoserDamage", () => {
    it("should return base damage (5) when winner has 0 units", () => {
      const damage = buildLoserDamage(0, 0);
      expect(damage).toBe(5);
    });

    it("should return base damage + winnerUnitCount * 2", () => {
      expect(buildLoserDamage(1, 0)).toBe(5 + 1 * 2); // 7
      expect(buildLoserDamage(2, 0)).toBe(5 + 2 * 2); // 9
      expect(buildLoserDamage(3, 0)).toBe(5 + 3 * 2); // 11
      expect(buildLoserDamage(8, 0)).toBe(5 + 8 * 2); // 21 (max possible)
    });

    it("should not depend on loserUnitCount", () => {
      const damageWith0Loser = buildLoserDamage(3, 0);
      const damageWith5Loser = buildLoserDamage(3, 5);
      const damageWith8Loser = buildLoserDamage(3, 8);
      expect(damageWith0Loser).toBe(damageWith5Loser);
      expect(damageWith5Loser).toBe(damageWith8Loser);
    });

    it("should handle typical battle scenarios", () => {
      // Winner survives with 4 units, loser with 0
      expect(buildLoserDamage(4, 0)).toBe(5 + 4 * 2); // 13

      // Winner survives with 2 units, loser with 1
      expect(buildLoserDamage(2, 1)).toBe(5 + 2 * 2); // 9

      // Close battle: winner with 1 unit, loser with 0
      expect(buildLoserDamage(1, 0)).toBe(5 + 1 * 2); // 7

      // Dominant win: winner with 8 units, loser with 0
      expect(buildLoserDamage(8, 0)).toBe(5 + 8 * 2); // 21
    });

    it("should always return at least base damage", () => {
      for (let winnerCount = 0; winnerCount <= 8; winnerCount++) {
        for (let loserCount = 0; loserCount <= 8; loserCount++) {
          const damage = buildLoserDamage(winnerCount, loserCount);
          expect(damage).toBeGreaterThanOrEqual(5);
        }
      }
    });

    it("should never return negative damage", () => {
      const damage = buildLoserDamage(0, 8);
      expect(damage).toBeGreaterThanOrEqual(0);
    });
  });
});
