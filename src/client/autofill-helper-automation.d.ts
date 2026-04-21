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
