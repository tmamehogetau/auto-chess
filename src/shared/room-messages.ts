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
}

export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type UnitEffectSetId = "set1" | "set2";

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
  | "BENCH_FULL";

export type CommandResult =
  | { accepted: true }
  | { accepted: false; code: CommandRejectCode };

export interface RoundStateMessage {
  phase: MatchPhase;
  roundIndex: number;
  phaseDeadlineAtMs: number;
  ranking: string[];
}
