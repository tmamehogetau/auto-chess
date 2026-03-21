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

const RESULT_IMPRINT_BOARD_WIDTH = 6;
const RESULT_IMPRINT_BOARD_HEIGHT = 4;
const RESULT_IMPRINT_COMBAT_WIDTH = RESULT_IMPRINT_BOARD_WIDTH - 2;
const RESULT_IMPRINT_COMBAT_HEIGHT = RESULT_IMPRINT_BOARD_HEIGHT - 2;

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
  canSellBench = false,
  canSellBoard = false,
  canReturnBoard = false,
  benchSellButton,
  boardReturnButton,
  boardSellButton,
  sharedBoardConnected = false,
}) {
  if (boardCopyElement instanceof HTMLElement && !sharedBoardConnected) {
    boardCopyElement.textContent = selectedBenchIndex === null
      ? "共有ボードは 6x6 です。bench を選んで、下側の highlighted raid cells へ配置します。置いた unit は選んで再配置や売却ができます。"
      : `Bench ${selectedBenchIndex + 1} を選択中です。highlighted raid cells をクリックして配置するか、Sell で売却します。`;
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
  const benchDisplayNames = toRenderableArray(player?.benchDisplayNames);
  if (benchCopyElement instanceof HTMLElement) {
    benchCopyElement.textContent = selectedBenchIndex === null
      ? `${benchUnits.length} / 9 on bench。配置か売却したい unit を選びます。`
      : `${benchUnits.length} / 9 on bench。Bench ${selectedBenchIndex + 1} を選択中です。`;
  }

  benchSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const unitText = formatBenchUnitLabel(benchUnits[index], benchDisplayNames[index]);
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

  if (benchSellButton instanceof HTMLButtonElement) {
    benchSellButton.disabled = currentPhase !== "Prep" || !canSellBench;
  }

  if (boardSellButton instanceof HTMLButtonElement) {
    boardSellButton.disabled = currentPhase !== "Prep" || !canSellBoard;
  }

  if (boardReturnButton instanceof HTMLButtonElement) {
    boardReturnButton.disabled = currentPhase !== "Prep" || !canReturnBoard;
  }

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
  const survivorSnapshots = toRenderableArray(battleResult?.survivorSnapshots);
  const survivorMarkup = buildSurvivorSnapshotMarkup(survivorSnapshots);
  const imprintMarkup = buildSharedBoardImprintMarkup(survivorSnapshots);

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
    ${imprintMarkup}
    ${survivorMarkup}
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

function formatBenchUnitLabel(unit, displayName) {
  if (!unit) {
    return null;
  }

  if (typeof displayName === "string" && displayName.length > 0) {
    return displayName;
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

function buildSurvivorSnapshotMarkup(survivorSnapshots) {
  if (survivorSnapshots.length === 0) {
    return "";
  }

  const survivorRows = survivorSnapshots.map((snapshot) => {
    const currentHp = Math.max(0, Math.round(Number(snapshot?.hp) || 0));
    const maxHp = Math.max(currentHp, Math.round(Number(snapshot?.maxHp) || 0));
    const displayName = typeof snapshot?.displayName === "string" && snapshot.displayName.length > 0
      ? snapshot.displayName
      : typeof snapshot?.unitType === "string" && snapshot.unitType.length > 0
        ? snapshot.unitType
        : "Unknown unit";
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

    return `
      <div class="player-survivor-row">
        <div class="player-survivor-copy">
          <span>${displayName}</span>
          <span>${currentHp} / ${maxHp}</span>
        </div>
        <div class="player-survivor-bar">
          <div class="player-survivor-bar-fill" style="width: ${hpPercent}%"></div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="player-card">
      <strong>Surviving Units</strong>
      <div>戦闘後に立っていた unit の残HPです。</div>
      <div class="player-survivor-list">${survivorRows}</div>
    </div>
  `;
}

function buildSharedBoardImprintMarkup(survivorSnapshots) {
  if (survivorSnapshots.length === 0) {
    return `
      <div class="player-card">
        <strong>Shared-board Imprint</strong>
        <div>No surviving units remained in your center lane.</div>
      </div>
    `;
  }

  const snapshotByBoardCellIndex = new Map();
  for (const snapshot of survivorSnapshots) {
    const boardCellIndex = combatCellToResultBoardIndex(Number(snapshot?.combatCell));
    if (boardCellIndex === null) {
      continue;
    }

    snapshotByBoardCellIndex.set(boardCellIndex, snapshot);
  }

  const cellMarkup = [];
  for (let boardCellIndex = 0; boardCellIndex < RESULT_IMPRINT_BOARD_WIDTH * RESULT_IMPRINT_BOARD_HEIGHT; boardCellIndex += 1) {
    const playableLaneZone = resolveResultImprintLaneZone(boardCellIndex);
    const snapshot = snapshotByBoardCellIndex.get(boardCellIndex) ?? null;
    const classNames = [
      "shared-board-cell",
      playableLaneZone === "outside" ? "outside-playable" : "playable-lane",
      boardCellIndex < RESULT_IMPRINT_BOARD_WIDTH * 2 ? "zone-boss" : "zone-raid",
    ];

    if (playableLaneZone === "boss") {
      classNames.push("playable-boss-lane");
    }

    if (playableLaneZone === "raid") {
      classNames.push("playable-raid-lane");
    }

    if (snapshot) {
      classNames.push("result-imprint-survivor");
    } else if (playableLaneZone !== "outside") {
      classNames.push("result-imprint-empty");
    }

    if (!snapshot) {
      cellMarkup.push(`
        <div
          class="${classNames.join(" ")}"
          data-result-imprint-cell="${boardCellIndex}"
        ></div>
      `);
      continue;
    }

    const currentHp = Math.max(0, Math.round(Number(snapshot?.hp) || 0));
    const maxHp = Math.max(currentHp, Math.round(Number(snapshot?.maxHp) || 0));
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
    const displayName = typeof snapshot?.displayName === "string" && snapshot.displayName.length > 0
      ? snapshot.displayName
      : typeof snapshot?.unitType === "string" && snapshot.unitType.length > 0
        ? snapshot.unitType
        : "Unknown unit";

    cellMarkup.push(`
      <div
        class="${classNames.join(" ")}"
        data-result-imprint-cell="${boardCellIndex}"
      >
        <div class="shared-board-unit result-imprint-unit">
          <span class="shared-board-display-name">${displayName}</span>
          <span class="result-imprint-hp-copy">${currentHp} / ${maxHp}</span>
          <div class="result-imprint-hp-bar">
            <div class="result-imprint-hp-bar-fill" style="width: ${hpPercent}%"></div>
          </div>
        </div>
      </div>
    `);
  }

  return `
    <div class="player-card">
      <strong>Shared-board Imprint</strong>
      <div>Only surviving units stay stamped onto the center lane.</div>
      <div class="shared-board-grid result-imprint-grid">${cellMarkup.join("")}</div>
    </div>
  `;
}

function combatCellToResultBoardIndex(combatCell) {
  if (
    !Number.isInteger(combatCell) ||
    combatCell < 0 ||
    combatCell >= RESULT_IMPRINT_COMBAT_WIDTH * RESULT_IMPRINT_COMBAT_HEIGHT
  ) {
    return null;
  }

  const combatX = combatCell % RESULT_IMPRINT_COMBAT_WIDTH;
  const combatY = Math.floor(combatCell / RESULT_IMPRINT_COMBAT_WIDTH);
  return (combatY + 1) * RESULT_IMPRINT_BOARD_WIDTH + combatX + 1;
}

function resolveResultImprintLaneZone(boardCellIndex) {
  const maxBoardCellIndex = RESULT_IMPRINT_BOARD_WIDTH * RESULT_IMPRINT_BOARD_HEIGHT - 1;
  if (!Number.isInteger(boardCellIndex) || boardCellIndex < 0 || boardCellIndex > maxBoardCellIndex) {
    return "outside";
  }

  const x = boardCellIndex % RESULT_IMPRINT_BOARD_WIDTH;
  const y = Math.floor(boardCellIndex / RESULT_IMPRINT_BOARD_WIDTH);
  const combatX = x - 1;
  const combatY = y - 1;

  if (
    combatX < 0 ||
    combatY < 0 ||
    combatX >= RESULT_IMPRINT_COMBAT_WIDTH ||
    combatY >= RESULT_IMPRINT_COMBAT_HEIGHT
  ) {
    return "outside";
  }

  return combatY === 0 ? "boss" : "raid";
}
