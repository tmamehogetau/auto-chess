import {
  parseAutoDelayMs,
  parseAutoFillBots,
  parseAutoFlag,
  parsePlacementsSpec,
} from "./manual-check-utils.js";

import {
  withTimeout,
  isRoomConnectionOpen,
  parsePhaseResult,
  buildRejectHint,
  CONNECTION_OPEN_STATE,
  PHASE_RESULT_LABELS,
} from "./utils/pure-utils.js";

import {
  buildBattleResultCopy,
  buildCommandResultCopy,
  buildEntryFlowStatus,
  buildFinalJudgmentCopy,
  buildLobbyRoleCopy,
  buildPhaseHpCopy,
  buildReadyHint,
  buildRoundSummaryCaption,
  buildRoundSummaryTip,
} from "./ui/player-facing-copy.js";
import { playUiCue } from "./ui/audio-cues.js";
import {
  buildAutoFillHelperActions,
  resolveAutoFillHelperPlayerPhase,
} from "./autofill-helper-automation.js";

import {
  initAdminMonitor,
  startMonitorPolling,
  stopMonitorPolling,
  requestAdminMonitorSnapshot,
  handleAdminResponse,
  handleShadowDiff,
  resetShadowDiffMonitor,
} from "./admin-monitor.js";

import {
  initSharedBoardClient,
  connectSharedBoard,
  leaveSharedBoardRoom,
  getSharedBoardRoom,
  getSharedBoardState,
  getSelectedSharedUnitId,
  clearSelectedSharedUnit,
  getSelectedSharedSubUnitCellIndex,
  setSelectedSharedSubUnitCellIndex,
  setSharedBoardGamePlayerId,
  setSharedBoardRoomId,
  sendSharedCursorMove,
  sendSharedDragState,
  sendSharedPlaceUnit,
  handleSharedDrop,
  handleSharedCellClick,
} from "./shared-board-client.js";
import {
  CLIENT_MESSAGE_TYPES,
  DEFAULT_ROOM_NAME,
  SERVER_MESSAGE_TYPES,
} from "./game-room-session.js";
import { resolveFrontPortraitUrl, resolveShopPortraitUrl } from "./portrait-resolver.js";
import { getClientSpecialUnitLevel, getClientSpecialUnitUpgradeCost } from "./special-unit-progression.js";

const VALID_SET_IDS = new Set(["set1", "set2"]);

// Unit type icons
const UNIT_ICONS = {
  vanguard: "🛡️",
  ranger: "🏹",
  mage: "✨",
  assassin: "🗡️",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Hero definitions (client-side copy)
const HEROES = [
  {
    id: 'reimu',
    name: '博麗霊夢',
    role: 'balance',
    hp: 680,
    attack: 45,
    skill: {
      name: '夢符「二重結界」',
      description: '味方全体に防御バフ（被ダメージ-20%）',
    },
  },
  {
    id: 'marisa',
    name: '霧雨魔理沙',
    role: 'dps',
    hp: 400,
    attack: 60,
    skill: {
      name: '恋符「マスタースパーク」',
      description: '直線ビームで全敵に魔法ダメージ（ATK × 2.0）',
    },
  },
  {
    id: 'okina',
    name: '摩多羅隠岐奈',
    role: 'support',
    hp: 540,
    attack: 40,
    skill: {
      name: '秘神「裏表の逆転」',
      description: '味方全体に攻撃力バフ（与ダメージ+25%）',
    },
  },
  {
    id: 'keiki',
    name: '埴安神袿姫',
    role: 'support',
    hp: 880,
    attack: 30,
    skill: {
      name: '埴安神「偶像の加護」',
      description: '自身の被ダメージ-40%、周囲の味方に被ダメージ-15%',
    },
  },
  {
    id: 'jyoon',
    name: '依神女苑',
    role: 'dps',
    hp: 500,
    attack: 35,
    skill: {
      name: '財符「黄金のトルネード」',
      description: '攻撃毎に自己ATK+10%累積（最大+50%）',
    },
  },
  {
    id: 'yuiman',
    name: 'ユイマン・浅間',
    role: 'support',
    hp: 520,
    attack: 38,
    skill: {
      name: '虚構「ディスコミュニケーション」',
      description: '最もHPの低い敵の攻撃を一時無効化（プレースホルダー）',
    },
  },
];

// Hero role icons
const HERO_ROLE_ICONS = {
  tank: "🛡️",
  dps: "⚔️",
  support: "✨",
  control: "⏱️",
  balance: "⚖️",
  economy: "💰",
};

const BOSS_CHARACTERS = [
  {
    id: "remilia",
    name: "レミリア",
    roleCopy: "紅魔館の主",
    portraitKey: "remilia",
  },
];

// Spell cards (client-side copy)
const SPELL_CARDS = [
  { id: 'instant-1', name: '紅符「スカーレットシュート」', description: 'レイドメンバー全員に50ダメージを与える' },
  { id: 'instant-2', name: '必殺「ハートブレイク」', description: 'レイドメンバー全員に65ダメージを与える' },
  { id: 'instant-3', name: '神槍「スピア・ザ・グングニル」', description: 'レイドメンバー全員に80ダメージを与える' },
  { id: 'area-1', name: '紅符「不夜城レッド」', description: 'レイドメンバー全員に40ダメージを与える' },
  { id: 'area-2', name: '紅魔「スカーレットデビル」', description: 'レイドメンバー全員に55ダメージを与える' },
  { id: 'area-3', name: '魔符「全世界ナイトメア」', description: 'レイドメンバー全員に70ダメージを与える' },
  { id: 'rush-1', name: '神鬼「レミリアストーカー」', description: 'レイドメンバー全員に45ダメージを与える' },
  { id: 'rush-2', name: '夜符「デーモンキングクレイドル」', description: 'レイドメンバー全員に60ダメージを与える' },
  { id: 'rush-3', name: '夜王「ドラキュラクレイドル」', description: 'レイドメンバー全員に75ダメージを与える' },
  { id: 'last-word', name: '「紅色の幻想郷」', description: 'レイドメンバー全員に100ダメージを与える' },
];

const SPELL_SET_IDS_BY_ROUND_START = {
  1: ["instant-1", "area-1", "rush-1"],
  5: ["instant-2", "area-2", "rush-2"],
  9: ["instant-3", "area-3", "rush-3"],
  12: ["last-word"],
};

const SPELL_CARD_MAP = new Map(SPELL_CARDS.map((spell) => [spell.id, spell]));

const SCARLET_MANSION_DATA = {
  displayNames: {
    vanguard: "紅美鈴",
    assassin: "十六夜咲夜",
    mage: "パチュリー・ノーレッジ",
  },
  cardDetails: {
    vanguard: {
      role: "序盤の壁",
      skillDescription: "彩華「虹色太極拳」- 周囲の敵攻撃を誘引し、被ダメージを軽減",
      flavorText: "紅魔館の門番。悠々自適に勤務中。",
    },
    assassin: {
      role: "守護サポート",
      skillDescription: "幻幽「ジャック・ザ・ルドビレ」- 最もHPの低い味方を守護し、被ダメージを肩代わり",
      flavorText: "紅魔館のメイド長。完璧で瀟洒な仕事人。",
    },
    mage: {
      role: "爆発補助",
      skillDescription: "火水木金土符「賢者の石」- ランダムな敵3体に大魔法ダメージ",
      flavorText: "紅魔館の魔法使い。動きたくない。",
    },
  },
  synergyDescription: 'HP70%以上でATK+10% / 吸血',
};

// ラウンドに応じたスペルカードセットを取得
function getSpellSetForRound(roundIndex) {
  if (roundIndex >= 1 && roundIndex <= 4) {
    return SPELL_SET_IDS_BY_ROUND_START[1].map((spellId) => SPELL_CARD_MAP.get(spellId)).filter(Boolean);
  }
  if (roundIndex >= 5 && roundIndex <= 8) {
    return SPELL_SET_IDS_BY_ROUND_START[5].map((spellId) => SPELL_CARD_MAP.get(spellId)).filter(Boolean);
  }
  if (roundIndex >= 9 && roundIndex <= 11) {
    return SPELL_SET_IDS_BY_ROUND_START[9].map((spellId) => SPELL_CARD_MAP.get(spellId)).filter(Boolean);
  }
  if (roundIndex === 12) {
    return SPELL_SET_IDS_BY_ROUND_START[12].map((spellId) => SPELL_CARD_MAP.get(spellId)).filter(Boolean);
  }
  return [];
}

// Legacy form elements (kept for compatibility)
const endpointInput = document.querySelector("[data-endpoint-input]");
const roomInput = document.querySelector("[data-room-input]");
const roomCodeInput = document.querySelector("[data-room-code-input]");
const roomCodeOutput = document.querySelector("[data-room-code-output]");
const setIdSelect = document.querySelector("[data-setid-select]");
const autoFillInput = document.querySelector("[data-autofill-input]");
const connectButton = document.querySelector("[data-connect-button]");
const leaveButton = document.querySelector("[data-leave-button]");
const connectionGuide = document.querySelector("[data-connection-guide]");

// New UI elements
const gameContainer = document.querySelector("[data-game-container]");
const entryFlowStatus = document.querySelector("[data-entry-flow-status]");
const roundDisplay = document.querySelector("[data-round-display]");
const goldDisplay = document.querySelector("[data-gold-display]");
const hpDisplay = document.querySelector("[data-hp-display]");
  const levelDisplay = document.querySelector("[data-level-display]");
  const xpDisplay = document.querySelector("[data-xp-display]");
const dominationCountDisplay = document.querySelector("[data-domination-count-display]");
const phaseDisplay = document.querySelector("[data-phase-display]");
const raidBoardModeBadge = document.querySelector("[data-raid-board-mode-badge]");
const raidLivesDisplay = document.querySelector("[data-raid-lives-display]");
const finalJudgmentBanner = document.querySelector("[data-final-judgment-banner]");
const readyCountDisplay = document.querySelector("[data-ready-count]");
const phaseHpSection = document.querySelector("[data-phase-hp-section]");
const phaseHpValue = document.querySelector("[data-phase-hp-value]");
const phaseHpFill = document.querySelector("[data-phase-hp-fill]");
const phaseHpResult = document.querySelector("[data-phase-hp-result]");
const phaseHpHelp = document.querySelector("[data-phase-hp-help]");
const readyBtn = document.querySelector("[data-ready-btn]");
const readyHint = document.querySelector("[data-ready-hint]");
const unitShopGrid = document.querySelector("[data-unit-shop]");
const heroExclusiveShopGrid = document.querySelector("[data-hero-exclusive-shop]");
const heroExclusiveShopSection = document.querySelector("[data-hero-exclusive-shop-section]");
const bossShopGrid = document.querySelector("[data-boss-shop]");
const bossShopSection = document.querySelector("[data-boss-shop-section]");
const benchGrid = document.querySelector("[data-bench]");
const sellBtn = document.querySelector("[data-sell-btn]");
const refreshShopBtn = document.querySelector("[data-refresh-shop-btn]");
const buyXpBtn = document.querySelector("[data-buy-xp-btn]");
const messageBar = document.querySelector("[data-message-bar]");
const selectionModeIndicator = document.querySelector("[data-selection-mode]");
const combatLogContainer = document.querySelector("[data-combat-log]");
const sharedBoardGrid = document.querySelector("[data-shared-board-grid]");
const sharedCursorList = document.querySelector("[data-shared-cursor-list]");
const sharedBoardPlacementGuide = document.querySelector("[data-shared-board-placement-guide]");
const bossLobbyPanel = document.querySelector("[data-boss-lobby-panel]");
const bossPreferenceToggle = document.querySelector("[data-boss-preference-toggle]");
const bossPreferenceSummary = document.querySelector("[data-boss-preference-summary]");
const bossPreferenceList = document.querySelector("[data-boss-preference-list]");
const bossRoleCopy = document.querySelector("[data-boss-role-copy]");
const phaseTransitionOverlay = document.querySelector("[data-phase-transition-overlay]");
const roundSummaryOverlay = document.querySelector("[data-round-summary-overlay]");
const roundSummaryRound = document.querySelector("[data-round-summary-round]");
const roundSummaryList = document.querySelector("[data-round-summary-list]");
const roundSummaryClose = document.querySelector("[data-round-summary-close]");
const roundSummaryCaption = document.querySelector("[data-round-summary-caption]");
const roundSummaryTip = document.querySelector("[data-round-summary-tip]");

// Battle result elements
const battleResultOverlay = document.querySelector("[data-battle-result-overlay]");
const battleResultTitle = document.querySelector("[data-battle-result-title]");
const battleResultSubtitle = document.querySelector("[data-battle-result-subtitle]");
const battleResultHint = document.querySelector("[data-battle-result-hint]");
const battleDamageDealt = document.querySelector("[data-battle-damage-dealt]");
const battleDamageTaken = document.querySelector("[data-battle-damage-taken]");

// Battle start overlay
const battleStartOverlay = document.querySelector("[data-battle-start-overlay]");

const monitorRefreshBtn = document.querySelector("[data-monitor-refresh-btn]");
const monitorEventsValue = document.querySelector("[data-monitor-events]");
const monitorFailureValue = document.querySelector("[data-monitor-failure]");
const monitorConflictValue = document.querySelector("[data-monitor-conflict]");
const monitorLatencyValue = document.querySelector("[data-monitor-latency]");
const monitorShadowStatusValue = document.querySelector("[data-monitor-shadow-status]");
const monitorShadowMismatchValue = document.querySelector("[data-monitor-shadow-mismatch]");
const monitorAlertValue = document.querySelector("[data-monitor-alert]");
const monitorTopErrorsValue = document.querySelector("[data-monitor-top-errors]");
const monitorTraceValue = document.querySelector("[data-monitor-trace]");
const monitorSummaryValue = document.querySelector("[data-monitor-summary]");
const monitorShadowDetailsValue = document.querySelector("[data-monitor-shadow-details]");
const monitorLogList = document.querySelector("[data-monitor-log]");
const monitorPlayerSnapshotValue = document.querySelector("[data-monitor-player-snapshot]");

// Hero selection elements
const heroSelectionOverlay = document.querySelector("[data-hero-selection-overlay]");
const heroGrid = document.querySelector("[data-hero-grid]");
const heroConfirmBtn = document.querySelector("[data-hero-confirm-btn]");
const bossSelectionOverlay = document.querySelector("[data-boss-selection-overlay]");
const bossSelectionPortrait = document.querySelector("[data-boss-selection-portrait]");
const bossSelectionName = document.querySelector("[data-boss-selection-name]");
const bossSelectionRoleCopy = document.querySelector("[data-boss-selection-role-copy]");
const bossConfirmBtn = document.querySelector("[data-boss-confirm-btn]");

const heroSection = document.querySelector("[data-hero-section]");
const heroDisplay = document.querySelector("[data-hero-display]");
const heroNameDisplay = document.querySelector("[data-hero-name]");
const heroRoleDisplay = document.querySelector("[data-hero-role]");
const heroHpDisplay = document.querySelector("[data-hero-hp]");
const heroAttackDisplay = document.querySelector("[data-hero-attack]");

// Spell card elements
const spellCardSection = document.querySelector("[data-spell-card-section]");
const spellNameDisplay = document.querySelector("[data-spell-name]");
const spellDescDisplay = document.querySelector("[data-spell-desc]");

// Spell selection elements
const spellSelectSection = document.querySelector("[data-spell-select-section]");
const spellSelectRadios = document.querySelector("[data-spell-select-radios]");
const declareSpellBtn = document.querySelector("[data-declare-spell-btn]");

// Spell selection state
let declaredSpellForRound = null;

// Game state
let activeRoom = null;
let connecting = false;
let currentPhase = null;
let currentGold = 0;
let currentPlayerState = null;
let currentGameState = null;
let sessionId = null;
let currentRound = 0;
let latestPhaseHpProgress = null;
let lastShownSummaryRound = -1;
let roundSummaryAutoHideTimeout = null;
let currentSharedPoolInventory = null;
let lastShownBattleRound = -1;
let battleResultAutoHideTimeout = null;

// Hero selection state
let selectedHeroId = null;
let heroSelectionConfirmed = false;
let selectedBossId = null;
let bossSelectionConfirmed = false;

// Selection state
let selectedBenchIndex = null;
let selectedShopSlot = null;
let selectedSharedBoardCellIndex = null;

// Timer state
let timerInterval = null;

// Auto-fill state
let pendingAutoReadyTimeout = null;
let pendingAutoPrepTimeout = null;
const autoFillRooms = [];
let autoReadyCompleted = false;
let autoPrepCompleted = false;
const HELPER_AUTOMATION_RETRY_DELAY_MS = 10;
const HELPER_AUTOMATION_RETRY_ATTEMPTS = 16;
let lastMonitorTraceId = null;

const autoConfig = {
  autoConnect: false,
  autoReady: false,
  autoPrep: false,
  autoDelayMs: 300,
  autoFillBots: 0,
};

// Command sequence for prep commands
let nextCmdSeq = 1;



initializeDefaults();

// Admin monitor initialization
initAdminMonitor(
  {
    monitorRefreshBtn,
    monitorEventsValue,
    monitorFailureValue,
    monitorConflictValue,
    monitorLatencyValue,
    monitorShadowStatusValue,
    monitorShadowMismatchValue,
    monitorAlertValue,
    monitorTopErrorsValue,
    monitorTraceValue,
    monitorSummaryValue,
    monitorShadowDetailsValue,
    monitorLogList,
    monitorPlayerSnapshotValue,
  },
  {
    getActiveRoom: () => activeRoom,
    addCombatLogEntry,
    setTraceId: (id) => {
      lastMonitorTraceId = id;
    },
  },
);
resetShadowDiffMonitor();

// Shared board client initialization
initSharedBoardClient(
  {
    gridElement: sharedBoardGrid,
    cursorListElement: sharedCursorList,
    placementGuideElement: sharedBoardPlacementGuide,
  },
  {
    client: null, // Will be set during connect
    gamePlayerId: "", // Will be set during connect
    isTouhouRosterEnabled: () => currentGameState?.featureFlagsEnableTouhouRoster === true,
    onLog: addCombatLogEntry,
    showMessage,
  },
);

// Hero selection event listeners
heroConfirmBtn?.addEventListener("click", () => {
  confirmHeroSelection();
});

bossPreferenceToggle?.addEventListener("click", () => {
  toggleBossPreference();
});

bossConfirmBtn?.addEventListener("click", () => {
  confirmBossSelection();
});

syncButtonAvailability();

// Event listeners
connectButton?.addEventListener("click", () => {
  void connect();
});

leaveButton?.addEventListener("click", () => {
  void leave();
});

updateEntryFlowStatus(null, null);

readyBtn?.addEventListener("click", () => {
  sendReady();
});

sellBtn?.addEventListener("click", () => {
  handleSell();
});

refreshShopBtn?.addEventListener("click", () => {
  handleRefreshShop();
});

buyXpBtn?.addEventListener("click", () => {
  handleBuyXp();
});

roundSummaryClose?.addEventListener("click", () => {
  hideRoundSummary();
});

// Spell declaration button handler
declareSpellBtn?.addEventListener("click", () => {
  handleDeclareSpell();
});

// Shop card click handlers
unitShopGrid?.querySelectorAll("[data-shop-slot]").forEach((card) => {
  card.addEventListener("click", () => {
    const slot = Number.parseInt(card.dataset.shopSlot, 10);
    handleBuyUnit(slot);
  });
});

bossShopGrid?.querySelectorAll("[data-boss-shop-slot]").forEach((card) => {
  card.addEventListener("click", () => {
    const slot = Number.parseInt(card.dataset.bossShopSlot, 10);
    handleBuyBossShopUnit(slot);
  });
});

heroExclusiveShopGrid?.querySelectorAll("[data-hero-exclusive-shop-slot]").forEach((card) => {
  card.addEventListener("click", () => {
    const slot = Number.parseInt(card.dataset.heroExclusiveShopSlot, 10);
    handleBuyHeroExclusiveUnit(slot);
  });
});

// Bench slot click handlers
benchGrid?.querySelectorAll("[data-bench-slot]").forEach((slot) => {
  slot.addEventListener("click", () => {
    const index = Number.parseInt(slot.dataset.benchSlot, 10);
    handleBenchClick(index);
  });
});

sharedBoardGrid?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const cell = target.closest("[data-cell-index]");
  const cellIndex = Number.parseInt(cell?.getAttribute("data-cell-index") ?? "", 10);
  if (!Number.isFinite(cellIndex)) {
    return;
  }

  const isSubSlotTarget = target.closest("[data-shared-board-sub-slot]");
  if (isSubSlotTarget) {
    handleSharedSubSlotClickForManualCheck(cellIndex);
    return;
  }

  if (selectedBenchIndex !== null) {
    deployBenchUnit(selectedBenchIndex, cellIndex);
    clearSelections();
    return;
  }

  handleSharedCellClickForManualCheck(cellIndex);
});

window.addEventListener("beforeunload", () => {
  disconnectRoomsForPageExit();
});

window.addEventListener("pagehide", () => {
  disconnectRoomsForPageExit();
});

async function connect() {
  if (connecting) {
    showMessage("Still connecting...", "error");
    return;
  }

  if (activeRoom && isRoomConnectionOpen(activeRoom)) {
    showMessage("Already connected. Press Leave first.", "error");
    return;
  }

  if (activeRoom && !isRoomConnectionOpen(activeRoom)) {
      activeRoom = null;
      sessionId = null;
      currentPhase = null;
      leaveSharedBoardRoom();
      updateRoomCodeDisplay("");
      gameContainer?.classList.remove("connected");
    syncButtonAvailability();
  }

  if (activeRoom) {
    return;
  }

  connecting = true;
  syncButtonAvailability();
  showMessage("Connecting...", "success");
  updateEntryFlowStatus(null, null);

  try {
    const { endpoint, roomName, roomCode, setId } = readConfig();
    const { Client } = await withTimeout(
      import("https://esm.sh/@colyseus/sdk@0.17.34"),
      8_000,
      "Colyseus SDK load",
    );
    const client = new Client(endpoint);
    const roomOptions = setId ? { setId } : {};
    const roomCodeValue = roomCode.trim();
    let sharedBoardSeedRoom = null;
    let room;

    if (roomCodeValue.length > 0) {
      room = await withTimeout(
        client.joinById(roomCodeValue, { spectator: true }),
        8_000,
        "Room connection",
      );
    } else {
      sharedBoardSeedRoom = await withTimeout(
        client.create("shared_board", { spectator: true }),
        8_000,
        "Shared board room creation",
      );
      room = await withTimeout(
        client.create(roomName, {
          ...roomOptions,
          sharedBoardRoomId: sharedBoardSeedRoom.roomId,
          spectator: true,
        }),
        8_000,
        "Room connection",
      );
    }

    activeRoom = room;
    sessionId = room.sessionId;
    currentPhase = readPhase(room.state?.phase);
    const resolvedSharedBoardRoomId =
      room.state?.sharedBoardRoomId
      || sharedBoardSeedRoom?.roomId
      || "";
    setSharedBoardGamePlayerId(room.sessionId);
    setSharedBoardRoomId(resolvedSharedBoardRoomId);
    updateRoomCodeDisplay(room.roomId ?? roomCodeValue);
    lastShownSummaryRound = -1;
    hideRoundSummary();
    lastShownBattleRound = -1;
    hideBattleResult();
    hideHeroSelection();
    hideBossSelection();
    heroSelectionConfirmed = false;
    bossSelectionConfirmed = false;

    // Show game container
    gameContainer?.classList.add("connected");

    // Initialize UI from state
    updateGameUI(room.state);

    // State change handler
    room.onStateChange((state) => {
      currentGameState = state;
      if (typeof state?.sharedBoardRoomId === "string" && state.sharedBoardRoomId.length > 0) {
        setSharedBoardRoomId(state.sharedBoardRoomId);
      }
      updateGameUI(state);
      currentPhase = readPhase(state?.phase);
      syncButtonAvailability();
      maybeScheduleAutoPrep();
    });

    // Round state messages
    room.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message) => {
      currentPhase = readPhase(message?.phase);
      if (typeof message?.sharedBoardRoomId === "string" && message.sharedBoardRoomId.length > 0) {
        setSharedBoardRoomId(message.sharedBoardRoomId);
      }
      updatePhaseDisplay(currentPhase);
      if (typeof message?.roundIndex === "number") {
        roundDisplay.textContent = message.roundIndex + 1;
      }
      if (typeof message?.dominationCount === "number") {
        dominationCountDisplay.textContent = `${message.dominationCount}/5`;
      }
      updatePhaseHpProgressFromMessage(message);
      syncButtonAvailability();
      maybeScheduleAutoPrep();
    });

    // Command results
    room.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (result) => {
      handleCommandResult(result);
    });

    room.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, (message) => {
      handleShadowDiff(message);
    });

    room.onMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, (response) => {
      handleAdminResponse(response);
    });

    await connectSharedBoard(
      client,
      sharedBoardSeedRoom
        ? { existingRoom: sharedBoardSeedRoom, spectator: true }
        : { spectator: true },
    );

    await connectAutoFillRooms(client, roomName, roomOptions, room.roomId ?? roomCodeValue);

    startMonitorPolling();
    requestAdminMonitorSnapshot();

    room.onLeave(() => {
      clearPendingAutoActions();
      stopMonitorPolling();
      void leaveAutoFillRooms();
      activeRoom = null;
      sessionId = null;
      currentPhase = null;
      updateRoomCodeDisplay("");
      leaveSharedBoardRoom();
      latestPhaseHpProgress = null;
      renderPhaseHpProgress(null);
      lastShownSummaryRound = -1;
      hideRoundSummary();
      lastShownBattleRound = -1;
      hideBattleResult();
      hideHeroSelection();
      hideBossSelection();
      resetShadowDiffMonitor();
      gameContainer?.classList.remove("connected");
      showMessage("Disconnected. Press Connect when you are ready to start again.", "error");
      updateEntryFlowStatus(null, null);
      syncButtonAvailability();
    });

    showMessage("Connected. Choose a hero, buy units, place them, then press Ready.", "success");
    updateEntryFlowStatus(room.state, mapGet(room.state?.players, room.sessionId) ?? null);
    maybeScheduleAutoReady();
    maybeScheduleAutoPrep();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    currentPhase = null;
    latestPhaseHpProgress = null;
    renderPhaseHpProgress(null);
    lastShownSummaryRound = -1;
    hideRoundSummary();
    lastShownBattleRound = -1;
    hideBattleResult();
    showMessage(`Connection failed: ${message}`, "error");
    updateEntryFlowStatus(null, null);
  } finally {
    connecting = false;
    syncButtonAvailability();
  }
}

async function leave() {
  if (!activeRoom) {
    return;
  }

  const room = activeRoom;

  clearPendingAutoActions();
  stopMonitorPolling();
  await leaveAutoFillRooms();
  leaveSharedBoardRoom();
  activeRoom = null;
  sessionId = null;
  currentPhase = null;
  updateRoomCodeDisplay("");
  latestPhaseHpProgress = null;
  renderPhaseHpProgress(null);
  lastShownSummaryRound = -1;
  hideRoundSummary();
  lastShownBattleRound = -1;
  hideBattleResult();
  hideHeroSelection();
  hideBossSelection();
  resetShadowDiffMonitor();
  syncButtonAvailability();

  try {
    if (typeof room.removeAllListeners === "function") {
      room.removeAllListeners();
    }
    if (typeof room.leave === "function") {
      await room.leave();
    }
  } finally {
    gameContainer?.classList.remove("connected");
    showMessage("Disconnected. Press Connect when you are ready to start again.", "error");
    updateEntryFlowStatus(null, null);
    syncButtonAvailability();
  }
}

function releaseRoomOnPageExit(room) {
  if (!room) {
    return;
  }

  if (typeof room.removeAllListeners === "function") {
    room.removeAllListeners();
  }

  if (typeof room.leave === "function") {
    void room.leave();
  }
}

function disconnectRoomsForPageExit() {
  clearPendingAutoActions();
  stopMonitorPolling();

  const roomToLeave = activeRoom;
  const leavingRooms = autoFillRooms.splice(0, autoFillRooms.length);

  activeRoom = null;
  sessionId = null;
  currentPhase = null;
  latestPhaseHpProgress = null;
  lastShownSummaryRound = -1;
  lastShownBattleRound = -1;

  leaveSharedBoardRoom();
  updateRoomCodeDisplay("");

  for (const room of leavingRooms) {
    releaseRoomOnPageExit(room);
  }

  releaseRoomOnPageExit(roomToLeave);
}

function sendReady() {
  if (!activeRoom) {
    showMessage("Connect first. Then you can ready up from the prep screen.", "error");
    return;
  }

  const currentReady = readyBtn?.classList.contains("ready");
  const newReady = !currentReady;

  activeRoom.send(CLIENT_MESSAGE_TYPES.READY, { ready: newReady });
  if (newReady) {
    playUiCue("confirm");
  }
  
  // Optimistically update button
  if (newReady) {
    readyBtn?.classList.remove("not-ready");
    readyBtn?.classList.add("ready");
    readyBtn.textContent = "Cancel Ready";
  } else {
    readyBtn?.classList.remove("ready");
    readyBtn?.classList.add("not-ready");
    readyBtn.textContent = "Ready";
  }
}

function sendBossPreference(wantsBoss) {
  if (!activeRoom) {
    showMessage("Connect first. Then choose whether you want the boss role.", "error");
    return;
  }

  activeRoom.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss });
}

function sendBossSelect(bossId) {
  if (!activeRoom) {
    showMessage("Connect first. Then confirm your boss character.", "error");
    return;
  }

  activeRoom.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId });
}

function toggleBossPreference() {
  const wantsBoss = currentPlayerState?.wantsBoss === true;
  sendBossPreference(!wantsBoss);
  playUiCue("confirm");
}

function sendPrepCommand(payload) {
  if (!activeRoom) {
    showMessage("Connect first. Then you can buy, place, or sell units.", "error");
    return;
  }

  if (currentPhase !== "Prep") {
    showMessage("You can only change your board during Prep.", "error");
    return;
  }

  const cmdSeq = nextCmdSeq;
  const correlationId = createCorrelationId("prep", cmdSeq);
  const fullPayload = { cmdSeq, correlationId, ...payload };

  activeRoom.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, fullPayload);
  lastMonitorTraceId = correlationId;
  if (monitorTraceValue) {
    monitorTraceValue.textContent = correlationId;
  }
  addCombatLogEntry(`Trace ${correlationId} sent`, "info");
  nextCmdSeq++;
}

// Shop handlers
function handleBuyUnit(shopSlot) {
  if (currentPhase !== "Prep") {
    showMessage("Can only buy during prep phase", "error");
    return;
  }

  // Purchase animation
  const shopCard = unitShopGrid?.querySelector(`[data-shop-slot="${shopSlot}"]`);
  if (shopCard) {
    shopCard.classList.add("purchased");
    setTimeout(() => shopCard.classList.remove("purchased"), 500);
  }

  sendPrepCommand({ shopBuySlotIndex: shopSlot });
  playUiCue("purchase");
  showMessage(`Buying unit from slot ${shopSlot}...`, "success");
}

function handleBuyBossShopUnit(shopSlot) {
  if (currentPhase !== "Prep") {
    showMessage("Can only buy during prep phase", "error");
    return;
  }

  // Purchase animation
  const shopCard = bossShopGrid?.querySelector(`[data-boss-shop-slot="${shopSlot}"]`);
  if (shopCard) {
    shopCard.classList.add("purchased");
    setTimeout(() => shopCard.classList.remove("purchased"), 500);
  }

  sendPrepCommand({ bossShopBuySlotIndex: shopSlot });
  playUiCue("purchase");
  showMessage(`Buying unit from boss shop slot ${shopSlot}...`, "success");
}

function handleBuyHeroExclusiveUnit(shopSlot) {
  if (currentPhase !== "Prep") {
    showMessage("Can only buy during prep phase", "error");
    return;
  }

  const shopCard = heroExclusiveShopGrid?.querySelector(`[data-hero-exclusive-shop-slot="${shopSlot}"]`);
  if (shopCard) {
    shopCard.classList.add("purchased");
    setTimeout(() => shopCard.classList.remove("purchased"), 500);
  }

  sendPrepCommand({ heroExclusiveShopBuySlotIndex: shopSlot });
  playUiCue("purchase");
  showMessage(`Buying unit from hero-exclusive shop slot ${shopSlot}...`, "success");
}

function handleRefreshShop() {
  if (currentPhase !== "Prep") {
    showMessage("Can only refresh during prep phase", "error");
    return;
  }

  // Refresh animation
  unitShopGrid?.querySelectorAll("[data-shop-slot]").forEach((card) => {
    card.classList.add("refreshing");
    setTimeout(() => card.classList.remove("refreshing"), 600);
  });

  sendPrepCommand({ shopRefreshCount: 1 });
  showMessage("Refreshing shop...", "success");
}

function handleBuyXp() {
  if (currentPhase !== "Prep") {
    showMessage("Can only upgrade the special unit during prep phase", "error");
    return;
  }

  sendPrepCommand({ specialUnitUpgradeCount: 1 });
  playUiCue("purchase");
  showMessage("Upgrading special unit...", "success");
}

// Spell card declaration handler
function handleDeclareSpell() {
  if (currentPhase !== "Prep") {
    showMessage("Can only declare spell during prep phase", "error");
    return;
  }

  const selectedRadio = document.querySelector('input[name="spell-select"]:checked');
  if (!selectedRadio) {
    showMessage("Please select a spell card", "error");
    return;
  }

  const spellId = selectedRadio.value;
  declaredSpellForRound = spellId;

  // Send spell declaration to server
  if (activeRoom) {
    activeRoom.send("declare_spell", { spellId });
    showMessage(`Declared spell: ${spellId}`, "success");

    // Hide selection UI after declaration
    if (spellSelectSection) {
      spellSelectSection.style.display = "none";
    }
  }
}

// Update spell selection UI based on current round
function updateSpellSelectUI(roundIndex) {
  const spellSet = getSpellSetForRound(roundIndex);

  // Don't show for R12 (last word is auto-selected) or if no spells available
  if (!spellSelectRadios || spellSet.length === 0 || roundIndex === 12) {
    if (spellSelectSection) spellSelectSection.style.display = "none";
    return;
  }

  // Don't show if already declared for this round
  if (declaredSpellForRound) {
    if (spellSelectSection) spellSelectSection.style.display = "none";
    return;
  }

  if (spellSelectSection) spellSelectSection.style.display = "block";

  spellSelectRadios.innerHTML = spellSet.map((spell, index) => `
    <label>
      <input type="radio" name="spell-select" value="${spell.id}" ${index === 0 ? "checked" : ""}>
      <strong>${spell.name}</strong><br>
      <small>${spell.description}</small>
    </label>
  `).join("");
}

// Selection and deployment handlers
function handleBenchClick(index) {
  // Toggle selection
  if (selectedBenchIndex === index) {
    clearSelections();
  } else {
    clearSelections();
    selectedBenchIndex = index;
    const slot = benchGrid?.querySelector(`[data-bench-slot="${index}"]`);
    slot?.classList.add("selected");
    showSelectionMode("Bench unit selected. Click one of the highlighted raid cells on the Shared Battle Board to deploy it.");
    updateActionButtons();
  }
}

function deployBenchUnit(benchIndex, cellIndex) {
  if (currentPhase !== "Prep") {
    showMessage("Can only deploy during prep phase", "error");
    return;
  }

  if (!Number.isInteger(cellIndex) || cellIndex < 0) {
    showMessage("That shared-board cell is outside the current raid deployment slice. Use one of the highlighted raid cells.", "error");
    return;
  }

  sendPrepCommand({
    benchToBoardCell: {
      benchIndex: benchIndex,
      cell: cellIndex,
    },
  });
  showMessage(`Deploying bench unit to Shared Battle Board cell ${cellIndex}...`, "success");
}

function isSpecialSharedUnitId(unitId) {
  return typeof unitId === "string"
    && (unitId.startsWith("hero:") || unitId.startsWith("boss:") || unitId === "dummy-boss");
}

function resolveSelectedSharedBoardCell() {
  const selectedUnitId = getSelectedSharedUnitId();
  const sharedBoardState = getSharedBoardState();
  if (!selectedUnitId || !sharedBoardState) {
    return null;
  }

  const ownerId = sessionId ?? "";
  if (Number.isInteger(selectedSharedBoardCellIndex) && selectedSharedBoardCellIndex >= 0) {
    const selectedCellKey = String(selectedSharedBoardCellIndex);
    const selectedCell = sharedBoardState.cells?.get?.(selectedCellKey);
    if (selectedCell?.unitId === selectedUnitId && selectedCell.ownerId === ownerId) {
      return {
        cellIndex: selectedSharedBoardCellIndex,
        unitId: selectedCell.unitId,
        ownerId: selectedCell.ownerId,
      };
    }

    selectedSharedBoardCellIndex = null;
  }

  for (const [cellKey, cell] of sharedBoardState.cells?.entries?.() ?? []) {
    if (cell?.unitId !== selectedUnitId || cell.ownerId !== ownerId) {
      continue;
    }

    selectedSharedBoardCellIndex = Number.parseInt(cellKey, 10);
    return {
      cellIndex: selectedSharedBoardCellIndex,
      unitId: cell.unitId,
      ownerId: cell.ownerId,
    };
  }

  return null;
}

function resolvePlayerSubUnitTokenForCell(cellIndex) {
  if (!Number.isInteger(cellIndex) || cellIndex < 0) {
    return null;
  }

  const boardSubUnits = Array.isArray(currentPlayerState?.boardSubUnits)
    ? currentPlayerState.boardSubUnits
    : currentPlayerState?.boardSubUnits && typeof currentPlayerState.boardSubUnits[Symbol.iterator] === "function"
      ? Array.from(currentPlayerState.boardSubUnits)
      : [];

  const cellPrefix = `${cellIndex}:`;
  return boardSubUnits.find((token) => typeof token === "string" && token.startsWith(cellPrefix)) ?? null;
}

function handleSharedCellClickForManualCheck(cellIndex) {
  if (currentPhase !== "Prep") {
    showMessage("Can only change the board during Prep.", "error");
    return;
  }

  const selectedSubUnitCellIndex = getSelectedSharedSubUnitCellIndex();
  if (selectedSubUnitCellIndex !== null) {
    sendPrepCommand({
      subUnitMove: {
        fromCell: selectedSubUnitCellIndex,
        toCell: cellIndex,
        slot: "main",
      },
    });
    clearSelections();
    return;
  }

  const selectedBoardCell = resolveSelectedSharedBoardCell();
  if (
    selectedBoardCell
    && isSpecialSharedUnitId(selectedBoardCell.unitId)
    && typeof currentPlayerState?.selectedHeroId === "string"
    && currentPlayerState.selectedHeroId.length > 0
  ) {
    sendPrepCommand({ heroPlacementCell: cellIndex });
    clearSelections();
    return;
  }

  const sharedBoardState = getSharedBoardState();
  const clickedCell = sharedBoardState?.cells?.get?.(String(cellIndex));
  const ownerId = sessionId ?? "";
  const isOwnOccupiedCell = clickedCell?.ownerId === ownerId
    && typeof clickedCell?.unitId === "string"
    && clickedCell.unitId.length > 0
    && clickedCell.unitId !== "dummy-boss";
  if (isOwnOccupiedCell && selectedBoardCell?.cellIndex === cellIndex && selectedBoardCell.unitId === clickedCell.unitId) {
    selectedSharedBoardCellIndex = null;
  } else if (isOwnOccupiedCell) {
    selectedSharedBoardCellIndex = cellIndex;
  }

  handleSharedCellClick(getSharedBoardState(), cellIndex);
}

function handleSharedSubSlotClickForManualCheck(cellIndex) {
  if (currentPhase !== "Prep") {
    showMessage("Can only change the board during Prep.", "error");
    return;
  }

  if (!Number.isInteger(cellIndex) || cellIndex < 0) {
    showMessage("Could not resolve the target sub slot. Please try again.", "error");
    return;
  }

  if (selectedBenchIndex !== null) {
    sendPrepCommand({
      benchToBoardCell: {
        benchIndex: selectedBenchIndex,
        cell: cellIndex,
        slot: "sub",
      },
    });
    clearSelections();
    return;
  }

  const selectedSubUnitCellIndex = getSelectedSharedSubUnitCellIndex();
  if (selectedSubUnitCellIndex !== null) {
    if (selectedSubUnitCellIndex === cellIndex) {
      setSelectedSharedSubUnitCellIndex(null);
      return;
    }

    sendPrepCommand({
      subUnitMove: {
        fromCell: selectedSubUnitCellIndex,
        toCell: cellIndex,
        slot: "sub",
      },
    });
    clearSelections();
    return;
  }

  const selectedBoardCell = resolveSelectedSharedBoardCell();
  if (selectedBoardCell && !isSpecialSharedUnitId(selectedBoardCell.unitId)) {
    sendPrepCommand({
      boardUnitMove: {
        fromCell: selectedBoardCell.cellIndex,
        toCell: cellIndex,
        slot: "sub",
      },
    });
    clearSelections();
    return;
  }

  if (
    selectedBoardCell
    && isSpecialSharedUnitId(selectedBoardCell.unitId)
    && currentPlayerState?.selectedHeroId === "okina"
  ) {
    sendPrepCommand({ heroPlacementCell: cellIndex });
    clearSelections();
    return;
  }

  const availableSubUnitToken = resolvePlayerSubUnitTokenForCell(cellIndex);
  if (availableSubUnitToken) {
    setSelectedSharedSubUnitCellIndex(cellIndex);
    showMessage("Sub-unit selected. You can move it to the board, another sub slot, or back to the bench.", "success");
    return;
  }

  showMessage("Select a bench unit, board unit, or existing sub-unit before using this sub slot.", "error");
}

function handleSell() {
  if (currentPhase !== "Prep") {
    showMessage("Can only sell during prep phase", "error");
    return;
  }

  if (selectedBenchIndex !== null) {
    sendPrepCommand({ benchSellIndex: selectedBenchIndex });
    showMessage("Selling bench unit...", "success");
    clearSelections();
  }
}

function clearSelections() {
  selectedBenchIndex = null;
  selectedShopSlot = null;
  selectedSharedBoardCellIndex = null;
  clearSelectedSharedUnit();
  setSelectedSharedSubUnitCellIndex(null);

  document.querySelectorAll(".selected").forEach((el) => {
    el.classList.remove("selected");
  });

  hideSelectionMode();
  updateActionButtons();
}

function updateActionButtons() {
  const canSell = selectedBenchIndex !== null;
  if (sellBtn) {
    sellBtn.disabled = !canSell || currentPhase !== "Prep";
  }
}

function showSelectionMode(text) {
  if (selectionModeIndicator) {
    selectionModeIndicator.textContent = text;
    selectionModeIndicator.classList.add("active");
  }
}

function hideSelectionMode() {
  selectionModeIndicator?.classList.remove("active");
}

// Combat Log functions
function addCombatLogEntry(message, type = 'info') {
  if (!combatLogContainer) return;
  
  // Clear initial message if present
  if (combatLogContainer.querySelector('.log-entry')?.textContent?.includes('Connect to')) {
    combatLogContainer.innerHTML = '';
  }
  
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  
  combatLogContainer.appendChild(entry);
  combatLogContainer.scrollTop = combatLogContainer.scrollHeight;
  
  // Keep only last 50 entries
  while (combatLogContainer.children.length > 50) {
    combatLogContainer.removeChild(combatLogContainer.firstChild);
  }
}

// UI Update functions
function updateGameUI(state) {
  if (!state) return;

  const player = state.players?.get?.(sessionId);
  if (!player) return;
  const bossRoleSelectionEnabled = isBossRoleSelectionEnabled(state);
  const isBossPlayer = bossRoleSelectionEnabled && state.bossPlayerId === sessionId;

  currentPlayerState = player;
  const previousGold = currentGold;
  const previousHp = Number(hpDisplay.textContent) || 0;
  const previousRound = currentRound;
  currentGold = Number(player.gold) || 0;
  currentSharedPoolInventory = player.sharedPoolInventory;
  currentRound = Number(state.roundIndex) || 0;

  // Reset declared spell when round changes
  if (currentRound !== previousRound) {
    declaredSpellForRound = null;
  }

  // Update status displays
  roundDisplay.textContent = currentRound + 1;
  
  // Gold animation
  if (goldDisplay) {
    const goldChanged = previousGold !== currentGold;
    goldDisplay.textContent = currentGold;
    if (goldChanged) {
      goldDisplay.classList.add("changed");
      setTimeout(() => goldDisplay.classList.remove("changed"), 400);
    }
  }
  
  // HP animation and damage popup
  if (hpDisplay) {
    const newHp = Number(player.hp) || 0;
    const hpDiff = newHp - previousHp;
    hpDisplay.textContent = newHp;
    if (hpDiff < 0) {
      hpDisplay.classList.add("damage");
      setTimeout(() => hpDisplay.classList.remove("damage"), 600);
      // Show damage popup
      showPlayerDamagePopup(hpDiff);
    } else if (hpDiff > 0) {
      hpDisplay.classList.add("heal");
      setTimeout(() => hpDisplay.classList.remove("heal"), 600);
      // Show heal popup
      showPlayerDamagePopup(hpDiff);
    }
  }
  
  const specialUnitLevel = getClientSpecialUnitLevel(player);
  const nextSpecialUnitUpgradeCost = getClientSpecialUnitUpgradeCost(player);
  levelDisplay.textContent = String(specialUnitLevel);
  xpDisplay.textContent = nextSpecialUnitUpgradeCost === null ? "MAX" : String(nextSpecialUnitUpgradeCost);

  // Update phase display
  updatePhaseDisplay(readPhase(state.phase));

  // Update ready count
  const players = state.players || new Map();
  let readyCount = 0;
  let totalCount = 0;
  players.forEach((p) => {
    if (p.isSpectator) {
      return;
    }
    totalCount++;
    if (p.ready) readyCount++;
  });
  if (readyCountDisplay) {
    readyCountDisplay.textContent = `${readyCount}/${totalCount} Ready`;
  }

  // Update ready button
  const isReady = Boolean(player.ready);
  if (readyBtn) {
    readyBtn.disabled = player.isSpectator === true;
    if (isReady) {
      readyBtn.classList.remove("not-ready");
      readyBtn.classList.add("ready");
      readyBtn.textContent = "Cancel Ready";
    } else {
      readyBtn.classList.remove("ready");
      readyBtn.classList.add("not-ready");
      readyBtn.textContent = "Ready";
    }
  }

  if (readyHint) {
    readyHint.textContent = buildReadyHint({
      phase: readPhase(state.phase),
      isReady,
      heroEnabled: state.featureFlagsEnableHeroSystem === true,
      heroSelected: Boolean(player.selectedHeroId),
      bossRoleSelectionEnabled,
      lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
      isBossPlayer,
      bossSelected: Boolean(player.selectedBossId),
      readyCount,
      totalCount,
    });
  }
  updateEntryFlowStatus(state, player);
  renderBossRoleSelectionState(state, player);

  // Update unit shop
  updateUnitShop(player.shopOffers);

  // Update boss shop
  updateBossShop(
    player.bossShopOffers,
    state.featureFlagsEnableBossExclusiveShop === true && state.bossPlayerId === sessionId,
  );

  updateHeroExclusiveShop(
    player.heroExclusiveShopOffers,
    state.featureFlagsEnableHeroSystem === true
      && player.role === "raid"
      && typeof player.selectedHeroId === "string"
      && player.selectedHeroId.length > 0,
    typeof player.selectedHeroId === "string" ? player.selectedHeroId : "",
  );

  // Update bench
  updateBench(player.benchUnits);

  // Update synergies
  updateSynergyDisplay(player.activeSynergies);

  // Update timer for Prep phase
  if (state.phase === 'Prep' && state.prepDeadlineAtMs) {
    startPrepTimer(state.prepDeadlineAtMs);
  } else if (timerInterval && state.phase !== 'Prep') {
    clearInterval(timerInterval);
    timerInterval = null;
    const timerDisplay = document.querySelector("[data-timer-display]");
    if (timerDisplay) timerDisplay.textContent = '';
  }

  // Check for battle result
  const battleResult = player.lastBattleResult;
  const hasBattleResult = Boolean(
    battleResult?.opponentId
      && Number.isFinite(Number(state.roundIndex))
      && Number(state.roundIndex) > 0,
  );
  if (hasBattleResult) {
    // Only show once per round (track last shown round)
    if (lastShownBattleRound !== state.roundIndex) {
      lastShownBattleRound = state.roundIndex;
      
      const isVictory = battleResult.won === true;
      
      // Show battle result overlay
      showBattleResult(isVictory, battleResult);
      
      // Also log to combat log
      const resultText = isVictory ? '🏆 VICTORY!' : '💀 DEFEAT';
      const type = isVictory ? 'win' : 'lose';
      const roundNumber = Number(state.roundIndex) + 1;
      
      addCombatLogEntry(`--- Round ${roundNumber} ---`, 'info');
      addCombatLogEntry(`${resultText} vs Player`, type);
      addCombatLogEntry(`Survivors: ${battleResult.survivors} vs ${battleResult.opponentSurvivors}`, 'info');
      addCombatLogEntry(`Damage: ${isVictory ? '+' : '-'}${battleResult.damageTaken} HP`, type);
    }
  }

  maybeShowRoundSummary(state);

  // Update next command sequence
  if (typeof player.lastCmdSeq === "number") {
    nextCmdSeq = player.lastCmdSeq + 1;
  }

  if (state.phase === "Waiting" && state.lobbyStage === "preference") {
    heroSelectionConfirmed = false;
    bossSelectionConfirmed = false;
  }

  if (bossRoleSelectionEnabled && state.phase === "Waiting" && state.lobbyStage === "selection") {
    if (isBossPlayer) {
      if (!player.selectedBossId && !bossSelectionConfirmed) {
        showBossSelection();
      } else {
        hideBossSelection();
      }
      hideHeroSelection();
    } else if (player.role === "raid" && !player.selectedHeroId && !heroSelectionConfirmed) {
      hideBossSelection();
      showHeroSelection();
    } else {
      hideBossSelection();
      hideHeroSelection();
    }
  } else if (
    state.featureFlagsEnableHeroSystem
    && state.phase === "Waiting"
    && !bossRoleSelectionEnabled
    && !player.selectedHeroId
    && !heroSelectionConfirmed
  ) {
    hideBossSelection();
    showHeroSelection();
  } else {
    hideBossSelection();
    hideHeroSelection();
  }

  // Update hero display
  if (state.featureFlagsEnableHeroSystem && player.selectedHeroId) {
    const hero = HEROES.find((h) => h.id === player.selectedHeroId);
    if (hero && heroSection) {
      heroSection.style.display = "block";
      if (heroNameDisplay) heroNameDisplay.textContent = hero.name;
      if (heroRoleDisplay) heroRoleDisplay.textContent = hero.role;
      if (heroHpDisplay) heroHpDisplay.textContent = hero.hp;
      if (heroAttackDisplay) heroAttackDisplay.textContent = hero.attack;
      const roleIcon = HERO_ROLE_ICONS[hero.role] || "❓";
      const heroIcon = heroSection.querySelector(".hero-icon");
      if (heroIcon) heroIcon.textContent = roleIcon;
    }
  } else if (heroSection) {
    heroSection.style.display = "none";
  }

  // Update spell card display
  if (state.featureFlagsEnableSpellCard && state.declaredSpellId) {
    const spell = SPELL_CARDS.find((s) => s.id === state.declaredSpellId);
    if (spell && spellCardSection) {
      spellCardSection.style.display = "block";
      if (spellNameDisplay) spellNameDisplay.textContent = spell.name;
      if (spellDescDisplay) spellDescDisplay.textContent = spell.description;
    }
  } else if (spellCardSection) {
    spellCardSection.style.display = "none";
  }

  // Update spell card selection UI (only in Prep phase)
  if (state.featureFlagsEnableSpellCard && state.phase === "Prep") {
    updateSpellSelectUI(state.roundIndex);
  } else if (spellSelectSection) {
    spellSelectSection.style.display = "none";
  }

  updateRaidBoardPresentation(state);
}

function updateRaidBoardPresentation(state) {
  if (sharedBoardGrid) {
    sharedBoardGrid.dataset.sharedBoardMode = "canonical";
    sharedBoardGrid.dataset.currentPhase = readPhase(state?.phase) || "Waiting";
  }

  const sharedBoardMode = typeof state?.sharedBoardMode === "string" ? state.sharedBoardMode : "local";
  const readableMode = sharedBoardMode === "half-shared" ? "Half Shared"
    : sharedBoardMode === "shadow" ? "Shadow"
      : "Local";

  if (raidBoardModeBadge) {
    raidBoardModeBadge.textContent = `Mode: ${readableMode}`;
    raidBoardModeBadge.className = "phase-hp-result mode-badge";
  }

  const playerEntries = mapEntries(state?.players).map(([, player]) => player);
  const remainingLives = playerEntries
    .map((player) => Number(player?.remainingLives))
    .filter((value) => Number.isFinite(value) && value > 0);
  const maxRemainingLives = remainingLives.length > 0 ? Math.max(...remainingLives) : 0;

  if (raidLivesDisplay) {
    raidLivesDisplay.textContent = String(maxRemainingLives);
  }

  if (finalJudgmentBanner) {
    const phase = readPhase(state?.phase);
    const ranking = Array.isArray(state?.ranking) ? state.ranking : [];
    const bossPlayerId = typeof state?.bossPlayerId === "string" ? state.bossPlayerId : "";
    const finalJudgmentText = buildFinalJudgmentCopy({
      phase,
      ranking,
      bossPlayerId,
      raidPlayerIds: state?.raidPlayerIds,
      roundIndex: Number(state?.roundIndex),
    });

    finalJudgmentBanner.textContent = finalJudgmentText;
    finalJudgmentBanner.className = "phase-hp-result pending";

    if (finalJudgmentText.includes("Boss Victory")) {
      finalJudgmentBanner.className = "phase-hp-result boss-victory";
    } else if (finalJudgmentText.includes("Raid Victory")) {
      finalJudgmentBanner.className = "phase-hp-result raid-victory";
    }
  }
}

function updatePhaseDisplay(phase) {
  if (!phaseDisplay) return;

  const previousPhase = phaseDisplay.textContent;
  
  phaseDisplay.textContent = phase || "Waiting";
  phaseDisplay.className = "phase-indicator";

  if (phase) {
    phaseDisplay.classList.add(phase.toLowerCase());
  } else {
    phaseDisplay.classList.add("waiting");
  }
  
  // Phase change animation
  if (previousPhase !== phase && phaseTransitionOverlay) {
    // Remove existing animation class
    phaseTransitionOverlay.classList.remove("active");
    
    // Set phase color
    const phaseColorMap = {
      'Prep': '#27ae60',
      'Battle': '#e74c3c',
      'Settle': '#f39c12',
      'Elimination': '#9b59b6',
      'End': '#3498db',
    };
    phaseTransitionOverlay.style.setProperty('--phase-color', phaseColorMap[phase] || '#27ae60');
    
    // Trigger reflow and add animation class
    void phaseTransitionOverlay.offsetWidth;
    phaseTransitionOverlay.classList.add("active");
    
    // Pulse animation on phase indicator
    phaseDisplay.classList.add("phase-changed");
    setTimeout(() => {
      phaseDisplay.classList.remove("phase-changed");
    }, 600);
  }
  
  // Log phase changes
  if (previousPhase !== phase) {
    if (phase === 'Prep') {
      addCombatLogEntry('🛒 Prep phase started - Buy and deploy units!', 'info');
    } else if (phase === 'Battle') {
      addCombatLogEntry('⚔️ Battle phase started!', 'info');
      // Trigger battle start animation
      triggerBattleStartAnimation();
    } else if (phase === 'Settle') {
      addCombatLogEntry('📊 Settling scores...', 'info');
    }
  }
}

/**
 * Shows the battle start animation overlay with text and board effects
 * Animation lasts 1.2 seconds and auto-hides
 */
function triggerBattleStartAnimation() {
  if (!battleStartOverlay) {
    return;
  }

  playUiCue("battle-start");

  // Show the overlay
  battleStartOverlay.classList.add('visible');

  const sharedBoardSection = document.querySelector('.shared-board-section');

  if (sharedBoardSection) {
    sharedBoardSection.classList.remove('battle-start');
    void sharedBoardSection.offsetWidth; // Trigger reflow
    sharedBoardSection.classList.add('battle-start');
  }

  // Auto-hide after animation completes (1.2s)
  setTimeout(() => {
    battleStartOverlay.classList.remove('visible');

    if (sharedBoardSection) {
      sharedBoardSection.classList.remove('battle-start');
    }
  }, 1200);
}

function updatePhaseHpProgressFromMessage(message) {
  const targetValue = Number(message?.phaseHpTarget);

  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    latestPhaseHpProgress = null;
    renderPhaseHpProgress(null);
    return;
  }

  const damageValue = Number(message?.phaseDamageDealt);
  const rateValue = Number(message?.phaseCompletionRate);
  const resultValue = parsePhaseResult(message?.phaseResult);
  const safeDamage = Number.isFinite(damageValue) ? Math.max(0, damageValue) : 0;
  const safeRate = Number.isFinite(rateValue) ? Math.max(0, rateValue) : safeDamage / targetValue;

  latestPhaseHpProgress = {
    targetHp: targetValue,
    damageDealt: safeDamage,
    completionRate: safeRate,
    result: resultValue,
  };

  renderPhaseHpProgress(latestPhaseHpProgress);
}

function renderPhaseHpProgress(progress) {
  if (!phaseHpSection || !phaseHpValue || !phaseHpFill || !phaseHpResult) {
    return;
  }

  const copy = buildPhaseHpCopy(progress);

  if (!progress) {
    phaseHpSection.style.display = "block";
    phaseHpFill.style.width = "0%";
    phaseHpFill.classList.remove("pending", "success", "failed");
    phaseHpFill.classList.add("pending");
    phaseHpResult.classList.remove("pending", "success", "failed");
    phaseHpResult.classList.add("pending");
    phaseHpResult.textContent = copy.resultText || PHASE_RESULT_LABELS.pending;
    phaseHpValue.textContent = copy.valueText;
    if (phaseHpHelp) {
      phaseHpHelp.textContent = copy.helperText;
    }
    return;
  }

  phaseHpSection.style.display = "block";

  const completionRate = Math.max(0, progress.completionRate);
  const visiblePercent = Math.round(Math.min(1, completionRate) * 100);
  phaseHpValue.textContent = copy.valueText;
  phaseHpFill.style.width = `${visiblePercent}%`;
  phaseHpFill.classList.remove("pending", "success", "failed");
  phaseHpFill.classList.add(progress.result);

  phaseHpResult.classList.remove("pending", "success", "failed");
  phaseHpResult.classList.add(progress.result);
  phaseHpResult.textContent = copy.resultText || PHASE_RESULT_LABELS[progress.result];
  if (phaseHpHelp) {
    phaseHpHelp.textContent = copy.helperText;
  }
}

function hideRoundSummary() {
  if (!roundSummaryOverlay) {
    return;
  }

  roundSummaryOverlay.classList.remove("visible");

  if (roundSummaryAutoHideTimeout !== null) {
    clearTimeout(roundSummaryAutoHideTimeout);
    roundSummaryAutoHideTimeout = null;
  }
}

/**
 * Shows battle result overlay with victory/defeat status and damage stats
 * @param {boolean} isVictory - Whether the player won
 * @param {Object} battleResult - Battle result data with damageDealt and damageTaken
 */
function showBattleResult(isVictory, battleResult) {
  if (!battleResultOverlay || !battleResultTitle || !battleDamageDealt || !battleDamageTaken) {
    return;
  }

  playUiCue(isVictory ? "victory" : "defeat");

  // Clear any existing auto-hide timeout
  if (battleResultAutoHideTimeout !== null) {
    clearTimeout(battleResultAutoHideTimeout);
    battleResultAutoHideTimeout = null;
  }

  // Remove any existing animation classes
  battleResultOverlay.classList.remove("hiding");
  
  // Set title and styling based on result
  const copy = buildBattleResultCopy({ isVictory, battleResult });
  battleResultTitle.textContent = copy.title;
  battleResultOverlay.classList.remove("victory", "defeat");
  battleResultOverlay.classList.add(isVictory ? "victory" : "defeat");
  
  // Set damage statistics
  battleDamageDealt.textContent = copy.damageDealt;
  battleDamageTaken.textContent = copy.damageTaken;
  if (battleResultSubtitle) {
    battleResultSubtitle.textContent = copy.subtitle;
  }
  if (battleResultHint) {
    battleResultHint.textContent = copy.hint;
  }
  
  // Show the overlay
  battleResultOverlay.classList.add("visible");
  
  // Auto-hide after 3 seconds
  battleResultAutoHideTimeout = setTimeout(() => {
    hideBattleResult();
  }, 4500);
}

/**
 * Hides the battle result overlay with exit animation
 */
function hideBattleResult() {
  if (!battleResultOverlay) {
    return;
  }
  
  // Add exit animation
  battleResultOverlay.classList.add("hiding");
  
  // Remove visible class after animation completes
  setTimeout(() => {
    battleResultOverlay.classList.remove("visible", "hiding", "victory", "defeat");
  }, 300);
  
  if (battleResultAutoHideTimeout !== null) {
    clearTimeout(battleResultAutoHideTimeout);
    battleResultAutoHideTimeout = null;
  }
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

function showRoundSummary(roundIndex, ranking) {
  if (!roundSummaryOverlay || !roundSummaryRound || !roundSummaryList) {
    return;
  }

  roundSummaryRound.textContent = `Round ${roundIndex + 1}`;
  if (roundSummaryCaption) {
    roundSummaryCaption.textContent = buildRoundSummaryCaption({ ranking, sessionId });
  }
  if (roundSummaryTip) {
    roundSummaryTip.textContent = buildRoundSummaryTip({ ranking, sessionId });
  }
  roundSummaryList.innerHTML = "";

  for (let index = 0; index < ranking.length; index += 1) {
    const entry = ranking[index];

    if (!entry) {
      continue;
    }

    const item = document.createElement("div");
    item.className = "round-summary-item";

    const left = document.createElement("div");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${index + 1}`;

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = entry.playerId === sessionId
      ? `${shortPlayerId(entry.playerId)} (you)`
      : shortPlayerId(entry.playerId);

    left.append(rank, name);

    const damage = document.createElement("span");
    damage.className = "damage";
    damage.textContent = `${entry.damageDealt}`;

    item.append(left, damage);
    roundSummaryList.appendChild(item);
  }

  roundSummaryOverlay.classList.add("visible");

  if (roundSummaryAutoHideTimeout !== null) {
    clearTimeout(roundSummaryAutoHideTimeout);
  }

  roundSummaryAutoHideTimeout = setTimeout(() => {
    roundSummaryAutoHideTimeout = null;
    hideRoundSummary();
  }, 6000);
}

function maybeShowRoundSummary(state) {
  const phase = readPhase(state?.phase);
  const roundIndex = Number(state?.roundIndex);

  if (phase !== "Settle" || !Number.isInteger(roundIndex)) {
    return;
  }

  if (lastShownSummaryRound === roundIndex) {
    return;
  }

  const ranking = buildRoundDamageRanking(state?.players);

  if (ranking.length === 0) {
    return;
  }

  showRoundSummary(roundIndex, ranking);
  lastShownSummaryRound = roundIndex;
}

function updateSynergyDisplay(synergies) {
  // Find or create synergy container
  let container = document.querySelector("[data-synergy-display]");
  if (!container) {
    container = document.createElement('div');
    container.setAttribute('data-synergy-display', '');
    container.className = 'synergy-display';
    container.style.cssText = 'display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;';
    
    // Insert after status bar
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
      statusBar.after(container);
    }
    return;
  }
  
  container.innerHTML = '';
  
  if (!synergies || synergies.length === 0) return;
  
  const icons = { vanguard: '🛡️', ranger: '🏹', mage: '✨', assassin: '🗡️', scarletMansion: '🦇' };
  const labels = {
    vanguard: 'vanguard',
    ranger: 'ranger',
    mage: 'mage',
    assassin: 'assassin',
    scarletMansion: '紅魔館',
  };
  const descriptions = {
    scarletMansion: SCARLET_MANSION_DATA.synergyDescription,
  };
  
  for (const syn of synergies) {
    const div = document.createElement('div');
    div.className = `synergy-item tier-${syn.tier}`;
    div.style.cssText = `
      padding: 5px 10px;
      background: ${syn.tier > 0 ? 'rgba(39, 174, 96, 0.3)' : 'rgba(255,255,255,0.1)'};
      border-radius: 5px;
      font-size: 12px;
    `;
    div.innerHTML = `
      <div>${icons[syn.unitType] || '?'} ${labels[syn.unitType] || syn.unitType}: ${syn.count} ${'★'.repeat(syn.tier)}</div>
      ${descriptions[syn.unitType] ? `<div class="scarlet-synergy-description">${descriptions[syn.unitType]}</div>` : ''}
    `;
    container.appendChild(div);
  }
}

function startPrepTimer(deadlineMs) {
  // Clear existing interval
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  if (!deadlineMs) return;
  
  const timerDisplay = document.querySelector("[data-timer-display]");
  if (!timerDisplay) {
    // Create timer display if not exists
    const timer = document.createElement('div');
    timer.setAttribute('data-timer-display', '');
    timer.className = 'timer-display';
    timer.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #f39c12;
      margin-left: 20px;
    `;
    
    const statusLeft = document.querySelector('.status-left');
    if (statusLeft) {
      statusLeft.appendChild(timer);
    }
  }
  
  const updateTimer = () => {
    const now = Date.now();
    const remaining = Math.max(0, deadlineMs - now);
    const seconds = Math.ceil(remaining / 1000);
    
    const display = document.querySelector("[data-timer-display]");
    if (display) {
      display.textContent = `⏱️ ${seconds}s`;
      display.style.color = seconds <= 10 ? '#e74c3c' : '#f39c12';
    }
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function updateUnitShop(offers) {
  if (!offers || !unitShopGrid) return;

  offers.forEach((offer, index) => {
    const card = unitShopGrid.querySelector(`[data-shop-slot="${index}"]`);
    if (!card) return;

    if (offer) {
      const cost = offer.cost || 0;
      const canAfford = currentGold >= cost;
      const rumorBadge = offer.isRumorUnit === true ? '<div class="rumor-badge">Rumor</div>' : "";
      const displayName = offer.displayName || offer.unitType;
      const portraitUrl = resolveShopPortraitUrl(offer);

      // 共有プールの在庫チェック
      let isDepleted = false;
      let remainingCount = null;
      if (currentSharedPoolInventory && currentSharedPoolInventory instanceof Map) {
        remainingCount = currentSharedPoolInventory.get(offer.unitType) ?? 0;
        isDepleted = remainingCount <= 0;
      }

      card.innerHTML = `
        <div class="shop-card-media">
          <img class="shop-portrait" src="${portraitUrl}" alt="${displayName}" loading="lazy" />
        </div>
        <div class="name">${displayName}</div>
        <div class="cost">${cost}G</div>
        ${remainingCount !== null ? `<div class="pool-badge">残り${remainingCount}枚</div>` : ''}
        ${rumorBadge}
      `;
      card.classList.toggle("disabled", !canAfford || currentPhase !== "Prep" || isDepleted);
      card.classList.toggle("depleted", isDepleted);
    } else {
      card.innerHTML = `
        <div class="shop-card-media">
          <img class="shop-portrait" src="${resolveShopPortraitUrl(null)}" alt="Unknown unit" loading="lazy" />
        </div>
        <div class="name">-</div>
        <div class="cost">-</div>
      `;
      card.classList.add("disabled");
    }
  });
}

function updateBossShop(offers, visible) {
  if (!bossShopSection || !bossShopGrid) {
    return;
  }

  bossShopSection.style.display = visible ? "block" : "none";
  if (!visible) {
    offers = [];
  }

  for (let index = 0; index < 2; index += 1) {
    const card = bossShopGrid.querySelector(`[data-boss-shop-slot="${index}"]`);
    if (!card) {
      continue;
    }

    const offer = Array.isArray(offers) ? offers[index] : offers?.[index];
    const hasOffer = Boolean(offer) && visible;
    const isPurchased = offer?.purchased === true;
    const badgeText = hasOffer ? "EXCLUSIVE" : "";
    const soldText = isPurchased ? "SOLD" : "";

    card.classList.toggle("boss-exclusive", hasOffer);
    card.classList.toggle("is-purchased", isPurchased);

    if (!hasOffer) {
      card.innerHTML = `
        <span class="boss-shop-badge">${badgeText}</span>
        <div class="icon">❓</div>
        <div class="name">-</div>
        <div class="cost">-</div>
        <span class="boss-shop-sold" aria-hidden="true">${soldText}</span>
      `;
      card.classList.add("disabled");
      continue;
    }

    const cost = offer.cost || 0;
    const canAfford = currentGold >= cost && !isPurchased;
    const displayName = SCARLET_MANSION_DATA.displayNames[offer.unitType] || offer.unitType;
    const portraitUrl = resolveShopPortraitUrl(offer, "Remilia");
    const details = SCARLET_MANSION_DATA.cardDetails[offer.unitType] || null;
    card.innerHTML = `
      <span class="boss-shop-badge">${badgeText}</span>
      <div class="scarlet-badge">紅魔館</div>
      <div class="shop-card-media">
        <img class="shop-portrait" src="${portraitUrl}" alt="${displayName}" loading="lazy" />
      </div>
      <div class="name">${displayName}</div>
      ${details ? `<div class="boss-shop-role">${details.role}</div>` : ''}
      <div class="cost">${cost}G</div>
      ${details ? `<div class="boss-shop-skill">${details.skillDescription}</div>` : ''}
      ${details ? `<div class="boss-shop-flavor">${details.flavorText}</div>` : ''}
      <span class="boss-shop-sold" aria-hidden="true">${soldText}</span>
    `;
    card.classList.toggle("disabled", !canAfford || currentPhase !== "Prep");
  }
}

function updateHeroExclusiveShop(offers, visible, selectedHeroId = "") {
  if (!heroExclusiveShopSection || !heroExclusiveShopGrid) {
    return;
  }

  heroExclusiveShopSection.style.display = visible ? "block" : "none";
  if (!visible) {
    offers = [];
  }

  for (let index = 0; index < 1; index += 1) {
    const card = heroExclusiveShopGrid.querySelector(`[data-hero-exclusive-shop-slot="${index}"]`);
    if (!card) {
      continue;
    }

    const offer = Array.isArray(offers) ? offers[index] : offers?.[index];
    const hasOffer = Boolean(offer) && visible;
    const isPurchased = offer?.purchased === true;
    const badgeText = hasOffer ? "EXCLUSIVE" : "";
    const soldText = isPurchased ? "SOLD" : "";

    card.classList.toggle("boss-exclusive", hasOffer);
    card.classList.toggle("is-purchased", isPurchased);

    if (!hasOffer) {
      card.innerHTML = `
        <span class="boss-shop-badge">${badgeText}</span>
        <div class="icon">❓</div>
        <div class="name">-</div>
        <div class="cost">-</div>
        <span class="boss-shop-sold" aria-hidden="true">${soldText}</span>
      `;
      card.classList.add("disabled");
      continue;
    }

    const cost = offer.cost || 0;
    const canAfford = currentGold >= cost && !isPurchased;
    const displayName = HEROES.find((hero) => hero.id === selectedHeroId)?.name || "Hero";
    const portraitUrl = resolveShopPortraitUrl(offer, displayName);
    const safeDisplayName = escapeHtml(offer.displayName || offer.unitType || "Unknown");

    card.innerHTML = `
      <span class="boss-shop-badge">${badgeText}</span>
      <div class="shop-card-media">
        <img class="shop-portrait" src="${portraitUrl}" alt="${safeDisplayName}" loading="lazy" />
      </div>
      <div class="name">${safeDisplayName}</div>
      <div class="cost">${escapeHtml(String(cost))}G</div>
      <span class="boss-shop-sold" aria-hidden="true">${soldText}</span>
    `;
    card.classList.toggle("disabled", !canAfford || currentPhase !== "Prep");
  }
}

function updateBench(benchUnits) {
  // Clear all slots
  benchGrid?.querySelectorAll("[data-bench-slot]").forEach((slot) => {
    const index = slot.dataset.benchSlot;
    slot.innerHTML = `<span class="slot-number">${index}</span>`;
    slot.classList.add("empty");
  });

  if (!benchUnits) return;

  // Convert to array if needed
  const units = Array.isArray(benchUnits) ? benchUnits : Array.from(benchUnits);

  units.forEach((unit, index) => {
    if (index >= 9) return;

    const slot = benchGrid?.querySelector(`[data-bench-slot="${index}"]`);
    if (!slot) return;

    // Parse unit type and unit level (format: "unitType:unitLevel" or "unitType")
    const unitStr = String(unit);
    let unitType = unitStr;
    let unitLevel = 1;

    const levelMatch = unitStr.match(/(.+?):(\d+)$/);
    if (levelMatch) {
      unitType = levelMatch[1];
      unitLevel = Number.parseInt(levelMatch[2], 10);
    }

    const icon = UNIT_ICONS[unitType] || "❓";
    const levelClass = `level-tier-${Math.min(unitLevel, 3)}`;

    slot.innerHTML = `
      <span class="slot-number">${index}</span>
      <div class="unit-icon">${icon}</div>
      <div class="unit-level-badge ${levelClass}">Lv${unitLevel}</div>
    `;
    slot.classList.remove("empty");
  });
}

function handleCommandResult(result) {
  if (result?.accepted === true) {
    showMessage(buildCommandResultCopy({ accepted: true }), "success");
  } else if (result?.accepted === false) {
    const hint = buildRejectHint(result.code);
    showMessage(buildCommandResultCopy({ accepted: false, code: result.code, hint }), "error");
  }
}

function createCorrelationId(scope, sequence = 0) {
  const nowMs = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const shortSession = sessionId ? shortPlayerId(sessionId) : "anon";
  return `corr_${scope}_${shortSession}_${sequence}_${nowMs}_${suffix}`;
}

function showMessage(text, type) {
  if (!messageBar) return;

  messageBar.textContent = text;
  messageBar.className = `message-bar ${type}`;

  setTimeout(() => {
    messageBar.classList.add("hidden");
  }, 3000);
}

function updateEntryFlowStatus(state, player) {
  if (!connectionGuide && !entryFlowStatus) {
    return;
  }

  const safePhase = readPhase(state?.phase ?? currentPhase);
  const heroEnabled = state?.featureFlagsEnableHeroSystem === true;
  const heroSelected = Boolean(player?.selectedHeroId);
  const bossRoleSelectionEnabled = isBossRoleSelectionEnabled(state);
  const bossSelected = Boolean(player?.selectedBossId);
  const isBossPlayer = bossRoleSelectionEnabled && state?.bossPlayerId === sessionId;
  const isReady = Boolean(player?.ready);
  const connected = Boolean(activeRoom && isRoomConnectionOpen(activeRoom));
  const text = buildEntryFlowStatus({
    connected,
    connecting,
    phase: safePhase,
    heroEnabled,
    heroSelected,
    bossRoleSelectionEnabled,
    lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
    isBossPlayer,
    bossSelected,
    isReady,
  });

  if (connectionGuide) {
    connectionGuide.textContent = text;
  }

  if (entryFlowStatus) {
    entryFlowStatus.textContent = text;
  }
}

function isBossRoleSelectionEnabled(state) {
  return (
    state?.featureFlagsEnableBossExclusiveShop === true
    && state?.featureFlagsEnableHeroSystem === true
  );
}

function getBossCharacter(bossId = "remilia") {
  return BOSS_CHARACTERS.find((boss) => boss.id === bossId) ?? BOSS_CHARACTERS[0];
}

function renderBossRoleSelectionState(state, player) {
  const enabled = isBossRoleSelectionEnabled(state);
  const waitingPhase = state?.phase === "Waiting";
  const visible = enabled && waitingPhase;

  bossLobbyPanel?.classList.toggle("visible", visible);

  if (!visible) {
    return;
  }

  const wantsBossPlayers = mapEntries(state?.players)
    .filter(([, currentPlayer]) => currentPlayer?.isSpectator !== true && currentPlayer?.wantsBoss === true)
    .map(([playerId]) => shortPlayerId(playerId));
  const wantsBoss = player?.wantsBoss === true;
  const isBossPlayer = state.bossPlayerId === sessionId;
  const roleCopyText = buildLobbyRoleCopy({
    lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
    isBossPlayer,
    heroSelected: Boolean(player?.selectedHeroId),
    bossSelected: Boolean(player?.selectedBossId),
  });

  if (bossPreferenceToggle) {
    bossPreferenceToggle.textContent = wantsBoss ? "Boss希望: ON" : "Boss希望: OFF";
    bossPreferenceToggle.disabled = state?.lobbyStage !== "preference";
  }

  if (bossPreferenceSummary) {
    bossPreferenceSummary.textContent = `Boss希望者: ${wantsBossPlayers.length}`;
  }

  if (bossPreferenceList) {
    bossPreferenceList.textContent = wantsBossPlayers.length > 0
      ? `希望中: ${wantsBossPlayers.join(", ")}`
      : "まだ誰も希望していません";
  }

  if (bossRoleCopy) {
    bossRoleCopy.textContent = roleCopyText;
  }
}

// Legacy support functions
function initializeDefaults() {
  const params = searchParams();

  autoConfig.autoConnect = parseAutoFlag(params.get("autoconnect"));
  autoConfig.autoReady = parseAutoFlag(params.get("autoReady"));
  autoConfig.autoPrep = parseAutoFlag(params.get("autoPrep"));
  autoConfig.autoDelayMs = parseAutoDelayMs(params.get("autoDelayMs"));
  autoConfig.autoFillBots = parseAutoFillBots(params.get("autoFillBots"));

  if (endpointInput) {
    endpointInput.value =
      params.get("endpoint") ??
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
  }

  if (roomInput) {
    roomInput.value = params.get("roomName") ?? DEFAULT_ROOM_NAME;
  }

  if (roomCodeInput) {
    roomCodeInput.value = params.get("roomId") ?? "";
  }

  updateRoomCodeDisplay("");

  if (setIdSelect) {
    const setId = normalizeSetId(params.get("setId"));
    setIdSelect.value = setId ?? "";
  }

  if (autoFillInput) {
    autoFillInput.value = String(autoConfig.autoFillBots);
  }

  if (autoConfig.autoConnect) {
    void connect();
  }
}

function readConfig() {
  const endpointValue = endpointInput?.value?.trim();
  const roomValue = roomInput?.value?.trim();
  const roomCode = roomCodeInput?.value?.trim() ?? "";
  const selectedSetId = setIdSelect?.value?.trim() ?? "";
  const autoFillBots = parseAutoFillBots(autoFillInput?.value ?? "0");

  autoConfig.autoFillBots = autoFillBots;

    return {
      endpoint:
        endpointValue ||
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`,
      roomName: roomValue || DEFAULT_ROOM_NAME,
      roomCode,
      setId: normalizeSetId(selectedSetId),
      autoFillBots,
    };
}

function updateRoomCodeDisplay(roomCode) {
  if (!roomCodeOutput) {
    return;
  }

  roomCodeOutput.textContent = roomCode && roomCode.length > 0 ? roomCode : "-";
}

function normalizeSetId(value) {
  if (!value || !VALID_SET_IDS.has(value)) {
    return undefined;
  }
  return value;
}

function searchParams() {
  return new URLSearchParams(location.search);
}

function syncButtonAvailability() {
  if (activeRoom && !isRoomConnectionOpen(activeRoom)) {
    activeRoom = null;
    sessionId = null;
    currentPhase = null;
    latestPhaseHpProgress = null;
    leaveSharedBoardRoom();
    updateRoomCodeDisplay("");
    renderPhaseHpProgress(null);
    gameContainer?.classList.remove("connected");
  }

  const connected = Boolean(activeRoom);
  const prepPhase = currentPhase === "Prep";
  const player =
    sessionId
      ? currentGameState?.players?.get?.(sessionId) ?? currentGameState?.players?.[sessionId]
      : null;
  const isSpectator = player?.isSpectator === true;

  if (connectButton) {
    connectButton.disabled = connecting || connected;
  }

  if (leaveButton) {
    leaveButton.disabled = connecting || !connected;
  }

  if (readyBtn) {
    readyBtn.disabled = connecting || !connected || isSpectator;
  }

  if (sellBtn) {
    sellBtn.disabled = !connected || !prepPhase || selectedBenchIndex === null;
  }

  if (refreshShopBtn) {
    refreshShopBtn.disabled = !connected || !prepPhase;
  }

  if (buyXpBtn) {
    buyXpBtn.disabled = !connected || !prepPhase;
  }

  // Disable shop cards if not in prep phase
  unitShopGrid?.querySelectorAll(".shop-card").forEach((card) => {
    card.classList.toggle("disabled", !prepPhase);
  });

  if (autoFillInput) {
    autoFillInput.disabled = connecting || connected;
  }
}

function readPhase(value) {
  if (
    value === "Waiting" ||
    value === "Prep" ||
    value === "Battle" ||
    value === "Settle" ||
    value === "Elimination" ||
    value === "End"
  ) {
    return value;
  }
  return null;
}

function mapEntries(mapLike) {
  if (!mapLike) {
    return [];
  }

  if (typeof mapLike.entries === "function") {
    try {
      return Array.from(mapLike.entries());
    } catch {
      return [];
    }
  }

  return Object.entries(mapLike);
}

function mapGet(mapLike, key) {
  if (!mapLike) {
    return null;
  }

  const stringKey = String(key);

  if (typeof mapLike.get === "function") {
    try {
      return mapLike.get(stringKey) ?? null;
    } catch {
      return null;
    }
  }

  return mapLike[stringKey] ?? null;
}

function shortPlayerId(value) {
  if (!value) {
    return "-";
  }

  return String(value).slice(0, 6);
}

/**
 * Creates and displays a floating damage/heal popup
 * @param {number} amount - The amount to display (positive for heal, negative for damage)
 * @param {HTMLElement} targetElement - The element to position the popup near
 * @param {boolean} isCritical - Whether this is a critical hit (optional)
 */
function showDamagePopup(amount, targetElement, isCritical = false) {
  if (!targetElement || !document.body) return;

  const popup = document.createElement("div");
  popup.className = "damage-popup";
  
  // Determine type and styling
  if (amount > 0) {
    popup.classList.add("heal");
    popup.textContent = `+${amount}`;
  } else if (amount < 0) {
    popup.classList.add("damage");
    popup.textContent = `${amount}`;
  } else {
    // Zero damage, don't show
    return;
  }

  // Add critical styling for big damage
  if (isCritical || Math.abs(amount) >= 30) {
    popup.classList.add("critical");
  }

  // Calculate position relative to the target element
  const rect = targetElement.getBoundingClientRect();
  const randomOffsetX = (Math.random() - 0.5) * 30; // Random horizontal offset
  
  // Position popup centered above the target with some randomness
  popup.style.left = `${rect.left + rect.width / 2 + randomOffsetX}px`;
  popup.style.top = `${rect.top}px`;

  // Append to body
  document.body.appendChild(popup);

  // Remove after animation completes
  const animationDuration = isCritical || Math.abs(amount) >= 30 ? 1400 : 1200;
  setTimeout(() => {
    if (popup.parentNode) {
      popup.parentNode.removeChild(popup);
    }
  }, animationDuration);
}

/**
 * Shows damage popup for player HP changes
 * @param {number} amount - HP change amount (positive for heal, negative for damage)
 */
function showPlayerDamagePopup(amount) {
  // Find the HP display element
  const hpDisplayElement = document.querySelector("[data-hp-display]");
  if (hpDisplayElement) {
    showDamagePopup(amount, hpDisplayElement, Math.abs(amount) >= 20);
  }
}

// Auto-fill functions
async function connectAutoFillRooms(client, roomName, roomOptions, roomCode = "") {
  const nextAutoFillBots = autoConfig.autoFillBots;
  const joinedHelperRooms = [];

  if (!Number.isInteger(nextAutoFillBots) || nextAutoFillBots <= 0) {
    return;
  }

  for (let index = 0; index < nextAutoFillBots; index += 1) {
    try {
      const helperRoom = roomCode
        ? await client.joinById(roomCode)
        : await client.joinOrCreate(roomName, roomOptions);
      attachAutoFillRoomAutomation(helperRoom, index);
      joinedHelperRooms.push(helperRoom);
      autoFillRooms.push(helperRoom);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showMessage(`Autofill join failed: ${message}`, "error");
      break;
    }
  }

  for (const helperRoom of joinedHelperRooms) {
    helperRoom.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
  }
}

function attachAutoFillRoomAutomation(helperRoom, helperIndex) {
  if (!helperRoom || typeof helperRoom.onStateChange !== "function") {
    return;
  }

  let helperCmdSeq = 1;
  let lastAutomationStateKey = "";
  let optimisticHelperPlayer = null;
  let pendingPrepCommand = null;

  const toUnknownArray = (value) => {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "object" && Symbol.iterator in value) {
      return Array.from(value);
    }

    return [];
  };

  const parseHelperBoardCell = (value) => {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === "string") {
      const [rawCell] = value.split(":");
      const parsedCell = Number(rawCell);
      return Number.isInteger(parsedCell) ? parsedCell : null;
    }

    if (value && typeof value === "object" && "cell" in value) {
      return typeof value.cell === "number" && Number.isInteger(value.cell)
        ? value.cell
        : null;
    }

    return null;
  };

  const cloneAutoFillHelperPlayer = (player) => {
    if (!player) {
      return null;
    }

    return {
      ...player,
      benchUnits: Array.from(player.benchUnits ?? []),
      benchUnitIds: Array.from(player.benchUnitIds ?? []),
      boardUnits: Array.from(player.boardUnits ?? []),
      boardSubUnits: Array.from(player.boardSubUnits ?? []),
      shopOffers: Array.from(player.shopOffers ?? []),
      heroExclusiveShopOffers: Array.from(player.heroExclusiveShopOffers ?? []),
      bossShopOffers: Array.from(player.bossShopOffers ?? []),
    };
  };

  const buildOptimisticBoardPlacement = (cell, unitType, unitId) => ({
    cell,
    unitType: typeof unitType === "string" && unitType.length > 0 ? unitType : "vanguard",
    ...(typeof unitId === "string" && unitId.length > 0 ? { unitId } : {}),
  });

  const replaceOptimisticBoardPlacementCell = (placement, cell) => {
    if (typeof placement === "string") {
      const parts = placement.split(":");
      if (parts.length === 0) {
        return placement;
      }

      parts[0] = String(cell);
      return parts.join(":");
    }

    if (placement && typeof placement === "object") {
      return {
        ...placement,
        cell,
      };
    }

    return placement;
  };

  const remapOptimisticBoardSubUnitCells = (boardSubUnits, cellMap) =>
    Array.from(boardSubUnits ?? []).map((token) => {
      if (typeof token !== "string") {
        return token;
      }

      const parts = token.split(":");
      const parsedCell = Number(parts[0]);
      const nextCell = Number.isInteger(parsedCell) ? cellMap.get(parsedCell) : undefined;
      if (nextCell === undefined) {
        return token;
      }

      parts[0] = String(nextCell);
      return parts.join(":");
    });

  const applyOptimisticBoardUnitMove = (player, fromCell, toCell) => {
    const boardUnits = Array.from(player.boardUnits ?? []);
    const sourceIndex = boardUnits.findIndex((placement) => parseHelperBoardCell(placement) === fromCell);
    const targetIndex = boardUnits.findIndex((placement) => parseHelperBoardCell(placement) === toCell);
    if (sourceIndex < 0 || targetIndex >= 0 || fromCell === toCell) {
      return;
    }

    boardUnits[sourceIndex] = replaceOptimisticBoardPlacementCell(boardUnits[sourceIndex], toCell);
    player.boardUnits = boardUnits;
    player.boardSubUnits = remapOptimisticBoardSubUnitCells(
      player.boardSubUnits,
      new Map([[fromCell, toCell]]),
    );
  };

  const applyOptimisticBoardUnitSwap = (player, fromCell, toCell) => {
    const boardUnits = Array.from(player.boardUnits ?? []);
    const sourceIndex = boardUnits.findIndex((placement) => parseHelperBoardCell(placement) === fromCell);
    const targetIndex = boardUnits.findIndex((placement) => parseHelperBoardCell(placement) === toCell);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex || fromCell === toCell) {
      return;
    }

    const sourcePlacement = boardUnits[sourceIndex];
    const targetPlacement = boardUnits[targetIndex];
    boardUnits[sourceIndex] = replaceOptimisticBoardPlacementCell(sourcePlacement, toCell);
    boardUnits[targetIndex] = replaceOptimisticBoardPlacementCell(targetPlacement, fromCell);
    player.boardUnits = boardUnits;
    player.boardSubUnits = remapOptimisticBoardSubUnitCells(
      player.boardSubUnits,
      new Map([
        [fromCell, toCell],
        [toCell, fromCell],
      ]),
    );
  };

  const buildOptimisticBenchToken = (offer) => {
    const offerUnitType = typeof offer?.unitType === "string" && offer.unitType.length > 0
      ? offer.unitType
      : "vanguard";
    const offerUnitLevel = Number.parseInt(String(offer?.unitLevel ?? "1"), 10);
    return Number.isInteger(offerUnitLevel) && offerUnitLevel > 1
      ? `${offerUnitType}:${offerUnitLevel}`
      : offerUnitType;
  };

  const applyOptimisticPrepCommandToPlayer = (player, payload, cmdSeq) => {
    const nextPlayer = cloneAutoFillHelperPlayer(player);
    if (!nextPlayer) {
      return null;
    }

    nextPlayer.lastCmdSeq = cmdSeq;

    if (typeof payload.shopBuySlotIndex === "number") {
      const shopOffers = toUnknownArray(nextPlayer.shopOffers);
      const offer = shopOffers[payload.shopBuySlotIndex];
      if (offer) {
        shopOffers.splice(payload.shopBuySlotIndex, 1);
        nextPlayer.shopOffers = shopOffers;
        const benchUnits = toUnknownArray(nextPlayer.benchUnits);
        benchUnits.push(buildOptimisticBenchToken(offer));
        nextPlayer.benchUnits = benchUnits;
        nextPlayer.benchUnitIds = [
          ...(nextPlayer.benchUnitIds ?? []),
          typeof offer.unitId === "string" ? offer.unitId : "",
        ];
        if (typeof offer.cost === "number" && Number.isFinite(offer.cost) && typeof nextPlayer.gold === "number") {
          nextPlayer.gold = Math.max(0, nextPlayer.gold - offer.cost);
        }
      }
      return nextPlayer;
    }

    if (typeof payload.bossShopBuySlotIndex === "number") {
      const bossShopOffers = toUnknownArray(nextPlayer.bossShopOffers);
      const offer = bossShopOffers[payload.bossShopBuySlotIndex];
      if (offer) {
        bossShopOffers[payload.bossShopBuySlotIndex] = {
          ...offer,
          purchased: true,
        };
        nextPlayer.bossShopOffers = bossShopOffers;
        const benchUnits = toUnknownArray(nextPlayer.benchUnits);
        benchUnits.push(buildOptimisticBenchToken(offer));
        nextPlayer.benchUnits = benchUnits;
        nextPlayer.benchUnitIds = [
          ...(nextPlayer.benchUnitIds ?? []),
          typeof offer.unitId === "string" ? offer.unitId : "",
        ];
        if (typeof offer.cost === "number" && Number.isFinite(offer.cost) && typeof nextPlayer.gold === "number") {
          nextPlayer.gold = Math.max(0, nextPlayer.gold - offer.cost);
        }
      }
      return nextPlayer;
    }

    if (typeof payload.heroExclusiveShopBuySlotIndex === "number") {
      const heroExclusiveShopOffers = toUnknownArray(nextPlayer.heroExclusiveShopOffers);
      const offer = heroExclusiveShopOffers[payload.heroExclusiveShopBuySlotIndex];
      if (offer) {
        heroExclusiveShopOffers[payload.heroExclusiveShopBuySlotIndex] = {
          ...offer,
          purchased: true,
        };
        nextPlayer.heroExclusiveShopOffers = heroExclusiveShopOffers;
        const benchUnits = toUnknownArray(nextPlayer.benchUnits);
        benchUnits.push(buildOptimisticBenchToken(offer));
        nextPlayer.benchUnits = benchUnits;
        nextPlayer.benchUnitIds = [
          ...(nextPlayer.benchUnitIds ?? []),
          typeof offer.unitId === "string" ? offer.unitId : "",
        ];
        if (typeof offer.cost === "number" && Number.isFinite(offer.cost) && typeof nextPlayer.gold === "number") {
          nextPlayer.gold = Math.max(0, nextPlayer.gold - offer.cost);
        }
      }
      return nextPlayer;
    }

    if (typeof payload.specialUnitUpgradeCount === "number" && payload.specialUnitUpgradeCount > 0) {
      const upgradeCount = payload.specialUnitUpgradeCount;
      for (let index = 0; index < upgradeCount; index += 1) {
        const upgradeCost = getClientSpecialUnitUpgradeCost(nextPlayer);
        if (typeof upgradeCost === "number" && Number.isFinite(upgradeCost) && typeof nextPlayer.gold === "number") {
          nextPlayer.gold = Math.max(0, nextPlayer.gold - upgradeCost);
        }
        nextPlayer.specialUnitLevel = getClientSpecialUnitLevel(nextPlayer) + 1;
      }
      return nextPlayer;
    }

    if (
      payload.boardUnitMove
      && Number.isInteger(payload.boardUnitMove.fromCell)
      && Number.isInteger(payload.boardUnitMove.toCell)
    ) {
      applyOptimisticBoardUnitMove(
        nextPlayer,
        Number(payload.boardUnitMove.fromCell),
        Number(payload.boardUnitMove.toCell),
      );
      return nextPlayer;
    }

    if (
      payload.boardUnitSwap
      && Number.isInteger(payload.boardUnitSwap.fromCell)
      && Number.isInteger(payload.boardUnitSwap.toCell)
    ) {
      applyOptimisticBoardUnitSwap(
        nextPlayer,
        Number(payload.boardUnitSwap.fromCell),
        Number(payload.boardUnitSwap.toCell),
      );
      return nextPlayer;
    }

    const benchToBoardCell = payload.benchToBoardCell;
    if (!benchToBoardCell || !Number.isInteger(benchToBoardCell.benchIndex) || !Number.isInteger(benchToBoardCell.cell)) {
      return nextPlayer;
    }

    const benchIndex = Number(benchToBoardCell.benchIndex);
    const targetCell = Number(benchToBoardCell.cell);
    const benchUnits = toUnknownArray(nextPlayer.benchUnits);
    if (benchIndex < 0 || benchIndex >= benchUnits.length) {
      return nextPlayer;
    }

    const [benchUnitType] = benchUnits.splice(benchIndex, 1);
    nextPlayer.benchUnits = benchUnits;
    const benchUnitIds = Array.from(nextPlayer.benchUnitIds ?? []);
    const [benchUnitId] = benchUnitIds.splice(benchIndex, 1);
    nextPlayer.benchUnitIds = benchUnitIds;

    if (benchToBoardCell.slot === "sub") {
      const nextBoardUnits = Array.from(nextPlayer.boardUnits ?? []);
      const hostIndex = nextBoardUnits.findIndex((placement) => parseHelperBoardCell(placement) === targetCell);
      if (hostIndex >= 0) {
        const hostPlacement = nextBoardUnits[hostIndex];
        if (typeof hostPlacement === "string") {
          if (!hostPlacement.endsWith(":sub")) {
            nextBoardUnits[hostIndex] = `${hostPlacement}:sub`;
          }
        } else if (hostPlacement && typeof hostPlacement === "object") {
          nextBoardUnits[hostIndex] = {
            ...hostPlacement,
            subUnit: buildOptimisticBoardPlacement(-1, benchUnitType, benchUnitId),
          };
        }

        nextPlayer.boardUnits = nextBoardUnits;
        const nextToken = `${targetCell}:${typeof benchUnitId === "string" && benchUnitId.length > 0 ? benchUnitId : benchUnitType}`;
        nextPlayer.boardSubUnits = [
          ...Array.from(nextPlayer.boardSubUnits ?? []).filter((token) => !token.startsWith(`${targetCell}:`)),
          nextToken,
        ];
      }

      return nextPlayer;
    }

    nextPlayer.boardUnits = [
      ...Array.from(nextPlayer.boardUnits ?? []),
      buildOptimisticBoardPlacement(targetCell, benchUnitType, benchUnitId),
    ];

    return nextPlayer;
  };
  const serializeHelperOffer = (offer) => {
    if (!offer || typeof offer !== "object") {
      return offer;
    }

    return {
      unitType: offer?.unitType ?? null,
      unitId: offer?.unitId ?? null,
      factionId: offer?.factionId ?? null,
      cost: offer?.cost ?? null,
      purchased: offer?.purchased === true,
    };
  };

  const buildAutomationStateKey = (state, helperPlayer) => JSON.stringify({
    bossOffers: Array.isArray(helperPlayer?.bossShopOffers)
      ? helperPlayer.bossShopOffers.map((offer) => serializeHelperOffer(offer))
      : Array.from(helperPlayer?.bossShopOffers ?? [], (offer) => serializeHelperOffer(offer)),
    heroExclusiveOffers: Array.isArray(helperPlayer?.heroExclusiveShopOffers)
      ? helperPlayer.heroExclusiveShopOffers.map((offer) => serializeHelperOffer(offer))
      : Array.from(helperPlayer?.heroExclusiveShopOffers ?? [], (offer) => serializeHelperOffer(offer)),
    boardUnits: Array.from(helperPlayer?.boardUnits ?? []),
    boardSubUnits: Array.from(helperPlayer?.boardSubUnits ?? []),
    benchUnits: Array.from(helperPlayer?.benchUnits ?? []),
    gold: typeof helperPlayer?.gold === "number" && Number.isFinite(helperPlayer.gold)
      ? helperPlayer.gold
      : null,
    lastCmdSeq: helperPlayer?.lastCmdSeq ?? null,
    lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "",
    phase: typeof state?.phase === "string" ? state.phase : "",
    playerPhase: resolveAutoFillHelperPlayerPhase(state),
    playerPhaseDeadlineAtMs:
      typeof state?.playerPhaseDeadlineAtMs === "number" ? state.playerPhaseDeadlineAtMs : null,
    ready: helperPlayer?.ready === true,
    role: helperPlayer?.role ?? "",
    specialUnitLevel:
      typeof helperPlayer?.specialUnitLevel === "number" && Number.isFinite(helperPlayer.specialUnitLevel)
        ? helperPlayer.specialUnitLevel
        : null,
    selectedBossId: helperPlayer?.selectedBossId ?? null,
    selectedHeroId: helperPlayer?.selectedHeroId ?? null,
    shopOffers: Array.isArray(helperPlayer?.shopOffers)
      ? helperPlayer.shopOffers.map((offer) => serializeHelperOffer(offer))
      : Array.from(helperPlayer?.shopOffers ?? [], (offer) => serializeHelperOffer(offer)),
  });

  const applyAutomation = (state) => {
    const syncedHelperPlayer = mapGet(state?.players, helperRoom.sessionId);
    if (
      optimisticHelperPlayer
      && typeof syncedHelperPlayer?.lastCmdSeq === "number"
      && typeof optimisticHelperPlayer?.lastCmdSeq === "number"
      && syncedHelperPlayer.lastCmdSeq >= optimisticHelperPlayer.lastCmdSeq
    ) {
      optimisticHelperPlayer = null;
    }
    const helperPlayer = optimisticHelperPlayer ?? syncedHelperPlayer;
    const automationStateKey = buildAutomationStateKey(state, helperPlayer);

    if (automationStateKey === lastAutomationStateKey) {
      return;
    }

    lastAutomationStateKey = automationStateKey;
    if (Number.isInteger(helperPlayer?.lastCmdSeq) && helperPlayer.lastCmdSeq >= helperCmdSeq) {
      helperCmdSeq = helperPlayer.lastCmdSeq + 1;
    }

    const actions = buildAutoFillHelperActions({
      helperIndex,
      player: helperPlayer,
      sessionId: helperRoom.sessionId,
      state,
    });

    const [nextAction] = actions;
    if (!nextAction) {
      return;
    }

    if (nextAction.type === CLIENT_MESSAGE_TYPES.PREP_COMMAND) {
      if (pendingPrepCommand) {
        return;
      }
      const cmdSeq = helperCmdSeq;
      pendingPrepCommand = {
        cmdSeq,
        payload: nextAction.payload,
      };
      helperRoom.send(nextAction.type, {
        cmdSeq,
        correlationId: createCorrelationId(`helper_${helperIndex}`, cmdSeq),
        ...nextAction.payload,
      });
      helperCmdSeq += 1;
      return;
    }

    helperRoom.send(nextAction.type, nextAction.payload);
  };

  const reapplyAutomationSoon = (remainingRetries = HELPER_AUTOMATION_RETRY_ATTEMPTS) => {
    setTimeout(() => {
      if (helperRoom.state) {
        applyAutomation(helperRoom.state);
      }

      if (remainingRetries > 1) {
        reapplyAutomationSoon(remainingRetries - 1);
      }
    }, HELPER_AUTOMATION_RETRY_DELAY_MS);
  };

  const scheduleImmediateAutomationReapply = () => {
    setTimeout(() => {
      if (helperRoom.state) {
        applyAutomation(helperRoom.state);
      }
    }, 0);
  };

  if (typeof helperRoom.onMessage === "function") {
    helperRoom.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
    helperRoom.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (message) => {
      const commandResult = message ?? null;
      if (commandResult?.accepted === true && pendingPrepCommand) {
        const basePlayer = optimisticHelperPlayer ?? (helperRoom.state ? mapGet(helperRoom.state.players, helperRoom.sessionId) : null);
        optimisticHelperPlayer = applyOptimisticPrepCommandToPlayer(
          basePlayer,
          pendingPrepCommand.payload,
          pendingPrepCommand.cmdSeq,
        );
      } else if (commandResult?.accepted === false) {
        optimisticHelperPlayer = null;
      }
      pendingPrepCommand = null;
      scheduleImmediateAutomationReapply();
      reapplyAutomationSoon();
    });
    helperRoom.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
    helperRoom.onMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, () => {});
  }

  helperRoom.onStateChange((state) => {
    applyAutomation(state);
  });

  if (helperRoom.state) {
    applyAutomation(helperRoom.state);
  }
}

async function leaveAutoFillRooms() {
  if (autoFillRooms.length === 0) {
    return;
  }

  const leavingRooms = autoFillRooms.splice(0, autoFillRooms.length);

  await Promise.allSettled(
    leavingRooms.map(async (room) => {
      if (typeof room.removeAllListeners === "function") {
        room.removeAllListeners();
      }
      if (typeof room.leave === "function") {
        await room.leave();
      }
    })
  );
}

function maybeScheduleAutoReady() {
  if (!autoConfig.autoReady || autoReadyCompleted || pendingAutoReadyTimeout !== null) {
    return;
  }

  if (!activeRoom || connecting) {
    return;
  }

  pendingAutoReadyTimeout = setTimeout(() => {
    pendingAutoReadyTimeout = null;
    if (!activeRoom) return;
    sendReady();
    autoReadyCompleted = true;
    maybeScheduleAutoPrep();
  }, autoConfig.autoDelayMs);
}

function maybeScheduleAutoPrep() {
  if (!autoConfig.autoPrep || autoPrepCompleted || pendingAutoPrepTimeout !== null) {
    return;
  }

  if (!activeRoom || connecting || currentPhase !== "Prep") {
    return;
  }

  pendingAutoPrepTimeout = setTimeout(() => {
    pendingAutoPrepTimeout = null;
    if (!activeRoom || currentPhase !== "Prep") return;
    // Auto-prep: just send empty command to proceed
    sendPrepCommand({});
    autoPrepCompleted = true;
  }, autoConfig.autoDelayMs);
}

function clearPendingAutoActions() {
  if (pendingAutoReadyTimeout !== null) {
    clearTimeout(pendingAutoReadyTimeout);
    pendingAutoReadyTimeout = null;
  }
  if (pendingAutoPrepTimeout !== null) {
    clearTimeout(pendingAutoPrepTimeout);
    pendingAutoPrepTimeout = null;
  }
  if (battleResultAutoHideTimeout !== null) {
    clearTimeout(battleResultAutoHideTimeout);
    battleResultAutoHideTimeout = null;
  }
  autoReadyCompleted = false;
  autoPrepCompleted = false;
}


// Hero Selection Functions
function showHeroSelection() {
  heroSelectionOverlay?.classList.add("visible");
  renderHeroGrid();
  selectedHeroId = null;
  heroSelectionConfirmed = false;
  heroConfirmBtn?.classList.add("disabled");
}

function hideHeroSelection() {
  heroSelectionOverlay?.classList.remove("visible");
}

function showBossSelection() {
  const boss = getBossCharacter(currentPlayerState?.selectedBossId || "remilia");

  selectedBossId = boss.id;
  bossSelectionOverlay?.removeAttribute("hidden");
  bossSelectionOverlay?.classList.add("visible");

  if (bossSelectionPortrait) {
    bossSelectionPortrait.src = resolveFrontPortraitUrl(boss.portraitKey, "Remilia");
  }

  if (bossSelectionName) {
    bossSelectionName.textContent = boss.name;
  }

  if (bossSelectionRoleCopy) {
    bossSelectionRoleCopy.textContent = boss.roleCopy;
  }
}

function hideBossSelection() {
  bossSelectionOverlay?.classList.remove("visible");
  bossSelectionOverlay?.setAttribute("hidden", "");
}

function renderHeroGrid() {
  if (!heroGrid) return;
  
  heroGrid.innerHTML = "";
  
  HEROES.forEach((hero) => {
    const card = document.createElement("div");
    card.className = "hero-card";
    card.dataset.heroId = hero.id;
    
    const roleIcon = HERO_ROLE_ICONS[hero.role] || "❓";
    
    card.innerHTML = `
      <div class="hero-icon">${roleIcon}</div>
      <div class="hero-name">${hero.name}</div>
      <div class="hero-role">${hero.role}</div>
      <div class="hero-stats">
        <div class="hero-stat">
          <span class="hero-stat-label">HP</span>
          <span class="hero-stat-value">${hero.hp}</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">ATK</span>
          <span class="hero-stat-value">${hero.attack}</span>
        </div>
      </div>
      <div class="hero-skill">${hero.skill.name}: ${hero.skill.description}</div>
    `;
    
    card.addEventListener("click", () => {
      handleHeroCardClick(hero.id);
    });
    
    heroGrid.appendChild(card);
  });
}

function handleHeroCardClick(heroId) {
  if (heroSelectionConfirmed) return;
  
  selectedHeroId = heroId;
  
  // Update visual selection
  document.querySelectorAll(".hero-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.heroId === heroId);
  });
  
  // Enable confirm button
  if (heroConfirmBtn) {
    heroConfirmBtn.disabled = false;
  }
}

function confirmHeroSelection() {
  if (!selectedHeroId || !activeRoom) return;
  
  // Send hero selection to server
  activeRoom.send("HERO_SELECT", { heroId: selectedHeroId });
  
  heroSelectionConfirmed = true;
  hideHeroSelection();
  playUiCue("confirm");
  
  showMessage(`Hero selected: ${HEROES.find(h => h.id === selectedHeroId)?.name || selectedHeroId}`, "success");
}

function confirmBossSelection() {
  if (!selectedBossId || !activeRoom) return;

  sendBossSelect(selectedBossId);
  bossSelectionConfirmed = true;
  hideBossSelection();
  playUiCue("confirm");

  showMessage(`Boss selected: ${getBossCharacter(selectedBossId)?.name || selectedBossId}`, "success");
}





