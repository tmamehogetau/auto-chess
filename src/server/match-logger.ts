/**
 * マッチログ型定義
 * ゲーム全体の結果記録用
 */

import {
  buildRumorKpiSummary,
  type RumorKpiSummary,
} from "./analytics/rumor-kpi";
import {
  buildGameplayKpiSummary,
  type GameplayKpiSummary,
} from "./analytics/gameplay-kpi";

function shouldEmitStructuredMatchLogs(): boolean {
  return process.env.SUPPRESS_VERBOSE_TEST_LOGS !== "true"
    || process.env.ENABLE_STRUCTURED_MATCH_LOGS === "true";
}

/**
 * Prepコマンド入力バリデーションメトリクス
 * W6-2 KPI測定: バリデーション境界でのPrepコマンド試行を追跡
 * 
 * Note: これらのメトリクスは「バリデーション境界での入力試行」を測定するものであり、
 * 実行時のランタイム失敗（例: 実行中の例外）とは区別される。
 */
export interface PrepCommandMetrics {
  /** バリデーション境界を通過した総Prepコマンド入力試行回数 */
  totalPrepCommands: number;
  /** バリデーションで拒否されたPrepコマンド入力回数 */
  failedPrepCommands: number;
  /** エラーコード別のバリデーション拒否カウント */
  failuresByErrorCode: Record<string, number>;
  /** 入力失敗率 (failedPrepCommands / totalPrepCommands) */
  prepInputFailureRate: number;
}

/**
 * Prepコマンドバリデーション拒否記録用パラメータ
 */
export interface PrepValidationFailure {
  /** バリデーション拒否のエラーコード (例: "INSUFFICIENT_GOLD", "DUPLICATE_CMD") */
  errorCode: string;
}

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
    enablePerUnitSharedPool: boolean;
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
  unitLevel?: number;
  cell: number;
}

export interface BenchUnitSnapshot {
  unitType: string;
  unitLevel?: number;
  benchIndex: number;
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
  /** 噂勢力eligibleを付与されたプレイヤーID一覧（ボス以外） */
  grantedPlayerIds?: string[];
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
    | "sell_unit"
    | "board_sell"
    | "deploy"
    | "undeploy"
    | "merge"
    | "hero_select"
    | "prep_income"
    | "raid_phase_success_bonus"
    | "battle_economy_bonus"
    | "shop_refresh"
    | "upgrade_special_unit"
    | "buy_boss_unit"
    | "shop_lock"
    | "prep_income"
    | "raid_phase_success_bonus"
    | "battle_economy_bonus";
  timestamp: number;
  details: {
    unitType?: string;
    unitLevel?: number;
    cost?: number;
    fromCell?: number;
    toCell?: number;
    cell?: number;
    benchIndex?: number;
    benchIndices?: number[];
    boardCells?: number[];
    heroId?: string;
    itemCount?: number;
    inventoryIndex?: number;
    locked?: boolean;
    benchUnit?: string;
    isRumorUnit?: boolean;
    amount?: number;
    goldBefore: number;
    goldAfter: number;
  };
}

// スペル効果ログ
export interface SpellEffectLog {
  matchId: string;
  roundIndex: number;
  timestamp: number;
  declaredSpellId: string;
  spellName: string;
  effectType: 'damage' | 'heal' | 'buff' | 'debuff';
  target: 'boss' | 'raid' | 'all';
  value: number;
  actualEffect: number; // 実際に適用された値
}

// ボスショップログ
export interface BossShopLog {
  matchId: string;
  roundIndex: number;
  playerId: string;
  timestamp: number;
  offers: Array<{
    unitType: string;
    cost: number;
    isRumorUnit?: boolean;
  }>;
  purchased?: {
    slotIndex: number;
    unitType: string;
    cost: number;
  };
}

// シナジー発動ログ
export interface SynergyActivationLog {
  matchId: string;
  roundIndex: number;
  playerId: string;
  timestamp: number;
  synergyType: string; // 例: 'scarletMansion'
  unitCount: number;
  effects: Array<{
    type: string;
    value: number;
  }>;
}

// HP変化ログ
export interface HpChangeLog {
  matchId: string;
  roundIndex: number;
  playerId: string;
  hpBefore: number;
  hpAfter: number;
  hpChange: number; // マイナスは減少
  reason: 'battle' | 'spell' | 'other';
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
  private spellEffectLogs: SpellEffectLog[] = [];
  private bossShopLogs: BossShopLog[] = [];
  private synergyActivationLogs: SynergyActivationLog[] = [];
  private hpChangeLogs: HpChangeLog[] = [];

  // Prepコマンドメトリクス（W6-2 KPI測定）
  private totalPrepCommands: number = 0;
  private failedPrepCommands: number = 0;
  private failuresByErrorCode: Map<string, number> = new Map();

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
      details: {
        ...details,
        ...(details.benchIndices !== undefined && {
          benchIndices: [...details.benchIndices],
        }),
        ...(details.boardCells !== undefined && {
          boardCells: [...details.boardCells],
        }),
      },
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
    grantedPlayerIds?: string[],
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
    if (grantedPlayerIds !== undefined) {
      roundLog.grantedPlayerIds = [...grantedPlayerIds];
    }
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

      if (roundLog.grantedPlayerIds) {
        clonedRoundLog.grantedPlayerIds = [...roundLog.grantedPlayerIds];
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
      // Snapshot: 入力配列の防御的コピー
      stats.finalBoardUnits = boardUnits.map((unit) => ({ ...unit }));
      stats.finalBenchUnits = benchUnits.map((unit) => ({ ...unit }));
    }
  }

  generateSummary(
    winner: string | null,
    ranking: string[],
    totalRounds: number,
    featureFlags: MatchSummaryLog["featureFlags"],
  ): MatchSummaryLog {
    const players: PlayerMatchSummary[] = [];

    for (const [index, playerId] of ranking.entries()) {
      const stats = this.playerStats.get(playerId);
      if (stats) {
        players.push({
          playerId,
          rank: index + 1,
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
          finalBoardUnits: stats.finalBoardUnits.map((unit) => ({ ...unit })),
          finalBenchUnits: stats.finalBenchUnits.map((unit) => ({ ...unit })),
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

    if (shouldEmitStructuredMatchLogs()) {
      console.log(JSON.stringify({
        type: "match_summary",
        data: summary,
      }));
    }
  }

  // スペル効果ログ
  logSpellEffect(
    roundIndex: number,
    declaredSpellId: string,
    spellName: string,
    effectType: SpellEffectLog['effectType'],
    target: SpellEffectLog['target'],
    value: number,
    actualEffect: number,
  ): void {
    this.spellEffectLogs.push({
      matchId: this.matchId,
      roundIndex,
      timestamp: Date.now(),
      declaredSpellId,
      spellName,
      effectType,
      target,
      value,
      actualEffect,
    });
  }

  // ボスショップログ
  logBossShop(
    roundIndex: number,
    playerId: string,
    offers: BossShopLog['offers'],
    purchased?: BossShopLog['purchased'],
  ): void {
    const log: BossShopLog = {
      matchId: this.matchId,
      roundIndex,
      playerId,
      timestamp: Date.now(),
      offers: offers.map((offer) => ({ ...offer })),
    };
    if (purchased !== undefined) {
      log.purchased = { ...purchased };
    }
    this.bossShopLogs.push(log);
  }

  // シナジー発動ログ
  logSynergyActivation(
    roundIndex: number,
    playerId: string,
    synergyType: string,
    unitCount: number,
    effects: SynergyActivationLog['effects'],
  ): void {
    this.synergyActivationLogs.push({
      matchId: this.matchId,
      roundIndex,
      playerId,
      timestamp: Date.now(),
      synergyType,
      unitCount,
      effects: effects.map((effect) => ({ ...effect })),
    });
  }

  // HP変化ログ
  logHpChange(
    roundIndex: number,
    playerId: string,
    hpBefore: number,
    hpAfter: number,
    reason: HpChangeLog['reason'],
  ): void {
    this.hpChangeLogs.push({
      matchId: this.matchId,
      roundIndex,
      playerId,
      hpBefore,
      hpAfter,
      hpChange: hpAfter - hpBefore,
      reason,
    });
  }

  // ゲッターメソッド
  getActionLogs(): PlayerActionLog[] {
    return this.actionLogs.map((log) => ({
      ...log,
      details: {
        ...log.details,
        ...(log.details.benchIndices !== undefined && {
          benchIndices: [...log.details.benchIndices],
        }),
        ...(log.details.boardCells !== undefined && {
          boardCells: [...log.details.boardCells],
        }),
      },
    }));
  }

  getSpellEffectLogs(): SpellEffectLog[] {
    return this.spellEffectLogs.map((log) => ({ ...log }));
  }

  getBossShopLogs(): BossShopLog[] {
    return this.bossShopLogs.map((log) => ({
      ...log,
      offers: log.offers.map((offer) => ({ ...offer })),
      ...(log.purchased !== undefined && {
        purchased: { ...log.purchased },
      }),
    }));
  }

  getSynergyActivationLogs(): SynergyActivationLog[] {
    return this.synergyActivationLogs.map((log) => ({
      ...log,
      effects: log.effects.map((effect) => ({ ...effect })),
    }));
  }

  getHpChangeLogs(): HpChangeLog[] {
    return this.hpChangeLogs.map((log) => ({ ...log }));
  }

  /**
   * 噂勢力 KPI サマリーを取得する
   * ログから派生したメトリクスを計算して返す
   */
  getRumorKpiSummary(): RumorKpiSummary {
    return buildRumorKpiSummary(this.getRoundLogs(), this.getActionLogs());
  }

  /**
   * 噂勢力 KPI サマリーを構造化JSONとして出力する
   * W6手動レビュー用の機械可読レポート
   */
  outputRumorKpiSummary(): void {
    console.log(JSON.stringify({
      type: "rumor_kpi_summary",
      data: this.getRumorKpiSummary(),
    }));
  }

  /**
   * ゲームプレイ KPI サマリーを取得する
   * generateSummary の結果から派生メトリクスを計算して返す
   */
  getGameplayKpiSummary(
    winner: string | null,
    ranking: string[],
    totalRounds: number,
    featureFlags: MatchSummaryLog["featureFlags"],
  ): GameplayKpiSummary {
    const summary = this.generateSummary(winner, ranking, totalRounds, featureFlags);
    const prepMetrics = this.getPrepCommandMetrics();
    return buildGameplayKpiSummary(summary, prepMetrics);
  }

  /**
   * ゲームプレイ KPI サマリーを構造化JSONとして出力する
   * W6-2 KPI測定用の機械可読レポート
   * 既存のmatch_summary出力とは別に、追加の分析データとして出力される
   */
  outputGameplayKpiSummary(
    winner: string | null,
    ranking: string[],
    totalRounds: number,
    featureFlags: MatchSummaryLog["featureFlags"],
  ): void {
    const kpiSummary = this.getGameplayKpiSummary(winner, ranking, totalRounds, featureFlags);

    if (shouldEmitStructuredMatchLogs()) {
      console.log(JSON.stringify({
        type: "gameplay_kpi_summary",
        data: kpiSummary,
      }));
    }
  }

  /**
   * Prepコマンドのバリデーション拒否を記録する
   * W6-2 KPI測定: バリデーション境界で失敗した入力を追跡
   * 
   * 呼び出しタイミング: validatePrepCommand() がエラーを返した直後
   */
  recordPrepValidationFailure(failure: PrepValidationFailure): void {
    this.totalPrepCommands += 1;
    this.failedPrepCommands += 1;

    const currentCount = this.failuresByErrorCode.get(failure.errorCode) ?? 0;
    this.failuresByErrorCode.set(failure.errorCode, currentCount + 1);
  }

  /**
   * Prepコマンドのバリデーション通過を記録する
   * W6-2 KPI測定: バリデーション境界を通過した入力を分母へ加算する
   *
   * 呼び出しタイミング: validatePrepCommand() が成功した直後
   */
  recordPrepValidationPass(): void {
    this.totalPrepCommands += 1;
  }

  /**
   * Prepコマンドの実行成功を記録する
   * 将来の成功メトリクス拡張用フック。現在のW6-2集計では副作用を持たない。
   * 
   * 呼び出しタイミング: executePrepCommand() が成功して返った直後
   */
  recordPrepExecutionSuccess(): void {
    // no-op for now
  }

  /**
   * Prepコマンドメトリクスを取得する
   * @returns PrepCommandMetrics（防御的コピー）
   */
  getPrepCommandMetrics(): PrepCommandMetrics {
    // failuresByErrorCode をプレーンオブジェクトに変換（防御的コピー）
    const failuresByErrorCode: Record<string, number> = {};
    for (const [code, count] of this.failuresByErrorCode.entries()) {
      failuresByErrorCode[code] = count;
    }

    // 失敗率を計算
    const prepInputFailureRate =
      this.totalPrepCommands > 0
        ? this.failedPrepCommands / this.totalPrepCommands
        : 0;

    return {
      totalPrepCommands: this.totalPrepCommands,
      failedPrepCommands: this.failedPrepCommands,
      failuresByErrorCode,
      prepInputFailureRate,
    };
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
