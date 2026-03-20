import {
  buildBattleResultCopy,
  buildFinalJudgmentCopy,
  buildLobbyRoleCopy,
  buildPhaseHpCopy,
  buildReadyHint,
  buildRoundSummaryCaption,
  buildRoundSummaryTip,
} from "./ui/player-facing-copy.js";
import { mapEntries, readPhase, shortPlayerId } from "./utils/pure-utils.js";

const UNIT_ICONS = {
  vanguard: "🛡️",
  ranger: "🏹",
  mage: "✨",
  assassin: "🗡️",
};

export function renderPlayerLobbySummary({ participantSummaryElement, state }) {
  if (!(participantSummaryElement instanceof HTMLElement)) {
    return;
  }

  const players = mapEntries(state?.players).map(([, player]) => player);
  const totalPlayers = players.length;
  const readyPlayers = players.filter((player) => player?.ready === true).length;

  participantSummaryElement.textContent = `${readyPlayers} / ${totalPlayers} ready。${totalPlayers > 0 ? "進行役の開始待ちです。" : "プレイヤー接続待ちです。"}`;
}

export function renderPlayerLobbyPreferenceSummary({ preferenceCopyElement, state, player }) {
  if (!(preferenceCopyElement instanceof HTMLElement)) {
    return;
  }

  const lobbyStage = typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference";

  if (lobbyStage !== "preference") {
    preferenceCopyElement.textContent = "boss 希望の集計は完了しました。role selection に進みます。";
    return;
  }

  preferenceCopyElement.textContent = player?.wantsBoss === true
    ? "いまは boss 希望です。変更するなら OFF を押してください。"
    : "boss を担当したいときだけ ON を押してください。";
}

export function renderPlayerSelectionSummary({
  roleSummaryElement,
  roleOptionsElement,
  state,
  player,
  sessionId,
}) {
  if (roleSummaryElement instanceof HTMLElement) {
    const resolvedRole = typeof player?.role === "string" && player.role.length > 0
      ? player.role
      : "unassigned";
    const bossPlayerId = typeof state?.bossPlayerId === "string" ? state.bossPlayerId : "";
    const isBossPlayer = bossPlayerId === sessionId;

    roleSummaryElement.textContent = `role: ${isBossPlayer ? "boss" : resolvedRole} / lobby stage: ${typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference"}`;
  }

  if (roleOptionsElement instanceof HTMLElement) {
    const wantsBossPlayers = mapEntries(state?.players)
      .filter(([, currentPlayer]) => currentPlayer?.wantsBoss === true)
      .map(([playerId]) => shortPlayerId(playerId));

    const selectionCopy = buildLobbyRoleCopy({
      lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
      isBossPlayer: player?.role === "boss" || state?.bossPlayerId === sessionId,
      heroSelected: typeof player?.selectedHeroId === "string" && player.selectedHeroId.length > 0,
      bossSelected: typeof player?.selectedBossId === "string" && player.selectedBossId.length > 0,
    });

    roleOptionsElement.textContent = `${selectionCopy} / ${wantsBossPlayers.length > 0 ? `boss希望: ${wantsBossPlayers.join(", ")}` : "boss希望者なし"}`;
  }
}

export function renderPlayerPrepSummary({
  boardCopyElement,
  shopCopyElement,
  benchCopyElement,
  boardElement,
  shopElement,
  shopSlotElements = [],
  benchElement,
  benchSlotElements = [],
  readyElement,
  readyCopyElement,
  boardCellElements = [],
  state,
  player,
  sessionId = "",
  currentPhase,
  selectedBenchIndex,
  sharedBoardConnected = false,
}) {
  if (boardCopyElement instanceof HTMLElement && !sharedBoardConnected) {
    boardCopyElement.textContent = selectedBenchIndex === null
      ? "共有ボードの中央 4x2 が playable lane です。bench を選んで open lane へ配置します。"
      : `Bench ${selectedBenchIndex + 1} を選択中です。open lane をクリックして配置します。`;
  }

  const offers = toRenderableArray(player?.shopOffers);
  if (shopCopyElement instanceof HTMLElement) {
    const gold = Number(player?.gold ?? 0);
    shopCopyElement.textContent = offers.length > 0
      ? `所持 ${gold}G。shop を押して bench へ購入します。`
      : `所持 ${gold}G。shop offer の更新待ちです。`;
  }

  shopSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const offer = offers[index];
    const unitType = offer?.unitType ?? null;
    const cost = Number(offer?.cost ?? 0);
    const displayName = typeof offer?.displayName === "string" && offer.displayName.length > 0
      ? offer.displayName
      : unitType;
    button.disabled = !offer || currentPhase !== "Prep";
    button.classList.toggle("selected", false);
    button.textContent = offer ? `${UNIT_ICONS[unitType] ?? "❓"} ${displayName} / ${cost}G` : `Shop ${index + 1}`;
  });

  const benchUnits = toRenderableArray(player?.benchUnits);
  if (benchCopyElement instanceof HTMLElement) {
    benchCopyElement.textContent = selectedBenchIndex === null
      ? `${benchUnits.length} / 9 on bench。配置したい unit を選びます。`
      : `${benchUnits.length} / 9 on bench。Bench ${selectedBenchIndex + 1} を選択中です。`;
  }

  benchSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const unitText = formatBenchUnitLabel(benchUnits[index]);
    button.disabled = !unitText || currentPhase !== "Prep";
    button.classList.toggle("selected", selectedBenchIndex === index);
    button.textContent = unitText ?? `Bench ${index + 1}`;
  });

  boardCellElements.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.disabled = currentPhase !== "Prep";
  });

  if (readyCopyElement instanceof HTMLElement) {
    const players = mapEntries(state?.players).map(([, currentPlayer]) => currentPlayer);
    const readyCount = players.filter((currentPlayer) => currentPlayer?.ready === true).length;
    readyCopyElement.textContent = buildReadyHint({
      phase: currentPhase,
      isReady: player?.ready === true,
      heroEnabled: state?.featureFlagsEnableHeroSystem === true,
      heroSelected: typeof player?.selectedHeroId === "string" && player.selectedHeroId.length > 0,
      bossRoleSelectionEnabled: state?.featureFlagsEnableBossExclusiveShop === true,
      lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
      isBossPlayer: state?.bossPlayerId === sessionId || player?.role === "boss",
      bossSelected: typeof player?.selectedBossId === "string" && player.selectedBossId.length > 0,
      readyCount,
      totalCount: players.length,
    });
  }
}

export function renderPlayerResultSummary({
  resultSurfaceElement,
  state,
  player,
  phaseHpProgress = null,
  sessionId = "",
}) {
  if (!(resultSurfaceElement instanceof HTMLElement)) {
    return;
  }

  const battleResult = player?.lastBattleResult ?? null;
  const phase = readPhase(state?.phase);
  const phaseHpCopy = buildPhaseHpCopy(phaseHpProgress);
  const rankingEntries = toRenderableArray(state?.ranking);
  const raidPlayerIds = toRenderableArray(state?.raidPlayerIds);
  const judgmentCopy = buildFinalJudgmentCopy({
    phase,
    ranking: rankingEntries,
    bossPlayerId: typeof state?.bossPlayerId === "string" ? state.bossPlayerId : "",
    raidPlayerIds,
    roundIndex: Number(state?.roundIndex),
  });
  const ranking = buildRoundDamageRanking(state?.players);
  const resultCopy = battleResult
    ? buildBattleResultCopy({
      isVictory: battleResult.won === true,
      battleResult,
    })
    : {
      title: "Battle result pending",
      subtitle: "戦闘結果の到着待ちです。",
      hint: "結果が出たら、次に直す lane を 1 つ決めます。",
    };
  const caption = buildRoundSummaryCaption({ ranking, sessionId });
  const tip = buildRoundSummaryTip({ ranking, sessionId });

  resultSurfaceElement.innerHTML = `
    <div class="player-card">
      <strong>Final Judgment</strong>
      <div>${judgmentCopy}</div>
      <div>${phase}</div>
    </div>
    <div class="player-card">
      <strong>Phase HP</strong>
      <div>${phaseHpCopy.valueText}</div>
      <div>${phaseHpCopy.resultText}</div>
      <div>${phaseHpCopy.helperText}</div>
    </div>
    <div class="player-card">
      <strong>${resultCopy.title}</strong>
      <div>${resultCopy.subtitle}</div>
      <div>${resultCopy.hint}</div>
    </div>
    <div class="player-card">
      <strong>Round Read</strong>
      <div>${caption}</div>
      <div>${tip}</div>
    </div>
  `;
}

function buildRoundDamageRanking(players) {
  const ranking = [];

  for (const [playerId, player] of mapEntries(players)) {
    const damageValue = Number(player?.lastBattleResult?.damageDealt);
    if (!Number.isFinite(damageValue)) {
      continue;
    }

    ranking.push({
      playerId,
      damageDealt: Math.max(0, Math.round(damageValue)),
    });
  }

  ranking.sort((left, right) => right.damageDealt - left.damageDealt);
  return ranking.slice(0, 3);
}

function formatBenchUnitLabel(unit) {
  if (!unit) {
    return null;
  }

  if (typeof unit === "string") {
    const [unitType] = unit.split("-");
    return unitType || unit;
  }

  if (typeof unit?.displayName === "string" && unit.displayName.length > 0) {
    return unit.displayName;
  }

  if (typeof unit?.unitType === "string" && unit.unitType.length > 0) {
    return unit.unitType;
  }

  return String(unit);
}

function toRenderableArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value[Symbol.iterator] !== "function") {
    return [];
  }

  return Array.from(value);
}
