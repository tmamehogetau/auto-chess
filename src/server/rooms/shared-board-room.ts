import { CloseCode, type Client, Room } from "colyseus";

import {
  SharedBoardCellState,
  SharedBoardCursorState,
  SharedBoardPlayerState,
  SharedBoardState,
} from "../schema/shared-board-state";

interface SharedBoardRoomOptions {
  boardWidth?: number;
  boardHeight?: number;
  lockDurationMs?: number;
}

interface CursorMoveMessage {
  cellIndex: number;
}

interface SelectUnitMessage {
  unitId: string;
}

interface DragStateMessage {
  isDragging: boolean;
  unitId?: string;
}

interface PlaceUnitMessage {
  unitId: string;
  toCell: number;
}

type SharedBoardRejectCode =
  | "INVALID_PAYLOAD"
  | "NOT_ACTIVE_PLAYER"
  | "UNIT_NOT_OWNED"
  | "TARGET_LOCKED"
  | "TARGET_OCCUPIED";

type ActionResultMessage =
  | {
      accepted: true;
      action: string;
    }
  | {
      accepted: false;
      action: string;
      code: SharedBoardRejectCode;
    };

interface SharedBoardRoleMessage {
  isSpectator: boolean;
  slotIndex: number;
  color: string;
}

const CLIENT_MESSAGE_TYPES = {
  CURSOR_MOVE: "shared_cursor_move",
  SELECT_UNIT: "shared_select_unit",
  DRAG_STATE: "shared_drag_state",
  PLACE_UNIT: "shared_place_unit",
  RESET: "shared_reset",
} as const;

const SERVER_MESSAGE_TYPES = {
  ROLE: "shared_role",
  ACTION_RESULT: "shared_action_result",
} as const;

export class SharedBoardRoom extends Room<{ state: SharedBoardState }> {
  private static readonly MAX_ACTIVE_PLAYERS = 3;

  private static readonly MAX_CLIENTS = 8;

  private static readonly RECONNECT_WINDOW_SECONDS = 30;

  private static readonly DEFAULT_LOCK_DURATION_MS = 1000;

  private static readonly ACTIVE_PLAYER_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D"];

  private static readonly SPECTATOR_COLOR = "#999999";

  private boardWidth = 6;

  private boardHeight = 4;

  private lockDurationMs = SharedBoardRoom.DEFAULT_LOCK_DURATION_MS;

  private readonly activePlayerIds: string[] = [];

  private readonly unitIdByPlayer = new Map<string, string>();

  public onCreate(options: SharedBoardRoomOptions = {}): void {
    this.maxClients = SharedBoardRoom.MAX_CLIENTS;

    this.boardWidth = options.boardWidth ?? this.boardWidth;
    this.boardHeight = options.boardHeight ?? this.boardHeight;
    this.lockDurationMs = options.lockDurationMs ?? this.lockDurationMs;

    this.state = new SharedBoardState();
    this.state.boardWidth = this.boardWidth;
    this.state.boardHeight = this.boardHeight;
    this.state.dummyBossCell = Math.min(2, this.boardWidth * this.boardHeight - 1);

    this.initializeBoardCells();

    this.onMessage<CursorMoveMessage>(CLIENT_MESSAGE_TYPES.CURSOR_MOVE, (client, payload) => {
      this.handleCursorMove(client, payload);
    });

    this.onMessage<SelectUnitMessage>(CLIENT_MESSAGE_TYPES.SELECT_UNIT, (client, payload) => {
      this.handleSelectUnit(client, payload);
    });

    this.onMessage<DragStateMessage>(CLIENT_MESSAGE_TYPES.DRAG_STATE, (client, payload) => {
      this.handleDragState(client, payload);
    });

    this.onMessage<PlaceUnitMessage>(CLIENT_MESSAGE_TYPES.PLACE_UNIT, (client, payload) => {
      this.handlePlaceUnit(client, payload);
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.RESET, (client) => {
      this.handleReset(client);
    });

    this.clock.setInterval(() => {
      this.cleanupExpiredLocks(Date.now());
    }, 100);
  }

  public onJoin(client: Client): void {
    const sessionId = client.sessionId;
    const slotIndex = this.findNextActiveSlot();
    const isSpectator = slotIndex < 0;
    const color = isSpectator
      ? SharedBoardRoom.SPECTATOR_COLOR
      : this.getActiveColorBySlot(slotIndex);

    const player = new SharedBoardPlayerState();
    player.playerId = sessionId;
    player.connected = true;
    player.isSpectator = isSpectator;
    player.color = color;
    player.slotIndex = slotIndex;
    this.state.players.set(sessionId, player);

    const cursor = new SharedBoardCursorState();
    cursor.playerId = sessionId;
    cursor.color = color;
    cursor.cellIndex = -1;
    cursor.isDragging = false;
    cursor.selectedUnitId = "";
    cursor.isSpectator = isSpectator;
    cursor.updatedAtMs = Date.now();
    this.state.cursors.set(sessionId, cursor);

    const roleMessage: SharedBoardRoleMessage = {
      isSpectator,
      slotIndex,
      color,
    };
    client.send(SERVER_MESSAGE_TYPES.ROLE, roleMessage);

    if (!isSpectator) {
      this.activePlayerIds.push(sessionId);
      this.placeInitialTokenForPlayer(sessionId, slotIndex);
    }

    this.appendEvent(`${sessionId.slice(0, 8)} joined (${isSpectator ? "spectator" : `slot ${slotIndex}`})`);
  }

  public async onLeave(client: Client, code: number): Promise<void> {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    player.connected = false;
    this.clearPlayerLocks(client.sessionId);

    const shouldRemoveImmediately =
      code === CloseCode.CONSENTED ||
      code === CloseCode.NORMAL_CLOSURE ||
      code === CloseCode.GOING_AWAY;

    if (shouldRemoveImmediately) {
      this.removePlayerCompletely(client.sessionId);
      return;
    }

    try {
      await this.allowReconnection(client, SharedBoardRoom.RECONNECT_WINDOW_SECONDS);
      player.connected = true;
      this.appendEvent(`${client.sessionId.slice(0, 8)} reconnected`);
    } catch {
      this.removePlayerCompletely(client.sessionId);
    }
  }

  public onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    player.connected = true;

    this.clock.setTimeout(() => {
      const latestPlayer = this.state.players.get(client.sessionId);

      if (!latestPlayer) {
        return;
      }

      const roleMessage: SharedBoardRoleMessage = {
        isSpectator: latestPlayer.isSpectator,
        slotIndex: latestPlayer.slotIndex,
        color: latestPlayer.color,
      };

      client.send(SERVER_MESSAGE_TYPES.ROLE, roleMessage);
    }, 0);

    const cursor = this.state.cursors.get(client.sessionId);
    if (cursor) {
      cursor.updatedAtMs = Date.now();
    }
  }

  private initializeBoardCells(): void {
    for (const key of this.state.cells.keys()) {
      this.state.cells.delete(key);
    }

    const totalCells = this.boardWidth * this.boardHeight;

    for (let index = 0; index < totalCells; index += 1) {
      const cell = new SharedBoardCellState();
      cell.index = index;
      cell.unitId = "";
      cell.ownerId = "";
      cell.lockedBy = "";
      cell.lockUntilMs = 0;
      this.state.cells.set(String(index), cell);
    }

    const bossCell = this.state.cells.get(String(this.state.dummyBossCell));

    if (bossCell) {
      bossCell.unitId = "dummy-boss";
      bossCell.ownerId = "boss";
    }
  }

  private handleCursorMove(client: Client, payload: CursorMoveMessage): void {
    if (!payload || !Number.isInteger(payload.cellIndex)) {
      return;
    }

    const cursor = this.state.cursors.get(client.sessionId);

    if (!cursor) {
      return;
    }

    if (!this.isValidCellIndex(payload.cellIndex) && payload.cellIndex !== -1) {
      return;
    }

    cursor.cellIndex = payload.cellIndex;
    cursor.updatedAtMs = Date.now();
  }

  private handleSelectUnit(client: Client, payload: SelectUnitMessage): void {
    if (!this.ensureActivePlayer(client, "select_unit")) {
      return;
    }

    if (!payload || typeof payload.unitId !== "string" || payload.unitId.length === 0) {
      this.sendActionResult(client, "select_unit", false, "INVALID_PAYLOAD");
      return;
    }

    if (!this.ownsUnit(client.sessionId, payload.unitId)) {
      this.sendActionResult(client, "select_unit", false, "UNIT_NOT_OWNED");
      return;
    }

    const cursor = this.state.cursors.get(client.sessionId);

    if (!cursor) {
      this.sendActionResult(client, "select_unit", false, "INVALID_PAYLOAD");
      return;
    }

    cursor.selectedUnitId = payload.unitId;
    cursor.isDragging = false;
    cursor.updatedAtMs = Date.now();

    this.sendActionResult(client, "select_unit", true);
  }

  private handleDragState(client: Client, payload: DragStateMessage): void {
    if (!this.ensureActivePlayer(client, "drag_state")) {
      return;
    }

    if (!payload || typeof payload.isDragging !== "boolean") {
      this.sendActionResult(client, "drag_state", false, "INVALID_PAYLOAD");
      return;
    }

    const cursor = this.state.cursors.get(client.sessionId);

    if (!cursor) {
      this.sendActionResult(client, "drag_state", false, "INVALID_PAYLOAD");
      return;
    }

    if (payload.unitId !== undefined) {
      if (typeof payload.unitId !== "string" || payload.unitId.length === 0) {
        this.sendActionResult(client, "drag_state", false, "INVALID_PAYLOAD");
        return;
      }

      if (!this.ownsUnit(client.sessionId, payload.unitId)) {
        this.sendActionResult(client, "drag_state", false, "UNIT_NOT_OWNED");
        return;
      }

      cursor.selectedUnitId = payload.unitId;
    }

    cursor.isDragging = payload.isDragging;
    cursor.updatedAtMs = Date.now();

    this.sendActionResult(client, "drag_state", true);
  }

  private handlePlaceUnit(client: Client, payload: PlaceUnitMessage): void {
    if (!this.ensureActivePlayer(client, "place_unit")) {
      return;
    }

    if (
      !payload ||
      typeof payload.unitId !== "string" ||
      payload.unitId.length === 0 ||
      !Number.isInteger(payload.toCell)
    ) {
      this.sendActionResult(client, "place_unit", false, "INVALID_PAYLOAD");
      return;
    }

    if (!this.ownsUnit(client.sessionId, payload.unitId)) {
      this.sendActionResult(client, "place_unit", false, "UNIT_NOT_OWNED");
      return;
    }

    if (!this.isValidCellIndex(payload.toCell) || payload.toCell === this.state.dummyBossCell) {
      this.sendActionResult(client, "place_unit", false, "TARGET_OCCUPIED");
      return;
    }

    const targetCell = this.state.cells.get(String(payload.toCell));

    if (!targetCell) {
      this.sendActionResult(client, "place_unit", false, "INVALID_PAYLOAD");
      return;
    }

    const nowMs = Date.now();

    if (
      targetCell.lockedBy !== "" &&
      targetCell.lockedBy !== client.sessionId &&
      targetCell.lockUntilMs > nowMs
    ) {
      this.sendActionResult(client, "place_unit", false, "TARGET_LOCKED");
      return;
    }

    const sourceCellIndex = this.findCellIndexByUnitId(payload.unitId);

    if (sourceCellIndex < 0) {
      this.sendActionResult(client, "place_unit", false, "INVALID_PAYLOAD");
      return;
    }

    if (
      sourceCellIndex !== payload.toCell &&
      targetCell.unitId !== ""
    ) {
      this.sendActionResult(client, "place_unit", false, "TARGET_OCCUPIED");
      return;
    }

    targetCell.lockedBy = client.sessionId;
    targetCell.lockUntilMs = nowMs + this.lockDurationMs;

    if (sourceCellIndex !== payload.toCell) {
      const sourceCell = this.state.cells.get(String(sourceCellIndex));

      if (!sourceCell) {
        this.sendActionResult(client, "place_unit", false, "INVALID_PAYLOAD");
        return;
      }

      targetCell.unitId = sourceCell.unitId;
      targetCell.ownerId = sourceCell.ownerId;
      sourceCell.unitId = "";
      sourceCell.ownerId = "";
    }

    const cursor = this.state.cursors.get(client.sessionId);

    if (cursor) {
      cursor.selectedUnitId = payload.unitId;
      cursor.cellIndex = payload.toCell;
      cursor.isDragging = false;
      cursor.updatedAtMs = nowMs;
    }

    this.sendActionResult(client, "place_unit", true);
  }

  private handleReset(client: Client): void {
    if (!this.ensureActivePlayer(client, "reset")) {
      return;
    }

    this.resetBoardTokens();

    for (const cursor of this.state.cursors.values()) {
      cursor.selectedUnitId = "";
      cursor.isDragging = false;
      cursor.updatedAtMs = Date.now();
    }

    this.sendActionResult(client, "reset", true);
    this.appendEvent(`${client.sessionId.slice(0, 8)} reset board`);
  }

  private ensureActivePlayer(client: Client, action: string): boolean {
    const player = this.state.players.get(client.sessionId);

    if (!player || player.isSpectator) {
      this.sendActionResult(client, action, false, "NOT_ACTIVE_PLAYER");
      return false;
    }

    return true;
  }

  private sendActionResult(
    client: Client,
    action: string,
    accepted: boolean,
    code?: SharedBoardRejectCode,
  ): void {
    const payload: ActionResultMessage = accepted
      ? {
          accepted: true,
          action,
        }
      : {
          accepted: false,
          action,
          code: code ?? "INVALID_PAYLOAD",
        };

    client.send(SERVER_MESSAGE_TYPES.ACTION_RESULT, payload);
  }

  private cleanupExpiredLocks(nowMs: number): void {
    for (const cell of this.state.cells.values()) {
      if (cell.lockedBy !== "" && cell.lockUntilMs <= nowMs) {
        cell.lockedBy = "";
        cell.lockUntilMs = 0;
      }
    }
  }

  private clearPlayerLocks(playerId: string): void {
    for (const cell of this.state.cells.values()) {
      if (cell.lockedBy === playerId) {
        cell.lockedBy = "";
        cell.lockUntilMs = 0;
      }
    }
  }

  private removePlayerCompletely(playerId: string): void {
    const activeIndex = this.activePlayerIds.indexOf(playerId);
    if (activeIndex >= 0) {
      this.activePlayerIds.splice(activeIndex, 1);
    }

    this.clearPlayerLocks(playerId);
    this.state.players.delete(playerId);
    this.state.cursors.delete(playerId);

    this.unitIdByPlayer.delete(playerId);

    for (const cell of this.state.cells.values()) {
      if (cell.ownerId === playerId) {
        cell.unitId = "";
        cell.ownerId = "";
      }
    }

    this.appendEvent(`${playerId.slice(0, 8)} removed`);
  }

  private resetBoardTokens(): void {
    for (const cell of this.state.cells.values()) {
      if (cell.index !== this.state.dummyBossCell) {
        cell.unitId = "";
        cell.ownerId = "";
      }
      cell.lockedBy = "";
      cell.lockUntilMs = 0;
    }

    for (const playerId of this.activePlayerIds) {
      const player = this.state.players.get(playerId);

      if (!player || player.isSpectator || player.slotIndex < 0) {
        continue;
      }

      this.placeInitialTokenForPlayer(playerId, player.slotIndex);
    }
  }

  private placeInitialTokenForPlayer(playerId: string, slotIndex: number): void {
    const unitId = this.unitIdByPlayer.get(playerId) ?? `unit-${playerId.slice(0, 6)}`;
    this.unitIdByPlayer.set(playerId, unitId);

    const preferredCell = (this.boardHeight - 1) * this.boardWidth + slotIndex;
    const targetCell = this.findFirstAvailableCell(preferredCell);

    if (targetCell === null) {
      return;
    }

    const cell = this.state.cells.get(String(targetCell));

    if (!cell) {
      return;
    }

    cell.unitId = unitId;
    cell.ownerId = playerId;
  }

  private findFirstAvailableCell(preferredCell: number): number | null {
    const cellCount = this.boardWidth * this.boardHeight;

    if (this.isCellEmpty(preferredCell)) {
      return preferredCell;
    }

    for (let index = 0; index < cellCount; index += 1) {
      if (this.isCellEmpty(index)) {
        return index;
      }
    }

    return null;
  }

  private isCellEmpty(cellIndex: number): boolean {
    if (!this.isValidCellIndex(cellIndex) || cellIndex === this.state.dummyBossCell) {
      return false;
    }

    const cell = this.state.cells.get(String(cellIndex));

    if (!cell) {
      return false;
    }

    return cell.unitId === "";
  }

  private isValidCellIndex(cellIndex: number): boolean {
    return cellIndex >= 0 && cellIndex < this.boardWidth * this.boardHeight;
  }

  private ownsUnit(playerId: string, unitId: string): boolean {
    for (const cell of this.state.cells.values()) {
      if (cell.ownerId === playerId && cell.unitId === unitId) {
        return true;
      }
    }

    return false;
  }

  private findCellIndexByUnitId(unitId: string): number {
    for (const [key, cell] of this.state.cells.entries()) {
      if (cell.unitId === unitId) {
        return Number.parseInt(key, 10);
      }
    }

    return -1;
  }

  private findNextActiveSlot(): number {
    if (this.activePlayerIds.length >= SharedBoardRoom.MAX_ACTIVE_PLAYERS) {
      return -1;
    }

    const usedSlots = new Set<number>();

    for (const playerId of this.activePlayerIds) {
      const player = this.state.players.get(playerId);

      if (player && !player.isSpectator && player.slotIndex >= 0) {
        usedSlots.add(player.slotIndex);
      }
    }

    for (let slot = 0; slot < SharedBoardRoom.MAX_ACTIVE_PLAYERS; slot += 1) {
      if (!usedSlots.has(slot)) {
        return slot;
      }
    }

    return -1;
  }

  private getActiveColorBySlot(slotIndex: number): string {
    return SharedBoardRoom.ACTIVE_PLAYER_COLORS[slotIndex] ?? SharedBoardRoom.SPECTATOR_COLOR;
  }

  private appendEvent(message: string): void {
    const timestamp = new Date().toISOString();
    this.state.eventLog.push(`[${timestamp}] ${message}`);

    while (this.state.eventLog.length > 50) {
      this.state.eventLog.shift();
    }
  }
}
