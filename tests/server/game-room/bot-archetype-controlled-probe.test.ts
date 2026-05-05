import { describe, expect, test } from "vitest";

import {
  buildBotArchetypeControlledProbeJapaneseMarkdown,
  runBotArchetypeControlledProbe,
} from "./bot-archetype-controlled-probe";

describe("bot archetype controlled probe", () => {
  test("covers representative units for each major archetype family by default", () => {
    const report = runBotArchetypeControlledProbe({
      samplesPerScenario: 1,
      unitLevel: 4,
      enemyUnitLevel: 3,
      roundIndex: 7,
      seedBase: 30,
    });

    expect(report.metrics.map((metric) => metric.unitId)).toEqual(expect.arrayContaining([
      "utsuho",
      "byakuren",
      "miko",
      "kagerou",
      "megumu",
      "hecatia",
      "zanmu",
      "patchouli",
    ]));
    expect(report.metrics.map((metric) => metric.primaryArchetypeTag)).toEqual(expect.arrayContaining([
      "chireiden_core",
      "myourenji_core",
      "shinreibyou_core",
      "grassroot_core",
      "kou_ryuudou_core",
      "kanjuden_core",
      "factionless_carry",
      "scarlet_core",
    ]));
  });

  test("runs paired fit and non-fit samples for a target unit under matched round and level", () => {
    const report = runBotArchetypeControlledProbe({
      samplesPerScenario: 3,
      unitIds: ["patchouli"],
      unitLevel: 4,
      enemyUnitLevel: 5,
      roundIndex: 7,
      seedBase: 10,
    });

    expect(report.samplesPerScenario).toBe(3);
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0]).toEqual(expect.objectContaining({
      unitId: "patchouli",
      primaryArchetypeTag: "scarlet_core",
      roundIndex: 7,
      unitLevel: 4,
      enemyUnitLevel: 5,
      fitBattleCount: 3,
      nonFitBattleCount: 3,
      comparableBattleCount: 6,
      averageFitEffectiveStrengthScore: expect.any(Number),
      averageNonFitEffectiveStrengthScore: expect.any(Number),
      averageFitMarginalStrengthScore: expect.any(Number),
      averageNonFitMarginalStrengthScore: expect.any(Number),
      marginalStrengthLift: expect.any(Number),
      effectiveStrengthLift: expect.any(Number),
      effectiveStrengthIndex: expect.any(Number),
      averageFitTargetDamage: expect.any(Number),
      averageNonFitTargetDamage: expect.any(Number),
    }));
  });

  test("builds a Japanese markdown report for controlled probe metrics", () => {
    const report = runBotArchetypeControlledProbe({
      samplesPerScenario: 2,
      unitIds: ["sakuya"],
      unitLevel: 4,
      enemyUnitLevel: 5,
      roundIndex: 7,
      seedBase: 20,
    });

    const markdown = buildBotArchetypeControlledProbeJapaneseMarkdown(report);

    expect(markdown).toContain("# Bot Archetype Controlled Probe レポート");
    expect(markdown).toContain("| ユニット名 | ユニットID | アーキタイプ | R | Lv | 比較戦闘数 | fit限界score | nonfit限界score | 限界リフト | 限界指数 | fit実効score | nonfit実効score | fit与ダメ | nonfit与ダメ | fit勝率 | nonfit勝率 |");
    expect(markdown).toContain("| 十六夜咲夜 | sakuya | scarlet_core | 7 | 4 | 4 |");
    expect(markdown).toContain("## 限界リフトランキング");
    expect(markdown).toContain("| 順位 | ユニット名 | ユニットID | アーキタイプ | 限界リフト | fit勝率 | nonfit勝率 |");
  });
});
