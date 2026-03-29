export const FRONT_PORTRAIT_BASE_PATH: "/pics/processed/front";
export const BACK_PORTRAIT_BASE_PATH: "/pics/processed/back";

export function normalizePortraitAssetId(value: string | null | undefined): string;
export function hasFrontPortraitAsset(value: string | null | undefined): boolean;
export function resolveFrontPortraitAssetId(value: string | null | undefined): string | null;
export function getFrontPortraitUrlByAssetId(value: string | null | undefined): string | null;
export function listFrontPortraitAssetIds(): string[];
