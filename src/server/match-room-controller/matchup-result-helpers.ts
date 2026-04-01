import type {
  BattleResolutionResult,
  PlayerBattleResult,
} from "./battle-resolution";

export interface BattleResultAssignment {
  playerId: string;
  battleResult: PlayerBattleResult;
}

export interface RaidBattleResultContext {
  bossPlayerId: string;
  raidPlayerIds: string[];
  bossIsLeft: boolean;
}

export interface BattleResultTraceSummary {
  winner: "left" | "right" | "draw";
  leftSurvivors: number;
  rightSurvivors: number;
  leftDamageTaken: number;
  rightDamageTaken: number;
}

export function buildBattleResultAssignments(
  leftPlayerId: string,
  rightPlayerId: string,
  resolutionResult: BattleResolutionResult,
  raidBattleContext: RaidBattleResultContext | null,
): BattleResultAssignment[] {
  if (!raidBattleContext) {
    return [
      { playerId: leftPlayerId, battleResult: resolutionResult.leftBattleResult },
      { playerId: rightPlayerId, battleResult: resolutionResult.rightBattleResult },
    ];
  }

  const bossBattleResult = raidBattleContext.bossIsLeft
    ? resolutionResult.leftBattleResult
    : resolutionResult.rightBattleResult;
  const raidBattleResult = raidBattleContext.bossIsLeft
    ? resolutionResult.rightBattleResult
    : resolutionResult.leftBattleResult;
  const phaseDamageToBoss = raidBattleContext.bossIsLeft
    ? resolutionResult.combatDamageDealt?.right ?? 0
    : resolutionResult.combatDamageDealt?.left ?? 0;

  return [
    {
      playerId: raidBattleContext.bossPlayerId,
      battleResult: {
        ...bossBattleResult,
        phaseDamageToBoss,
      },
    },
    ...raidBattleContext.raidPlayerIds.map((playerId) => ({
      playerId,
      battleResult: {
        ...raidBattleResult,
        opponentId: raidBattleContext.bossPlayerId,
      },
    })),
  ];
}

export function buildBattleResultTraceSummary(
  leftPlayerId: string,
  resolutionResult: BattleResolutionResult,
): BattleResultTraceSummary {
  const { outcome } = resolutionResult;

  if (outcome.isDraw) {
    return {
      winner: "draw",
      leftSurvivors: resolutionResult.leftBattleResult.survivors,
      rightSurvivors: resolutionResult.rightBattleResult.survivors,
      leftDamageTaken: 0,
      rightDamageTaken: 0,
    };
  }

  if (outcome.winnerId === leftPlayerId) {
    return {
      winner: "left",
      leftSurvivors: resolutionResult.leftBattleResult.survivors,
      rightSurvivors: resolutionResult.rightBattleResult.survivors,
      leftDamageTaken: 0,
      rightDamageTaken: resolutionResult.rightBattleResult.damageTaken,
    };
  }

  return {
    winner: "right",
    leftSurvivors: resolutionResult.leftBattleResult.survivors,
    rightSurvivors: resolutionResult.rightBattleResult.survivors,
    leftDamageTaken: resolutionResult.leftBattleResult.damageTaken,
    rightDamageTaken: 0,
  };
}
