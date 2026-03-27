export const AUTO_FILL_BOSS_ID: string;
export const AUTO_FILL_HERO_IDS: string[];

export type AutoFillHelperAction =
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
        | { shopBuySlotIndex: number }
        | {
            benchToBoardCell: {
              benchIndex: number;
              cell: number;
            };
          };
    };

export function buildAutoFillHelperActions(input: {
  helperIndex?: number;
  player?: {
    isSpectator?: boolean;
    ready?: boolean;
    role?: string | null;
    gold?: number | null;
    selectedBossId?: string | null;
    selectedHeroId?: string | null;
    benchUnits?: unknown[] | Iterable<unknown> | null;
    boardUnits?: unknown[] | Iterable<unknown> | null;
    shopOffers?:
      | Array<{ cost?: number | null; unitType?: string | null } | unknown>
      | Iterable<{ cost?: number | null; unitType?: string | null } | unknown>
      | null;
    bossShopOffers?:
      | Array<{ cost?: number | null; unitType?: string | null } | unknown>
      | Iterable<{ cost?: number | null; unitType?: string | null } | unknown>
      | null;
  } | null;
  state?: {
    lobbyStage?: string | null;
    phase?: string | null;
  } | null;
}): AutoFillHelperAction[];
