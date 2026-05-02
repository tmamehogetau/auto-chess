import { describe, expect, test } from "vitest";

import type { UnitProgressionBonusConfig } from "../../src/shared/progression-bonus-types";
import {
  getMilestoneBonusScore,
  getProgressionMilestoneStage,
  getSpecialUnitUpgradeValueScore,
  getStandardUnitLevelValueScore,
  resolveSpecialUnitProgressionBonusConfig,
} from "../../src/server/progression-bonus-config";

describe("progression-bonus-config", () => {
  test("special unit progression bonus config resolves heroes and exclusive units", () => {
    expect(resolveSpecialUnitProgressionBonusConfig("jyoon")).toMatchObject({
      baseGrowthProfile: "late-bloom",
      skillImplementationState: "implemented",
    });
    expect(resolveSpecialUnitProgressionBonusConfig("shion")).toMatchObject({
      baseGrowthProfile: "debuff",
      level4Bonus: {
        kind: "pair-skill-unlock",
        summary: "Lv4で最凶最悪の双子神が解禁される",
        skillScore: 22,
      },
      level7Bonus: {
        kind: "pair-skill-upgrade",
        summary: "Lv7で最凶最悪の双子神の妨害と女苑支援が強化される",
        skillScore: 20,
      },
      skillImplementationState: "implemented",
    });
    expect(resolveSpecialUnitProgressionBonusConfig("remilia")).toMatchObject({
      baseGrowthProfile: "boss-offense",
      level4Bonus: {
        kind: "boss-pressure",
        statScore: 18,
      },
      level7Bonus: {
        kind: "boss-finisher",
        statScore: 28,
      },
      skillImplementationState: "implemented",
    });
  });

  test("milestone bonus score applies level 4/7 bonuses only on the threshold step", () => {
    const progression: UnitProgressionBonusConfig = {
      baseGrowthProfile: "balanced",
      level4Bonus: {
        kind: "support-spike",
        summary: "Lv4 bonus",
        statScore: 20,
        skillScore: 10,
      },
      level7Bonus: {
        kind: "finish-spike",
        summary: "Lv7 bonus",
        statScore: 35,
        skillScore: 15,
      },
      skillImplementationState: "implemented",
    };

    expect(getMilestoneBonusScore(2, progression)).toBe(0);
    expect(getMilestoneBonusScore(3, progression)).toBe(30);
    expect(getMilestoneBonusScore(6, progression)).toBe(50);
  });

  test("provisional skill contribution is discounted in milestone bonus score", () => {
    const progression: UnitProgressionBonusConfig = {
      baseGrowthProfile: "support",
      level4Bonus: {
        kind: "provisional-skill",
        summary: "Lv4 provisional",
        statScore: 12,
        skillScore: 20,
      },
      level7Bonus: null,
      skillImplementationState: "provisional",
    };

    expect(getMilestoneBonusScore(3, progression)).toBe(22);
  });

  test("jyoon late-game upgrade value beats standard heroes once her growth spike starts", () => {
    const jyoonScore = getSpecialUnitUpgradeValueScore("jyoon", 5, 6);
    const reimuScore = getSpecialUnitUpgradeValueScore("reimu", 5, 5);

    expect(jyoonScore).toBeGreaterThan(reimuScore);
  });

  test("milestone stage resolves unlock at level 4 and upgrade at level 7", () => {
    const progression = resolveSpecialUnitProgressionBonusConfig("mayumi");

    expect(getProgressionMilestoneStage(3, progression)).toBe(0);
    expect(getProgressionMilestoneStage(4, progression)).toBe(1);
    expect(getProgressionMilestoneStage(7, progression)).toBe(2);
  });

  test("standard unit level value score can include shared milestone bonuses", () => {
    const progression: UnitProgressionBonusConfig = {
      baseGrowthProfile: "standard",
      level4Bonus: {
        kind: "formation-spike",
        summary: "Lv4 standard bonus",
        statScore: 15,
        skillScore: 5,
      },
      level7Bonus: null,
      skillImplementationState: "implemented",
    };

    expect(getStandardUnitLevelValueScore("dummy", 2, progression)).toBeCloseTo(15);
    expect(getStandardUnitLevelValueScore("dummy", 3, progression)).toBeCloseTo(60);
  });
});
