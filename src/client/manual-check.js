import {
  parseAutoDelayMs,
  parseAutoFillBots,
  parseAutoFlag,
  parseBoardUnitToken,
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
  sendSharedCursorMove,
  sendSharedDragState,
  sendSharedPlaceUnit,
  handleSharedDrop,
  handleSharedCellClick,
} from "./shared-board-client.js";

const VALID_SET_IDS = new Set(["set1", "set2"]);
const DEFAULT_ROOM_NAME = "game";

const CLIENT_MESSAGE_TYPES = {
  READY: "ready",
  PREP_COMMAND: "prep_command",
  ADMIN_QUERY: "admin_query",
};

const SERVER_MESSAGE_TYPES = {
  COMMAND_RESULT: "command_result",
  ROUND_STATE: "round_state",
  SHADOW_DIFF: "shadow_diff",
  ADMIN_RESPONSE: "admin_response",
};

// Unit type icons
const UNIT_ICONS = {
  vanguard: "🛡️",
  ranger: "🏹",
  mage: "✨",
  assassin: "🗡️",
};

// Item icons (emoji mapping for common items)
const ITEM_ICONS = {
  sword: "⚔️",
  shield: "🛡️",
  boots: "👞",
  ring: "💍",
  amulet: "📿",
};

// Hero definitions (client-side copy)
const HEROES = [
  {
    id: 'reimu',
    name: '霊夢',
    role: 'support',
    hp: 120,
    attack: 15,
    skill: {
      name: '夢符「二重結界」',
      description: '味方全体に防御バフを付与（与ダメージ-20%, 被ダメージ+10%）',
    },
  },
  {
    id: 'marisa',
    name: '魔理沙',
    role: 'dps',
    hp: 100,
    attack: 25,
    skill: {
      name: '恋符「マスタースパーク」',
      description: '直線に強力な魔法ダメージ（ATK × 3.0）',
    },
  },
  {
    id: 'sanae',
    name: '早苗',
    role: 'support',
    hp: 110,
    attack: 18,
    skill: {
      name: '奇跡「神の風」',
      description: '味方全体に攻撃力バフと防御バフ（攻撃速度+25%, 被ダメージ-10%）',
    },
  },
  {
    id: 'youmu',
    name: '妖夢',
    role: 'dps',
    hp: 130,
    attack: 22,
    skill: {
      name: '人符「現世斬」',
      description: 'ターゲットに3連撃（ATK × 1.2 × 3）',
    },
  },
  {
    id: 'sakuya',
    name: '咲夜',
    role: 'control',
    hp: 110,
    attack: 20,
    skill: {
      name: '時符「プライベートスクウェア」',
      description: '範囲内の敵の移動速度-60%、攻撃速度-30%（3秒間）',
    },
  },
];

// Hero role icons
const HERO_ROLE_ICONS = {
  tank: "🛡️",
  dps: "⚔️",
  support: "✨",
  control: "⏱️",
};

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
    return SPELL_CARDS.filter(s => s.roundRange[0] === 1);
  }
  if (roundIndex >= 5 && roundIndex <= 8) {
    return SPELL_CARDS.filter(s => s.roundRange[0] === 5);
  }
  if (roundIndex >= 9 && roundIndex <= 11) {
    return SPELL_CARDS.filter(s => s.roundRange[0] === 9);
  }
  if (roundIndex === 12) {
    return SPELL_CARDS.filter(s => s.id === 'last-word');
  }
  return [];
}

// Legacy form elements (kept for compatibility)
const endpointInput = document.querySelector("[data-endpoint-input]");
const roomInput = document.querySelector("[data-room-input]");
const setIdSelect = document.querySelector("[data-setid-select]");
const autoFillInput = document.querySelector("[data-autofill-input]");
const connectButton = document.querySelector("[data-connect-button]");
const leaveButton = document.querySelector("[data-leave-button]");

// New UI elements
const gameContainer = document.querySelector("[data-game-container]");
const roundDisplay = document.querySelector("[data-round-display]");
const goldDisplay = document.querySelector("[data-gold-display]");
const hpDisplay = document.querySelector("[data-hp-display]");
  const levelDisplay = document.querySelector("[data-level-display]");
  const xpDisplay = document.querySelector("[data-xp-display]");
  const dominationCountDisplay = document.querySelector("[data-domination-count-display]");
  const phaseDisplay = document.querySelector("[data-phase-display]");
const readyCountDisplay = document.querySelector("[data-ready-count]");
const phaseHpSection = document.querySelector("[data-phase-hp-section]");
const phaseHpValue = document.querySelector("[data-phase-hp-value]");
const phaseHpFill = document.querySelector("[data-phase-hp-fill]");
const phaseHpResult = document.querySelector("[data-phase-hp-result]");
const readyBtn = document.querySelector("[data-ready-btn]");
const unitShopGrid = document.querySelector("[data-unit-shop]");
const itemShopGrid = document.querySelector("[data-item-shop]");
const bossShopGrid = document.querySelector("[data-boss-shop]");
const bossShopSection = document.querySelector("[data-boss-shop-section]");
const boardRowFront = document.querySelector("[data-board-row-front]");
const boardRowBack = document.querySelector("[data-board-row-back]");
const benchGrid = document.querySelector("[data-bench]");
const inventoryGrid = document.querySelector("[data-inventory]");
const sellBtn = document.querySelector("[data-sell-btn]");
const refreshShopBtn = document.querySelector("[data-refresh-shop-btn]");
const buyXpBtn = document.querySelector("[data-buy-xp-btn]");
const messageBar = document.querySelector("[data-message-bar]");
const selectionModeIndicator = document.querySelector("[data-selection-mode]");
const combatLogContainer = document.querySelector("[data-combat-log]");
const sharedBoardGrid = document.querySelector("[data-shared-board-grid]");
const sharedCursorList = document.querySelector("[data-shared-cursor-list]");
const phaseTransitionOverlay = document.querySelector("[data-phase-transition-overlay]");
const roundSummaryOverlay = document.querySelector("[data-round-summary-overlay]");
const roundSummaryRound = document.querySelector("[data-round-summary-round]");
const roundSummaryList = document.querySelector("[data-round-summary-list]");
const roundSummaryClose = document.querySelector("[data-round-summary-close]");

// Battle result elements
const battleResultOverlay = document.querySelector("[data-battle-result-overlay]");
const battleResultTitle = document.querySelector("[data-battle-result-title]");
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
const monitorLogList = document.querySelector("[data-monitor-log]");

// Hero selection elements
const heroSelectionOverlay = document.querySelector("[data-hero-selection-overlay]");
const heroGrid = document.querySelector("[data-hero-grid]");
const heroConfirmBtn = document.querySelector("[data-hero-confirm-btn]");

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

// Unit death animation state
let previousBoardUnits = new Map(); // Track previous board state for death detection
const DEFEATED_UNITS = new Set(); // Track units currently being animated as defeated

// Hero selection state
let selectedHeroId = null;
let heroSelectionConfirmed = false;

// Selection state
let selectedBenchIndex = null;
let selectedBoardCell = null;
let selectedInventoryIndex = null;
let selectedShopSlot = null;

// Timer state
let timerInterval = null;

// Auto-fill state
let pendingAutoReadyTimeout = null;
let pendingAutoPrepTimeout = null;
const autoFillRooms = [];
let autoReadyCompleted = false;
let autoPrepCompleted = false;
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
    monitorLogList,
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
  },
  {
    client: null, // Will be set during connect
    gamePlayerId: "", // Will be set during connect
    onLog: addCombatLogEntry,
    showMessage,
  },
);

// Hero selection event listeners
heroConfirmBtn?.addEventListener("click", () => {
  confirmHeroSelection();
});

syncButtonAvailability();

// Event listeners
connectButton?.addEventListener("click", () => {
  void connect();
});

leaveButton?.addEventListener("click", () => {
  void leave();
});

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

itemShopGrid?.querySelectorAll("[data-item-shop-slot]").forEach((card) => {
  card.addEventListener("click", () => {
    const slot = Number.parseInt(card.dataset.itemShopSlot, 10);
    handleBuyItem(slot);
  });
});

bossShopGrid?.querySelectorAll("[data-boss-shop-slot]").forEach((card) => {
  card.addEventListener("click", () => {
    const slot = Number.parseInt(card.dataset.bossShopSlot, 10);
    handleBuyBossShopUnit(slot);
  });
});

// Bench slot click handlers
benchGrid?.querySelectorAll("[data-bench-slot]").forEach((slot) => {
  slot.addEventListener("click", () => {
    const index = Number.parseInt(slot.dataset.benchSlot, 10);
    handleBenchClick(index);
  });
});

// Board cell click handlers
document.querySelectorAll("[data-board-cell]").forEach((cell) => {
  cell.addEventListener("click", () => {
    const cellIndex = Number.parseInt(cell.dataset.boardCell, 10);
    handleBoardClick(cellIndex);
  });
});

// Inventory slot click handlers
inventoryGrid?.querySelectorAll("[data-inv-slot]").forEach((slot) => {
  slot.addEventListener("click", () => {
    const index = Number.parseInt(slot.dataset.invSlot, 10);
    handleInventoryClick(index);
  });
});

window.addEventListener("beforeunload", () => {
  void leave();
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
    gameContainer?.classList.remove("connected");
    syncButtonAvailability();
  }

  if (activeRoom) {
    return;
  }

  connecting = true;
  syncButtonAvailability();
  showMessage("Connecting...", "success");

  try {
    const { endpoint, roomName, setId } = readConfig();
    const { Client } = await withTimeout(
      import("https://esm.sh/@colyseus/sdk@0.17.34"),
      8_000,
      "Colyseus SDK load",
    );
    const client = new Client(endpoint);
    const roomOptions = setId ? { setId } : undefined;
    const room = await withTimeout(
      client.joinOrCreate(roomName, roomOptions),
      8_000,
      "Room connection",
    );

    activeRoom = room;
    sessionId = room.sessionId;
    currentPhase = readPhase(room.state?.phase);
    lastShownSummaryRound = -1;
    hideRoundSummary();
    lastShownBattleRound = -1;
    hideBattleResult();

    // Reset unit death animation tracking
    previousBoardUnits.clear();
    DEFEATED_UNITS.clear();

    // Show game container
    gameContainer?.classList.add("connected");

    // Initialize UI from state
    updateGameUI(room.state);

    await connectSharedBoard(client);

    await connectAutoFillRooms(client, roomName, roomOptions);

    // State change handler
    room.onStateChange((state) => {
      currentGameState = state;
      updateGameUI(state);
      currentPhase = readPhase(state?.phase);
      syncButtonAvailability();
      maybeScheduleAutoPrep();
    });

    // Round state messages
    room.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message) => {
      currentPhase = readPhase(message?.phase);
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

    startMonitorPolling();
    requestAdminMonitorSnapshot();

    room.onLeave(() => {
      clearPendingAutoActions();
      stopMonitorPolling();
      void leaveAutoFillRooms();
      activeRoom = null;
      sessionId = null;
      currentPhase = null;
      leaveSharedBoardRoom();
      latestPhaseHpProgress = null;
      renderPhaseHpProgress(null);
      lastShownSummaryRound = -1;
      hideRoundSummary();
      lastShownBattleRound = -1;
      hideBattleResult();
      resetShadowDiffMonitor();
      // Reset unit death animation tracking
      previousBoardUnits.clear();
      DEFEATED_UNITS.clear();
      gameContainer?.classList.remove("connected");
      showMessage("Disconnected", "error");
      syncButtonAvailability();
    });

    showMessage("Connected!", "success");
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
  latestPhaseHpProgress = null;
  renderPhaseHpProgress(null);
  lastShownSummaryRound = -1;
  hideRoundSummary();
  lastShownBattleRound = -1;
  hideBattleResult();
  resetShadowDiffMonitor();
  // Reset unit death animation tracking
  previousBoardUnits.clear();
  DEFEATED_UNITS.clear();
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
    showMessage("Disconnected", "error");
    syncButtonAvailability();
  }
}

function sendReady() {
  if (!activeRoom) {
    showMessage("Not connected", "error");
    return;
  }

  const currentReady = readyBtn?.classList.contains("ready");
  const newReady = !currentReady;

  activeRoom.send(CLIENT_MESSAGE_TYPES.READY, { ready: newReady });
  
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

function sendPrepCommand(payload) {
  if (!activeRoom) {
    showMessage("Not connected", "error");
    return;
  }

  if (currentPhase !== "Prep") {
    showMessage("Not in prep phase", "error");
    return;
  }

  const cmdSeq = nextCmdSeq;
  const correlationId = createCorrelationId("prep", cmdSeq);
  const fullPayload = { cmdSeq, correlationId, ...payload };

  activeRoom.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, fullPayload);
  lastMonitorTraceId = correlationId;
  setMonitorText(monitorTraceValue, correlationId);
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
  showMessage(`Buying unit from slot ${shopSlot}...`, "success");
}

function handleBuyItem(shopSlot) {
  if (currentPhase !== "Prep") {
    showMessage("Can only buy during prep phase", "error");
    return;
  }

  // Purchase animation
  const shopCard = itemShopGrid?.querySelector(`[data-item-shop-slot="${shopSlot}"]`);
  if (shopCard) {
    shopCard.classList.add("purchased");
    setTimeout(() => shopCard.classList.remove("purchased"), 500);
  }

  sendPrepCommand({ itemBuySlotIndex: shopSlot });
  showMessage(`Buying item from slot ${shopSlot}...`, "success");
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
  showMessage(`Buying unit from boss shop slot ${shopSlot}...`, "success");
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
    showMessage("Can only buy XP during prep phase", "error");
    return;
  }

  sendPrepCommand({ xpPurchaseCount: 1 });
  showMessage("Buying XP...", "success");
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
  // If we have an item selected, try to equip it
  if (selectedInventoryIndex !== null) {
    equipItemToBench(selectedInventoryIndex, index);
    clearSelections();
    return;
  }

  // Toggle selection
  if (selectedBenchIndex === index) {
    clearSelections();
  } else {
    clearSelections();
    selectedBenchIndex = index;
    const slot = benchGrid?.querySelector(`[data-bench-slot="${index}"]`);
    slot?.classList.add("selected");
    updateActionButtons();
  }
}

function handleBoardClick(cellIndex) {
  // If we have a bench unit selected, deploy it
  if (selectedBenchIndex !== null) {
    deployBenchUnit(selectedBenchIndex, cellIndex);
    clearSelections();
    return;
  }

  // Toggle board cell selection for selling
  if (selectedBoardCell === cellIndex) {
    clearSelections();
  } else {
    clearSelections();
    selectedBoardCell = cellIndex;
    const cell = document.querySelector(`[data-board-cell="${cellIndex}"]`);
    cell?.classList.add("selected");
    updateActionButtons();
  }
}

function handleInventoryClick(index) {
  // Check if slot has an item
  const slot = inventoryGrid?.querySelector(`[data-inv-slot="${index}"]`);
  if (slot?.classList.contains("empty")) {
    return;
  }

  // Toggle selection
  if (selectedInventoryIndex === index) {
    clearSelections();
  } else {
    clearSelections();
    selectedInventoryIndex = index;
    slot?.classList.add("selected");
    showSelectionMode("Click a bench unit to equip item");
    updateActionButtons();
  }
}

function deployBenchUnit(benchIndex, cellIndex) {
  if (currentPhase !== "Prep") {
    showMessage("Can only deploy during prep phase", "error");
    return;
  }

  sendPrepCommand({
    benchToBoardCell: {
      benchIndex: benchIndex,
      cell: cellIndex,
    },
  });
  showMessage(`Deploying unit to cell ${cellIndex}...`, "success");
}

function equipItemToBench(itemIndex, benchIndex) {
  if (currentPhase !== "Prep") {
    showMessage("Can only equip during prep phase", "error");
    return;
  }

  sendPrepCommand({
    itemEquipToBench: {
      inventoryItemIndex: itemIndex,
      benchIndex: benchIndex,
    },
  });
  showMessage("Equipping item...", "success");
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
  } else if (selectedBoardCell !== null) {
    sendPrepCommand({ boardSellIndex: selectedBoardCell });
    showMessage("Selling board unit...", "success");
    clearSelections();
  }
}

function clearSelections() {
  selectedBenchIndex = null;
  selectedBoardCell = null;
  selectedInventoryIndex = null;
  selectedShopSlot = null;

  document.querySelectorAll(".selected").forEach((el) => {
    el.classList.remove("selected");
  });

  hideSelectionMode();
  updateActionButtons();
}

function updateActionButtons() {
  const canSell = selectedBenchIndex !== null || selectedBoardCell !== null;
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
  
  levelDisplay.textContent = Number(player.level) || 1;
  xpDisplay.textContent = Number(player.xp) || 0;

  // Update phase display
  updatePhaseDisplay(readPhase(state.phase));

  // Update ready count
  const players = state.players || new Map();
  let readyCount = 0;
  let totalCount = 0;
  players.forEach((p) => {
    totalCount++;
    if (p.ready) readyCount++;
  });
  if (readyCountDisplay) {
    readyCountDisplay.textContent = `${readyCount}/${totalCount} Ready`;
  }

  // Update ready button
  const isReady = Boolean(player.ready);
  if (readyBtn) {
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

  // Update unit shop
  updateUnitShop(player.shopOffers);

  // Update item shop
  updateItemShop(player.itemShopOffers);

  // Update boss shop
  updateBossShop(
    player.bossShopOffers,
    state.featureFlagsEnableBossExclusiveShop === true && state.bossPlayerId === sessionId,
  );

  // Update board
  updateBoard(player.boardUnits);

  // Update bench
  updateBench(player.benchUnits);

  // Update inventory
  updateInventory(player.itemInventory);

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
  if (battleResult) {
    // Only show once per round (track last shown round)
    if (lastShownBattleRound !== state.roundIndex) {
      lastShownBattleRound = state.roundIndex;
      
      const isVictory = battleResult.won === true;
      
      // Show battle result overlay
      showBattleResult(isVictory, battleResult);
      
      // Also log to combat log
      const resultText = isVictory ? '🏆 VICTORY!' : '💀 DEFEAT';
      const type = isVictory ? 'win' : 'lose';
      
      addCombatLogEntry(`--- Round ${state.roundIndex} ---`, 'info');
      addCombatLogEntry(`${resultText} vs Player`, type);
      addCombatLogEntry(`Survivors: ${battleResult.survivors} vs ${battleResult.opponentSurvivors}`, 'info');
      addCombatLogEntry(`Damage: ${isVictory ? '+' : '-'}${battleResult.damageTaken} HP`, type);
    }
  }

  maybeShowRoundSummary(state);

  // Update next command sequence
  if (typeof player.lastCmdSeq === "number") {

  // Show hero selection dialog in Waiting phase if hero system enabled and not selected yet
  if (state.featureFlagsEnableHeroSystem && state.phase === "Waiting" && !player.selectedHeroId && !heroSelectionConfirmed) {
    showHeroSelection();
  } else if (state.phase !== "Waiting" || player.selectedHeroId || heroSelectionConfirmed) {
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

    nextCmdSeq = player.lastCmdSeq + 1;
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

  // Show the overlay
  battleStartOverlay.classList.add('visible');

  // Add shake effect to board sections
  const boardSection = document.querySelector('.board-section');
  const sharedBoardSection = document.querySelector('.shared-board-section');

  if (boardSection) {
    boardSection.classList.remove('battle-start');
    void boardSection.offsetWidth; // Trigger reflow
    boardSection.classList.add('battle-start');
  }

  if (sharedBoardSection) {
    sharedBoardSection.classList.remove('battle-start');
    void sharedBoardSection.offsetWidth; // Trigger reflow
    sharedBoardSection.classList.add('battle-start');
  }

  // Auto-hide after animation completes (1.2s)
  setTimeout(() => {
    battleStartOverlay.classList.remove('visible');
    
    // Clean up board shake classes
    if (boardSection) {
      boardSection.classList.remove('battle-start');
    }
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

  if (!progress) {
    phaseHpSection.style.display = "none";
    phaseHpFill.style.width = "0%";
    phaseHpFill.classList.remove("pending", "success", "failed");
    phaseHpFill.classList.add("pending");
    phaseHpResult.classList.remove("pending", "success", "failed");
    phaseHpResult.classList.add("pending");
    phaseHpResult.textContent = PHASE_RESULT_LABELS.pending;
    phaseHpValue.textContent = "0 / 0";
    return;
  }

  phaseHpSection.style.display = "block";

  const completionRate = Math.max(0, progress.completionRate);
  const visiblePercent = Math.round(Math.min(1, completionRate) * 100);
  const textPercent = Math.round(completionRate * 100);

  phaseHpValue.textContent = `${Math.round(progress.damageDealt)} / ${Math.round(progress.targetHp)} (${textPercent}%)`;
  phaseHpFill.style.width = `${visiblePercent}%`;
  phaseHpFill.classList.remove("pending", "success", "failed");
  phaseHpFill.classList.add(progress.result);

  phaseHpResult.classList.remove("pending", "success", "failed");
  phaseHpResult.classList.add(progress.result);
  phaseHpResult.textContent = PHASE_RESULT_LABELS[progress.result];
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

  // Clear any existing auto-hide timeout
  if (battleResultAutoHideTimeout !== null) {
    clearTimeout(battleResultAutoHideTimeout);
    battleResultAutoHideTimeout = null;
  }

  // Remove any existing animation classes
  battleResultOverlay.classList.remove("hiding");
  
  // Set title and styling based on result
  battleResultTitle.textContent = isVictory ? "🏆 VICTORY" : "💀 DEFEAT";
  battleResultOverlay.classList.remove("victory", "defeat");
  battleResultOverlay.classList.add(isVictory ? "victory" : "defeat");
  
  // Set damage statistics
  const damageDealt = Math.round(battleResult?.damageDealt || 0);
  const damageTaken = Math.round(battleResult?.damageTaken || 0);
  battleDamageDealt.textContent = damageDealt;
  battleDamageTaken.textContent = damageTaken;
  
  // Show the overlay
  battleResultOverlay.classList.add("visible");
  
  // Auto-hide after 3 seconds
  battleResultAutoHideTimeout = setTimeout(() => {
    hideBattleResult();
  }, 3000);
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
      const icon = UNIT_ICONS[offer.unitType] || "❓";
      const cost = offer.cost || 0;
      const canAfford = currentGold >= cost;
      const rumorBadge = offer.isRumorUnit === true ? '<div class="rumor-badge">Rumor</div>' : "";

      // 共有プールの在庫チェック
      let isDepleted = false;
      let remainingCount = null;
      if (currentSharedPoolInventory && currentSharedPoolInventory instanceof Map) {
        remainingCount = currentSharedPoolInventory.get(offer.unitType) ?? 0;
        isDepleted = remainingCount <= 0;
      }

      card.innerHTML = `
        <div class="icon">${icon}</div>
        <div class="name">${offer.unitType}</div>
        <div class="cost">${cost}G</div>
        ${remainingCount !== null ? `<div class="pool-badge">残り${remainingCount}枚</div>` : ''}
        ${rumorBadge}
      `;
      card.classList.toggle("disabled", !canAfford || currentPhase !== "Prep" || isDepleted);
      card.classList.toggle("depleted", isDepleted);
    } else {
      card.innerHTML = `
        <div class="icon">❓</div>
        <div class="name">-</div>
        <div class="cost">-</div>
      `;
      card.classList.add("disabled");
    }
  });
}

function updateItemShop(offers) {
  if (!offers || !itemShopGrid) return;

  offers.forEach((offer, index) => {
    const card = itemShopGrid.querySelector(`[data-item-shop-slot="${index}"]`);
    if (!card) return;

    if (offer) {
      const icon = ITEM_ICONS[offer.itemType] || "📦";
      const cost = offer.cost || 0;
      const canAfford = currentGold >= cost;

      card.innerHTML = `
        <div class="icon">${icon}</div>
        <div class="name">${offer.itemType}</div>
        <div class="cost">${cost}G</div>
      `;
      card.classList.toggle("disabled", !canAfford || currentPhase !== "Prep");
    } else {
      card.innerHTML = `
        <div class="icon">❓</div>
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

    const icon = UNIT_ICONS[offer.unitType] || "🦇";
    const cost = offer.cost || 0;
    const canAfford = currentGold >= cost && !isPurchased;
    const displayName = SCARLET_MANSION_DATA.displayNames[offer.unitType] || offer.unitType;
    const details = SCARLET_MANSION_DATA.cardDetails[offer.unitType] || null;
    card.innerHTML = `
      <span class="boss-shop-badge">${badgeText}</span>
      <div class="scarlet-badge">紅魔館</div>
      <div class="icon">${icon}</div>
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

/**
 * Creates particle effects for unit death animation
 * @param {HTMLElement} element - The element to create particles around
 */
function createDeathParticles(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const particleCount = 8;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'death-particle';

    // Calculate random direction
    const angle = (i / particleCount) * Math.PI * 2;
    const distance = 30 + Math.random() * 20;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;

    // Random color variation
    const colors = ['#e74c3c', '#c0392b', '#e67e22', '#d35400'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    document.body.appendChild(particle);

    // Remove particle after animation
    setTimeout(() => {
      particle.remove();
    }, 400);
  }
}

/**
 * Applies death animation to a unit element
 * @param {HTMLElement} cellElement - The board cell containing the unit
 * @param {string} unitId - Unique identifier for the unit
 */
function animateUnitDeath(cellElement, unitId) {
  if (DEFEATED_UNITS.has(unitId)) {
    return; // Already animating
  }

  DEFEATED_UNITS.add(unitId);

  // Create particle effects
  const unitIcon = cellElement.querySelector('.unit-icon');
  if (unitIcon) {
    createDeathParticles(unitIcon);
  }

  // Apply death animation class to the entire cell content
  const content = cellElement.querySelector('.unit-icon, .unit-stars, .sub-unit-badge');
  if (content) {
    content.classList.add('unit-defeated');
  }

  // Remove from tracking after animation completes
  setTimeout(() => {
    DEFEATED_UNITS.delete(unitId);
  }, 500);
}

/**
 * Detects removed units and triggers death animations
 * @param {Array} currentUnits - Current board units
 * @returns {Set} Set of cell indices that had units removed
 */
function detectDefeatedUnits(currentUnits) {
  const currentUnitMap = new Map();
  const removedCells = new Set();

  // Build map of current units by cell index
  if (currentUnits) {
    const units = Array.isArray(currentUnits) ? currentUnits : Array.from(currentUnits);
    units.forEach((unit) => {
      const unitStr = String(unit);
      const parsedToken = parseBoardUnitToken(unitStr);
      if (parsedToken) {
        currentUnitMap.set(parsedToken.cell, parsedToken);
      }
    });
  }

  // Check previous units for removals
  previousBoardUnits.forEach((prevUnit, cellIndex) => {
    if (!currentUnitMap.has(cellIndex)) {
      // Unit was removed - trigger death animation
      const cellElement = document.querySelector(`[data-board-cell="${cellIndex}"]`);
      if (cellElement && !cellElement.classList.contains('empty')) {
        const unitId = `${cellIndex}-${prevUnit.unitType}-${Date.now()}`;
        animateUnitDeath(cellElement, unitId);
        removedCells.add(cellIndex);
      }
    }
  });

  return removedCells;
}

function updateBoard(boardUnits) {
  // Detect defeated units before clearing
  const removedCells = detectDefeatedUnits(boardUnits);

  // Clear cells that don't have defeated units animating
  document.querySelectorAll("[data-board-cell]").forEach((cell) => {
    const cellIndex = Number.parseInt(cell.dataset.boardCell, 10);

    // Skip cells with active death animation
    if (!removedCells.has(cellIndex)) {
      cell.innerHTML = `<span class="cell-number">${cell.dataset.boardCell}</span>`;
      cell.classList.add("empty");
    }
  });

  // Update previous board state
  previousBoardUnits.clear();

  if (!boardUnits) return;

  // Convert to array if needed
  const units = Array.isArray(boardUnits) ? boardUnits : Array.from(boardUnits);

  units.forEach((unit) => {
    const unitStr = String(unit);
    const parsedToken = parseBoardUnitToken(unitStr);

    if (!parsedToken) return;

    const { cell: parsedCell, unitType, starLevel, subUnitActive } = parsedToken;
    const cellIndex = parsedCell;

    // Store in previous board state
    previousBoardUnits.set(cellIndex, parsedToken);

    const boardCell = document.querySelector(`[data-board-cell="${cellIndex}"]`);
    if (!boardCell) return;

    const icon = UNIT_ICONS[unitType] || "❓";
    const starClass = `stars-${Math.min(starLevel, 3)}`;

    boardCell.innerHTML = `
      <span class="cell-number">${cellIndex}</span>
      <div class="unit-icon">${icon}</div>
      <div class="unit-stars ${starClass}">${"★".repeat(starLevel)}</div>
      ${subUnitActive ? '<div class="sub-unit-badge">SUB</div>' : ''}
    `;
    boardCell.classList.remove("empty");
  });
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

    // Parse unit type and star level (format: "unitType:starLevel" or "unitType")
    const unitStr = String(unit);
    let unitType = unitStr;
    let starLevel = 1;

    const starMatch = unitStr.match(/(.+?):(\d+)$/);
    if (starMatch) {
      unitType = starMatch[1];
      starLevel = Number.parseInt(starMatch[2], 10);
    }

    const icon = UNIT_ICONS[unitType] || "❓";
    const starClass = `stars-${Math.min(starLevel, 3)}`;

    slot.innerHTML = `
      <span class="slot-number">${index}</span>
      <div class="unit-icon">${icon}</div>
      <div class="unit-stars ${starClass}">${"★".repeat(starLevel)}</div>
    `;
    slot.classList.remove("empty");
  });
}

function updateInventory(inventory) {
  // Clear all slots
  inventoryGrid?.querySelectorAll("[data-inv-slot]").forEach((slot) => {
    slot.textContent = "";
    slot.classList.add("empty");
  });

  if (!inventory) return;

  // Convert to array if needed
  const items = Array.isArray(inventory) ? inventory : Array.from(inventory);

  items.forEach((item, index) => {
    if (index >= 9) return;

    const slot = inventoryGrid?.querySelector(`[data-inv-slot="${index}"]`);
    if (!slot) return;

    const itemType = String(item);
    const icon = ITEM_ICONS[itemType] || "📦";

    slot.textContent = icon;
    slot.classList.remove("empty");
  });
}

function handleCommandResult(result) {
  if (result?.accepted === true) {
    showMessage("Action successful!", "success");
  } else if (result?.accepted === false) {
    const hint = buildRejectHint(result.code);
    showMessage(`Failed: ${result.code}${hint ? ` - ${hint}` : ""}`, "error");
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

  if (setIdSelect) {
    const setId = normalizeSetId(params.get("setId"));
    setIdSelect.value = setId ?? "";
  }

  if (autoFillInput) {
    const parsedAutoFillBots = parseAutoFillBots(autoFillInput.value);
    if (parsedAutoFillBots !== autoConfig.autoFillBots) {
      autoConfig.autoFillBots = parsedAutoFillBots;
    }
    autoFillInput.value = String(autoConfig.autoFillBots);
  }

  if (autoConfig.autoConnect) {
    void connect();
  }
}

function readConfig() {
  const endpointValue = endpointInput?.value?.trim();
  const roomValue = roomInput?.value?.trim();
  const selectedSetId = setIdSelect?.value?.trim() ?? "";
  const autoFillBots = parseAutoFillBots(autoFillInput?.value ?? "0");

  autoConfig.autoFillBots = autoFillBots;

  return {
    endpoint:
      endpointValue ||
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`,
    roomName: roomValue || DEFAULT_ROOM_NAME,
    setId: normalizeSetId(selectedSetId),
    autoFillBots,
  };
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
    renderPhaseHpProgress(null);
    gameContainer?.classList.remove("connected");
  }

  const connected = Boolean(activeRoom);
  const prepPhase = currentPhase === "Prep";

  if (connectButton) {
    connectButton.disabled = connecting || connected;
  }

  if (leaveButton) {
    leaveButton.disabled = connecting || !connected;
  }

  if (readyBtn) {
    readyBtn.disabled = connecting || !connected;
  }

  if (sellBtn) {
    sellBtn.disabled = !connected || !prepPhase || (selectedBenchIndex === null && selectedBoardCell === null);
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

  itemShopGrid?.querySelectorAll(".shop-card").forEach((card) => {
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
async function connectAutoFillRooms(client, roomName, roomOptions) {
  const nextAutoFillBots = autoConfig.autoFillBots;

  if (!Number.isInteger(nextAutoFillBots) || nextAutoFillBots <= 0) {
    return;
  }

  for (let index = 0; index < nextAutoFillBots; index += 1) {
    try {
      const helperRoom = await client.joinOrCreate(roomName, roomOptions);
      helperRoom.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      autoFillRooms.push(helperRoom);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showMessage(`Autofill join failed: ${message}`, "error");
      break;
    }
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
  
  showMessage(`Hero selected: ${HEROES.find(h => h.id === selectedHeroId)?.name || selectedHeroId}`, "success");
}

