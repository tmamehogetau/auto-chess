import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BattleResolutionService,
  type BattleResolutionDependencies,
  type MatchupOutcome,
  type BattleResolutionResult,
  type SpellCombatModifiers,
} from "../../../src/server/match-room-controller/battle-resolution";
import type { BattleUnit } from "../../../src/server/combat/battle-simulator";
import type { BoardUnitPlacement } from "../../../src/shared/room-messages";
import type { MatchLogger } from "../../../src/server/match-logger";
import { createBattleStartEvent } from "../../../src/server/combat/battle-timeline";

// Mock BattleSimulator
const createMockBattleSimulator = () => ({
  simulateBattle: vi.fn(),
});

// Mock MatchLogger - partial mock for testing
const createMockMatchLogger = () =>
  ({
    logBattleResult: vi.fn(),
  }) as unknown as MatchLogger;

describe("BattleResolutionService", () => {
  let service: BattleResolutionService;
  let mockBattleSimulator: ReturnType<typeof createMockBattleSimulator>;
  let mockMatchLogger: ReturnType<typeof createMockMatchLogger>;
  let dependencies: BattleResolutionDependencies;

  const mockLeftPlacements: BoardUnitPlacement[] = [
    { unitType: "vanguard", starLevel: 1, cell: 0 },
  ];
  const mockRightPlacements: BoardUnitPlacement[] = [
    { unitType: "ranger", starLevel: 1, cell: 4 },
  ];
  const mockTimeline = [
    createBattleStartEvent({
      battleId: "battle-1",
      round: 1,
      boardConfig: { width: 6, height: 6 },
      units: [],
    }),
  ];

  const createMockBattleUnit = (id: string, side: "left" | "right"): BattleUnit => ({
    id,
    sourceUnitId: id,
    type: "vanguard",
    starLevel: 1,
    hp: 100,
    maxHp: 100,
    attackPower: 10,
    attackSpeed: 0.5,
    attackRange: 1,
    cell: side === "left" ? 0 : 4,
    isDead: false,
    attackCount: 0,
    defense: 0,
    critRate: 0,
    critDamageMultiplier: 1.5,
    physicalReduction: undefined,
    magicReduction: undefined,
    buffModifiers: {
      attackMultiplier: 1,
      defenseMultiplier: 1,
      attackSpeedMultiplier: 1,
    },
  });

  beforeEach(() => {
    mockBattleSimulator = createMockBattleSimulator();
    mockMatchLogger = createMockMatchLogger();
    dependencies = {
      battleSimulator: mockBattleSimulator,
      matchLogger: mockMatchLogger,
      enableSubUnitSystem: false,
      subUnitAssistConfigByType: null,
    };
    service = new BattleResolutionService(dependencies);
  });

  describe("resolveMatchup", () => {
    it("should resolve matchup with left winner", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "left",
        leftSurvivors: [leftBattleUnits[0]],
        rightSurvivors: [],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 100, right: 50 },
        timeline: mockTimeline,
      });

      const result = service.resolveMatchup({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftBattleUnits,
        rightBattleUnits,
        leftHeroSynergyBonusType: null,
        rightHeroSynergyBonusType: null,
        battleIndex: 0,
      });

      expect(result.outcome.winnerId).toBe("player1");
      expect(result.outcome.loserId).toBe("player2");
      expect(result.outcome.isDraw).toBe(false);
      expect(result.leftBattleResult.won).toBe(true);
      expect(result.rightBattleResult.won).toBe(false);
      expect(result.leftBattleResult.survivorSnapshots).toEqual([
        {
          unitId: "unit1",
          displayName: "vanguard",
          unitType: "vanguard",
          hp: 100,
          maxHp: 100,
          combatCell: 0,
        },
      ]);
      expect(result.leftBattleResult.timeline).toEqual(mockTimeline);
      expect(result.rightBattleResult.timeline).toEqual(mockTimeline);
    });

    it("should resolve matchup with right winner", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "right",
        leftSurvivors: [],
        rightSurvivors: [rightBattleUnits[0]],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 50, right: 100 },
        timeline: mockTimeline,
      });

      const result = service.resolveMatchup({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftBattleUnits,
        rightBattleUnits,
        leftHeroSynergyBonusType: null,
        rightHeroSynergyBonusType: null,
        battleIndex: 0,
      });

      expect(result.outcome.winnerId).toBe("player2");
      expect(result.outcome.loserId).toBe("player1");
      expect(result.leftBattleResult.won).toBe(false);
      expect(result.rightBattleResult.won).toBe(true);
    });

    it("should handle draw", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "draw",
        leftSurvivors: [],
        rightSurvivors: [],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 50, right: 50 },
        timeline: mockTimeline,
      });

      const result = service.resolveMatchup({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftBattleUnits,
        rightBattleUnits,
        leftHeroSynergyBonusType: null,
        rightHeroSynergyBonusType: null,
        battleIndex: 0,
      });

      expect(result.outcome.winnerId).toBeNull();
      expect(result.outcome.loserId).toBeNull();
      expect(result.outcome.isDraw).toBe(true);
      expect(result.leftBattleResult.won).toBe(false);
      expect(result.rightBattleResult.won).toBe(false);
    });

    it("should log battle result", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "left",
        leftSurvivors: [leftBattleUnits[0]],
        rightSurvivors: [],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 100, right: 50 },
        timeline: mockTimeline,
      });

      service.resolveMatchup({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftBattleUnits,
        rightBattleUnits,
        leftHeroSynergyBonusType: null,
        rightHeroSynergyBonusType: null,
        battleIndex: 2,
      });

      expect(mockMatchLogger.logBattleResult).toHaveBeenCalledWith(
        1,
        2,
        "player1",
        "player2",
        "left",
        7, // damage: 5 + 1 * 2
        0,
        1,
        0,
      );
    });

    it("should work without matchLogger", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "left",
        leftSurvivors: [leftBattleUnits[0]],
        rightSurvivors: [],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 100, right: 50 },
        timeline: mockTimeline,
      });

      const serviceWithoutLogger = new BattleResolutionService({
        battleSimulator: mockBattleSimulator,
        matchLogger: null,
        enableSubUnitSystem: false,
        subUnitAssistConfigByType: null,
      });

      expect(() => {
        serviceWithoutLogger.resolveMatchup({
          battleId: "r1-p1-p2",
          roundIndex: 1,
          leftPlayerId: "player1",
          rightPlayerId: "player2",
          leftPlacements: mockLeftPlacements,
          rightPlacements: mockRightPlacements,
          leftBattleUnits,
          rightBattleUnits,
          leftHeroSynergyBonusType: null,
          rightHeroSynergyBonusType: null,
          battleIndex: 0,
        });
      }).not.toThrow();
    });

    it("should propagate logger updates via setMatchLogger", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "left",
        leftSurvivors: [leftBattleUnits[0]],
        rightSurvivors: [],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 100, right: 50 },
        timeline: mockTimeline,
      });

      // Create service without logger (simulating constructor-time capture)
      const serviceWithLateLogger = new BattleResolutionService({
        battleSimulator: mockBattleSimulator,
        matchLogger: null,
        enableSubUnitSystem: false,
        subUnitAssistConfigByType: null,
      });

      // Set logger after construction (simulating setMatchLogger call)
      const newMockLogger = createMockMatchLogger();
      serviceWithLateLogger.setMatchLogger(newMockLogger);

      // Run battle resolution
      serviceWithLateLogger.resolveMatchup({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftBattleUnits,
        rightBattleUnits,
        leftHeroSynergyBonusType: null,
        rightHeroSynergyBonusType: null,
        battleIndex: 0,
      });

      // Verify the new logger was called (not the old null logger)
      expect(newMockLogger.logBattleResult).toHaveBeenCalled();
    });

    it("should pass correct parameters to battle simulator", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "left",
        leftSurvivors: [leftBattleUnits[0]],
        rightSurvivors: [],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 100, right: 50 },
        timeline: mockTimeline,
      });

      service.resolveMatchup({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftBattleUnits,
        rightBattleUnits,
        leftHeroSynergyBonusType: "vanguard",
        rightHeroSynergyBonusType: "ranger",
        battleIndex: 0,
      });

      expect(mockBattleSimulator.simulateBattle).toHaveBeenCalledWith(
        leftBattleUnits,
        rightBattleUnits,
        mockLeftPlacements,
        mockRightPlacements,
        30000,
        "vanguard",
        "ranger",
        null,
        undefined,
      );
    });

    it("should pass subUnitAssistConfig when enabled", () => {
      const leftBattleUnits = [createMockBattleUnit("unit1", "left")];
      const rightBattleUnits = [createMockBattleUnit("unit2", "right")];
      const mockSubUnitConfig = new Map([
        ["vanguard" as const, { unitId: "sub1", mode: "assist" as const, bonusAttackPct: 0.1 }],
      ]);

      mockBattleSimulator.simulateBattle.mockReturnValue({
        winner: "left",
        leftSurvivors: [leftBattleUnits[0]],
        rightSurvivors: [],
        combatLog: [],
        durationMs: 1000,
        damageDealt: { left: 100, right: 50 },
        timeline: mockTimeline,
      });

      const serviceWithSubUnits = new BattleResolutionService({
        battleSimulator: mockBattleSimulator,
        matchLogger: mockMatchLogger,
        enableSubUnitSystem: true,
        subUnitAssistConfigByType: mockSubUnitConfig,
      });

      serviceWithSubUnits.resolveMatchup({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftBattleUnits,
        rightBattleUnits,
        leftHeroSynergyBonusType: null,
        rightHeroSynergyBonusType: null,
        battleIndex: 0,
      });

      expect(mockBattleSimulator.simulateBattle).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        30000,
        null,
        null,
        mockSubUnitConfig,
        undefined,
      );
    });
  });

  describe("applySpellModifiers", () => {
    it("should apply spell modifiers to battle units", () => {
      const battleUnits: BattleUnit[] = [
        createMockBattleUnit("unit1", "left"),
        createMockBattleUnit("unit2", "left"),
      ];

      const modifiers: SpellCombatModifiers = {
        attackMultiplier: 1.5,
        defenseMultiplier: 1.2,
        attackSpeedMultiplier: 0.8,
      };

      service.applySpellModifiers(battleUnits, modifiers);

      for (const unit of battleUnits) {
        expect(unit.buffModifiers.attackMultiplier).toBe(1.5);
        expect(unit.buffModifiers.defenseMultiplier).toBe(1.2);
        expect(unit.buffModifiers.attackSpeedMultiplier).toBe(0.8);
      }
    });

    it("should multiply with existing modifiers", () => {
      const battleUnits: BattleUnit[] = [
        {
          ...createMockBattleUnit("unit1", "left"),
          buffModifiers: {
            attackMultiplier: 2,
            defenseMultiplier: 1.5,
            attackSpeedMultiplier: 1.2,
          },
        },
      ];

      const modifiers: SpellCombatModifiers = {
        attackMultiplier: 1.5,
        defenseMultiplier: 1.2,
        attackSpeedMultiplier: 0.8,
      };

      service.applySpellModifiers(battleUnits, modifiers);

      expect(battleUnits[0]!.buffModifiers.attackMultiplier).toBeCloseTo(3); // 2 * 1.5
      expect(battleUnits[0]!.buffModifiers.defenseMultiplier).toBeCloseTo(1.8); // 1.5 * 1.2
      expect(battleUnits[0]!.buffModifiers.attackSpeedMultiplier).toBeCloseTo(0.96); // 1.2 * 0.8
    });

    it("should not modify units when modifiers is null", () => {
      const battleUnits: BattleUnit[] = [createMockBattleUnit("unit1", "left")];
      const originalModifiers = { ...battleUnits[0]!.buffModifiers };

      service.applySpellModifiers(battleUnits, null);

      expect(battleUnits[0]!.buffModifiers).toEqual(originalModifiers);
    });
  });

  describe("createBattleTraceLog", () => {
    it("should create battle trace log with correct structure", () => {
      const log = service.createBattleTraceLog({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftHeroId: "hero1",
        rightHeroId: null,
      });

      expect(log).toMatchObject({
        type: "battle_trace",
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        leftPlacements: mockLeftPlacements,
        rightPlacements: mockRightPlacements,
        leftHeroId: "hero1",
        rightHeroId: null,
      });
      expect(log.timestamp).toBeDefined();
    });
  });

  describe("createBattleResultTraceLog", () => {
    it("should create battle result trace log with correct structure", () => {
      const log = service.createBattleResultTraceLog({
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        winner: "left",
        leftSurvivors: 3,
        rightSurvivors: 0,
        leftDamageTaken: 0,
        rightDamageTaken: 11,
      });

      expect(log).toMatchObject({
        type: "battle_result_trace",
        battleId: "r1-p1-p2",
        roundIndex: 1,
        leftPlayerId: "player1",
        rightPlayerId: "player2",
        winner: "left",
        leftSurvivors: 3,
        rightSurvivors: 0,
        leftDamageTaken: 0,
        rightDamageTaken: 11,
      });
      expect(log.timestamp).toBeDefined();
    });
  });

  describe("calculateDamage", () => {
    it("should calculate damage correctly", () => {
      expect(service.calculateDamage(0, 0)).toBe(5);
      expect(service.calculateDamage(1, 0)).toBe(7);
      expect(service.calculateDamage(3, 2)).toBe(11);
      expect(service.calculateDamage(8, 0)).toBe(21);
    });
  });
});
