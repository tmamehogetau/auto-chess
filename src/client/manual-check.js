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

const endpointInput = document.querySelector("[data-endpoint-input]");
const roomInput = document.querySelector("[data-room-input]");
const setIdSelect = document.querySelector("[data-setid-select]");
const autoFillInput = document.querySelector("[data-autofill-input]");
const connectButton = document.querySelector("[data-connect-button]");
const leaveButton = document.querySelector("[data-leave-button]");
const readyCheckbox = document.querySelector("[data-ready-checkbox]");
const readyButton = document.querySelector("[data-ready-button]");
const cmdSeqInput = document.querySelector("[data-cmdseq-input]");
const xpPurchaseInput = document.querySelector("[data-xp-purchase-input]");
const shopRefreshInput = document.querySelector("[data-shop-refresh-input]");
const shopBuySlotInput = document.querySelector("[data-shop-buy-slot-input]");
const shopLockInput = document.querySelector("[data-shop-lock-input]");
const benchDeployIndexInput = document.querySelector("[data-bench-deploy-index-input]");
const benchDeployCellInput = document.querySelector("[data-bench-deploy-cell-input]");
const benchSellIndexInput = document.querySelector("[data-bench-sell-index-input]");
const boardSellCellInput = document.querySelector("[data-board-sell-cell-input]");
const placementsInput = document.querySelector("[data-placements-input]");
const prepButton = document.querySelector("[data-prep-button]");

const statusElement = document.querySelector("[data-connection-status]");
const autoFillStatusElement = document.querySelector("[data-autofill-status]");
const errorElement = document.querySelector("[data-connection-error]");
const setIdElement = document.querySelector("[data-set-id-display]");
const phaseElement = document.querySelector("[data-phase-value]");
const roundElement = document.querySelector("[data-round-value]");
const selfStatusElement = document.querySelector("[data-self-status]");
const benchListElement = document.querySelector("[data-bench-list]");
const boardListElement = document.querySelector("[data-board-list]");
const commandResultElement = document.querySelector("[data-command-result]");
const itemShopListElement = document.querySelector("[data-item-shop-list]");
const inventoryListElement = document.querySelector("[data-inventory-list]");
const itemBuySlotInput = document.querySelector("[data-item-buy-slot-input]");
const equipItemIndexInput = document.querySelector("[data-equip-item-index-input]");
const equipBenchIndexInput = document.querySelector("[data-equip-bench-index-input]");
const unequipBenchIndexInput = document.querySelector("[data-unequip-bench-index-input]");
const unequipItemSlotInput = document.querySelector("[data-unequip-item-slot-input]");
const sellItemIndexInput = document.querySelector("[data-sell-item-index-input]");

let activeRoom = null;
let connecting = false;
let currentPhase = null;
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

initializeDefaults();
syncButtonAvailability();

connectButton?.addEventListener("click", () => {
  void connect();
});

leaveButton?.addEventListener("click", () => {
  void leave();
});

readyButton?.addEventListener("click", () => {
  sendReady();
});

prepButton?.addEventListener("click", () => {
  sendPrepCommand();
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
  setStatus("connecting");
  setError("");

  try {
    const { endpoint, roomName, setId } = readConfig();
    const { Client } = await import("https://esm.sh/@colyseus/sdk@0.17.34");
    const client = new Client(endpoint);
    const roomOptions = setId ? { setId } : undefined;
    const room = await client.joinOrCreate(roomName, roomOptions);

    activeRoom = room;
    currentPhase = readPhase(room.state?.phase);

    setStatus("connected");
    setCurrentSet(room.state?.setId);
    syncRoundFromState(room.state);
    syncSelfStatusFromState(room.state, room.sessionId);
    syncNextCmdSeq(room.state, room.sessionId);
    setCommandResult("-");

    await connectAutoFillRooms(client, roomName, roomOptions);
    setAutoFillStatus();

    room.onStateChange((state) => {
      setCurrentSet(state?.setId);
      syncRoundFromState(state);
      syncSelfStatusFromState(state, room.sessionId);
      syncNextCmdSeq(state, room.sessionId);
      currentPhase = readPhase(state?.phase);
      syncButtonAvailability();
      maybeScheduleAutoPrep();
    });

    room.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message) => {
      currentPhase = readPhase(message?.phase);
      setPhase(currentPhase);
      setRound(message?.roundIndex);
      syncButtonAvailability();
      maybeScheduleAutoPrep();
    });

    room.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (result) => {
      setCommandResultFromResult(result);
    });

    room.onLeave(() => {
      clearPendingAutoActions();
      void leaveAutoFillRooms();
      activeRoom = null;
      currentPhase = null;
      setStatus("disconnected");
      setAutoFillStatus();
      syncButtonAvailability();
    });

    maybeScheduleAutoReady();
    maybeScheduleAutoPrep();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    currentPhase = null;
    setStatus("error");
    setError(message);
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
  currentPhase = null;
  setStatus("disconnecting");
  syncButtonAvailability();

  try {
    if (typeof room.removeAllListeners === "function") {
      room.removeAllListeners();
    }

    if (typeof room.leave === "function") {
      await room.leave();
    }
  } finally {
    setStatus("disconnected");
    setAutoFillStatus();
    syncButtonAvailability();
  }
}

function sendReady() {
  if (!activeRoom) {
    setError("not connected");
    return;
  }

  const ready = Boolean(readyCheckbox?.checked);

  activeRoom.send(CLIENT_MESSAGE_TYPES.READY, { ready });
  setError("");
  setCommandResult(`ready sent: ${ready}`);
}

function sendPrepCommand() {
  if (!activeRoom) {
    setError("not connected");
    return;
  }

  if (currentPhase !== "Prep") {
    setError("phase is not Prep");
    return;
  }

  const cmdSeq = Number.parseInt(cmdSeqInput?.value ?? "", 10);

  if (!Number.isInteger(cmdSeq) || cmdSeq < 1) {
    setError("cmdSeq must be >= 1");
    return;
  }

  try {
    const payload = { cmdSeq };
    const boardPlacements = parsePlacementsSpec(placementsInput?.value ?? "");
    const xpPurchaseCount = parseOptionalIntegerInRange(
      xpPurchaseInput?.value,
      0,
      10,
      "xpPurchaseCount must be between 0 and 10",
    );
    const shopRefreshCount = parseOptionalIntegerInRange(
      shopRefreshInput?.value,
      0,
      5,
      "shopRefreshCount must be between 0 and 5",
    );
    const shopBuySlotIndex = parseOptionalIntegerInRange(
      shopBuySlotInput?.value,
      0,
      4,
      "shopBuySlotIndex must be between 0 and 4",
    );
    const shopLock = parseOptionalBoolean(shopLockInput?.value);
    const benchDeployIndex = parseOptionalIntegerInRange(
      benchDeployIndexInput?.value,
      0,
      8,
      "benchDeployIndex must be between 0 and 8",
    );
    const benchDeployCell = parseOptionalIntegerInRange(
      benchDeployCellInput?.value,
      0,
      7,
      "benchDeployCell must be between 0 and 7",
    );
    const benchSellIndex = parseOptionalIntegerInRange(
      benchSellIndexInput?.value,
      0,
      8,
      "benchSellIndex must be between 0 and 8",
    );
    const boardSellCell = parseOptionalIntegerInRange(
      boardSellCellInput?.value,
      0,
      7,
      "boardSellCell must be between 0 and 7",
    );
    const itemBuySlot = parseOptionalIntegerInRange(
      itemBuySlotInput?.value,
      0,
      4,
      "itemBuySlot must be between 0 and 4",
    );
    const equipItemIndex = parseOptionalIntegerInRange(
      equipItemIndexInput?.value,
      0,
      8,
      "equipItemIndex must be between 0 and 8",
    );
    const equipBenchIndex = parseOptionalIntegerInRange(
      equipBenchIndexInput?.value,
      0,
      8,
      "equipBenchIndex must be between 0 and 8",
    );
    const unequipBenchIndex = parseOptionalIntegerInRange(
      unequipBenchIndexInput?.value,
      0,
      8,
      "unequipBenchIndex must be between 0 and 8",
    );
    const unequipItemSlot = parseOptionalIntegerInRange(
      unequipItemSlotInput?.value,
      0,
      2,
      "unequipItemSlot must be between 0 and 2",
    );
    const sellItemIndex = parseOptionalIntegerInRange(
      sellItemIndexInput?.value,
      0,
      8,
      "sellItemIndex must be between 0 and 8",
    );

    if (boardPlacements.length > 0) {
      payload.boardPlacements = boardPlacements;
    }

    if (xpPurchaseCount !== null && xpPurchaseCount > 0) {
      payload.xpPurchaseCount = xpPurchaseCount;
    }

    if (shopRefreshCount !== null && shopRefreshCount > 0) {
      payload.shopRefreshCount = shopRefreshCount;
    }

    if (shopBuySlotIndex !== null) {
      payload.shopBuySlotIndex = shopBuySlotIndex;
    }

    if (shopLock !== null) {
      payload.shopLock = shopLock;
    }

    if (benchDeployIndex !== null || benchDeployCell !== null) {
      if (benchDeployIndex === null || benchDeployCell === null) {
        setError("bench deploy needs both index and cell");
        return;
      }

      payload.benchToBoardCell = {
        benchIndex: benchDeployIndex,
        cell: benchDeployCell,
      };
    }

    if (benchSellIndex !== null) {
      payload.benchSellIndex = benchSellIndex;
    }

    if (boardSellCell !== null) {
      payload.boardSellIndex = boardSellCell;
    }

    if (itemBuySlot !== null) {
      payload.itemBuySlotIndex = itemBuySlot;
    }

    if (equipItemIndex !== null && equipBenchIndex !== null) {
      payload.itemEquipToBench = {
        inventoryItemIndex: equipItemIndex,
        benchIndex: equipBenchIndex,
      };
    }

    if (unequipBenchIndex !== null && unequipItemSlot !== null) {
      payload.itemUnequipFromBench = {
        benchIndex: unequipBenchIndex,
        itemSlotIndex: unequipItemSlot,
      };
    }

    if (sellItemIndex !== null) {
      payload.itemSellInventoryIndex = sellItemIndex;
    }

    if (Object.keys(payload).length <= 1) {
      setError("prep payload is empty");
      return;
    }

    activeRoom.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, payload);

    setError("");
    setCommandResult(`prep sent: cmdSeq=${cmdSeq}`);

    if (cmdSeqInput) {
      cmdSeqInput.value = String(cmdSeq + 1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setError(message);
  }
}

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

  if (cmdSeqInput) {
    const cmdSeqFromQuery = Number.parseInt(params.get("cmdSeq") ?? "", 10);

    if (Number.isInteger(cmdSeqFromQuery) && cmdSeqFromQuery > 0) {
      cmdSeqInput.value = String(cmdSeqFromQuery);
    } else if (!cmdSeqInput.value) {
      cmdSeqInput.value = "1";
    }
  }

  if (placementsInput) {
    const placementsFromQuery = params.get("placements");

    if (typeof placementsFromQuery === "string" && placementsFromQuery.trim()) {
      placementsInput.value = placementsFromQuery;
    }
  }

  if (readyCheckbox) {
    readyCheckbox.checked = true;
  }

  setPhase("-");
  setRound("-");
  setSelfStatus("-");
  setBenchList("-");
  setBoardList("-");
  setCommandResult("-");
  setAutoFillStatus();

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

  if (readyButton) {
    readyButton.disabled = connecting || !connected;
  }

  if (prepButton) {
    prepButton.disabled = connecting || !connected || !prepPhase;
  }

  if (cmdSeqInput) {
    cmdSeqInput.disabled = connecting || !connected;
  }

  if (placementsInput) {
    placementsInput.disabled = connecting || !connected;
  }

  if (xpPurchaseInput) {
    xpPurchaseInput.disabled = connecting || !connected;
  }

  if (shopRefreshInput) {
    shopRefreshInput.disabled = connecting || !connected;
  }

  if (shopBuySlotInput) {
    shopBuySlotInput.disabled = connecting || !connected;
  }

  if (shopLockInput) {
    shopLockInput.disabled = connecting || !connected;
  }

  if (benchDeployIndexInput) {
    benchDeployIndexInput.disabled = connecting || !connected;
  }

  if (benchDeployCellInput) {
    benchDeployCellInput.disabled = connecting || !connected;
  }

  if (benchSellIndexInput) {
    benchSellIndexInput.disabled = connecting || !connected;
  }

  if (boardSellCellInput) {
    boardSellCellInput.disabled = connecting || !connected;
  }

  if (itemBuySlotInput) {
    itemBuySlotInput.disabled = connecting || !connected;
  }

  if (equipItemIndexInput) {
    equipItemIndexInput.disabled = connecting || !connected;
  }

  if (equipBenchIndexInput) {
    equipBenchIndexInput.disabled = connecting || !connected;
  }

  if (unequipBenchIndexInput) {
    unequipBenchIndexInput.disabled = connecting || !connected;
  }

  if (unequipItemSlotInput) {
    unequipItemSlotInput.disabled = connecting || !connected;
  }

  if (sellItemIndexInput) {
    sellItemIndexInput.disabled = connecting || !connected;
  }

  if (autoFillInput) {
    autoFillInput.disabled = connecting || connected;
  }
}

function syncRoundFromState(state) {
  setPhase(readPhase(state?.phase) ?? "-");

  if (typeof state?.roundIndex === "number") {
    setRound(state.roundIndex);
    return;
  }

  setRound("-");
}

function syncSelfStatusFromState(state, sessionId) {
  const player = state?.players?.get?.(sessionId);

  if (!player) {
    setSelfStatus("-");
    setBenchList("-");
    setBoardList("-");
    return;
  }

  const benchUnits = normalizeBenchUnits(player.benchUnits);
  const boardUnits = normalizeBoardUnits(player.boardUnits);

  setSelfStatus(
    `ready=${Boolean(player.ready)} hp=${Number(player.hp)} units=${Number(player.boardUnitCount)} gold=${Number(player.gold)} xp=${Number(player.xp)} lv=${Number(player.level)} bench=${benchUnits.length} board=${boardUnits.length} lock=${Boolean(player.shopLocked)} seq=${Number(player.lastCmdSeq)}`,
  );
  setBenchList(formatBenchUnitsWithIndex(benchUnits));
  setBoardList(formatBoardUnits(boardUnits));

  // Display item shop offers
  if (state?.itemShopOffers && itemShopListElement) {
    itemShopListElement.innerHTML = state.itemShopOffers
      .map((offer, i) => `${i}: ${offer.itemType} (${offer.cost}G)`)
      .join('<br>');
  } else if (itemShopListElement) {
    itemShopListElement.innerHTML = '-';
  }

  // Display item inventory
  if (state?.itemInventory && inventoryListElement) {
    inventoryListElement.innerHTML = state.itemInventory
      .map((item, i) => `${i}: ${item}`)
      .join('<br>');
  } else if (inventoryListElement) {
    inventoryListElement.innerHTML = '-';
  }
}

function syncNextCmdSeq(state, sessionId) {
  if (!cmdSeqInput) {
    return;
  }

  const player = state?.players?.get?.(sessionId);

  if (!player || typeof player.lastCmdSeq !== "number") {
    return;
  }

  const nextSeq = player.lastCmdSeq + 1;
  const currentSeq = Number.parseInt(cmdSeqInput.value, 10);

  if (!Number.isInteger(currentSeq) || currentSeq < nextSeq) {
    cmdSeqInput.value = String(nextSeq);
  }
}

function setCommandResultFromResult(result) {
  if (result?.accepted === true) {
    setCommandResult("accepted");
    return;
  }

  if (result?.accepted === false && typeof result.code === "string") {
    const code = result.code;
    const hint = buildRejectHint(code);
    setCommandResult(`rejected: ${code}${hint ? ` (${hint})` : ""}`);
    return;
  }

  setCommandResult("unknown result");
}

function buildRejectHint(code) {
  switch (code) {
    case "INVALID_PAYLOAD": {
      const hints = [];

      const cmdSeq = Number.parseInt(cmdSeqInput?.value ?? "", 10);
      if (!Number.isInteger(cmdSeq) || cmdSeq < 1) {
        hints.push("CmdSeq must be >= 1");
      }

      const xpPurchase = Number.parseInt(xpPurchaseInput?.value ?? "0", 10);
      if (xpPurchaseInput?.value && (!Number.isInteger(xpPurchase) || xpPurchase < 0 || xpPurchase > 10)) {
        hints.push("XP Buy must be 0-10");
      }

      const shopRefresh = Number.parseInt(shopRefreshInput?.value ?? "0", 10);
      if (shopRefreshInput?.value && (!Number.isInteger(shopRefresh) || shopRefresh < 0 || shopRefresh > 5)) {
        hints.push("Shop Refresh must be 0-5");
      }

      const shopBuySlot = Number.parseInt(shopBuySlotInput?.value ?? "", 10);
      if (shopBuySlotInput?.value && (!Number.isInteger(shopBuySlot) || shopBuySlot < 0 || shopBuySlot > 4)) {
        hints.push("Shop Buy Slot must be 0-4");
      }

      const benchDeployIndex = Number.parseInt(benchDeployIndexInput?.value ?? "", 10);
      if (benchDeployIndexInput?.value && (!Number.isInteger(benchDeployIndex) || benchDeployIndex < 0 || benchDeployIndex > 8)) {
        hints.push("Bench Deploy Index must be 0-8");
      }

      const benchDeployCell = Number.parseInt(benchDeployCellInput?.value ?? "", 10);
      if (benchDeployCellInput?.value && (!Number.isInteger(benchDeployCell) || benchDeployCell < 0 || benchDeployCell > 7)) {
        hints.push("Bench Deploy Cell must be 0-7");
      }

      const benchSell = Number.parseInt(benchSellIndexInput?.value ?? "", 10);
      if (benchSellIndexInput?.value && (!Number.isInteger(benchSell) || benchSell < 0 || benchSell > 8)) {
        hints.push("Bench Sell Index must be 0-8");
      }

      const boardSellCell = Number.parseInt(boardSellCellInput?.value ?? "", 10);
      if (
        boardSellCellInput?.value &&
        (!Number.isInteger(boardSellCell) || boardSellCell < 0 || boardSellCell > 7)
      ) {
        hints.push("Board Sell Cell must be 0-7");
      }

      const shopLockValue = shopLockInput?.value?.trim();
      if (shopLockValue && shopLockValue !== "skip" && shopLockValue !== "true" && shopLockValue !== "false") {
        hints.push("Shop Lock must be skip/true/false");
      }

      const itemBuySlot = Number.parseInt(itemBuySlotInput?.value ?? "", 10);
      if (itemBuySlotInput?.value && (!Number.isInteger(itemBuySlot) || itemBuySlot < 0 || itemBuySlot > 4)) {
        hints.push("Item Buy Slot must be 0-4");
      }

      const equipItemIndex = Number.parseInt(equipItemIndexInput?.value ?? "", 10);
      if (equipItemIndexInput?.value && (!Number.isInteger(equipItemIndex) || equipItemIndex < 0 || equipItemIndex > 8)) {
        hints.push("Equip Item Index must be 0-8");
      }

      const equipBenchIndex = Number.parseInt(equipBenchIndexInput?.value ?? "", 10);
      if (equipBenchIndexInput?.value && (!Number.isInteger(equipBenchIndex) || equipBenchIndex < 0 || equipBenchIndex > 8)) {
        hints.push("Equip Bench Index must be 0-8");
      }

      const unequipBenchIndex = Number.parseInt(unequipBenchIndexInput?.value ?? "", 10);
      if (unequipBenchIndexInput?.value && (!Number.isInteger(unequipBenchIndex) || unequipBenchIndex < 0 || unequipBenchIndex > 8)) {
        hints.push("Unequip Bench Index must be 0-8");
      }

      const unequipItemSlot = Number.parseInt(unequipItemSlotInput?.value ?? "", 10);
      if (unequipItemSlotInput?.value && (!Number.isInteger(unequipItemSlot) || unequipItemSlot < 0 || unequipItemSlot > 2)) {
        hints.push("Unequip Item Slot must be 0-2");
      }

      const sellItemIndex = Number.parseInt(sellItemIndexInput?.value ?? "", 10);
      if (sellItemIndexInput?.value && (!Number.isInteger(sellItemIndex) || sellItemIndex < 0 || sellItemIndex > 8)) {
        hints.push("Sell Item Index must be 0-8");
      }

      if (hints.length > 0) {
        return hints.join("; ");
      }

      return "check conflicting operations or empty bench/cell";
    }
    case "INSUFFICIENT_GOLD":
      return "not enough gold for XP/Shop operations (sell bench units to get purchase cost back)";
    case "BENCH_FULL":
      return "bench is full (9/9)";
    case "PHASE_MISMATCH":
      return "not in Prep phase";
    case "LATE_INPUT":
      return "prep deadline passed";
    case "DUPLICATE_CMD":
      return "cmdSeq must increase";
    case "UNKNOWN_PLAYER":
      return "player not found";
    default:
      return "";
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

function setStatus(status) {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = String(status);
}

function setPhase(phase) {
  if (!phaseElement) {
    return;
  }

  phaseElement.textContent = String(phase);
}

function setRound(round) {
  if (!roundElement) {
    return;
  }

  roundElement.textContent = String(round);
}

function setSelfStatus(text) {
  if (!selfStatusElement) {
    return;
  }

  selfStatusElement.textContent = String(text);
}

function setBenchList(text) {
  if (!benchListElement) {
    return;
  }

  benchListElement.textContent = String(text);
}

function setBoardList(text) {
  if (!boardListElement) {
    return;
  }

  boardListElement.textContent = String(text);
}

function setCommandResult(text) {
  if (!commandResultElement) {
    return;
  }

  commandResultElement.textContent = String(text);
}

function setError(message) {
  if (!errorElement) {
    return;
  }

  errorElement.textContent = String(message);
}

function setCurrentSet(setId) {
  if (!setIdElement) {
    return;
  }

  setIdElement.textContent = normalizeSetId(setId) ?? "-";
}

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

      setError(`autofill join failed: ${message}`);
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
    }),
  );
}

function setAutoFillStatus() {
  if (!autoFillStatusElement) {
    return;
  }

  if (autoConfig.autoFillBots <= 0) {
    autoFillStatusElement.textContent = "disabled";
    return;
  }

  autoFillStatusElement.textContent = `${autoFillRooms.length}/${autoConfig.autoFillBots}`;
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

    if (!activeRoom) {
      return;
    }

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

    if (!activeRoom || currentPhase !== "Prep") {
      return;
    }

    sendPrepCommand();
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

function parseOptionalIntegerInRange(rawValue, minValue, maxValue, errorMessage) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return null;
  }

  const parsed = Number.parseInt(String(rawValue), 10);

  if (!Number.isInteger(parsed) || parsed < minValue || parsed > maxValue) {
    throw new Error(errorMessage);
  }

  return parsed;
}

function parseOptionalBoolean(rawValue) {
  const normalized = String(rawValue ?? "skip").trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return null;
}

function normalizeBenchUnits(rawBenchUnits) {
  if (!rawBenchUnits) {
    return [];
  }

  if (Array.isArray(rawBenchUnits)) {
    return rawBenchUnits.map((unitType) => String(unitType));
  }

  try {
    return Array.from(rawBenchUnits).map((unitType) => String(unitType));
  } catch {
    return [];
  }
}

function normalizeBoardUnits(rawBoardUnits) {
  if (!rawBoardUnits) {
    return [];
  }

  if (Array.isArray(rawBoardUnits)) {
    return rawBoardUnits.map((unit) => String(unit));
  }

  try {
    return Array.from(rawBoardUnits).map((unit) => String(unit));
  } catch {
    return [];
  }
}

function formatBenchUnitsWithIndex(benchUnits) {
  if (benchUnits.length === 0) {
    return "(empty)";
  }

  return benchUnits.map((unitType, index) => `${index}:${unitType}`).join(",");
}

function formatBoardUnits(boardUnits) {
  if (boardUnits.length === 0) {
    return "(empty)";
  }

  const parsed = boardUnits.map((unitText) => {
    const [cellText, unitPart] = String(unitText).split(":");
    const cell = Number.parseInt(cellText ?? "", 10);
    const hasValidCell = Number.isInteger(cell) && cell >= 0 && cell <= 7;
    const lane = hasValidCell ? (cell <= 3 ? "F" : "B") : "?";

    return {
      cell: hasValidCell ? cell : 99,
      text: `${lane}${cellText}:${unitPart ?? "-"}`,
    };
  });

  parsed.sort((left, right) => left.cell - right.cell);

  return parsed.map((item) => item.text).join(" | ");
}
