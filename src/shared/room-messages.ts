import type { TouhouFactionId } from '../data/touhou-units';
import type { BossCharacterId } from './boss-characters';
import type { UnitId } from './types';

export const CLIENT_MESSAGE_TYPES = {
  READY: "ready",
  PREP_COMMAND: "prep_command",
  ADMIN_QUERY: "admin_query",
  BOSS_PREFERENCE: "boss_preference",
  BOSS_SELECT: "boss_select",
  HERO_SELECT: "HERO_SELECT",
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

export type PlayerFacingPhase =
  | "lobby"
  | "selection"
  | "purchase"
  | "deploy"
  | "battle"
  | "result";

export interface ReadyMessage {
  ready?: boolean;
}

export interface BossPreferenceMessage {
  wantsBoss: boolean;
}

export interface BossSelectMessage {
  bossId: BossCharacterId;
}

export interface PrepCommandMessage {
  cmdSeq: number;
  correlationId?: string;
  boardUnitCount?: number;
  boardPlacements?: BoardUnitPlacement[];
  heroPlacementCell?: number;
  xpPurchaseCount?: number;
  shopRefreshCount?: number;
  shopBuySlotIndex?: number;
  shopLock?: boolean;
  benchToBoardCell?: {
    benchIndex: number;
    cell: number;
    slot?: "main" | "sub";
  };
  boardToBenchCell?: {
    cell: number;
  };
  boardUnitMove?: {
    fromCell: number;
    toCell: number;
    slot?: "main" | "sub";
  };
  subUnitToBenchCell?: {
    cell: number;
  };
  subUnitMove?: {
    fromCell: number;
    toCell: number;
    slot?: "main" | "sub";
  };
  subUnitSwapBench?: {
    cell: number;
    benchIndex: number;
  };
  benchSellIndex?: number;
  boardSellIndex?: number;
  mergeUnits?: {
    unitType: string;
    starLevel: number;
    benchIndices?: number[];
    boardCells?: number[];
  };
  bossShopBuySlotIndex?: number;       // Buy unit from boss shop
}

export type BoardUnitType = "vanguard" | "ranger" | "mage" | "assassin";

export type UnitEffectSetId = "set1" | "set2";

export interface AttachedSubUnitPlacement {
  unitType: BoardUnitType;
  unitId?: UnitId;
  factionId?: TouhouFactionId | null;
  starLevel?: number;
  sellValue?: number;
  unitCount?: number;
  archetype?: string;
}

export interface BoardUnitPlacement {
  cell: number;
  ownerPlayerId?: string;
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
  archetype?: string;  // 特殊ユニットのアーキタイプ（例: meiling, sakuya, patchouli）
  subUnit?: AttachedSubUnitPlacement;
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
  playerPhase?: PlayerFacingPhase | undefined;
  roundIndex: number;
  phaseDeadlineAtMs: number;
  playerPhaseDeadlineAtMs?: number | undefined;
  sharedBoardRoomId?: string;
  lobbyStage?: "preference" | "selection" | "started";
  selectionDeadlineAtMs?: number;
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
    survivorSnapshots?: Array<{
      unitId: string;
      displayName: string;
      unitType: string;
      hp: number;
      maxHp: number;
      sharedBoardCellIndex: number;
    }>;
  };

  // Active synergies for this player
  activeSynergies?: {
    unitType: string;
    count: number;
    tier: number;  // 0, 1, 2, or 3
  }[];
}

export interface ShopOfferMessage {
  cost: number;
  displayName?: string;
  factionId?: string | null;
  isRumorUnit?: boolean;
  purchased?: boolean;
  rarity: number;
  starLevel?: number;
  unitId?: string;
  unitType: string;
}

export interface OwnedUnitsMessage {
  assassin: number;
  mage: number;
  ranger: number;
  vanguard: number;
  [key: string]: number;
}

export interface PlayerMatchStatus {
  hp: number;
  eliminated: boolean;
  boardUnitCount: number;
  gold: number;
  xp: number;
  level: number;
  shopOffers: ShopOfferMessage[];
  shopLocked: boolean;
  benchUnits: string[];
  benchUnitIds?: string[];
  benchDisplayNames?: string[];
  boardUnits: string[];
  boardSubUnits?: string[];
  ownedUnits: OwnedUnitsMessage;
  lastBattleResult?: {
    opponentId: string;
    won: boolean;
    damageDealt: number;
    damageTaken: number;
    survivors: number;
    opponentSurvivors: number;
    survivorSnapshots?: Array<{
      unitId: string;
      displayName: string;
      unitType: string;
      hp: number;
      maxHp: number;
      sharedBoardCellIndex: number;
    }>;
  };
  activeSynergies?: {
    unitType: string;
    count: number;
    tier: number;
  }[];
}

export type BattleTimelineSide = "boss" | "raid";

export type BattleTimelineWinner = BattleTimelineSide | "draw";

export interface BattleTimelineBoardConfig {
  width: number;
  height: number;
}

export interface BattleStartUnitSnapshot {
  battleUnitId: string;
  ownerPlayerId?: string;
  sourceUnitId?: string;
  side: BattleTimelineSide;
  x: number;
  y: number;
  currentHp: number;
  maxHp: number;
  displayName?: string;
  portraitKey?: string;
}

export interface BattleKeyframeUnitState {
  battleUnitId: string;
  x: number;
  y: number;
  currentHp: number;
  maxHp: number;
  alive: boolean;
  state: "idle" | "moving" | "attacking" | "dead";
}

export interface BattleStartEvent {
  type: "battleStart";
  battleId: string;
  round: number;
  boardConfig: BattleTimelineBoardConfig;
  units: BattleStartUnitSnapshot[];
}

export interface MoveEvent {
  type: "move";
  battleId: string;
  atMs: number;
  battleUnitId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface AttackStartEvent {
  type: "attackStart";
  battleId: string;
  atMs: number;
  sourceBattleUnitId: string;
  targetBattleUnitId: string;
}

export interface DamageAppliedEvent {
  type: "damageApplied";
  battleId: string;
  atMs: number;
  sourceBattleUnitId: string;
  targetBattleUnitId: string;
  amount: number;
  remainingHp: number;
}

export interface UnitDeathEvent {
  type: "unitDeath";
  battleId: string;
  atMs: number;
  battleUnitId: string;
}

export interface KeyframeEvent {
  type: "keyframe";
  battleId: string;
  atMs: number;
  units: BattleKeyframeUnitState[];
}

export interface BattleEndEvent {
  type: "battleEnd";
  battleId: string;
  atMs: number;
  winner: BattleTimelineWinner;
}

export type BattleTimelineEvent =
  | BattleStartEvent
  | MoveEvent
  | AttackStartEvent
  | DamageAppliedEvent
  | UnitDeathEvent
  | KeyframeEvent
  | BattleEndEvent;

export type BattleTimelineEventType = BattleTimelineEvent["type"];

export interface SharedBattleReplayMessage {
  type: "shared_battle_replay";
  battleId: string;
  phase: MatchPhase;
  timeline: BattleTimelineEvent[];
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
    sharedBoardCellIndex: number;
    gameUnitType: string | null;
    sharedUnitType: string | null;
  }>;
}

export type AdminQueryKind =
  | "metrics"
  | "dashboard"
  | "alerts"
  | "top_errors"
  | "logs"
  | "player_snapshot";

export interface AdminPlayerSnapshot {
  sessionId: string;
  name: string;
  role: "unassigned" | "raid" | "boss" | "spectator";
  ready: boolean;
  connected: boolean;
  isSpectator: boolean;
  wantsBoss: boolean;
  gold: number;
  boardUnitCount: number;
  benchUnits: string[];
  selectedHeroId: string | null;
  selectedBossId: string | null;
}

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
