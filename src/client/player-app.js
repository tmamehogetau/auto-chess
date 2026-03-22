import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES, createGameRoomSession } from "./game-room-session.js";
import {
  renderPlayerLobbySummary,
  renderPlayerLobbyPreferenceSummary,
  renderPlayerPrepSummary,
  renderPlayerResultSummary,
  renderPlayerSelectionSummary,
} from "./player-surface-renderers.js";
import {
  connectSharedBoard,
  getSelectedSharedUnitId,
  getSharedBoardState,
  handleSharedCellClick,
  initSharedBoardClient,
  setSharedBoardGamePlayerId,
  setSharedBoardRoomId,
} from "./shared-board-client.js";
import { buildCommandResultCopy } from "./ui/player-facing-copy.js";
import { mapEntries, mapGet } from "./utils/pure-utils.js";

const playerShell = document.querySelector("[data-player-shell]");
const statusCopy = document.querySelector("[data-player-status-copy]");
const roomCodeInput = document.querySelector("[data-player-room-code-input]");
const connectButton = document.querySelector("[data-player-connect-btn]");
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
const shopElement = document.querySelector("[data-player-unit-shop]");
const shopCopyElement = document.querySelector("[data-player-shop-copy]");
const shopSlotElements = Array.from(document.querySelectorAll("[data-player-shop-slot]"));
const benchElement = document.querySelector("[data-player-bench]");
const benchCopyElement = document.querySelector("[data-player-bench-copy]");
const benchSlotElements = Array.from(document.querySelectorAll("[data-player-bench-slot]"));
const benchSellButton = document.querySelector("[data-player-bench-sell-button]");
const readyElement = document.querySelector("[data-player-ready-btn]");
const readyCopyElement = document.querySelector("[data-player-ready-copy]");
const readyButton = document.querySelector("[data-player-ready-button]");
const boardReturnButton = document.querySelector("[data-player-board-return-button]");
const boardSellButton = document.querySelector("[data-player-board-sell-button]");
const battleStartBannerElement = document.querySelector("[data-player-battle-start-banner]");
const battleStartKickerElement = document.querySelector("[data-player-battle-start-kicker]");
const battleStartRoundElement = document.querySelector("[data-player-battle-start-round]");
const resultSurfaceElement = document.querySelector("[data-player-result-surface]");
const phaseSections = new Map([
  ["lobby", document.querySelector('[data-player-phase="lobby"]')],
  ["selection", document.querySelector('[data-player-phase="selection"]')],
  ["prep", document.querySelector('[data-player-phase="prep"]')],
  ["result", document.querySelector('[data-player-phase="result"]')],
]);

const gameRoomSession = createGameRoomSession();
let latestPlayer = null;
let latestState = null;
let latestPhaseHpProgress = null;
let selectedHeroId = null;
let selectedBossId = "remilia";
let selectedBenchIndex = null;
let cmdSeqCounter = 0;
let latestRawPhase = "Waiting";
let battleStartSweepTimeoutId = null;

const PLAYER_BATTLE_START_SWEEP_MS = 900;

const HERO_OPTIONS = [
  { id: "reimu", name: "霊夢", role: "balance" },
  { id: "marisa", name: "魔理沙", role: "dps" },
  { id: "okina", name: "隠岐奈", role: "support" },
  { id: "keiki", name: "袿姫", role: "tank" },
  { id: "megumu", name: "女苑", role: "economy" },
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
    updateReadyButton(latestPlayer);
    return;
  }

  if (connectButton instanceof HTMLButtonElement) {
    connectButton.disabled = false;
    connectButton.textContent = "Join Session";
  }
  latestPhaseHpProgress = null;
  latestRawPhase = "Waiting";
  clearPlayerBattleStartSweep();
  statusCopy.textContent = "進行役がルームを準備したら、この画面の player flow が始まります。";
  updateReadyButton(null);
});

gameRoomSession.onStateChange((state) => {
  const previousPhase = latestRawPhase;
  latestRawPhase = typeof state?.phase === "string" ? state.phase : "Waiting";
  const nextView = resolvePlayerPhaseView(state);
  const player = mapGet(state?.players, gameRoomSession.getRoom()?.sessionId ?? "") ?? null;
  latestState = state;
  latestPlayer = player;
  if (typeof state?.sharedBoardRoomId === "string" && state.sharedBoardRoomId.length > 0) {
    setSharedBoardRoomId(state.sharedBoardRoomId);
  }
  showPlayerPhase(nextView);
  syncPlayerBattleStartSweep(previousPhase, state);
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

  statusCopy.textContent = buildPlayerPhaseCopy(nextView);
  updateReadyButton(player);
});

gameRoomSession.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message) => {
  latestPhaseHpProgress = resolvePhaseHpProgress(message);
  renderPlayerResultSummary({
    resultSurfaceElement,
    state: latestState,
    player: latestPlayer,
    phaseHpProgress: latestPhaseHpProgress,
    sessionId: gameRoomSession.getRoom()?.sessionId ?? "",
  });
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

bossPreferenceOnButton?.addEventListener("click", () => {
  gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
});

bossPreferenceOffButton?.addEventListener("click", () => {
  gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: false });
});

readyButton?.addEventListener("click", () => {
  const nextReady = !(latestPlayer?.ready === true);
  gameRoomSession.send(CLIENT_MESSAGE_TYPES.READY, { ready: nextReady });
});

shopSlotElements.forEach((button, index) => {
  button.addEventListener("click", () => {
    handlePlayerShopBuy(index);
  });
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

  const cell = target.closest("[data-cell-index], [data-player-shared-cell]");
  const cellIndex = Number.parseInt(
    cell?.getAttribute("data-cell-index") ?? cell?.getAttribute("data-player-shared-cell") ?? "",
    10,
  );
  handlePlayerSharedCellClick(cellIndex);
});

if (getSearchParam("autoconnect") === "1") {
  void connectPlayerSession();
}

function resolvePlayerPhaseView(state) {
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
  const resultPhaseElement = phaseSections.get("result");
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

  if (resultPhaseElement instanceof HTMLElement) {
    resultPhaseElement.classList.remove("battle-start-sweep");
    void resultPhaseElement.offsetWidth;
    resultPhaseElement.classList.add("battle-start-sweep");
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

  const resultPhaseElement = phaseSections.get("result");
  if (resultPhaseElement instanceof HTMLElement) {
    resultPhaseElement.classList.remove("battle-start-sweep");
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
    case "prep":
      return "Prep 中です。shared-board、shop、bench、Ready に集中してください。";
    case "result":
      return "Battle / Result を表示中です。いまは結果を読み、次に直す 1 点を決める時間です。";
    default:
      return "Lobby です。boss希望を決めて Ready を押し、selection の開始を待ちます。";
  }
}

function updateReadyButton(player) {
  if (!(readyButton instanceof HTMLButtonElement)) {
    return;
  }

  const connected = gameRoomSession.getConnectionState() === "connected";
  readyButton.disabled = !connected;
  readyButton.textContent = player?.ready === true ? "Cancel Ready" : "Ready";
}

async function connectPlayerSession() {
  try {
    const roomCode = roomCodeInput instanceof HTMLInputElement
      ? roomCodeInput.value.trim()
      : "";
    const room = await gameRoomSession.connect({ roomId: roomCode });
    const client = gameRoomSession.getClient();

    if (room?.sessionId) {
      setSharedBoardGamePlayerId(room.sessionId);
    }

    if (typeof room?.state?.sharedBoardRoomId === "string" && room.state.sharedBoardRoomId.length > 0) {
      setSharedBoardRoomId(room.state.sharedBoardRoomId);
    }

    if (client) {
      await connectSharedBoard(client);
    }
  } catch (_error) {
    if (statusCopy instanceof HTMLElement) {
      statusCopy.textContent = "接続できませんでした。進行役に声をかけてください。";
    }
  }
}

function handlePlayerShopBuy(slotIndex) {
  if (latestState?.phase !== "Prep") {
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    shopBuySlotIndex: slotIndex,
  });
}

function handlePlayerBenchSelect(index) {
  if (latestState?.phase !== "Prep") {
    return;
  }

  selectedBenchIndex = selectedBenchIndex === index ? null : index;
  renderPlayerPrepSurface();
}

function handlePlayerBenchSell() {
  if (latestState?.phase !== "Prep") {
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
  if (latestState?.phase !== "Prep") {
    return;
  }

  const cellIndex = resolveSelectedSharedBoardCellIndex();
  if (cellIndex === null) {
    showPlayerStatus("shared-board で自分の unit を選んでから Sell を押してください。");
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    boardSellIndex: cellIndex,
  });
}

function handlePlayerBoardReturn() {
  if (latestState?.phase !== "Prep") {
    return;
  }

  const cellIndex = resolveSelectedSharedBoardCellIndex();
  if (cellIndex === null) {
    showPlayerStatus("shared-board で自分の unit を選んでから Return を押してください。");
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    boardToBenchCell: { cell: cellIndex },
  });
}

function handlePlayerSharedCellClick(cellIndex) {
  if (latestState?.phase !== "Prep") {
    return;
  }

  if (selectedBenchIndex === null) {
    handleSharedCellClick(getSharedBoardState(), cellIndex);
    renderPlayerPrepSurface();
    return;
  }

  if (!Number.isInteger(cellIndex) || cellIndex < 0) {
    showPlayerStatus("いま配置できるのは、下側の highlighted raid cells だけです。");
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

function getCurrentBoardCellElements() {
  if (!(boardGridElement instanceof HTMLElement)) {
    return [];
  }

  return Array.from(boardGridElement.querySelectorAll("[data-player-shared-cell]"));
}

function renderPlayerPrepSurface() {
  renderPlayerPrepSummary({
    boardCopyElement,
    shopCopyElement,
    benchCopyElement,
    boardElement,
    shopElement,
    shopSlotElements,
    benchElement,
    benchSlotElements,
    readyElement,
    readyCopyElement,
    boardCellElements: getCurrentBoardCellElements(),
    state: latestState,
    player: latestPlayer,
    sessionId: gameRoomSession.getRoom()?.sessionId ?? "",
    currentPhase: typeof latestState?.phase === "string" ? latestState.phase : "Waiting",
    selectedBenchIndex,
    canSellBench: selectedBenchIndex !== null,
    canSellBoard: resolveSelectedSharedBoardCellIndex() !== null,
    canReturnBoard: resolveSelectedSharedBoardCellIndex() !== null,
    benchSellButton,
    boardReturnButton,
    boardSellButton,
    sharedBoardConnected: Boolean(getSharedBoardState()),
  });
}

function resolveSelectedSharedBoardCellIndex() {
  const selectedUnitId = getSelectedSharedUnitId();
  if (!selectedUnitId) {
    return null;
  }

  const ownerId = gameRoomSession.getRoom()?.sessionId ?? "";
  for (const [cellIndex, cell] of mapEntries(getSharedBoardState()?.cells)) {
    if (cell?.unitId !== selectedUnitId || cell.ownerId !== ownerId) {
      continue;
    }

    return Number.parseInt(cellIndex, 10);
  }

  return null;
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
