import { describe, expect, test } from "vitest";
import { DEFAULT_FLAGS } from "../../../src/shared/feature-flags";

import {
  BattleSimulator,
  createBattleUnit,
  type BattleUnit,
} from "../../../src/server/combat/battle-simulator";

/**
 * Boss Raid Simulation Tests
 *
 * Tests to measure win rates between boss (Remilia) and 3-player raid teams.
 * Target balance: Boss wins around 60% across representative raid compositions
 * Current baseline: Boss (HP: 580, ATK: 47, AS: 0.57, Reduction: 0/0%)
 * This keeps ★1 raid comps boss-favored while allowing stronger ★3 comps to win more often
 */

describe("Boss Raid Simulation", () => {
  const simulator = new BattleSimulator();

  /**
   * Create boss unit (Remilia)
   * Uses boss stats from JSON (hp: 580, attack: 47, attackSpeed: 0.57, range: 3)
   */
  function createBossUnit(): BattleUnit {
    const boss = createBattleUnit(
      { cell: 0, unitType: "vanguard", starLevel: 1, archetype: "remilia" },
      "right",
      0,
      true, // isBoss = true
      DEFAULT_FLAGS,
    );

    return boss;
  }

  /**
   * Create raid unit with specified type and star level
   */
  function createRaidUnit(
    unitType: "vanguard" | "ranger" | "mage" | "assassin",
    starLevel: number,
    cell: number,
  ): BattleUnit {
    return createBattleUnit(
      { cell, unitType, starLevel },
      "left",
      cell,
      false,
      DEFAULT_FLAGS,
    );
  }

  /**
   * Simulate boss vs raid battle
   * Returns result: "boss" | "raid" | "draw"
   */
  function simulateBossRaid(
    raidComposition: Array<{ type: "vanguard" | "ranger" | "mage" | "assassin"; starLevel: number }>,
    debug: boolean = false,
  ): { result: "boss" | "raid" | "draw"; durationMs: number } {
    const boss = createBossUnit();
    const raidUnits = raidComposition.map((unit, index) =>
      createRaidUnit(unit.type, unit.starLevel, index),
    );

    if (debug) {
      console.log("=== Boss Raid Debug ===");
      console.log("Boss:", { hp: boss.hp, attack: boss.attackPower, range: boss.attackRange, cell: boss.cell, id: boss.id });
      console.log("Raid units:", raidUnits.map(u => ({ hp: u.hp, attack: u.attackPower, range: u.attackRange, cell: u.cell, id: u.id })));
    }

    const battleResult = simulator.simulateBattle(
      raidUnits,
      [boss],
      [], // leftPlacements (not needed for this test)
      [], // rightPlacements (not needed for this test)
      30_000, // 30 second timeout for debugging
    );

    if (debug) {
      console.log("Battle result:", battleResult.winner);
      console.log("Duration:", battleResult.durationMs);
      console.log("Left survivors:", battleResult.leftSurvivors.length);
      console.log("Right survivors:", battleResult.rightSurvivors.length);
      console.log("Combat log (first 10):", battleResult.combatLog.slice(0, 10));
    }

    let result: "boss" | "raid" | "draw";
    if (battleResult.winner === "draw") {
      result = "draw";
    } else if (battleResult.winner === "right") {
      result = "boss";
    } else {
      result = "raid";
    }

    return { result, durationMs: battleResult.durationMs };
  }

  describe("Single Battle Tests", () => {
    test("レミリア vs ★3戦士3体の戦闘が実行可能である", () => {
      const composition = [
        { type: "vanguard" as const, starLevel: 3 },
        { type: "vanguard" as const, starLevel: 3 },
        { type: "vanguard" as const, starLevel: 3 },
      ];

      const { result, durationMs } = simulateBossRaid(composition, true); // Debug mode

      expect(["boss", "raid", "draw"]).toContain(result);
      expect(durationMs).toBeGreaterThan(0);
    });

    test("レミリア vs ★3戦士2体+射手1体の戦闘が実行可能である", () => {
      const composition = [
        { type: "vanguard" as const, starLevel: 3 },
        { type: "vanguard" as const, starLevel: 3 },
        { type: "ranger" as const, starLevel: 3 },
      ];

      const { result, durationMs } = simulateBossRaid(composition);

      expect(["boss", "raid", "draw"]).toContain(result);
      expect(durationMs).toBeGreaterThan(0);
    });

    test("レミリア vs ★3戦士1体+射手1体+魔法1体の戦闘が実行可能である", () => {
      const composition = [
        { type: "vanguard" as const, starLevel: 3 },
        { type: "ranger" as const, starLevel: 3 },
        { type: "mage" as const, starLevel: 3 },
      ];

      const { result, durationMs } = simulateBossRaid(composition);

      expect(["boss", "raid", "draw"]).toContain(result);
      expect(durationMs).toBeGreaterThan(0);
    });

    test("melee and assassin units use simple approach movement", () => {
      const leftUnits = [
        createRaidUnit("vanguard", 1, 0),
        createRaidUnit("assassin", 1, 1),
      ];
      const rightUnits = [
        createBattleUnit(
          { cell: 7, unitType: "ranger", starLevel: 1 },
          "right",
          0,
          false,
          DEFAULT_FLAGS,
        ),
      ];

      const battleResult = simulator.simulateBattle(
        leftUnits,
        rightUnits,
        [
          { cell: 0, unitType: "vanguard", starLevel: 1 },
          { cell: 1, unitType: "assassin", starLevel: 1 },
        ],
        [{ cell: 7, unitType: "ranger", starLevel: 1 }],
        5_000,
        null,
        null,
        null,
        { ...DEFAULT_FLAGS, enableBossExclusiveShop: true },
      );

      expect(
        battleResult.combatLog.some((entry) => entry.includes("Left Vanguard") && entry.includes("moves")),
      ).toBe(true);
      expect(
        battleResult.combatLog.some((entry) => entry.includes("Left Assassin") && entry.includes("moves")),
      ).toBe(true);
    });
  });

  describe("Win Rate Measurement", () => {
    test("★3戦士3体 vs レミリアの勝率測定（100試行）", () => {
      const composition = [
        { type: "vanguard" as const, starLevel: 3 },
        { type: "vanguard" as const, starLevel: 3 },
        { type: "vanguard" as const, starLevel: 3 },
      ];

      const iterations = 100;
      let bossWins = 0;
      let raidWins = 0;
      let draws = 0;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { result, durationMs } = simulateBossRaid(composition);

        if (result === "boss") bossWins++;
        else if (result === "raid") raidWins++;
        else draws++;

        durations.push(durationMs);
      }

      const bossWinRate = (bossWins / iterations) * 100;
      const raidWinRate = (raidWins / iterations) * 100;
      const drawRate = (draws / iterations) * 100;

      // Log results for analysis
      console.log("=== ★3戦士3体 vs レミリア ===");
      console.log(`Boss win rate: ${bossWinRate.toFixed(1)}%`);
      console.log(`Raid win rate: ${raidWinRate.toFixed(1)}%`);
      console.log(`Draw rate: ${drawRate.toFixed(1)}%`);
      console.log(`Avg duration: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0)}ms`);

      // Measurement-only visibility for one representative composition.
      expect(bossWinRate).toBeGreaterThanOrEqual(0);
      expect(bossWinRate).toBeLessThanOrEqual(100);
    });

    test("★3戦士2体+射手1体 vs レミリアの勝率測定（100試行）", () => {
      const composition = [
        { type: "vanguard" as const, starLevel: 3 },
        { type: "vanguard" as const, starLevel: 3 },
        { type: "ranger" as const, starLevel: 3 },
      ];

      const iterations = 100;
      let bossWins = 0;
      let raidWins = 0;
      let draws = 0;

      for (let i = 0; i < iterations; i++) {
        const { result } = simulateBossRaid(composition);

        if (result === "boss") bossWins++;
        else if (result === "raid") raidWins++;
        else draws++;
      }

      const bossWinRate = (bossWins / iterations) * 100;
      const raidWinRate = (raidWins / iterations) * 100;

      console.log("=== ★3戦士2体+射手1体 vs レミリア ===");
      console.log(`Boss win rate: ${bossWinRate.toFixed(1)}%`);
      console.log(`Raid win rate: ${raidWinRate.toFixed(1)}%`);

      // Measurement test - record actual values for analysis
      expect(bossWinRate).toBeGreaterThanOrEqual(0);
      expect(bossWinRate).toBeLessThanOrEqual(100);
    });

    test("★4ユニット3体 vs レミリアの勝率測定（100試行）", () => {
      const composition = [
        { type: "vanguard" as const, starLevel: 4 },
        { type: "ranger" as const, starLevel: 4 },
        { type: "mage" as const, starLevel: 4 },
      ];

      const iterations = 100;
      let bossWins = 0;
      let raidWins = 0;
      let draws = 0;

      for (let i = 0; i < iterations; i++) {
        const { result } = simulateBossRaid(composition);

        if (result === "boss") bossWins++;
        else if (result === "raid") raidWins++;
        else draws++;
      }

      const bossWinRate = (bossWins / iterations) * 100;

      console.log("=== ★4混成 vs レミリア ===");
      console.log(`Boss win rate: ${bossWinRate.toFixed(1)}%`);

      // Measurement test - record actual values for analysis
      expect(bossWinRate).toBeGreaterThanOrEqual(0);
      expect(bossWinRate).toBeLessThanOrEqual(100);
    });

    test("代表編成セットの総合ボス勝率が55-65%に収まる（60%目標）", () => {
      const scenarios: Array<{
        name: string;
        expectedAdvantage: "boss" | "raid";
        units: Array<{
          type: "vanguard" | "ranger" | "mage" | "assassin";
          starLevel: number;
        }>;
      }> = [
        {
          name: "boss-favored: ★1戦士3",
          expectedAdvantage: "boss",
          units: [
            { type: "vanguard", starLevel: 1 },
            { type: "vanguard", starLevel: 1 },
            { type: "vanguard", starLevel: 1 },
          ],
        },
        {
          name: "boss-favored: ★1射手3",
          expectedAdvantage: "boss",
          units: [
            { type: "ranger", starLevel: 1 },
            { type: "ranger", starLevel: 1 },
            { type: "ranger", starLevel: 1 },
          ],
        },
        {
          name: "boss-favored: ★1魔法3",
          expectedAdvantage: "boss",
          units: [
            { type: "mage", starLevel: 1 },
            { type: "mage", starLevel: 1 },
            { type: "mage", starLevel: 1 },
          ],
        },
        {
          name: "boss-favored: ★1暗殺3",
          expectedAdvantage: "boss",
          units: [
            { type: "assassin", starLevel: 1 },
            { type: "assassin", starLevel: 1 },
            { type: "assassin", starLevel: 1 },
          ],
        },
        {
          name: "boss-dominant: ★3戦士2+射手1",
          expectedAdvantage: "boss",
          units: [
            { type: "vanguard", starLevel: 3 },
            { type: "vanguard", starLevel: 3 },
            { type: "ranger", starLevel: 3 },
          ],
        },
        {
          name: "boss-dominant: ★3戦士2+魔法1",
          expectedAdvantage: "boss",
          units: [
            { type: "vanguard", starLevel: 3 },
            { type: "vanguard", starLevel: 3 },
            { type: "mage", starLevel: 3 },
          ],
        },
        {
          name: "boss-dominant: ★3射手3",
          expectedAdvantage: "boss",
          units: [
            { type: "ranger", starLevel: 3 },
            { type: "ranger", starLevel: 3 },
            { type: "ranger", starLevel: 3 },
          ],
        },
        {
          name: "boss-dominant: ★3暗殺2+射手1",
          expectedAdvantage: "boss",
          units: [
            { type: "assassin", starLevel: 3 },
            { type: "assassin", starLevel: 3 },
            { type: "ranger", starLevel: 3 },
          ],
        },
      ];

      const iterationsPerScenario = 25;
      let totalBossWins = 0;
      let totalBattles = 0;

      for (const scenario of scenarios) {
        let scenarioBossWins = 0;

        for (let index = 0; index < iterationsPerScenario; index += 1) {
          const { result } = simulateBossRaid(scenario.units);

          if (result === "boss") {
            scenarioBossWins += 1;
          }
        }

        const scenarioBossRate = scenarioBossWins / iterationsPerScenario;
        console.log(`${scenario.name}: ${(scenarioBossRate * 100).toFixed(1)}%`);

        totalBossWins += scenarioBossWins;
        totalBattles += iterationsPerScenario;
      }

      const overallBossWinRate = totalBossWins / totalBattles;
      expect(overallBossWinRate).toBeGreaterThanOrEqual(0.55);
      expect(overallBossWinRate).toBeLessThanOrEqual(0.65);
    });
  });

  describe("Detailed Balance Analysis", () => {
    test("ボスステータス検証（バランス調整後）", () => {
      const boss = createBossUnit();

      // Boss stats from JSON
      expect(boss.hp).toBe(580);
      expect(boss.maxHp).toBe(580);
      expect(boss.attackPower).toBe(47);
      expect(boss.attackSpeed).toBe(0.57);
      expect(boss.attackRange).toBe(3);
      expect(boss.isBoss).toBe(true);
      expect(boss.physicalReduction).toBe(0);
      expect(boss.magicReduction).toBe(0);
    });

    test("レイドチームの総ステータス検証", () => {
      const composition = [
        { type: "vanguard" as const, starLevel: 3 },
        { type: "vanguard" as const, starLevel: 3 },
        { type: "ranger" as const, starLevel: 3 },
      ];

      const raidUnits = composition.map((unit, index) =>
        createRaidUnit(unit.type, unit.starLevel, index),
      );

      const totalHp = raidUnits.reduce((sum, unit) => sum + unit.hp, 0);
      const totalDps = raidUnits.reduce((sum, unit) => {
        return sum + unit.attackPower / (1 / unit.attackSpeed);
      }, 0);

      console.log("=== レイドチーム総合ステータス（★3戦士2+射手1） ===");
      console.log(`Total HP: ${totalHp}`);
      console.log(`Total DPS: ${totalDps.toFixed(1)}`);
      console.log(`Time to kill boss: ${(2000 / totalDps).toFixed(1)}s`);

      // Verify raid team has reasonable stats
      expect(totalHp).toBeGreaterThan(0);
      expect(totalDps).toBeGreaterThan(0);
    });
  });
});
