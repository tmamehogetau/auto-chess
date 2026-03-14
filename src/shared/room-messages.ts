import type { TouhouFactionId } from '../data/touhou-units';
import type { ItemType, UnitId } from './types';

export const CLIENT_MESSAGE_TYPES = {
  READY: "ready",
  PREP_COMMAND: "prep_command",
  ADMIN_QUERY: "admin_query",
} as const;

export const SERVER_MESSAGE_TYPES = {
  COMMAND_RESULT: "command_result",
  ROUND_STATE: "round_state",
  SHADOW_DIFF: "shadow_diff",
  ADMIN_RESPONSE: "admin_response",
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
  correlationId?: string;
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
  bossShopBuySlotIndex?: number;       // Buy unit from boss shop
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
  unitId?: UnitId;
  factionId?: TouhouFactionId | null;
  hp?: number;
  attack?: number;
  attackSpeed?: number;
  range?: number;
  starLevel?: number;
  sellValue?: number;
  unitCount?: number;
  items?: ItemType[];  // Max 3 items per unit
  archetype?: string;  // 特殊ユニットのアーキタイプ（例: meiling, sakuya, patchouli）
}

export type CommandRejectCode =
  | "LATE_INPUT"
  | "PHASE_MISMATCH"
  | "DUPLICATE_CMD"
  | "UNKNOWN_PLAYER"
  | "INVALID_PAYLOAD"
  | "INSUFFICIENT_GOLD"
  | "BENCH_FULL"
  | "INVENTORY_FULL"
  | "POOL_DEPLETED"
  | "INVALID_ARRAY"
  | "INVALID_PLACEMENT"
  | "INVALID_CELL"
  | "INVALID_UNIT_TYPE"
  | "INVALID_STAR_LEVEL"
  | "INVALID_SELL_VALUE"
  | "INVALID_UNIT_COUNT"
  | "DUPLICATE_CELL"
  | "TOO_MANY_UNITS";

export type CommandResult =
  | { accepted: true }
  | { accepted: false; code: CommandRejectCode };

export interface RoundStateMessage {
  phase: MatchPhase;
  roundIndex: number;
  phaseDeadlineAtMs: number;
  ranking: string[];
  bossPlayerId?: string;
  raidPlayerIds?: string[];
  sharedBoardAuthorityEnabled?: boolean;
  sharedBoardMode?: string;
  dominationCount?: number;

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

/**
 * shadow_diffメッセージペイロード
 * SharedBoardとの差分検知結果を配信
 */
export interface ShadowDiffMessage {
  type: "shadow_diff";
  seq: number;
  roomId: string;
  sourceVersion: number;
  ts: number;
  status: "ok" | "mismatch" | "degraded" | "unavailable";
  mismatchCount: number;
  mismatchedCells: Array<{
    combatCell: number;
    gameUnitType: string | null;
    sharedUnitType: string | null;
  }>;
}

export type AdminQueryKind =
  | "metrics"
  | "dashboard"
  | "alerts"
  | "top_errors"
  | "logs";

export interface AdminQueryMessage {
  kind: AdminQueryKind;
  correlationId?: string;
  windowMs?: number;
  limit?: number;
  thresholds?: {
    windowMs?: number;
    minEventCount?: number;
    maxFailureRate?: number;
    maxConflictRate?: number;
    maxP95LatencyMs?: number;
  };
}

export interface AdminResponseMessage {
  ok: boolean;
  kind: AdminQueryKind;
  timestamp: number;
  correlationId?: string;
  data?: unknown;
  error?: string;
}
