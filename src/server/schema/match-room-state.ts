import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

import type { BoardUnitType, UnitEffectSetId } from "../../shared/room-messages";
import type { ItemType } from "../../shared/types";
import type { FeatureFlags } from "../../shared/feature-flags";

export class ShopOfferState extends Schema {
  declare public unitType: BoardUnitType;

  declare public cost: number;

  declare public rarity: number;

  declare public isRumorUnit: boolean;

  public constructor() {
    super();
    this.unitType = "vanguard";
    this.cost = 1;
    this.rarity = 1;
    this.isRumorUnit = false;
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

export class BattleResultSchema extends Schema {
  declare public opponentId: string;
  declare public won: boolean;
  declare public damageDealt: number;
  declare public damageTaken: number;
  declare public survivors: number;
  declare public opponentSurvivors: number;

  public constructor() {
    super();
    this.opponentId = "";
    this.won = false;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.survivors = 0;
    this.opponentSurvivors = 0;
  }
}

export class SynergySchema extends Schema {
  declare public unitType: string;
  declare public count: number;
  declare public tier: number;

  public constructor() {
    super();
    this.unitType = "vanguard";
    this.count = 0;
    this.tier = 0;
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

  declare public bossShopOffers: ArraySchema<ShopOfferState>;

  declare public itemInventory: ArraySchema<string>;

  declare public lastBattleResult: BattleResultSchema;

  declare public activeSynergies: ArraySchema<SynergySchema>;

  declare public selectedHeroId: string;

  declare public isRumorEligible: boolean;

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
    this.bossShopOffers = new ArraySchema<ShopOfferState>();
    this.itemInventory = new ArraySchema<string>();
    this.lastBattleResult = new BattleResultSchema();
    this.activeSynergies = new ArraySchema<SynergySchema>();
    this.selectedHeroId = "";
    this.isRumorEligible = false;
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

  declare public featureFlagsEnableHeroSystem: boolean;

  declare public featureFlagsEnableSharedPool: boolean;

  declare public featureFlagsEnablePhaseExpansion: boolean;

  declare public featureFlagsEnableSubUnitSystem: boolean;

  declare public featureFlagsEnableSpellCard: boolean;

  declare public featureFlagsEnableRumorInfluence: boolean;

  declare public featureFlagsEnableBossExclusiveShop: boolean;

  declare public featureFlagsEnableSharedBoardShadow: boolean;

  declare public declaredSpellId: string;

  declare public usedSpellIds: ArraySchema<string>;

  declare public bossPlayerId: string;

  declare public dominationCount: number;

  public constructor() {
    super();
    this.phase = "Waiting";
    this.setId = "set1";
    this.phaseDeadlineAtMs = 0;
    this.prepDeadlineAtMs = 0;
    this.roundIndex = 0;
    this.ranking = new ArraySchema<string>();
    this.players = new MapSchema<PlayerPresenceState>();
    this.featureFlagsEnableHeroSystem = false;
    this.featureFlagsEnableSharedPool = false;
    this.featureFlagsEnablePhaseExpansion = false;
    this.featureFlagsEnableSubUnitSystem = false;
    this.featureFlagsEnableSpellCard = false;
    this.featureFlagsEnableRumorInfluence = false;
    this.featureFlagsEnableBossExclusiveShop = false;
    this.featureFlagsEnableSharedBoardShadow = false;
    this.declaredSpellId = "";
    this.usedSpellIds = new ArraySchema<string>();
    this.bossPlayerId = "";
    this.dominationCount = 0;
  }
}

defineTypes(ShopOfferState, {
  unitType: "string",
  cost: "number",
  rarity: "number",
  isRumorUnit: "boolean",
});

defineTypes(ShopItemOfferState, {
  itemType: "string",
  cost: "number",
});

defineTypes(BattleResultSchema, {
  opponentId: "string",
  won: "boolean",
  damageDealt: "number",
  damageTaken: "number",
  survivors: "number",
  opponentSurvivors: "number",
});

defineTypes(SynergySchema, {
  unitType: "string",
  count: "number",
  tier: "number",
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
  bossShopOffers: [ShopOfferState],
  itemInventory: ["string"],
  lastBattleResult: BattleResultSchema,
  activeSynergies: [SynergySchema],
  selectedHeroId: "string",
  isRumorEligible: "boolean",
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
  featureFlagsEnableHeroSystem: "boolean",
  featureFlagsEnableSharedPool: "boolean",
  featureFlagsEnablePhaseExpansion: "boolean",
  featureFlagsEnableSubUnitSystem: "boolean",
  featureFlagsEnableSpellCard: "boolean",
  featureFlagsEnableRumorInfluence: "boolean",
  featureFlagsEnableBossExclusiveShop: "boolean",
  featureFlagsEnableSharedBoardShadow: "boolean",
  declaredSpellId: "string",
  usedSpellIds: ["string"],
  bossPlayerId: "string",
  dominationCount: "number",
});
