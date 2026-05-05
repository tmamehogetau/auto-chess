import {
  FRONT_PORTRAIT_BASE_PATH,
  getFrontPortraitUrlByAssetId,
  resolveFrontPortraitAssetId,
} from "../shared/portrait-asset-manifest.js";

export { FRONT_PORTRAIT_BASE_PATH };

const SHOP_FALLBACK_PORTRAIT_BY_TYPE = {
  vanguard: "meiling",
  ranger: "marisa",
  mage: "patchouli",
  assassin: "sakuya",
  hero: "reimu",
};

export function getFrontPortraitUrlByKey(key) {
  return getFrontPortraitUrlByAssetId(key);
}

export function resolveFrontPortraitUrl(key, fallbackKey = "meiling") {
  return getFrontPortraitUrlByKey(key)
    ?? getFrontPortraitUrlByKey(fallbackKey)
    ?? `${FRONT_PORTRAIT_BASE_PATH}/meiling.png`;
}

export function resolvePortraitKeyByUnitId(unitId) {
  return resolveFrontPortraitAssetId(unitId);
}

function resolveShopPortraitFallbackUrl(unitType, fallbackKey) {
  const normalizedUnitType = typeof unitType === "string" ? unitType.trim().toLowerCase() : "";
  return resolveFrontPortraitUrl(SHOP_FALLBACK_PORTRAIT_BY_TYPE[normalizedUnitType] ?? fallbackKey, fallbackKey);
}

export function resolveShopPortraitUrl(offer, fallbackKey = "meiling") {
  const portraitKey = resolvePortraitKeyByUnitId(offer?.unitId);
  if (portraitKey) {
    return resolveFrontPortraitUrl(portraitKey, fallbackKey);
  }

  return resolveShopPortraitFallbackUrl(offer?.unitType, fallbackKey);
}

export const getShopPortraitUrl = resolveShopPortraitUrl;
