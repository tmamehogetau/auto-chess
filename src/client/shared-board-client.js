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
const SHARED_BOARD_BATTLE_REPLAY_MESSAGE = "shared_battle_replay";

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

/** @type {{ battleId: string, boardWidth: number, boardHeight: number, lastAttackMarkerAtMs: number | null, units: Map<string, { battleUnitId: string, side: string, x: number, y: number, currentHp: number, maxHp: number, alive: boolean, state: string, attackTargetBattleUnitId: string | null, targetedByBattleUnitId: string | null, impactAmount: number | null }> } | null} */
let currentSharedBattleReplay = null;

/** @type {ReturnType<typeof setTimeout>[]} */
let sharedBattleReplayTimeoutIds = [];

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
    clearSharedBattleReplay();

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
      if (state?.mode === "battle") {
        sharedDraggedUnitId = null;
        selectedSharedUnitId = null;
      } else if (currentSharedBattleReplay) {
        clearSharedBattleReplay();
      }
      renderSharedBoardState(state);
    });

    sharedBoardRoom.onMessage(SHARED_BOARD_BATTLE_REPLAY_MESSAGE, (message) => {
      startSharedBattleReplay(message);
    });

    sharedBoardRoom.onLeave(() => {
      sharedBoardRoom = null;
      currentSharedBoardState = null;
      sharedDraggedUnitId = null;
      selectedSharedUnitId = null;
      clearSharedBattleReplay();
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
    clearSharedBattleReplay();
    renderSharedBoardState(null);
    sharedBoardSpectatorNoticeShown = false;
    return;
  }

  const roomToLeave = sharedBoardRoom;
  sharedBoardRoom = null;
  currentSharedBoardState = null;
  sharedDraggedUnitId = null;
  selectedSharedUnitId = null;
  clearSharedBattleReplay();
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
    renderSharedBoard({ boardWidth: 6, boardHeight: 6, cells: {}, cursors: {}, players: {} });
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

  if (isSharedBoardBattleMode(state)) {
    domRefs.placementGuideElement.textContent = "Watching live shared-board replay. Battle is read-only until the next Prep phase.";
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
    domRefs.placementGuideElement.textContent = isLegacyEmbeddedBoard(state)
      ? "Buy a unit into your Bench, then place it onto one of the center 4x2 cells. Boss covers the top lane, raid covers the bottom lane."
      : "Buy a unit into your Bench, then place it onto one of the highlighted raid cells. Boss deployment stays reserved for now.";
    return;
  }

  if (selectedSharedUnitId || sharedDraggedUnitId) {
    domRefs.placementGuideElement.textContent = isLegacyEmbeddedBoard(state)
      ? "Blue cells inside the center 4x2 are open for your selected unit. Red cells are blocked or outside the playable lane."
      : "Blue highlighted raid cells are open for your selected unit. Red cells are occupied or outside the active raid footprint.";
    return;
  }

  domRefs.placementGuideElement.textContent = isLegacyEmbeddedBoard(state)
    ? "Select or drag one of your units. The center 4x2 is the playable lane: boss on top, raid on bottom."
    : "Select or drag one of your units. Place it onto the highlighted raid cells in the lower half of the board.";
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

  const { boardWidth = 6, boardHeight = 6 } = state;
  const cells = resolveSharedBoardCellsForRender(state);
  const legacyEmbeddedBoard = isLegacyEmbeddedBoard(state);

  for (let i = 0; i < boardWidth * boardHeight; i += 1) {
    const cell = mapGet(cells, String(i));
    const deploymentZone = resolveDeploymentZone(state, i);
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
    cellElement.dataset.raidRegion = deploymentZone === "boss" ? "boss-top" : "raid-bottom";
    cellElement.dataset.playableLane = legacyEmbeddedBoard ? resolvePlayableLaneZone(state, i) : deploymentZone;
    cellElement.setAttribute("role", "button");
    cellElement.setAttribute("aria-label", buildSharedBoardCellAriaLabel(i, cell, state));
    cellElement.classList.add(deploymentZone === "boss" ? "zone-boss" : "zone-raid");
    if (legacyEmbeddedBoard) {
      const playableLaneZone = resolvePlayableLaneZone(state, i);
      if (playableLaneZone === "outside") {
        cellElement.classList.add("outside-playable");
      } else {
        cellElement.classList.add("playable-lane");
        cellElement.classList.add(playableLaneZone === "boss" ? "playable-boss-lane" : "playable-raid-lane");
      }
    } else {
      cellElement.classList.add(deploymentZone === "boss" ? "deployment-boss" : "deployment-raid");
      if (isActiveRaidCombatFootprintCell(state, i)) {
        cellElement.classList.add("playable-lane", "playable-raid-lane");
      } else {
        cellElement.classList.add("outside-playable");
      }
    }
    cellElement.onclick = () => {
      handleSharedCellClick(state, i);
    };
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
        deps.showMessage(buildSharedDropRejectMessage(state, i), "error");
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
        unitIdLabel.textContent = typeof cell?.displayName === "string" && cell.displayName.length > 0
          ? cell.displayName
          : shortPlayerId(unitId);
        unit.append(ownerDot, unitIdLabel);
      }

      if (isSharedBoardBattleMode(state) && Number.isFinite(Number(cell?.maxHp))) {
        unit.classList.add("shared-board-battle-unit");
        unit.classList.add(cell?.ownerId === "boss" ? "shared-board-battle-boss" : "shared-board-battle-raid");
        if (cell?.battleState === "attacking") {
          unit.classList.add("shared-board-battle-attacking");
        }
        if (cell?.battleState === "moving") {
          unit.classList.add("shared-board-battle-moving");
        }
        if (typeof cell?.battleTargetedByBattleUnitId === "string" && cell.battleTargetedByBattleUnitId.length > 0) {
          unit.classList.add("shared-board-battle-targeted");
        }
        if (Number.isFinite(Number(cell?.battleImpactAmount)) && Number(cell?.battleImpactAmount) > 0) {
          unit.classList.add("shared-board-battle-impacted");
        }

        const hpCopy = document.createElement("span");
        hpCopy.className = "shared-board-battle-hp-copy";
        const currentHp = Math.max(0, Math.round(Number(cell?.currentHp) || 0));
        const maxHp = Math.max(currentHp, Math.round(Number(cell?.maxHp) || 0));
        hpCopy.textContent = `${currentHp} / ${maxHp}`;

        const hpBar = document.createElement("div");
        hpBar.className = "shared-board-battle-hp-bar";

        const hpFill = document.createElement("div");
        hpFill.className = "shared-board-battle-hp-bar-fill";
        hpFill.style.width = `${resolveSharedBattleHpPercent(cell)}%`;

        hpBar.appendChild(hpFill);
        unit.append(hpCopy, hpBar);

        const battleStateTagCopy = resolveSharedBattleStateTagCopy(cell);
        if (battleStateTagCopy) {
          const stateTag = document.createElement("span");
          stateTag.className = "shared-board-battle-state-tag";
          stateTag.textContent = battleStateTagCopy;
          unit.appendChild(stateTag);
        }

        const impactTagCopy = resolveSharedBattleImpactTagCopy(cell);
        if (impactTagCopy) {
          const impactTag = document.createElement("span");
          impactTag.className = "shared-board-battle-impact-tag";
          impactTag.textContent = impactTagCopy;
          unit.appendChild(impactTag);
        }
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
  if (playerId === "boss") {
    return "#FF6B6B";
  }

  if (playerId === "raid") {
    return "#4ECDC4";
  }

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

  if (isSharedBoardBattleMode(state)) {
    return false;
  }

  if (!isPlayableSharedBoardCell(state, cellIndex)) {
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

function isPlayableSharedBoardCell(state, cellIndex) {
  if (!Number.isInteger(cellIndex)) {
    return false;
  }

  if (isLegacyEmbeddedBoard(state)) {
    return sharedBoardIndexToCombatCell(state, cellIndex) !== null;
  }

  return isActiveRaidCombatFootprintCell(state, cellIndex);
}

function resolveDeploymentZone(state, cellIndex) {
  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const boardHeight = Number.isInteger(state?.boardHeight) ? state.boardHeight : 6;
  const maxIndex = boardWidth * boardHeight - 1;

  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > maxIndex) {
    return "raid";
  }

  const row = Math.floor(cellIndex / boardWidth);
  return row < Math.floor(boardHeight / 2) ? "boss" : "raid";
}

function isLegacyEmbeddedBoard(state) {
  return Number.isInteger(state?.boardHeight) && state.boardHeight <= 4;
}

function isActiveRaidCombatFootprintCell(state, cellIndex) {
  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const boardHeight = Number.isInteger(state?.boardHeight) ? state.boardHeight : 6;
  const maxIndex = boardWidth * boardHeight - 1;

  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > maxIndex) {
    return false;
  }

  if (boardWidth !== 6 || boardHeight !== 6) {
    return false;
  }

  const x = cellIndex % boardWidth;
  const y = Math.floor(cellIndex / boardWidth);
  return x >= 1 && x <= 4 && y >= 3 && y <= 4;
}

function resolvePlayableLaneZone(state, cellIndex) {
  const combatCell = sharedBoardIndexToCombatCell(state, cellIndex);

  if (combatCell === null) {
    return "outside";
  }

  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const combatWidth = boardWidth - 2;
  return combatCell < combatWidth ? "boss" : "raid";
}

function sharedBoardIndexToCombatCell(state, boardIndex) {
  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const boardHeight = Number.isInteger(state?.boardHeight) ? state.boardHeight : 4;
  const maxIndex = boardWidth * boardHeight - 1;

  if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex > maxIndex) {
    return null;
  }

  const x = boardIndex % boardWidth;
  const y = Math.floor(boardIndex / boardWidth);
  const combatX = x - 1;
  const combatY = y - 1;
  const combatWidth = boardWidth - 2;
  const combatHeight = boardHeight - 2;

  if (
    combatX < 0 ||
    combatY < 0 ||
    combatX >= combatWidth ||
    combatY >= combatHeight
  ) {
    return null;
  }

  return combatY * combatWidth + combatX;
}

function buildSharedDropRejectMessage(state, cellIndex) {
  if (!isPlayableSharedBoardCell(state, cellIndex)) {
    return isLegacyEmbeddedBoard(state)
      ? "That lane is outside the playable combat area. Pick one of the center cells."
      : "That cell is outside the active raid combat footprint. Pick one of the highlighted raid cells.";
  }

  const cell = mapGet(state?.cells, String(cellIndex));
  if (cell?.unitId && cell.ownerId !== getOwnSharedBoardOwnerId()) {
    return "That lane is occupied by another player. Pick an open cell.";
  }

  return isLegacyEmbeddedBoard(state)
    ? "That lane is blocked. Pick an open cell."
    : "That deployment cell is blocked. Pick an open cell.";
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

  if (isSharedBoardBattleMode(state)) {
    deps.showMessage("Battle replay is read-only. Wait for the next Prep phase to move units.", "info");
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
    if (isValidSharedDropTarget(state, cellIndex)) {
      sendSharedPlaceUnit(selectedSharedUnitId, cellIndex);
      return;
    }

    deps.showMessage(buildSharedDropRejectMessage(state, cellIndex), "error");
  }
}

function getOwnSharedBoardOwnerId() {
  if (typeof deps.gamePlayerId === "string" && deps.gamePlayerId.length > 0) {
    return deps.gamePlayerId;
  }

  return sharedBoardRoom?.sessionId ?? "";
}

function buildSharedBoardCellAriaLabel(cellIndex, cell, state) {
  if (isSharedBoardBattleMode(state)) {
    const unitName = typeof cell?.displayName === "string" && cell.displayName.length > 0
      ? cell.displayName
      : typeof cell?.unitId === "string" && cell.unitId.length > 0
        ? shortPlayerId(cell.unitId)
        : null;

    return unitName
      ? `Board cell ${cellIndex}, live battle replay, contains ${unitName}`
      : `Board cell ${cellIndex}, live battle replay`;
  }

  const laneCopy = isLegacyEmbeddedBoard(state)
    ? (() => {
        const playableLaneZone = resolvePlayableLaneZone(state, cellIndex);
        return playableLaneZone === "outside"
          ? "outside the playable lane"
          : playableLaneZone === "boss"
            ? "boss playable lane"
            : "raid playable lane";
      })()
    : isActiveRaidCombatFootprintCell(state, cellIndex)
      ? "active raid combat footprint"
      : resolveDeploymentZone(state, cellIndex) === "boss"
        ? "boss deployment zone"
        : "raid staging zone";
  const unitName = typeof cell?.displayName === "string" && cell.displayName.length > 0
    ? cell.displayName
    : typeof cell?.unitId === "string" && cell.unitId.length > 0
      ? shortPlayerId(cell.unitId)
      : null;

  if (unitName) {
    return `Board cell ${cellIndex}, ${laneCopy}, contains ${unitName}`;
  }

  return `Board cell ${cellIndex}, ${laneCopy}`;
}

function isSharedBoardBattleMode(state) {
  return state?.mode === "battle";
}

function resolveSharedBoardCellsForRender(state) {
  if (!isSharedBoardBattleMode(state) || !currentSharedBattleReplay || currentSharedBattleReplay.battleId !== state?.battleId) {
    return state?.cells ?? {};
  }

  const cells = {};

  for (const unit of currentSharedBattleReplay.units.values()) {
    if (unit.alive !== true) {
      continue;
    }

    const cellIndex = unit.y * currentSharedBattleReplay.boardWidth + unit.x;
    cells[String(cellIndex)] = {
      index: cellIndex,
      unitId: `battle:${unit.battleUnitId}`,
      ownerId: unit.side,
      displayName: resolveBattleReplayLabel(unit.battleUnitId),
      portraitKey: "",
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      battleState: unit.state,
      battleTargetedByBattleUnitId: unit.targetedByBattleUnitId,
      battleImpactAmount: unit.impactAmount,
    };
  }

  return cells;
}

function resolveBattleReplayLabel(battleUnitId) {
  const tokens = typeof battleUnitId === "string" ? battleUnitId.split("-") : [];
  const unitType = tokens.find((token) => ["vanguard", "ranger", "mage", "assassin"].includes(token));
  return unitType ?? shortPlayerId(battleUnitId);
}

function clearSharedBattleReplay() {
  for (const timeoutId of sharedBattleReplayTimeoutIds) {
    clearTimeout(timeoutId);
  }

  sharedBattleReplayTimeoutIds = [];
  currentSharedBattleReplay = null;
}

function resolveSharedBattleHpPercent(cell) {
  const currentHp = Math.max(0, Number(cell?.currentHp) || 0);
  const maxHp = Math.max(currentHp, Number(cell?.maxHp) || 0);

  if (maxHp <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
}

function resolveSharedBattleStateTagCopy(cell) {
  if (cell?.battleState === "moving") {
    return "Moving";
  }

  if (cell?.battleState === "attacking") {
    return "Attacking";
  }

  if (typeof cell?.battleTargetedByBattleUnitId === "string" && cell.battleTargetedByBattleUnitId.length > 0) {
    return "Targeted";
  }

  return "";
}

function resolveSharedBattleImpactTagCopy(cell) {
  const amount = Number(cell?.battleImpactAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return `-${Math.round(amount)}`;
}

function startSharedBattleReplay(message) {
  const timeline = Array.isArray(message?.timeline) ? message.timeline : [];
  const battleStartEvent = timeline.find((event) => event?.type === "battleStart");

  if (!battleStartEvent || typeof message?.battleId !== "string") {
    clearSharedBattleReplay();
    renderSharedBoardState(currentSharedBoardState);
    return;
  }

  clearSharedBattleReplay();

  const units = new Map();
  for (const unit of battleStartEvent.units ?? []) {
    units.set(unit.battleUnitId, {
      battleUnitId: unit.battleUnitId,
      side: unit.side,
      x: unit.x,
      y: unit.y,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      alive: true,
      state: "idle",
      attackTargetBattleUnitId: null,
      targetedByBattleUnitId: null,
      impactAmount: null,
    });
  }

  currentSharedBattleReplay = {
    battleId: message.battleId,
    boardWidth: battleStartEvent.boardConfig?.width ?? 6,
    boardHeight: battleStartEvent.boardConfig?.height ?? 6,
    lastAttackMarkerAtMs: null,
    units,
  };

  renderSharedBoardState(currentSharedBoardState);

  for (const event of timeline) {
    if (!event || event.type === "battleStart") {
      continue;
    }

    const delayMs = Number.isInteger(event.atMs) ? event.atMs : 0;
    const timeoutId = setTimeout(() => {
      if (!currentSharedBattleReplay || currentSharedBattleReplay.battleId !== message.battleId) {
        return;
      }

      applySharedBattleReplayEvent(event);
      renderSharedBoardState(currentSharedBoardState);
    }, delayMs);

    sharedBattleReplayTimeoutIds.push(timeoutId);
  }
}

function applySharedBattleReplayEvent(event) {
  if (!currentSharedBattleReplay) {
    return;
  }

  if (event.type === "attackStart") {
    clearSharedBattleReplayAttackMarkers();

    const sourceUnit = currentSharedBattleReplay.units.get(event.sourceBattleUnitId);
    if (sourceUnit) {
      sourceUnit.state = "attacking";
      sourceUnit.attackTargetBattleUnitId = event.targetBattleUnitId;
    }

    const targetUnit = currentSharedBattleReplay.units.get(event.targetBattleUnitId);
    if (targetUnit) {
      targetUnit.targetedByBattleUnitId = event.sourceBattleUnitId;
    }
    currentSharedBattleReplay.lastAttackMarkerAtMs = Number.isInteger(event.atMs) ? event.atMs : null;
    return;
  }

  if (event.type === "move") {
    clearSharedBattleReplayAttackMarkers(event.atMs);
    const unit = currentSharedBattleReplay.units.get(event.battleUnitId);
    if (!unit) {
      return;
    }

    unit.x = event.to.x;
    unit.y = event.to.y;
    unit.state = "moving";
    scheduleSharedBattleMoveSettle(currentSharedBattleReplay.battleId, unit.battleUnitId, unit.x, unit.y);
    return;
  }

  if (event.type === "damageApplied") {
    clearSharedBattleReplayAttackMarkers(event.atMs);
    const unit = currentSharedBattleReplay.units.get(event.targetBattleUnitId);
    if (!unit) {
      return;
    }

    unit.currentHp = event.remainingHp;
    unit.impactAmount = event.amount;
    unit.state = unit.currentHp > 0 ? "idle" : "dead";
    scheduleSharedBattleImpactClear(currentSharedBattleReplay.battleId, unit.battleUnitId);
    return;
  }

  if (event.type === "unitDeath") {
    clearSharedBattleReplayAttackMarkers(event.atMs);
    const unit = currentSharedBattleReplay.units.get(event.battleUnitId);
    if (!unit) {
      return;
    }

    unit.alive = false;
    unit.state = "dead";
    return;
  }

  if (event.type === "keyframe") {
    clearSharedBattleReplayAttackMarkers(event.atMs);
    for (const keyframeUnit of event.units ?? []) {
      const existing = currentSharedBattleReplay.units.get(keyframeUnit.battleUnitId);
      if (!existing) {
        continue;
      }

      existing.x = keyframeUnit.x;
      existing.y = keyframeUnit.y;
      existing.currentHp = keyframeUnit.currentHp;
      existing.maxHp = keyframeUnit.maxHp;
      existing.alive = keyframeUnit.alive;
      existing.state = keyframeUnit.state;
    }
    return;
  }

  if (event.type === "battleEnd") {
    clearSharedBattleReplayAttackMarkers(event.atMs);
  }
}

function clearSharedBattleReplayAttackMarkers(nextEventAtMs = null) {
  if (!currentSharedBattleReplay) {
    return;
  }

  if (
    currentSharedBattleReplay.lastAttackMarkerAtMs !== null &&
    Number.isInteger(nextEventAtMs) &&
    nextEventAtMs <= currentSharedBattleReplay.lastAttackMarkerAtMs
  ) {
    return;
  }

  for (const unit of currentSharedBattleReplay.units.values()) {
    unit.attackTargetBattleUnitId = null;
    unit.targetedByBattleUnitId = null;
    if (unit.state === "attacking") {
      unit.state = "idle";
    }
  }

  currentSharedBattleReplay.lastAttackMarkerAtMs = null;
}

function scheduleSharedBattleImpactClear(battleId, battleUnitId) {
  const timeoutId = setTimeout(() => {
    if (!currentSharedBattleReplay || currentSharedBattleReplay.battleId !== battleId) {
      return;
    }

    const unit = currentSharedBattleReplay.units.get(battleUnitId);
    if (!unit || unit.impactAmount === null) {
      return;
    }

    unit.impactAmount = null;
    renderSharedBoardState(currentSharedBoardState);
  }, 320);

  sharedBattleReplayTimeoutIds.push(timeoutId);
}

function scheduleSharedBattleMoveSettle(battleId, battleUnitId, x, y) {
  const timeoutId = setTimeout(() => {
    if (!currentSharedBattleReplay || currentSharedBattleReplay.battleId !== battleId) {
      return;
    }

    const unit = currentSharedBattleReplay.units.get(battleUnitId);
    if (!unit || unit.state !== "moving") {
      return;
    }

    if (unit.x !== x || unit.y !== y) {
      return;
    }

    unit.state = "idle";
    renderSharedBoardState(currentSharedBoardState);
  }, 220);

  sharedBattleReplayTimeoutIds.push(timeoutId);
}
