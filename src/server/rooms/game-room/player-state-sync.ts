import {
  PlayerPresenceState,
  ShopOfferState,
  ShopItemOfferState,
  SynergySchema,
} from "../../schema/match-room-state";
import type { BoardUnitType, ItemType } from "../../../shared/types";

// Type assertions for string-to-union-type conversions
const toBoardUnitType = (s: string): BoardUnitType => s as BoardUnitType;
const toItemType = (s: string): ItemType => s as ItemType;

/**
 * Battle result type as returned from MatchRoomController.getPlayerStatus()
 * Note: This is different from battle-simulator.ts BattleResult
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
 * Type representing the player status returned from MatchRoomController.getPlayerStatus()
 * Used for full state synchronization from controller to room state.
 */
export interface ControllerPlayerStatus {
  hp: number;
  eliminated: boolean;
  boardUnitCount: number;
  gold: number;
  xp: number;
  level: number;
  shopOffers: Array<{
    unitType: string;
    cost: number;
    rarity: number;
    isRumorUnit?: boolean;
  }>;
  shopLocked: boolean;
  benchUnits: string[];
  boardUnits: string[];
  ownedUnits: {
    vanguard: number;
    ranger: number;
    mage: number;
    assassin: number;
  };
  itemInventory: string[];
  itemShopOffers: Array<{
    itemType: string;
    cost: number;
  }>;
  bossShopOffers: Array<{
    unitType: string;
    cost: number;
    rarity: number;
    isRumorUnit?: boolean;
  }>;
  lastBattleResult: PlayerStatusBattleResult | undefined;
  activeSynergies?: Array<{
    unitType: string;
    count: number;
    tier: number;
  }>;
  selectedHeroId: string;
  isRumorEligible: boolean;
}

/**
 * Type representing command result payload for partial state updates.
 * Used after a command is processed and accepted to sync the resulting state changes.
 */
export interface CommandResultPayload {
  boardUnitCount: number;
  gold: number;
  xp: number;
  level: number;
  shopLocked: boolean;
  ownedUnits: {
    vanguard: number;
    ranger: number;
    mage: number;
    assassin: number;
  };
  shopOffers: Array<{
    unitType: string;
    cost: number;
    rarity: number;
    isRumorUnit?: boolean;
  }>;
  benchUnits: string[];
  boardUnits: string[];
  itemShopOffers: Array<{
    itemType: string;
    cost: number;
  }>;
  itemInventory: string[];
  lastBattleResult: PlayerStatusBattleResult | undefined;
  activeSynergies?: Array<{
    unitType: string;
    count: number;
    tier: number;
  }>;
  bossShopOffers?: Array<{
    unitType: string;
    cost: number;
    rarity: number;
    isRumorUnit?: boolean;
  }>;
  selectedHeroId?: string;
  isRumorEligible?: boolean;
}

/**
 * Clears all items from a Colyseus ArraySchema using pop().
 * This is the recommended pattern for clearing Colyseus arrays.
 */
function clearArraySchema<T>(array: { length: number; pop: () => T | undefined }): void {
  while (array.length > 0) {
    array.pop();
  }
}

/**
 * Synchronizes player state from controller status to room state.
 * Performs a full sync - clears existing data and repopulates from controller.
 *
 * @param playerState - The PlayerPresenceState to update
 * @param controllerStatus - The status data from the controller
 */
export function syncPlayerStateFromController(
  playerState: PlayerPresenceState,
  controllerStatus: ControllerPlayerStatus,
): void {
  // Basic stats
  playerState.hp = controllerStatus.hp;
  playerState.eliminated = controllerStatus.eliminated;
  playerState.boardUnitCount = controllerStatus.boardUnitCount;
  playerState.gold = controllerStatus.gold;
  playerState.xp = controllerStatus.xp;
  playerState.level = controllerStatus.level;
  playerState.shopLocked = controllerStatus.shopLocked;

  // Owned units breakdown
  playerState.ownedVanguard = controllerStatus.ownedUnits.vanguard;
  playerState.ownedRanger = controllerStatus.ownedUnits.ranger;
  playerState.ownedMage = controllerStatus.ownedUnits.mage;
  playerState.ownedAssassin = controllerStatus.ownedUnits.assassin;

  // Feature-flagged fields (backward compatible with empty defaults)
  playerState.selectedHeroId = controllerStatus.selectedHeroId;
  playerState.isRumorEligible = controllerStatus.isRumorEligible;

  // Shop offers - clear and repopulate
  clearArraySchema(playerState.shopOffers);
  for (const offer of controllerStatus.shopOffers) {
    const nextOffer = new ShopOfferState();
    nextOffer.unitType = toBoardUnitType(offer.unitType);
    nextOffer.cost = offer.cost;
    nextOffer.rarity = offer.rarity;
    nextOffer.isRumorUnit = offer.isRumorUnit === true;
    playerState.shopOffers.push(nextOffer);
  }

  // Bench units - clear and repopulate
  clearArraySchema(playerState.benchUnits);
  for (const benchUnit of controllerStatus.benchUnits) {
    playerState.benchUnits.push(benchUnit);
  }

  // Board units - clear and repopulate
  clearArraySchema(playerState.boardUnits);
  for (const boardUnit of controllerStatus.boardUnits) {
    playerState.boardUnits.push(boardUnit);
  }

  // Item shop offers - clear and repopulate
  clearArraySchema(playerState.itemShopOffers);
  for (const offer of controllerStatus.itemShopOffers || []) {
    const nextOffer = new ShopItemOfferState();
    nextOffer.itemType = toItemType(offer.itemType);
    nextOffer.cost = offer.cost;
    playerState.itemShopOffers.push(nextOffer);
  }

  // Boss shop offers - clear and repopulate
  clearArraySchema(playerState.bossShopOffers);
  for (const offer of controllerStatus.bossShopOffers || []) {
    const nextOffer = new ShopOfferState();
    nextOffer.unitType = toBoardUnitType(offer.unitType);
    nextOffer.cost = offer.cost;
    nextOffer.rarity = offer.rarity;
    nextOffer.isRumorUnit = offer.isRumorUnit === true;
    playerState.bossShopOffers.push(nextOffer);
  }

  // Item inventory - clear and repopulate
  clearArraySchema(playerState.itemInventory);
  for (const item of controllerStatus.itemInventory || []) {
    playerState.itemInventory.push(item);
  }

  // Last battle result
  if (controllerStatus.lastBattleResult) {
    playerState.lastBattleResult.opponentId = controllerStatus.lastBattleResult.opponentId;
    playerState.lastBattleResult.won = controllerStatus.lastBattleResult.won;
    playerState.lastBattleResult.damageDealt = controllerStatus.lastBattleResult.damageDealt;
    playerState.lastBattleResult.damageTaken = controllerStatus.lastBattleResult.damageTaken;
    playerState.lastBattleResult.survivors = controllerStatus.lastBattleResult.survivors;
    playerState.lastBattleResult.opponentSurvivors = controllerStatus.lastBattleResult.opponentSurvivors;
  } else {
    playerState.lastBattleResult.opponentId = "";
    playerState.lastBattleResult.won = false;
    playerState.lastBattleResult.damageDealt = 0;
    playerState.lastBattleResult.damageTaken = 0;
    playerState.lastBattleResult.survivors = 0;
    playerState.lastBattleResult.opponentSurvivors = 0;
  }

  // Active synergies - clear and repopulate
  clearArraySchema(playerState.activeSynergies);
  for (const synergy of controllerStatus.activeSynergies || []) {
    const nextSynergy = new SynergySchema();
    nextSynergy.unitType = synergy.unitType;
    nextSynergy.count = synergy.count;
    nextSynergy.tier = synergy.tier;
    playerState.activeSynergies.push(nextSynergy);
  }
}

/**
 * Synchronizes player state from command result payload.
 * Used to update state after a command is processed and accepted.
 *
 * @param playerState - The PlayerPresenceState to update
 * @param cmdResult - The command result payload
 * @param cmdSeq - The command sequence number to update
 */
export function syncPlayerStateFromCommandResult(
  playerState: PlayerPresenceState,
  cmdResult: CommandResultPayload,
  cmdSeq: number,
): void {
  playerState.lastCmdSeq = cmdSeq;

  playerState.boardUnitCount = cmdResult.boardUnitCount;
  playerState.gold = cmdResult.gold;
  playerState.xp = cmdResult.xp;
  playerState.level = cmdResult.level;
  playerState.shopLocked = cmdResult.shopLocked;

  playerState.ownedVanguard = cmdResult.ownedUnits.vanguard;
  playerState.ownedRanger = cmdResult.ownedUnits.ranger;
  playerState.ownedMage = cmdResult.ownedUnits.mage;
  playerState.ownedAssassin = cmdResult.ownedUnits.assassin;

  // Feature-flagged fields (backward compatible with empty defaults)
  if (cmdResult.selectedHeroId !== undefined) {
    playerState.selectedHeroId = cmdResult.selectedHeroId;
  }
  if (cmdResult.isRumorEligible !== undefined) {
    playerState.isRumorEligible = cmdResult.isRumorEligible;
  }

  // Shop offers - clear and repopulate
  clearArraySchema(playerState.shopOffers);
  for (const offer of cmdResult.shopOffers) {
    const nextOffer = new ShopOfferState();
    nextOffer.unitType = toBoardUnitType(offer.unitType);
    nextOffer.cost = offer.cost;
    nextOffer.rarity = offer.rarity;
    nextOffer.isRumorUnit = offer.isRumorUnit === true;
    playerState.shopOffers.push(nextOffer);
  }

  // Bench units - clear and repopulate
  clearArraySchema(playerState.benchUnits);
  for (const benchUnit of cmdResult.benchUnits) {
    playerState.benchUnits.push(benchUnit);
  }

  // Board units - clear and repopulate
  clearArraySchema(playerState.boardUnits);
  for (const boardUnit of cmdResult.boardUnits) {
    playerState.boardUnits.push(boardUnit);
  }

  // Item shop offers - clear and repopulate
  clearArraySchema(playerState.itemShopOffers);
  for (const offer of cmdResult.itemShopOffers || []) {
    const nextOffer = new ShopItemOfferState();
    nextOffer.itemType = toItemType(offer.itemType);
    nextOffer.cost = offer.cost;
    playerState.itemShopOffers.push(nextOffer);
  }

  // Boss shop offers - clear and repopulate
  clearArraySchema(playerState.bossShopOffers);
  for (const offer of cmdResult.bossShopOffers || []) {
    const nextOffer = new ShopOfferState();
    nextOffer.unitType = toBoardUnitType(offer.unitType);
    nextOffer.cost = offer.cost;
    nextOffer.rarity = offer.rarity;
    nextOffer.isRumorUnit = offer.isRumorUnit === true;
    playerState.bossShopOffers.push(nextOffer);
  }

  // Item inventory - clear and repopulate
  clearArraySchema(playerState.itemInventory);
  for (const item of cmdResult.itemInventory || []) {
    playerState.itemInventory.push(item);
  }

  // Last battle result
  if (cmdResult.lastBattleResult) {
    playerState.lastBattleResult.opponentId = cmdResult.lastBattleResult.opponentId;
    playerState.lastBattleResult.won = cmdResult.lastBattleResult.won;
    playerState.lastBattleResult.damageDealt = cmdResult.lastBattleResult.damageDealt;
    playerState.lastBattleResult.damageTaken = cmdResult.lastBattleResult.damageTaken;
    playerState.lastBattleResult.survivors = cmdResult.lastBattleResult.survivors;
    playerState.lastBattleResult.opponentSurvivors = cmdResult.lastBattleResult.opponentSurvivors;
  } else {
    playerState.lastBattleResult.opponentId = "";
    playerState.lastBattleResult.won = false;
    playerState.lastBattleResult.damageDealt = 0;
    playerState.lastBattleResult.damageTaken = 0;
    playerState.lastBattleResult.survivors = 0;
    playerState.lastBattleResult.opponentSurvivors = 0;
  }

  // Active synergies - clear and repopulate
  clearArraySchema(playerState.activeSynergies);
  for (const synergy of cmdResult.activeSynergies || []) {
    const nextSynergy = new SynergySchema();
    nextSynergy.unitType = synergy.unitType;
    nextSynergy.count = synergy.count;
    nextSynergy.tier = synergy.tier;
    playerState.activeSynergies.push(nextSynergy);
  }
}
