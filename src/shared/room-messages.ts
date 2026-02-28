import { ItemType } from './types';

export const CLIENT_MESSAGE_TYPES = {
  READY: "ready",
  PREP_COMMAND: "prep_command",
} as const;

export const SERVER_MESSAGE_TYPES = {
  COMMAND_RESULT: "command_result",
  ROUND_STATE: "round_state",
} as const;

export type MatchPhase =
  | "Waiting"
  | "Prep"
  | "Battle"
  | "Settle"
  | "Elimination"
  | "End";

export interface ReadyMessage {
  ready?: boolean;
}

export interface PrepCommandMessage {
  cmdSeq: number;
  boardUnitCount?: number;
  boardPlacements?: BoardUnitPlacement[];
  xpPurchaseCount?: number;
  shopRefreshCount?: number;
  shopBuySlotIndex?: number;
  shopLock?: boolean;
  benchToBoardCell?: {
    benchIndex: number;
    cell: number;
  };
  benchSellIndex?: number;
  boardSellIndex?: number;
  itemBuySlotIndex?: number;           // Buy item from shop
  itemEquipToBench?: {                 // Equip item to bench unit
    inventoryItemIndex: number;        // Index in inventory
    benchIndex: number;                // Bench unit index
  };
  itemUnequipFromBench?: {             // Unequip item from bench
    benchIndex: number;                // Bench unit index
    itemSlotIndex: number;             // Item slot on unit (0-2)
  };
  itemSellInventoryIndex?: number;     // Sell item from inventory
}

export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type UnitEffectSetId = "set1" | "set2";

export interface ShopItemOffer {
  itemType: ItemType;
  cost: number;
}

export interface BoardUnitPlacement {
  cell: number;
  unitType: BoardUnitType;
  starLevel?: number;
  sellValue?: number;
  unitCount?: number;
  items?: ItemType[];  // Max 3 items per unit
}

export type CommandRejectCode =
  | "LATE_INPUT"
  | "PHASE_MISMATCH"
  | "DUPLICATE_CMD"
  | "UNKNOWN_PLAYER"
  | "INVALID_PAYLOAD"
  | "INSUFFICIENT_GOLD"
  | "BENCH_FULL"
  | "INVENTORY_FULL";

export type CommandResult =
  | { accepted: true }
  | { accepted: false; code: CommandRejectCode };

export interface RoundStateMessage {
  phase: MatchPhase;
  roundIndex: number;
  phaseDeadlineAtMs: number;
  ranking: string[];

  phaseHpTarget?: number;
  phaseDamageDealt?: number;
  phaseResult?: "pending" | "success" | "failed";
  phaseCompletionRate?: number;

  // Battle results (added for each player)
  lastBattleResult?: {
    opponentId: string;        // Who you fought
    won: boolean;              // Did you win?
    damageDealt: number;       // Damage you dealt
    damageTaken: number;       // Damage you received
    survivors: number;         // Your surviving units
    opponentSurvivors: number; // Enemy surviving units
  };

  // Active synergies for this player
  activeSynergies?: {
    unitType: string;
    count: number;
    tier: number;  // 0, 1, 2, or 3
  }[];
}

export interface PlayerMatchStatus {
  hp: number;
  eliminated: boolean;
  boardUnitCount: number;
  gold: number;
  xp: number;
  level: number;
  shopOffers: any[];
  shopLocked: boolean;
  benchUnits: string[];
  boardUnits: string[];
  ownedUnits: any;
  itemInventory: ItemType[];
  itemShopOffers: ShopItemOffer[];
  lastBattleResult?: {
    opponentId: string;
    won: boolean;
    damageDealt: number;
    damageTaken: number;
    survivors: number;
    opponentSurvivors: number;
  };
  activeSynergies?: {
    unitType: string;
    count: number;
    tier: number;
  }[];
}
