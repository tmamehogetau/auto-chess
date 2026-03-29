/**
 * Shared Board Client モジュール
 * 共有ボードルームの接続・状態管理・UI操作
 */

import { mapEntries, mapGet, shortPlayerId } from "./utils/pure-utils.js";
import { resolveFrontPortraitUrl } from "./portrait-resolver.js";

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
 * @property {string} sharedBoardRoomId 共有ボード room id
 * @property {(message: string, type: string) => void} onLog ログ追加関数
 * @property {(message: string, type: string) => void} showMessage メッセージ表示関数
 * @property {() => boolean} isTouhouRosterEnabled 東方ロスター有効判定
 * @property {() => ("boss"|"raid")} [getPlayerPlacementSide] 現在の配置サイド
 * @property {(client: object, roomName: string, options?: object) => Promise<object>} joinOrCreate ルーム接続関数
 */

const DEFAULT_SHARED_BOARD_ROOM_NAME = "shared_board";
const SHARED_BOARD_BATTLE_REPLAY_MESSAGE = "shared_battle_replay";
const SHARED_BOARD_REQUEST_ROLE_MESSAGE = "shared_request_role";
let currentSharedBoardRoomId = "";

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
  sharedBoardRoomId: "",
  onLog: () => {},
  showMessage: () => {},
  isTouhouRosterEnabled: () => false,
  getPlayerPlacementSide: () => "raid",
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

/** @type {{ battleId: string, boardWidth: number, boardHeight: number, lastAttackMarkerAtMs: number | null, units: Map<string, { battleUnitId: string, side: string, x: number, y: number, currentHp: number, maxHp: number, alive: boolean, state: string, attackTargetBattleUnitId: string | null, targetedByBattleUnitId: string | null, impactAmount: number | null }> } | null} */
let currentSharedBattleReplay = null;

/** @type {ReturnType<typeof setTimeout>[]} */
let sharedBattleReplayTimeoutIds = [];

/** @type {Map<string, { battleUnitId: string, side: string, displayName: string, currentHp: number, maxHp: number, fromX: number, fromY: number, toX: number, toY: number }>} */
let sharedBattleMovementGhosts = new Map();

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

export function setSharedBoardRoomId(sharedBoardRoomId) {
  if (typeof sharedBoardRoomId === "string") {
    currentSharedBoardRoomId = sharedBoardRoomId.trim();
    return;
  }

  currentSharedBoardRoomId = "";
}

/**
 * 共有ボードルームに接続
 * @param {object} client Colyseus Client
 * @returns {Promise<void>}
 */
export async function connectSharedBoard(client, options = {}) {
  const requestedRoomId = typeof options?.roomId === "string" && options.roomId.trim().length > 0
    ? options.roomId.trim()
    : currentSharedBoardRoomId.length > 0
      ? currentSharedBoardRoomId
      : DEFAULT_SHARED_BOARD_ROOM_NAME;

  if (!client) {
    return;
  }

  if (
    sharedBoardRoom
    && (sharedBoardRoom.roomId === requestedRoomId || sharedBoardRoom.roomName === requestedRoomId)
  ) {
    return;
  }

  if (sharedBoardRoom) {
    leaveSharedBoardRoom();
  }

  try {
    const sharedBoardJoinOptions = {};
    if (deps.gamePlayerId) {
      sharedBoardJoinOptions.gamePlayerId = deps.gamePlayerId;
    }
    if (options?.spectator === true) {
      sharedBoardJoinOptions.spectator = true;
    }
    const normalizedJoinOptions = Object.keys(sharedBoardJoinOptions).length > 0
      ? sharedBoardJoinOptions
      : undefined;

    const existingRoom = options?.existingRoom ?? null;
    if (existingRoom) {
      sharedBoardRoom = existingRoom;
    } else if (requestedRoomId !== DEFAULT_SHARED_BOARD_ROOM_NAME && typeof client.joinById === "function") {
      sharedBoardRoom = await client.joinById(requestedRoomId, normalizedJoinOptions);
    } else {
      sharedBoardRoom = await client.joinOrCreate(
        DEFAULT_SHARED_BOARD_ROOM_NAME,
        normalizedJoinOptions,
      );
    }
    currentSharedBoardState = null;
    sharedBoardSpectatorNoticeShown = false;
    sharedDraggedUnitId = null;
    selectedSharedUnitId = null;
    clearSharedBattleReplay();

    bindSharedBoardRoomListeners(sharedBoardRoom);
    if (typeof sharedBoardRoom.send === "function") {
      sharedBoardRoom.send(SHARED_BOARD_REQUEST_ROLE_MESSAGE);
    }
  } catch (error) {
    currentSharedBoardState = null;
    renderSharedBoardState(null);
    const message = error instanceof Error ? error.message : String(error);
    deps.onLog(`Shared board unavailable: ${message}`, "info");
  }
}

function bindSharedBoardRoomListeners(room) {
  room.onMessage("shared_role", (message) => {
      if (message?.isSpectator === true && !sharedBoardSpectatorNoticeShown) {
        deps.onLog("Shared board role: spectator", "info");
      }
    });

    room.onMessage("shared_action_result", (message) => {
      if (message?.accepted === true && message.action === "place_unit") {
        selectedSharedUnitId = null;
        renderSharedBoardState(currentSharedBoardState);
        deps.showMessage("Shared board move applied. Keep covering open space before you press Ready.", "success");
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

    room.onStateChange((state) => {
      currentSharedBoardState = state;
      if (state?.mode === "battle") {
        sharedDraggedUnitId = null;
        selectedSharedUnitId = null;
      } else if (currentSharedBattleReplay) {
        clearSharedBattleReplay();
      }
      renderSharedBoardState(state);
    });

    room.onMessage(SHARED_BOARD_BATTLE_REPLAY_MESSAGE, (message) => {
      startSharedBattleReplay(message);
    });

    room.onLeave(() => {
      sharedBoardRoom = null;
      currentSharedBoardState = null;
      sharedDraggedUnitId = null;
      selectedSharedUnitId = null;
      clearSharedBattleReplay();
      renderSharedBoardState(null);
    });
}

/**
 * 共有ボードルームから切断
 */
export function leaveSharedBoardRoom() {
  if (!sharedBoardRoom) {
    currentSharedBoardRoomId = "";
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
  currentSharedBoardRoomId = "";
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
    if (isLegacyEmbeddedBoard(state)) {
      domRefs.placementGuideElement.textContent = "Buy a unit into your Bench, then place it onto one of the center 4x2 combat cells. Boss uses the upper row, raid uses the lower row.";
      return;
    }

    const placementSide = resolveOwnPlacementSide(null);
    domRefs.placementGuideElement.textContent = placementSide === "boss"
      ? "Buy a unit into your Bench, then place it anywhere in the upper boss half. Boss units stay on the board and can be repositioned there."
      : "Buy a unit into your Bench, then place it anywhere in the lower raid half. Hero units stay on the board and can be repositioned there.";
    return;
  }

  if (selectedSharedUnitId || sharedDraggedUnitId) {
    if (isLegacyEmbeddedBoard(state)) {
      domRefs.placementGuideElement.textContent = "Blue cells inside the center 4x2 combat area are open for your selected unit. Red cells are blocked or outside that area.";
      return;
    }

    const placementSide = resolveOwnPlacementSide(selectedSharedUnitId || sharedDraggedUnitId);
    domRefs.placementGuideElement.textContent = placementSide === "boss"
      ? "Blue cells in the upper boss half are open for your selected unit. Red cells are occupied or outside the boss deployment half."
      : "Blue cells in the lower raid half are open for your selected unit. Red cells are occupied or outside the raid deployment half.";
    return;
  }

  if (isLegacyEmbeddedBoard(state)) {
    domRefs.placementGuideElement.textContent = "Select or drag one of your units. The center 4x2 combat area keeps boss on top and raid on bottom.";
    return;
  }

  const placementSide = resolveOwnPlacementSide(null);
  domRefs.placementGuideElement.textContent = placementSide === "boss"
    ? "Select or drag one of your units. Boss units can reposition anywhere in the upper half of the board."
    : "Select or drag one of your units. Raid units can reposition anywhere in the lower half of the board.";
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
    cellElement.dataset.legacyInnerAreaZone = legacyEmbeddedBoard ? resolveLegacyInnerAreaZone(state, i) : deploymentZone;
    cellElement.setAttribute("role", "button");
    cellElement.setAttribute("aria-label", buildSharedBoardCellAriaLabel(i, cell, state));
    cellElement.classList.add(deploymentZone === "boss" ? "zone-boss" : "zone-raid");
    if (legacyEmbeddedBoard) {
      const legacyInnerAreaZone = resolveLegacyInnerAreaZone(state, i);
      if (legacyInnerAreaZone === "outside") {
        cellElement.classList.add("outside-combat-area");
      } else {
        cellElement.classList.add("active-combat-area");
        cellElement.classList.add(legacyInnerAreaZone === "boss" ? "active-boss-area" : "active-raid-area");
      }
    } else {
      cellElement.classList.add(deploymentZone === "boss" ? "deployment-boss" : "deployment-raid");
      cellElement.classList.add("active-combat-area");
      cellElement.classList.add(deploymentZone === "boss" ? "active-boss-area" : "active-raid-area");
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
        portrait.src = resolveFrontPortraitUrl(cell.portraitKey, "meiling");
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
        if (cell?.battleState === "casting") {
          unit.classList.add("shared-board-battle-casting");
        }
        if (
          Number.isFinite(cell?.battleAttackLungeX)
          || Number.isFinite(cell?.battleAttackLungeY)
        ) {
          unit.classList.add("shared-board-battle-lunging");
          unit.style["--shared-board-attack-lunge-x"] = `${cell.battleAttackLungeX ?? 0}px`;
          unit.style["--shared-board-attack-lunge-y"] = `${cell.battleAttackLungeY ?? 0}px`;
        }
        if (cell?.battleState === "moving") {
          unit.classList.add("shared-board-battle-moving");
        }
        if (cell?.battleState === "dead") {
          unit.classList.add("shared-board-battle-dead");
        }
        if (cell?.battleGhostHidden === true) {
          unit.classList.add("shared-board-battle-moving-anchor");
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

        if (cell?.battleState === "casting") {
          const castFocus = document.createElement("span");
          castFocus.className = "shared-board-battle-cast-focus";
          unit.appendChild(castFocus);
        }

        if (Number.isFinite(cell?.battleAttackDirectionAngleDeg) && cell?.battleAttackPresentation === "melee") {
          const attackDirection = document.createElement("span");
          attackDirection.className = "shared-board-battle-attack-direction";
          attackDirection.style["--shared-board-attack-angle"] = `${cell.battleAttackDirectionAngleDeg}deg`;
          attackDirection.style["--shared-board-attack-length"] = `${cell.battleAttackDirectionLengthPx ?? 18}px`;
          unit.appendChild(attackDirection);
        }

        if (Number.isFinite(cell?.battleAttackDirectionAngleDeg) && cell?.battleAttackPresentation === "ranged") {
          const tracer = document.createElement("span");
          tracer.className = "shared-board-battle-projectile-tracer";
          tracer.style["--shared-board-attack-angle"] = `${cell.battleAttackDirectionAngleDeg}deg`;
          tracer.style["--shared-board-attack-length"] = `${cell.battleAttackDirectionLengthPx ?? 18}px`;
          unit.appendChild(tracer);
        }

        const battleStateTagCopy = resolveSharedBattleStateTagCopy(cell);
        if (battleStateTagCopy) {
          const stateTag = document.createElement("span");
          stateTag.className = "shared-board-battle-state-tag";
          stateTag.textContent = battleStateTagCopy;
          unit.appendChild(stateTag);
        }

        const impactTagCopy = resolveSharedBattleImpactTagCopy(cell);
        if (impactTagCopy) {
          const impactBurst = document.createElement("span");
          impactBurst.className = "shared-board-battle-hit-burst";
          unit.appendChild(impactBurst);

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

  renderSharedBattleMovementGhostOverlay(state);
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

  if (!isPlayableSharedBoardCell(state, cellIndex, activeUnitId)) {
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

function isPlayableSharedBoardCell(state, cellIndex, activeUnitId = null) {
  if (!Number.isInteger(cellIndex)) {
    return false;
  }

  if (isLegacyEmbeddedBoard(state)) {
    return sharedBoardIndexToInnerAreaIndex(state, cellIndex) !== null;
  }

  const placementSide = resolveOwnPlacementSide(activeUnitId);
  return placementSide === "boss"
    ? isBossDeploymentCell(state, cellIndex)
    : isRaidDeploymentCell(state, cellIndex);
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

function isRaidDeploymentCell(state, cellIndex) {
  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const boardHeight = Number.isInteger(state?.boardHeight) ? state.boardHeight : 6;
  const maxIndex = boardWidth * boardHeight - 1;

  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > maxIndex) {
    return false;
  }

  return Math.floor(cellIndex / boardWidth) >= Math.floor(boardHeight / 2);
}

function isBossDeploymentCell(state, cellIndex) {
  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const boardHeight = Number.isInteger(state?.boardHeight) ? state.boardHeight : 6;
  const maxIndex = boardWidth * boardHeight - 1;

  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > maxIndex) {
    return false;
  }

  return Math.floor(cellIndex / boardWidth) < Math.floor(boardHeight / 2);
}

function isHeroSharedUnitId(unitId) {
  return typeof unitId === "string" && unitId.startsWith("hero:");
}

function isBossSharedUnitId(unitId) {
  return typeof unitId === "string" && unitId.startsWith("boss:");
}

function resolveLegacyInnerAreaZone(state, cellIndex) {
  const innerAreaIndex = sharedBoardIndexToInnerAreaIndex(state, cellIndex);

  if (innerAreaIndex === null) {
    return "outside";
  }

  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const innerAreaWidth = boardWidth - 2;
  return innerAreaIndex < innerAreaWidth ? "boss" : "raid";
}

function sharedBoardIndexToInnerAreaIndex(state, boardIndex) {
  const boardWidth = Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
  const boardHeight = Number.isInteger(state?.boardHeight) ? state.boardHeight : 4;
  const maxIndex = boardWidth * boardHeight - 1;

  if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex > maxIndex) {
    return null;
  }

  const x = boardIndex % boardWidth;
  const y = Math.floor(boardIndex / boardWidth);
  const innerAreaX = x - 1;
  const innerAreaY = y - 1;
  const innerAreaWidth = boardWidth - 2;
  const innerAreaHeight = boardHeight - 2;

  if (
    innerAreaX < 0 ||
    innerAreaY < 0 ||
    innerAreaX >= innerAreaWidth ||
    innerAreaY >= innerAreaHeight
  ) {
    return null;
  }

  return innerAreaY * innerAreaWidth + innerAreaX;
}

function buildSharedDropRejectMessage(state, cellIndex) {
  const activeUnitId = sharedDraggedUnitId || selectedSharedUnitId;
  const placementSide = resolveOwnPlacementSide(activeUnitId);

  if (!isPlayableSharedBoardCell(state, cellIndex, activeUnitId)) {
    return isLegacyEmbeddedBoard(state)
      ? "That cell is outside the center combat area. Pick one of the center cells."
      : placementSide === "boss"
        ? "That cell is outside the upper boss deployment half. Pick an open cell there."
        : "That cell is outside the lower raid deployment half. Pick an open cell there.";
  }

  const cell = mapGet(state?.cells, String(cellIndex));
  if (cell?.unitId && cell.ownerId !== getOwnSharedBoardOwnerId()) {
    return "That cell is occupied by another player. Pick an open cell.";
  }

  return isLegacyEmbeddedBoard(state)
    ? "That cell is blocked. Pick an open cell."
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

  const zoneCopy = isLegacyEmbeddedBoard(state)
    ? (() => {
        const legacyInnerAreaZone = resolveLegacyInnerAreaZone(state, cellIndex);
        return legacyInnerAreaZone === "outside"
          ? "outside the center combat area"
          : legacyInnerAreaZone === "boss"
            ? "upper combat row"
            : "lower combat row";
      })()
    : resolveDeploymentZone(state, cellIndex) === "boss"
      ? "boss deployment zone"
      : "raid deployment zone";
  const unitName = typeof cell?.displayName === "string" && cell.displayName.length > 0
    ? cell.displayName
    : typeof cell?.unitId === "string" && cell.unitId.length > 0
      ? shortPlayerId(cell.unitId)
      : null;

  if (unitName) {
    return `Board cell ${cellIndex}, ${zoneCopy}, contains ${unitName}`;
  }

  return `Board cell ${cellIndex}, ${zoneCopy}`;
}

function isSharedBoardBattleMode(state) {
  return state?.mode === "battle";
}

function resolveOwnPlacementSide(activeUnitId = null) {
  if (isHeroSharedUnitId(activeUnitId)) {
    return "raid";
  }

  if (isBossSharedUnitId(activeUnitId)) {
    return "boss";
  }

  return deps.getPlayerPlacementSide?.() === "boss" ? "boss" : "raid";
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
    const attackDirection = resolveSharedBattleAttackDirection(unit);
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
      battleGhostHidden: sharedBattleMovementGhosts.has(unit.battleUnitId),
      battleAttackDirectionAngleDeg: attackDirection?.angleDeg ?? null,
      battleAttackDirectionLengthPx: attackDirection?.lengthPx ?? null,
      battleAttackPresentation: attackDirection?.presentation ?? null,
      battleAttackLungeX: attackDirection?.lungeX ?? null,
      battleAttackLungeY: attackDirection?.lungeY ?? null,
    };
  }

  return cells;
}

function resolveBattleReplayLabel(battleUnitId) {
  const unitType = resolveBattleReplayArchetype(battleUnitId);
  return unitType ?? shortPlayerId(battleUnitId);
}

function resolveBattleReplayArchetype(battleUnitId) {
  const tokens = typeof battleUnitId === "string" ? battleUnitId.split("-") : [];
  return tokens.find((token) => ["vanguard", "ranger", "mage", "assassin"].includes(token)) ?? null;
}

function clearSharedBattleReplay() {
  for (const timeoutId of sharedBattleReplayTimeoutIds) {
    clearTimeout(timeoutId);
  }

  sharedBattleReplayTimeoutIds = [];
  currentSharedBattleReplay = null;
  sharedBattleMovementGhosts = new Map();
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
  if (cell?.battleState === "dead") {
    return "Defeated";
  }

  if (cell?.battleState === "moving") {
    return "Moving";
  }

  if (cell?.battleState === "attacking") {
    return "Attacking";
  }

  if (cell?.battleState === "casting") {
    return "Casting";
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

function resolveSharedBattleAttackDirection(unit) {
  if (
    unit?.state !== "attacking"
    || typeof unit?.attackTargetBattleUnitId !== "string"
    || unit.attackTargetBattleUnitId.length === 0
    || !currentSharedBattleReplay
  ) {
    return null;
  }

  const targetUnit = currentSharedBattleReplay.units.get(unit.attackTargetBattleUnitId);
  if (!targetUnit || targetUnit.alive !== true) {
    return null;
  }

  const deltaX = targetUnit.x - unit.x;
  const deltaY = targetUnit.y - unit.y;
  if (deltaX === 0 && deltaY === 0) {
    return null;
  }

  const archetype = resolveBattleReplayArchetype(unit.battleUnitId);
  const isRanged = archetype === "ranger" || archetype === "mage";
  const attackLengthPx = 14 + Math.max(Math.abs(deltaX), Math.abs(deltaY)) * 6;

  return {
    presentation: isRanged ? "ranged" : "melee",
    angleDeg: Math.round((Math.atan2(deltaY, deltaX) * 180) / Math.PI),
    lengthPx: Math.max(18, Math.min(isRanged ? 36 : 30, attackLengthPx)),
    lungeX: isRanged ? null : (deltaX === 0 ? 0 : Math.sign(deltaX) * 10),
    lungeY: isRanged ? null : (deltaY === 0 ? 0 : Math.sign(deltaY) * 10),
  };
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
    clearSharedBattleMovementGhost(event.sourceBattleUnitId);
    clearSharedBattleMovementGhost(event.targetBattleUnitId);

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

  if (event.type === "castStart") {
    clearSharedBattleReplayAttackMarkers();
    clearSharedBattleMovementGhost(event.sourceBattleUnitId);
    clearSharedBattleMovementGhost(event.targetBattleUnitId);

    const sourceUnit = currentSharedBattleReplay.units.get(event.sourceBattleUnitId);
    if (sourceUnit) {
      sourceUnit.state = "casting";
      sourceUnit.attackTargetBattleUnitId = event.targetBattleUnitId ?? null;
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
    if (!unit || !event.to) {
      return;
    }

    const fromX = Number.isInteger(event.from?.x) ? event.from.x : unit.x;
    const fromY = Number.isInteger(event.from?.y) ? event.from.y : unit.y;
    const toX = event.to.x;
    const toY = event.to.y;

    sharedBattleMovementGhosts.set(event.battleUnitId, {
      battleUnitId: unit.battleUnitId,
      side: unit.side,
      displayName: resolveBattleReplayLabel(unit.battleUnitId),
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      fromX,
      fromY,
      toX,
      toY,
    });
    unit.x = toX;
    unit.y = toY;
    unit.state = "moving";
    scheduleSharedBattleMoveSettle(currentSharedBattleReplay.battleId, unit.battleUnitId, unit.x, unit.y);
    return;
  }

  if (event.type === "damageApplied") {
    clearSharedBattleReplayAttackMarkers(event.atMs);
    clearSharedBattleMovementGhost(event.sourceBattleUnitId);
    clearSharedBattleMovementGhost(event.targetBattleUnitId);
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
    clearSharedBattleMovementGhost(event.battleUnitId);
    const unit = currentSharedBattleReplay.units.get(event.battleUnitId);
    if (!unit) {
      return;
    }

    unit.state = "dead";
    unit.currentHp = 0;
    scheduleSharedBattleDeathRemoval(currentSharedBattleReplay.battleId, unit.battleUnitId);
    return;
  }

  if (event.type === "keyframe") {
    clearSharedBattleReplayAttackMarkers(event.atMs);
    clearSharedBattleMovementGhost();
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
    clearSharedBattleMovementGhost();
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
    if (unit.state === "attacking" || unit.state === "casting") {
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

    clearSharedBattleMovementGhost(battleUnitId);
    unit.state = "idle";
    renderSharedBoardState(currentSharedBoardState);
  }, 220);

  sharedBattleReplayTimeoutIds.push(timeoutId);
}

function scheduleSharedBattleDeathRemoval(battleId, battleUnitId) {
  const timeoutId = setTimeout(() => {
    if (!currentSharedBattleReplay || currentSharedBattleReplay.battleId !== battleId) {
      return;
    }

    const unit = currentSharedBattleReplay.units.get(battleUnitId);
    if (!unit || unit.state !== "dead") {
      return;
    }

    unit.alive = false;
    renderSharedBoardState(currentSharedBoardState);
  }, 220);

  sharedBattleReplayTimeoutIds.push(timeoutId);
}

function clearSharedBattleMovementGhost(battleUnitId = null) {
  if (typeof battleUnitId === "string") {
    sharedBattleMovementGhosts.delete(battleUnitId);
    return;
  }

  sharedBattleMovementGhosts.clear();
}

function renderSharedBattleMovementGhostOverlay(state) {
  if (
    !domRefs.gridElement
    || !isSharedBoardBattleMode(state)
    || sharedBattleMovementGhosts.size === 0
  ) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "shared-board-battle-overlay";
  overlay.style.gridTemplateColumns = `repeat(${resolveSharedBattleBoardWidth(state)}, minmax(0, 1fr))`;

  for (const ghost of sharedBattleMovementGhosts.values()) {
    const ghostElement = document.createElement("div");
    ghostElement.className = "shared-board-battle-ghost";
    ghostElement.style.gridColumn = String(ghost.toX + 1);
    ghostElement.style.gridRow = String(ghost.toY + 1);
    ghostElement.style["--shared-board-ghost-from-x"] = resolveSharedBattleGhostOffset(ghost.fromX - ghost.toX);
    ghostElement.style["--shared-board-ghost-from-y"] = resolveSharedBattleGhostOffset(ghost.fromY - ghost.toY);
    ghostElement.appendChild(buildSharedBattleMovementGhostUnit(state, ghost));
    overlay.appendChild(ghostElement);
  }

  domRefs.gridElement.appendChild(overlay);
}

function resolveSharedBattleBoardWidth(state) {
  if (Number.isInteger(currentSharedBattleReplay?.boardWidth)) {
    return currentSharedBattleReplay.boardWidth;
  }

  return Number.isInteger(state?.boardWidth) ? state.boardWidth : 6;
}

function resolveSharedBattleGhostOffset(delta) {
  return `calc(${delta} * (100% + var(--shared-board-gap, 8px)))`;
}

function buildSharedBattleMovementGhostUnit(state, ghost) {
  const unit = document.createElement("div");
  unit.className = "shared-board-unit shared-board-battle-unit shared-board-battle-moving shared-board-battle-ghost-unit";
  unit.classList.add(ghost.side === "boss" ? "shared-board-battle-boss" : "shared-board-battle-raid");

  const ownerDot = document.createElement("span");
  ownerDot.className = "shared-board-owner";
  ownerDot.style.backgroundColor = getSharedPlayerColor(state, ghost.side);

  const unitIdLabel = document.createElement("span");
  unitIdLabel.className = "shared-board-unit-id";
  unitIdLabel.textContent = ghost.displayName;

  const hpCopy = document.createElement("span");
  hpCopy.className = "shared-board-battle-hp-copy";
  hpCopy.textContent = `${ghost.currentHp} / ${ghost.maxHp}`;

  const hpBar = document.createElement("div");
  hpBar.className = "shared-board-battle-hp-bar";

  const hpFill = document.createElement("div");
  hpFill.className = "shared-board-battle-hp-bar-fill";
  hpFill.style.width = `${resolveSharedBattleHpPercent(ghost)}%`;
  hpBar.appendChild(hpFill);

  const stateTag = document.createElement("span");
  stateTag.className = "shared-board-battle-state-tag";
  stateTag.textContent = "Moving";

  unit.append(ownerDot, unitIdLabel, hpCopy, hpBar, stateTag);
  return unit;
}
