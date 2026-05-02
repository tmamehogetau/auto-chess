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
        kou_ryuudou: "faction.kou_ryuudou",
        kanjuden: "faction.kanjuden",
      });
    });

    test("chireiden tier effect から軽減分反射 metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("chireiden", 1)).toEqual({
        effectId: "faction.chireiden",
        special: {
          factionDamageTakenMultiplier: 0.94,
          reflectPreventedDamage: true,
        },
      });
      expect(getTouhouFactionTierEffect("chireiden", 2)).toEqual({
        effectId: "faction.chireiden",
        special: {
          factionDamageTakenMultiplier: 0.88,
          reflectPreventedDamage: true,
        },
      });
    });

    test("myourenji tier effect から HP と守護結界 metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("myourenji", 1)).toEqual({
        effectId: "faction.myourenji",
        statModifiers: {
          hpMultiplier: 1.06,
        },
        special: {
          battleStartShieldMaxHpRatio: 0.06,
        },
      });
      expect(getTouhouFactionTierEffect("myourenji", 2)).toEqual({
        effectId: "faction.myourenji",
        statModifiers: {
          hpMultiplier: 1.1,
        },
        special: {
          battleStartShieldMaxHpRatio: 0.1,
        },
      });
      expect(getTouhouFactionTierEffect("myourenji", 3)).toEqual({
        effectId: "faction.myourenji",
        statModifiers: {
          hpMultiplier: 1.15,
        },
        special: {
          battleStartShieldMaxHpRatio: 0.14,
          shopCostReduction: 1,
        },
      });
    });

    test("grassroot_network tier effect から attack speed と追い込み metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("grassroot_network", 1)).toEqual({
        effectId: "faction.grassroot_network",
        statModifiers: {
          attackSpeedMultiplier: 1.1,
        },
      });
      expect(getTouhouFactionTierEffect("grassroot_network", 2)).toEqual({
        effectId: "faction.grassroot_network",
        statModifiers: {
          attackSpeedMultiplier: 1.15,
        },
        special: {
          bonusDamageVsLowHpTarget: 0.2,
        },
      });
    });

    test("shinreibyou tier effect から ultimate metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("shinreibyou", 1)).toEqual({
        effectId: "faction.shinreibyou",
        special: {
          ultimateDamageMultiplier: 1.1,
          initialManaBonus: 10,
        },
      });
      expect(getTouhouFactionTierEffect("shinreibyou", 2)).toEqual({
        effectId: "faction.shinreibyou",
        special: {
          ultimateDamageMultiplier: 1.18,
          initialManaBonus: 20,
          bonusDamageVsDebuffedTarget: 0.12,
        },
      });
      expect(getTouhouFactionTierEffect("shinreibyou", 3)).toEqual({
        effectId: "faction.shinreibyou",
        special: {
          ultimateDamageMultiplier: 1.3,
          initialManaBonus: 35,
          bonusDamageVsDebuffedTarget: 0.18,
          manaGainMultiplier: 1.15,
        },
      });
    });

    test("kou_ryuudou tier effect から battle/economy metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("kou_ryuudou", 1)).toEqual({
        effectId: "faction.kou_ryuudou",
        special: {
          battleEndGoldBonus: 1,
          initialManaBonus: 10,
        },
      });
      expect(getTouhouFactionTierEffect("kou_ryuudou", 2)).toEqual({
        effectId: "faction.kou_ryuudou",
        special: {
          battleEndGoldBonus: 2,
          initialManaBonus: 20,
          battleStartAttackSpeedMultiplier: 1.15,
          battleStartAttackSpeedDurationMs: 6000,
        },
      });
    });

    test("kanjuden tier effect から強めの火力/マナ/耐性 metadata を取得できる", () => {
      expect(getTouhouFactionTierEffect("kanjuden", 1)).toEqual({
        effectId: "faction.kanjuden",
        special: {
          damageDealtMultiplier: 1.12,
          initialManaBonus: 15,
          debuffImmunityCategories: ["crowd_control"],
        },
      });
      expect(getTouhouFactionTierEffect("kanjuden", 2)).toEqual({
        effectId: "faction.kanjuden",
        special: {
          damageDealtMultiplier: 1.25,
          initialManaBonus: 35,
          debuffImmunityCategories: ["crowd_control", "stat_down", "dot"],
        },
      });
    });
  });
});
