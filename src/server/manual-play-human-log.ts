import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { BattleStartEvent, BattleTimelineEvent, BoardUnitPlacement } from "../shared/room-messages";
import { resolveSharedBoardUnitPresentation } from "./shared-board-unit-presentation";

export interface ManualPlayBoardUnit {
  cell: number;
  unitName: string;
  unitType: string;
  unitId: string;
  unitLevel?: number;
  subUnitName: string;
}

export interface ManualPlayPlayerAtBattleStart {
  playerId: string;
  role: "raid" | "boss";
  boardUnits: ManualPlayBoardUnit[];
  trackedBattleUnitIds: string[];
}

export interface ManualPlayPlayerConsequence {
  playerId: string;
  label: string;
  role: "raid" | "boss";
  battleStartUnitCount: number;
  playerWipedOut: boolean;
  remainingLivesBefore: number;
  remainingLivesAfter: number;
  eliminatedAfter: boolean;
}

export interface ManualPlayUnitBattleOutcome {
  battleUnitId?: string;
  playerId: string;
  label: string;
  unitId: string;
  unitName: string;
  side: "boss" | "raid";
  totalDamage: number;
  phaseContributionDamage: number;
  finalHp: number;
  alive: boolean;
  unitLevel?: number;
  subUnitName: string;
  isSpecialUnit: boolean;
}

export interface ManualPlayRoundBattleReport {
  battleIndex: number;
  unitOutcomes: ManualPlayUnitBattleOutcome[];
}

export interface ManualPlayRoundReport {
  roundIndex: number;
  battleDurationMs?: number;
  phaseHpTarget: number;
  phaseDamageDealt: number;
  phaseResult: "pending" | "success" | "failed";
  battles: ManualPlayRoundBattleReport[];
  playerConsequences: ManualPlayPlayerConsequence[];
  eliminations: string[];
}

export interface ManualPlayFinalPlayer {
  playerId: string;
  label: string;
  role: "raid" | "boss";
  eliminated: boolean;
}

export interface ManualPlayHumanReport {
  totalRounds: number;
  bossPlayerId: string;
  ranking: string[];
  playerLabels: Record<string, string>;
  finalPlayers: ManualPlayFinalPlayer[];
  rounds: ManualPlayRoundReport[];
}

export interface ManualPlayRoundTimelineSource {
  timeline?: Iterable<BattleTimelineEvent>;
}

function getPlayerLabel(playerLabels: Map<string, string> | Record<string, string>, playerId: string): string {
  if (playerLabels instanceof Map) {
    return playerLabels.get(playerId) ?? playerId;
  }

  return playerLabels[playerId] ?? playerId;
}

function extractRoundMatchedTimeline(
  roundIndex: number,
  timelineSource: Iterable<BattleTimelineEvent> | undefined,
): BattleTimelineEvent[] | undefined {
  if (!timelineSource) {
    return undefined;
  }

  const timeline = Array.from(timelineSource);
  if (timeline.length === 0) {
    return undefined;
  }

  const battleStartEvent = timeline.find(
    (event): event is Extract<BattleTimelineEvent, { type: "battleStart" }> =>
      event.type === "battleStart",
  );
  if (battleStartEvent?.round !== roundIndex) {
    return undefined;
  }

  return timeline;
}

export function resolveManualPlayRoundTimeline(args: {
  roundIndex: number;
  trackedPlayerIds: string[];
  controllerBattleResultsByPlayer?: ReadonlyMap<string, ManualPlayRoundTimelineSource>;
  statePlayerBattleResults?: ReadonlyMap<string, ManualPlayRoundTimelineSource | undefined>;
}): BattleTimelineEvent[] | undefined {
  const {
    roundIndex,
    trackedPlayerIds,
    controllerBattleResultsByPlayer,
    statePlayerBattleResults,
  } = args;

  for (const playerId of trackedPlayerIds) {
    const controllerTimeline = extractRoundMatchedTimeline(
      roundIndex,
      controllerBattleResultsByPlayer?.get(playerId)?.timeline,
    );
    if (controllerTimeline) {
      return controllerTimeline;
    }
  }

  for (const playerId of trackedPlayerIds) {
    const stateTimeline = extractRoundMatchedTimeline(
      roundIndex,
      statePlayerBattleResults?.get(playerId)?.timeline,
    );
    if (stateTimeline) {
      return stateTimeline;
    }
  }

  return undefined;
}

export function toManualPlayBoardUnit(placement: BoardUnitPlacement): ManualPlayBoardUnit {
  const resolvedName = placement.unitType == null
    ? undefined
    : resolveSharedBoardUnitPresentation(
      placement.unitId,
      placement.unitType,
    )?.displayName;

  return {
    cell: placement.cell,
    unitName:
      resolvedName
      ?? placement.archetype
      ?? placement.unitId
      ?? placement.unitType,
    unitType: placement.unitType,
    unitId: placement.unitId ?? "",
    unitLevel: placement.unitLevel ?? 1,
    subUnitName:
      (placement.subUnit?.unitType == null
        ? undefined
        : resolveSharedBoardUnitPresentation(
          placement.subUnit?.unitId,
          placement.subUnit?.unitType,
        )?.displayName)
      ?? placement.subUnit?.archetype
      ?? placement.subUnit?.unitId
      ?? placement.subUnit?.unitType
      ?? "",
  };
}

function buildTrackedUnitOwnerMap(
  playersAtBattleStart: ManualPlayPlayerAtBattleStart[],
): Map<string, string> {
  const ownerByUnitId = new Map<string, string>();

  for (const player of playersAtBattleStart) {
    for (const trackedUnitId of player.trackedBattleUnitIds) {
      ownerByUnitId.set(trackedUnitId, player.playerId);
    }
  }

  return ownerByUnitId;
}

function resolvePlayerIdForBattleUnit(
  ownerPlayerId: string | undefined,
  battleUnitId: string,
  sourceUnitId: string | undefined,
  ownerByTrackedUnitId: Map<string, string>,
): string | null {
  if (typeof ownerPlayerId === "string" && ownerPlayerId.length > 0) {
    return ownerPlayerId;
  }

  if (typeof sourceUnitId === "string" && ownerByTrackedUnitId.has(sourceUnitId)) {
    return ownerByTrackedUnitId.get(sourceUnitId) ?? null;
  }

  if (ownerByTrackedUnitId.has(battleUnitId)) {
    return ownerByTrackedUnitId.get(battleUnitId) ?? null;
  }

  if (battleUnitId.startsWith("hero-")) {
    return battleUnitId.slice("hero-".length) || null;
  }

  if (battleUnitId.startsWith("boss-")) {
    return battleUnitId.slice("boss-".length) || null;
  }

  return null;
}

function buildBoardUnitMetadataMapForBattle(
  playersAtBattleStart: ManualPlayPlayerAtBattleStart[],
): Map<string, ManualPlayBoardUnit[]> {
  const metadataByPlayerAndUnitId = new Map<string, ManualPlayBoardUnit[]>();

  for (const player of playersAtBattleStart) {
    for (const unit of player.boardUnits) {
      const key = `${player.playerId}::${unit.unitId}`;
      const existing = metadataByPlayerAndUnitId.get(key) ?? [];
      existing.push(unit);
      metadataByPlayerAndUnitId.set(key, existing);
    }
  }

  return metadataByPlayerAndUnitId;
}

function takeBoardUnitMetadataForBattleUnit(
  metadataByPlayerAndUnitId: Map<string, ManualPlayBoardUnit[]>,
  playerId: string,
  unitId: string,
): ManualPlayBoardUnit | null {
  const key = `${playerId}::${unitId}`;
  const metadataList = metadataByPlayerAndUnitId.get(key);
  if (!metadataList || metadataList.length === 0) {
    return null;
  }

  const metadata = metadataList.shift() ?? null;
  if (metadataList.length === 0) {
    metadataByPlayerAndUnitId.delete(key);
  }

  return metadata;
}

function distributeIntegerTotalByWeight(
  total: number,
  weightedBattleUnitIds: Array<{ battleUnitId: string; weight: number }>,
): Map<string, number> {
  const sanitizedEntries = weightedBattleUnitIds.filter((entry) => entry.weight > 0);
  if (total <= 0 || sanitizedEntries.length === 0) {
    return new Map();
  }

  const totalWeight = sanitizedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return new Map();
  }

  const shares = sanitizedEntries.map((entry) => {
    const exactShare = (total * entry.weight) / totalWeight;
    return {
      battleUnitId: entry.battleUnitId,
      floorShare: Math.floor(exactShare),
      remainder: exactShare - Math.floor(exactShare),
    };
  });

  let remaining = total - shares.reduce((sum, entry) => sum + entry.floorShare, 0);
  shares.sort((left, right) =>
    right.remainder - left.remainder
    || right.floorShare - left.floorShare
    || left.battleUnitId.localeCompare(right.battleUnitId));

  const distributed = new Map(
    shares.map((entry) => [entry.battleUnitId, entry.floorShare] as const),
  );

  for (const entry of shares) {
    if (remaining <= 0) {
      break;
    }

    distributed.set(entry.battleUnitId, (distributed.get(entry.battleUnitId) ?? 0) + 1);
    remaining -= 1;
  }

  return distributed;
}

export function buildManualPlayUnitBattleOutcomes(
  timeline: BattleTimelineEvent[] | undefined,
  playersAtBattleStart: ManualPlayPlayerAtBattleStart[],
  playerLabels: Map<string, string> | Record<string, string>,
): ManualPlayUnitBattleOutcome[] {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return [];
  }

  const battleStartEvent = timeline.find((event): event is BattleStartEvent => event.type === "battleStart");
  if (!battleStartEvent) {
    return [];
  }

  const ownerByTrackedUnitId = buildTrackedUnitOwnerMap(playersAtBattleStart);
  const metadataByPlayerAndUnitId = buildBoardUnitMetadataMapForBattle(playersAtBattleStart);
  const playerById = new Map(playersAtBattleStart.map((player) => [player.playerId, player] as const));
  const damageByBattleUnitId = new Map<string, number>();
  const phaseContributionByBattleUnitId = new Map<string, number>();
  const damageBySourceToTargetBattleUnitId = new Map<string, Map<string, number>>();
  const currentHpByBattleUnitId = new Map<string, number>();
  const deadUnitIds = new Set<string>();
  const battleStartUnitByBattleUnitId = new Map(
    battleStartEvent.units.map((unit) => [unit.battleUnitId, unit] as const),
  );
  const latestDamageSourceByTargetBattleUnitId = new Map<string, string>();
  const latestKeyframeByBattleUnitId = new Map<string, { currentHp: number; alive: boolean }>();
  const resolvePlayerRoleForBattleUnit = (battleUnitId: string): "boss" | "raid" | null => {
    const unit = battleStartUnitByBattleUnitId.get(battleUnitId);
    if (!unit) {
      return null;
    }

    const playerId = resolvePlayerIdForBattleUnit(
      unit.ownerPlayerId,
      unit.battleUnitId,
      unit.sourceUnitId,
      ownerByTrackedUnitId,
    );
    if (!playerId) {
      return null;
    }

    return playerById.get(playerId)?.role === "boss" ? "boss" : "raid";
  };

  for (const event of timeline) {
    if (event.type === "damageApplied") {
      damageByBattleUnitId.set(
        event.sourceBattleUnitId,
        (damageByBattleUnitId.get(event.sourceBattleUnitId) ?? 0) + event.amount,
      );
      const sourceDamageByTarget = damageBySourceToTargetBattleUnitId.get(event.targetBattleUnitId)
        ?? new Map<string, number>();
      sourceDamageByTarget.set(
        event.sourceBattleUnitId,
        (sourceDamageByTarget.get(event.sourceBattleUnitId) ?? 0) + event.amount,
      );
      damageBySourceToTargetBattleUnitId.set(event.targetBattleUnitId, sourceDamageByTarget);
      latestDamageSourceByTargetBattleUnitId.set(event.targetBattleUnitId, event.sourceBattleUnitId);
      const targetUnit = battleStartUnitByBattleUnitId.get(event.targetBattleUnitId);
      if (
        targetUnit?.battleUnitId.startsWith("boss-")
        && resolvePlayerRoleForBattleUnit(event.sourceBattleUnitId) === "raid"
      ) {
        phaseContributionByBattleUnitId.set(
          event.sourceBattleUnitId,
          (phaseContributionByBattleUnitId.get(event.sourceBattleUnitId) ?? 0) + event.amount,
        );
      }
      currentHpByBattleUnitId.set(event.targetBattleUnitId, event.remainingHp);
      continue;
    }

    if (event.type === "unitDeath") {
      const defeatedUnit = battleStartUnitByBattleUnitId.get(event.battleUnitId);
      const defeatedUnitIsBossSide = defeatedUnit != null
        && resolvePlayerRoleForBattleUnit(event.battleUnitId) === "boss";
      const defeatedUnitIsMainBoss = defeatedUnit?.battleUnitId.startsWith("boss-") ?? false;
      if (defeatedUnitIsBossSide && !defeatedUnitIsMainBoss) {
        const escortDefeatBonus = typeof defeatedUnit?.maxHp === "number"
          ? Math.floor(defeatedUnit.maxHp / 2)
          : 0;
        const raidDamageContributors = Array.from(
          damageBySourceToTargetBattleUnitId.get(event.battleUnitId)?.entries() ?? [],
        )
          .filter(([battleUnitId, damage]) =>
            damage > 0 && resolvePlayerRoleForBattleUnit(battleUnitId) === "raid")
          .map(([battleUnitId, damage]) => ({ battleUnitId, weight: damage }));

        const distributedEscortBonus = distributeIntegerTotalByWeight(
          escortDefeatBonus,
          raidDamageContributors,
        );
        if (distributedEscortBonus.size > 0) {
          for (const [battleUnitId, bonus] of distributedEscortBonus) {
            phaseContributionByBattleUnitId.set(
              battleUnitId,
              (phaseContributionByBattleUnitId.get(battleUnitId) ?? 0) + bonus,
            );
          }
        } else {
          const killerBattleUnitId = latestDamageSourceByTargetBattleUnitId.get(event.battleUnitId);
          if (
            killerBattleUnitId
            && resolvePlayerRoleForBattleUnit(killerBattleUnitId) === "raid"
            && escortDefeatBonus > 0
          ) {
            phaseContributionByBattleUnitId.set(
              killerBattleUnitId,
              (phaseContributionByBattleUnitId.get(killerBattleUnitId) ?? 0) + escortDefeatBonus,
            );
          }
        }
      }
      deadUnitIds.add(event.battleUnitId);
      currentHpByBattleUnitId.set(event.battleUnitId, 0);
      latestKeyframeByBattleUnitId.set(event.battleUnitId, {
        currentHp: 0,
        alive: false,
      });
      continue;
    }

    if (event.type === "keyframe") {
      for (const unitState of event.units) {
        latestKeyframeByBattleUnitId.set(unitState.battleUnitId, {
          currentHp: unitState.currentHp,
          alive: unitState.alive,
        });
      }
    }
  }

  return battleStartEvent.units
    .map((unit): ManualPlayUnitBattleOutcome | null => {
      const playerId = resolvePlayerIdForBattleUnit(
        unit.ownerPlayerId,
        unit.battleUnitId,
        unit.sourceUnitId,
        ownerByTrackedUnitId,
      );
      if (!playerId) {
        return null;
      }

      const ownerPlayer = playersAtBattleStart.find((player) => player.playerId === playerId);
      const sourceUnitId = unit.sourceUnitId ?? unit.battleUnitId;
      const metadata = takeBoardUnitMetadataForBattleUnit(
        metadataByPlayerAndUnitId,
        playerId,
        sourceUnitId,
      );
      const latestKeyframe = latestKeyframeByBattleUnitId.get(unit.battleUnitId);
      const finalHp = Math.max(
        0,
        latestKeyframe?.currentHp
          ?? currentHpByBattleUnitId.get(unit.battleUnitId)
          ?? unit.currentHp,
      );
      const alive = latestKeyframe?.alive
        ?? (!deadUnitIds.has(unit.battleUnitId) && finalHp > 0);

      return {
        battleUnitId: unit.battleUnitId,
        playerId,
        label: getPlayerLabel(playerLabels, playerId),
        unitId: sourceUnitId,
        unitName: unit.displayName ?? metadata?.unitName ?? sourceUnitId,
        side: ownerPlayer?.role === "boss" ? "boss" : "raid",
        totalDamage: damageByBattleUnitId.get(unit.battleUnitId) ?? 0,
        phaseContributionDamage: phaseContributionByBattleUnitId.get(unit.battleUnitId) ?? 0,
        finalHp,
        alive,
        unitLevel: metadata?.unitLevel ?? 1,
        subUnitName: metadata?.subUnitName ?? "",
        isSpecialUnit: metadata == null,
      };
    })
    .filter((unit): unit is ManualPlayUnitBattleOutcome => unit !== null)
    .sort((left, right) =>
      left.side.localeCompare(right.side)
      || left.label.localeCompare(right.label)
      || right.totalDamage - left.totalDamage
      || left.unitName.localeCompare(right.unitName));
}

export function normalizeManualPlayRoundPhaseContributionDamage(
  round: ManualPlayRoundReport,
): ManualPlayRoundReport {
  const weightedEntries = round.battles.flatMap((battle) =>
    battle.unitOutcomes
      .map((unit, index) => ({ unit, index }))
      .filter(({ unit }) => unit.side === "raid" && (unit.totalDamage > 0 || unit.phaseContributionDamage > 0))
      .map(({ unit, index }) => ({
        battleUnitId: unit.battleUnitId ?? `${unit.playerId}::${unit.unitId}::${unit.unitName}::${index}`,
        weight: Math.max(unit.phaseContributionDamage, unit.totalDamage, 0),
      })));

  const distributed = distributeIntegerTotalByWeight(
    Math.max(0, Math.round(round.phaseDamageDealt)),
    weightedEntries,
  );

  return {
    ...round,
    battles: round.battles.map((battle) => ({
      ...battle,
      unitOutcomes: battle.unitOutcomes.map((unit, index) => {
        if (unit.side !== "raid") {
          return {
            ...unit,
            phaseContributionDamage: 0,
          };
        }

        const key = unit.battleUnitId ?? `${unit.playerId}::${unit.unitId}::${unit.unitName}::${index}`;
        return {
          ...unit,
          phaseContributionDamage: distributed.get(key) ?? 0,
        };
      }),
    })),
  };
}

function formatRoundCompletionLabel(phaseResult: ManualPlayRoundReport["phaseResult"]): string {
  if (phaseResult === "success") {
    return "ラウンドクリア";
  }

  if (phaseResult === "failed") {
    return "ラウンド失敗";
  }

  return "ラウンド保留";
}

function formatPlayerOutcomeLabel(
  playerConsequence: ManualPlayPlayerConsequence,
  unitOutcomes: ManualPlayUnitBattleOutcome[],
): string {
  if (playerConsequence.playerWipedOut) {
    return "撃破";
  }

  if (unitOutcomes.length > 0) {
    return "生存";
  }

  return playerConsequence.remainingLivesAfter > 0 ? "生存" : "撃破";
}

function resolveRoundResultLines(round: ManualPlayRoundReport): string[] {
  const lines = [`フェーズHP ${round.phaseDamageDealt}/${round.phaseHpTarget}`];
  const raidPlayers = round.playerConsequences.filter((player) => player.role === "raid");
  const allRaidPlayersWipedOut = raidPlayers.length > 0 && raidPlayers.every((player) => player.playerWipedOut);

  if (
    round.phaseResult === "failed"
    && round.phaseDamageDealt >= round.phaseHpTarget
    && allRaidPlayersWipedOut
  ) {
    lines.push("全滅によりラウンド失敗");
    return lines;
  }

  lines.push(formatRoundCompletionLabel(round.phaseResult));
  return lines;
}

function resolveRoundEliminationLabels(
  report: ManualPlayHumanReport,
  round: ManualPlayRoundReport,
): string[] {
  const labels = new Set<string>();

  for (const eliminatedPlayerId of round.eliminations) {
    labels.add(report.playerLabels[eliminatedPlayerId] ?? eliminatedPlayerId);
  }

  for (const player of round.playerConsequences) {
    if (player.eliminatedAfter && player.remainingLivesBefore > 0) {
      labels.add(player.label);
    }
  }

  return [...labels].sort((left, right) => left.localeCompare(right));
}

function isFinalJudgmentRound(report: ManualPlayHumanReport, roundIndex: number): boolean {
  return roundIndex === report.totalRounds && report.totalRounds >= 12;
}

function resolveFinalResultReason(report: ManualPlayHumanReport): string {
  if (report.ranking[0] !== report.bossPlayerId) {
    return `R${report.totalRounds}でボス撃破`;
  }

  const survivingRaidPlayers = report.finalPlayers.filter(
    (player) => player.role === "raid" && !player.eliminated,
  );
  if (survivingRaidPlayers.length === 0) {
    return `R${report.totalRounds}でレイド側全滅`;
  }

  const failedRounds = report.rounds.filter((round) => round.phaseResult === "failed").length;
  if (report.totalRounds < 12 && failedRounds >= 5) {
    return `R${report.totalRounds}で規定回数失敗`;
  }

  if (report.totalRounds >= 12) {
    return `R${report.totalRounds}最終判定でボス勝利`;
  }

  return `R${report.totalRounds}でボス勝利`;
}

export function buildManualPlayHumanReportText(report: ManualPlayHumanReport): string {
  const normalizedReport: ManualPlayHumanReport = {
    ...report,
    rounds: report.rounds.map((round) => normalizeManualPlayRoundPhaseContributionDamage(round)),
  };
  const lines: string[] = [];

  for (const round of normalizedReport.rounds) {
    const primaryBattle = round.battles[0];
    lines.push(`Round ${round.roundIndex}`);

    if (primaryBattle) {
      const bossUnits = primaryBattle.unitOutcomes.filter((unit) => unit.side === "boss");
      const raidUnitsByPlayer = new Map<string, ManualPlayUnitBattleOutcome[]>();

      for (const unit of primaryBattle.unitOutcomes.filter((candidate) => candidate.side === "raid")) {
        const existing = raidUnitsByPlayer.get(unit.playerId) ?? [];
        existing.push(unit);
        raidUnitsByPlayer.set(unit.playerId, existing);
      }

      lines.push("Boss");
      if (typeof round.battleDurationMs === "number" && Number.isFinite(round.battleDurationMs)) {
        lines.push(`バトル時間 ${Math.max(0, Math.round(round.battleDurationMs))}ms`);
      }
      for (const unit of bossUnits) {
        const resolvedUnitLevel = unit.unitLevel ?? 1;
        const subUnitSuffix = unit.subUnitName ? ` サブユニット${unit.subUnitName}` : "";
        lines.push(
          `${unit.unitName} Lv${resolvedUnitLevel}${subUnitSuffix} 与ダメージ${unit.totalDamage} フェーズ貢献ダメージ${unit.phaseContributionDamage} 最終HP${unit.finalHp}`,
        );
      }

      lines.push("");
      lines.push("raid");
      for (const playerConsequence of round.playerConsequences.filter((player) => player.role === "raid")) {
        const unitOutcomes = raidUnitsByPlayer.get(playerConsequence.playerId) ?? [];
        lines.push(`${playerConsequence.label} ${formatPlayerOutcomeLabel(playerConsequence, unitOutcomes)}`);
        for (const unit of unitOutcomes) {
          const resolvedUnitLevel = unit.unitLevel ?? 1;
          const subUnitSuffix = unit.subUnitName ? ` サブユニット${unit.subUnitName}` : "";
          lines.push(
            `${unit.unitName} Lv${resolvedUnitLevel}${subUnitSuffix} 与ダメージ${unit.totalDamage} フェーズ貢献ダメージ${unit.phaseContributionDamage} 最終HP${unit.finalHp}`,
          );
        }
      }
    }

    lines.push("");
    lines.push(`R${round.roundIndex}リザルト`);
    if (isFinalJudgmentRound(normalizedReport, round.roundIndex)) {
      lines.push("最終判定ラウンド");
    } else {
      lines.push(...resolveRoundResultLines(round));
    }
    const eliminationLabels = resolveRoundEliminationLabels(normalizedReport, round);
    if (eliminationLabels.length > 0) {
      lines.push(`脱落: ${eliminationLabels.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("最終リザルト");
  lines.push(resolveFinalResultReason(normalizedReport));
  lines.push(normalizedReport.ranking[0] === normalizedReport.bossPlayerId ? "ボス勝利" : "レイド勝利");

  return lines.join("\n");
}

export function writeManualPlayHumanReport(report: ManualPlayHumanReport, outputPath: string): string {
  const text = buildManualPlayHumanReportText(report);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${text}\n`, "utf8");
  return outputPath;
}
