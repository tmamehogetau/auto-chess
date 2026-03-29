import { describe, expect, test } from "vitest";

import {
  FRONT_PORTRAIT_BASE_PATH,
  getFrontPortraitUrlByKey,
  getShopPortraitUrl,
  resolvePortraitKeyByUnitId,
  resolveFrontPortraitUrl,
} from "../../src/client/portrait-resolver.js";

describe("portrait resolver", () => {
  test("returns the processed front portrait path for a known key", () => {
    expect(getFrontPortraitUrlByKey("koishi")).toBe("/pics/processed/front/koishi.png");
  });

  test("returns null for blank keys", () => {
    expect(getFrontPortraitUrlByKey("")).toBeNull();
    expect(getFrontPortraitUrlByKey("   ")).toBeNull();
  });

  test("falls back to the configured portrait key when the primary key is missing", () => {
    expect(resolveFrontPortraitUrl("", "meiling")).toBe("/pics/processed/front/meiling.png");
  });

  test("maps known unitIds to canonical portrait asset ids", () => {
    expect(resolvePortraitKeyByUnitId("koishi")).toBe("koishi");
    expect(resolvePortraitKeyByUnitId("meiling")).toBe("meiling");
    expect(resolvePortraitKeyByUnitId("byakuren")).toBe("byakuren");
  });

  test("maps newly added unit portraits to canonical asset ids", () => {
    expect(resolvePortraitKeyByUnitId("chimata")).toBe("chimata");
    expect(resolvePortraitKeyByUnitId("megumu")).toBe("megumu");
    expect(resolvePortraitKeyByUnitId("momoyo")).toBe("momoyo");
    expect(resolvePortraitKeyByUnitId("tsukasa")).toBe("tsukasa");
  });

  test("returns a generated portrait fallback when a shop offer has no matching asset", () => {
    expect(getShopPortraitUrl({
      unitId: "shop:vanguard",
      unitType: "vanguard",
      displayName: "戦士A",
    })).toMatch(/^data:image\/svg\+xml/);
  });

  test("resolves newly added processed portrait paths for known shop offers", () => {
    expect(getShopPortraitUrl({
      unitId: "chimata",
      unitType: "mage",
      displayName: "天弓千亦",
    })).toBe("/pics/processed/front/chimata.png");
  });

  test("resolves a processed portrait path for known shop offers", () => {
    expect(getShopPortraitUrl({
      unitId: "patchouli",
      unitType: "mage",
      displayName: "パチュリー・ノーレッジ",
    })).toBe("/pics/processed/front/patchouli.png");
  });

  test("exposes the processed portrait base path as a shared constant", () => {
    expect(FRONT_PORTRAIT_BASE_PATH).toBe("/pics/processed/front");
  });
});
