import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

import { DEFAULT_SHARED_BOARD_CONFIG } from "../../shared/shared-board-config";

export class SharedBoardCellState extends Schema {
  declare public index: number;
  declare public unitId: string;
  declare public ownerId: string;
  declare public displayName: string;
  declare public portraitKey: string;
  declare public unitLevel: number;
  declare public lockedBy: string;
  declare public lockUntilMs: number;
  // 紋章マス用拡張スロット（将来実装予約）
  // emblemType?: 'attack' | 'defense' | 'speed';

  public constructor() {
    super();
    this.index = 0;
    this.unitId = "";
    this.ownerId = "";
    this.displayName = "";
    this.portraitKey = "";
    this.unitLevel = 1;
    this.lockedBy = "";
    this.lockUntilMs = 0;
  }
}

export class SharedBoardCursorState extends Schema {
  declare public playerId: string;
  declare public color: string;
  declare public cellIndex: number;
  declare public isDragging: boolean;
  declare public selectedUnitId: string;
  declare public isSpectator: boolean;
  declare public updatedAtMs: number;

  public constructor() {
    super();
    this.playerId = "";
    this.color = "";
    this.cellIndex = -1;
    this.isDragging = false;
    this.selectedUnitId = "";
    this.isSpectator = false;
    this.updatedAtMs = 0;
  }
}

export class SharedBoardPlayerState extends Schema {
  declare public playerId: string;
  declare public connected: boolean;
  declare public isSpectator: boolean;
  declare public color: string;
  declare public slotIndex: number;

  public constructor() {
    super();
    this.playerId = "";
    this.connected = true;
    this.isSpectator = true;
    this.color = "#999999";
    this.slotIndex = -1;
  }
}

export class SharedBoardState extends Schema {
  declare public mode: string;
  declare public phase: string;
  declare public phaseDeadlineAtMs: number;
  declare public battleId: string;
  declare public boardWidth: number;
  declare public boardHeight: number;
  declare public dummyBossCell: number;
  declare public players: MapSchema<SharedBoardPlayerState>;
  declare public cursors: MapSchema<SharedBoardCursorState>;
  declare public cells: MapSchema<SharedBoardCellState>;
  declare public eventLog: ArraySchema<string>;

  public constructor() {
    super();
    this.mode = "prep";
    this.phase = "Sandbox";
    this.phaseDeadlineAtMs = 0;
    this.battleId = "";
    this.boardWidth = DEFAULT_SHARED_BOARD_CONFIG.width;
    this.boardHeight = DEFAULT_SHARED_BOARD_CONFIG.height;
    this.dummyBossCell = 2;
    this.players = new MapSchema<SharedBoardPlayerState>();
    this.cursors = new MapSchema<SharedBoardCursorState>();
    this.cells = new MapSchema<SharedBoardCellState>();
    this.eventLog = new ArraySchema<string>();
  }
}

defineTypes(SharedBoardCellState, {
  index: "number",
  unitId: "string",
  ownerId: "string",
  displayName: "string",
  portraitKey: "string",
  unitLevel: "number",
  lockedBy: "string",
  lockUntilMs: "number",
});

defineTypes(SharedBoardCursorState, {
  playerId: "string",
  color: "string",
  cellIndex: "number",
  isDragging: "boolean",
  selectedUnitId: "string",
  isSpectator: "boolean",
  updatedAtMs: "number",
});

defineTypes(SharedBoardPlayerState, {
  playerId: "string",
  connected: "boolean",
  isSpectator: "boolean",
  color: "string",
  slotIndex: "number",
});

defineTypes(SharedBoardState, {
  mode: "string",
  phase: "string",
  phaseDeadlineAtMs: "number",
  battleId: "string",
  boardWidth: "number",
  boardHeight: "number",
  dummyBossCell: "number",
  players: {
    map: SharedBoardPlayerState,
    default: new MapSchema<SharedBoardPlayerState>(),
  },
  cursors: {
    map: SharedBoardCursorState,
    default: new MapSchema<SharedBoardCursorState>(),
  },
  cells: {
    map: SharedBoardCellState,
    default: new MapSchema<SharedBoardCellState>(),
  },
  eventLog: ["string"],
});
