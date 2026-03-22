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
const RESULT_IMPRINT_BOARD_HEIGHT = 6;

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
      hint: "結果が出たら、次に直す weak position を 1 つ決めます。",
    };
  const caption = buildRoundSummaryCaption({ ranking, sessionId });
  const tip = buildRoundSummaryTip({ ranking, sessionId });
  const survivorSnapshots = toRenderableArray(battleResult?.survivorSnapshots);
  const timelineEndState = toRenderableArray(battleResult?.timelineEndState);
  const timelineEvents = parseBattleTimelineEvents(battleResult?.timelineEvents);
  const survivorMarkup = buildSurvivorSnapshotMarkup(survivorSnapshots);
  const imprintMarkup = buildSharedBoardImprintMarkup({
    survivorSnapshots,
    timelineEndState,
    timelineEvents,
  });

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

function buildSharedBoardImprintMarkup({ survivorSnapshots, timelineEndState, timelineEvents }) {
  const imprintState = resolveResultImprintState({ survivorSnapshots, timelineEndState, timelineEvents });

  if (!imprintState) {
    return `
      <div class="player-card">
        <strong>Shared-board Imprint</strong>
        <div>No surviving units remained on the shared board.</div>
      </div>
    `;
  }

  const cellMarkup = [];
  for (let boardCellIndex = 0; boardCellIndex < imprintState.boardWidth * imprintState.boardHeight; boardCellIndex += 1) {
    const deploymentZone = resolveResultImprintDeploymentZone(boardCellIndex, imprintState.boardWidth, imprintState.boardHeight);
    const snapshot = imprintState.snapshotByBoardCellIndex.get(boardCellIndex) ?? null;
    const classNames = [
      "shared-board-cell",
      deploymentZone === "boss" ? "zone-boss" : "zone-raid",
    ];

    if (snapshot) {
      classNames.push("result-imprint-survivor");
    } else {
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
      <div>Battle end-state on the ${imprintState.boardWidth}x${imprintState.boardHeight} shared board.</div>
      <div class="shared-board-grid result-imprint-grid">${cellMarkup.join("")}</div>
    </div>
  `;
}

function resolveResultImprintState({ survivorSnapshots, timelineEndState, timelineEvents }) {
  const compactEndState = resolveCompactTimelineEndState(timelineEndState);
  if (compactEndState) {
    return compactEndState;
  }

  const timelineState = resolveTimelineEndState(timelineEvents, survivorSnapshots);
  if (timelineState) {
    return timelineState;
  }

  if (survivorSnapshots.length === 0) {
    return null;
  }

  const snapshotByBoardCellIndex = new Map();
  for (const snapshot of survivorSnapshots) {
    const boardCellIndex = normalizeResultBoardCellIndex(Number(snapshot?.sharedBoardCellIndex));
    if (boardCellIndex === null) {
      continue;
    }

    snapshotByBoardCellIndex.set(boardCellIndex, snapshot);
  }

  return {
    boardWidth: RESULT_IMPRINT_BOARD_WIDTH,
    boardHeight: RESULT_IMPRINT_BOARD_HEIGHT,
    snapshotByBoardCellIndex,
  };
}

function resolveCompactTimelineEndState(timelineEndState) {
  if (!Array.isArray(timelineEndState) || timelineEndState.length === 0) {
    return null;
  }

  const snapshotByBoardCellIndex = new Map();

  for (const unit of timelineEndState) {
    const x = Number(unit?.x);
    const y = Number(unit?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      continue;
    }

    const boardCellIndex = y * RESULT_IMPRINT_BOARD_WIDTH + x;
    if (boardCellIndex < 0 || boardCellIndex >= RESULT_IMPRINT_BOARD_WIDTH * RESULT_IMPRINT_BOARD_HEIGHT) {
      continue;
    }

    snapshotByBoardCellIndex.set(boardCellIndex, {
      hp: Math.max(0, Math.round(Number(unit?.currentHp) || 0)),
      maxHp: Math.max(0, Math.round(Number(unit?.maxHp) || 0)),
      displayName: typeof unit?.displayName === "string" && unit.displayName.length > 0
        ? unit.displayName
        : resolveBattleTimelineUnitLabel(unit?.battleUnitId),
      unitType: typeof unit?.unitType === "string" && unit.unitType.length > 0
        ? unit.unitType
        : resolveBattleTimelineUnitLabel(unit?.battleUnitId),
      side: unit?.side === "boss" ? "boss" : "raid",
    });
  }

  if (snapshotByBoardCellIndex.size === 0) {
    return null;
  }

  return {
    boardWidth: RESULT_IMPRINT_BOARD_WIDTH,
    boardHeight: RESULT_IMPRINT_BOARD_HEIGHT,
    snapshotByBoardCellIndex,
  };
}

function resolveTimelineEndState(timelineEvents, survivorSnapshots) {
  if (!Array.isArray(timelineEvents) || timelineEvents.length === 0) {
    return null;
  }

  const battleStartEvent = timelineEvents.find((event) => event?.type === "battleStart");
  if (!battleStartEvent) {
    return null;
  }

  const boardWidth = Number.isInteger(battleStartEvent?.boardConfig?.width)
    ? battleStartEvent.boardConfig.width
    : RESULT_IMPRINT_BOARD_WIDTH;
  const boardHeight = Number.isInteger(battleStartEvent?.boardConfig?.height)
    ? battleStartEvent.boardConfig.height
    : RESULT_IMPRINT_BOARD_HEIGHT;
  const survivorsByUnitId = new Map(survivorSnapshots.map((snapshot) => [snapshot?.unitId, snapshot]));
  const unitsById = new Map();

  for (const unit of battleStartEvent.units ?? []) {
    if (typeof unit?.battleUnitId !== "string" || unit.battleUnitId.length === 0) {
      continue;
    }

    unitsById.set(unit.battleUnitId, {
      battleUnitId: unit.battleUnitId,
      side: unit.side === "boss" ? "boss" : "raid",
      x: Number.isInteger(unit.x) ? unit.x : 0,
      y: Number.isInteger(unit.y) ? unit.y : 0,
      hp: Math.max(0, Math.round(Number(unit.currentHp) || 0)),
      maxHp: Math.max(0, Math.round(Number(unit.maxHp) || 0)),
      alive: true,
    });
  }

  for (const event of timelineEvents) {
    if (!event || event.type === "battleStart" || event.type === "battleEnd" || event.type === "attackStart") {
      continue;
    }

    if (event.type === "move") {
      const unit = unitsById.get(event.battleUnitId);
      if (!unit) {
        continue;
      }

      unit.x = Number.isInteger(event?.to?.x) ? event.to.x : unit.x;
      unit.y = Number.isInteger(event?.to?.y) ? event.to.y : unit.y;
      continue;
    }

    if (event.type === "damageApplied") {
      const unit = unitsById.get(event.targetBattleUnitId);
      if (!unit) {
        continue;
      }

      unit.hp = Math.max(0, Math.round(Number(event.remainingHp) || 0));
      if (unit.hp <= 0) {
        unit.alive = false;
      }
      continue;
    }

    if (event.type === "unitDeath") {
      const unit = unitsById.get(event.battleUnitId);
      if (!unit) {
        continue;
      }

      unit.alive = false;
      unit.hp = 0;
      continue;
    }

    if (event.type === "keyframe") {
      for (const keyframeUnit of event.units ?? []) {
        const unit = unitsById.get(keyframeUnit?.battleUnitId);
        if (!unit) {
          continue;
        }

        unit.x = Number.isInteger(keyframeUnit.x) ? keyframeUnit.x : unit.x;
        unit.y = Number.isInteger(keyframeUnit.y) ? keyframeUnit.y : unit.y;
        unit.hp = Math.max(0, Math.round(Number(keyframeUnit.currentHp) || 0));
        unit.maxHp = Math.max(unit.hp, Math.round(Number(keyframeUnit.maxHp) || 0));
        unit.alive = keyframeUnit.alive === true;
      }
    }
  }

  const snapshotByBoardCellIndex = new Map();
  for (const unit of unitsById.values()) {
    if (unit.alive !== true) {
      continue;
    }

    const boardCellIndex = unit.y * boardWidth + unit.x;
    if (!Number.isInteger(boardCellIndex) || boardCellIndex < 0 || boardCellIndex >= boardWidth * boardHeight) {
      continue;
    }

    const survivorSnapshot = survivorsByUnitId.get(unit.battleUnitId) ?? null;
    snapshotByBoardCellIndex.set(boardCellIndex, {
      hp: survivorSnapshot?.hp ?? unit.hp,
      maxHp: survivorSnapshot?.maxHp ?? unit.maxHp,
      displayName: typeof survivorSnapshot?.displayName === "string" && survivorSnapshot.displayName.length > 0
        ? survivorSnapshot.displayName
        : resolveBattleTimelineUnitLabel(unit.battleUnitId),
      unitType: typeof survivorSnapshot?.unitType === "string" && survivorSnapshot.unitType.length > 0
        ? survivorSnapshot.unitType
        : resolveBattleTimelineUnitLabel(unit.battleUnitId),
      side: unit.side,
    });
  }

  return {
    boardWidth,
    boardHeight,
    snapshotByBoardCellIndex,
  };
}

function normalizeResultBoardCellIndex(sharedBoardCellIndex) {
  if (
    !Number.isInteger(sharedBoardCellIndex) ||
    sharedBoardCellIndex < 0 ||
    sharedBoardCellIndex >= RESULT_IMPRINT_BOARD_WIDTH * RESULT_IMPRINT_BOARD_HEIGHT
  ) {
    return null;
  }

  return sharedBoardCellIndex;
}

function resolveResultImprintDeploymentZone(boardCellIndex, boardWidth, boardHeight) {
  const maxBoardCellIndex = boardWidth * boardHeight - 1;
  if (!Number.isInteger(boardCellIndex) || boardCellIndex < 0 || boardCellIndex > maxBoardCellIndex) {
    return "raid";
  }

  const y = Math.floor(boardCellIndex / boardWidth);
  return y < Math.floor(boardHeight / 2) ? "boss" : "raid";
}

function resolveBattleTimelineUnitLabel(battleUnitId) {
  if (typeof battleUnitId !== "string" || battleUnitId.length === 0) {
    return "Unknown unit";
  }

  const tokens = battleUnitId.split("-");
  return tokens.find((token) => ["vanguard", "ranger", "mage", "assassin"].includes(token)) ?? shortPlayerId(battleUnitId);
}

function parseBattleTimelineEvents(timelineEvents) {
  const parsedEvents = [];

  for (const rawEvent of toRenderableArray(timelineEvents)) {
    if (rawEvent && typeof rawEvent === "object") {
      parsedEvents.push(rawEvent);
      continue;
    }

    if (typeof rawEvent !== "string" || rawEvent.length === 0) {
      continue;
    }

    try {
      const parsedEvent = JSON.parse(rawEvent);
      if (parsedEvent && typeof parsedEvent === "object") {
        parsedEvents.push(parsedEvent);
      }
    } catch {
      // Ignore malformed timeline payloads and fall back to survivor snapshots.
    }
  }

  return parsedEvents;
}
