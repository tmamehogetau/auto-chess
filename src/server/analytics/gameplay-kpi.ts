/**
 * ゲームプレイ KPI サマリー
 * マッチサマリーから派生したメトリクスを構築する純粋関数
 *
 * Architecture:
 * - 責務を小さな純粋関数に分解
 * - 入力は既存のMatchSummaryLogのみ（外部依存なし）
 * - 出力は派生KPIのみ（永続化や集計は行わない）
 */

import type {
  MatchSummaryLog,
  PlayerMatchSummary,
  BoardUnitSnapshot,
  PrepCommandMetrics,
} from "../match-logger";

/**
 * 個別ユニットシグネチャ（アイテムなし）
 */
export interface UnitSignature {
  unitType: string;
  starLevel: number;
}

/**
 * ゲームプレイ KPI サマリー型
 * W6-2 KPI測定用: オフライン集計スクリプトで使用可能なカウントベースのフィールドを含む
 */
export interface GameplayKpiSummary {
  /** 総ラウンド数 */
  totalRounds: number;
  /** プレイヤー数 */
  playerCount: number;
  /** R8到達プレイヤー数（ラウンド8以上生存）- オフライン集計用 */
  playersSurvivedR8: number;
  /** 総プレイヤー数 - オフライン集計用 */
  totalPlayers: number;
  /** マッチ単位のR8完走率（playersSurvivedR8 / totalPlayers） */
  r8CompletionRate: number;
  /** 勝者（トップ1）の構成シグネチャ（集計用文字列形式） */
  top1CompositionSignature: string;
  /** Prepコマンドのバリデーション拒否回数 - オフライン集計用 */
  failedPrepCommands: number;
  /** Prepコマンドの総試行回数 - オフライン集計用 */
  totalPrepCommands: number;
  /** Prepコマンド入力失敗率（failedPrepCommands / totalPrepCommands） */
  prepInputFailureRate: number;
}

/**
 * R8到達率を計算
 * ラウンド8以上生存したかどうかのバイナリ指標
 *
 * @param roundsSurvived - 生存したラウンド数
 * @param _totalRounds - 総ラウンド数（互換性のため保持、未使用）
 * @returns 到達率（1.0 = ラウンド8以上生存、0.0 = それ以外）
 */
export function calculateR8CompletionRate(
  roundsSurvived: number,
  _totalRounds: number,
): number {
  // R8到達：ラウンド8以上生存したか（W6-2定義）
  return roundsSurvived >= 8 ? 1.0 : 0.0;
}

/**
 * ボードユニットからシグネチャを構築
 * アイテム情報は除外、cell昇順で決定論的にソート
 *
 * @param units - ボードユニットスナップショット配列
 * @returns ユニットシグネチャ配列（cell昇順）
 */
function buildUnitSignatures(units: BoardUnitSnapshot[]): UnitSignature[] {
  // cell昇順でソートして決定論的な順序を保証
  const sortedUnits = [...units].sort((a, b) => a.cell - b.cell);
  return sortedUnits.map((unit) => ({
    unitType: unit.unitType,
    starLevel: unit.starLevel,
  }));
}

/**
 * トップ1（勝者）の構成シグネチャを構築
 * winnerフィールドから勝者を特定
 *
 * @param summary - マッチサマリーログ
 * @returns 勝者のユニットシグネチャ配列（勝者がいない場合は空配列）
 */
export function buildTop1CompositionSignature(
  summary: MatchSummaryLog,
): UnitSignature[] {
  // winnerがいない場合は空配列
  if (!summary.winner) {
    return [];
  }

  // winnerのプレイヤーデータを取得
  const winnerPlayer = summary.players.find(
    (player) => player.playerId === summary.winner,
  );

  if (!winnerPlayer) {
    return [];
  }

  // ボードユニットからシグネチャを構築
  return buildUnitSignatures(winnerPlayer.finalBoardUnits);
}

/**
 * 全プレイヤーのR8完了率を計算
 *
 * @param summary - マッチサマリーログ
 * @returns プレイヤーID → 完了率のマップ
 */
function calculateAllR8CompletionRates(
  summary: MatchSummaryLog,
): Record<string, number> {
  const rates: Record<string, number> = {};

  for (const player of summary.players) {
    rates[player.playerId] = calculateR8CompletionRate(
      player.roundsSurvived,
      summary.totalRounds,
    );
  }

  return rates;
}

/**
 * 構成シグネチャを集計用文字列にフォーマット
 * 例: [{unitType: "vanguard", starLevel: 2}, {unitType: "ranger", starLevel: 1}] → "vanguard:2,ranger:1"
 *
 * @param signature - ユニットシグネチャ配列
 * @returns フォーマットされた文字列（空配列の場合は空文字列）
 */
export function formatCompositionSignature(signature: UnitSignature[]): string {
  if (signature.length === 0) {
    return "";
  }
  return signature.map((unit) => `${unit.unitType}:${unit.starLevel}`).join(",");
}

/**
 * マッチサマリーからゲームプレイ KPI サマリーを構築する
 * W6-2 KPI測定用: オフライン集計に必要なカウントフィールドを含む
 *
 * @param summary - マッチサマリーログ
 * @param prepCommandMetrics - オプションのPrepコマンドメトリクス
 * @returns ゲームプレイ KPI サマリー
 */
export function buildGameplayKpiSummary(
  summary: MatchSummaryLog,
  prepCommandMetrics?: PrepCommandMetrics,
): GameplayKpiSummary {
  // R8到達カウントを計算
  const playerR8Rates = calculateAllR8CompletionRates(summary);
  const playersSurvivedR8 = Object.values(playerR8Rates).filter((rate) => rate === 1.0).length;
  const totalPlayers = summary.players.length;

  // マッチ単位のR8完走率
  const r8CompletionRate = totalPlayers > 0 ? playersSurvivedR8 / totalPlayers : 0;

  // トップ1構成シグネチャを構築して文字列形式に変換
  const top1SignatureArray = buildTop1CompositionSignature(summary);
  const top1CompositionSignature = formatCompositionSignature(top1SignatureArray);

  // Prepコマンドメトリクス
  const failedPrepCommands = prepCommandMetrics?.failedPrepCommands ?? 0;
  const totalPrepCommands = prepCommandMetrics?.totalPrepCommands ?? 0;
  const prepInputFailureRate = prepCommandMetrics?.prepInputFailureRate ?? 0;

  return {
    totalRounds: summary.totalRounds,
    playerCount: totalPlayers,
    playersSurvivedR8,
    totalPlayers,
    r8CompletionRate,
    top1CompositionSignature,
    failedPrepCommands,
    totalPrepCommands,
    prepInputFailureRate,
  };
}
