/**
 * Shared player state types for MatchRoomController and player-state-sync
 *
 * These types define the serialized view of player state that flows from
 * controller to room state and eventually to clients.
 *
 * Naming convention: "View" suffix indicates a serialized/transport format
 */

/**
 * Battle result as returned from MatchRoomController.getPlayerStatus()
 * This is a serialized view of the internal BattleResult type
 */
export interface PlayerStatusBattleResult {
  opponentId: string;
  won: boolean;
  damageDealt: number;
  damageTaken: number;
  survivors: number;
  opponentSurvivors: number;
}

/**
 * Serialized view of a shop offer for client consumption
 */
export interface ShopOfferView {
  unitType: string;
  unitId?: string;
  displayName?: string;
  factionId?: string;
  cost: number;
  rarity: number;
  isRumorUnit?: boolean;
  starLevel?: number;
}

/**
 * Serialized view of a shop item offer for client consumption
 */
export interface ShopItemOfferView {
  itemType: string;
  cost: number;
}

/**
 * Owned units breakdown by type
 */
export interface OwnedUnitsView {
  vanguard: number;
  ranger: number;
  mage: number;
  assassin: number;
  [key: string]: number;
}

/**
 * Active synergy information
 */
export interface ActiveSynergyView {
  unitType: string;
  count: number;
  tier: number;
}

/**
 * Type representing the player status returned from MatchRoomController.getPlayerStatus()
 * Used for full state synchronization from controller to room state.
 *
 * This is a serialized view where complex types are converted to primitives
 * suitable for network transmission and client consumption.
 */
export interface ControllerPlayerStatus {
  wantsBoss?: boolean;
  selectedBossId?: string;
  role?: "unassigned" | "raid" | "boss";
  hp: number;
  remainingLives: number;
  eliminated: boolean;
  boardUnitCount: number;
  gold: number;
  xp: number;
  level: number;
  shopOffers: ShopOfferView[];
  shopLocked: boolean;
  benchUnits: string[];
  boardUnits: string[];
  ownedUnits: OwnedUnitsView;
  itemInventory: string[];
  itemShopOffers: ShopItemOfferView[];
  bossShopOffers: ShopOfferView[];
  lastBattleResult: PlayerStatusBattleResult | undefined;
  activeSynergies?: ActiveSynergyView[];
  selectedHeroId: string;
  isRumorEligible: boolean;
  sharedPoolInventory?: ReadonlyMap<number, number>;
}

/**
 * Type representing command result payload for partial state updates.
 * Used after a command is processed and accepted to sync the resulting state changes.
 *
 * Note: lastBattleResult is required (not optional) but can be undefined.
 * Other optional fields use standard optional syntax for backward compatibility.
 */
export interface CommandResultPayload {
  wantsBoss?: boolean;
  selectedBossId?: string;
  role?: "unassigned" | "raid" | "boss";
  lobbyStage?: "preference" | "selection" | "started";
  selectionDeadlineAtMs?: number;
  hp?: number;
  eliminated?: boolean;
  boardUnitCount: number;
  gold: number;
  xp: number;
  level: number;
  shopLocked: boolean;
  ownedUnits: OwnedUnitsView;
  shopOffers: ShopOfferView[];
  benchUnits: string[];
  boardUnits: string[];
  itemShopOffers: ShopItemOfferView[];
  itemInventory: string[];
  lastBattleResult: PlayerStatusBattleResult | undefined;
  activeSynergies?: ActiveSynergyView[];
  bossShopOffers?: ShopOfferView[];
  selectedHeroId?: string;
  isRumorEligible?: boolean;
}
