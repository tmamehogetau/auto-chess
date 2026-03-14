/**
 * Shared Board Client モジュール
 * 共有ボードルームの接続・状態管理・UI操作
 */

import { mapEntries, mapGet, shortPlayerId } from "./utils/pure-utils.js";

/**
 * @typedef {Object} SharedBoardDOMRefs
 * @property {HTMLElement|null} gridElement 共有ボードグリッド
 * @property {HTMLElement|null} cursorListElement カーソル一覧
 */

/**
 * @typedef {Object} SharedBoardDependencies
 * @property {object|null} client Colyseus Client
 * @property {string} gamePlayerId ゲームプレイヤーID
 * @property {(message: string, type: string) => void} onLog ログ追加関数
 * @property {(message: string, type: string) => void} showMessage メッセージ表示関数
 * @property {(client: object, roomName: string, options?: object) => Promise<object>} joinOrCreate ルーム接続関数
 */

const DEFAULT_SHARED_BOARD_ROOM_NAME = "shared_board";

/** @type {SharedBoardDOMRefs} */
let domRefs = {
  gridElement: null,
  cursorListElement: null,
};

/** @type {SharedBoardDependencies} */
let deps = {
  client: null,
  gamePlayerId: "",
  onLog: () => {},
  showMessage: () => {},
  joinOrCreate: async () => null,
};

/** @type {object|null} */
let sharedBoardRoom = null;

/** @type {object|null} */
let currentSharedBoardState = null;

/** @type {boolean} */
let sharedBoardSpectatorNoticeShown = false;

/** @type {string|null} */
let sharedDraggedUnitId = null;

/** @type {string|null} */
let selectedSharedUnitId = null;

/**
 * 共有ボードクライアント初期化
 * @param {SharedBoardDOMRefs} refs DOM参照
 * @param {SharedBoardDependencies} dependencies 依存関数
 */
export function initSharedBoardClient(refs, dependencies) {
  domRefs = { ...domRefs, ...refs };
  deps = { ...deps, ...dependencies };
}

/**
 * 共有ボードルームに接続
 * @param {object} client Colyseus Client
 * @returns {Promise<void>}
 */
export async function connectSharedBoard(client) {
  if (!client || sharedBoardRoom) {
    return;
  }

  try {
    const sharedBoardJoinOptions = deps.gamePlayerId
      ? { gamePlayerId: deps.gamePlayerId }
      : undefined;

    sharedBoardRoom = await client.joinOrCreate(
      DEFAULT_SHARED_BOARD_ROOM_NAME,
      sharedBoardJoinOptions,
    );
    currentSharedBoardState = null;
    sharedBoardSpectatorNoticeShown = false;
    sharedDraggedUnitId = null;
    selectedSharedUnitId = null;

    sharedBoardRoom.onMessage("shared_role", (message) => {
      if (message?.isSpectator === true && !sharedBoardSpectatorNoticeShown) {
        deps.onLog("Shared board role: spectator", "info");
      }
    });

    sharedBoardRoom.onMessage("shared_action_result", (message) => {
      if (message?.accepted === true && message.action === "place_unit") {
        selectedSharedUnitId = null;
        renderSharedBoardState(currentSharedBoardState);
        deps.showMessage("Shared board move applied", "success");
      }

      if (message?.accepted === false) {
        deps.onLog(
          `[Shared board] ${message.action ?? "action"} rejected: ${message.code ?? "UNKNOWN"}`,
          "info",
        );
        deps.showMessage(
          `Shared board ${message.action ?? "action"} rejected: ${message.code ?? "UNKNOWN"}`,
          "error",
        );
      }
    });

    sharedBoardRoom.onStateChange((state) => {
      currentSharedBoardState = state;
      renderSharedBoardState(state);
    });

    sharedBoardRoom.onLeave(() => {
      sharedBoardRoom = null;
      currentSharedBoardState = null;
      sharedDraggedUnitId = null;
      selectedSharedUnitId = null;
      renderSharedBoardState(null);
    });
  } catch (error) {
    currentSharedBoardState = null;
    renderSharedBoardState(null);
    const message = error instanceof Error ? error.message : String(error);
    deps.onLog(`Shared board unavailable: ${message}`, "info");
  }
}

/**
 * 共有ボードルームから切断
 */
export function leaveSharedBoardRoom() {
  if (!sharedBoardRoom) {
    currentSharedBoardState = null;
    sharedDraggedUnitId = null;
    selectedSharedUnitId = null;
    renderSharedBoardState(null);
    sharedBoardSpectatorNoticeShown = false;
    return;
  }

  const roomToLeave = sharedBoardRoom;
  sharedBoardRoom = null;
  currentSharedBoardState = null;
  sharedDraggedUnitId = null;
  selectedSharedUnitId = null;
  sharedBoardSpectatorNoticeShown = false;
  renderSharedBoardState(null);

  if (typeof roomToLeave.removeAllListeners === "function") {
    roomToLeave.removeAllListeners();
  }

  if (typeof roomToLeave.leave === "function") {
    void roomToLeave.leave();
  }
}

/**
 * 共有ボードルーム取得
 * @returns {object|null} 共有ボードルーム
 */
export function getSharedBoardRoom() {
  return sharedBoardRoom;
}

/**
 * 共有ボード状態取得
 * @returns {object|null} 共有ボード状態
 */
export function getSharedBoardState() {
  return currentSharedBoardState;
}

/**
 * 選択中の共有ユニットID取得
 * @returns {string|null} 選択中ユニットID
 */
export function getSelectedSharedUnitId() {
  return selectedSharedUnitId;
}

/**
 * 共有ボード状態をレンダリング
 * @param {object|null} state 共有ボード状態
 */
function renderSharedBoardState(state) {
  if (!state) {
    sharedDraggedUnitId = null;
    selectedSharedUnitId = null;
    renderSharedBoard({ boardWidth: 6, boardHeight: 4, cells: {}, cursors: {}, players: {} });

    if (domRefs.cursorListElement) {
      domRefs.cursorListElement.textContent = "Shared board disconnected";
    }

    return;
  }

  renderSharedBoard(state);
  renderSharedCursorList(state);

  if (!sharedBoardRoom) {
    return;
  }

  const ownCursor = mapGet(state?.cursors, sharedBoardRoom.sessionId);
  const isSpectator = ownCursor?.isSpectator === true;

  if (isSpectator && !sharedBoardSpectatorNoticeShown) {
    deps.onLog("Shared board is spectator mode. Wait for an active slot.", "info");
    sharedBoardSpectatorNoticeShown = true;
    return;
  }

  if (!isSpectator) {
    sharedBoardSpectatorNoticeShown = false;
  }
}

/**
 * 共有ボードDOMを構築
 * @param {object} state 共有ボード状態
 */
function renderSharedBoard(state) {
  if (!domRefs.gridElement) {
    return;
  }

  domRefs.gridElement.innerHTML = "";

  const { boardWidth = 6, boardHeight = 4, cells = {} } = state;

  for (let i = 0; i < boardWidth * boardHeight; i += 1) {
    const cell = mapGet(cells, String(i));
    const unitId = cell?.unitId ?? "";
    const ownerId = cell?.ownerId ?? "";

    const cellElement = document.createElement("div");
    cellElement.className = "shared-board-cell";
    cellElement.dataset.cellIndex = String(i);
    cellElement.dataset.raidRegion = i < boardWidth * 2 ? "boss-top" : "raid-bottom";
    cellElement.classList.add(i < boardWidth * 2 ? "zone-boss" : "zone-raid");
    cellElement.ondragover = (event) => {
      handleSharedDragOver(event, state, cellElement, i);
    };
    cellElement.ondragleave = () => {
      clearSharedDropIndicators(cellElement);
    };
    cellElement.ondrop = (event) => {
      event.preventDefault();
      if (!isValidSharedDropTarget(state, i)) {
        deps.showMessage("Invalid shared board drop target", "error");
        clearSharedDropIndicators(cellElement);
        return;
      }

      handleSharedDrop(event, i);
      clearSharedDropIndicators(cellElement);
    };

    if (unitId && unitId !== "dummy-boss") {
      if (sharedBoardRoom && ownerId === sharedBoardRoom.sessionId) {
        cellElement.draggable = true;
        cellElement.classList.add("draggable");
        cellElement.onpointerdown = () => {
          selectSharedUnit(unitId, false);
        };
        cellElement.ondragstart = (event) => {
          handleSharedDragStart(event, state, i);
        };
        cellElement.ondragend = () => {
          handleSharedDragEnd();
        };
      }

      const unit = document.createElement("div");
      unit.className = "shared-board-unit";

      const ownerDot = document.createElement("span");
      ownerDot.className = "shared-board-owner";
      ownerDot.style.backgroundColor = getSharedPlayerColor(state, ownerId);

      const unitIdLabel = document.createElement("span");
      unitIdLabel.className = "shared-board-unit-id";
      unitIdLabel.textContent = shortPlayerId(unitId);

      unit.append(ownerDot, unitIdLabel);
      cellElement.appendChild(unit);
    } else {
      cellElement.classList.add("empty");
    }

    renderSharedCursorChips(state, cellElement, i);
    domRefs.gridElement.appendChild(cellElement);
  }
}

/**
 * カーソルチップを表示
 * @param {object} state 共有ボード状態
 * @param {HTMLElement} cellElement セル要素
 * @param {number} cellIndex セルインデックス
 */
function renderSharedCursorChips(state, cellElement, cellIndex) {
  if (!state?.cursors) {
    return;
  }

  for (const [playerId, cursor] of Object.entries(state.cursors)) {
    if (cursor?.cellIndex !== cellIndex) {
      continue;
    }

    const chip = document.createElement("div");
    chip.className = "cursor-chip";
    chip.style.backgroundColor = cursor.color ?? "#999999";
    const suffix = sharedBoardRoom && sharedBoardRoom.sessionId === playerId ? " (you)" : "";
    chip.title = `${shortPlayerId(playerId)}${suffix}`;
    cellElement.appendChild(chip);
  }
}

/**
 * カーソル一覧を更新
 * @param {object} state 共有ボード状態
 */
function renderSharedCursorList(state) {
  if (!domRefs.cursorListElement) {
    return;
  }

  if (!state?.cursors) {
    domRefs.cursorListElement.textContent = "No cursors";
    return;
  }

  const entries = mapEntries(state.cursors);
  if (entries.length === 0) {
    domRefs.cursorListElement.textContent = "No cursors";
    return;
  }

  domRefs.cursorListElement.innerHTML = "";

  for (const [playerId, cursor] of entries) {
    const item = document.createElement("span");
    item.className = "cursor-list-item";
    item.style.color = cursor?.color ?? "#999999";
    const suffix = sharedBoardRoom && sharedBoardRoom.sessionId === playerId ? " (you)" : "";
    item.textContent = `${shortPlayerId(playerId)}${suffix}`;
    domRefs.cursorListElement.appendChild(item);
  }
}

/**
 * プレイヤーの色を取得
 * @param {object} state 共有ボード状態
 * @param {string} playerId プレイヤーID
 * @returns {string} 色
 */
function getSharedPlayerColor(state, playerId) {
  const player = mapGet(state?.players, playerId);
  return player?.color ?? "#999999";
}

/**
 * 視聴者モード判定
 * @param {object} state 共有ボード状態
 * @returns {boolean} 視聴者モードかどうか
 */
function isSharedSpectator(state) {
  if (!sharedBoardRoom || !state?.players) {
    return true;
  }
  const player = mapGet(state.players, sharedBoardRoom.sessionId);
  return player?.isSpectator !== false;
}

/**
 * カーソル移動を送信
 * @param {number} cellIndex セルインデックス
 */
export function sendSharedCursorMove(cellIndex) {
  if (!sharedBoardRoom) {
    return;
  }

  sharedBoardRoom.send("shared_cursor_move", { cellIndex });
}

/**
 * ユニット選択を送信
 * @param {string} unitId ユニットID
 */
export function sendSharedSelectUnit(unitId) {
  if (!sharedBoardRoom) {
    return;
  }

  sharedBoardRoom.send("shared_select_unit", { unitId });
}

/**
 * ドラッグ状態を送信
 * @param {boolean} isDragging ドラッグ中かどうか
 * @param {string|null} [unitId] ユニットID
 */
export function sendSharedDragState(isDragging, unitId = null) {
  if (!sharedBoardRoom) {
    return;
  }

  sharedBoardRoom.send("shared_drag_state", {
    isDragging,
    unitId: unitId ?? undefined,
  });
}

/**
 * ユニット配置を送信
 * @param {string} unitId ユニットID
 * @param {number} toCell 配置先セル
 */
export function sendSharedPlaceUnit(unitId, toCell) {
  if (!sharedBoardRoom) {
    return;
  }

  sharedBoardRoom.send("shared_place_unit", { unitId, toCell });
}

/**
 * 共有ユニットを選択
 * @param {string} unitId ユニットID
 * @param {boolean} [shouldNotify=true] 通知するかどうか
 */
function selectSharedUnit(unitId, shouldNotify = true) {
  if (!sharedBoardRoom) {
    return;
  }

  selectedSharedUnitId = unitId;

  if (shouldNotify) {
    sendSharedSelectUnit(unitId);
  }
}

/**
 * ドラッグ開始ハンドラ
 * @param {DragEvent} event ドラッグイベント
 * @param {object} state 共有ボード状態
 * @param {number} cellIndex セルインデックス
 */
function handleSharedDragStart(event, state, cellIndex) {
  if (!sharedBoardRoom) {
    return;
  }

  const cell = mapGet(state?.cells, String(cellIndex));
  if (!cell || cell.ownerId !== sharedBoardRoom.sessionId || !cell.unitId) {
    event.preventDefault();
    return;
  }

  sharedDraggedUnitId = cell.unitId;
  sendSharedDragState(true, cell.unitId);

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cell.unitId);
  }
}

/**
 * ドラッグ終了ハンドラ
 */
function handleSharedDragEnd() {
  sharedDraggedUnitId = null;
  sendSharedDragState(false, null);
}

function isValidSharedDropTarget(state, cellIndex) {
  if (!sharedBoardRoom || !sharedDraggedUnitId) {
    return false;
  }

  const cell = mapGet(state?.cells, String(cellIndex));
  if (!cell) {
    return false;
  }

  if (!cell.unitId) {
    return true;
  }

  if (cell.unitId === "dummy-boss") {
    return false;
  }

  return cell.ownerId === sharedBoardRoom.sessionId;
}

function clearSharedDropIndicators(cellElement) {
  cellElement.classList.remove("drag-over");
  delete cellElement.dataset.dropValid;
  delete cellElement.dataset.dropInvalid;
}

function handleSharedDragOver(event, state, cellElement, cellIndex) {
  if (!sharedDraggedUnitId) {
    return;
  }

  event.preventDefault();
  const isValid = isValidSharedDropTarget(state, cellIndex);
  cellElement.classList.add("drag-over");

  if (isValid) {
    cellElement.dataset.dropValid = "true";
    delete cellElement.dataset.dropInvalid;
    return;
  }

  cellElement.dataset.dropInvalid = "true";
  delete cellElement.dataset.dropValid;
}

/**
 * ドロップハンドラ
 * @param {DragEvent} event ドロップイベント
 * @param {number} cellIndex セルインデックス
 */
export function handleSharedDrop(event, cellIndex) {
  if (!sharedBoardRoom || !sharedDraggedUnitId) {
    return;
  }

  event.preventDefault();

  sendSharedPlaceUnit(sharedDraggedUnitId, cellIndex);
  sharedDraggedUnitId = null;
  sendSharedDragState(false, null);
}

/**
 * セルクリックハンドラ
 * @param {object} state 共有ボード状態
 * @param {number} cellIndex セルインデックス
 */
export function handleSharedCellClick(state, cellIndex) {
  if (!sharedBoardRoom || !currentSharedBoardState) {
    return;
  }

  const cell = mapGet(state?.cells, String(cellIndex));

  // 自分のユニットがある場合は選択
  if (cell?.ownerId === sharedBoardRoom.sessionId && cell.unitId && cell.unitId !== "dummy-boss") {
    selectSharedUnit(cell.unitId, true);
    return;
  }

  // 選択中のユニットがある場合は配置
  if (selectedSharedUnitId) {
    // ターゲットが空か、自分のユニットがある場合のみ配置
    if (!cell?.unitId || cell.ownerId === sharedBoardRoom.sessionId) {
      sendSharedPlaceUnit(selectedSharedUnitId, cellIndex);
      selectedSharedUnitId = null;
    } else {
      deps.showMessage("Cell is occupied by another player", "error");
    }
  }
}
