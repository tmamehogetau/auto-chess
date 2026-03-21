import {
  BattleResultSurvivorSchema,
  PlayerPresenceState,
  ShopOfferState,
  ShopItemOfferState,
  SynergySchema,
} from "../../schema/match-room-state";
import type { BoardUnitType, ItemType } from "../../../shared/types";
import type {
  BattleResultSurvivorSnapshot,
  ControllerPlayerStatus,
  CommandResultPayload,
} from "../../types/player-state-types";
import type { BattleTimelineEvent } from "../../../shared/room-messages";

// Re-export types for backward compatibility
export type {
  PlayerStatusBattleResult,
  ShopOfferView,
  ShopItemOfferView,
  OwnedUnitsView,
  ActiveSynergyView,
  ControllerPlayerStatus,
  CommandResultPayload,
} from "../../types/player-state-types";

// Type assertions for string-to-union-type conversions
const toBoardUnitType = (s: string): BoardUnitType => s as BoardUnitType;
const toItemType = (s: string): ItemType => s as ItemType;

/**
 * Clears all items from a Colyseus ArraySchema using pop().
 * This is the recommended pattern for clearing Colyseus arrays.
 */
function clearArraySchema<T>(array: { length: number; pop: () => T | undefined }): void {
  while (array.length > 0) {
    array.pop();
  }
}

function syncBattleResultSurvivorSnapshots(
  target: { survivorSnapshots: { length: number; pop: () => unknown; push: (value: BattleResultSurvivorSchema) => void } },
  snapshots: BattleResultSurvivorSnapshot[] | undefined,
): void {
  clearArraySchema(target.survivorSnapshots);
  for (const snapshot of snapshots ?? []) {
    const nextSnapshot = new BattleResultSurvivorSchema();
    nextSnapshot.unitId = snapshot?.unitId ?? "";
    nextSnapshot.displayName = snapshot?.displayName ?? "";
    nextSnapshot.unitType = snapshot?.unitType ?? "vanguard";
    nextSnapshot.hp = Number(snapshot?.hp ?? 0);
    nextSnapshot.maxHp = Number(snapshot?.maxHp ?? 0);
    nextSnapshot.combatCell = Number(snapshot?.combatCell ?? -1);
    target.survivorSnapshots.push(nextSnapshot);
  }
}

function syncBattleTimelineEvents(
  target: { timelineEvents: { length: number; pop: () => unknown; push: (value: string) => void } },
  timeline: BattleTimelineEvent[] | undefined,
): void {
  clearArraySchema(target.timelineEvents);
  for (const event of timeline ?? []) {
    target.timelineEvents.push(JSON.stringify(event));
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
  playerState.remainingLives = controllerStatus.remainingLives;
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
  if (controllerStatus.wantsBoss !== undefined) {
    playerState.wantsBoss = controllerStatus.wantsBoss;
  }
  if (controllerStatus.selectedBossId !== undefined) {
    playerState.selectedBossId = controllerStatus.selectedBossId;
  }
  if (controllerStatus.role !== undefined) {
    playerState.role = controllerStatus.role;
  }
  if (controllerStatus.selectedHeroId !== undefined) {
    playerState.selectedHeroId = controllerStatus.selectedHeroId;
  }
  if (controllerStatus.isRumorEligible !== undefined) {
    playerState.isRumorEligible = controllerStatus.isRumorEligible;
  }

  // Shop offers - clear and repopulate
  clearArraySchema(playerState.shopOffers);
  for (const offer of controllerStatus.shopOffers) {
    const nextOffer = new ShopOfferState();
    nextOffer.unitType = toBoardUnitType(offer.unitType);
    nextOffer.unitId = offer.unitId ?? "";
    nextOffer.displayName = offer.displayName ?? "";
    nextOffer.factionId = offer.factionId ?? "";
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

  clearArraySchema(playerState.benchDisplayNames);
  for (const benchDisplayName of controllerStatus.benchDisplayNames ?? []) {
    playerState.benchDisplayNames.push(benchDisplayName);
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
    nextOffer.unitId = offer.unitId ?? "";
    nextOffer.displayName = offer.displayName ?? "";
    nextOffer.factionId = offer.factionId ?? "";
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
    syncBattleResultSurvivorSnapshots(
      playerState.lastBattleResult,
      controllerStatus.lastBattleResult.survivorSnapshots,
    );
    syncBattleTimelineEvents(
      playerState.lastBattleResult,
      controllerStatus.lastBattleResult.timeline,
    );
  } else {
    playerState.lastBattleResult.opponentId = "";
    playerState.lastBattleResult.won = false;
    playerState.lastBattleResult.damageDealt = 0;
    playerState.lastBattleResult.damageTaken = 0;
    playerState.lastBattleResult.survivors = 0;
    playerState.lastBattleResult.opponentSurvivors = 0;
    syncBattleResultSurvivorSnapshots(playerState.lastBattleResult, []);
    syncBattleTimelineEvents(playerState.lastBattleResult, []);
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
  if (cmdResult.wantsBoss !== undefined) {
    playerState.wantsBoss = cmdResult.wantsBoss;
  }
  if (cmdResult.selectedBossId !== undefined) {
    playerState.selectedBossId = cmdResult.selectedBossId;
  }
  if (cmdResult.role !== undefined) {
    playerState.role = cmdResult.role;
  }
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
    nextOffer.unitId = offer.unitId ?? "";
    nextOffer.displayName = offer.displayName ?? "";
    nextOffer.factionId = offer.factionId ?? "";
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

  clearArraySchema(playerState.benchDisplayNames);
  for (const benchDisplayName of cmdResult.benchDisplayNames ?? []) {
    playerState.benchDisplayNames.push(benchDisplayName);
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
    nextOffer.unitId = offer.unitId ?? "";
    nextOffer.displayName = offer.displayName ?? "";
    nextOffer.factionId = offer.factionId ?? "";
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
    syncBattleResultSurvivorSnapshots(
      playerState.lastBattleResult,
      cmdResult.lastBattleResult.survivorSnapshots,
    );
    syncBattleTimelineEvents(
      playerState.lastBattleResult,
      cmdResult.lastBattleResult.timeline,
    );
  } else {
    playerState.lastBattleResult.opponentId = "";
    playerState.lastBattleResult.won = false;
    playerState.lastBattleResult.damageDealt = 0;
    playerState.lastBattleResult.damageTaken = 0;
    playerState.lastBattleResult.survivors = 0;
    playerState.lastBattleResult.opponentSurvivors = 0;
    syncBattleResultSurvivorSnapshots(playerState.lastBattleResult, []);
    syncBattleTimelineEvents(playerState.lastBattleResult, []);
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
