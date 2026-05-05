import { describe, expect, test } from "vitest";

import type { BoardUnitPlacement } from "../../../src/shared/room-messages";
import {
  buildBattleOnlyDiagnosticScenarioRecordsFromMatchReport,
  buildBattleOnlyDiagnosticScenarioFromRoundSnapshot,
  buildFactionDisabledVariant,
  buildBattleOnlyDiagnosticMarkdown,
  resolveBattleOnlyDiagnosticSynergyPlacements,
  resolveBattleOnlyDiagnosticBossHpOverride,
  resolveBattleOnlyDiagnosticMaxDurationMs,
  runBattleOnlyDiagnostic,
} from "./bot-battle-diagnostic";

const createUnit = (
  cell: number,
  unitId: string,
  unitType: BoardUnitPlacement["unitType"],
  factionId: NonNullable<BoardUnitPlacement["factionId"]>,
  unitLevel: number,
): BoardUnitPlacement => ({
  cell,
  unitId,
  unitType,
  factionId,
  unitLevel,
});

describe("bot battle diagnostic", () => {
  test("uses production battle duration defaults for normal and final rounds", () => {
    expect(resolveBattleOnlyDiagnosticMaxDurationMs({ round: 11 })).toBe(40_000);
    expect(resolveBattleOnlyDiagnosticMaxDurationMs({ round: 12 })).toBe(600_000);
    expect(resolveBattleOnlyDiagnosticMaxDurationMs({ round: 12, maxDurationMs: 12_345 })).toBe(12_345);
  });

  test("uses production boss hp overrides for raid rounds", () => {
    expect(resolveBattleOnlyDiagnosticBossHpOverride(1)).toBe(1200);
    expect(resolveBattleOnlyDiagnosticBossHpOverride(11)).toBe(4400);
    expect(resolveBattleOnlyDiagnosticBossHpOverride(12)).toBe(3000);
  });

  test("carries activated boss spell ids from baseline battle reports", () => {
    const records = buildBattleOnlyDiagnosticScenarioRecordsFromMatchReport({
      matchIndex: 4,
      rounds: [{
        roundIndex: 12,
        battles: [{
          battleIndex: 0,
          leftPlayerId: "boss-1",
          rightPlayerId: "raid-1",
          winner: "left",
          bossSpellMetrics: [{
            spellId: "last-word",
            casterBattleUnitId: "boss-boss-1",
            activationCount: 1,
            firstActivationAtMs: 12_000,
            lastActivationAtMs: 12_000,
            tickCount: 3,
            firstTickAtMs: 13_000,
            lastTickAtMs: 15_000,
            totalDamage: 300,
            maxStack: 2,
          }],
        }],
        playersAtBattleStart: [
          {
            playerId: "boss-1",
            role: "boss",
            selectedBossId: "remilia",
            boardUnits: [
              { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 4, factionId: null, subUnitName: "" },
            ],
          },
          {
            playerId: "raid-1",
            role: "raid",
            boardUnits: [
              { cell: 30, unitId: "junko", unitType: "mage", unitLevel: 4, factionId: "kanjuden", subUnitName: "" },
            ],
          },
        ],
      }],
    });

    expect(records[0]?.scenario.leftActiveBossSpellId).toBe("last-word");
    expect(records[0]?.scenario.rightActiveBossSpellId).toBeUndefined();
  });

  test("applies special-unit level combat scaling to diagnostic boss units", () => {
    const lowLevelReport = runBattleOnlyDiagnostic({
      round: 12,
      maxDurationMs: 20_000,
      seeds: [901, 902],
      leftBossUnitIds: ["remilia"],
      leftPlacements: [
        { cell: 2, unitId: "remilia", unitType: "vanguard", archetype: "remilia", unitLevel: 1, factionId: null },
      ],
      rightPlacements: [
        createUnit(30, "junko", "mage", "kanjuden", 7),
        createUnit(31, "hecatia", "mage", "kanjuden", 7),
      ],
    });
    const highLevelReport = runBattleOnlyDiagnostic({
      round: 12,
      maxDurationMs: 20_000,
      seeds: [901, 902],
      leftBossUnitIds: ["remilia"],
      leftPlacements: [
        { cell: 2, unitId: "remilia", unitType: "vanguard", archetype: "remilia", unitLevel: 7, factionId: null },
      ],
      rightPlacements: [
        createUnit(30, "junko", "mage", "kanjuden", 7),
        createUnit(31, "hecatia", "mage", "kanjuden", 7),
      ],
    });

    expect(highLevelReport.variants[0]?.averageLeftDamage)
      .toBeGreaterThan(lowLevelReport.variants[0]?.averageLeftDamage ?? 0);
  });

  test("battle samples include boss defeat and survivor telemetry", () => {
    const report = runBattleOnlyDiagnostic({
      round: 12,
      maxDurationMs: 20_000,
      seeds: [905],
      includeBattleSamples: true,
      leftBossUnitIds: ["remilia"],
      leftBossHpOverride: 3000,
      leftPlacements: [
        { cell: 2, unitId: "remilia", unitType: "vanguard", archetype: "remilia", unitLevel: 4, factionId: null },
      ],
      rightPlacements: [
        createUnit(30, "junko", "mage", "kanjuden", 7),
        createUnit(31, "hecatia", "mage", "kanjuden", 7),
      ],
    });

    expect(report.battles?.[0]).toEqual(expect.objectContaining({
      seed: 905,
      endReason: expect.any(String),
      leftSurvivorDetails: expect.any(Array),
      rightSurvivorDetails: expect.any(Array),
      leftBossUnitStates: [
        expect.objectContaining({
          unitId: "remilia",
          unitLevel: 4,
          isBoss: true,
        }),
      ],
    }));
    expect(typeof report.battles?.[0]?.phaseDamageToBossSide).toBe("number");
  });

  test("excludes hero and boss special units from synergy placement inputs", () => {
    const placements: BoardUnitPlacement[] = [
      { cell: 2, unitId: "remilia", unitType: "vanguard", archetype: "remilia", unitLevel: 4, factionId: null },
      { cell: 30, unitId: "marisa", unitType: "mage", archetype: "marisa", hp: 400, attack: 60, unitLevel: 5 },
      createUnit(31, "patchouli", "mage", "kou_ryuudou", 4),
    ];

    expect(resolveBattleOnlyDiagnosticSynergyPlacements(placements, ["remilia"]).map((placement) => placement.unitId))
      .toEqual(["patchouli"]);
  });

  test("builds scenario records from a bot-only match report", () => {
    const records = buildBattleOnlyDiagnosticScenarioRecordsFromMatchReport({
      matchIndex: 17,
      rounds: [{
        roundIndex: 12,
        battles: [{
          battleIndex: 1,
          leftPlayerId: "raid-1",
          rightPlayerId: "boss-1",
          winner: "right",
        }],
        playersAtBattleStart: [
          {
            playerId: "raid-1",
            role: "raid",
            selectedHeroId: "reimu",
            boardUnits: [
              {
                cell: 30,
                unitId: "junko",
                unitType: "mage",
                unitLevel: 5,
                factionId: "kanjuden",
                subUnitName: "",
              },
            ],
          },
          {
            playerId: "boss-1",
            role: "boss",
            selectedBossId: "remilia",
            boardUnits: [
              {
                cell: 2,
                unitId: "remilia",
                unitType: "boss",
                unitLevel: 7,
                factionId: null,
                subUnitName: "",
              },
            ],
          },
        ],
      }],
    });

    expect(records).toEqual([{
      matchIndex: 17,
      roundIndex: 12,
      battleIndex: 1,
      leftPlayerId: "raid-1",
      rightPlayerId: "boss-1",
      winner: "right",
      scenario: {
        round: 12,
        leftPlacements: [{
          cell: 24,
          ownerPlayerId: "raid-1",
          unitId: "junko",
          unitType: "mage",
          unitLevel: 5,
          factionId: "kanjuden",
        }],
        rightPlacements: [{
          cell: 2,
          ownerPlayerId: "boss-1",
          unitId: "remilia",
          unitType: "vanguard",
          combatClass: "assassin",
          unitLevel: 7,
          factionId: null,
          archetype: "remilia",
        }],
        leftBossUnitIds: [],
        rightBossUnitIds: ["remilia"],
        rightBossHpOverride: 3000,
        leftHeroSynergyBonusType: ["ranger"],
        rightHeroSynergyBonusType: null,
      },
    }]);
  });

  test("carries deterministic battle seeds from bot-only match reports", () => {
    const records = buildBattleOnlyDiagnosticScenarioRecordsFromMatchReport({
      matchIndex: 17,
      rounds: [{
        roundIndex: 12,
        battles: [{
          battleIndex: 1,
          leftPlayerId: "raid-1",
          rightPlayerId: "boss-1",
          winner: "right",
          battleSeed: 712_345,
        }],
        playersAtBattleStart: [
          {
            playerId: "raid-1",
            role: "raid",
            selectedHeroId: "reimu",
            boardUnits: [
              { cell: 30, unitId: "junko", unitType: "mage", unitLevel: 5, factionId: "kanjuden", subUnitName: "" },
            ],
          },
          {
            playerId: "boss-1",
            role: "boss",
            selectedBossId: "remilia",
            boardUnits: [
              { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7, factionId: null, subUnitName: "" },
            ],
          },
        ],
      }],
    });

    expect(records[0]?.scenario.battleSeed).toBe(712_345);
  });

  test("builds a replay scenario from battle-start player board snapshots", () => {
    const scenario = buildBattleOnlyDiagnosticScenarioFromRoundSnapshot({
      roundIndex: 12,
      battle: {
        leftPlayerId: "raid-1",
        rightPlayerId: "boss-1",
      },
      playersAtBattleStart: [
        {
          playerId: "boss-1",
          role: "boss",
          selectedBossId: "remilia",
          boardUnits: [
            {
              cell: 2,
              unitId: "remilia",
              unitType: "boss",
              unitLevel: 7,
              factionId: null,
              subUnitName: "",
            },
            {
              cell: 8,
              unitId: "meiling",
              unitType: "vanguard",
              unitLevel: 7,
              factionId: null,
              subUnitName: "",
            },
          ],
        },
        {
          playerId: "raid-1",
          role: "raid",
          selectedHeroId: "reimu",
          boardUnits: [
            {
              cell: 26,
              unitId: "junko",
              unitType: "vanguard",
              unitLevel: 4,
              factionId: "kanjuden",
              subUnitName: "ヘカーティア",
              attachedSubUnitId: "hecatia",
              attachedSubUnitType: "vanguard",
              attachedSubUnitLevel: 4,
              attachedSubUnitFactionId: "kanjuden",
            },
            {
              cell: 30,
              unitId: "marisa",
              unitType: "mage",
              unitLevel: 5,
              subUnitName: "",
            },
          ],
        },
      ],
    });

    expect(scenario.round).toBe(12);
    expect(scenario.leftHeroSynergyBonusType).toEqual(["ranger"]);
    expect(scenario.rightHeroSynergyBonusType).toBeNull();
    expect(scenario.leftPlacements).toEqual([
      {
        cell: 24,
        ownerPlayerId: "raid-1",
        unitId: "junko",
        unitType: "vanguard",
        unitLevel: 4,
        factionId: "kanjuden",
        subUnit: {
          unitId: "hecatia",
          unitType: "vanguard",
          unitLevel: 4,
          factionId: "kanjuden",
        },
      },
      {
        cell: 25,
        ownerPlayerId: "raid-1",
        unitId: "marisa",
        unitType: "mage",
        unitLevel: 5,
        factionId: null,
      },
    ]);
    expect(scenario.rightPlacements).toEqual([
      {
        cell: 2,
        unitId: "remilia",
        unitType: "vanguard",
        combatClass: "assassin",
        unitLevel: 7,
        factionId: null,
        archetype: "remilia",
        ownerPlayerId: "boss-1",
      },
      {
        cell: 8,
        unitId: "meiling",
        unitType: "vanguard",
        unitLevel: 7,
        factionId: null,
        ownerPlayerId: "boss-1",
      },
    ]);
    expect(scenario.leftBossUnitIds).toEqual([]);
    expect(scenario.rightBossUnitIds).toEqual(["remilia"]);
    expect(scenario.leftBossHpOverride).toBeUndefined();
    expect(scenario.rightBossHpOverride).toBe(3000);
  });

  test("builds boss-vs-raid scenarios with all raid battle-start boards", () => {
    const scenario = buildBattleOnlyDiagnosticScenarioFromRoundSnapshot({
      roundIndex: 12,
      battle: {
        leftPlayerId: "boss-1",
        rightPlayerId: "raid-1",
      },
      playersAtBattleStart: [
        {
          playerId: "boss-1",
          role: "boss",
          selectedBossId: "remilia",
          boardUnits: [
            { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7, factionId: null, subUnitName: "" },
          ],
        },
        {
          playerId: "raid-1",
          role: "raid",
          selectedHeroId: "reimu",
          boardUnits: [
            { cell: 30, unitId: "nazrin", unitType: "ranger", unitLevel: 4, factionId: "myourenji", subUnitName: "" },
            { cell: 8, unitId: "reimu", unitType: "hero", unitLevel: 4, factionId: null, subUnitName: "" },
          ],
        },
        {
          playerId: "raid-2",
          role: "raid",
          selectedHeroId: "marisa",
          boardUnits: [
            { cell: 30, unitId: "utsuho", unitType: "mage", unitLevel: 4, factionId: "chireiden", subUnitName: "" },
            { cell: 8, unitId: "marisa", unitType: "hero", unitLevel: 4, factionId: null, subUnitName: "" },
          ],
        },
      ],
    });

    expect(scenario.leftBossUnitIds).toEqual(["remilia"]);
    expect(scenario.rightBossUnitIds).toEqual([]);
    expect(scenario.leftBossHpOverride).toBe(3000);
    expect(scenario.rightBossHpOverride).toBeUndefined();
    expect(scenario.leftHeroSynergyBonusType).toBeNull();
    expect(scenario.rightHeroSynergyBonusType).toEqual(["ranger", "mage"]);
    expect(scenario.rightPlacements.map((placement) => placement.unitId)).toEqual([
      "nazrin",
      "utsuho",
      "reimu",
      "marisa",
    ]);
    expect(scenario.rightPlacements.map((placement) => placement.unitId).sort()).toEqual([
      "marisa",
      "nazrin",
      "reimu",
      "utsuho",
    ]);
    expect(new Map(scenario.rightPlacements.map((placement) => [placement.unitId, placement.cell])).get("reimu"))
      .toBe(30);
    expect(new Map(scenario.rightPlacements.map((placement) => [placement.unitId, placement.cell])).get("marisa"))
      .toBe(32);
  });

  test("preserves reported raid hero battle cells when available", () => {
    const scenario = buildBattleOnlyDiagnosticScenarioFromRoundSnapshot({
      roundIndex: 12,
      battle: {
        leftPlayerId: "boss-1",
        rightPlayerId: "raid-1",
      },
      playersAtBattleStart: [
        {
          playerId: "boss-1",
          role: "boss",
          selectedBossId: "remilia",
          boardUnits: [
            { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 7, factionId: null, subUnitName: "" },
          ],
        },
        {
          playerId: "raid-1",
          role: "raid",
          selectedHeroId: "reimu",
          boardUnits: [
            { cell: 35, unitId: "reimu", unitType: "hero", unitLevel: 4, factionId: null, subUnitName: "" },
          ],
        },
      ],
    });

    expect(scenario.rightPlacements).toContainEqual(expect.objectContaining({
      unitId: "reimu",
      cell: 35,
    }));
  });

  test("maps raid hero special units with hero combat metadata", () => {
    const scenario = buildBattleOnlyDiagnosticScenarioFromRoundSnapshot({
      roundIndex: 3,
      battle: {
        leftPlayerId: "raid-1",
        rightPlayerId: "boss-1",
      },
      playersAtBattleStart: [
        {
          playerId: "raid-1",
          role: "raid",
          selectedHeroId: "reimu",
          boardUnits: [
            { cell: 8, unitId: "reimu", unitType: "hero", unitLevel: 4, subUnitName: "" },
          ],
        },
        {
          playerId: "boss-1",
          role: "boss",
          selectedBossId: "remilia",
          boardUnits: [
            { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 4, factionId: null, subUnitName: "" },
          ],
        },
      ],
    });

    expect(scenario.leftPlacements[0]).toEqual(expect.objectContaining({
      unitId: "reimu",
      unitType: "ranger",
      combatClass: "ranger",
      unitLevel: 4,
      hp: expect.any(Number),
      attack: expect.any(Number),
    }));
    expect(() => runBattleOnlyDiagnostic({
      ...scenario,
      seeds: [701],
      maxDurationMs: 10_000,
    })).not.toThrow();
  });

  test("maps attached raid hero sub units with hero combat metadata", () => {
    const scenario = buildBattleOnlyDiagnosticScenarioFromRoundSnapshot({
      roundIndex: 12,
      battle: {
        leftPlayerId: "raid-1",
        rightPlayerId: "boss-1",
      },
      playersAtBattleStart: [
        {
          playerId: "raid-1",
          role: "raid",
          selectedHeroId: "okina",
          boardUnits: [
            {
              cell: 30,
              unitId: "junko",
              unitType: "vanguard",
              unitLevel: 4,
              factionId: "kanjuden",
              attachedSubUnitId: "okina",
              attachedSubUnitType: "hero",
              attachedSubUnitLevel: 5,
            },
          ],
        },
        {
          playerId: "boss-1",
          role: "boss",
          selectedBossId: "remilia",
          boardUnits: [
            { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 4, factionId: null, subUnitName: "" },
          ],
        },
      ],
    });

    expect(scenario.leftPlacements[0]?.subUnit).toEqual(expect.objectContaining({
      unitId: "okina",
      unitType: "mage",
      combatClass: "mage",
      archetype: "okina",
      unitLevel: 5,
    }));
    expect(() => runBattleOnlyDiagnostic({
      ...scenario,
      seeds: [711],
      maxDurationMs: 10_000,
    })).not.toThrow();
  });

  test("runs faction variants against a scenario built from snapshots", () => {
    const scenario = buildBattleOnlyDiagnosticScenarioFromRoundSnapshot({
      roundIndex: 7,
      battle: {
        leftPlayerId: "raid-1",
        rightPlayerId: "boss-1",
      },
      playersAtBattleStart: [
        {
          playerId: "raid-1",
          role: "raid",
          boardUnits: [
            { cell: 26, unitId: "junko", unitType: "vanguard", unitLevel: 4, factionId: "kanjuden", subUnitName: "" },
            { cell: 30, unitId: "hecatia", unitType: "mage", unitLevel: 4, factionId: "kanjuden", subUnitName: "" },
          ],
        },
        {
          playerId: "boss-1",
          role: "boss",
          selectedBossId: "remilia",
          boardUnits: [
            { cell: 2, unitId: "remilia", unitType: "boss", unitLevel: 4, factionId: null, subUnitName: "" },
            { cell: 8, unitId: "meiling", unitType: "vanguard", unitLevel: 4, factionId: null, subUnitName: "" },
          ],
        },
      ],
    });

    const report = runBattleOnlyDiagnostic({
      ...scenario,
      seeds: [501, 502],
      maxDurationMs: 10_000,
      variants: [
        { id: "normal" },
        buildFactionDisabledVariant("faction-disabled"),
        { id: "kanjuden-disabled", disabledFactionIds: ["kanjuden"] },
      ],
    });

    expect(report.samplesPerVariant).toBe(2);
    expect(report.variants.map((variant) => variant.variantId)).toEqual([
      "normal",
      "faction-disabled",
      "kanjuden-disabled",
    ]);
    expect(report.comparisons).toHaveLength(2);
  });

  test("replays the same battle placements across normal and faction-disabled variants", () => {
    const report = runBattleOnlyDiagnostic({
      round: 7,
      maxDurationMs: 10_000,
      seeds: [101, 102, 103, 104],
      leftPlacements: [
        createUnit(20, "junko", "mage", "kanjuden", 4),
        createUnit(19, "hecatia", "vanguard", "kanjuden", 4),
        createUnit(21, "clownpiece", "ranger", "kanjuden", 4),
      ],
      rightPlacements: [
        createUnit(14, "kagerou", "vanguard", "grassroot_network", 4),
        createUnit(13, "wakasagihime", "ranger", "grassroot_network", 4),
        createUnit(15, "sekibanki", "assassin", "grassroot_network", 4),
      ],
      variants: [
        { id: "normal" },
        buildFactionDisabledVariant("faction-disabled"),
      ],
    });

    expect(report.samplesPerVariant).toBe(4);
    expect(report.variants).toHaveLength(2);
    expect(report.variants[0]).toEqual(expect.objectContaining({
      variantId: "normal",
      battleCount: 4,
    }));
    expect(report.variants[1]).toEqual(expect.objectContaining({
      variantId: "faction-disabled",
      battleCount: 4,
    }));
    expect(report.comparisons).toContainEqual(expect.objectContaining({
      baselineVariantId: "normal",
      variantId: "faction-disabled",
    }));
  });

  test("uses a captured battle seed as the default exact replay seed", () => {
    const report = runBattleOnlyDiagnostic({
      round: 12,
      battleSeed: 812_345,
      maxDurationMs: 10_000,
      leftPlacements: [
        createUnit(20, "junko", "mage", "kanjuden", 4),
      ],
      rightPlacements: [
        createUnit(14, "kagerou", "vanguard", "grassroot_network", 4),
      ],
      variants: [
        { id: "normal" },
        buildFactionDisabledVariant("faction-disabled"),
      ],
    });

    expect(report.samplesPerVariant).toBe(1);
    expect(report.seeds).toEqual([812_345]);
  });

  test("disabling factions removes faction ids without changing the original placements", () => {
    const leftPlacements = [
      createUnit(20, "junko", "mage", "kanjuden", 4),
      createUnit(19, "hecatia", "vanguard", "kanjuden", 4),
    ];

    const report = runBattleOnlyDiagnostic({
      seeds: [201],
      leftPlacements,
      rightPlacements: [
        createUnit(14, "kagerou", "vanguard", "grassroot_network", 4),
      ],
      variants: [
        { id: "normal" },
        buildFactionDisabledVariant("faction-disabled"),
      ],
      includeBattleSamples: true,
    });

    expect(leftPlacements.map((placement) => placement.factionId)).toEqual(["kanjuden", "kanjuden"]);
    expect(report.battles).toContainEqual(expect.objectContaining({
      variantId: "faction-disabled",
      seed: 201,
      leftFactionIds: [],
      rightFactionIds: [],
    }));
  });

  test("renders variant metrics and deltas as markdown", () => {
    const markdown = buildBattleOnlyDiagnosticMarkdown({
      samplesPerVariant: 2,
      seeds: [1, 2],
      variants: [
        {
          variantId: "normal",
          battleCount: 2,
          leftWinRate: 1,
          rightWinRate: 0,
          drawRate: 0,
          averageDurationMs: 1000,
          averageLeftDamage: 200,
          averageRightDamage: 50,
          averageLeftSurvivors: 2,
          averageRightSurvivors: 0,
        },
        {
          variantId: "faction-disabled",
          battleCount: 2,
          leftWinRate: 0.5,
          rightWinRate: 0.5,
          drawRate: 0,
          averageDurationMs: 1500,
          averageLeftDamage: 120,
          averageRightDamage: 100,
          averageLeftSurvivors: 1,
          averageRightSurvivors: 1,
        },
      ],
      comparisons: [
        {
          baselineVariantId: "normal",
          variantId: "faction-disabled",
          leftWinRateDelta: -0.5,
          rightWinRateDelta: 0.5,
          averageLeftDamageDelta: -80,
          averageRightDamageDelta: 50,
          averageLeftSurvivorsDelta: -1,
          averageRightSurvivorsDelta: 1,
        },
      ],
    });

    expect(markdown).toContain("# Battle-only Diagnostic");
    expect(markdown).toContain("| normal | 2 | 100.0% | 0.0% | 0.0% | 1000 | 200 | 50 | 2 | 0 |");
    expect(markdown).toContain("| faction-disabled | normal | -50.0pp | 50.0pp | -80 | 50 | -1 | 1 |");
  });
});
