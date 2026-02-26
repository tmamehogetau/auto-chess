import {
  parseAutoDelayMs,
  parseAutoFillBots,
  parseAutoFlag,
  parsePlacementsSpec,
} from "./manual-check-utils.js";

const VALID_SET_IDS = new Set(["set1", "set2"]);
const DEFAULT_ROOM_NAME = "game";

const CLIENT_MESSAGE_TYPES = {
  READY: "ready",
  PREP_COMMAND: "prep_command",
};

const SERVER_MESSAGE_TYPES = {
  COMMAND_RESULT: "command_result",
  ROUND_STATE: "round_state",
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
  bow: "🏹",
  staff: "🪄",
  armor: "🦺",
  cloak: "🧥",
  ring: "💍",
  gem: "💎",
  potion: "🧪",
  book: "📖",
};

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
const phaseDisplay = document.querySelector("[data-phase-display]");
const readyCountDisplay = document.querySelector("[data-ready-count]");
const readyBtn = document.querySelector("[data-ready-btn]");
const unitShopGrid = document.querySelector("[data-unit-shop]");
const itemShopGrid = document.querySelector("[data-item-shop]");
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

// Game state
let activeRoom = null;
let connecting = false;
let currentPhase = null;
let currentGold = 0;
let currentPlayerState = null;
let currentGameState = null;
let sessionId = null;

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
  if (connecting || activeRoom) {
    return;
  }

  connecting = true;
  syncButtonAvailability();
  showMessage("Connecting...", "success");

  try {
    const { endpoint, roomName, setId } = readConfig();
    const { Client } = await import("https://esm.sh/@colyseus/sdk@0.17.34");
    const client = new Client(endpoint);
    const roomOptions = setId ? { setId } : undefined;
    const room = await client.joinOrCreate(roomName, roomOptions);

    activeRoom = room;
    sessionId = room.sessionId;
    currentPhase = readPhase(room.state?.phase);

    // Show game container
    gameContainer?.classList.add("connected");

    // Initialize UI from state
    updateGameUI(room.state);

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
      syncButtonAvailability();
      maybeScheduleAutoPrep();
    });

    // Command results
    room.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (result) => {
      handleCommandResult(result);
    });

    room.onLeave(() => {
      clearPendingAutoActions();
      void leaveAutoFillRooms();
      activeRoom = null;
      sessionId = null;
      currentPhase = null;
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
  await leaveAutoFillRooms();
  activeRoom = null;
  sessionId = null;
  currentPhase = null;
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
  const fullPayload = { cmdSeq, ...payload };

  activeRoom.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, fullPayload);
  nextCmdSeq++;
}

// Shop handlers
function handleBuyUnit(shopSlot) {
  if (currentPhase !== "Prep") {
    showMessage("Can only buy during prep phase", "error");
    return;
  }

  sendPrepCommand({ shopBuySlotIndex: shopSlot });
  showMessage(`Buying unit from slot ${shopSlot}...`, "success");
}

function handleBuyItem(shopSlot) {
  if (currentPhase !== "Prep") {
    showMessage("Can only buy during prep phase", "error");
    return;
  }

  sendPrepCommand({ itemBuySlotIndex: shopSlot });
  showMessage(`Buying item from slot ${shopSlot}...`, "success");
}

function handleRefreshShop() {
  if (currentPhase !== "Prep") {
    showMessage("Can only refresh during prep phase", "error");
    return;
  }

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
  currentGold = Number(player.gold) || 0;

  // Update status displays
  roundDisplay.textContent = (Number(state.roundIndex) || 0) + 1;
  goldDisplay.textContent = currentGold;
  hpDisplay.textContent = Number(player.hp) || 0;
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
    if (!window.lastShownBattleRound || window.lastShownBattleRound !== state.roundIndex) {
      window.lastShownBattleRound = state.roundIndex;
      
      const resultText = battleResult.won ? '🏆 VICTORY!' : '💀 DEFEAT';
      const type = battleResult.won ? 'win' : 'lose';
      
      addCombatLogEntry(`--- Round ${state.roundIndex} ---`, 'info');
      addCombatLogEntry(`${resultText} vs Player`, type);
      addCombatLogEntry(`Survivors: ${battleResult.survivors} vs ${battleResult.opponentSurvivors}`, 'info');
      addCombatLogEntry(`Damage: ${battleResult.won ? '+' : '-'}${battleResult.damageTaken} HP`, type);
    }
  }

  // Update next command sequence
  if (typeof player.lastCmdSeq === "number") {
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
  
  // Log phase changes
  if (previousPhase !== phase) {
    if (phase === 'Prep') {
      addCombatLogEntry('🛒 Prep phase started - Buy and deploy units!', 'info');
    } else if (phase === 'Battle') {
      addCombatLogEntry('⚔️ Battle phase started!', 'info');
    } else if (phase === 'Settle') {
      addCombatLogEntry('📊 Settling scores...', 'info');
    }
  }
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
  
  const icons = { vanguard: '🛡️', ranger: '🏹', mage: '✨', assassin: '🗡️' };
  
  for (const syn of synergies) {
    const div = document.createElement('div');
    div.className = `synergy-item tier-${syn.tier}`;
    div.style.cssText = `
      padding: 5px 10px;
      background: ${syn.tier > 0 ? 'rgba(39, 174, 96, 0.3)' : 'rgba(255,255,255,0.1)'};
      border-radius: 5px;
      font-size: 12px;
    `;
    div.innerHTML = `${icons[syn.unitType] || '?'} ${syn.unitType}: ${syn.count} ${'★'.repeat(syn.tier)}`;
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

      card.innerHTML = `
        <div class="icon">${icon}</div>
        <div class="name">${offer.unitType}</div>
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

function updateBoard(boardUnits) {
  // Clear all cells
  document.querySelectorAll("[data-board-cell]").forEach((cell) => {
    cell.innerHTML = `<span class="cell-number">${cell.dataset.boardCell}</span>`;
    cell.classList.add("empty");
  });

  if (!boardUnits) return;

  // Convert to array if needed
  const units = Array.isArray(boardUnits) ? boardUnits : Array.from(boardUnits);

  units.forEach((unit) => {
    const unitStr = String(unit);
    const [cellStr, unitType] = unitStr.split(":");
    const cellIndex = Number.parseInt(cellStr, 10);

    if (Number.isNaN(cellIndex) || cellIndex < 0 || cellIndex > 7) return;

    const cell = document.querySelector(`[data-board-cell="${cellIndex}"]`);
    if (!cell) return;

    const icon = UNIT_ICONS[unitType] || "❓";

    cell.innerHTML = `
      <span class="cell-number">${cellIndex}</span>
      <div class="unit-icon">${icon}</div>
      <div class="unit-stars stars-1">★</div>
    `;
    cell.classList.remove("empty");
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

    const unitType = String(unit);
    const icon = UNIT_ICONS[unitType] || "❓";

    slot.innerHTML = `
      <span class="slot-number">${index}</span>
      <div class="unit-icon">${icon}</div>
      <div class="unit-stars stars-1">★</div>
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

function buildRejectHint(code) {
  switch (code) {
    case "INSUFFICIENT_GOLD":
      return "Not enough gold";
    case "BENCH_FULL":
      return "Bench is full";
    case "PHASE_MISMATCH":
      return "Wrong phase";
    case "LATE_INPUT":
      return "Too late";
    case "DUPLICATE_CMD":
      return "Command already sent";
    case "INVALID_PAYLOAD":
      return "Invalid action";
    default:
      return "";
  }
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
  autoReadyCompleted = false;
  autoPrepCompleted = false;
}
