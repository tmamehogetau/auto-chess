export const AUTO_FILL_BOSS_ID: string;
export const AUTO_FILL_HERO_IDS: string[];
export function normalizeAutoFillHelperPolicy(value: unknown): "strength" | "growth";
export function resolveAutoFillHelperPolicyStrategy(
  policy: unknown,
): "upgrade" | "highCost";
export function resolveAutoFillHelperStrategy(input: {
  helperIndex?: number;
  sessionId?: string | null;
  policy?: "strength" | "growth";
  strategy?: "upgrade" | "highCost";
  player?: {
    role?: string | null;
  } | null;
  state?: {
    players?:
      | Map<string, { role?: string | null }>
      | Record<string, { role?: string | null }>
      | null;
  } | null;
}): "upgrade" | "highCost";
export function resolveAutoFillHelperPlayerPhase(
  state?: {
    playerPhase?: string | null;
    playerPhaseDeadlineAtMs?: number | null;
  } | null,
  nowMs?: number,
): string;

export type OptimizationUnitEntry = {
  source?: "board" | "bench" | string | null;
  index?: number | null;
  cell?: number | null;
  unitId?: string | null;
  unitType?: string | null;
  unitLevel?: number | null;
  cost?: number | null;
  subUnit?: unknown;
};

export type OptimizationCandidate = {
  source: "board" | "bench";
  index: number | null;
  cell: number | null;
  unitId: string;
  unitType: string;
  unitName: string;
  cost: number;
  unitLevel: number;
  currentPowerScore: number;
  futureValueScore: number;
  transitionReadinessScore: number;
  protectionScore: number;
  protectionReasons: string[];
};

export type BoardRefitPlayerLike = {
  role?: string | null;
  selectedBossId?: string | null;
  selectedHeroId?: string | null;
  helperStrategy?: "upgrade" | "highCost" | string | null;
  lastBoardRefitRoundIndex?: number | null;
  boardSubUnits?: unknown[] | Iterable<unknown> | null;
  specialUnitLevel?: number | null;
  level?: number | null;
  benchUnits?: unknown[] | Iterable<unknown> | null;
  benchUnitIds?: unknown[] | Iterable<unknown> | null;
  boardUnits?:
    | Array<OptimizationUnitEntry | unknown>
    | Iterable<OptimizationUnitEntry | unknown>
    | null;
};

export type BoardRefitDecisionDiagnostic = {
  roundIndex: number | null;
  role: "boss" | "raid" | "";
  boardAtCapacity: boolean;
  boardUnitCount: number;
  benchUnitCount: number;
  benchPressure: number;
  candidateCount: number;
  outgoingCandidateCount: number;
  incomingCandidate: OptimizationCandidate | null;
  outgoingCandidate: OptimizationCandidate | null;
  replacementScore: number | null;
  committed: boolean;
  decision: "replace" | "hold" | "no_candidate";
  reason:
    | "replacement_ready"
    | "insufficient_margin"
    | "unsupported_role"
    | "open_slot_available"
    | "no_incoming_candidate"
    | "no_outgoing_candidate";
};

export function getBoardCurrentPowerScore(
  entry?: OptimizationUnitEntry | null,
  context?: {
    player?: BoardRefitPlayerLike | null;
    state?: { roundIndex?: number | null } | null;
    strategy?: "upgrade" | "highCost" | string | null;
    role?: string | null;
  } | null,
): number;

export function getFutureValueScore(
  entry?: OptimizationUnitEntry | null,
  context?: {
    player?: BoardRefitPlayerLike | null;
    state?: { roundIndex?: number | null } | null;
    strategy?: "upgrade" | "highCost" | string | null;
    role?: string | null;
  } | null,
): number;

export function getTransitionReadinessScore(
  entry?: OptimizationUnitEntry | null,
  context?: {
    player?: BoardRefitPlayerLike | null;
    state?: { roundIndex?: number | null } | null;
    strategy?: "upgrade" | "highCost" | string | null;
    role?: string | null;
  } | null,
): number;

export function getReplacementProtectionScore(
  entry?: OptimizationUnitEntry | null,
  context?: {
    player?: BoardRefitPlayerLike | null;
    state?: { roundIndex?: number | null } | null;
    strategy?: "upgrade" | "highCost" | string | null;
    role?: string | null;
  } | null,
): { score: number; reasons: string[] };

export function buildOptimizationCandidate(
  entry?: OptimizationUnitEntry | null,
  context?: {
    player?: BoardRefitPlayerLike | null;
    state?: { roundIndex?: number | null } | null;
    strategy?: "upgrade" | "highCost" | string | null;
    role?: string | null;
  } | null,
): OptimizationCandidate;

export function buildBoardRefitDecision(
  player?: BoardRefitPlayerLike | null,
  state?: { roundIndex?: number | null } | null,
  options?: { strategy?: "upgrade" | "highCost" | string | null } | null,
): BoardRefitDecisionDiagnostic;

export type BossBodyGuardDecisionDiagnostic = {
  decision: "direct_fill" | "direct_swap" | "side_flank_move" | "none";
  reason: string;
  bossCell: number | null;
  directGuardCell: number | null;
  directGuardUnitId: string | null;
  directGuardUnitName: string | null;
  directGuardUnitType: string | null;
  directGuardLevel: number | null;
  strongestGuardCell: number | null;
  strongestGuardUnitId: string | null;
  strongestGuardUnitName: string | null;
  strongestGuardUnitType: string | null;
  strongestGuardLevel: number | null;
  benchFrontlineCount: number;
  directEmpty: boolean;
  strongerOffDirect: boolean;
  actionFromCell: number | null;
  actionToCell: number | null;
};

export function buildBossBodyGuardDecisionDiagnostic(
  player?: {
    role?: string | null;
    selectedBossId?: string | null;
    benchUnits?: unknown[] | Iterable<unknown> | null;
    benchUnitIds?: unknown[] | Iterable<unknown> | null;
    boardUnits?:
      | Array<OptimizationUnitEntry | unknown>
      | Iterable<OptimizationUnitEntry | unknown>
      | null;
  } | null,
  options?: {
    state?: { roundIndex?: number | null } | null;
    roundIndex?: number | null;
    playerPhase?: string | null;
  } | null,
): BossBodyGuardDecisionDiagnostic | null;

export type OkinaHeroSubDecisionDiagnostic = {
  specialUnitStage: 1 | 4 | 7;
  candidateCount: number;
  attachedHostCell: number | null;
  currentHostUnitId: string | null;
  currentHostGain: number | null;
  bestHostCell: number | null;
  bestHostUnitId: string | null;
  bestHostUnitType: string | null;
  bestHostUnitName: string | null;
  bestHostLevel: number | null;
  bestHostOptimizationCandidate: OptimizationCandidate | null;
  bestHostGain: number | null;
  frontEquivalentValue: number;
  bestToFrontRatio: number | null;
  bestToCurrentRatio: number | null;
  decision: "attach" | "reattach" | "keep_front" | "keep_current";
  reason:
    | "attach_best_host"
    | "reattach_stronger_host"
    | "front_value_preferred"
    | "current_host_margin_preferred"
    | "current_host_only"
    | "no_candidate";
};

export function buildOkinaHeroSubDecisionDiagnostic(player?: {
  role?: string | null;
  selectedBossId?: string | null;
  selectedHeroId?: string | null;
  boardSubUnits?: unknown[] | Iterable<unknown> | null;
  specialUnitLevel?: number | null;
  level?: number | null;
  boardUnits?:
    | Array<{
        cell?: number | null;
        unitId?: string | null;
        unitType?: string | null;
        subUnit?: unknown;
        unitLevel?: number | null;
      } | unknown>
    | Iterable<{
        cell?: number | null;
        unitId?: string | null;
        unitType?: string | null;
        subUnit?: unknown;
        unitLevel?: number | null;
      } | unknown>
    | null;
} | null): OkinaHeroSubDecisionDiagnostic | null;

export type AutoFillHelperAction =
  | {
      type: "boss_preference";
      payload: { wantsBoss: boolean };
    }
  | {
      type: "boss_select";
      payload: { bossId: string };
    }
  | {
      type: "HERO_SELECT";
      payload: { heroId: string };
    }
  | {
      type: "ready";
      payload: { ready: true };
    }
  | {
      type: "prep_command";
      payload:
        | { bossShopBuySlotIndex: number }
        | { heroExclusiveShopBuySlotIndex: number }
        | { shopBuySlotIndex: number }
        | { specialUnitUpgradeCount: number }
        | { shopRefreshCount: number }
        | { benchSellIndex: number }
        | { boardSellIndex: number }
        | {
            benchToBoardCell: {
              benchIndex: number;
              cell: number;
              slot?: "sub";
            };
          };
    };

export function buildAutoFillHelperActions(input: {
  helperIndex?: number;
  heroId?: string | null;
  sessionId?: string | null;
  policy?: "strength" | "growth";
  strategy?: "upgrade" | "highCost";
  optimizationVariant?:
    | "full"
    | "raid-optimization-off"
    | "boss-optimization-off"
    | "all-optimization-off"
    | "board-refit-off"
    | "raid-board-refit-off"
    | "boss-board-refit-off"
    | "future-shop-off"
    | "okina-host-off"
    | string
    | null;
  wantsBoss?: boolean | null;
  player?: {
    isSpectator?: boolean;
    ready?: boolean;
    wantsBoss?: boolean;
    role?: string | null;
    gold?: number | null;
    lastCmdSeq?: number | null;
    selectedBossId?: string | null;
    selectedHeroId?: string | null;
    benchUnits?: unknown[] | Iterable<unknown> | null;
    benchUnitIds?: unknown[] | Iterable<unknown> | null;
    boardSubUnits?: unknown[] | Iterable<unknown> | null;
    specialUnitLevel?: number | null;
    lastBoardRefitRoundIndex?: number | null;
    level?: number | null;
    ownedUnits?: Record<string, number> | null;
    activeSynergies?:
      | Array<{ unitType?: string | null; count?: number | null; tier?: number | null } | unknown>
      | Iterable<{ unitType?: string | null; count?: number | null; tier?: number | null } | unknown>
      | null;
    boardUnits?:
      | Array<{
          cell?: number | null;
          unitId?: string | null;
          factionId?: string | null;
          subUnit?: unknown;
        } | unknown>
      | Iterable<{
          cell?: number | null;
          unitId?: string | null;
          factionId?: string | null;
          subUnit?: unknown;
        } | unknown>
      | null;
    shopOffers?:
      | Array<{ cost?: number | null; unitType?: string | null; unitId?: string | null; factionId?: string | null } | unknown>
      | Iterable<{ cost?: number | null; unitType?: string | null; unitId?: string | null; factionId?: string | null } | unknown>
      | null;
    bossShopOffers?:
      | Array<{ cost?: number | null; unitType?: string | null; unitId?: string | null; factionId?: string | null } | unknown>
      | Iterable<{ cost?: number | null; unitType?: string | null; unitId?: string | null; factionId?: string | null } | unknown>
      | null;
    heroExclusiveShopOffers?:
      | Array<{
          cost?: number | null;
          unitType?: string | null;
          unitId?: string | null;
          factionId?: string | null;
          purchased?: boolean | null;
        } | unknown>
      | Iterable<{
          cost?: number | null;
          unitType?: string | null;
          unitId?: string | null;
          factionId?: string | null;
          purchased?: boolean | null;
        } | unknown>
      | null;
  } | null;
  state?: {
    featureFlagsEnableTouhouRoster?: boolean | null;
    lobbyStage?: string | null;
    phase?: string | null;
    playerPhase?: string | null;
    roundIndex?: number | null;
    playerPhaseDeadlineAtMs?: number | null;
    players?:
      | Map<string, { role?: string | null }>
      | Record<string, { role?: string | null }>
      | null;
  } | null;
}): AutoFillHelperAction[];
