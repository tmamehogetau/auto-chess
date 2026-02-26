import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

import type { BoardUnitType, UnitEffectSetId } from "../../shared/room-messages";
import type { ItemType } from "../../shared/types";

export class ShopOfferState extends Schema {
  declare public unitType: BoardUnitType;

  declare public cost: number;

  declare public rarity: number;

  public constructor() {
    super();
    this.unitType = "vanguard";
    this.cost = 1;
    this.rarity = 1;
  }
}

export class ShopItemOfferState extends Schema {
  declare public itemType: ItemType;

  declare public cost: number;

  public constructor() {
    super();
    this.itemType = "sword";
    this.cost = 3;
  }
}

export class PlayerPresenceState extends Schema {
  declare public ready: boolean;

  declare public connected: boolean;

  declare public hp: number;

  declare public eliminated: boolean;

  declare public boardUnitCount: number;

  declare public shopOffers: ArraySchema<ShopOfferState>;

  declare public shopLocked: boolean;

  declare public gold: number;

  declare public xp: number;

  declare public level: number;

  declare public benchUnits: ArraySchema<string>;

  declare public boardUnits: ArraySchema<string>;

  declare public ownedVanguard: number;

  declare public ownedRanger: number;

  declare public ownedMage: number;

  declare public ownedAssassin: number;

  declare public lastCmdSeq: number;

  declare public itemShopOffers: ArraySchema<ShopItemOfferState>;

  declare public itemInventory: ArraySchema<string>;

  public constructor() {
    super();
    this.ready = false;
    this.connected = true;
    this.hp = 100;
    this.eliminated = false;
    this.boardUnitCount = 4;
    this.shopOffers = new ArraySchema<ShopOfferState>();
    this.shopLocked = false;
    this.gold = 15;
    this.xp = 0;
    this.level = 1;
    this.benchUnits = new ArraySchema<string>();
    this.boardUnits = new ArraySchema<string>();
    this.ownedVanguard = 0;
    this.ownedRanger = 0;
    this.ownedMage = 0;
    this.ownedAssassin = 0;
    this.lastCmdSeq = 0;
    this.itemShopOffers = new ArraySchema<ShopItemOfferState>();
    this.itemInventory = new ArraySchema<string>();
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

defineTypes(ShopOfferState, {
  unitType: "string",
  cost: "number",
  rarity: "number",
});

defineTypes(ShopItemOfferState, {
  itemType: "string",
  cost: "number",
});

defineTypes(PlayerPresenceState, {
  ready: "boolean",
  connected: "boolean",
  hp: "number",
  eliminated: "boolean",
  boardUnitCount: "number",
  shopOffers: [ShopOfferState],
  shopLocked: "boolean",
  gold: "number",
  xp: "number",
  level: "number",
  benchUnits: ["string"],
  boardUnits: ["string"],
  ownedVanguard: "number",
  ownedRanger: "number",
  ownedMage: "number",
  ownedAssassin: "number",
  lastCmdSeq: "number",
  itemShopOffers: [ShopItemOfferState],
  itemInventory: ["string"],
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
