/**
 * マッチログ型定義
 * ゲーム全体の結果記録用
 */

export interface MatchSummaryLog {
  matchId: string;
  roomId: string;
  timestamp: number;
  startTime: number;
  durationMs: number;
  winner: string | null;
  ranking: string[];
  totalRounds: number;
  players: PlayerMatchSummary[];
  featureFlags: {
    enableHeroSystem: boolean;
    enableSharedPool: boolean;
    enableSpellCard: boolean;
    enableRumorInfluence: boolean;
    enableBossExclusiveShop: boolean;
  };
}

export interface PlayerMatchSummary {
  playerId: string;
  rank: number;
  finalHp: number;
  maxHp: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  unitsPurchased: number;
  unitsSold: number;
  roundsSurvived: number;
  battleWins: number;
  battleLosses: number;
  selectedHeroId: string | null;
  finalBoardUnits: BoardUnitSnapshot[];
  finalBenchUnits: BenchUnitSnapshot[];
}

export interface BoardUnitSnapshot {
  unitType: string;
  starLevel: number;
  cell: number;
  items: string[];
}

export interface BenchUnitSnapshot {
  unitType: string;
  starLevel: number;
  benchIndex: number;
  items: string[];
}

export interface RoundSummaryLog {
  matchId: string;
  roundIndex: number;
  timestamp: number;
  phase: "Prep" | "Battle" | "Settle" | "Elimination";
  durationMs: number;
  battles: BattleSummaryLog[];
  eliminations: string[];
  rumorFactions?: string[];
  guaranteedRumorSlotApplied?: boolean;
}

export interface BattleSummaryLog {
  matchId: string;
  roundIndex: number;
  battleIndex: number;
  leftPlayerId: string;
  rightPlayerId: string;
  winner: "left" | "right" | "draw";
  leftDamageDealt: number;
  rightDamageDealt: number;
  leftSurvivors: number;
  rightSurvivors: number;
}

export interface PlayerActionLog {
  matchId: string;
  roomId: string;
  roundIndex: number;
  playerId: string;
  actionType:
    | "buy_unit"
    | "buy_item"
    | "sell_unit"
    | "board_sell"
    | "deploy"
    | "undeploy"
    | "merge"
    | "hero_select"
    | "shop_refresh"
    | "buy_xp"
    | "equip_item"
    | "unequip_item"
    | "sell_item"
    | "buy_boss_unit"
    | "shop_lock";
  timestamp: number;
  details: {
    unitType?: string;
    starLevel?: number;
    cost?: number;
    fromCell?: number;
    toCell?: number;
    cell?: number;
    benchIndex?: number;
    heroId?: string;
    itemCount?: number;
    itemType?: string;
    inventoryIndex?: number;
    itemSlotIndex?: number;
    locked?: boolean;
    benchUnit?: string;
    goldBefore: number;
    goldAfter: number;
  };
}

/**
 * マッチロガー
 * 構造化ログを収集・出力
 */
export class MatchLogger {
  private matchId: string;
  private roomId: string;
  private startTime: number;
  private playerStats: Map<string, PlayerMatchSummaryBuilder> = new Map();
  private roundLogs: RoundSummaryLog[] = [];
  private actionLogs: PlayerActionLog[] = [];

  constructor(matchId: string, roomId: string) {
    this.matchId = matchId;
    this.roomId = roomId;
    this.startTime = Date.now();
  }

  registerPlayer(playerId: string): void {
    this.playerStats.set(playerId, {
      playerId,
      finalHp: 100,
      maxHp: 100,
      totalGoldEarned: 0,
      totalGoldSpent: 0,
      unitsPurchased: 0,
      unitsSold: 0,
      roundsSurvived: 0,
      battleWins: 0,
      battleLosses: 0,
      selectedHeroId: null,
      finalBoardUnits: [],
      finalBenchUnits: [],
    });
  }

  logAction(
    playerId: string,
    roundIndex: number,
    actionType: PlayerActionLog["actionType"],
    details: PlayerActionLog["details"],
  ): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      if (details.goldAfter > details.goldBefore) {
        stats.totalGoldEarned += details.goldAfter - details.goldBefore;
      } else if (details.goldAfter < details.goldBefore) {
        stats.totalGoldSpent += details.goldBefore - details.goldAfter;
      }

      switch (actionType) {
        case "buy_unit":
          stats.unitsPurchased += 1;
          break;
        case "sell_unit":
          stats.unitsSold += 1;
          break;
        case "hero_select":
          if (details.heroId) {
            stats.selectedHeroId = details.heroId;
          }
          break;
      }
    }

    this.actionLogs.push({
      matchId: this.matchId,
      roomId: this.roomId,
      roundIndex,
      playerId,
      actionType,
      timestamp: Date.now(),
      details,
    });
  }

  logBattleResult(
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
    const leftStats = this.playerStats.get(leftPlayerId);
    const rightStats = this.playerStats.get(rightPlayerId);

    if (leftStats) {
      if (winner === "left") {
        leftStats.battleWins += 1;
      } else if (winner === "right") {
        leftStats.battleLosses += 1;
      }
    }

    if (rightStats) {
      if (winner === "right") {
        rightStats.battleWins += 1;
      } else if (winner === "left") {
        rightStats.battleLosses += 1;
      }
    }

    // Store battle result in round logs
    const roundLog = this.roundLogs.find((log) => log.roundIndex === roundIndex);
    if (roundLog) {
      roundLog.battles.push({
        matchId: this.matchId,
        roundIndex,
        battleIndex,
        leftPlayerId,
        rightPlayerId,
        winner,
        leftDamageDealt,
        rightDamageDealt,
        leftSurvivors,
        rightSurvivors,
      });
    } else {
      // Create new round log if it doesn't exist
      const newRoundLog: RoundSummaryLog = {
        matchId: this.matchId,
        roundIndex,
        phase: "Battle",
        timestamp: Date.now(),
        durationMs: 0,
        battles: [
          {
            matchId: this.matchId,
            roundIndex,
            battleIndex,
            leftPlayerId,
            rightPlayerId,
            winner,
            leftDamageDealt,
            rightDamageDealt,
            leftSurvivors,
            rightSurvivors,
          },
        ],
        eliminations: [],
      };
      this.roundLogs.push(newRoundLog);
    }
  }

  logRoundTransition(
    phase: "Prep" | "Battle" | "Settle" | "Elimination",
    roundIndex: number,
    timestamp: number,
  ): void {
    let roundLog = this.roundLogs.find((log) => log.roundIndex === roundIndex);

    if (!roundLog) {
      roundLog = {
        matchId: this.matchId,
        roundIndex,
        phase,
        timestamp,
        durationMs: 0,
        battles: [],
        eliminations: [],
      };
      this.roundLogs.push(roundLog);
    } else {
      roundLog.phase = phase;
      // Calculate duration if this is a transition
      if (timestamp > roundLog.timestamp) {
        roundLog.durationMs = timestamp - roundLog.timestamp;
      }
      roundLog.timestamp = timestamp;
    }
  }

  logRumorInfluence(
    roundIndex: number,
    rumorFactions: string[],
    guaranteedRumorSlotApplied: boolean,
  ): void {
    let roundLog = this.roundLogs.find((log) => log.roundIndex === roundIndex);

    if (!roundLog) {
      roundLog = {
        matchId: this.matchId,
        roundIndex,
        phase: "Battle",
        timestamp: Date.now(),
        durationMs: 0,
        battles: [],
        eliminations: [],
      };
      this.roundLogs.push(roundLog);
    }

    roundLog.rumorFactions = [...rumorFactions];
    roundLog.guaranteedRumorSlotApplied = guaranteedRumorSlotApplied;
  }

  getRoundLogs(): RoundSummaryLog[] {
    return this.roundLogs.map((roundLog) => {
      const clonedRoundLog: RoundSummaryLog = {
        ...roundLog,
        battles: [...roundLog.battles],
        eliminations: [...roundLog.eliminations],
      };

      if (roundLog.rumorFactions) {
        clonedRoundLog.rumorFactions = [...roundLog.rumorFactions];
      }

      return clonedRoundLog;
    });
  }

  updatePlayerHp(playerId: string, hp: number): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      stats.finalHp = hp;
      stats.maxHp = Math.max(stats.maxHp, hp);
    }
  }

  incrementRoundsSurvived(playerId: string): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      stats.roundsSurvived += 1;
    }
  }

  updateFinalUnits(
    playerId: string,
    boardUnits: BoardUnitSnapshot[],
    benchUnits: BenchUnitSnapshot[],
  ): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      stats.finalBoardUnits = boardUnits;
      stats.finalBenchUnits = benchUnits;
    }
  }

  generateSummary(
    winner: string | null,
    ranking: string[],
    totalRounds: number,
    featureFlags: MatchSummaryLog["featureFlags"],
  ): MatchSummaryLog {
    const players: PlayerMatchSummary[] = [];

    for (const playerId of ranking) {
      const stats = this.playerStats.get(playerId);
      if (stats) {
        players.push({
          playerId,
          rank: ranking.indexOf(playerId) + 1,
          finalHp: stats.finalHp,
          maxHp: stats.maxHp,
          totalGoldEarned: stats.totalGoldEarned,
          totalGoldSpent: stats.totalGoldSpent,
          unitsPurchased: stats.unitsPurchased,
          unitsSold: stats.unitsSold,
          roundsSurvived: stats.roundsSurvived,
          battleWins: stats.battleWins,
          battleLosses: stats.battleLosses,
          selectedHeroId: stats.selectedHeroId,
          finalBoardUnits: stats.finalBoardUnits,
          finalBenchUnits: stats.finalBenchUnits,
        });
      }
    }

    return {
      matchId: this.matchId,
      roomId: this.roomId,
      timestamp: Date.now(),
      startTime: this.startTime,
      durationMs: Date.now() - this.startTime,
      winner,
      ranking,
      totalRounds,
      players,
      featureFlags,
    };
  }

  outputSummary(
    winner: string | null,
    ranking: string[],
    totalRounds: number,
    featureFlags: MatchSummaryLog["featureFlags"],
  ): void {
    const summary = this.generateSummary(winner, ranking, totalRounds, featureFlags);

    // 構造化ログとして出力
    console.log(JSON.stringify({
      type: "match_summary",
      data: summary,
    }));
  }
}

interface PlayerMatchSummaryBuilder {
  playerId: string;
  finalHp: number;
  maxHp: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  unitsPurchased: number;
  unitsSold: number;
  roundsSurvived: number;
  battleWins: number;
  battleLosses: number;
  selectedHeroId: string | null;
  finalBoardUnits: BoardUnitSnapshot[];
  finalBenchUnits: BenchUnitSnapshot[];
}
