import {
  FRONT_PORTRAIT_BASE_PATH,
  getFrontPortraitUrlByAssetId,
  resolveFrontPortraitAssetId,
} from "../shared/portrait-asset-manifest.js";

export { FRONT_PORTRAIT_BASE_PATH };

const SHOP_FALLBACK_LABEL_BY_TYPE = {
  vanguard: "VG",
  ranger: "RG",
  mage: "MG",
  assassin: "AS",
};

const SHOP_FALLBACK_BG_BY_TYPE = {
  vanguard: "#7f5539",
  ranger: "#2a9d8f",
  mage: "#3d5a80",
  assassin: "#7b2cbf",
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

function buildShopPortraitFallbackUrl(unitType) {
  const normalizedUnitType = typeof unitType === "string" ? unitType.trim().toLowerCase() : "";
  const label = SHOP_FALLBACK_LABEL_BY_TYPE[normalizedUnitType] ?? "??";
  const background = SHOP_FALLBACK_BG_BY_TYPE[normalizedUnitType] ?? "#4a5568";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="${background}"/><rect x="8" y="8" width="80" height="80" rx="14" fill="rgba(255,255,255,0.08)"/><text x="48" y="57" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#f8fafc">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveShopPortraitUrl(offer, fallbackKey = "meiling") {
  const portraitKey = resolvePortraitKeyByUnitId(offer?.unitId);
  if (portraitKey) {
    return resolveFrontPortraitUrl(portraitKey, fallbackKey);
  }

  return buildShopPortraitFallbackUrl(offer?.unitType);
}

export const getShopPortraitUrl = resolveShopPortraitUrl;
