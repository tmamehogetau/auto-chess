import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

import type { BoardUnitType, UnitEffectSetId } from "../../shared/room-messages";
import type { FeatureFlags } from "../../shared/feature-flags";

export class ShopOfferState extends Schema {
  declare public unitType: BoardUnitType;

  declare public unitId: string;

  declare public displayName: string;

  declare public factionId: string;

  declare public cost: number;

  declare public rarity: number;

  declare public isRumorUnit: boolean;

  declare public purchased: boolean;

  declare public unitLevel: number;

  public constructor() {
    super();
    this.unitType = "vanguard";
    this.unitId = "";
    this.displayName = "";
    this.factionId = "";
    this.cost = 1;
    this.rarity = 1;
    this.isRumorUnit = false;
    this.purchased = false;
    this.unitLevel = 1;
  }
}

export class BattleResultSchema extends Schema {
  declare public opponentId: string;
  declare public won: boolean;
  declare public damageDealt: number;
  declare public damageTaken: number;
  declare public survivors: number;
  declare public opponentSurvivors: number;
  declare public survivorSnapshots: ArraySchema<BattleResultSurvivorSchema>;
  declare public timelineEndState: ArraySchema<BattleTimelineEndStateUnitSchema>;

  public constructor() {
    super();
    this.opponentId = "";
    this.won = false;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.survivors = 0;
    this.opponentSurvivors = 0;
    this.survivorSnapshots = new ArraySchema<BattleResultSurvivorSchema>();
    this.timelineEndState = new ArraySchema<BattleTimelineEndStateUnitSchema>();
  }
}

export class BattleResultSurvivorSchema extends Schema {
  declare public unitId: string;
  declare public battleUnitId: string;
  declare public ownerPlayerId: string;
  declare public displayName: string;
  declare public unitType: string;
  declare public hp: number;
  declare public maxHp: number;
  declare public sharedBoardCellIndex: number;

  public constructor() {
    super();
    this.unitId = "";
    this.battleUnitId = "";
    this.ownerPlayerId = "";
    this.displayName = "";
    this.unitType = "vanguard";
    this.hp = 0;
    this.maxHp = 0;
    this.sharedBoardCellIndex = -1;
  }
}

export class BattleTimelineEndStateUnitSchema extends Schema {
  declare public battleUnitId: string;
  declare public side: "boss" | "raid";
  declare public x: number;
  declare public y: number;
  declare public currentHp: number;
  declare public maxHp: number;
  declare public displayName: string;
  declare public unitType: string;

  public constructor() {
    super();
    this.battleUnitId = "";
    this.side = "raid";
    this.x = 0;
    this.y = 0;
    this.currentHp = 0;
    this.maxHp = 0;
    this.displayName = "";
    this.unitType = "";
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

  declare public isSpectator: boolean;

  declare public wantsBoss: boolean;

  declare public selectedBossId: string;

  declare public role: "unassigned" | "raid" | "boss" | "spectator";

  declare public hp: number;

  declare public remainingLives: number;

  declare public finalRoundShield: number;

  declare public eliminated: boolean;

  declare public boardUnitCount: number;

  declare public shopOffers: ArraySchema<ShopOfferState>;

  declare public shopLocked: boolean;

  declare public gold: number;

  declare public specialUnitLevel: number;

  declare public benchUnits: ArraySchema<string>;

  declare public benchUnitIds: ArraySchema<string>;

  declare public benchDisplayNames: ArraySchema<string>;

  declare public boardUnits: ArraySchema<string>;

  declare public boardSubUnits: ArraySchema<string>;

  declare public ownedVanguard: number;

  declare public ownedRanger: number;

  declare public ownedMage: number;

  declare public ownedAssassin: number;

  declare public lastCmdSeq: number;

  declare public bossShopOffers: ArraySchema<ShopOfferState>;

  declare public heroExclusiveShopOffers: ArraySchema<ShopOfferState>;

  declare public lastBattleResult: BattleResultSchema;

  declare public activeSynergies: ArraySchema<SynergySchema>;

  declare public selectedHeroId: string;

  declare public isRumorEligible: boolean;

  public constructor() {
    super();
    this.ready = false;
    this.connected = true;
    this.isSpectator = false;
    this.wantsBoss = false;
    this.selectedBossId = "";
    this.role = "unassigned";
    this.hp = 100;
    this.remainingLives = 0;
    this.finalRoundShield = 0;
    this.eliminated = false;
    this.boardUnitCount = 4;
    this.shopOffers = new ArraySchema<ShopOfferState>();
    this.shopLocked = false;
    this.gold = 15;
    this.specialUnitLevel = 1;
    this.benchUnits = new ArraySchema<string>();
    this.benchUnitIds = new ArraySchema<string>();
    this.benchDisplayNames = new ArraySchema<string>();
    this.boardUnits = new ArraySchema<string>();
    this.boardSubUnits = new ArraySchema<string>();
    this.ownedVanguard = 0;
    this.ownedRanger = 0;
    this.ownedMage = 0;
    this.ownedAssassin = 0;
    this.lastCmdSeq = 0;
    this.bossShopOffers = new ArraySchema<ShopOfferState>();
    this.heroExclusiveShopOffers = new ArraySchema<ShopOfferState>();
    this.lastBattleResult = new BattleResultSchema();
    this.activeSynergies = new ArraySchema<SynergySchema>();
    this.selectedHeroId = "";
    this.isRumorEligible = false;
  }
}

export class MatchRoomState extends Schema {
  declare public phase: string;

  declare public playerPhase: string;

  declare public setId: UnitEffectSetId;

  declare public maxPlayers: number;

  declare public lobbyStage: "preference" | "selection" | "started";

  declare public phaseDeadlineAtMs: number;

  declare public playerPhaseDeadlineAtMs: number;

  declare public sharedBoardRoomId: string;

  declare public selectionDeadlineAtMs: number;

  declare public prepDeadlineAtMs: number;

  declare public roundIndex: number;

  declare public ranking: ArraySchema<string>;

  declare public players: MapSchema<PlayerPresenceState>;

  declare public featureFlagsEnableHeroSystem: boolean;

  declare public featureFlagsEnableSharedPool: boolean;

  declare public featureFlagsEnablePhaseExpansion: boolean;

  declare public featureFlagsEnableDominationSystem: boolean;

  declare public featureFlagsEnableSubUnitSystem: boolean;

  declare public featureFlagsEnableSpellCard: boolean;

  declare public featureFlagsEnableRumorInfluence: boolean;

  declare public featureFlagsEnableBossExclusiveShop: boolean;

  declare public featureFlagsEnableSharedBoardShadow: boolean;

  declare public featureFlagsEnableTouhouRoster: boolean;

  declare public featureFlagsEnableTouhouFactions: boolean;

  declare public featureFlagsEnablePerUnitSharedPool: boolean;

  declare public declaredSpellId: string;

  declare public usedSpellIds: ArraySchema<string>;

  declare public bossPlayerId: string;

  declare public raidPlayerIds: ArraySchema<string>;

  declare public sharedBoardAuthorityEnabled: boolean;

  declare public sharedBoardMode: string;

  declare public dominationCount: number;

  public constructor() {
    super();
    this.phase = "Waiting";
    this.playerPhase = "lobby";
    this.setId = "set1";
    this.maxPlayers = 4;
    this.lobbyStage = "preference";
    this.phaseDeadlineAtMs = 0;
    this.playerPhaseDeadlineAtMs = 0;
    this.sharedBoardRoomId = "";
    this.selectionDeadlineAtMs = 0;
    this.prepDeadlineAtMs = 0;
    this.roundIndex = 0;
    this.ranking = new ArraySchema<string>();
    this.players = new MapSchema<PlayerPresenceState>();
    this.featureFlagsEnableHeroSystem = false;
    this.featureFlagsEnableSharedPool = false;
    this.featureFlagsEnablePhaseExpansion = false;
    this.featureFlagsEnableDominationSystem = false;
    this.featureFlagsEnableSubUnitSystem = false;
    this.featureFlagsEnableSpellCard = false;
    this.featureFlagsEnableRumorInfluence = false;
    this.featureFlagsEnableBossExclusiveShop = false;
    this.featureFlagsEnableSharedBoardShadow = false;
    this.featureFlagsEnableTouhouRoster = false;
    this.featureFlagsEnableTouhouFactions = false;
    this.featureFlagsEnablePerUnitSharedPool = false;
    this.declaredSpellId = "";
    this.usedSpellIds = new ArraySchema<string>();
    this.bossPlayerId = "";
    this.raidPlayerIds = new ArraySchema<string>();
    this.sharedBoardAuthorityEnabled = false;
    this.sharedBoardMode = "local";
    this.dominationCount = 0;
  }
}

defineTypes(ShopOfferState, {
  unitType: "string",
  unitId: "string",
  displayName: "string",
  factionId: "string",
  cost: "number",
  rarity: "number",
  isRumorUnit: "boolean",
  purchased: "boolean",
  unitLevel: "number",
});

defineTypes(BattleResultSchema, {
  opponentId: "string",
  won: "boolean",
  damageDealt: "number",
  damageTaken: "number",
  survivors: "number",
  opponentSurvivors: "number",
  survivorSnapshots: [BattleResultSurvivorSchema],
  timelineEndState: [BattleTimelineEndStateUnitSchema],
});

defineTypes(BattleResultSurvivorSchema, {
  unitId: "string",
  battleUnitId: "string",
  ownerPlayerId: "string",
  displayName: "string",
  unitType: "string",
  hp: "number",
  maxHp: "number",
  sharedBoardCellIndex: "number",
});

defineTypes(SynergySchema, {
  unitType: "string",
  count: "number",
  tier: "number",
});

defineTypes(PlayerPresenceState, {
  ready: "boolean",
  connected: "boolean",
  isSpectator: "boolean",
  wantsBoss: "boolean",
  selectedBossId: "string",
  role: "string",
  hp: "number",
  remainingLives: "number",
  finalRoundShield: "number",
  eliminated: "boolean",
  boardUnitCount: "number",
  shopOffers: [ShopOfferState],
  shopLocked: "boolean",
  gold: "number",
  specialUnitLevel: "number",
  benchUnits: ["string"],
  benchUnitIds: ["string"],
  benchDisplayNames: ["string"],
  boardUnits: ["string"],
  boardSubUnits: ["string"],
  ownedVanguard: "number",
  ownedRanger: "number",
  ownedMage: "number",
  ownedAssassin: "number",
  lastCmdSeq: "number",
  bossShopOffers: [ShopOfferState],
  heroExclusiveShopOffers: [ShopOfferState],
  lastBattleResult: BattleResultSchema,
  activeSynergies: [SynergySchema],
  selectedHeroId: "string",
  isRumorEligible: "boolean",
});

defineTypes(MatchRoomState, {
  phase: "string",
  playerPhase: "string",
  setId: "string",
  maxPlayers: "number",
  lobbyStage: "string",
  phaseDeadlineAtMs: "number",
  playerPhaseDeadlineAtMs: "number",
  sharedBoardRoomId: "string",
  selectionDeadlineAtMs: "number",
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
  featureFlagsEnableDominationSystem: "boolean",
  featureFlagsEnableSubUnitSystem: "boolean",
  featureFlagsEnableSpellCard: "boolean",
  featureFlagsEnableRumorInfluence: "boolean",
  featureFlagsEnableBossExclusiveShop: "boolean",
  featureFlagsEnableSharedBoardShadow: "boolean",
  featureFlagsEnableTouhouRoster: "boolean",
  featureFlagsEnableTouhouFactions: "boolean",
  featureFlagsEnablePerUnitSharedPool: "boolean",
  declaredSpellId: "string",
  usedSpellIds: ["string"],
  bossPlayerId: "string",
  raidPlayerIds: ["string"],
  sharedBoardAuthorityEnabled: "boolean",
  sharedBoardMode: "string",
  dominationCount: "number",
});
