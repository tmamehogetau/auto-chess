import { describe, expect, test } from "vitest";

import type { BoardUnitPlacement } from "../../../src/shared/room-messages";
import {
  calculateSynergyDetails,
  getSynergyTier,
  getTouhouFactionTierEffect,
  TOUHOU_FACTION_EFFECT_IDS,
} from "../../../src/server/combat/synergy-definitions";

describe("synergy-definitions", () => {
  describe("Touhou faction tiers", () => {
    test("enableTouhouFactions=false のとき faction activation は返さない", () => {
      const placements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", unitId: "rin", factionId: "chireiden" },
        { cell: 1, unitType: "mage", unitId: "satori", factionId: "chireiden" },
      ];

      const details = calculateSynergyDetails(placements, null, { enableTouhouFactions: false });

      expect(details.factionCounts).toEqual({});
      expect(details.factionActiveTiers).toEqual({});
    });

    test("enableTouhouFactions=true のとき chireiden の [2,4] 閾値を数える", () => {
      const placements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "vanguard", unitId: "rin", factionId: "chireiden" },
        { cell: 1, unitType: "mage", unitId: "satori", factionId: "chireiden" },
        { cell: 2, unitType: "assassin", unitId: "koishi", factionId: "chireiden" },
        { cell: 3, unitType: "mage", unitId: "utsuho", factionId: "chireiden" },
      ];

      const details = calculateSynergyDetails(placements, null, { enableTouhouFactions: true });

      expect(details.factionCounts.chireiden).toBe(4);
      expect(details.factionActiveTiers.chireiden).toBe(2);
    });

    test("myourenji の [2,3,5] と grassroot_network の [2,3] を個別に計算する", () => {
      const placements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "ranger", unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "vanguard", unitId: "ichirin", factionId: "myourenji" },
        { cell: 2, unitType: "mage", unitId: "murasa", factionId: "myourenji" },
        { cell: 3, unitType: "mage", unitId: "shou", factionId: "myourenji" },
        { cell: 4, unitType: "vanguard", unitId: "byakuren", factionId: "myourenji" },
        { cell: 5, unitType: "ranger", unitId: "wakasagihime", factionId: "grassroot_network" },
        { cell: 6, unitType: "assassin", unitId: "sekibanki", factionId: "grassroot_network" },
      ];

      const details = calculateSynergyDetails(placements, null, { enableTouhouFactions: true });

      expect(details.factionCounts.myourenji).toBe(5);
      expect(details.factionActiveTiers.myourenji).toBe(3);
      expect(details.factionCounts.grassroot_network).toBe(2);
      expect(details.factionActiveTiers.grassroot_network).toBe(1);
    });

    test("heroSynergyBonusType は既存 class synergy にだけ加算される", () => {
      const placements: BoardUnitPlacement[] = [
        { cell: 0, unitType: "ranger", unitId: "nazrin", factionId: "myourenji" },
        { cell: 1, unitType: "ranger", unitId: "tojiko", factionId: "shinreibyou" },
      ];

      const details = calculateSynergyDetails(placements, "ranger", { enableTouhouFactions: true });

      expect(details.countsByType.ranger).toBe(3);
      expect(details.activeTiers.ranger).toBe(1);
      expect(details.factionCounts.myourenji).toBe(1);
      expect(details.factionCounts.shinreibyou).toBe(1);
      expect(details.factionActiveTiers.myourenji).toBe(0);
      expect(details.factionActiveTiers.shinreibyou).toBe(0);
    });
  });

  describe("getSynergyTier", () => {
    test("可変長 threshold でも最大 tier を返す", () => {
      expect(getSynergyTier(1, [2, 4])).toBe(0);
      expect(getSynergyTier(2, [2, 4])).toBe(1);
      expect(getSynergyTier(4, [2, 4])).toBe(2);
      expect(getSynergyTier(5, [2, 3, 5])).toBe(3);
    });
  });

  describe("Touhou faction effect metadata", () => {
    test("確定済み faction row の stable effectId を公開する", () => {
      expect(TOUHOU_FACTION_EFFECT_IDS).toEqual({
        chireiden: "faction.chireiden",
        myourenji: "faction.myourenji",
        shinreibyou: "faction.shinreibyou",
        grassroot_network: "faction.grassroot_network",
        niji_ryuudou: "faction.niji_ryuudou",
        kanjuden: "faction.kanjuden",
      });
    });

    test("chireiden tier effect から final metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("chireiden", 1)).toEqual({
        effectId: "faction.chireiden",
        statModifiers: {
          defense: 1,
        },
        special: {
          reflectRatio: 0.1,
        },
      });
      expect(getTouhouFactionTierEffect("chireiden", 2)).toEqual({
        effectId: "faction.chireiden",
        statModifiers: {
          defense: 2,
        },
        special: {
          reflectRatio: 0.2,
        },
      });
    });

    test("myourenji tier effect から final metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("myourenji", 1)).toEqual({
        effectId: "faction.myourenji",
        statModifiers: {
          hpMultiplier: 1.05,
          attackPower: 0,
        },
      });
      expect(getTouhouFactionTierEffect("myourenji", 2)).toEqual({
        effectId: "faction.myourenji",
        statModifiers: {
          hpMultiplier: 1.1,
          attackPower: 1,
        },
        special: {
          shopCostReduction: 1,
        },
      });
      expect(getTouhouFactionTierEffect("myourenji", 3)).toEqual({
        effectId: "faction.myourenji",
        statModifiers: {
          hpMultiplier: 1.15,
          attackPower: 2,
        },
        special: {
          shopCostReduction: 1,
        },
      });
    });

    test("shinreibyou tier effect から ultimate metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("shinreibyou", 1)).toEqual({
        effectId: "faction.shinreibyou",
        special: {
          ultimateDamageMultiplier: 1.1,
        },
      });
      expect(getTouhouFactionTierEffect("shinreibyou", 2)).toEqual({
        effectId: "faction.shinreibyou",
        special: {
          ultimateDamageMultiplier: 1.2,
          bonusDamageVsDebuffedTarget: 0.12,
        },
      });
      expect(getTouhouFactionTierEffect("shinreibyou", 3)).toEqual({
        effectId: "faction.shinreibyou",
        special: {
          ultimateDamageMultiplier: 1.35,
          bonusDamageVsDebuffedTarget: 0.18,
        },
      });
    });

    test("niji_ryuudou tier effect から shop/item metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("niji_ryuudou", 1)).toEqual({
        effectId: "faction.niji_ryuudou",
        special: {
          shopCostReduction: 1,
        },
      });
      expect(getTouhouFactionTierEffect("niji_ryuudou", 2)).toEqual({
        effectId: "faction.niji_ryuudou",
        special: {
          shopCostReduction: 1,
          firstItemUseDraws: 1,
        },
      });
    });
  });
});
