/**
 * Battle Resolution Service
 * Extracted from match-room-controller.ts to handle battle resolution logic
 * with dependency injection for testability
 */

import type { BattleUnit, BattleResult as SimulatorBattleResult } from "../combat/battle-simulator";
import type { BattleTimelineEvent, BoardUnitPlacement } from "../../shared/room-messages";
import type { MatchLogger } from "../match-logger";
import type { FeatureFlags } from "../../shared/feature-flags";
import { resolveSharedBoardUnitPresentation } from "../shared-board-unit-presentation";
import type { BattleResultSurvivorSnapshot } from "../types/player-state-types";

/**
 * Spell combat modifiers
 */
export interface SpellCombatModifiers {
  attackMultiplier: number;
  defenseMultiplier: number;
  attackSpeedMultiplier: number;
}
import { getMvpPhase1Boss, type SubUnitConfig } from "../../shared/types";
import type { BoardUnitType } from "../../shared/room-messages";
import { HEROES } from "../../data/heroes";
import { BOSS_CHARACTERS } from "../../shared/boss-characters";
import { buildLoserDamage } from "./damage-calculator";

/**
 * Battle resolution outcome
 */
export interface MatchupOutcome {
  winnerId: string | null;
  loserId: string | null;
  winnerUnitCount: number;
  loserUnitCount: number;
  isDraw: boolean;
}

/**
 * Battle result for a single player
 */
export interface PlayerBattleResult {
  opponentId: string;
  won: boolean;
  damageDealt: number;
  damageTaken: number;
  survivors: number;
  opponentSurvivors: number;
  phaseDamageToBoss?: number;
  survivorSnapshots?: BattleResultSurvivorSnapshot[];
  timeline?: BattleTimelineEvent[];
}

/**
 * Complete battle resolution result
 */
export interface BattleResolutionResult {
  outcome: MatchupOutcome;
  leftBattleResult: PlayerBattleResult;
  rightBattleResult: PlayerBattleResult;
  combatDamageDealt?: {
    left: number;
    right: number;
  };
  bossDamageToBoss?: number;
  phaseDamageToBossSide?: number;
}

/**
 * Battle simulator interface for dependency injection
 */
export interface IBattleSimulator {
  simulateBattle(
    leftBattleUnits: BattleUnit[],
    rightBattleUnits: BattleUnit[],
    leftPlacements: BoardUnitPlacement[],
    rightPlacements: BoardUnitPlacement[],
    maxDurationMs: number,
    leftHeroSynergyBonusType: BoardUnitType | BoardUnitType[] | null,
    rightHeroSynergyBonusType: BoardUnitType | BoardUnitType[] | null,
    subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig> | null,
    flags?: FeatureFlags,
    round?: number,
  ): SimulatorBattleResult;
}

/**
 * Dependencies for BattleResolutionService
 */
export interface BattleResolutionDependencies {
  battleSimulator: IBattleSimulator;
  matchLogger: MatchLogger | null;
  enableSubUnitSystem: boolean;
  subUnitAssistConfigByType: ReadonlyMap<BoardUnitType, SubUnitConfig> | null;
  featureFlags?: FeatureFlags;
}

/**
 * Logger provider function type for lazy logger resolution
 */
export type LoggerProvider = () => MatchLogger | null;

/**
 * Input parameters for battle trace log
 */
export interface BattleTraceLogInput {
  battleId: string;
  roundIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  leftPlacements: BoardUnitPlacement[];
  rightPlacements: BoardUnitPlacement[];
  leftHeroId: string | null;
  rightHeroId: string | null;
}

/**
 * Battle trace log output
 */
export interface BattleTraceLog {
  type: "battle_trace";
  battleId: string;
  roundIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  leftPlacements: BoardUnitPlacement[];
  rightPlacements: BoardUnitPlacement[];
  leftHeroId: string | null;
  rightHeroId: string | null;
  timestamp: number;
}

/**
 * Input parameters for battle result trace log
 */
export interface BattleResultTraceLogInput {
  battleId: string;
  roundIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  winner: "left" | "right" | "draw";
  leftSurvivors: number;
  rightSurvivors: number;
  leftDamageTaken: number;
  rightDamageTaken: number;
}

/**
 * Battle result trace log output
 */
export interface BattleResultTraceLog {
  type: "battle_result_trace";
  battleId: string;
  roundIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  winner: "left" | "right" | "draw";
  leftSurvivors: number;
  rightSurvivors: number;
  leftDamageTaken: number;
  rightDamageTaken: number;
  timestamp: number;
}

/**
 * Input parameters for resolveMatchup
 */
export interface ResolveMatchupInput {
  battleId: string;
  roundIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  leftPlacements: BoardUnitPlacement[];
  rightPlacements: BoardUnitPlacement[];
  leftBattleUnits: BattleUnit[];
  rightBattleUnits: BattleUnit[];
  leftHeroSynergyBonusType: BoardUnitType | BoardUnitType[] | null;
  rightHeroSynergyBonusType: BoardUnitType | BoardUnitType[] | null;
  battleIndex: number;
}

/**
 * Service for resolving battles between two players
 */
export class BattleResolutionService {
  private matchLogger: MatchLogger | null;

  constructor(private readonly deps: BattleResolutionDependencies) {
    this.matchLogger = deps.matchLogger;
  }

  /**
   * Update the match logger (called when logger is set after construction)
   */
  public setMatchLogger(logger: MatchLogger | null): void {
    this.matchLogger = logger;
  }

  /**
   * Resolve a matchup between two players
   * Returns the outcome and battle results for both players
   */
  resolveMatchup(input: ResolveMatchupInput): BattleResolutionResult {
    const {
      battleId,
      roundIndex,
      leftPlayerId,
      rightPlayerId,
      leftPlacements,
      rightPlacements,
      leftBattleUnits,
      rightBattleUnits,
      leftHeroSynergyBonusType,
      rightHeroSynergyBonusType,
      battleIndex,
    } = input;

    // Run battle simulation
    const battleResult = this.deps.battleSimulator.simulateBattle(
      leftBattleUnits,
      rightBattleUnits,
      leftPlacements,
      rightPlacements,
      roundIndex >= 12 ? 600_000 : 30000, // R12+は10分(事実上無制限), それ以外は30秒
      leftHeroSynergyBonusType,
      rightHeroSynergyBonusType,
      this.deps.enableSubUnitSystem ? this.deps.subUnitAssistConfigByType : null,
      this.deps.featureFlags,
      roundIndex,
    );

    // Process results based on winner
    let outcome: MatchupOutcome;
    let leftBattleResult: PlayerBattleResult;
    let rightBattleResult: PlayerBattleResult;

    if (battleResult.winner === "right") {
      const damageToLeft = this.calculateDamage(
        battleResult.rightSurvivors.length,
        battleResult.leftSurvivors.length,
      );

      leftBattleResult = {
        opponentId: rightPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: damageToLeft,
        survivors: battleResult.leftSurvivors.length,
        opponentSurvivors: battleResult.rightSurvivors.length,
        survivorSnapshots: this.buildSurvivorSnapshots(battleResult.leftSurvivors),
        timeline: battleResult.timeline,
      };

      rightBattleResult = {
        opponentId: leftPlayerId,
        won: true,
        damageDealt: damageToLeft,
        damageTaken: 0,
        survivors: battleResult.rightSurvivors.length,
        opponentSurvivors: battleResult.leftSurvivors.length,
        survivorSnapshots: this.buildSurvivorSnapshots(battleResult.rightSurvivors),
        timeline: battleResult.timeline,
      };

      outcome = {
        winnerId: rightPlayerId,
        loserId: leftPlayerId,
        winnerUnitCount: battleResult.rightSurvivors.length,
        loserUnitCount: battleResult.leftSurvivors.length,
        isDraw: false,
      };

      // Log battle result
      this.logBattleResult(
        roundIndex,
        battleIndex,
        leftPlayerId,
        rightPlayerId,
        "right",
        0,
        damageToLeft,
        battleResult.leftSurvivors.length,
        battleResult.rightSurvivors.length,
      );
    } else if (battleResult.winner === "left") {
      const damageToRight = this.calculateDamage(
        battleResult.leftSurvivors.length,
        battleResult.rightSurvivors.length,
      );

      leftBattleResult = {
        opponentId: rightPlayerId,
        won: true,
        damageDealt: damageToRight,
        damageTaken: 0,
        survivors: battleResult.leftSurvivors.length,
        opponentSurvivors: battleResult.rightSurvivors.length,
        survivorSnapshots: this.buildSurvivorSnapshots(battleResult.leftSurvivors),
        timeline: battleResult.timeline,
      };

      rightBattleResult = {
        opponentId: leftPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: damageToRight,
        survivors: battleResult.rightSurvivors.length,
        opponentSurvivors: battleResult.leftSurvivors.length,
        survivorSnapshots: this.buildSurvivorSnapshots(battleResult.rightSurvivors),
        timeline: battleResult.timeline,
      };

      outcome = {
        winnerId: leftPlayerId,
        loserId: rightPlayerId,
        winnerUnitCount: battleResult.leftSurvivors.length,
        loserUnitCount: battleResult.rightSurvivors.length,
        isDraw: false,
      };

      // Log battle result
      this.logBattleResult(
        roundIndex,
        battleIndex,
        leftPlayerId,
        rightPlayerId,
        "left",
        damageToRight,
        0,
        battleResult.leftSurvivors.length,
        battleResult.rightSurvivors.length,
      );
    } else {
      // Draw
      leftBattleResult = {
        opponentId: rightPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: 0,
        survivors: battleResult.leftSurvivors.length,
        opponentSurvivors: battleResult.rightSurvivors.length,
        survivorSnapshots: this.buildSurvivorSnapshots(battleResult.leftSurvivors),
        timeline: battleResult.timeline,
      };

      rightBattleResult = {
        opponentId: leftPlayerId,
        won: false,
        damageDealt: 0,
        damageTaken: 0,
        survivors: battleResult.rightSurvivors.length,
        opponentSurvivors: battleResult.leftSurvivors.length,
        survivorSnapshots: this.buildSurvivorSnapshots(battleResult.rightSurvivors),
        timeline: battleResult.timeline,
      };

      outcome = {
        winnerId: null,
        loserId: null,
        winnerUnitCount: battleResult.leftSurvivors.length,
        loserUnitCount: battleResult.rightSurvivors.length,
        isDraw: true,
      };

      // Log battle result
      this.logBattleResult(
        roundIndex,
        battleIndex,
        leftPlayerId,
        rightPlayerId,
        "draw",
        0,
        0,
        battleResult.leftSurvivors.length,
        battleResult.rightSurvivors.length,
      );
    }

    const resolutionResult: BattleResolutionResult = {
      outcome,
      leftBattleResult,
      rightBattleResult,
      combatDamageDealt: battleResult.damageDealt,
    };

    if (typeof battleResult.bossDamage === "number") {
      resolutionResult.bossDamageToBoss = battleResult.bossDamage;
    }
    if (typeof battleResult.phaseDamageToBossSide === "number") {
      resolutionResult.phaseDamageToBossSide = battleResult.phaseDamageToBossSide;
    }

    return resolutionResult;
  }

  private buildSurvivorSnapshots(survivors: BattleUnit[]): BattleResultSurvivorSnapshot[] {
    return survivors.map((survivor) => {
      const unitId = typeof survivor.sourceUnitId === "string" && survivor.sourceUnitId.length > 0
        ? survivor.sourceUnitId
        : survivor.id;
      const presentation = resolveSharedBoardUnitPresentation(unitId, survivor.type);
      return {
        unitId,
        battleUnitId: survivor.id,
        ownerPlayerId: typeof survivor.ownerPlayerId === "string" ? survivor.ownerPlayerId : "",
        displayName: presentation?.displayName ?? survivor.type,
        unitType: survivor.type,
        hp: Math.max(0, Math.round(Number(survivor.hp) || 0)),
        maxHp: Math.max(0, Math.round(Number(survivor.maxHp) || 0)),
        sharedBoardCellIndex: Number.isInteger(survivor.cell) ? survivor.cell : -1,
      };
    });
  }

  /**
   * Apply spell combat modifiers to battle units
   */
  applySpellModifiers(
    battleUnits: BattleUnit[],
    modifiers: SpellCombatModifiers | null,
  ): void {
    if (!modifiers) {
      return;
    }

    for (const battleUnit of battleUnits) {
      battleUnit.buffModifiers.attackMultiplier *= modifiers.attackMultiplier;
      battleUnit.buffModifiers.defenseMultiplier *= modifiers.defenseMultiplier;
      battleUnit.buffModifiers.attackSpeedMultiplier *= modifiers.attackSpeedMultiplier;
    }
  }

  /**
   * Create a battle trace log
   */
  createBattleTraceLog(input: BattleTraceLogInput): BattleTraceLog {
    return {
      type: "battle_trace",
      battleId: input.battleId,
      roundIndex: input.roundIndex,
      leftPlayerId: input.leftPlayerId,
      rightPlayerId: input.rightPlayerId,
      leftPlacements: input.leftPlacements,
      rightPlacements: input.rightPlacements,
      leftHeroId: input.leftHeroId,
      rightHeroId: input.rightHeroId,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a battle result trace log
   */
  createBattleResultTraceLog(input: BattleResultTraceLogInput): BattleResultTraceLog {
    return {
      type: "battle_result_trace",
      battleId: input.battleId,
      roundIndex: input.roundIndex,
      leftPlayerId: input.leftPlayerId,
      rightPlayerId: input.rightPlayerId,
      winner: input.winner,
      leftSurvivors: input.leftSurvivors,
      rightSurvivors: input.rightSurvivors,
      leftDamageTaken: input.leftDamageTaken,
      rightDamageTaken: input.rightDamageTaken,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate damage dealt to loser
   */
  calculateDamage(winnerUnitCount: number, loserUnitCount: number): number {
    return buildLoserDamage(winnerUnitCount, loserUnitCount);
  }

  /**
   * Create a hero battle unit from hero ID
   */
  createHeroBattleUnit(
    heroId: string | undefined,
    playerId: string,
    boardCellIndex?: number,
    battleSide: "left" | "right" = "left",
  ): BattleUnit | null {
    if (!heroId) return null;

    const hero = HEROES.find((h) => h.id === heroId);
    if (!hero) return null;
    const resolvedBoardCellIndex = (
      typeof boardCellIndex === "number" && Number.isInteger(boardCellIndex)
    ) ? boardCellIndex : 8;

    return {
      id: `hero-${playerId}`,
      ownerPlayerId: playerId,
      sourceUnitId: hero.id,
      battleSide,
      type: hero.unitType,
      starLevel: 1,
      hp: hero.hp,
      maxHp: hero.hp,
      attackPower: hero.attack,
      attackSpeed: hero.attackSpeed,
      attackRange: hero.range,
      cell: resolvedBoardCellIndex,
      isDead: false,
      attackCount: 0,
      defense: hero.defense,
      critRate: hero.critRate,
      critDamageMultiplier: hero.critDamageMultiplier,
      physicalReduction: hero.physicalReduction,
      magicReduction: hero.magicReduction,
      buffModifiers: {
        attackMultiplier: 1,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 1,
      },
    };
  }

  createBossBattleUnit(
    bossId: string | undefined,
    playerId: string,
    boardCellIndex?: number,
    phaseHpTarget?: number,
    battleSide: "left" | "right" = "right",
  ): BattleUnit | null {
    if (!bossId) return null;

    const boss = BOSS_CHARACTERS.find((candidate) => candidate.id === bossId);
    if (!boss) return null;

    const resolvedBoardCellIndex = (
      typeof boardCellIndex === "number" && Number.isInteger(boardCellIndex)
    ) ? boardCellIndex : 2;
    const bossStats = getMvpPhase1Boss();

    return {
      id: `boss-${playerId}`,
      ownerPlayerId: playerId,
      sourceUnitId: boss.id,
      battleSide,
      type: "vanguard" as BoardUnitType,
      starLevel: 1,
      hp: typeof phaseHpTarget === "number" && phaseHpTarget > 0 ? phaseHpTarget : bossStats.hp,
      maxHp: typeof phaseHpTarget === "number" && phaseHpTarget > 0 ? phaseHpTarget : bossStats.hp,
      attackPower: bossStats.attack,
      attackSpeed: bossStats.attackSpeed,
      attackRange: bossStats.range,
      cell: resolvedBoardCellIndex,
      isDead: false,
      isBoss: true,
      attackCount: 0,
      defense: 0,
      critRate: 0,
      critDamageMultiplier: 1.5,
      physicalReduction: bossStats.physicalReduction,
      magicReduction: bossStats.magicReduction,
      buffModifiers: {
        attackMultiplier: 1,
        defenseMultiplier: 1,
        attackSpeedMultiplier: 1,
      },
    };
  }

  /**
   * Get hero synergy bonus type from hero ID
   */
  getHeroSynergyBonusType(heroId: string | undefined): BoardUnitType | null {
    if (!heroId) return null;
    const bonusType = HEROES.find((h) => h.id === heroId)?.synergyBonusType;
    if (!bonusType) return null;
    // Cast to BoardUnitType since hero synergy bonus types are valid BoardUnitTypes
    return bonusType as BoardUnitType;
  }

  /**
   * Log battle result to MatchLogger
   */
  private logBattleResult(
    roundIndex: number,
    battleIndex: number,
    leftPlayerId: string,
    rightPlayerId: string,
    winner: "left" | "right" | "draw",
    leftDamageDealt: number,
    rightDamageDealt: number,
    leftSurvivors: number,
    rightSurvivors: number,
  ): void {
    this.matchLogger?.logBattleResult(
      roundIndex,
      battleIndex,
      leftPlayerId,
      rightPlayerId,
      winner,
      leftDamageDealt,
      rightDamageDealt,
      leftSurvivors,
      rightSurvivors,
    );
  }
}
