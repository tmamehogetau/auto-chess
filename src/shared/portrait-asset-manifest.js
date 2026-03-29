export const FRONT_PORTRAIT_BASE_PATH = "/pics/processed/front";
export const BACK_PORTRAIT_BASE_PATH = "/pics/processed/back";

const FRONT_PORTRAIT_ASSET_IDS = new Set([
  "byakuren",
  "chimata",
  "clownpiece",
  "futo",
  "hecatia",
  "ichirin",
  "junko",
  "jyoon",
  "kagerou",
  "keiki",
  "koishi",
  "marisa",
  "megumu",
  "meiling",
  "miko",
  "momoyo",
  "murasa",
  "nazrin",
  "okina",
  "patchouli",
  "reimu",
  "remilia",
  "rin",
  "sakuya",
  "satori",
  "seiga",
  "sekibanki",
  "shou",
  "tsukasa",
  "tojiko",
  "utsuho",
  "wakasagihime",
  "yoshika",
  "zanmu",
]);

export function normalizePortraitAssetId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function hasFrontPortraitAsset(value) {
  const normalizedValue = normalizePortraitAssetId(value);
  return normalizedValue.length > 0 && FRONT_PORTRAIT_ASSET_IDS.has(normalizedValue);
}

export function resolveFrontPortraitAssetId(value) {
  const normalizedValue = normalizePortraitAssetId(value);
  return hasFrontPortraitAsset(normalizedValue) ? normalizedValue : null;
}

export function getFrontPortraitUrlByAssetId(value) {
  const assetId = resolveFrontPortraitAssetId(value);
  return assetId ? `${FRONT_PORTRAIT_BASE_PATH}/${assetId}.png` : null;
}

export function listFrontPortraitAssetIds() {
  return [...FRONT_PORTRAIT_ASSET_IDS];
}
