import type {
  BotOnlyBaselineAggregateReport,
  BotOnlyBaselineUnitDamageEfficiencyMetric,
} from "./bot-balance-baseline-aggregate";
import { buildBotBalanceBaselineAnalysis } from "./bot-balance-baseline-analysis";
import type {
  BotBalanceBaselineHelperConfig,
  BotBalanceBaselineHelperPolicy,
  BotBalanceBaselineOptimizationVariant,
} from "./bot-balance-baseline-runner";

export type BotBalanceBaselineFailureSummary = {
  chunkIndex: number;
  globalMatchIndex: number;
  localMatchIndex: number;
  message: string;
};

export type BotBalanceBaselineChunkSummary = {
  chunkIndex: number;
  matchStartIndex: number;
  requestedMatchCount: number;
  workerIndex: number;
  portOffset: number;
  completedMatches: number;
  abortedMatches: number;
  logPath: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type BotBalanceBaselineSummary = {
  requestedMatchCount: number;
  chunkSize: number;
  parallelism: number;
  portOffsetBase: number;
  bossPolicy: BotBalanceBaselineHelperPolicy;
  raidPolicies: BotBalanceBaselineHelperPolicy[];
  optimizationVariant: BotBalanceBaselineOptimizationVariant;
  helperConfigs: BotBalanceBaselineHelperConfig[];
  chunkCount: number;
  outputDir: string;
  aggregate: BotOnlyBaselineAggregateReport;
  failures: BotBalanceBaselineFailureSummary[];
  chunks: BotBalanceBaselineChunkSummary[];
};

function localizeBattleEndReason(reason: string): string {
  switch (reason) {
    case "annihilation":
      return "片側全滅決着";
    case "mutual_annihilation":
      return "相打ち全滅";
    case "timeout_hp_lead":
      return "時間切れHP判定決着";
    case "timeout_hp_tie":
      return "時間切れHP同値引き分け";
    case "phase_hp_depleted":
      return "フェーズHP削り切り";
    case "boss_defeated":
      return "ボス撃破";
    case "forced":
      return "強制決着";
    default:
      return "想定外終了";
  }
}

function localizeRangeBand(rangeBand: string): string {
  switch (rangeBand) {
    case "range_1":
      return "射程1";
    default:
      return "射程2以上";
  }
}

function localizeRaidMeleeCohort(cohort: string): string {
  switch (cohort) {
    case "special":
      return "特殊ユニット";
    default:
      return "通常ユニット";
  }
}

function buildShopOfferGroupDiagnostics(
  offerMetrics: NonNullable<BotOnlyBaselineAggregateReport["shopOfferMetrics"]>,
): Array<{
  role: string;
  source: string;
  cost: number;
  unitCount: number;
  averageOffers: number;
  minOffers: number;
  maxOffers: number;
  maxMinRatio: number;
}> {
  const groups = new Map<string, NonNullable<BotOnlyBaselineAggregateReport["shopOfferMetrics"]>>();
  for (const offer of offerMetrics) {
    const key = `${offer.role}::${offer.source}::${offer.cost}`;
    const group = groups.get(key) ?? [];
    group.push(offer);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const first = group[0]!;
      const offerCounts = group.map((offer) => offer.observationCount);
      const minOffers = Math.min(...offerCounts);
      const maxOffers = Math.max(...offerCounts);
      const totalOffers = offerCounts.reduce((sum, count) => sum + count, 0);
      return {
        role: first.role,
        source: first.source,
        cost: first.cost,
        unitCount: group.length,
        averageOffers: totalOffers / group.length,
        minOffers,
        maxOffers,
        maxMinRatio: minOffers > 0 ? maxOffers / minOffers : 0,
      };
    })
    .sort((left, right) =>
      left.role.localeCompare(right.role)
      || left.source.localeCompare(right.source)
      || left.cost - right.cost);
}

function resolveUnitDamageEfficiencyMetrics(
  aggregate: BotOnlyBaselineAggregateReport,
): BotOnlyBaselineUnitDamageEfficiencyMetric[] {
  if (aggregate.unitDamageEfficiencyMetrics) {
    return aggregate.unitDamageEfficiencyMetrics;
  }

  const byUnit = new Map<string, {
    side: "boss" | "raid";
    unitId: string;
    unitType: string;
    unitName: string;
    roundsObserved: number;
    battleAppearances: number;
    matchesPresent: number;
    totalUnitLevel: number;
    totalDamage: number;
    totalInvestmentCost: number;
  }>();

  for (const entry of aggregate.roundDamageEfficiencyMetrics ?? []) {
    const key = `${entry.side}::${entry.unitId}`;
    const existing = byUnit.get(key) ?? {
      side: entry.side,
      unitId: entry.unitId,
      unitType: entry.unitType,
      unitName: entry.unitName,
      roundsObserved: 0,
      battleAppearances: 0,
      matchesPresent: 0,
      totalUnitLevel: 0,
      totalDamage: 0,
      totalInvestmentCost: 0,
    };
    existing.roundsObserved += 1;
    existing.battleAppearances += entry.battleAppearances;
    existing.matchesPresent += entry.matchesPresent;
    existing.totalUnitLevel += entry.averageUnitLevel * entry.battleAppearances;
    existing.totalDamage += entry.totalDamage;
    existing.totalInvestmentCost += entry.totalInvestmentCost;
    byUnit.set(key, existing);
  }

  return Array.from(byUnit.values())
    .map((entry) => ({
      side: entry.side,
      unitId: entry.unitId,
      unitType: entry.unitType,
      unitName: entry.unitName,
      roundsObserved: entry.roundsObserved,
      battleAppearances: entry.battleAppearances,
      matchesPresent: entry.matchesPresent,
      averageUnitLevel: entry.battleAppearances > 0 ? entry.totalUnitLevel / entry.battleAppearances : 0,
      totalDamage: entry.totalDamage,
      totalInvestmentCost: entry.totalInvestmentCost,
      weightedDamagePerInvestmentCost: entry.totalInvestmentCost > 0
        ? entry.totalDamage / entry.totalInvestmentCost
        : null,
      sampleQuality: entry.battleAppearances >= 10 ? "usable" as const : "low" as const,
    }))
    .sort((left, right) =>
      left.side.localeCompare(right.side)
      || ((right.weightedDamagePerInvestmentCost ?? -1) - (left.weightedDamagePerInvestmentCost ?? -1))
      || right.totalDamage - left.totalDamage
      || left.unitId.localeCompare(right.unitId));
}

export function buildBotBalanceBaselineJapaneseJson(
  summary: BotBalanceBaselineSummary,
): Record<string, unknown> {
  const { aggregate } = summary;
  const unitDamageEfficiencyMetrics = resolveUnitDamageEfficiencyMetrics(aggregate);
  const highCostSummary = aggregate.highCostSummary ?? {
    offerObservationCount: 0,
    offerMatchCount: 0,
    purchaseCount: 0,
    purchaseMatchCount: 0,
    finalBoardCopies: 0,
    finalBoardMatchCount: 0,
    finalBoardAdoptionRate: 0,
  };
  const highCostOfferMetrics = aggregate.highCostOfferMetrics ?? [];
  const battleTimelineTimeScale = resolveBattleTimelineTimeScale(aggregate);

  return {
    "実行条件": {
      "要求対戦数": summary.requestedMatchCount,
      "チャンクサイズ": summary.chunkSize,
      "並列数": summary.parallelism,
      "ポートオフセット基準値": summary.portOffsetBase,
      "ボス購入方針": summary.bossPolicy,
      "レイド購入方針": summary.raidPolicies,
      "最適化variant": summary.optimizationVariant,
      "helper設定": summary.helperConfigs.map((helperConfig, helperIndex) => ({
        "bot": `bot${helperIndex + 1}`,
        "ボス希望": helperConfig.wantsBoss,
        "購入方針": helperConfig.policy,
        "固定主人公": helperConfig.heroId ?? null,
        "最適化variant": helperConfig.optimizationVariant ?? summary.optimizationVariant,
      })),
      "チャンク数": summary.chunkCount,
      "出力先": summary.outputDir,
      "レポートメタデータ": aggregate.metadata == null
        ? null
        : {
          "モード": aggregate.metadata.mode,
          "戦闘速度倍率": aggregate.metadata.timeScale,
          "タイミング設定": {
            "自動開始待機(ms)": aggregate.metadata.timings.readyAutoStartMs,
            "準備フェーズ時間(ms)": aggregate.metadata.timings.prepDurationMs,
            "戦闘フェーズ時間(ms)": aggregate.metadata.timings.battleDurationMs,
            "決着待機時間(ms)": aggregate.metadata.timings.settleDurationMs,
            "敗退演出時間(ms)": aggregate.metadata.timings.eliminationDurationMs,
            "選択制限時間(ms)": aggregate.metadata.timings.selectionTimeoutMs,
          },
        },
    },
    "全体結果": {
      "要求対戦数": aggregate.requestedMatchCount,
      "完走数": aggregate.completedMatches,
      "中断数": aggregate.abortedMatches,
      "ボス勝利数": aggregate.bossWins,
      "レイド勝利数": aggregate.raidWins,
      "ボス勝率": aggregate.bossWinRate,
      "レイド勝率": aggregate.raidWinRate,
      "平均ラウンド数": aggregate.averageRounds,
      "最短ラウンド": aggregate.minRounds,
      "最長ラウンド": aggregate.maxRounds,
      "平均生存レイド人数": aggregate.averageRemainingRaidPlayers,
    },
    "戦闘終了指標": {
      "戦闘数": aggregate.battleMetrics.totalBattles,
      "平均ボス側生存数": aggregate.battleMetrics.averageBossSurvivorsAtBattleEnd,
      "平均レイド側生存数": aggregate.battleMetrics.averageRaidSurvivorsAtBattleEnd,
      "両軍生存終了率": aggregate.battleMetrics.bothSidesSurvivedRate,
      "ボス側全滅率": aggregate.battleMetrics.bossWipedRate,
      "レイド側全滅率": aggregate.battleMetrics.raidWipedRate,
      "終了理由内訳": Object.entries(aggregate.battleMetrics.endReasonCounts).map(([reason, count]) => ({
        "終了理由": localizeBattleEndReason(reason),
        "内部値": reason,
        "件数": count,
        "割合": aggregate.battleMetrics.totalBattles > 0 ? count / aggregate.battleMetrics.totalBattles : 0,
      })),
    },
    "ラウンド別生存診断": (aggregate.roundSurvivalDiagnostics ?? []).map((metric) => ({
      "ラウンド": metric.roundIndex,
      "戦闘サンプル": metric.battleSamples,
      "平均終了秒(通常換算)": toRealPlaySeconds(metric.averageBattleEndMs, battleTimelineTimeScale),
      "フェーズ成功率": metric.phaseSuccessRate,
      "フェーズ成功かつボス全滅率": metric.phaseSuccessWithBossWipeRate,
      "フェーズ失敗かつレイド全滅率": metric.phaseFailureWithRaidWipeRate,
      "ボス側全滅率": metric.bossWipedRate,
      "レイド側全滅率": metric.raidWipedRate,
      "両軍生存率": metric.bothSidesSurvivedRate,
      "ボス側平均開始数": metric.averageBossStartUnitCount,
      "ボス側平均生存数": metric.averageBossSurvivors,
      "ボス側ユニット生存率": metric.bossUnitSurvivalRate,
      "ボス側平均残HP": metric.averageBossFinalHp,
      "ボス側推定最大HP": metric.averageBossEstimatedMaxHp,
      "ボス側残HP率": metric.bossRemainingHpRate,
      "レイド側平均開始数": metric.averageRaidStartUnitCount,
      "レイド側平均生存数": metric.averageRaidSurvivors,
      "レイド側ユニット生存率": metric.raidUnitSurvivalRate,
      "レイド側平均残HP": metric.averageRaidFinalHp,
      "レイド側推定最大HP": metric.averageRaidEstimatedMaxHp,
      "レイド側残HP率": metric.raidRemainingHpRate,
    })),
    "ラウンド別主要ユニット生存診断": (aggregate.roundUnitSurvivalDiagnostics ?? []).map((metric) => ({
      "ラウンド": metric.roundIndex,
      "陣営": metric.side,
      "ユニット名": metric.unitName,
      "ユニットID": metric.unitId,
      "ユニットタイプ": metric.unitType,
      "戦闘登場回数": metric.battleAppearances,
      "登場試合数": metric.matchesPresent,
      "平均Lv": metric.averageUnitLevel,
      "生存率": metric.survivalRate,
      "平均残HP": metric.averageFinalHp,
      "推定最大HP": metric.averageEstimatedMaxHp,
      "残HP率": metric.remainingHpRate,
      "平均被ダメージ": metric.averageDamageTaken,
      "平均生存ms": metric.averageLifetimeMs,
      "平均与ダメージ": metric.averageDamagePerBattle,
      "0ダメージ戦闘率": metric.zeroDamageBattleRate,
    })),
    "ラウンド分布": Object.entries(aggregate.roundHistogram).map(([round, count]) => ({
      "ラウンド": Number(round),
      "件数": count,
    })),
    "各ラウンド詳細": (aggregate.roundDetails ?? []).map((round) => ({
      "試合番号": round.matchIndex,
      "ラウンド": round.roundIndex,
      "終了時間(実プレイ秒)": toRealPlaySeconds(round.battleEndTimeMs, battleTimelineTimeScale),
      "最終勝利陣営": round.matchWinnerRole,
      "フェーズHP目標": round.phaseHpTarget,
      "フェーズHPダメージ": round.phaseDamageDealt,
      "フェーズHP達成率": round.phaseCompletionRate,
      "推定フェーズHP火力指数": round.phaseHpPowerIndex ?? null,
      "レミリア本体集中": round.bossBodyFocus
        ? {
          "配置": formatBossBodyFocusCell(round.bossBodyFocus),
          "被ダメージ": round.bossBodyFocus.damageTaken,
          "直接フェーズ貢献": round.bossBodyFocus.directPhaseDamage,
          "初被弾(ms)": round.bossBodyFocus.firstDamageAtMs,
          "撃破": round.bossBodyFocus.defeated,
          "最終HP": round.bossBodyFocus.finalHp,
        }
        : null,
      "ラウンド結果": round.phaseResult,
      "レイド全員撃破": round.allRaidPlayersWipedOut,
      "撃破されたレイド人数": round.raidPlayersWipedOut,
      "このラウンド後の脱落レイド人数": round.raidPlayersEliminatedAfterRound,
      "ボス側生存数": round.bossSurvivors,
      "レイド側生存数": round.raidSurvivors,
      "ボス側総ダメージ": round.bossTotalDamage,
      "レイド側総ダメージ": round.raidTotalDamage,
      "レイド側フェーズ貢献ダメージ": round.raidPhaseContributionDamage,
      "戦闘終了理由": round.battleEndReasons.map((reason) => localizeBattleEndReason(reason)),
      "戦闘勝利陣営": round.battleWinnerRoles,
      "レイド別結果": round.raidPlayerConsequences.map((player) => ({
        "プレイヤー": player.label,
        "戦闘開始ユニット数": player.battleStartUnitCount,
        "撃破": player.playerWipedOut,
        "残機Before": player.remainingLivesBefore,
        "残機After": player.remainingLivesAfter,
        "脱落": player.eliminatedAfter,
      })),
      "上位ボスユニット": round.topBossUnits.map((unit) => ({
        "ユニット名": unit.unitName,
        "Lv": unit.unitLevel,
        "与ダメージ": unit.totalDamage,
        "最終HP": unit.finalHp,
        "生存": unit.alive,
      })),
      "上位レイドユニット": round.topRaidUnits.map((unit) => ({
        "ユニット名": unit.unitName,
        "Lv": unit.unitLevel,
        "与ダメージ": unit.totalDamage,
        "フェーズ貢献ダメージ": unit.phaseContributionDamage,
        "最終HP": unit.finalHp,
        "生存": unit.alive,
      })),
    })),
    "プレイヤー別成績": Object.fromEntries(
      Object.entries(aggregate.playerMetrics).map(([label, metrics]) => [label, {
        "平均順位": metrics.averagePlacement,
        "1位率": metrics.firstPlaceRate,
        "平均残HP": metrics.averageRemainingHp,
        "平均残機": metrics.averageRemainingLives,
        "平均最終所持Gold": metrics.averageFinalGold,
        "ログ上のGold増加": metrics.averageGoldEarned,
        "ログ上のGold消費": metrics.averageGoldSpent,
        "平均購入回数": metrics.averagePurchaseCount,
        "平均リロール回数": metrics.averageRefreshCount,
        "平均売却回数": metrics.averageSellCount,
        "平均主人公強化回数": metrics.averageSpecialUnitUpgradeCount ?? 0,
      }]),
    ),
    "主人公チーム勝率": (aggregate.heroTeamMetrics ?? []).map((metric) => ({
      "主人公": metric.heroName,
      "主人公ID": metric.heroId,
      "登場試合数": metric.matchesPresent,
      "レイド勝利数": metric.raidTeamWins,
      "レイドチーム勝率": metric.raidTeamWinRate,
      "個人1位率": metric.firstPlaceRate,
      "平均順位": metric.averagePlacement,
      "平均残機": metric.averageRemainingLives,
      "平均最終所持Gold": metric.averageFinalGold,
      "ログ上のGold増加": metric.averageGoldEarned,
      "ログ上のGold消費": metric.averageGoldSpent,
      "平均主人公強化回数": metric.averageSpecialUnitUpgradeCount,
    })),
    "主人公構成別勝率": (aggregate.heroCompositionMetrics ?? []).map((metric) => ({
      "構成": metric.heroNames.join(" / "),
      "構成ID": metric.compositionKey,
      "主人公ID": metric.heroIds,
      "登場試合数": metric.matchesPresent,
      "レイド勝利数": metric.raidWins,
      "レイド勝率": metric.raidWinRate,
      "平均ラウンド数": metric.averageRounds,
    })),
    "経済": Object.fromEntries(
      Object.entries(aggregate.playerEconomyBreakdowns ?? {}).map(([label, metrics]) => [label, {
        "固定Prep収入": metrics.fixedPrepIncome,
        "レイド成功ボーナス": metrics.raidPhaseSuccessBonusIncome,
        "売却収入": metrics.sellIncome,
        "特殊経済収入": metrics.specialEconomyIncome,
        "通常ショップ支出": metrics.normalShopSpend,
        "ボスショップ支出": metrics.bossShopSpend,
        "リロール支出": metrics.refreshSpend,
        "主人公/ボス強化支出": metrics.specialUnitUpgradeSpend,
        "その他支出": metrics.otherSpend,
        "ログ上のGold増加": metrics.loggedGoldGain,
        "ログ上のGold消費": metrics.loggedGoldSpent,
        "最終未使用Gold": metrics.finalUnusedGold,
      }]),
    ),
    "ラウンド別ダメージ効率": (aggregate.roundDamageEfficiencyMetrics ?? []).map((unit) => ({
      "ラウンド": unit.roundIndex,
      "陣営": unit.side,
      "ユニットID": unit.unitId,
      "ユニット種別": unit.unitType,
      "ユニット名": unit.unitName,
      "戦闘登場回数": unit.battleAppearances,
      "登場試合数": unit.matchesPresent,
      "平均ユニットレベル": unit.averageUnitLevel,
      "合計ダメージ": unit.totalDamage,
      "推定投入コスト": unit.totalInvestmentCost,
      "戦闘ごとの平均投入コスト": unit.averageInvestmentCostPerBattle,
      "ダメージ効率": unit.damagePerInvestmentCost,
    })),
    "ユニット別加重ダメージ効率": unitDamageEfficiencyMetrics.map((unit) => ({
      "陣営": unit.side,
      "ユニットID": unit.unitId,
      "ユニット種別": unit.unitType,
      "ユニット名": unit.unitName,
      "観測ラウンド数": unit.roundsObserved,
      "戦闘登場回数": unit.battleAppearances,
      "登場試合数": unit.matchesPresent,
      "平均ユニットレベル": unit.averageUnitLevel,
      "合計ダメージ": unit.totalDamage,
      "推定投入コスト": unit.totalInvestmentCost,
      "加重ダメージ効率": unit.weightedDamagePerInvestmentCost,
      "サンプル品質": unit.sampleQuality,
    })),
    "ボス側戦闘ユニット指標": aggregate.bossBattleUnitMetrics.map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット種別": unit.unitType,
      "ユニット名": unit.unitName,
      "戦闘登場回数": unit.battleAppearances,
      "登場試合数": unit.matchesPresent,
      "平均ユニットレベル": unit.averageunitLevel,
      "最大到達レベル": unit.maxUnitLevel ?? 0,
      "Lv4到達率": unit.level4ReachRate ?? 0,
      "Lv7到達率": unit.level7ReachRate ?? 0,
      "戦闘ごとの平均基本スキル発動回数": unit.averageBasicSkillActivationsPerBattle ?? 0,
      "戦闘ごとの平均ペアスキル発動回数": unit.averagePairSkillActivationsPerBattle ?? 0,
      "戦闘ごとの平均ダメージ": unit.averageDamagePerBattle,
      "試合ごとの平均ダメージ": unit.averageDamagePerMatch,
      "生存率": unit.survivalRate,
      "担当側戦闘勝率": unit.ownerWinRate,
      "採用率": unit.adoptionRate,
    })),
    "レイド側戦闘ユニット指標": aggregate.raidBattleUnitMetrics.map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット種別": unit.unitType,
      "ユニット名": unit.unitName,
      "戦闘登場回数": unit.battleAppearances,
      "登場試合数": unit.matchesPresent,
      "平均ユニットレベル": unit.averageunitLevel,
      "最大到達レベル": unit.maxUnitLevel ?? 0,
      "Lv4到達率": unit.level4ReachRate ?? 0,
      "Lv7到達率": unit.level7ReachRate ?? 0,
      "戦闘ごとの平均基本スキル発動回数": unit.averageBasicSkillActivationsPerBattle ?? 0,
      "戦闘ごとの平均ペアスキル発動回数": unit.averagePairSkillActivationsPerBattle ?? 0,
      "戦闘ごとの平均ダメージ": unit.averageDamagePerBattle,
      "試合ごとの平均ダメージ": unit.averageDamagePerMatch,
      "生存率": unit.survivalRate,
      "担当側戦闘勝率": unit.ownerWinRate,
      "採用率": unit.adoptionRate,
      "サブ採用回数": unit.subUnitBattleAppearances ?? 0,
      "サブ採用試合数": unit.subUnitMatchesPresent ?? 0,
      "サブ採用率": unit.subUnitAdoptionRate ?? 0,
      "サブ搭載回数": unit.hostedSubUnitBattleAppearances ?? 0,
      "サブ搭載試合数": unit.hostedSubUnitMatchesPresent ?? 0,
      "サブ搭載率": unit.hostedSubUnitAdoptionRate ?? 0,
    })),
    "隠岐奈sub host内訳": (aggregate.okinaSubHostMetrics ?? []).map((entry) => ({
      "HostユニットID": entry.hostUnitId,
      "Hostユニット種別": entry.hostUnitType,
      "Hostユニット名": entry.hostUnitName,
      "戦闘登場回数": entry.battleAppearances,
      "登場試合数": entry.matchesPresent,
      "平均Lv": entry.averageHostLevel,
      "戦闘ごとの平均ダメージ": entry.averageDamagePerBattle,
      "戦闘ごとの平均被ダメージ": entry.averageDamageTakenPerBattle,
      "平均生存時間(ms)": entry.averageLifetimeMs,
      "生存率": entry.survivalRate,
      "担当側戦闘勝率": entry.ownerWinRate,
    })),
    "ラウンド別隠岐奈sub host内訳": (aggregate.okinaSubHostRoundMetrics ?? []).map((entry) => ({
      "R": entry.roundIndex,
      "HostユニットID": entry.hostUnitId,
      "Hostユニット種別": entry.hostUnitType,
      "Hostユニット名": entry.hostUnitName,
      "戦闘登場回数": entry.battleAppearances,
      "登場試合数": entry.matchesPresent,
      "平均Lv": entry.averageHostLevel,
      "戦闘ごとの平均ダメージ": entry.averageDamagePerBattle,
      "戦闘ごとの平均被ダメージ": entry.averageDamageTakenPerBattle,
      "平均生存時間(ms)": entry.averageLifetimeMs,
      "生存率": entry.survivalRate,
      "担当側戦闘勝率": entry.ownerWinRate,
    })),
    "ラウンド別隠岐奈sub判断診断": (aggregate.okinaHeroSubDecisionRoundMetrics ?? []).map((entry) => ({
      "R": entry.roundIndex,
      "診断回数": entry.samples,
      "裏推奨回数": entry.actionRecommendedSamples,
      "候補なし回数": entry.noCandidateSamples,
      "表優先回数": entry.frontValuePreferredSamples,
      "現host維持回数": entry.currentHostKeptSamples,
      "平均候補数": entry.averageCandidateCount,
      "平均表相当値": entry.averageFrontEquivalentValue,
      "平均best host gain": entry.averageBestHostGain,
      "平均host currentPower": entry.averageBestHostCurrentPowerScore,
      "平均host futureValue": entry.averageBestHostFutureValueScore,
      "平均host transitionReadiness": entry.averageBestHostTransitionReadinessScore,
      "平均host protection": entry.averageBestHostProtectionScore,
      "平均best/表": entry.averageBestToFrontRatio,
      "最多best host ID": entry.mostFrequentBestHostUnitId,
      "最多best host名": entry.mostFrequentBestHostUnitName,
      "最多best host回数": entry.mostFrequentBestHostSamples,
    })),
    "ラウンド別盤面再編成診断": (aggregate.boardRefitDecisionRoundMetrics ?? []).map((entry) => ({
      "R": entry.roundIndex,
      "診断回数": entry.samples,
      "盤面満杯": entry.boardFullSamples,
      "試行候補": entry.attemptSamples,
      "置換推奨": entry.recommendedReplacementSamples,
      "置換実行": entry.committedSamples,
      "将来候補保持": entry.futureCandidateKeptCount,
      "平均bench圧": entry.averageBenchPressure,
      "平均置換score": entry.averageReplacementScore,
      "P25置換score": entry.p25ReplacementScore,
      "P50置換score": entry.p50ReplacementScore,
      "P75置換score": entry.p75ReplacementScore,
      "最多incoming": entry.mostFrequentIncomingUnitId === null
        ? null
        : `${entry.mostFrequentIncomingUnitName ?? entry.mostFrequentIncomingUnitId} (${entry.mostFrequentIncomingUnitId}) x${entry.mostFrequentIncomingSamples}`,
      "最多incoming理由": entry.mostFrequentIncomingReason == null
        ? null
        : `${entry.mostFrequentIncomingReason} x${entry.mostFrequentIncomingReasonSamples ?? 0}`,
      "最多outgoing": entry.mostFrequentOutgoingUnitId === null
        ? null
        : `${entry.mostFrequentOutgoingUnitName ?? entry.mostFrequentOutgoingUnitId} (${entry.mostFrequentOutgoingUnitId}) x${entry.mostFrequentOutgoingSamples}`,
      "最多outgoing理由": entry.mostFrequentOutgoingReason == null
        ? null
        : `${entry.mostFrequentOutgoingReason} x${entry.mostFrequentOutgoingReasonSamples ?? 0}`,
    })),
    "ラウンド別ボス直衛判断診断": (aggregate.bossBodyGuardDecisionRoundMetrics ?? []).map((entry) => ({
      "R": entry.roundIndex,
      "診断回数": entry.samples,
      "直衛空き埋め": entry.directFillSamples,
      "直衛交換": entry.directSwapSamples,
      "側面護衛": entry.sideFlankMoveSamples,
      "見送り": entry.noActionSamples,
      "直衛空き": entry.directEmptySamples,
      "bench前衛待ち": entry.benchFrontlineBlockedSamples,
      "直衛外に強前衛": entry.strongerOffDirectSamples,
      "平均直衛Lv": entry.averageDirectGuardLevel,
      "平均最強前衛Lv": entry.averageStrongestGuardLevel,
      "最多直衛": entry.mostFrequentDirectGuardUnitId === null
        ? null
        : `${entry.mostFrequentDirectGuardUnitName ?? entry.mostFrequentDirectGuardUnitId} (${entry.mostFrequentDirectGuardUnitId}) x${entry.mostFrequentDirectGuardSamples}`,
      "最多最強前衛": entry.mostFrequentStrongestGuardUnitId === null
        ? null
        : `${entry.mostFrequentStrongestGuardUnitName ?? entry.mostFrequentStrongestGuardUnitId} (${entry.mostFrequentStrongestGuardUnitId}) x${entry.mostFrequentStrongestGuardSamples}`,
      "最多理由": entry.mostFrequentReason == null
        ? null
        : `${entry.mostFrequentReason} x${entry.mostFrequentReasonSamples}`,
    })),
    "ロール別盤面再編成診断": (aggregate.boardRefitDecisionRoleMetrics ?? []).map((entry) => ({
      "ロール": entry.role,
      "診断回数": entry.samples,
      "盤面満杯": entry.boardFullSamples,
      "試行候補": entry.attemptSamples,
      "置換推奨": entry.recommendedReplacementSamples,
      "置換実行": entry.committedSamples,
      "将来候補保持": entry.futureCandidateKeptCount,
      "平均bench圧": entry.averageBenchPressure,
      "平均置換score": entry.averageReplacementScore,
      "P25置換score": entry.p25ReplacementScore,
      "P50置換score": entry.p50ReplacementScore,
      "P75置換score": entry.p75ReplacementScore,
      "最多incoming": entry.mostFrequentIncomingUnitId === null
        ? null
        : `${entry.mostFrequentIncomingUnitName ?? entry.mostFrequentIncomingUnitId} (${entry.mostFrequentIncomingUnitId}) x${entry.mostFrequentIncomingSamples}`,
      "最多incoming理由": entry.mostFrequentIncomingReason == null
        ? null
        : `${entry.mostFrequentIncomingReason} x${entry.mostFrequentIncomingReasonSamples ?? 0}`,
      "最多outgoing": entry.mostFrequentOutgoingUnitId === null
        ? null
        : `${entry.mostFrequentOutgoingUnitName ?? entry.mostFrequentOutgoingUnitId} (${entry.mostFrequentOutgoingUnitId}) x${entry.mostFrequentOutgoingSamples}`,
      "最多outgoing理由": entry.mostFrequentOutgoingReason == null
        ? null
        : `${entry.mostFrequentOutgoingReason} x${entry.mostFrequentOutgoingReasonSamples ?? 0}`,
    })),
    "ロール・ラウンド別盤面再編成診断": (aggregate.boardRefitDecisionRoleRoundMetrics ?? []).map((entry) => ({
      "ロール": entry.role,
      "R": entry.roundIndex,
      "診断回数": entry.samples,
      "盤面満杯": entry.boardFullSamples,
      "試行候補": entry.attemptSamples,
      "置換推奨": entry.recommendedReplacementSamples,
      "置換実行": entry.committedSamples,
      "将来候補保持": entry.futureCandidateKeptCount,
      "平均bench圧": entry.averageBenchPressure,
      "平均置換score": entry.averageReplacementScore,
      "最多incoming": entry.mostFrequentIncomingUnitId === null
        ? null
        : `${entry.mostFrequentIncomingUnitName ?? entry.mostFrequentIncomingUnitId} (${entry.mostFrequentIncomingUnitId}) x${entry.mostFrequentIncomingSamples}`,
      "最多incoming理由": entry.mostFrequentIncomingReason == null
        ? null
        : `${entry.mostFrequentIncomingReason} x${entry.mostFrequentIncomingReasonSamples ?? 0}`,
      "最多outgoing": entry.mostFrequentOutgoingUnitId === null
        ? null
        : `${entry.mostFrequentOutgoingUnitName ?? entry.mostFrequentOutgoingUnitId} (${entry.mostFrequentOutgoingUnitId}) x${entry.mostFrequentOutgoingSamples}`,
      "最多outgoing理由": entry.mostFrequentOutgoingReason == null
        ? null
        : `${entry.mostFrequentOutgoingReason} x${entry.mostFrequentOutgoingReasonSamples ?? 0}`,
    })),
    "プレイヤー別最終盤面価値": (aggregate.finalPlayerBoardMetrics ?? []).map((entry) => ({
      "プレイヤー": entry.label,
      "ロール": entry.role,
      "登場試合数": entry.matchesPresent,
      "平均出撃数": entry.averageDeployedUnitCount,
      "平均出撃資産価値": entry.averageDeployedAssetValue,
      "平均特殊ユニット数": entry.averageSpecialUnitCount,
      "平均通常ユニット数": entry.averageStandardUnitCount,
    })),
    "ボス側戦闘テレメトリ": aggregate.bossBattleUnitMetrics.map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット種別": unit.unitType,
      "ユニット名": unit.unitName,
      "行動参加率": unit.activeBattleRate,
      "戦闘ごとの平均攻撃回数": unit.averageAttackCountPerBattle,
      "戦闘ごとの平均命中回数": unit.averageHitCountPerBattle,
      "戦闘ごとの平均被ダメージ": unit.averageDamageTakenPerBattle,
      "平均初回攻撃(ms)": unit.averageFirstAttackMs,
      "平均生存時間(ms)": unit.averageLifetimeMs,
      "0ダメージ戦闘率": unit.zeroDamageBattleRate,
    })),
    "レイド側戦闘テレメトリ": aggregate.raidBattleUnitMetrics.map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット種別": unit.unitType,
      "ユニット名": unit.unitName,
      "行動参加率": unit.activeBattleRate,
      "戦闘ごとの平均攻撃回数": unit.averageAttackCountPerBattle,
      "戦闘ごとの平均命中回数": unit.averageHitCountPerBattle,
      "戦闘ごとの平均被ダメージ": unit.averageDamageTakenPerBattle,
      "平均初回攻撃(ms)": unit.averageFirstAttackMs,
      "平均生存時間(ms)": unit.averageLifetimeMs,
      "0ダメージ戦闘率": unit.zeroDamageBattleRate,
    })),
    "最終盤面ユニット指標": aggregate.finalBoardUnitMetrics.map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット種別": unit.unitType,
      "ユニット名": unit.unitName,
      "総コピー数": unit.totalCopies,
      "登場試合数": unit.matchesPresent,
      "1試合あたり平均コピー数": unit.averageCopiesPerMatch,
      "採用率": unit.adoptionRate,
      "最終平均Lv": unit.averageFinalUnitLevel,
      "最終最大Lv": unit.maxFinalUnitLevel,
      "最終Lv4到達率": unit.finalLevel4Rate,
      "最終Lv7到達率": unit.finalLevel7Rate,
    })),
    "上位ダメージユニット": aggregate.topDamageUnits.map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット名": unit.unitName,
      "陣営": unit.side,
      "総ダメージ": unit.totalDamage,
      "登場試合数": unit.appearances,
      "試合ごとの平均ダメージ": unit.averageDamagePerMatch,
    })),
    "高コスト指標": {
      "ショップ提示回数": highCostSummary.offerObservationCount,
      "提示試合数": highCostSummary.offerMatchCount,
      "購入回数": highCostSummary.purchaseCount,
      "購入試合数": highCostSummary.purchaseMatchCount,
      "最終盤面コピー数": highCostSummary.finalBoardCopies,
      "最終盤面採用試合数": highCostSummary.finalBoardMatchCount,
      "最終盤面採用率": highCostSummary.finalBoardAdoptionRate,
    },
    "高コストショップ提示ユニット": highCostOfferMetrics.map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット名": unit.unitName,
      "ユニット種別": unit.unitType,
      "ロール": unit.role,
      "提示元": unit.source,
      "コスト": unit.cost,
      "提示回数": unit.observationCount,
      "提示試合数": unit.matchesPresent,
      "提示試合率": unit.offeredMatchRate,
    })),
    "ボス通常高コスト成熟診断": (aggregate.bossNormalHighCostMaturationMetrics ?? []).map((unit) => ({
      "ユニットID": unit.unitId,
      "ユニット名": unit.unitName,
      "ユニット種別": unit.unitType,
      "コスト": unit.cost,
      "提示回数": unit.offerObservationCount,
      "提示試合数": unit.offerMatchCount,
      "購入回数": unit.purchaseCount,
      "購入試合数": unit.purchaseMatchCount,
      "購入率": unit.purchaseRate,
      "戦闘登場回数": unit.battleAppearances,
      "戦闘登場試合数": unit.battleMatchCount,
      "戦闘採用率": unit.battleAdoptionRate,
      "戦闘平均Lv": unit.averageBattleUnitLevel,
      "戦闘最大Lv": unit.maxBattleUnitLevel,
      "戦闘Lv4到達率": unit.battleLevel4ReachRate,
      "戦闘Lv7到達率": unit.battleLevel7ReachRate,
      "最終盤面コピー数": unit.finalBoardCopies,
      "最終盤面採用試合数": unit.finalBoardMatchCount,
      "最終採用率": unit.finalBoardAdoptionRate,
      "最終平均Lv": unit.averageFinalUnitLevel,
      "最終最大Lv": unit.maxFinalUnitLevel,
      "最終Lv4到達率": unit.finalLevel4Rate,
      "最終Lv7到達率": unit.finalLevel7Rate,
    })),
    "ボス専用ラウンド別レベル分布": (aggregate.bossExclusiveRoundLevelMetrics ?? []).map((unit) => ({
      "ラウンド": unit.roundIndex,
      "ユニットID": unit.unitId,
      "ユニット名": unit.unitName,
      "ユニット種別": unit.unitType,
      "戦闘登場回数": unit.battleAppearances,
      "登場試合数": unit.matchesPresent,
      "平均Lv": unit.averageUnitLevel,
      "P25Lv": unit.p25UnitLevel,
      "P50Lv": unit.p50UnitLevel,
      "P75Lv": unit.p75UnitLevel,
      "Lv4到達率": unit.level4ReachRate,
      "Lv7到達率": unit.level7ReachRate,
    })),
    "高コストラウンド別ショップ進行": (aggregate.highCostRoundMetrics ?? []).map((unit) => ({
      "ラウンド": unit.roundIndex,
      "ロール": unit.role,
      "提示元": unit.source,
      "ユニットID": unit.unitId,
      "ユニット名": unit.unitName,
      "ユニット種別": unit.unitType,
      "コスト": unit.cost,
      "提示回数": unit.offerObservationCount,
      "提示試合数": unit.offerMatchCount,
      "購入回数": unit.purchaseCount,
      "購入試合数": unit.purchaseMatchCount,
      "戦闘登場回数": unit.battleAppearances,
      "戦闘登場試合数": unit.battleMatchCount,
      "提示試合率": unit.offeredMatchRate,
      "購入率": unit.purchaseRate,
      "戦闘登場試合率": unit.battlePresenceRate,
    })),
    "ショップ提示グループ診断": buildShopOfferGroupDiagnostics(aggregate.shopOfferMetrics ?? [])
      .map((group) => ({
        "ロール": group.role,
        "提示元": group.source,
        "コスト": group.cost,
        "ユニット数": group.unitCount,
        "平均提示回数": group.averageOffers,
        "最小提示回数": group.minOffers,
        "最大提示回数": group.maxOffers,
        "最大/最小": group.maxMinRatio,
      })),
    "射程別ダメージ効率比較": aggregate.rangeDamageEfficiencyMetrics.map((entry) => ({
      "陣営": entry.side,
      "射程帯": localizeRangeBand(entry.rangeBand),
      "戦闘登場回数": entry.battleAppearances,
      "戦闘ごとの平均ダメージ": entry.averageDamagePerBattle,
      "基礎火力発揮率": entry.normalizedDamageEfficiency,
      "攻撃機会消化率": entry.attackOpportunityUtilization,
      "平均初回攻撃(ms)": entry.averageFirstAttackMs,
      "0ダメージ戦闘率": entry.zeroDamageBattleRate,
    })),
    "射程別行動診断": aggregate.rangeActionDiagnosticsMetrics.map((entry) => ({
      "陣営": entry.side,
      "射程帯": localizeRangeBand(entry.rangeBand),
      "戦闘登場回数": entry.battleAppearances,
      "移動参加率": entry.movedBattleRate,
      "戦闘ごとの平均移動回数": entry.averageMoveCountPerBattle,
      "平均初回移動(ms)": entry.averageFirstMoveMs,
      "移動後の平均初撃遅延(ms)": entry.averageMoveToFirstAttackMs,
      "再接敵移動率": entry.repositionBattleRate,
      "戦闘ごとの平均再接敵移動回数": entry.averageRepositionMoveCountPerBattle,
      "射程内到達率": entry.reachedAttackRangeBattleRate,
      "未攻撃だが射程内到達": entry.noAttackDespiteReachingRangeBattleRate,
      "未攻撃かつ射程外終了": entry.noAttackWithoutReachingRangeBattleRate,
      "平均初期最短距離": entry.averageInitialNearestEnemyDistance,
      "平均最短到達距離": entry.averageBestNearestEnemyDistance,
      "平均距離短縮量": entry.averageDistanceClosed,
      "0ダメージ内訳: 未攻撃": entry.noAttackBattleRate,
      "0ダメージ内訳: 移動のみ": entry.movedNoAttackBattleRate,
      "0ダメージ内訳: 攻撃したが命中なし": entry.attackedNoHitBattleRate,
      "追跡対象比較サンプル数": entry.moveTargetDiagnosticSampleCount,
      "最適接敵対象ズレ率": entry.suboptimalMoveTargetRate,
      "平均余剰接敵歩数": entry.averageExcessApproachSteps,
      "初撃まで射程外だった平均時間(ms)": entry.averageOutsideAttackRangeBeforeFirstAttackMs,
      "初撃まで射程内で待った平均時間(ms)": entry.averageInAttackRangeBeforeFirstAttackMs,
      "初撃後の平均生存時間(ms)": entry.averageAfterFirstAttackMs,
      "平均初回接敵(ms)": entry.averageFirstReachedAttackRangeAtMs,
      "初回接敵サンプル数": entry.firstReachedAttackRangeSamples,
      "戦闘ごとの平均左横移動回数": entry.averageLeftLateralMovesPerBattle,
      "戦闘ごとの平均右横移動回数": entry.averageRightLateralMovesPerBattle,
      "初回横移動 左率": entry.firstLateralMoveLeftRate,
      "初回横移動 右率": entry.firstLateralMoveRightRate,
      "初回横移動サンプル数": entry.firstLateralMoveSamples,
      "追跡対象共有サンプル数": entry.sharedPursuitMoveSampleCount,
      "同時追跡競合率": entry.contestedPursuitMoveRate,
      "割当前競合サンプル数": entry.plannedApproachGroupMoveSampleCount,
      "割当前の平均競合人数": entry.averagePlannedApproachGroupCompetitorCount,
      "割当前の平均割当人数": entry.averagePlannedApproachGroupAssignedCount,
      "割当前に受け口不足だった率": entry.oversubscribedPlannedApproachGroupRate,
      "接敵口割当あり戦闘数": entry.plannedApproachBattleCount,
      "接敵口割当サンプル数": entry.plannedApproachMoveSampleCount,
      "割当口が実行時も空いていた率": entry.plannedApproachStillOpenRate,
      "割当口をそのまま使えた率": entry.usedPlannedApproachRate,
      "割当口は空いていたが経路が詰まった率": entry.plannedApproachPathBlockedRate,
      "接敵口割当から初撃に繋がった率": entry.plannedApproachFirstAttackRate,
      "接敵口割当どおりの相手へ初撃した率": entry.plannedApproachMatchedFirstAttackTargetRate,
      "接敵口割当後に射程内までは届いた未攻撃率": entry.plannedApproachReachedRangeWithoutAttackRate,
      "接敵口割当後も未接敵のまま終わった率": entry.plannedApproachNoReachNoAttackRate,
      "接敵口割当後に未攻撃のまま割当先が先に落ちた率": entry.plannedApproachNoAttackTargetDiedBeforeBattleEndRate,
      "接敵口割当後に射程内へ届いたが割当先が生存中のまま未攻撃率":
        entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate,
      "接敵口割当後に割当先が生存中のまま未接敵終了率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveRate,
      "割当先生存・射程内未攻撃のうち割当口未使用率":
        entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate,
      "割当先生存・射程内未攻撃のうち経路詰まり併発率":
        entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate,
      "割当先生存・未接敵終了のうち割当口未使用率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate,
      "割当先生存・未接敵終了のうち経路詰まり併発率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate,
      "割当先生存・未接敵終了のうち味方直前ブロック率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate,
      "割当先生存・未接敵終了のうち敵直前ブロック率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate,
      "割当先生存・未接敵終了のうち混在直前ブロック率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate,
      "割当先生存・未接敵終了のうち道中チョーク率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate,
      "割当先生存・未接敵終了のうち味方帯チョーク率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate,
      "割当先生存・未接敵終了のうち敵受け口帯チョーク率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate,
      "割当先生存・未接敵終了のうち境界混在チョーク率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate,
      "割当先生存・未接敵終了のうち未分類チョーク率":
        entry.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate,
    })),
    "射程別失敗分類": aggregate.rangeActionDiagnosticsMetrics.map((entry) => ({
      "陣営": entry.side,
      "射程帯": localizeRangeBand(entry.rangeBand),
      "戦闘登場回数": entry.battleAppearances,
      "失敗分類: 未接敵": entry.noAttackWithoutReachingRangeBattleRate,
      "失敗分類: 接敵済み未攻撃": entry.noAttackDespiteReachingRangeBattleRate,
      "失敗分類: 遅すぎる単発": entry.lateSingleAttackBattleRate,
    })),
    "射程別初期配置診断": aggregate.rangeFormationDiagnosticsMetrics.map((entry) => ({
      "陣営": entry.side,
      "射程帯": localizeRangeBand(entry.rangeBand),
      "戦闘登場回数": entry.battleAppearances,
      "前方味方あり率": entry.frontAllyBlockedBattleRate,
      "平均前方味方数": entry.averageFrontAllyCount,
      "平均初期行": entry.averageInitialRow,
      "平均初期列": entry.averageInitialColumn,
      "前方味方あり時 0ダメ率": entry.zeroDamageBattleRateWithFrontAlly,
      "前方味方なし時 0ダメ率": entry.zeroDamageBattleRateWithoutFrontAlly,
      "前方味方あり時 未攻撃率": entry.noAttackBattleRateWithFrontAlly,
      "前方味方なし時 未攻撃率": entry.noAttackBattleRateWithoutFrontAlly,
    })),
    "レイド射程1コホート診断": (aggregate.raidMeleeCohortMetrics ?? []).map((entry) => ({
      "コホート": localizeRaidMeleeCohort(entry.cohort),
      "戦闘登場回数": entry.battleAppearances,
      "戦闘ごとの平均ダメージ": entry.averageDamagePerBattle,
      "戦闘ごとの平均攻撃回数": entry.averageAttackCountPerBattle,
      "平均初回攻撃(ms)": entry.averageFirstAttackMs,
      "平均生存時間(ms)": entry.averageLifetimeMs,
      "0ダメージ戦闘率": entry.zeroDamageBattleRate,
      "生存率": entry.survivalRate,
    })),
    "レイド特殊射程1ユニット診断": (aggregate.raidSpecialMeleeUnitDiagnostics ?? []).map((entry) => ({
      "ユニットID": entry.unitId,
      "ユニット名": entry.unitName,
      "戦闘登場回数": entry.battleAppearances,
      "戦闘ごとの平均ダメージ": entry.averageDamagePerBattle,
      "戦闘ごとの平均攻撃回数": entry.averageAttackCountPerBattle,
      "平均初回攻撃(ms)": entry.averageFirstAttackMs,
      "平均初回接敵(ms)": entry.averageFirstReachedAttackRangeAtMs,
      "未接敵終了率": entry.noAttackWithoutReachingRangeBattleRate,
      "接敵済み未攻撃率": entry.noAttackDespiteReachingRangeBattleRate,
      "同時追跡競合率": entry.contestedPursuitMoveRate,
      "0ダメージ戦闘率": entry.zeroDamageBattleRate,
      "生存率": entry.survivalRate,
    })),
    "チャンク実行状況": summary.chunks.map((chunk) => ({
      "チャンク番号": chunk.chunkIndex,
      "開始試合番号": chunk.matchStartIndex,
      "要求試合数": chunk.requestedMatchCount,
      "ワーカー番号": chunk.workerIndex,
      "ポートオフセット": chunk.portOffset,
      "完走数": chunk.completedMatches,
      "中断数": chunk.abortedMatches,
      "ログパス": chunk.logPath,
      "開始時刻": chunk.startedAt,
      "終了時刻": chunk.finishedAt,
      "所要時間(ms)": chunk.durationMs,
    })),
    "失敗一覧": summary.failures.map((failure) => ({
      "チャンク番号": failure.chunkIndex,
      "通算試合番号": failure.globalMatchIndex,
      "チャンク内試合番号": failure.localMatchIndex,
      "メッセージ": failure.message,
    })),
  };
}

export function buildBotBalanceBaselineJapaneseMarkdown(
  summary: BotBalanceBaselineSummary,
): string {
  const { aggregate } = summary;
  const analysis = buildBotBalanceBaselineAnalysis(summary);
  const battleTimelineTimeScale = resolveBattleTimelineTimeScale(aggregate);
  const unitDamageEfficiencyMetrics = resolveUnitDamageEfficiencyMetrics(aggregate);
  const highCostSummary = aggregate.highCostSummary ?? {
    offerObservationCount: 0,
    offerMatchCount: 0,
    purchaseCount: 0,
    purchaseMatchCount: 0,
    finalBoardCopies: 0,
    finalBoardMatchCount: 0,
    finalBoardAdoptionRate: 0,
  };
  const highCostOfferMetrics = aggregate.highCostOfferMetrics ?? [];
  const lines: string[] = [
    "# Bot Balance Baseline レポート",
    "",
    "## 実行条件",
    "",
    `- 要求対戦数: ${summary.requestedMatchCount}`,
    `- チャンクサイズ: ${summary.chunkSize}`,
    `- 並列数: ${summary.parallelism}`,
    `- ポートオフセット基準値: ${summary.portOffsetBase}`,
    `- ボス購入方針: ${summary.bossPolicy}`,
    `- レイド購入方針: ${summary.raidPolicies.join(", ")}`,
    `- 最適化variant: ${summary.optimizationVariant}`,
    `- チャンク数: ${summary.chunkCount}`,
    `- 出力先: ${summary.outputDir}`,
  ];

  for (const [helperIndex, helperConfig] of summary.helperConfigs.entries()) {
    lines.push(
      [
        `- bot${helperIndex + 1}: boss希望=${helperConfig.wantsBoss ? "ON" : "OFF"}`,
        `購入方針=${helperConfig.policy}`,
        ...(helperConfig.heroId ? [`固定主人公=${helperConfig.heroId}`] : []),
        `最適化variant=${helperConfig.optimizationVariant ?? summary.optimizationVariant}`,
      ].join(" / "),
    );
  }

  if (aggregate.metadata != null) {
    lines.push(
      `- モード: ${aggregate.metadata.mode}`,
      `- 戦闘速度倍率: ${formatNumber(aggregate.metadata.timeScale)}`,
      `- タイミング設定: 自動開始 ${aggregate.metadata.timings.readyAutoStartMs}ms / 準備 ${aggregate.metadata.timings.prepDurationMs}ms / 戦闘 ${aggregate.metadata.timings.battleDurationMs}ms / 決着待機 ${aggregate.metadata.timings.settleDurationMs}ms / 敗退演出 ${aggregate.metadata.timings.eliminationDurationMs}ms / 選択制限 ${aggregate.metadata.timings.selectionTimeoutMs}ms`,
    );
  }

  lines.push(
    "",
    "## 先に見るべき結論",
    "",
    `- バランス分析可否: ${analysis.balance.sampleUsability}`,
    `- 進行健全性: ${analysis.integrity.status}`,
    `- 進行診断 critical/warning/info: ${analysis.diagnostics.criticalCount}/${analysis.diagnostics.warningCount}/${analysis.diagnostics.infoCount}`,
    `- R12到達率: ${formatPercent(analysis.overview.r12ReachRate)}`,
    `- R12レイド勝率: ${formatPercent(analysis.finalBattle.raidWinRate)}`,
    "",
    "## 進行健全性診断",
    "",
  );

  if (analysis.integrity.issues.length === 0) {
    lines.push("- 進行不具合候補なし");
  } else {
    lines.push(
      "| 重大度 | code | 内容 | 根拠 |",
      "| --- | --- | --- | --- |",
      ...analysis.integrity.issues.map((issue) =>
        `| ${issue.severity} | ${escapeMarkdownCell(issue.code)} | ${escapeMarkdownCell(issue.message)} | ${escapeMarkdownCell(formatDiagnosticEvidence(issue.evidence))} |`),
    );
  }

  lines.push(
    "",
    "## バランス診断",
    "",
  );

  if (analysis.balance.issues.length === 0) {
    lines.push(`- balanceStatus=${analysis.balance.status}`);
  } else {
    lines.push(
      "| 重大度 | code | confidence | 内容 | 次アクション |",
      "| --- | --- | --- | --- | --- |",
      ...analysis.balance.issues.map((issue) =>
        `| ${issue.severity} | ${escapeMarkdownCell(issue.code)} | ${formatNumber(issue.confidence)} | ${escapeMarkdownCell(issue.message)} | ${issue.recommendedNextAction} |`),
    );
  }

  lines.push(
    "",
    "## 全体結果",
    "",
    `- 完走数: ${aggregate.completedMatches}`,
    `- 中断数: ${aggregate.abortedMatches}`,
    `- ボス勝利数: ${aggregate.bossWins}`,
    `- レイド勝利数: ${aggregate.raidWins}`,
    `- ボス勝率: ${formatPercent(aggregate.bossWinRate)}`,
    `- レイド勝率: ${formatPercent(aggregate.raidWinRate)}`,
    `- 平均ラウンド数: ${formatNumber(aggregate.averageRounds)}`,
    `- 最短ラウンド: ${aggregate.minRounds}`,
    `- 最長ラウンド: ${aggregate.maxRounds}`,
    `- 平均生存レイド人数: ${formatNumber(aggregate.averageRemainingRaidPlayers)}`,
    "",
    "## 戦闘終了指標",
    "",
    "| 戦闘数 | 平均ボス側生存数 | 平均レイド側生存数 | 両軍生存終了率 | ボス側全滅率 | レイド側全滅率 |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${aggregate.battleMetrics.totalBattles} | ${formatNumber(aggregate.battleMetrics.averageBossSurvivorsAtBattleEnd)} | ${formatNumber(aggregate.battleMetrics.averageRaidSurvivorsAtBattleEnd)} | ${formatPercent(aggregate.battleMetrics.bothSidesSurvivedRate)} | ${formatPercent(aggregate.battleMetrics.bossWipedRate)} | ${formatPercent(aggregate.battleMetrics.raidWipedRate)} |`,
    "",
    "| 終了理由 | 内部値 | 件数 | 割合 |",
    "| --- | --- | --- | --- |",
    ...Object.entries(aggregate.battleMetrics.endReasonCounts).map(([reason, count]) =>
      `| ${localizeBattleEndReason(reason)} | ${escapeMarkdownCell(reason)} | ${count} | ${formatPercent(aggregate.battleMetrics.totalBattles > 0 ? count / aggregate.battleMetrics.totalBattles : 0)} |`),
    "",
    "## ラウンド別生存診断",
    "",
    "| R | 戦闘数 | 平均終了秒 | フェーズ成功率 | 成功+ボス全滅 | 失敗+レイド全滅 | ボス全滅率 | レイド全滅率 | ボス開始 | ボス生存 | ボス生存率 | ボス残HP率 | レイド開始 | レイド生存 | レイド生存率 | レイド残HP率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...(aggregate.roundSurvivalDiagnostics ?? []).map((metric) =>
      `| ${metric.roundIndex} | ${metric.battleSamples} | ${formatNumber(toRealPlaySeconds(metric.averageBattleEndMs, battleTimelineTimeScale))} | ${formatPercent(metric.phaseSuccessRate)} | ${formatPercent(metric.phaseSuccessWithBossWipeRate)} | ${formatPercent(metric.phaseFailureWithRaidWipeRate)} | ${formatPercent(metric.bossWipedRate)} | ${formatPercent(metric.raidWipedRate)} | ${formatNumber(metric.averageBossStartUnitCount)} | ${formatNumber(metric.averageBossSurvivors)} | ${formatPercent(metric.bossUnitSurvivalRate)} | ${formatNullablePercent(metric.bossRemainingHpRate)} | ${formatNumber(metric.averageRaidStartUnitCount)} | ${formatNumber(metric.averageRaidSurvivors)} | ${formatPercent(metric.raidUnitSurvivalRate)} | ${formatNullablePercent(metric.raidRemainingHpRate)} |`),
    "",
    "## ラウンド別主要ユニット生存診断",
    "",
    "| R | 陣営 | ユニット名 | ユニットID | 戦闘数 | 平均Lv | 生存率 | 平均残HP | 残HP率 | 平均被ダメ | 平均生存ms | 平均与ダメ | 0ダメ率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...(aggregate.roundUnitSurvivalDiagnostics ?? [])
      .filter((metric) => metric.battleAppearances >= 3)
      .map((metric) =>
        `| ${metric.roundIndex} | ${metric.side} | ${escapeMarkdownCell(metric.unitName)} | ${escapeMarkdownCell(metric.unitId)} | ${metric.battleAppearances} | ${formatNumber(metric.averageUnitLevel)} | ${formatPercent(metric.survivalRate)} | ${formatNumber(metric.averageFinalHp)} | ${formatNullablePercent(metric.remainingHpRate)} | ${formatNumber(metric.averageDamageTaken)} | ${formatNumber(metric.averageLifetimeMs)} | ${formatNumber(metric.averageDamagePerBattle)} | ${formatPercent(metric.zeroDamageBattleRate)} |`),
    "",
    "## ラウンド分布",
    "",
    "| ラウンド | 件数 |",
    "| --- | --- |",
  );

  for (const [round, count] of Object.entries(aggregate.roundHistogram)) {
    lines.push(`| ${escapeMarkdownCell(round)} | ${count} |`);
  }

  lines.push(
    "",
    "## 各ラウンド詳細",
    "",
    "- 詳細なラウンド別明細は `round-details.ja.md` に分離しています。",
  );

  lines.push(
    "",
    "## R12最終戦",
    "",
    "| 試行数 | レイド勝率 | ボス撃破率 | 同時全滅数 | 平均ボス本体ダメージ | 平均ボス残HP | 平均終了秒(高速) | 平均終了秒(通常換算) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    `| ${analysis.finalBattle.sampleCount} | ${formatPercent(analysis.finalBattle.raidWinRate)} | ${formatPercent(analysis.finalBattle.bossDefeatRate)} | ${analysis.finalBattle.simultaneousWipeCount} | ${formatNumber(analysis.finalBattle.averageBossBodyDamage)} | ${formatNumber(analysis.finalBattle.averageBossRemainingHp)} | ${formatNumber(analysis.finalBattle.averageBattleEndSeconds)} | ${formatNumber(analysis.finalBattle.averageBattleEndRealPlaySeconds)} |`,
  );

  lines.push(
    "",
    "### R12本体保護",
    "",
    "| 本体撃破時にボス生存あり | 全R12比率 | 本体撃破内比率 | 本体撃破時の平均ボス生存 | ボス勝利時の平均ボス生存 | 本体撃破時の平均レイド生存 |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${analysis.finalBattle.bodyProtection.bossBodyDefeatedWithBossSurvivorsCount} | ${formatPercent(analysis.finalBattle.bodyProtection.bossBodyDefeatedWithBossSurvivorsSampleRate)} | ${formatPercent(analysis.finalBattle.bodyProtection.bossBodyDefeatedWithBossSurvivorsDefeatRate)} | ${formatNumber(analysis.finalBattle.bodyProtection.averageBossSurvivorsWhenBodyDefeated)} | ${formatNumber(analysis.finalBattle.bodyProtection.averageBossSurvivorsWhenBossWins)} | ${formatNumber(analysis.finalBattle.bodyProtection.averageRaidSurvivorsWhenBodyDefeated)} |`,
  );

  lines.push(
    "",
    "### R12ボススペル",
    "",
    "| スペルID | 発動率 | 発動回数 | 平均初回発動ms | 平均tick数 | 平均spell damage | 平均最大stack |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  if (analysis.finalBattle.bossSpells.length === 0) {
    lines.push("| - | 0.0% | 0 | - | 0 | 0 | - |");
  } else {
    for (const spell of analysis.finalBattle.bossSpells) {
      lines.push(
        `| ${escapeMarkdownCell(spell.spellId)} | ${formatPercent(spell.activationRate)} | ${spell.activationCount} | ${formatNullableNumber(spell.averageFirstActivationMs)} | ${formatNumber(spell.averageTickCount)} | ${formatNumber(spell.averageTotalDamage)} | ${formatNullableNumber(spell.averageMaxStack)} |`,
      );
    }
  }

  lines.push(
    "",
    "## ショップ出現診断",
    "",
    "| ユニット名 | ユニットID | ロール | 提示元 | コスト | 提示試合率 | 購入率 | 最終採用率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of analysis.shop.mostOffered.slice(0, 10)) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${unit.role} | ${unit.source} | ${formatNumber(unit.cost)} | ${formatPercent(unit.offeredMatchRate)} | ${formatPercent(unit.purchaseRate)} | ${formatPercent(unit.finalBoardAdoptionRate)} |`,
    );
  }

  lines.push(
    "",
    "### 同条件グループ別提示ばらつき",
    "",
    "| ロール | 提示元 | コスト | ユニット数 | 平均提示回数 | 最小提示回数 | 最大提示回数 | 最大/最小 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const group of buildShopOfferGroupDiagnostics(aggregate.shopOfferMetrics ?? [])) {
    lines.push(
      `| ${group.role} | ${group.source} | ${formatNumber(group.cost)} | ${formatNumber(group.unitCount)} | ${formatNumber(group.averageOffers)} | ${formatNumber(group.minOffers)} | ${formatNumber(group.maxOffers)} | ${formatNumber(group.maxMinRatio)} |`,
    );
  }

  lines.push(
    "",
    "## 経済",
    "",
    "- ログ上のGold増加は、固定Prep収入、レイド成功ボーナス、売却収入、特殊経済収入を含むログ由来の増加量です。",
    "- 旧形式のbaselineを集計する場合のみ、固定Prep収入とレイド成功ボーナスはラウンド進行から推定します。",
    "",
    "| プレイヤー | 固定Prep収入 | レイド成功ボーナス | 売却収入 | 特殊経済収入 | 通常ショップ支出 | ボスショップ支出 | リロール支出 | 主人公/ボス強化支出 | その他支出 | 最終未使用Gold |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const [label, economy] of Object.entries(aggregate.playerEconomyBreakdowns ?? {})) {
    lines.push(
      `| ${escapeMarkdownCell(label)} | ${formatNumber(economy.fixedPrepIncome)} | ${formatNumber(economy.raidPhaseSuccessBonusIncome)} | ${formatNumber(economy.sellIncome)} | ${formatNumber(economy.specialEconomyIncome)} | ${formatNumber(economy.normalShopSpend)} | ${formatNumber(economy.bossShopSpend)} | ${formatNumber(economy.refreshSpend)} | ${formatNumber(economy.specialUnitUpgradeSpend)} | ${formatNumber(economy.otherSpend)} | ${formatNumber(economy.finalUnusedGold)} |`,
    );
  }

  lines.push(
    "",
    "## プレイヤー別成績",
    "",
    "| プレイヤー | 平均順位 | 1位率 | 平均残HP | 平均残機 | 平均最終所持Gold | ログ上のGold増加 | ログ上のGold消費 | 平均購入回数 | 平均リロール回数 | 平均売却回数 | 平均主人公強化回数 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const [label, metrics] of Object.entries(aggregate.playerMetrics)) {
    lines.push(
      `| ${escapeMarkdownCell(label)} | ${formatNumber(metrics.averagePlacement)} | ${formatPercent(metrics.firstPlaceRate)} | ${formatNumber(metrics.averageRemainingHp)} | ${formatNumber(metrics.averageRemainingLives)} | ${formatNumber(metrics.averageFinalGold)} | ${formatNumber(metrics.averageGoldEarned)} | ${formatNumber(metrics.averageGoldSpent)} | ${formatNumber(metrics.averagePurchaseCount)} | ${formatNumber(metrics.averageRefreshCount)} | ${formatNumber(metrics.averageSellCount)} | ${formatNumber(metrics.averageSpecialUnitUpgradeCount ?? 0)} |`,
    );
  }

  lines.push(
    "",
    "## 主人公チーム勝率",
    "",
    "- 戦闘単位ではなく、選択主人公がいた試合の最終勝敗で集計します。",
    "",
    "| 主人公 | ID | 登場試合数 | レイド勝利数 | レイドチーム勝率 | 個人1位率 | 平均順位 | 平均残機 | 平均最終所持Gold | ログ上のGold増加 | ログ上のGold消費 | 平均主人公強化回数 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const metric of aggregate.heroTeamMetrics ?? []) {
    lines.push(
      `| ${escapeMarkdownCell(metric.heroName)} | ${escapeMarkdownCell(metric.heroId)} | ${metric.matchesPresent} | ${metric.raidTeamWins} | ${formatPercent(metric.raidTeamWinRate)} | ${formatPercent(metric.firstPlaceRate)} | ${formatNumber(metric.averagePlacement)} | ${formatNumber(metric.averageRemainingLives)} | ${formatNumber(metric.averageFinalGold)} | ${formatNumber(metric.averageGoldEarned)} | ${formatNumber(metric.averageGoldSpent)} | ${formatNumber(metric.averageSpecialUnitUpgradeCount)} |`,
    );
  }

  lines.push(
    "",
    "## 主人公構成別勝率",
    "",
    "| 構成 | 構成ID | 試合数 | レイド勝利数 | レイド勝率 | 平均R |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const metric of aggregate.heroCompositionMetrics ?? []) {
    lines.push(
      `| ${escapeMarkdownCell(metric.heroNames.join(" / "))} | ${escapeMarkdownCell(metric.compositionKey)} | ${metric.matchesPresent} | ${metric.raidWins} | ${formatPercent(metric.raidWinRate)} | ${formatNumber(metric.averageRounds)} |`,
    );
  }

  lines.push(
    "",
    "## ラウンド別ダメージ効率",
    "",
    "| R | 陣営 | ユニット名 | ユニットID | ユニット種別 | 戦闘登場回数 | 登場試合数 | 平均ユニットレベル | 合計ダメージ | 推定投入コスト | 戦闘ごとの平均投入コスト | ダメージ効率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.roundDamageEfficiencyMetrics ?? []) {
    lines.push(
      `| ${unit.roundIndex} | ${unit.side} | ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${unit.battleAppearances} | ${unit.matchesPresent} | ${formatNumber(unit.averageUnitLevel)} | ${formatNumber(unit.totalDamage)} | ${formatNumber(unit.totalInvestmentCost)} | ${formatNumber(unit.averageInvestmentCostPerBattle)} | ${formatNullableNumber(unit.damagePerInvestmentCost)} |`,
    );
  }

  lines.push(
    "",
    "## ユニット別加重ダメージ効率",
    "",
    "- Lv1主人公/ボス本体は投入コスト0のため効率を `-` 表示します。",
    "- 初回強化直後など投入コストが小さい行は効率が跳ねやすいので、サンプル品質と戦闘登場回数を併読してください。",
    "- この表はダメージ専用です。タンク、回復、妨害、盾、デバフの価値は別指標で確認してください。",
    "",
    "| 陣営 | ユニット名 | ユニットID | ユニット種別 | 観測ラウンド数 | 戦闘登場回数 | 登場試合数 | 平均ユニットレベル | 合計ダメージ | 推定投入コスト | 加重ダメージ効率 | サンプル品質 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of unitDamageEfficiencyMetrics) {
    lines.push(
      `| ${unit.side} | ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${unit.roundsObserved} | ${unit.battleAppearances} | ${unit.matchesPresent} | ${formatNumber(unit.averageUnitLevel)} | ${formatNumber(unit.totalDamage)} | ${formatNumber(unit.totalInvestmentCost)} | ${formatNullableNumber(unit.weightedDamagePerInvestmentCost)} | ${unit.sampleQuality} |`,
    );
  }

  lines.push(
    "",
    "## ボス側戦闘ユニット指標",
    "",
    "| ユニット名 | ユニットID | ユニット種別 | 戦闘登場回数 | 登場試合数 | 平均ユニットレベル | 最大到達レベル | Lv4到達率 | Lv7到達率 | 基本スキル/戦闘 | ペアスキル/戦闘 | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 担当側戦闘勝率 | 採用率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.bossBattleUnitMetrics) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${unit.battleAppearances} | ${unit.matchesPresent} | ${formatNumber(unit.averageunitLevel)} | ${formatNumber(unit.maxUnitLevel ?? 0)} | ${formatPercent(unit.level4ReachRate ?? 0)} | ${formatPercent(unit.level7ReachRate ?? 0)} | ${formatNumber(unit.averageBasicSkillActivationsPerBattle ?? 0)} | ${formatNumber(unit.averagePairSkillActivationsPerBattle ?? 0)} | ${formatNumber(unit.averageDamagePerBattle)} | ${formatNumber(unit.averageDamagePerMatch)} | ${formatPercent(unit.survivalRate)} | ${formatPercent(unit.ownerWinRate)} | ${formatPercent(unit.adoptionRate)} |`,
    );
  }

  lines.push(
    "",
    "## レイド側戦闘ユニット指標",
    "",
    "| ユニット名 | ユニットID | ユニット種別 | 戦闘登場回数 | 登場試合数 | 平均ユニットレベル | 最大到達レベル | Lv4到達率 | Lv7到達率 | 基本スキル/戦闘 | ペアスキル/戦闘 | 戦闘ごとの平均ダメージ | 試合ごとの平均ダメージ | 生存率 | 担当側戦闘勝率 | 採用率 | サブ採用回数 | サブ採用試合数 | サブ採用率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.raidBattleUnitMetrics) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${unit.battleAppearances} | ${unit.matchesPresent} | ${formatNumber(unit.averageunitLevel)} | ${formatNumber(unit.maxUnitLevel ?? 0)} | ${formatPercent(unit.level4ReachRate ?? 0)} | ${formatPercent(unit.level7ReachRate ?? 0)} | ${formatNumber(unit.averageBasicSkillActivationsPerBattle ?? 0)} | ${formatNumber(unit.averagePairSkillActivationsPerBattle ?? 0)} | ${formatNumber(unit.averageDamagePerBattle)} | ${formatNumber(unit.averageDamagePerMatch)} | ${formatPercent(unit.survivalRate)} | ${formatPercent(unit.ownerWinRate)} | ${formatPercent(unit.adoptionRate)} | ${unit.subUnitBattleAppearances ?? 0} | ${unit.subUnitMatchesPresent ?? 0} | ${formatPercent(unit.subUnitAdoptionRate ?? 0)} |`,
    );
  }

  const okinaSubHostMetrics = aggregate.okinaSubHostMetrics ?? [];
  lines.push(
    "",
    "## 隠岐奈sub host内訳",
    "",
    "| Hostユニット | Host ID | 種別 | 戦闘登場回数 | 登場試合数 | 平均Lv | 戦闘ごとの平均ダメージ | 生存率 | 担当側戦闘勝率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  if (okinaSubHostMetrics.length === 0) {
    lines.push("| - | - | - | 0 | 0 | - | - | - | - |");
  } else {
    for (const entry of okinaSubHostMetrics) {
      lines.push(
        `| ${escapeMarkdownCell(entry.hostUnitName)} | ${escapeMarkdownCell(entry.hostUnitId)} | ${escapeMarkdownCell(entry.hostUnitType)} | ${entry.battleAppearances} | ${entry.matchesPresent} | ${formatNumber(entry.averageHostLevel)} | ${formatNumber(entry.averageDamagePerBattle)} | ${formatPercent(entry.survivalRate)} | ${formatPercent(entry.ownerWinRate)} |`,
      );
    }
  }

  const okinaSubHostRoundMetrics = aggregate.okinaSubHostRoundMetrics ?? [];
  lines.push(
    "",
    "## ラウンド別隠岐奈sub host内訳",
    "",
    "| R | Hostユニット | Host ID | 種別 | 戦闘登場回数 | 登場試合数 | 平均Lv | 戦闘ごとの平均ダメージ | 生存率 | 担当側戦闘勝率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  if (okinaSubHostRoundMetrics.length === 0) {
    lines.push("| - | - | - | - | 0 | 0 | - | - | - | - |");
  } else {
    for (const entry of okinaSubHostRoundMetrics) {
      lines.push(
        `| ${entry.roundIndex} | ${escapeMarkdownCell(entry.hostUnitName)} | ${escapeMarkdownCell(entry.hostUnitId)} | ${escapeMarkdownCell(entry.hostUnitType)} | ${entry.battleAppearances} | ${entry.matchesPresent} | ${formatNumber(entry.averageHostLevel)} | ${formatNumber(entry.averageDamagePerBattle)} | ${formatPercent(entry.survivalRate)} | ${formatPercent(entry.ownerWinRate)} |`,
      );
    }
  }

  const okinaDecisionRoundMetrics = aggregate.okinaHeroSubDecisionRoundMetrics ?? [];
  lines.push(
    "",
    "## ラウンド別隠岐奈sub判断診断",
    "",
    "| R | 診断回数 | 裏推奨 | 候補なし | 表優先 | 現host維持 | 平均候補数 | 平均表相当値 | 平均best host gain | 平均currentPower | 平均futureValue | 平均transition | 平均protection | 平均best/表 | 最多best host |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  if (okinaDecisionRoundMetrics.length === 0) {
    lines.push("| - | 0 | 0 | 0 | 0 | 0 | - | - | - | - | - | - | - | - | - |");
  } else {
    for (const entry of okinaDecisionRoundMetrics) {
      const bestHostLabel = entry.mostFrequentBestHostUnitId === null
        ? "-"
        : `${entry.mostFrequentBestHostUnitName ?? entry.mostFrequentBestHostUnitId} (${entry.mostFrequentBestHostUnitId}) x${entry.mostFrequentBestHostSamples}`;
      lines.push(
        `| ${entry.roundIndex} | ${entry.samples} | ${entry.actionRecommendedSamples} | ${entry.noCandidateSamples} | ${entry.frontValuePreferredSamples} | ${entry.currentHostKeptSamples} | ${formatNumber(entry.averageCandidateCount)} | ${formatNumber(entry.averageFrontEquivalentValue)} | ${formatNullableNumber(entry.averageBestHostGain)} | ${formatNullableNumber(entry.averageBestHostCurrentPowerScore)} | ${formatNullableNumber(entry.averageBestHostFutureValueScore)} | ${formatNullableNumber(entry.averageBestHostTransitionReadinessScore)} | ${formatNullableNumber(entry.averageBestHostProtectionScore)} | ${formatNullableNumber(entry.averageBestToFrontRatio)} | ${escapeMarkdownCell(bestHostLabel)} |`,
      );
    }
  }

  const boardRefitDecisionRoundMetrics = aggregate.boardRefitDecisionRoundMetrics ?? [];
  lines.push(
    "",
    "## ラウンド別盤面再編成診断",
    "",
    "| R | 診断回数 | 盤面満杯 | 試行候補 | 置換推奨 | 置換実行 | 将来候補保持 | 平均bench圧 | 平均置換score | P25 | P50 | P75 | 最多incoming | incoming理由 | 最多outgoing | outgoing理由 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  if (boardRefitDecisionRoundMetrics.length === 0) {
    lines.push("| - | 0 | 0 | 0 | 0 | 0 | 0 | - | - | - | - | - | - | - | - | - |");
  } else {
    for (const entry of boardRefitDecisionRoundMetrics) {
      const incomingLabel = entry.mostFrequentIncomingUnitId === null
        ? "-"
        : `${entry.mostFrequentIncomingUnitName ?? entry.mostFrequentIncomingUnitId} (${entry.mostFrequentIncomingUnitId}) x${entry.mostFrequentIncomingSamples}`;
      const incomingReasonLabel = entry.mostFrequentIncomingReason == null
        ? "-"
        : `${entry.mostFrequentIncomingReason} x${entry.mostFrequentIncomingReasonSamples ?? 0}`;
      const outgoingLabel = entry.mostFrequentOutgoingUnitId === null
        ? "-"
        : `${entry.mostFrequentOutgoingUnitName ?? entry.mostFrequentOutgoingUnitId} (${entry.mostFrequentOutgoingUnitId}) x${entry.mostFrequentOutgoingSamples}`;
      const outgoingReasonLabel = entry.mostFrequentOutgoingReason == null
        ? "-"
        : `${entry.mostFrequentOutgoingReason} x${entry.mostFrequentOutgoingReasonSamples ?? 0}`;
      lines.push(
        `| ${entry.roundIndex} | ${entry.samples} | ${entry.boardFullSamples} | ${entry.attemptSamples} | ${entry.recommendedReplacementSamples} | ${entry.committedSamples} | ${entry.futureCandidateKeptCount} | ${formatPercent(entry.averageBenchPressure)} | ${formatNullableNumber(entry.averageReplacementScore)} | ${formatNullableNumber(entry.p25ReplacementScore)} | ${formatNullableNumber(entry.p50ReplacementScore)} | ${formatNullableNumber(entry.p75ReplacementScore)} | ${escapeMarkdownCell(incomingLabel)} | ${escapeMarkdownCell(incomingReasonLabel)} | ${escapeMarkdownCell(outgoingLabel)} | ${escapeMarkdownCell(outgoingReasonLabel)} |`,
      );
    }
  }

  const bossBodyGuardDecisionRoundMetrics = aggregate.bossBodyGuardDecisionRoundMetrics ?? [];
  lines.push(
    "",
    "## ラウンド別ボス直衛判断診断",
    "",
    "| R | 診断回数 | 空き埋め | 交換 | 側面護衛 | 見送り | 直衛空き | bench前衛待ち | 直衛外に強前衛 | 平均直衛Lv | 平均最強前衛Lv | 最多直衛 | 最多最強前衛 | 最多理由 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  if (bossBodyGuardDecisionRoundMetrics.length === 0) {
    lines.push("| - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | - | - | - | - | - |");
  } else {
    for (const entry of bossBodyGuardDecisionRoundMetrics) {
      const directGuardLabel = entry.mostFrequentDirectGuardUnitId === null
        ? "-"
        : `${entry.mostFrequentDirectGuardUnitName ?? entry.mostFrequentDirectGuardUnitId} (${entry.mostFrequentDirectGuardUnitId}) x${entry.mostFrequentDirectGuardSamples}`;
      const strongestGuardLabel = entry.mostFrequentStrongestGuardUnitId === null
        ? "-"
        : `${entry.mostFrequentStrongestGuardUnitName ?? entry.mostFrequentStrongestGuardUnitId} (${entry.mostFrequentStrongestGuardUnitId}) x${entry.mostFrequentStrongestGuardSamples}`;
      const reasonLabel = entry.mostFrequentReason === null
        ? "-"
        : `${entry.mostFrequentReason} x${entry.mostFrequentReasonSamples}`;
      lines.push(
        `| ${entry.roundIndex} | ${entry.samples} | ${entry.directFillSamples} | ${entry.directSwapSamples} | ${entry.sideFlankMoveSamples} | ${entry.noActionSamples} | ${entry.directEmptySamples} | ${entry.benchFrontlineBlockedSamples} | ${entry.strongerOffDirectSamples} | ${formatNullableNumber(entry.averageDirectGuardLevel)} | ${formatNullableNumber(entry.averageStrongestGuardLevel)} | ${escapeMarkdownCell(directGuardLabel)} | ${escapeMarkdownCell(strongestGuardLabel)} | ${escapeMarkdownCell(reasonLabel)} |`,
      );
    }
  }

  const boardRefitDecisionRoleMetrics = aggregate.boardRefitDecisionRoleMetrics ?? [];
  lines.push(
    "",
    "## ロール別盤面再編成診断",
    "",
    "| ロール | 診断回数 | 盤面満杯 | 試行候補 | 置換推奨 | 置換実行 | 将来候補保持 | 平均bench圧 | 平均置換score | P25 | P50 | P75 | 最多incoming | incoming理由 | 最多outgoing | outgoing理由 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  if (boardRefitDecisionRoleMetrics.length === 0) {
    lines.push("| - | 0 | 0 | 0 | 0 | 0 | 0 | - | - | - | - | - | - | - | - | - |");
  } else {
    for (const entry of boardRefitDecisionRoleMetrics) {
      const incomingLabel = entry.mostFrequentIncomingUnitId === null
        ? "-"
        : `${entry.mostFrequentIncomingUnitName ?? entry.mostFrequentIncomingUnitId} (${entry.mostFrequentIncomingUnitId}) x${entry.mostFrequentIncomingSamples}`;
      const incomingReasonLabel = entry.mostFrequentIncomingReason == null
        ? "-"
        : `${entry.mostFrequentIncomingReason} x${entry.mostFrequentIncomingReasonSamples ?? 0}`;
      const outgoingLabel = entry.mostFrequentOutgoingUnitId === null
        ? "-"
        : `${entry.mostFrequentOutgoingUnitName ?? entry.mostFrequentOutgoingUnitId} (${entry.mostFrequentOutgoingUnitId}) x${entry.mostFrequentOutgoingSamples}`;
      const outgoingReasonLabel = entry.mostFrequentOutgoingReason == null
        ? "-"
        : `${entry.mostFrequentOutgoingReason} x${entry.mostFrequentOutgoingReasonSamples ?? 0}`;
      lines.push(
        `| ${entry.role} | ${entry.samples} | ${entry.boardFullSamples} | ${entry.attemptSamples} | ${entry.recommendedReplacementSamples} | ${entry.committedSamples} | ${entry.futureCandidateKeptCount} | ${formatPercent(entry.averageBenchPressure)} | ${formatNullableNumber(entry.averageReplacementScore)} | ${formatNullableNumber(entry.p25ReplacementScore)} | ${formatNullableNumber(entry.p50ReplacementScore)} | ${formatNullableNumber(entry.p75ReplacementScore)} | ${escapeMarkdownCell(incomingLabel)} | ${escapeMarkdownCell(incomingReasonLabel)} | ${escapeMarkdownCell(outgoingLabel)} | ${escapeMarkdownCell(outgoingReasonLabel)} |`,
      );
    }
  }

  const boardRefitDecisionRoleRoundMetrics = aggregate.boardRefitDecisionRoleRoundMetrics ?? [];
  lines.push(
    "",
    "## ロール・ラウンド別盤面再編成診断",
    "",
    "| ロール | R | 診断回数 | 盤面満杯 | 試行候補 | 置換推奨 | 置換実行 | 将来候補保持 | 平均bench圧 | 平均置換score | 最多incoming | incoming理由 | 最多outgoing | outgoing理由 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  if (boardRefitDecisionRoleRoundMetrics.length === 0) {
    lines.push("| - | - | 0 | 0 | 0 | 0 | 0 | 0 | - | - | - | - | - | - |");
  } else {
    for (const entry of boardRefitDecisionRoleRoundMetrics) {
      const incomingLabel = entry.mostFrequentIncomingUnitId === null
        ? "-"
        : `${entry.mostFrequentIncomingUnitName ?? entry.mostFrequentIncomingUnitId} (${entry.mostFrequentIncomingUnitId}) x${entry.mostFrequentIncomingSamples}`;
      const incomingReasonLabel = entry.mostFrequentIncomingReason == null
        ? "-"
        : `${entry.mostFrequentIncomingReason} x${entry.mostFrequentIncomingReasonSamples ?? 0}`;
      const outgoingLabel = entry.mostFrequentOutgoingUnitId === null
        ? "-"
        : `${entry.mostFrequentOutgoingUnitName ?? entry.mostFrequentOutgoingUnitId} (${entry.mostFrequentOutgoingUnitId}) x${entry.mostFrequentOutgoingSamples}`;
      const outgoingReasonLabel = entry.mostFrequentOutgoingReason == null
        ? "-"
        : `${entry.mostFrequentOutgoingReason} x${entry.mostFrequentOutgoingReasonSamples ?? 0}`;
      lines.push(
        `| ${entry.role} | ${entry.roundIndex} | ${entry.samples} | ${entry.boardFullSamples} | ${entry.attemptSamples} | ${entry.recommendedReplacementSamples} | ${entry.committedSamples} | ${entry.futureCandidateKeptCount} | ${formatPercent(entry.averageBenchPressure)} | ${formatNullableNumber(entry.averageReplacementScore)} | ${escapeMarkdownCell(incomingLabel)} | ${escapeMarkdownCell(incomingReasonLabel)} | ${escapeMarkdownCell(outgoingLabel)} | ${escapeMarkdownCell(outgoingReasonLabel)} |`,
      );
    }
  }

  const finalPlayerBoardMetrics = aggregate.finalPlayerBoardMetrics ?? [];
  lines.push(
    "",
    "## プレイヤー別最終盤面価値",
    "",
    "| プレイヤー | ロール | 登場試合数 | 平均出撃数 | 平均出撃資産価値 | 平均特殊ユニット数 | 平均通常ユニット数 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  if (finalPlayerBoardMetrics.length === 0) {
    lines.push("| - | - | 0 | - | - | - | - |");
  } else {
    for (const entry of finalPlayerBoardMetrics) {
      lines.push(
        `| ${escapeMarkdownCell(entry.label)} | ${escapeMarkdownCell(entry.role)} | ${entry.matchesPresent} | ${formatNumber(entry.averageDeployedUnitCount)} | ${formatNumber(entry.averageDeployedAssetValue)} | ${formatNumber(entry.averageSpecialUnitCount)} | ${formatNumber(entry.averageStandardUnitCount)} |`,
      );
    }
  }

  lines.push(
    "",
    "## ボス側戦闘テレメトリ",
    "",
    "| ユニット名 | ユニットID | ユニット種別 | 行動参加率 | 戦闘ごとの平均攻撃回数 | 戦闘ごとの平均命中回数 | 戦闘ごとの平均被ダメージ | 平均初回攻撃(ms) | 平均生存時間(ms) | 0ダメージ戦闘率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.bossBattleUnitMetrics) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${formatPercent(unit.activeBattleRate)} | ${formatNumber(unit.averageAttackCountPerBattle)} | ${formatNumber(unit.averageHitCountPerBattle)} | ${formatNumber(unit.averageDamageTakenPerBattle)} | ${formatNullableNumber(unit.averageFirstAttackMs)} | ${formatNumber(unit.averageLifetimeMs)} | ${formatPercent(unit.zeroDamageBattleRate)} |`,
    );
  }

  lines.push(
    "",
    "## レイド側戦闘テレメトリ",
    "",
    "| ユニット名 | ユニットID | ユニット種別 | 行動参加率 | 戦闘ごとの平均攻撃回数 | 戦闘ごとの平均命中回数 | 戦闘ごとの平均被ダメージ | 平均初回攻撃(ms) | 平均生存時間(ms) | 0ダメージ戦闘率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.raidBattleUnitMetrics) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${formatPercent(unit.activeBattleRate)} | ${formatNumber(unit.averageAttackCountPerBattle)} | ${formatNumber(unit.averageHitCountPerBattle)} | ${formatNumber(unit.averageDamageTakenPerBattle)} | ${formatNullableNumber(unit.averageFirstAttackMs)} | ${formatNumber(unit.averageLifetimeMs)} | ${formatPercent(unit.zeroDamageBattleRate)} |`,
    );
  }

  lines.push(
    "",
    "## 最終盤面ユニット指標",
    "",
    "| ユニット名 | ユニットID | ユニット種別 | 総コピー数 | 登場試合数 | 1試合あたり平均コピー数 | 採用率 | 最終平均Lv | 最終最大Lv | 最終Lv4到達率 | 最終Lv7到達率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.finalBoardUnitMetrics) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${unit.totalCopies} | ${unit.matchesPresent} | ${formatNumber(unit.averageCopiesPerMatch)} | ${formatPercent(unit.adoptionRate)} | ${formatNumber(unit.averageFinalUnitLevel)} | ${formatNumber(unit.maxFinalUnitLevel)} | ${formatPercent(unit.finalLevel4Rate)} | ${formatPercent(unit.finalLevel7Rate)} |`,
    );
  }

  lines.push(
    "",
    "## 上位ダメージユニット",
    "",
    "| ユニット名 | ユニットID | 陣営 | 総ダメージ | 登場試合数 | 試合ごとの平均ダメージ |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.topDamageUnits) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${unit.side} | ${formatNumber(unit.totalDamage)} | ${unit.appearances} | ${formatNumber(unit.averageDamagePerMatch)} |`,
    );
  }

  lines.push(
    "",
    "## 高コスト指標",
    "",
    "| ショップ提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終盤面採用率 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    `| ${formatNumber(highCostSummary.offerObservationCount)} | ${formatNumber(highCostSummary.offerMatchCount)} | ${formatNumber(highCostSummary.purchaseCount)} | ${formatNumber(highCostSummary.purchaseMatchCount)} | ${formatNumber(highCostSummary.finalBoardCopies)} | ${formatNumber(highCostSummary.finalBoardMatchCount)} | ${formatPercent(highCostSummary.finalBoardAdoptionRate)} |`,
    "",
    "## 高コストショップ提示ユニット",
    "",
    "| ユニット名 | ユニットID | ユニット種別 | ロール | 提示元 | コスト | 提示回数 | 提示試合数 | 提示試合率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of highCostOfferMetrics) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${unit.role} | ${unit.source} | ${formatNumber(unit.cost)} | ${formatNumber(unit.observationCount)} | ${formatNumber(unit.matchesPresent)} | ${formatPercent(unit.offeredMatchRate)} |`,
    );
  }

  lines.push(
    "",
    "## ボス通常高コスト成熟診断",
    "",
    "| ユニット名 | ユニットID | ユニット種別 | コスト | 提示回数 | 提示試合数 | 購入回数 | 購入率 | 戦闘登場回数 | 戦闘登場試合数 | 戦闘採用率 | 戦闘平均Lv | 戦闘最大Lv | 戦闘Lv4到達率 | 戦闘Lv7到達率 | 最終盤面コピー数 | 最終盤面採用試合数 | 最終採用率 | 最終平均Lv | 最終最大Lv | 最終Lv4到達率 | 最終Lv7到達率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.bossNormalHighCostMaturationMetrics ?? []) {
    lines.push(
      `| ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${formatNumber(unit.cost)} | ${formatNumber(unit.offerObservationCount)} | ${formatNumber(unit.offerMatchCount)} | ${formatNumber(unit.purchaseCount)} | ${formatPercent(unit.purchaseRate)} | ${formatNumber(unit.battleAppearances)} | ${formatNumber(unit.battleMatchCount)} | ${formatPercent(unit.battleAdoptionRate)} | ${formatNumber(unit.averageBattleUnitLevel)} | ${formatNumber(unit.maxBattleUnitLevel)} | ${formatPercent(unit.battleLevel4ReachRate)} | ${formatPercent(unit.battleLevel7ReachRate)} | ${formatNumber(unit.finalBoardCopies)} | ${formatNumber(unit.finalBoardMatchCount)} | ${formatPercent(unit.finalBoardAdoptionRate)} | ${formatNumber(unit.averageFinalUnitLevel)} | ${formatNumber(unit.maxFinalUnitLevel)} | ${formatPercent(unit.finalLevel4Rate)} | ${formatPercent(unit.finalLevel7Rate)} |`,
    );
  }

  lines.push(
    "",
    "## ボス専用ラウンド別レベル分布",
    "",
    "| R | ユニット名 | ユニットID | ユニット種別 | 戦闘登場回数 | 登場試合数 | 平均Lv | P25Lv | P50Lv | P75Lv | Lv4到達率 | Lv7到達率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.bossExclusiveRoundLevelMetrics ?? []) {
    lines.push(
      `| ${unit.roundIndex} | ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${formatNumber(unit.battleAppearances)} | ${formatNumber(unit.matchesPresent)} | ${formatNumber(unit.averageUnitLevel)} | ${formatNumber(unit.p25UnitLevel)} | ${formatNumber(unit.p50UnitLevel)} | ${formatNumber(unit.p75UnitLevel)} | ${formatPercent(unit.level4ReachRate)} | ${formatPercent(unit.level7ReachRate)} |`,
    );
  }

  lines.push(
    "",
    "## 高コストラウンド別ショップ進行",
    "",
    "| R | ロール | 提示元 | ユニット名 | ユニットID | ユニット種別 | コスト | 提示回数 | 提示試合数 | 購入回数 | 購入試合数 | 戦闘登場回数 | 戦闘登場試合数 | 提示試合率 | 購入率 | 戦闘登場試合率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const unit of aggregate.highCostRoundMetrics ?? []) {
    lines.push(
      `| ${unit.roundIndex} | ${unit.role} | ${unit.source} | ${escapeMarkdownCell(unit.unitName)} | ${escapeMarkdownCell(unit.unitId)} | ${escapeMarkdownCell(unit.unitType)} | ${formatNumber(unit.cost)} | ${formatNumber(unit.offerObservationCount)} | ${formatNumber(unit.offerMatchCount)} | ${formatNumber(unit.purchaseCount)} | ${formatNumber(unit.purchaseMatchCount)} | ${formatNumber(unit.battleAppearances)} | ${formatNumber(unit.battleMatchCount)} | ${formatPercent(unit.offeredMatchRate)} | ${formatPercent(unit.purchaseRate)} | ${formatPercent(unit.battlePresenceRate)} |`,
    );
  }

  lines.push(
    "",
    "## 射程別ダメージ効率比較",
    "",
    "| 陣営 | 射程帯 | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 基礎火力発揮率 | 攻撃機会消化率 | 平均初回攻撃(ms) | 0ダメージ戦闘率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const entry of aggregate.rangeDamageEfficiencyMetrics) {
    lines.push(
      `| ${entry.side} | ${localizeRangeBand(entry.rangeBand)} | ${formatNumber(entry.battleAppearances)} | ${formatNumber(entry.averageDamagePerBattle)} | ${formatNumber(entry.normalizedDamageEfficiency)} | ${formatNullablePercent(entry.attackOpportunityUtilization)} | ${formatNullableNumber(entry.averageFirstAttackMs)} | ${formatPercent(entry.zeroDamageBattleRate)} |`,
    );
  }

  lines.push(
    "",
    "## 付録",
    "",
    "### 射程別行動診断",
    "",
    "| 陣営 | 射程帯 | 戦闘登場回数 | 移動参加率 | 戦闘ごとの平均移動回数 | 平均初回移動(ms) | 移動後の平均初撃遅延(ms) | 再接敵移動率 | 戦闘ごとの平均再接敵移動回数 | 射程内到達率 | 未攻撃だが射程内到達 | 未攻撃かつ射程外終了 | 平均初期最短距離 | 平均最短到達距離 | 平均距離短縮量 | 0ダメージ内訳: 未攻撃 | 0ダメージ内訳: 移動のみ | 0ダメージ内訳: 攻撃したが命中なし | 追跡対象比較サンプル数 | 最適接敵対象ズレ率 | 平均余剰接敵歩数 | 初撃まで射程外だった平均時間(ms) | 初撃まで射程内で待った平均時間(ms) | 初撃後の平均生存時間(ms) | 平均初回接敵(ms) | 初回接敵サンプル数 | 戦闘ごとの平均左横移動回数 | 戦闘ごとの平均右横移動回数 | 初回横移動 左率 | 初回横移動 右率 | 初回横移動サンプル数 | 追跡対象共有サンプル数 | 同時追跡競合率 | 割当前競合サンプル数 | 割当前の平均競合人数 | 割当前の平均割当人数 | 割当前に受け口不足だった率 | 接敵口割当あり戦闘数 | 接敵口割当サンプル数 | 割当口が実行時も空いていた率 | 割当口をそのまま使えた率 | 割当口は空いていたが経路が詰まった率 | 接敵口割当から初撃に繋がった率 | 接敵口割当どおりの相手へ初撃した率 | 接敵口割当後に射程内までは届いた未攻撃率 | 接敵口割当後も未接敵のまま終わった率 | 接敵口割当後に未攻撃のまま割当先が先に落ちた率 | 接敵口割当後に射程内へ届いたが割当先が生存中のまま未攻撃率 | 接敵口割当後に割当先が生存中のまま未接敵終了率 | 割当先生存・射程内未攻撃のうち割当口未使用率 | 割当先生存・射程内未攻撃のうち経路詰まり併発率 | 割当先生存・未接敵終了のうち割当口未使用率 | 割当先生存・未接敵終了のうち経路詰まり併発率 | 割当先生存・未接敵終了のうち味方直前ブロック率 | 割当先生存・未接敵終了のうち敵直前ブロック率 | 割当先生存・未接敵終了のうち混在直前ブロック率 | 割当先生存・未接敵終了のうち道中チョーク率 | 割当先生存・未接敵終了のうち味方帯チョーク率 | 割当先生存・未接敵終了のうち敵受け口帯チョーク率 | 割当先生存・未接敵終了のうち境界混在チョーク率 | 割当先生存・未接敵終了のうち未分類チョーク率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const entry of aggregate.rangeActionDiagnosticsMetrics) {
    lines.push(
      `| ${entry.side} | ${localizeRangeBand(entry.rangeBand)} | ${formatNumber(entry.battleAppearances)} | ${formatPercent(entry.movedBattleRate)} | ${formatNumber(entry.averageMoveCountPerBattle)} | ${formatNullableNumber(entry.averageFirstMoveMs)} | ${formatNullableNumber(entry.averageMoveToFirstAttackMs)} | ${formatPercent(entry.repositionBattleRate)} | ${formatNumber(entry.averageRepositionMoveCountPerBattle)} | ${formatPercent(entry.reachedAttackRangeBattleRate)} | ${formatPercent(entry.noAttackDespiteReachingRangeBattleRate)} | ${formatPercent(entry.noAttackWithoutReachingRangeBattleRate)} | ${formatNullableNumber(entry.averageInitialNearestEnemyDistance)} | ${formatNullableNumber(entry.averageBestNearestEnemyDistance)} | ${formatNullableNumber(entry.averageDistanceClosed)} | ${formatPercent(entry.noAttackBattleRate)} | ${formatPercent(entry.movedNoAttackBattleRate)} | ${formatPercent(entry.attackedNoHitBattleRate)} | ${formatNumber(entry.moveTargetDiagnosticSampleCount)} | ${formatNullablePercent(entry.suboptimalMoveTargetRate)} | ${formatNullableNumber(entry.averageExcessApproachSteps)} | ${formatNullableNumber(entry.averageOutsideAttackRangeBeforeFirstAttackMs)} | ${formatNullableNumber(entry.averageInAttackRangeBeforeFirstAttackMs)} | ${formatNullableNumber(entry.averageAfterFirstAttackMs)} | ${formatNullableNumber(entry.averageFirstReachedAttackRangeAtMs)} | ${formatNumber(entry.firstReachedAttackRangeSamples)} | ${formatNumber(entry.averageLeftLateralMovesPerBattle)} | ${formatNumber(entry.averageRightLateralMovesPerBattle)} | ${formatNullablePercent(entry.firstLateralMoveLeftRate)} | ${formatNullablePercent(entry.firstLateralMoveRightRate)} | ${formatNumber(entry.firstLateralMoveSamples)} | ${formatNumber(entry.sharedPursuitMoveSampleCount)} | ${formatNullablePercent(entry.contestedPursuitMoveRate)} | ${formatNumber(entry.plannedApproachGroupMoveSampleCount)} | ${formatNullableNumber(entry.averagePlannedApproachGroupCompetitorCount)} | ${formatNullableNumber(entry.averagePlannedApproachGroupAssignedCount)} | ${formatNullablePercent(entry.oversubscribedPlannedApproachGroupRate)} | ${formatNumber(entry.plannedApproachBattleCount)} | ${formatNumber(entry.plannedApproachMoveSampleCount)} | ${formatNullablePercent(entry.plannedApproachStillOpenRate)} | ${formatNullablePercent(entry.usedPlannedApproachRate)} | ${formatNullablePercent(entry.plannedApproachPathBlockedRate)} | ${formatNullablePercent(entry.plannedApproachFirstAttackRate)} | ${formatNullablePercent(entry.plannedApproachMatchedFirstAttackTargetRate)} | ${formatNullablePercent(entry.plannedApproachReachedRangeWithoutAttackRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackRate)} | ${formatNullablePercent(entry.plannedApproachNoAttackTargetDiedBeforeBattleEndRate)} | ${formatNullablePercent(entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveRate)} | ${formatNullablePercent(entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithoutUsingPlannedDestinationRate)} | ${formatNullablePercent(entry.plannedApproachReachedRangeWithoutAttackWhileTargetAliveWithPathBlockedRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithoutUsingPlannedDestinationRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithPathBlockedRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyAdjacentBlockRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyAdjacentBlockRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedAdjacentBlockRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithRouteChokeBlockRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithAllyFrontierChokeRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithEnemyFrontierChokeRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithMixedFrontierChokeRate)} | ${formatNullablePercent(entry.plannedApproachNoReachNoAttackWhileTargetAliveWithUnclassifiedFrontierChokeRate)} |`,
    );
  }

  lines.push(
    "",
    "### 射程別失敗分類",
    "",
    "- 遅すぎる単発: 攻撃1回のみ、かつ初撃が戦闘時間の60%以上を消費したケース",
    "",
    "| 陣営 | 射程帯 | 戦闘登場回数 | 失敗分類: 未接敵 | 失敗分類: 接敵済み未攻撃 | 失敗分類: 遅すぎる単発 |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const entry of aggregate.rangeActionDiagnosticsMetrics) {
    lines.push(
      `| ${entry.side} | ${localizeRangeBand(entry.rangeBand)} | ${formatNumber(entry.battleAppearances)} | ${formatPercent(entry.noAttackWithoutReachingRangeBattleRate)} | ${formatPercent(entry.noAttackDespiteReachingRangeBattleRate)} | ${formatPercent(entry.lateSingleAttackBattleRate)} |`,
    );
  }

  lines.push(
    "",
    "### 射程別初期配置診断",
    "",
    "| 陣営 | 射程帯 | 戦闘登場回数 | 前方味方あり率 | 平均前方味方数 | 平均初期行 | 平均初期列 | 前方味方あり時 0ダメ率 | 前方味方なし時 0ダメ率 | 前方味方あり時 未攻撃率 | 前方味方なし時 未攻撃率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const entry of aggregate.rangeFormationDiagnosticsMetrics) {
    lines.push(
      `| ${entry.side} | ${localizeRangeBand(entry.rangeBand)} | ${formatNumber(entry.battleAppearances)} | ${formatPercent(entry.frontAllyBlockedBattleRate)} | ${formatNullableNumber(entry.averageFrontAllyCount)} | ${formatNullableNumber(entry.averageInitialRow)} | ${formatNullableNumber(entry.averageInitialColumn)} | ${formatNullablePercent(entry.zeroDamageBattleRateWithFrontAlly)} | ${formatNullablePercent(entry.zeroDamageBattleRateWithoutFrontAlly)} | ${formatNullablePercent(entry.noAttackBattleRateWithFrontAlly)} | ${formatNullablePercent(entry.noAttackBattleRateWithoutFrontAlly)} |`,
    );
  }

  lines.push(
    "",
    "### レイド射程1コホート診断",
    "",
    "| コホート | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 戦闘ごとの平均攻撃回数 | 平均初回攻撃(ms) | 平均生存時間(ms) | 0ダメージ戦闘率 | 生存率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const entry of aggregate.raidMeleeCohortMetrics ?? []) {
    lines.push(
      `| ${localizeRaidMeleeCohort(entry.cohort)} | ${formatNumber(entry.battleAppearances)} | ${formatNumber(entry.averageDamagePerBattle)} | ${formatNumber(entry.averageAttackCountPerBattle)} | ${formatNullableNumber(entry.averageFirstAttackMs)} | ${formatNumber(entry.averageLifetimeMs)} | ${formatPercent(entry.zeroDamageBattleRate)} | ${formatPercent(entry.survivalRate)} |`,
    );
  }

  lines.push(
    "",
    "### レイド特殊射程1ユニット診断",
    "",
    "| ユニット名 | ユニットID | 戦闘登場回数 | 戦闘ごとの平均ダメージ | 戦闘ごとの平均攻撃回数 | 平均初回攻撃(ms) | 平均初回接敵(ms) | 未接敵終了率 | 接敵済み未攻撃率 | 同時追跡競合率 | 0ダメージ戦闘率 | 生存率 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const entry of aggregate.raidSpecialMeleeUnitDiagnostics ?? []) {
    lines.push(
      `| ${escapeMarkdownCell(entry.unitName)} | ${escapeMarkdownCell(entry.unitId)} | ${formatNumber(entry.battleAppearances)} | ${formatNumber(entry.averageDamagePerBattle)} | ${formatNumber(entry.averageAttackCountPerBattle)} | ${formatNullableNumber(entry.averageFirstAttackMs)} | ${formatNullableNumber(entry.averageFirstReachedAttackRangeAtMs)} | ${formatPercent(entry.noAttackWithoutReachingRangeBattleRate)} | ${formatPercent(entry.noAttackDespiteReachingRangeBattleRate)} | ${formatNullablePercent(entry.contestedPursuitMoveRate)} | ${formatPercent(entry.zeroDamageBattleRate)} | ${formatPercent(entry.survivalRate)} |`,
    );
  }

  lines.push(
    "",
    "### チャンク実行状況",
    "",
    "| チャンク番号 | 開始試合番号 | 要求試合数 | ワーカー番号 | ポートオフセット | 完走数 | 中断数 | 所要時間(ms) | ログパス |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const chunk of summary.chunks) {
    lines.push(
      `| ${chunk.chunkIndex} | ${chunk.matchStartIndex} | ${chunk.requestedMatchCount} | ${chunk.workerIndex} | ${chunk.portOffset} | ${chunk.completedMatches} | ${chunk.abortedMatches} | ${chunk.durationMs} | ${escapeMarkdownCell(chunk.logPath)} |`,
    );
  }

  lines.push("", "## 失敗一覧", "");
  if (summary.failures.length === 0) {
    lines.push("- 失敗はありません。");
  } else {
    lines.push(
      "| チャンク番号 | 通算試合番号 | チャンク内試合番号 | メッセージ |",
      "| --- | --- | --- | --- |",
    );
    for (const failure of summary.failures) {
      lines.push(
        `| ${failure.chunkIndex} | ${failure.globalMatchIndex} | ${failure.localMatchIndex} | ${escapeMarkdownCell(failure.message)} |`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export function buildBotBalanceBaselineRoundDetailsJapaneseMarkdown(
  summary: BotBalanceBaselineSummary,
): string {
  const { aggregate } = summary;
  const battleTimelineTimeScale = resolveBattleTimelineTimeScale(aggregate);
  const lines: string[] = [
    "# Bot Balance Baseline ラウンド詳細",
    "",
    `- 要求対戦数: ${summary.requestedMatchCount}`,
    `- 完走数: ${aggregate.completedMatches}`,
    `- 出力先: ${summary.outputDir}`,
    "",
    "## 各ラウンド詳細",
    "",
    "| 試合 | R | 終了時間(実プレイ秒) | 最終勝利 | ラウンド結果 | 目的進捗 | 達成率 | 推定フェーズHP火力指数 | レミリア集中 | レイド全滅 | レイド撃破数 | ボス生存 | レイド生存 | 終了理由 | 戦闘勝利 | レイド別残機 | 上位レイド火力 | 上位ボス火力 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const round of aggregate.roundDetails ?? []) {
    lines.push(
      `| ${round.matchIndex} | ${round.roundIndex} | ${formatNumber(toRealPlaySeconds(round.battleEndTimeMs, battleTimelineTimeScale))} | ${round.matchWinnerRole} | ${round.phaseResult} | ${escapeMarkdownCell(formatRoundObjectiveProgress(round))} | ${formatPercent(round.phaseCompletionRate)} | ${formatNullableNumber(round.phaseHpPowerIndex ?? null)} | ${escapeMarkdownCell(formatBossBodyFocusDetail(round.bossBodyFocus ?? null))} | ${round.allRaidPlayersWipedOut ? "YES" : "NO"} | ${round.raidPlayersWipedOut} | ${round.bossSurvivors} | ${round.raidSurvivors} | ${escapeMarkdownCell(round.battleEndReasons.map((reason) => localizeBattleEndReason(reason)).join(", "))} | ${escapeMarkdownCell(round.battleWinnerRoles.join(", "))} | ${escapeMarkdownCell(formatRoundPlayerConsequences(round.raidPlayerConsequences))} | ${escapeMarkdownCell(formatRoundUnitDetails(round.topRaidUnits, "raid"))} | ${escapeMarkdownCell(formatRoundUnitDetails(round.topBossUnits, "boss"))} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatBossBodyFocusCell(
  focus: NonNullable<NonNullable<BotOnlyBaselineAggregateReport["roundDetails"]>[number]["bossBodyFocus"]>,
): string {
  if (focus.cell === null || focus.x === null || focus.y === null) {
    return "-";
  }

  return `cell ${focus.cell} (x=${focus.x}, y=${focus.y})`;
}

function formatBossBodyFocusDetail(
  focus: NonNullable<BotOnlyBaselineAggregateReport["roundDetails"]>[number]["bossBodyFocus"] | null,
): string {
  if (!focus) {
    return "-";
  }

  const firstDamage = typeof focus.firstDamageAtMs === "number"
    ? `, first=${formatNumber(focus.firstDamageAtMs)}ms`
    : "";
  const hp = focus.finalHp === null ? "-" : formatNumber(focus.finalHp);
  return `${formatBossBodyFocusCell(focus)}, dmg=${formatNumber(focus.damageTaken)}, phase=${formatNumber(focus.directPhaseDamage)}, hp=${hp}, ${focus.defeated ? "撃破" : "生存"}${firstDamage}`;
}

function formatRoundPlayerConsequences(
  players: NonNullable<BotOnlyBaselineAggregateReport["roundDetails"]>[number]["raidPlayerConsequences"],
): string {
  if (players.length === 0) {
    return "-";
  }

  return players
    .map((player) =>
      `${player.label}:${player.playerWipedOut ? "撃破" : "生存"} ${player.remainingLivesBefore}->${player.remainingLivesAfter}${player.eliminatedAfter ? " 脱落" : ""}`)
    .join(" / ");
}

function formatRoundUnitDetails(
  units: NonNullable<BotOnlyBaselineAggregateReport["roundDetails"]>[number]["topRaidUnits"],
  side: "boss" | "raid",
): string {
  if (units.length === 0) {
    return "-";
  }

  return units
    .slice(0, 3)
    .map((unit) => {
      const damageLabel = side === "raid"
        ? `${formatNumber(unit.totalDamage)}(phase ${formatNumber(unit.phaseContributionDamage)})`
        : formatNumber(unit.totalDamage);
      const cellLabel = unit.cell == null || unit.x == null || unit.y == null
        ? "-"
        : `cell ${unit.cell} (${unit.x},${unit.y})`;
      const typeLabel = unit.unitType ? ` ${unit.unitType}` : "";
      return `${unit.unitName}${typeLabel} Lv${unit.unitLevel}${cellLabel === "-" ? "" : ` ${cellLabel}`} dmg=${damageLabel} hp=${formatNumber(unit.finalHp)} ${unit.alive ? "生存" : "撃破"}`;
    })
    .join(" / ");
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatDiagnosticEvidence(evidence: Array<{ matchIndex: number; roundIndex?: number }>): string {
  if (evidence.length === 0) {
    return "-";
  }
  return evidence
    .slice(0, 3)
    .map((item) => `match=${item.matchIndex}${item.roundIndex == null ? "" : ` R${item.roundIndex}`}`)
    .join(", ");
}

function formatRoundObjectiveProgress(round: {
  roundIndex: number;
  phaseDamageDealt: number;
  phaseHpTarget: number;
}): string {
  if (round.roundIndex === 12 && round.phaseHpTarget === 0) {
    return `ボス本体 ${formatNumber(round.phaseDamageDealt)}`;
  }
  return `${formatNumber(round.phaseDamageDealt)}/${formatNumber(round.phaseHpTarget)}`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/u, "");
}

function resolveBattleTimelineTimeScale(aggregate: BotOnlyBaselineAggregateReport): number {
  const timeScale = aggregate.metadata?.timeScale;
  return typeof timeScale === "number" && Number.isFinite(timeScale) && timeScale > 0
    ? timeScale
    : 1;
}

function toRealPlaySeconds(scaledDurationMs: number, timeScale: number): number {
  return Number(((scaledDurationMs / timeScale) / 1000).toFixed(2));
}

function formatNullableNumber(value: number | null): string {
  return value == null ? "-" : formatNumber(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNullablePercent(value: number | null): string {
  return value == null ? "-" : formatPercent(value);
}
