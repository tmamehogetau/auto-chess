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
  getSharedBoardState,
  handleSharedCellClick,
  initSharedBoardClient,
  setSharedBoardGamePlayerId,
} from "./shared-board-client.js";
import { buildCommandResultCopy } from "./ui/player-facing-copy.js";
import { mapGet } from "./utils/pure-utils.js";

const playerShell = document.querySelector("[data-player-shell]");
const statusCopy = document.querySelector("[data-player-status-copy]");
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
const readyElement = document.querySelector("[data-player-ready-btn]");
const readyCopyElement = document.querySelector("[data-player-ready-copy]");
const readyButton = document.querySelector("[data-player-ready-button]");
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
  statusCopy.textContent = "進行役がルームを準備したら、この画面の player flow が始まります。";
  updateReadyButton(null);
});

gameRoomSession.onStateChange((state) => {
  const nextView = resolvePlayerPhaseView(state);
  const player = mapGet(state?.players, gameRoomSession.getRoom()?.sessionId ?? "") ?? null;
  latestState = state;
  latestPlayer = player;
  showPlayerPhase(nextView);
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
    state,
    player,
    sessionId: gameRoomSession.getRoom()?.sessionId ?? "",
    currentPhase: typeof state?.phase === "string" ? state.phase : "Waiting",
    selectedBenchIndex,
    sharedBoardConnected: Boolean(getSharedBoardState()),
  });
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
    const room = await gameRoomSession.connect();
    const client = gameRoomSession.getClient();

    if (room?.sessionId) {
      setSharedBoardGamePlayerId(room.sessionId);
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
    sharedBoardConnected: Boolean(getSharedBoardState()),
  });
}

function handlePlayerSharedCellClick(cellIndex) {
  if (latestState?.phase !== "Prep") {
    return;
  }

  if (selectedBenchIndex === null) {
    handleSharedCellClick(getSharedBoardState(), cellIndex);
    return;
  }

  const combatCell = sharedBoardIndexToCombatCell(cellIndex);
  if (combatCell === null) {
    return;
  }

  gameRoomSession.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, {
    cmdSeq: nextCmdSeq(),
    benchToBoardCell: {
      benchIndex: selectedBenchIndex,
      cell: combatCell,
    },
  });
  selectedBenchIndex = null;
}

function sharedBoardIndexToCombatCell(boardIndex) {
  if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex >= 24) {
    return null;
  }

  const x = boardIndex % 6;
  const y = Math.floor(boardIndex / 6);
  const combatX = x - 1;
  const combatY = y - 1;

  if (combatX < 0 || combatX >= 4 || combatY < 0 || combatY >= 2) {
    return null;
  }

  return combatY * 4 + combatX;
}

function getCurrentBoardCellElements() {
  if (!(boardGridElement instanceof HTMLElement)) {
    return [];
  }

  return Array.from(boardGridElement.querySelectorAll("[data-player-shared-cell]"));
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
