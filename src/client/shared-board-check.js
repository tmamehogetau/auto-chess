const CLIENT_MESSAGE_TYPES = {
  CURSOR_MOVE: "shared_cursor_move",
  SELECT_UNIT: "shared_select_unit",
  DRAG_STATE: "shared_drag_state",
  PLACE_UNIT: "shared_place_unit",
  RESET: "shared_reset",
};

const SERVER_MESSAGE_TYPES = {
  ROLE: "shared_role",
  ACTION_RESULT: "shared_action_result",
};

const DEFAULT_ENDPOINT = "ws://localhost:2567";
const DEFAULT_ROOM_NAME = "shared_board";
const RECONNECT_TOKEN_KEY_PREFIX = "shared-board:reconnect-token:";

const endpointInput = document.querySelector("[data-endpoint-input]");
const roomInput = document.querySelector("[data-room-input]");
const autoconnectInput = document.querySelector("[data-autoconnect-input]");
const connectButton = document.querySelector("[data-connect-button]");
const leaveButton = document.querySelector("[data-leave-button]");
const resetButton = document.querySelector("[data-reset-button]");

const connectionStatus = document.querySelector("[data-connection-status]");
const roleDisplay = document.querySelector("[data-role-display]");
const sessionDisplay = document.querySelector("[data-session-display]");
const selectedUnitDisplay = document.querySelector("[data-selected-unit-display]");

const boardGrid = document.querySelector("[data-board-grid]");
const cursorList = document.querySelector("[data-cursor-list]");
const eventLog = document.querySelector("[data-event-log]");

let client = null;
let room = null;
let selectedUnitId = null;
let draggedUnitId = null;
let roleInfo = null;
let lastServerEventCount = 0;
let lastSpectatorWarnTime = 0;
const SPECTATOR_WARN_THROTTLE_MS = 1000;
let connectedEndpoint = null;
let connectedRoomName = null;

const ACTION_ERROR_MESSAGES = {
  INVALID_PAYLOAD: "入力が不正です",
  NOT_ACTIVE_PLAYER: "観戦者は操作できません",
  UNIT_NOT_OWNED: "そのユニットはあなたの所有ではありません",
  TARGET_LOCKED: "そのマスは他プレイヤーが操作中です",
  TARGET_OCCUPIED: "そのマスは埋まっています",
};

function shortId(value) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 8);
}

function isConnected() {
  return room !== null;
}

function isSpectator() {
  return roleInfo?.isSpectator === true;
}

function appendSpectatorWarning(message) {
  const now = Date.now();

  if (now - lastSpectatorWarnTime <= SPECTATOR_WARN_THROTTLE_MS) {
    return;
  }

  appendLog(message, "warn");
  lastSpectatorWarnTime = now;
}

function getReconnectTokenStorageKey(endpoint, roomName) {
  return `${RECONNECT_TOKEN_KEY_PREFIX}${endpoint}::${roomName}`;
}

function readReconnectToken(endpoint, roomName) {
  try {
    return sessionStorage.getItem(getReconnectTokenStorageKey(endpoint, roomName)) || "";
  } catch {
    return "";
  }
}

function writeReconnectToken(endpoint, roomName, token) {
  if (!token) {
    return;
  }

  try {
    sessionStorage.setItem(getReconnectTokenStorageKey(endpoint, roomName), token);
  } catch {
    // ignore storage failures
  }
}

function clearReconnectToken(endpoint, roomName) {
  try {
    sessionStorage.removeItem(getReconnectTokenStorageKey(endpoint, roomName));
  } catch {
    // ignore storage failures
  }
}

function cacheCurrentReconnectToken() {
  if (!room || !connectedEndpoint || !connectedRoomName) {
    return;
  }

  if (typeof room.reconnectionToken !== "string" || room.reconnectionToken.length === 0) {
    return;
  }

  writeReconnectToken(connectedEndpoint, connectedRoomName, room.reconnectionToken);
}

function updateConnectionUi(connected) {
  if (connectionStatus) {
    connectionStatus.textContent = connected ? "接続中" : "未接続";
    connectionStatus.style.color = connected ? "var(--success)" : "var(--danger)";
  }

  if (connectButton) {
    connectButton.disabled = connected;
  }

  if (leaveButton) {
    leaveButton.disabled = !connected;
  }

  if (resetButton) {
    resetButton.disabled = !connected;
  }

  if (endpointInput) {
    endpointInput.disabled = connected;
  }

  if (roomInput) {
    roomInput.disabled = connected;
  }
}

function updateRoleDisplay() {
  if (!roleDisplay) {
    return;
  }

  if (!roleInfo) {
    roleDisplay.textContent = "-";
    return;
  }

  if (roleInfo.isSpectator) {
    roleDisplay.textContent = "spectator";
    return;
  }

  roleDisplay.textContent = `active (slot ${roleInfo.slotIndex})`;
}

function updateSessionDisplay() {
  if (!sessionDisplay) {
    return;
  }

  sessionDisplay.textContent = room ? shortId(room.sessionId) : "-";
}

function updateSelectedUnitDisplay() {
  if (!selectedUnitDisplay) {
    return;
  }

  selectedUnitDisplay.textContent = selectedUnitId ?? "-";
}

function appendLog(message, type = "info") {
  if (!eventLog) {
    return;
  }

  const line = document.createElement("div");
  line.className = "log-entry";
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  line.innerHTML = `<span class="log-time">[${hh}:${mm}:${ss}]</span><span class="log-type-${type}">${message}</span>`;
  eventLog.appendChild(line);

  while (eventLog.children.length > 120) {
    eventLog.removeChild(eventLog.firstChild);
  }

  eventLog.scrollTop = eventLog.scrollHeight;
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

function listFromSchema(listLike) {
  if (!listLike) {
    return [];
  }

  if (Array.isArray(listLike)) {
    return listLike;
  }

  if (typeof listLike.toArray === "function") {
    try {
      return listLike.toArray();
    } catch {
      return [];
    }
  }

  if (Symbol.iterator in Object(listLike)) {
    return Array.from(listLike);
  }

  return [];
}

function getPlayerColor(state, playerId) {
  const player = mapGet(state.players, playerId);
  return player?.color ?? "#999999";
}

function sendCursorMove(cellIndex) {
  if (!room) {
    return;
  }

  room.send(CLIENT_MESSAGE_TYPES.CURSOR_MOVE, { cellIndex });
}

function sendSelectUnit(unitId) {
  if (!room) {
    return;
  }

  room.send(CLIENT_MESSAGE_TYPES.SELECT_UNIT, { unitId });
}

function sendPlaceUnit(unitId, toCell) {
  if (!room) {
    return;
  }

  room.send(CLIENT_MESSAGE_TYPES.PLACE_UNIT, { unitId, toCell });
}

function sendDragState(isDragging, unitId) {
  if (!room) {
    return;
  }

  const payload = unitId
    ? {
        isDragging,
        unitId,
      }
    : {
        isDragging,
      };

  room.send(CLIENT_MESSAGE_TYPES.DRAG_STATE, payload);
}

function handleCellClick(state, cellIndex) {
  if (!room) {
    return;
  }

  if (isSpectator()) {
    appendSpectatorWarning("観戦者は操作できません");
    return;
  }

  if (selectedUnitId) {
    sendPlaceUnit(selectedUnitId, cellIndex);
    return;
  }

  const cell = mapGet(state.cells, cellIndex);
  if (!cell) {
    return;
  }

  if (cell.ownerId === room.sessionId && cell.unitId !== "" && cell.unitId !== "dummy-boss") {
    selectedUnitId = cell.unitId;
    updateSelectedUnitDisplay();
    sendSelectUnit(cell.unitId);
  }
}

function handleDragStart(event, state, cellIndex) {
  if (!room || isSpectator()) {
    event.preventDefault();
    return;
  }

  const cell = mapGet(state.cells, cellIndex);
  if (!cell || cell.ownerId !== room.sessionId || cell.unitId === "" || cell.unitId === "dummy-boss") {
    event.preventDefault();
    return;
  }

  draggedUnitId = cell.unitId;
  selectedUnitId = cell.unitId;
  updateSelectedUnitDisplay();
  sendDragState(true, cell.unitId);

  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", cell.unitId);
    event.dataTransfer.effectAllowed = "move";
  }
}

function handleDragEnd() {
  if (!room) {
    return;
  }

  sendDragState(false, draggedUnitId ?? undefined);
  draggedUnitId = null;
}

function handleDrop(event, cellIndex) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");

  if (!room || isSpectator()) {
    return;
  }

  const unitIdFromTransfer = event.dataTransfer?.getData("text/plain") || "";
  const unitId = unitIdFromTransfer || draggedUnitId || selectedUnitId;

  if (!unitId) {
    return;
  }

  sendPlaceUnit(unitId, cellIndex);
}

function renderCursorChips(state, cellElement, cellIndex) {
  const chips = document.createElement("div");
  chips.className = "cursor-chips";

  for (const [playerId, cursor] of mapEntries(state.cursors)) {
    if (!cursor || cursor.cellIndex !== cellIndex) {
      continue;
    }

    const chip = document.createElement("div");
    chip.className = "cursor-chip";
    chip.style.backgroundColor = cursor.color || getPlayerColor(state, playerId);
    chip.title = `${shortId(playerId)} @ ${cursor.cellIndex}`;
    chips.appendChild(chip);
  }

  if (chips.children.length > 0) {
    cellElement.appendChild(chips);
  }
}

function renderBoard(state) {
  if (!boardGrid) {
    return;
  }

  const width = Number(state.boardWidth ?? 6);
  const height = Number(state.boardHeight ?? 4);
  const totalCells = width * height;

  boardGrid.style.gridTemplateColumns = `repeat(${width}, 1fr)`;

  while (boardGrid.children.length < totalCells) {
    const cell = document.createElement("div");
    cell.className = "board-cell";
    boardGrid.appendChild(cell);
  }

  while (boardGrid.children.length > totalCells) {
    boardGrid.removeChild(boardGrid.lastChild);
  }

  for (let cellIndex = 0; cellIndex < totalCells; cellIndex += 1) {
    const cellElement = boardGrid.children[cellIndex];
    if (!cellElement) {
      continue;
    }

    const cell = mapGet(state.cells, cellIndex);
    const unitId = cell?.unitId ?? "";
    const ownerId = cell?.ownerId ?? "";
    const isBossCell = unitId === "dummy-boss";
    const isLocked = (cell?.lockedBy ?? "") !== "" && (cell?.lockUntilMs ?? 0) > Date.now();

    cellElement.className = "board-cell";
    cellElement.innerHTML = "";
    cellElement.draggable = false;

    cellElement.onmouseenter = () => {
      sendCursorMove(cellIndex);
    };

    cellElement.onclick = () => {
      handleCellClick(state, cellIndex);
    };

    cellElement.ondragover = (event) => {
      event.preventDefault();
      cellElement.classList.add("drag-over");
    };

    cellElement.ondragleave = () => {
      cellElement.classList.remove("drag-over");
    };

    cellElement.ondrop = (event) => {
      handleDrop(event, cellIndex);
    };

    if (isBossCell) {
      cellElement.classList.add("boss-cell");
      const boss = document.createElement("div");
      boss.className = "unit-badge";
      boss.innerHTML = `<div>👑</div><span class="unit-id">dummy-boss</span>`;
      cellElement.appendChild(boss);
    } else if (unitId !== "") {
      cellElement.classList.add("unit-cell");

      // 選択中ユニットの盤面強調
      if (room && ownerId === room.sessionId && unitId === selectedUnitId) {
        cellElement.classList.add("selected-cell");
      }

      const badge = document.createElement("div");
      badge.className = "unit-badge";
      badge.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:${getPlayerColor(state, ownerId)}"></div><span class="unit-id">${shortId(unitId)}</span>`;
      cellElement.appendChild(badge);

      if (!isSpectator() && room && ownerId === room.sessionId) {
        cellElement.draggable = true;
        cellElement.classList.add("draggable");
        cellElement.ondragstart = (event) => {
          handleDragStart(event, state, cellIndex);
        };
        cellElement.ondragend = () => {
          handleDragEnd();
        };
      }
    }

    if (isLocked) {
      cellElement.classList.add("locked-cell");
      const lock = document.createElement("div");
      lock.className = "lock-indicator";
      lock.textContent = "🔒";
      cellElement.appendChild(lock);

      // ロック残時間の表示
      const remainingMs = cell.lockUntilMs - Date.now();
      const remainingSec = Math.max(0, remainingMs / 1000).toFixed(1);
      const remaining = document.createElement("div");
      remaining.className = "lock-remaining";
      remaining.textContent = `${remainingSec}s`;
      cellElement.appendChild(remaining);
    }

    renderCursorChips(state, cellElement, cellIndex);
  }
}

function renderCursorList(state) {
  if (!cursorList) {
    return;
  }

  cursorList.innerHTML = "";

  const entries = mapEntries(state.cursors).sort((left, right) => left[0].localeCompare(right[0]));

  if (entries.length === 0) {
    cursorList.innerHTML = '<div style="color:#666; font-size:0.85rem;">接続待ち...</div>';
    return;
  }

  for (const [playerId, cursor] of entries) {
    const item = document.createElement("div");
    item.className = "cursor-item";

    const youSuffix = room && room.sessionId === playerId ? " (you)" : "";
    const spectatorSuffix = cursor?.isSpectator ? '<span class="cursor-spectator"> spectator</span>' : "";
    const draggingSuffix = cursor?.isDragging ? '<span class="cursor-dragging"> dragging</span>' : "";

    item.innerHTML = `<div class="cursor-color" style="background:${cursor?.color ?? getPlayerColor(state, playerId)}"></div><span class="cursor-id">${shortId(playerId)}${youSuffix}</span><span class="cursor-cell">cell: ${cursor?.cellIndex ?? -1}</span>${spectatorSuffix}${draggingSuffix}`;

    cursorList.appendChild(item);
  }
}

function syncServerEventLog(state) {
  const events = listFromSchema(state.eventLog);

  if (events.length < lastServerEventCount) {
    lastServerEventCount = 0;
  }

  for (let index = lastServerEventCount; index < events.length; index += 1) {
    appendLog(String(events[index]), "info");
  }

  lastServerEventCount = events.length;
}

function renderState(state) {
  if (!state) {
    return;
  }

  if (room) {
    const myPlayer = mapGet(state.players, room.sessionId);

    if (myPlayer) {
      const inferredRoleInfo = {
        isSpectator: myPlayer.isSpectator === true,
        slotIndex: Number.isInteger(myPlayer.slotIndex) ? myPlayer.slotIndex : -1,
        color: typeof myPlayer.color === "string" ? myPlayer.color : "#999999",
      };

      if (
        !roleInfo ||
        roleInfo.isSpectator !== inferredRoleInfo.isSpectator ||
        roleInfo.slotIndex !== inferredRoleInfo.slotIndex ||
        roleInfo.color !== inferredRoleInfo.color
      ) {
        roleInfo = inferredRoleInfo;
        updateRoleDisplay();
      }
    }

    const myCursor = mapGet(state.cursors, room.sessionId);
    const syncedSelectedUnitId = myCursor?.selectedUnitId || null;
    if (syncedSelectedUnitId !== selectedUnitId) {
      selectedUnitId = syncedSelectedUnitId;
      updateSelectedUnitDisplay();
    }
  }

  renderBoard(state);
  renderCursorList(state);
  syncServerEventLog(state);
}

async function connectRoom() {
  if (!endpointInput || !roomInput) {
    appendLog("必要なDOM要素が見つかりません", "error");
    return;
  }

  const endpoint = endpointInput.value.trim() || DEFAULT_ENDPOINT;
  const roomName = roomInput.value.trim() || DEFAULT_ROOM_NAME;

  appendLog(`connecting to ${endpoint} / ${roomName}`, "info");

  try {
    const sdk = await import("https://esm.sh/@colyseus/sdk@0.17.34");
    const ClientCtor = sdk.Client;
    client = new ClientCtor(endpoint);

    const reconnectToken = readReconnectToken(endpoint, roomName);

    if (reconnectToken) {
      try {
        room = await client.reconnect(reconnectToken);
        appendLog(`reconnected: ${shortId(room.sessionId)}`, "info");
      } catch (error) {
        appendLog(`reconnect failed: ${String(error)}`, "warn");
        clearReconnectToken(endpoint, roomName);
        room = await client.joinOrCreate(roomName);
      }
    } else {
      room = await client.joinOrCreate(roomName);
    }

    connectedEndpoint = endpoint;
    connectedRoomName = roomName;
    cacheCurrentReconnectToken();

    roleInfo = null;
    selectedUnitId = null;
    draggedUnitId = null;
    lastServerEventCount = 0;
    lastSpectatorWarnTime = 0;

    room.onStateChange((state) => {
      renderState(state);
    });

    room.onMessage(SERVER_MESSAGE_TYPES.ROLE, (payload) => {
      roleInfo = payload;
      if (payload.isSpectator) {
        lastSpectatorWarnTime = Date.now();
      }
      updateRoleDisplay();
      appendLog(
        payload.isSpectator
          ? `joined as spectator`
          : `joined as active player (slot ${payload.slotIndex})`,
        "info",
      );
    });

    room.onMessage(SERVER_MESSAGE_TYPES.ACTION_RESULT, (payload) => {
      if (payload.accepted) {
        appendLog(`action ok: ${payload.action}`, "info");
        // place_unit 成功時のみ selectedUnitId をクリア
        if (payload.action === "place_unit") {
          selectedUnitId = null;
          updateSelectedUnitDisplay();
        }
        return;
      }
      // 失敗コードを日本語メッセージに変換
      const errorMessage = ACTION_ERROR_MESSAGES[payload.code] || payload.code;
      appendLog(`操作失敗: ${errorMessage} (${payload.action})`, "warn");
    });

    room.onError((...args) => {
      appendLog(`room error: ${JSON.stringify(args)}`, "error");
    });

    room.onLeave((code) => {
      cacheCurrentReconnectToken();
      appendLog(`disconnected (code=${code})`, "warn");
      room = null;
      roleInfo = null;
      selectedUnitId = null;
      draggedUnitId = null;
      lastSpectatorWarnTime = 0;
      updateConnectionUi(false);
      updateRoleDisplay();
      updateSessionDisplay();
      updateSelectedUnitDisplay();
    });

    updateConnectionUi(true);
    updateRoleDisplay();
    updateSessionDisplay();
    updateSelectedUnitDisplay();
    appendLog(`connected: ${shortId(room.sessionId)}`, "info");
  } catch (error) {
    appendLog(`connect error: ${String(error)}`, "error");
  }
}

function leaveRoom() {
  if (!room) {
    return;
  }

  if (connectedEndpoint && connectedRoomName) {
    clearReconnectToken(connectedEndpoint, connectedRoomName);
  }

  room.leave();
  room = null;
  roleInfo = null;
  selectedUnitId = null;
  draggedUnitId = null;
  lastSpectatorWarnTime = 0;
  updateConnectionUi(false);
  updateRoleDisplay();
  updateSessionDisplay();
  updateSelectedUnitDisplay();
  appendLog("left room", "info");
}

function resetBoard() {
  if (!room) {
    appendLog("not connected", "warn");
    return;
  }

  if (isSpectator()) {
    appendSpectatorWarning("観戦者はリセットできません");
    return;
  }

  room.send(CLIENT_MESSAGE_TYPES.RESET, {});
}

function applyQueryDefaults() {
  const params = new URLSearchParams(window.location.search);

  const endpoint = params.get("endpoint");
  if (endpointInput && endpoint) {
    endpointInput.value = endpoint;
  }

  const roomName = params.get("roomName") || params.get("room");
  if (roomInput && roomName) {
    roomInput.value = roomName;
  }

  const autoconnect = params.get("autoconnect");
  if (autoconnectInput && autoconnect !== null) {
    autoconnectInput.checked = autoconnect === "1" || autoconnect === "true";
  }
}

function bootstrap() {
  applyQueryDefaults();
  updateConnectionUi(false);
  updateRoleDisplay();
  updateSessionDisplay();
  updateSelectedUnitDisplay();

  if (connectButton) {
    connectButton.addEventListener("click", () => {
      void connectRoom();
    });
  }

  if (leaveButton) {
    leaveButton.addEventListener("click", () => {
      leaveRoom();
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      resetBoard();
    });
  }

  appendLog("ready", "info");

  if (autoconnectInput?.checked) {
    setTimeout(() => {
      void connectRoom();
    }, 100);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
