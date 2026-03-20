/**
 * Shared Board Client モジュール
 * 共有ボードルームの接続・状態管理・UI操作
 */

import { mapEntries, mapGet, shortPlayerId } from "./utils/pure-utils.js";

/**
 * @typedef {Object} SharedBoardDOMRefs
 * @property {HTMLElement|null} gridElement 共有ボードグリッド
 * @property {HTMLElement|null} cursorListElement カーソル一覧
 * @property {HTMLElement|null} placementGuideElement 配置ガイド文言
 */

/**
 * @typedef {Object} SharedBoardDependencies
 * @property {object|null} client Colyseus Client
 * @property {string} gamePlayerId ゲームプレイヤーID
 * @property {(message: string, type: string) => void} onLog ログ追加関数
 * @property {(message: string, type: string) => void} showMessage メッセージ表示関数
 * @property {() => boolean} isTouhouRosterEnabled 東方ロスター有効判定
 * @property {(client: object, roomName: string, options?: object) => Promise<object>} joinOrCreate ルーム接続関数
 */

const DEFAULT_SHARED_BOARD_ROOM_NAME = "shared_board";

/** @type {SharedBoardDOMRefs} */
let domRefs = {
  gridElement: null,
  cursorListElement: null,
  placementGuideElement: null,
};

/** @type {SharedBoardDependencies} */
let deps = {
  client: null,
  gamePlayerId: "",
  onLog: () => {},
  showMessage: () => {},
  isTouhouRosterEnabled: () => false,
  joinOrCreate: async () => null,
};

// These keys must stay aligned with deployed `/pics/{Key}.png` assets.
const PORTRAIT_URL_BY_KEY = {
  Cirno: "/pics/Cirno.png",
  Flandre: "/pics/Flandre.png",
  Hong: "/pics/Hong.png",
  Koishi: "/pics/Koishi.png",
  Marisa: "/pics/Marisa.png",
  Patchouli: "/pics/Patchouli.png",
  Reimu: "/pics/Reimu.png",
  Remilia: "/pics/Remilia.png",
  Rumia: "/pics/Rumia.png",
  Sakuya: "/pics/Sakuya.png",
  Satori: "/pics/Satori.png",
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

export function setSharedBoardGamePlayerId(gamePlayerId) {
  deps = {
    ...deps,
    gamePlayerId: typeof gamePlayerId === "string" ? gamePlayerId : "",
  };
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
        deps.showMessage("Shared board move applied. Keep covering open lanes before you press Ready.", "success");
      }

      if (message?.accepted === false) {
        deps.onLog(
          `[Shared board] ${message.action ?? "action"} rejected: ${message.code ?? "UNKNOWN"}`,
          "info",
        );
        deps.showMessage(
          `Shared board ${message.action ?? "action"} rejected: ${message.code ?? "UNKNOWN"}. Try an open cell.`,
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
    updateSharedBoardPlacementGuide(null);

    if (domRefs.cursorListElement) {
      domRefs.cursorListElement.textContent = "Shared board disconnected";
    }

    return;
  }

  renderSharedBoard(state);
  renderSharedCursorList(state);
  updateSharedBoardPlacementGuide(state);

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

function updateSharedBoardPlacementGuide(state) {
  if (!domRefs.placementGuideElement) {
    return;
  }

  if (!state || !sharedBoardRoom) {
    domRefs.placementGuideElement.textContent = "Connect first. Buy units into your Bench, then place them onto the shared board.";
    return;
  }

  if (isSharedSpectator(state)) {
    domRefs.placementGuideElement.textContent = "Spectator slot: watch the raid board and wait for an active slot before placing units.";
    return;
  }

  const hasOwnUnits = mapEntries(state?.cells).some(([, cell]) => (
    cell?.ownerId === getOwnSharedBoardOwnerId()
      && cell.unitId
      && cell.unitId !== "dummy-boss"
  ));

  if (!hasOwnUnits) {
    domRefs.placementGuideElement.textContent = "Buy a unit into your Bench, then click an open shared-board cell to deploy it. Once placed, select it here to reposition it.";
    return;
  }

  if (selectedSharedUnitId || sharedDraggedUnitId) {
    domRefs.placementGuideElement.textContent = "Blue cells are open for your selected unit. Red cells are blocked by another player or a locked boss cell.";
    return;
  }

  domRefs.placementGuideElement.textContent = "Select or drag one of your units. Blue cells show open moves and red cells show blocked lanes.";
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
    const isOwnUnit = Boolean(sharedBoardRoom && ownerId === getOwnSharedBoardOwnerId());
    const isOccupiedByAnotherPlayer = Boolean(unitId && unitId !== "dummy-boss" && ownerId && !isOwnUnit);
    const canDropSelectedUnit = Boolean(
      selectedSharedUnitId && isValidSharedDropTarget(state, i),
    );
    const isBlockedDropTarget = Boolean(
      selectedSharedUnitId && !canDropSelectedUnit,
    );

    const cellElement = document.createElement("div");
    cellElement.className = "shared-board-cell";
    cellElement.tabIndex = 0;
    cellElement.dataset.cellIndex = String(i);
    cellElement.dataset.raidRegion = i < boardWidth * 2 ? "boss-top" : "raid-bottom";
    cellElement.setAttribute("role", "button");
    cellElement.setAttribute("aria-label", buildSharedBoardCellAriaLabel(i, cell));
    cellElement.classList.add(i < boardWidth * 2 ? "zone-boss" : "zone-raid");
    cellElement.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        cellElement.click();
      }
    };
    if (canDropSelectedUnit) {
      cellElement.classList.add("drop-target");
    } else if (isBlockedDropTarget) {
      cellElement.classList.add("blocked-target");
    }
    cellElement.ondragover = (event) => {
      handleSharedDragOver(event, state, cellElement, i);
    };
    cellElement.ondragleave = () => {
      clearSharedDropIndicators(cellElement);
    };
    cellElement.ondrop = (event) => {
      event.preventDefault();
      if (!isValidSharedDropTarget(state, i)) {
        deps.showMessage("That lane is blocked. Pick an open cell.", "error");
        clearSharedDropIndicators(cellElement);
        return;
      }

      handleSharedDrop(event, i);
      clearSharedDropIndicators(cellElement);
    };

    if (unitId && unitId !== "dummy-boss") {
      if (isOwnUnit) {
        cellElement.draggable = true;
        cellElement.classList.add("draggable");
        cellElement.classList.add("occupied-own");
        if (selectedSharedUnitId === unitId) {
          cellElement.classList.add("selected");
        }
        cellElement.onpointerdown = () => {
          selectSharedUnit(unitId, false);
        };
        cellElement.ondragstart = (event) => {
          handleSharedDragStart(event, state, i);
        };
        cellElement.ondragend = () => {
          handleSharedDragEnd();
        };
      } else if (isOccupiedByAnotherPlayer) {
        cellElement.classList.add("occupied-ally");
      }

      const unit = document.createElement("div");
      unit.className = "shared-board-unit";

      const ownerDot = document.createElement("span");
      ownerDot.className = "shared-board-owner";
      ownerDot.style.backgroundColor = getSharedPlayerColor(state, ownerId);

      if (shouldRenderTouhouPresentation(cell)) {
        const portrait = document.createElement("img");
        portrait.className = "shared-board-portrait";
        portrait.src = PORTRAIT_URL_BY_KEY[cell.portraitKey] ?? PORTRAIT_URL_BY_KEY.Hong;
        portrait.alt = cell.displayName;

        const displayName = document.createElement("span");
        displayName.className = "shared-board-display-name";
        displayName.textContent = cell.displayName;

        unit.append(ownerDot, portrait, displayName);
      } else {
        const unitIdLabel = document.createElement("span");
        unitIdLabel.className = "shared-board-unit-id";
        unitIdLabel.textContent = shortPlayerId(unitId);
        unit.append(ownerDot, unitIdLabel);
      }
      cellElement.appendChild(unit);
    } else {
      cellElement.classList.add("empty");
    }
    domRefs.gridElement.appendChild(cellElement);
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
    domRefs.cursorListElement.textContent = "Board presence: none";
    return;
  }

  const entries = mapEntries(state.cursors);
  if (entries.length === 0) {
    domRefs.cursorListElement.textContent = "Board presence: none";
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

function shouldRenderTouhouPresentation(cell) {
  return Boolean(
    deps.isTouhouRosterEnabled()
      && typeof cell?.displayName === "string"
      && cell.displayName.length > 0
      && typeof cell?.portraitKey === "string"
      && cell.portraitKey.length > 0,
  );
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
  renderSharedBoardState(currentSharedBoardState);

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
  if (!cell || cell.ownerId !== getOwnSharedBoardOwnerId() || !cell.unitId) {
    event.preventDefault();
    return;
  }

  sharedDraggedUnitId = cell.unitId;
  selectedSharedUnitId = cell.unitId;
  renderSharedBoardState(currentSharedBoardState);
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
  const activeUnitId = sharedDraggedUnitId || selectedSharedUnitId;

  if (!sharedBoardRoom || !activeUnitId) {
    return false;
  }

  const cell = mapGet(state?.cells, String(cellIndex));
  if (!cell) {
    return true;
  }

  if (!cell.unitId) {
    return true;
  }

  if (cell.unitId === "dummy-boss") {
    return false;
  }

  return cell.ownerId === getOwnSharedBoardOwnerId();
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
  if (cell?.ownerId === getOwnSharedBoardOwnerId() && cell.unitId && cell.unitId !== "dummy-boss") {
    selectSharedUnit(cell.unitId, true);
    return;
  }

  // 選択中のユニットがある場合は配置
  if (selectedSharedUnitId) {
    // ターゲットが空か、自分のユニットがある場合のみ配置
    if (!cell?.unitId || cell.ownerId === getOwnSharedBoardOwnerId()) {
      sendSharedPlaceUnit(selectedSharedUnitId, cellIndex);
    } else {
      deps.showMessage("That lane is occupied by another player. Pick an open cell.", "error");
    }
  }
}

function getOwnSharedBoardOwnerId() {
  if (typeof deps.gamePlayerId === "string" && deps.gamePlayerId.length > 0) {
    return deps.gamePlayerId;
  }

  return sharedBoardRoom?.sessionId ?? "";
}

function buildSharedBoardCellAriaLabel(cellIndex, cell) {
  const unitName = typeof cell?.displayName === "string" && cell.displayName.length > 0
    ? cell.displayName
    : typeof cell?.unitId === "string" && cell.unitId.length > 0
      ? shortPlayerId(cell.unitId)
      : null;

  if (unitName) {
    return `Board cell ${cellIndex}, contains ${unitName}`;
  }

  return `Board cell ${cellIndex}`;
}
