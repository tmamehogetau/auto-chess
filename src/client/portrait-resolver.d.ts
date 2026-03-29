export { FRONT_PORTRAIT_BASE_PATH } from "../shared/portrait-asset-manifest.js";

export function getFrontPortraitUrlByKey(key: string | null | undefined): string | null;

export function resolveFrontPortraitUrl(
  key: string | null | undefined,
  fallbackKey?: string,
): string;

export function resolvePortraitKeyByUnitId(unitId: string | null | undefined): string | null;

export function resolveShopPortraitUrl(
  offer: {
    unitId?: string | null | undefined;
    unitType?: string | null | undefined;
    displayName?: string | null | undefined;
  } | null | undefined,
  fallbackKey?: string,
): string;

export const getShopPortraitUrl: typeof resolveShopPortraitUrl;
