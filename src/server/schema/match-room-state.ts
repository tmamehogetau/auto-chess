import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

import type { UnitEffectSetId } from "../../shared/room-messages";

export class PlayerPresenceState extends Schema {
  declare public ready: boolean;

  declare public connected: boolean;

  declare public hp: number;

  declare public eliminated: boolean;

  declare public boardUnitCount: number;

  declare public lastCmdSeq: number;

  public constructor() {
    super();
    this.ready = false;
    this.connected = true;
    this.hp = 100;
    this.eliminated = false;
    this.boardUnitCount = 4;
    this.lastCmdSeq = 0;
  }
}

export class MatchRoomState extends Schema {
  declare public phase: string;

  declare public setId: UnitEffectSetId;

  declare public phaseDeadlineAtMs: number;

  declare public prepDeadlineAtMs: number;

  declare public roundIndex: number;

  declare public ranking: ArraySchema<string>;

  declare public players: MapSchema<PlayerPresenceState>;

  public constructor() {
    super();
    this.phase = "Waiting";
    this.setId = "set1";
    this.phaseDeadlineAtMs = 0;
    this.prepDeadlineAtMs = 0;
    this.roundIndex = 0;
    this.ranking = new ArraySchema<string>();
    this.players = new MapSchema<PlayerPresenceState>();
  }
}

defineTypes(PlayerPresenceState, {
  ready: "boolean",
  connected: "boolean",
  hp: "number",
  eliminated: "boolean",
  boardUnitCount: "number",
  lastCmdSeq: "number",
});

defineTypes(MatchRoomState, {
  phase: "string",
  setId: "string",
  phaseDeadlineAtMs: "number",
  prepDeadlineAtMs: "number",
  roundIndex: "number",
  ranking: ["string"],
  players: {
    map: PlayerPresenceState,
    default: new MapSchema<PlayerPresenceState>(),
  },
});
