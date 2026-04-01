import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES, createGameRoomSession } from "./game-room-session.js";
import {
  renderPlayerLobbySummary,
  renderPlayerLobbyPreferenceSummary,
  renderPlayerPrepSummary,
  renderPlayerResultSummary,
  renderPlayerSelectionSummary,
} from "./player-surface-renderers.js";
import {
  buildDeadlineSummary,
  canUseBenchAction,
  canUseBoardAction,
  canUseShopAction,
  resolvePlayerFacingPhase,
} from "./player-prep-phase.js";
import {
  connectSharedBoard,
  getSelectedSharedUnitId,
  getSharedBoardState,
  handleSharedCellClick,
  initSharedBoardClient,
  leaveSharedBoardRoom,
  setSharedBoardGamePlayerId,
  setSharedBoardRoomId,
} from "./shared-board-client.js";
import { buildCommandResultCopy, buildReadyHint } from "./ui/player-facing-copy.js";
import { mapEntries, mapGet } from "./utils/pure-utils.js";

const playerShell = document.querySelector("[data-player-shell]");
const statusCopy = document.querySelector("[data-player-status-copy]");
const connectButton = document.querySelector("[data-player-connect-btn]");
const roomCodeInput = document.querySelector("[data-player-room-code-input]");
const hudRoundPhaseElement = document.querySelector("[data-player-hud-round-phase]");
const hudTimerElement = document.querySelector("[data-player-hud-timer]");
const hudSpellElement = document.querySelector("[data-player-hud-spell]");
const hudFlowElement = document.querySelector("[data-player-hud-flow]");
const roomCopyElement = document.querySelector("[data-player-room-copy]");
const deadlineCopyElement = document.querySelector("[data-player-deadline-copy]");
const participantSummaryElement = document.querySelector("[data-player-participant-summary]");
const participantCopyElement = document.querySelector("[data-player-participant-copy]");
const preferenceCopyElement = document.querySelector("[data-player-preference-copy]");
const roleSummaryElement = document.querySelector("[data-player-role-summary]");
const roleCopyElement = document.querySelector("[data-player-role-copy]");
const roleOptionsElement = document.querySelector("[data-player-role-options]");
const roleOptionsCopyElement = document.querySelector("[data-player-role-options-copy]");
const bossPreferenceOnButton = document.querySelector("[data-player-boss-pref-on]");
const bossPreferenceOffButton = document.querySelector("[data-player-boss-pref-off]");
const heroOptionsElement = document.querySelector("[data-player-hero-options]");
const bossOptionsElement = document.querySelector("[data-player-boss-options]");
const boardElement = document.querySelector("[data-player-shared-board-grid]");
const boardGridElement = document.querySelector("[data-player-board-cells]");
const boardCopyElement = document.querySelector("[data-player-board-copy]");
const sharedCursorListElement = document.querySelector("[data-player-shared-cursor-list]");
const purchaseSurfaceElement = document.querySelector("[data-player-purchase-surface]");
const deploySurfaceElement = document.querySelector("[data-player-deploy-surface]");
const shopElement = document.querySelector("[data-player-unit-shop]");
const shopCopyElement = document.querySelector("[data-player-shop-copy]");
const heroUpgradeCopyElement = document.querySelector("[data-player-hero-upgrade-copy]");
const refreshCopyElement = document.querySelector("[data-player-refresh-copy]");
const shopSlotElements = Array.from(document.querySelectorAll("[data-player-shop-slot]"));
const shopRefreshButton = document.querySelector("[data-player-shop-refresh-button]");
const buyXpButton = document.querySelector("[data-player-buy-xp-button]");
const bossShopElement = document.querySelector("[data-player-boss-shop]");
const bossShopCopyElement = document.querySelector("[data-player-boss-shop-copy]");
const bossShopSlotElements = Array.from(document.querySelectorAll("[data-player-boss-shop-slot]"));
const specialUnitCopyElement = document.querySelector("[data-player-special-unit-copy]");
const playerStatsCopyElement = document.querySelector("[data-player-player-stats-copy]");
const spellCopyElement = document.querySelector("[data-player-spell-copy]");
const synergyCopyElement = document.querySelector("[data-player-synergy-copy]");
const benchElement = document.querySelector("[data-player-bench]");
const benchCopyElement = document.querySelector("[data-player-bench-copy]");
const benchSlotElements = Array.from(document.querySelectorAll("[data-player-bench-slot]"));
const benchSellButton = document.querySelector("[data-player-bench-sell-button]");
const prepReadyElement = document.querySelector("[data-player-ready-btn]");
const prepReadyCopyElement = document.querySelector("[data-player-ready-copy]");
const lobbyReadyElement = document.querySelector("[data-player-lobby-ready-btn]");
const lobbyReadyCopyElement = document.querySelector("[data-player-lobby-ready-copy]");
const phaseNotesCopyElements = Array.from(document.querySelectorAll("[data-player-phase-notes-copy]"));
const readyButtons = Array.from(
  document.querySelectorAll("[data-player-ready-button], [data-player-lobby-ready-button]"),
);
const boardReturnButton = document.querySelector("[data-player-board-return-button]");
const boardSellButton = document.querySelector("[data-player-board-sell-button]");
const battleStartBannerElement = document.querySelector("[data-player-battle-start-banner]");
const battleStartKickerElement = document.querySelector("[data-player-battle-start-kicker]");
const battleStartRoundElement = document.querySelector("[data-player-battle-start-round]");
const resultSurfaceElement = document.querySelector("[data-player-result-surface]");
const detailCardElement = document.querySelector("[data-player-detail-card]");
const allyRailElement = document.querySelector("[data-player-ally-rail]");
const phaseSections = new Map([
  ["lobby", document.querySelector('[data-player-phase="lobby"]')],
  ["selection", document.querySelector('[data-player-phase="selection"]')],
  ["prep", document.querySelector('[data-player-phase="prep"]')],
  ["result", document.querySelector('[data-player-phase="result"]')],
]);

const gameRoomSession = createGameRoomSession();
let latestPlayer = null;
let latestState = null;
let latestRoundState = null;
let latestPhaseHpProgress = null;
let latestSharedBoardRoomId = "";
let selectedHeroId = null;
let selectedBossId = "remilia";
let selectedBenchIndex = null;
let cmdSeqCounter = 0;
let latestRawPhase = "Waiting";
let latestPlayerFacingPhase = "lobby";
let battleStartSweepTimeoutId = null;
let latestPrepHoverDetail = null;
let deadlineRefreshIntervalId = null;

function rememberSharedBoardRoomId(roomId) {
  const normalizedRoomId = typeof roomId === "string" ? roomId.trim() : "";
  if (normalizedRoomId.length === 0) {
    // Keep the last non-empty room id so reconnect can fall back to it.
    return;
  }

  latestSharedBoardRoomId = normalizedRoomId;
  setSharedBoardRoomId(normalizedRoomId);
}

const PLAYER_BATTLE_START_SWEEP_MS = 900;
const PLAYER_DEADLINE_REFRESH_INTERVAL_MS = 250;

const HERO_OPTIONS = [
  { id: "reimu", name: "霊夢", role: "balance" },
  { id: "marisa", name: "魔理沙", role: "dps" },
  { id: "okina", name: "隠岐奈", role: "support" },
  { id: "keiki", name: "袿姫", role: "tank" },
  { id: "jyoon", name: "女苑", role: "economy" },
];

const BOSS_OPTIONS = [
  { id: "remilia", name: "レミリア", roleCopy: "紅魔館の主" },
];

initSharedBoardClient(
  {
    gridElement: boardGridElement instanceof HTMLElement ? boardGridElement : null,
    cursorListElement: sharedCursorListElement instanceof HTMLElement ? sharedCursorListElement : null,
    placementGuideElement: boardCopyElement instanceof HTMLElement ? boardCopyElement : null,
  },
  {
    gamePlayerId: "",
    onLog: () => {},
    showMessage: (message) => {
      if (statusCopy instanceof HTMLElement) {
        statusCopy.textContent = message;
      }
    },
    isTouhouRosterEnabled: () => latestState?.featureFlagsEnableTouhouRoster === true,
    isSubUnitSystemEnabled: () => latestState?.featureFlagsEnableSubUnitSystem === true,
    getSelectedHeroId: () => latestPlayer?.selectedHeroId ?? selectedHeroId ?? "",
    getPlayerBoardSubUnits: () => Array.isArray(latestPlayer?.boardSubUnits)
      ? latestPlayer.boardSubUnits
      : latestPlayer?.boardSubUnits && typeof latestPlayer.boardSubUnits[Symbol.iterator] === "function"
        ? Array.from(latestPlayer.boardSubUnits)
        : [],
    getPlayerFacingPhase: () => latestPlayerFacingPhase,
    onSubSlotActivate: ({ cellIndex }) => {
      handlePlayerSharedSubSlotClick(cellIndex);
    },
    onHoverDetailChange: (detail) => {
      setPrepHoverDetail(detail);
    },
    getPlayerPlacementSide: () => {
      const sessionId = gameRoomSession.getRoom()?.sessionId ?? "";
      return latestState?.bossPlayerId === sessionId || latestPlayer?.role === "boss"
        ? "boss"
        : "raid";
    },
  },
);

gameRoomSession.onConnectionState((connectionState) => {
  if (!(statusCopy instanceof HTMLElement)) {
    return;
  }

  if (connectionState === "connecting") {
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = true;
      connectButton.textContent = "Joining...";
    }
    statusCopy.textContent = "ルームへ接続しています。進行役の案内が出るまで少し待ってください。";
    return;
  }

  if (connectionState === "connected") {
    if (connectButton instanceof HTMLButtonElement) {
      connectButton.disabled = true;
      connectButton.textContent = "Connected";
    }
    statusCopy.textContent = "接続完了。現在の phase に合わせて player-facing surface を切り替えます。";
    renderPlayerHeaderTruth();
    updateReadyButton(latestPlayer);
    updateReadyCopy(latestState, latestPlayer);
    syncDeadlineRefreshLoop();
    return;
  }

  syncPlayerConnectButton();
  latestPlayer = null;
  latestState = null;
  latestPhaseHpProgress = null;
  latestRoundState = null;
  latestSharedBoardRoomId = "";
  latestRawPhase = "Waiting";
  latestPlayerFacingPhase = "lobby";
  latestPrepHoverDetail = null;
  selectedBenchIndex = null;
  clearPlayerBattleStartSweep();
  stopDeadlineRefreshLoop();
  leaveSharedBoardRoom();
  setSharedBoardRoomId("");
  statusCopy.textContent = "進行役がルームを準備したら、この画面の player flow が始まります。";
  showPlayerPhase("lobby");
  renderPlayerHeaderTruth();
  renderPlayerPrepSurface();
  updateReadyButton(null);
  updateReadyCopy(null, null);
});

gameRoomSession.onStateChange((state) => {
  const previousPhase = latestRawPhase;
  latestRawPhase = typeof state?.phase === "string" ? state.phase : "Waiting";
  latestPlayerFacingPhase = resolvePlayerFacingPhase(state, latestRoundState);
  const nextView = resolvePlayerPhaseView(state, latestRoundState);
  const player = mapGet(state?.players, gameRoomSession.getRoom()?.sessionId ?? "") ?? null;
  latestState = state;
  latestPlayer = player;
  if (!Number.isInteger(selectedBenchIndex) || selectedBenchIndex < 0 || selectedBenchIndex >= Number(player?.benchUnits?.length ?? 0)) {
    selectedBenchIndex = null;
  }
  if (typeof state?.sharedBoardRoomId === "string" && state.sharedBoardRoomId.length > 0) {
    rememberSharedBoardRoomId(state.sharedBoardRoomId);
  }
  showPlayerPhase(nextView);
  syncPlayerBattleStartSweep(previousPhase, state);
  renderPlayerHeaderTruth();
  renderPlayerLobbySummary({ participantSummaryElement: participantCopyElement, state });
  renderPlayerLobbyPreferenceSummary({
    preferenceCopyElement,
    state,
    player,
  });
  renderPlayerSelectionSummary({
    roleSummaryElement: roleCopyElement,
    roleOptionsElement: roleOptionsCopyElement,
    state,
    player,
    sessionId: gameRoomSession.getRoom()?.sessionId ?? "",
  });
  renderPlayerPrepSurface();
  renderPlayerResultSummary({
    resultSurfaceElement,
    state,
    player,
    phaseHpProgress: latestPhaseHpProgress,
    sessionId: gameRoomSession.getRoom()?.sessionId ?? "",
  });
  renderRoleSelectionActions(state, player);

  if (!(statusCopy instanceof HTMLElement)) {
    return;
  }

  statusCopy.textContent = buildPlayerPhaseCopy(latestPlayerFacingPhase);
  updateReadyButton(player);
  updateReadyCopy(state, player);
  syncDeadlineRefreshLoop();
});

gameRoomSession.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message) => {
  latestRoundState = message;
  latestPlayerFacingPhase = resolvePlayerFacingPhase(latestState, message);
  const sharedBoardRoomId = typeof message?.sharedBoardRoomId === "string"
    ? message.sharedBoardRoomId
    : "";
  latestPhaseHpProgress = resolvePhaseHpProgress(message);
  if (sharedBoardRoomId.length > 0) {
    rememberSharedBoardRoomId(sharedBoardRoomId);
  }
  renderPlayerHeaderTruth();
  renderPlayerResultSummary({
    resultSurfaceElement,
    state: latestState,
    player: latestPlayer,
    phaseHpProgress: latestPhaseHpProgress,
    sessionId: gameRoomSession.getRoom()?.sessionId ?? "",
  });
  renderPlayerPrepSurface();
  if (statusCopy instanceof HTMLElement) {
    statusCopy.textContent = buildPlayerPhaseCopy(latestPlayerFacingPhase);
  }
  updateReadyCopy(latestState, latestPlayer);
  void syncSharedBoardConnection();
  syncDeadlineRefreshLoop();
});

gameRoomSession.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (message) => {
  if (!(statusCopy instanceof HTMLElement)) {
    return;
  }

  statusCopy.textContent = buildCommandResultCopy({
    accepted: message?.accepted,
    code: message?.code,
    hint: message?.hint,
  });
});

if (playerShell instanceof HTMLElement) {
  playerShell.dataset.playerAppReady = "true";
}

connectButton?.addEventListener("click", () => {
  void connectPlayerSession();
});

roomCodeInput?.addEventListener("input", () => {
  syncPlayerConnectButton();
});

bossPreferenceOnButton?.addEventListener("click", () => {
  gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
});

bossPreferenceOffButton?.addEventListener("click", () => {
  gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: false });
});

readyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextReady = !(latestPlayer?.ready === true);
    gameRoomSession.send(CLIENT_MESSAGE_TYPES.READY, { ready: nextReady });
  });
});

shopSlotElements.forEach((button, index) => {
  button.addEventListener("click", () => {
    handlePlayerShopBuy(index);
  });
});

bossShopSlotElements.forEach((button, index) => {
  button.addEventListener("click", () => {
    handlePlayerBossShopBuy(index);
  });
});

shopRefreshButton?.addEventListener("click", () => {
  handlePlayerShopRefresh();
});

buyXpButton?.addEventListener("click", () => {
  handlePlayerBuyXp();
});

benchSlotElements.forEach((button, index) => {
  button.addEventListener("click", () => {
    handlePlayerBenchSelect(index);
  });
});

benchSellButton?.addEventListener("click", () => {
  handlePlayerBenchSell();
});

boardSellButton?.addEventListener("click", () => {
  handlePlayerBoardSell();
});

boardReturnButton?.addEventListener("click", () => {
  handlePlayerBoardReturn();
});

boardGridElement?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const isSubSlotTarget = target.closest("[data-shared-board-sub-slot]");
  const cell = target.closest("[data-cell-index], [data-player-shared-cell]");
  const cellIndex = Number.parseInt(
    cell?.getAttribute("data-cell-index") ?? cell?.getAttribute("data-player-shared-cell") ?? "",
    10,
  );

  if (selectedBenchIndex !== null && !isSubSlotTarget) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (isSubSlotTarget) {
    return;
  }

  handlePlayerSharedCellClick(cellIndex);
}, true);

hydrateRequestedRoomCodeInput();
syncPlayerConnectButton();

if (getSearchParam("autoconnect") === "1" && resolveRequestedRoomCode().length > 0) {
  void connectPlayerSession();
}

function resolvePlayerPhaseView(state) {
  const playerFacingPhase = resolvePlayerFacingPhase(state, latestRoundState);
  if (playerFacingPhase === "result") {
    return "result";
  }

  if (playerFacingPhase === "purchase" || playerFacingPhase === "deploy" || playerFacingPhase === "battle") {
    return "prep";
  }

  const phase = typeof state?.phase === "string" ? state.phase : "Waiting";
  const lobbyStage = typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference";

  if (phase === "Waiting" && lobbyStage === "preference") {
    return "lobby";
  }

  if (phase === "Waiting" && lobbyStage === "selection") {
    return "selection";
  }

  if (phase === "Prep") {
    return "prep";
  }

  if (phase === "Battle" || phase === "Settle" || phase === "Elimination" || phase === "End") {
    return "result";
  }

  return "lobby";
}

function showPlayerPhase(activePhase) {
  for (const [phaseName, element] of phaseSections.entries()) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const isActive = phaseName === activePhase;
    element.hidden = !isActive;
    element.dataset.phaseActive = isActive ? "true" : "false";
  }
}

function syncPlayerBattleStartSweep(previousPhase, state) {
  const nextPhase = typeof state?.phase === "string" ? state.phase : "Waiting";

  if (nextPhase === "Battle" && previousPhase !== "Battle") {
    triggerPlayerBattleStartSweep(state);
    return;
  }

  if (nextPhase !== "Battle") {
    clearPlayerBattleStartSweep();
  }
}

function triggerPlayerBattleStartSweep(state) {
  const prepPhaseElement = phaseSections.get("prep");
  const roundIndex = Number.isInteger(state?.roundIndex) ? state.roundIndex : -1;
  const roundLabel = roundIndex >= 0 ? `Round ${roundIndex + 1} kickoff` : "Battle kickoff";

  if (battleStartKickerElement instanceof HTMLElement) {
    battleStartKickerElement.textContent = "Boss Raid";
  }

  if (battleStartRoundElement instanceof HTMLElement) {
    battleStartRoundElement.textContent = roundLabel;
  }

  if (battleStartBannerElement instanceof HTMLElement) {
    battleStartBannerElement.hidden = false;
    battleStartBannerElement.classList.remove("visible");
    void battleStartBannerElement.offsetWidth;
    battleStartBannerElement.classList.add("visible");
  }

  if (prepPhaseElement instanceof HTMLElement) {
    prepPhaseElement.classList.remove("battle-start-sweep");
    void prepPhaseElement.offsetWidth;
    prepPhaseElement.classList.add("battle-start-sweep");
  }

  if (battleStartSweepTimeoutId !== null) {
    clearTimeout(battleStartSweepTimeoutId);
  }

  battleStartSweepTimeoutId = window.setTimeout(() => {
    clearPlayerBattleStartSweep();
  }, PLAYER_BATTLE_START_SWEEP_MS);
}

function clearPlayerBattleStartSweep() {
  if (battleStartSweepTimeoutId !== null) {
    clearTimeout(battleStartSweepTimeoutId);
    battleStartSweepTimeoutId = null;
  }

  const prepPhaseElement = phaseSections.get("prep");
  if (prepPhaseElement instanceof HTMLElement) {
    prepPhaseElement.classList.remove("battle-start-sweep");
  }

  if (battleStartBannerElement instanceof HTMLElement) {
    battleStartBannerElement.classList.remove("visible");
    battleStartBannerElement.hidden = true;
  }
}

function buildPlayerPhaseCopy(phase) {
  switch (phase) {
    case "selection":
      return "role に応じた選択だけを表示しています。boss は boss、raid は hero を選びます。";
    case "purchase":
      return "Purchase 中です。shop で補充して、主人公以外の盤面ユニットは bench へ戻っています。";
    case "deploy":
      return "Deploy 中です。shared-board で配置を整えてから Ready を押します。";
    case "battle":
      return "Battle 中です。shared-board は参照専用で、戦闘操作はロックされています。";
    case "prep":
      return "Prep 中です。shared-board、shop、bench、Ready に集中してください。";
    case "result":
      return "Battle / Result を表示中です。いまは結果を読み、次に直す 1 点を決める時間です。";
    default:
      return "Lobby です。boss希望を決めて Ready を押し、selection の開始を待ちます。";
  }
}

function updatePhaseNotes(phase = latestPlayerFacingPhase) {
  const nextCopy = (() => {
    switch (phase) {
      case "selection":
        return "boss は boss、raid は hero を選ぶ段階です。選択が終わったら最初の prep を待ちます。";
      case "purchase":
        return "中央の shop が主役です。左で詳細を読み、右の所持情報を見ながら購入順を決めます。";
      case "deploy":
        return "中央の shared-board が主役です。ユニット選択 -> 枠選択で配置し、sub slot は盤面上で確認します。";
      case "battle":
        return "戦闘中は board を読む段階です。操作はロックされるので、左右の補助情報で状況を追います。";
      case "result":
        return "result を読み終えたら次 round で直す一点だけ決めます。board は最終盤面のまま残ります。";
      default:
        return "boss希望と Ready を整える段階です。全員の準備が揃うと role selection に進みます。";
    }
  })();

  phaseNotesCopyElements.forEach((element) => {
    if (element instanceof HTMLElement) {
      element.textContent = nextCopy;
    }
  });
}

function renderTopHud() {
  const roundIndex = Number.isInteger(latestState?.roundIndex) ? latestState.roundIndex + 1 : 1;
  const deadlineSummary = buildDeadlineSummary(latestState, latestRoundState);
  const spellSummary = typeof latestPlayer?.spellName === "string" && latestPlayer.spellName.length > 0
    ? latestPlayer.spellName
    : "No active spell";

  if (hudRoundPhaseElement instanceof HTMLElement) {
    hudRoundPhaseElement.innerHTML = `<strong>Round / Phase</strong><div>Round ${roundIndex} / ${latestPlayerFacingPhase}</div>`;
  }

  if (hudTimerElement instanceof HTMLElement) {
    hudTimerElement.innerHTML = `<strong>Timer</strong><div>${deadlineSummary.label}: ${deadlineSummary.valueText}</div>`;
  }

  if (hudSpellElement instanceof HTMLElement) {
    hudSpellElement.innerHTML = `<strong>Spell</strong><div>${spellSummary}</div>`;
  }

  if (hudFlowElement instanceof HTMLElement) {
    hudFlowElement.innerHTML = "<strong>Flow</strong><div>Purchase -&gt; Deploy -&gt; Battle</div>";
  }
}

function resolveRequestedRoomCode() {
  const inputValue = roomCodeInput instanceof HTMLInputElement
    ? roomCodeInput.value.trim()
    : "";
  if (inputValue.length > 0) {
    return inputValue;
  }

  return getSearchParam("roomId") ?? "";
}

function hydrateRequestedRoomCodeInput() {
  if (!(roomCodeInput instanceof HTMLInputElement) || roomCodeInput.value.trim().length > 0) {
    return;
  }

  const requestedRoomCode = getSearchParam("roomId") ?? "";
  if (requestedRoomCode.length > 0) {
    roomCodeInput.value = requestedRoomCode;
  }
}

function syncPlayerConnectButton() {
  if (!(connectButton instanceof HTMLButtonElement)) {
    return;
  }

  const connectionState = gameRoomSession.getConnectionState();
  if (connectionState === "connecting") {
    connectButton.disabled = true;
    connectButton.textContent = "Joining...";
    return;
  }

  if (connectionState === "connected") {
    connectButton.disabled = true;
    connectButton.textContent = "Connected";
    return;
  }

  connectButton.disabled = resolveRequestedRoomCode().length === 0;
  connectButton.textContent = "Join Session";
}

function resolveSharedBoardRoomId(state, roundState, fallbackRoomId = latestSharedBoardRoomId) {
  const stateRoomId = typeof state?.sharedBoardRoomId === "string" ? state.sharedBoardRoomId.trim() : "";
  if (stateRoomId.length > 0) {
    return stateRoomId;
  }

  const roundStateRoomId = typeof roundState?.sharedBoardRoomId === "string"
    ? roundState.sharedBoardRoomId.trim()
    : "";
  if (roundStateRoomId.length > 0) {
    return roundStateRoomId;
  }

  return typeof fallbackRoomId === "string" ? fallbackRoomId.trim() : "";
}

function renderPlayerHeaderTruth() {
  if (roomCopyElement instanceof HTMLElement) {
    const roomId = typeof gameRoomSession.getRoom()?.roomId === "string"
      ? gameRoomSession.getRoom().roomId
      : resolveRequestedRoomCode() || "pending";
    const sharedBoardRoomId = resolveSharedBoardRoomId(latestState, latestRoundState) || "unbound";
    const phase = typeof latestState?.phase === "string" ? latestState.phase : "Waiting";
    roomCopyElement.textContent = `Game ${roomId} / Shared board ${sharedBoardRoomId} / Phase ${phase}`;
  }

  if (deadlineCopyElement instanceof HTMLElement) {
    const deadlineSummary = buildDeadlineSummary(latestState, latestRoundState);
    deadlineCopyElement.textContent = `${deadlineSummary.label}: ${deadlineSummary.valueText}`;
  }

  renderTopHud();
  updatePhaseNotes();
}

function syncDeadlineRefreshLoop() {
  if (gameRoomSession.getConnectionState() !== "connected") {
    stopDeadlineRefreshLoop();
    return;
  }

  const deadlineSummary = buildDeadlineSummary(latestState, latestRoundState);
  if (deadlineSummary.valueText === "pending") {
    stopDeadlineRefreshLoop();
    return;
  }

  if (deadlineRefreshIntervalId !== null) {
    return;
  }

  deadlineRefreshIntervalId = window.setInterval(() => {
    const nextPlayerFacingPhase = resolvePlayerFacingPhase(latestState, latestRoundState);
    const playerFacingPhaseChanged = nextPlayerFacingPhase !== latestPlayerFacingPhase;
    latestPlayerFacingPhase = nextPlayerFacingPhase;
    renderPlayerHeaderTruth();

    if (playerFacingPhaseChanged) {
      if (statusCopy instanceof HTMLElement) {
        statusCopy.textContent = buildPlayerPhaseCopy(latestPlayerFacingPhase);
      }
      renderPlayerPrepSurface();
      return;
    }
  }, PLAYER_DEADLINE_REFRESH_INTERVAL_MS);
}

function stopDeadlineRefreshLoop() {
  if (deadlineRefreshIntervalId === null) {
    return;
  }

  clearInterval(deadlineRefreshIntervalId);
  deadlineRefreshIntervalId = null;
}

async function syncSharedBoardConnection() {
  const client = gameRoomSession.getClient();
  if (!client) {
    return;
  }

  const sharedBoardRoomId = resolveSharedBoardRoomId(latestState, latestRoundState);
  if (sharedBoardRoomId.length > 0) {
    rememberSharedBoardRoomId(sharedBoardRoomId);
  }
  await connectSharedBoard(client, { roomId: sharedBoardRoomId });
}

function updateReadyButton(player) {
  const connected = gameRoomSession.getConnectionState() === "connected";
  readyButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.disabled = !connected;
    button.textContent = player?.ready === true ? "Cancel Ready" : "Ready";
  });
}

function updateReadyCopy(state, player) {
  const players = mapEntries(state?.players)
    .map(([, currentPlayer]) => currentPlayer)
    .filter((currentPlayer) => currentPlayer?.isSpectator !== true);
  const readyCount = players.filter((currentPlayer) => currentPlayer?.ready === true).length;
  const readyHint = buildReadyHint({
    phase: typeof state?.phase === "string" ? state.phase : "Waiting",
    isReady: player?.ready === true,
    heroEnabled: state?.featureFlagsEnableHeroSystem === true,
    heroSelected: typeof player?.selectedHeroId === "string" && player.selectedHeroId.length > 0,
    bossRoleSelectionEnabled: state?.featureFlagsEnableBossExclusiveShop === true,
    lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
    isBossPlayer: state?.bossPlayerId === (gameRoomSession.getRoom()?.sessionId ?? "") || player?.role === "boss",
    bossSelected: typeof player?.selectedBossId === "string" && player.selectedBossId.length > 0,
    readyCount,
    totalCount: players.length,
  });

  if (prepReadyCopyElement instanceof HTMLElement) {
    prepReadyCopyElement.textContent = readyHint;
  }

  if (lobbyReadyCopyElement instanceof HTMLElement) {
    lobbyReadyCopyElement.textContent = readyHint;
  }
}

async function connectPlayerSession() {
  try {
    const requestedRoomCode = resolveRequestedRoomCode();
    const roomCodeRequired = requestedRoomCode.length === 0;
    if (roomCodeRequired) {
      showPlayerStatus("ルームコードを入力してから Join してください。");
      syncPlayerConnectButton();
      return;
    }

    const room = await gameRoomSession.connect({ roomId: requestedRoomCode });
    const client = gameRoomSession.getClient();

    if (room?.sessionId) {
      setSharedBoardGamePlayerId(room.sessionId);
    }

    const initialSharedBoardRoomId = resolveSharedBoardRoomId(
      latestState,
      latestRoundState,
      typeof room?.state?.sharedBoardRoomId === "string"
        ? room.state.sharedBoardRoomId
        : "",
    );
    if (initialSharedBoardRoomId.length > 0) {
      rememberSharedBoardRoomId(initialSharedBoardRoomId);
    }

    if (client) {
      const sharedBoardRoomId = resolveSharedBoardRoomId(latestState, latestRoundState, initialSharedBoardRoomId);
      await connectSharedBoard(client, { roomId: sharedBoardRoomId });
    }
  } catch (_error) {
    if (statusCopy instanceof HTMLElement) {
      statusCopy.textContent = "接続できませんでした。進行役に声をかけてください。";
    }
  }
}

function handlePlayerShopBuy(slotIndex) {
  if (!canUseShopAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    shopBuySlotIndex: slotIndex,
  });
}

function handlePlayerBossShopBuy(slotIndex) {
  if (!canUseShopAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    bossShopBuySlotIndex: slotIndex,
  });
}

function handlePlayerShopRefresh() {
  if (!canUseShopAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    shopRefreshCount: 1,
  });
}

function handlePlayerBuyXp() {
  if (!canUseShopAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    xpPurchaseCount: 1,
  });
}

function handlePlayerBenchSelect(index) {
  if (!canUseBenchAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  selectedBenchIndex = selectedBenchIndex === index ? null : index;
  renderPlayerPrepSurface();
}

function handlePlayerBenchSell() {
  if (!canUseBenchAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  if (selectedBenchIndex === null) {
    showPlayerStatus("Bench から売る unit を先に選んでください。");
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    benchSellIndex: selectedBenchIndex,
  });
  selectedBenchIndex = null;
  renderPlayerPrepSurface();
}

function handlePlayerBoardSell() {
  if (!canUseBoardAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  const selectedCell = resolveSelectedSharedBoardCell();
  const cellIndex = selectedCell?.cellIndex ?? null;
  if (cellIndex === null) {
    showPlayerStatus("shared-board で自分の unit を選んでから Sell を押してください。");
    return;
  }

  if (isSpecialSharedUnitId(selectedCell?.unitId)) {
    showPlayerStatus("主人公ユニットとボスユニットは売却できません。位置だけ調整できます。");
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    boardSellIndex: cellIndex,
  });
}

function handlePlayerBoardReturn() {
  if (!canUseBoardAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  const selectedCell = resolveSelectedSharedBoardCell();
  const cellIndex = selectedCell?.cellIndex ?? null;
  if (cellIndex === null) {
    showPlayerStatus("shared-board で自分の unit を選んでから Return を押してください。");
    return;
  }

  if (isSpecialSharedUnitId(selectedCell?.unitId)) {
    showPlayerStatus("主人公ユニットとボスユニットは bench に戻せません。位置だけ調整できます。");
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    boardToBenchCell: { cell: cellIndex },
  });
}

function handlePlayerSharedCellClick(cellIndex) {
  if (!canUseBoardAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  if (selectedBenchIndex === null) {
    handleSharedCellClick(getSharedBoardState(), cellIndex);
    renderPlayerPrepSurface();
    return;
  }

  if (!Number.isInteger(cellIndex) || cellIndex < 0) {
    showPlayerStatus(latestPlayer?.role === "boss"
      ? "いま配置できるのは、上側の boss 配置セルだけです。"
      : "いま配置できるのは、下側の raid 配置セルだけです。");
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    benchToBoardCell: {
      benchIndex: selectedBenchIndex,
      cell: cellIndex,
    },
  });
  selectedBenchIndex = null;
  renderPlayerPrepSurface();
}

function handlePlayerSharedSubSlotClick(cellIndex) {
  if (!canUseBoardAction({
    currentPhase: latestState?.phase,
    playerFacingPhase: latestPlayerFacingPhase,
    isReady: latestPlayer?.ready === true,
  })) {
    return;
  }

  if (selectedBenchIndex === null) {
    showPlayerStatus("sub slot に装着する unit を Bench から選んでください。");
    return;
  }

  if (!Number.isInteger(cellIndex) || cellIndex < 0) {
    showPlayerStatus("sub slot の対象セルを読み取れませんでした。もう一度選び直してください。");
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    benchToBoardCell: {
      benchIndex: selectedBenchIndex,
      cell: cellIndex,
      slot: "sub",
    },
  });
  selectedBenchIndex = null;
  renderPlayerPrepSurface();
}

function getCurrentBoardCellElements() {
  if (!(boardGridElement instanceof HTMLElement)) {
    return [];
  }

  return Array.from(boardGridElement.querySelectorAll("[data-player-shared-cell]"));
}

function normalizePrepHoverDetail(detail) {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  const kicker = typeof detail.kicker === "string" ? detail.kicker : "";
  const title = typeof detail.title === "string" ? detail.title : "";
  const portraitKey = typeof detail.portraitKey === "string" ? detail.portraitKey : "";
  const portraitUrl = typeof detail.portraitUrl === "string" ? detail.portraitUrl : "";
  const lines = Array.isArray(detail.lines)
    ? detail.lines.filter((line) => typeof line === "string")
    : [];

  if (kicker.length === 0 && title.length === 0 && portraitKey.length === 0 && portraitUrl.length === 0 && lines.length === 0) {
    return null;
  }

  return { kicker, title, portraitKey, portraitUrl, lines };
}

function isSamePrepHoverDetail(left, right) {
  const normalizedLeft = normalizePrepHoverDetail(left);
  const normalizedRight = normalizePrepHoverDetail(right);

  if (normalizedLeft === null || normalizedRight === null) {
    return normalizedLeft === normalizedRight;
  }

  if (
    normalizedLeft.kicker !== normalizedRight.kicker
    || normalizedLeft.title !== normalizedRight.title
    || normalizedLeft.portraitKey !== normalizedRight.portraitKey
    || normalizedLeft.portraitUrl !== normalizedRight.portraitUrl
  ) {
    return false;
  }

  if (normalizedLeft.lines.length !== normalizedRight.lines.length) {
    return false;
  }

  return normalizedLeft.lines.every((line, index) => line === normalizedRight.lines[index]);
}

function setPrepHoverDetail(detail) {
  const nextHoverDetail = normalizePrepHoverDetail(detail);
  if (isSamePrepHoverDetail(latestPrepHoverDetail, nextHoverDetail)) {
    return;
  }

  latestPrepHoverDetail = nextHoverDetail;
  renderPlayerPrepSurface();
}

function renderPlayerPrepSurface() {
  renderPlayerPrepSummary({
    detailCardElement,
    allyRailElement,
    boardCopyElement,
    shopCopyElement,
    bossShopCopyElement,
    heroUpgradeCopyElement,
    refreshCopyElement,
    specialUnitCopyElement,
    playerStatsCopyElement,
    spellCopyElement,
    synergyCopyElement,
    benchCopyElement,
    roomCopyElement,
    deadlineCopyElement,
    boardElement,
    shopElement,
    shopSlotElements,
    bossShopElement,
    bossShopSlotElements,
    benchElement,
    benchSlotElements,
    readyElement: prepReadyElement,
    readyCopyElement: prepReadyCopyElement,
    boardCellElements: getCurrentBoardCellElements(),
    state: latestState,
    player: latestPlayer,
    sessionId: gameRoomSession.getRoom()?.sessionId ?? "",
    currentPhase: typeof latestState?.phase === "string" ? latestState.phase : "Waiting",
    playerFacingPhase: latestPlayerFacingPhase,
    selectedBenchIndex,
    canSellBench: selectedBenchIndex !== null,
    canSellBoard: canManipulateSelectedBoardUnit(),
    canReturnBoard: canManipulateSelectedBoardUnit(),
    roomSummary: {
      roomId: typeof gameRoomSession.getRoom()?.roomId === "string"
        ? gameRoomSession.getRoom().roomId
        : resolveRequestedRoomCode() || "",
      sharedBoardRoomId: resolveSharedBoardRoomId(latestState, latestRoundState),
    },
    deadlineSummary: buildDeadlineSummary(latestState, latestRoundState),
    hoverDetail: latestPrepHoverDetail,
    onHoverDetailChange: setPrepHoverDetail,
    benchSellButton,
    boardReturnButton,
    boardSellButton,
    sharedBoardConnected: Boolean(getSharedBoardState()),
  });
  syncSharedPhaseSurfaceMode();
}

function syncSharedPhaseSurfaceMode() {
  const showPurchaseSurface = latestPlayerFacingPhase === "purchase";
  const showDeploySurface = latestPlayerFacingPhase === "deploy" || latestPlayerFacingPhase === "battle";

  if (purchaseSurfaceElement instanceof HTMLElement) {
    purchaseSurfaceElement.hidden = !showPurchaseSurface;
  }

  if (deploySurfaceElement instanceof HTMLElement) {
    deploySurfaceElement.hidden = !showDeploySurface;
  }
}

function resolveSelectedSharedBoardCell() {
  const selectedUnitId = getSelectedSharedUnitId();
  if (!selectedUnitId) {
    return null;
  }

  const ownerId = gameRoomSession.getRoom()?.sessionId ?? "";
  for (const [cellIndex, cell] of mapEntries(getSharedBoardState()?.cells)) {
    if (cell?.unitId !== selectedUnitId || cell.ownerId !== ownerId) {
      continue;
    }

    return {
      cellIndex: Number.parseInt(cellIndex, 10),
      unitId: cell.unitId,
      ownerId: cell.ownerId,
    };
  }

  return null;
}

function resolveSelectedSharedBoardCellIndex() {
  return resolveSelectedSharedBoardCell()?.cellIndex ?? null;
}

function isSpecialSharedUnitId(unitId) {
  return typeof unitId === "string" && (unitId.startsWith("hero:") || unitId.startsWith("boss:"));
}

function canManipulateSelectedBoardUnit() {
  const selectedCell = resolveSelectedSharedBoardCell();
  if (!selectedCell) {
    return false;
  }

  if (isSpecialSharedUnitId(selectedCell.unitId)) {
    return false;
  }

  return true;
}

function showPlayerStatus(message) {
  if (statusCopy instanceof HTMLElement) {
    statusCopy.textContent = message;
  }
}

function resolvePhaseHpProgress(message) {
  const targetHp = Number(message?.phaseHpTarget);
  if (!Number.isFinite(targetHp) || targetHp <= 0) {
    return null;
  }

  const damageDealt = Number(message?.phaseDamageDealt);
  const completionRate = Number(message?.phaseCompletionRate);
  const rawResult = typeof message?.phaseResult === "string" ? message.phaseResult : "pending";

  return {
    targetHp,
    damageDealt: Number.isFinite(damageDealt) ? Math.max(0, damageDealt) : 0,
    completionRate: Number.isFinite(completionRate) ? Math.max(0, completionRate) : 0,
    result: rawResult === "success" || rawResult === "failed" ? rawResult : "pending",
  };
}

function nextCmdSeq() {
  cmdSeqCounter += 1;
  return cmdSeqCounter;
}

function renderRoleSelectionActions(state, player) {
  if (bossPreferenceOnButton instanceof HTMLButtonElement) {
    bossPreferenceOnButton.disabled = !(state?.phase === "Waiting" && state?.lobbyStage === "preference");
    bossPreferenceOnButton.classList.toggle("selected", player?.wantsBoss === true);
  }

  if (bossPreferenceOffButton instanceof HTMLButtonElement) {
    bossPreferenceOffButton.disabled = !(state?.phase === "Waiting" && state?.lobbyStage === "preference");
    bossPreferenceOffButton.classList.toggle("selected", player?.wantsBoss !== true);
  }

  const isSelectionPhase = state?.phase === "Waiting" && state?.lobbyStage === "selection";
  const isBossPlayer = state?.bossPlayerId === gameRoomSession.getRoom()?.sessionId || player?.role === "boss";

  if (heroOptionsElement instanceof HTMLElement) {
    heroOptionsElement.innerHTML = "";

    if (isSelectionPhase && !isBossPlayer) {
      for (const hero of HERO_OPTIONS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "player-choice-btn";
        button.textContent = `${hero.name} / ${hero.role}`;
        if ((player?.selectedHeroId ?? selectedHeroId) === hero.id) {
          button.classList.add("selected");
        }
        button.addEventListener("click", () => {
          selectedHeroId = hero.id;
          gameRoomSession.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: hero.id });
        });
        heroOptionsElement.appendChild(button);
      }
    }
  }

  if (bossOptionsElement instanceof HTMLElement) {
    bossOptionsElement.innerHTML = "";

    if (isSelectionPhase && isBossPlayer) {
      for (const boss of BOSS_OPTIONS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "player-choice-btn";
        button.textContent = `${boss.name} / ${boss.roleCopy}`;
        if ((player?.selectedBossId ?? selectedBossId) === boss.id) {
          button.classList.add("selected");
        }
        button.addEventListener("click", () => {
          selectedBossId = boss.id;
          gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: boss.id });
        });
        bossOptionsElement.appendChild(button);
      }
    }
  }
}

function getSearchParam(key) {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(key);
}
