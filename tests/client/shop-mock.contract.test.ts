import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const shopMockCssPath = resolve(process.cwd(), "src/client/shop-mock.css");
const shopMockHtmlPath = resolve(process.cwd(), "src/client/shop-mock.html");
const shopMockJsPath = resolve(process.cwd(), "src/client/shop-mock.js");
const counterAssetPath = resolve(
  process.cwd(),
  "src/client/mock-assets/shop-theme-remilia-counter.svg",
);
const shelfAssetPath = resolve(
  process.cwd(),
  "src/client/mock-assets/shop-theme-remilia-shelves.svg",
);

describe("shop mock contract", () => {
  test("declares a standalone shop mock entry with theme layers", () => {
    const html = readFileSync(shopMockHtmlPath, "utf8");

    expect(html).toContain("shop-mock-app");
    expect(html).toContain("data-shop-mock-top-hud");
    expect(html).toContain("data-shop-mock-detail-wing");
    expect(html).toContain("data-shop-mock-shop-counter");
    expect(html).toContain("data-shop-mock-player-wing");
    expect(html).toContain("data-shop-mock-counter-surface");
    expect(html).toContain("data-shop-mock-shelf-layer");
    expect(html).toContain("./shop-mock.css");
    expect(html).toContain("./shop-mock.js");
  });

  test("ships purchase-specific remilia trading assets", () => {
    expect(existsSync(counterAssetPath)).toBe(true);
    expect(existsSync(shelfAssetPath)).toBe(true);

    const counterSvg = readFileSync(counterAssetPath, "utf8");
    const shelfSvg = readFileSync(shelfAssetPath, "utf8");

    expect(counterSvg).toContain('data-shop-remilia-counter="true"');
    expect(counterSvg).toContain("counterSigil");
    expect(shelfSvg).toContain('data-shop-remilia-shelves="true"');
    expect(shelfSvg).toContain("shelfGold");
  });

  test("uses fixed shop data and the shared portrait resolver", () => {
    const js = readFileSync(shopMockJsPath, "utf8");

    expect(js).toContain("const bossThemePresets");
    expect(js).toContain("remilia: {");
    expect(js).toContain("const commonOffers = [");
    expect(js).toContain("const exclusiveOffers = [");
    expect(js).toContain("const upgrades = [");
    expect(js).toContain("const benchSlots = [");
    expect(js).toContain("resolveFrontPortraitUrl");
    expect(js).toContain("shop-theme-remilia-counter.svg");
    expect(js).toContain("shop-theme-remilia-shelves.svg");
    expect(js).toContain("renderCommonShop");
    expect(js).toContain("renderExclusiveShop");
    expect(js).toContain("renderUpgradeShop");
    expect(js).toContain("renderPlayerWing");
    expect(js).toContain('title: "主人公強化"');
    expect(js).not.toContain("const allies = [");
    expect(js).not.toContain("味方情報");
    expect(js).not.toContain("古明地こいし\", hp: 100");
    expect(js).not.toContain("結界強化・壱");
  });

  test("keeps the purchase screen dense and stage-embedded instead of web-card-like", () => {
    const css = readFileSync(shopMockCssPath, "utf8");

    expect(css).toContain("min-width: 1480px;");
    expect(css).toContain(".shop-mock-trading-hall");
    expect(css).toContain("grid-template-columns: 360px 1fr 420px;");
    expect(css).toContain(".shop-mock-counter-surface");
    expect(css).toContain("var(--shop-mock-theme-counter");
    expect(css).toContain(".shop-mock-shelf-layer");
    expect(css).toContain("var(--shop-mock-theme-shelves");
    expect(css).toContain(".shop-mock-offer-plate");
    expect(css).toContain(".shop-mock-upgrade-seal");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(css).toContain(".shop-mock-detail-price");
    expect(css).toContain(".shop-mock-offer-plate.is-wide .shop-mock-offer-tags");
    expect(css).toContain("clip-path: polygon(");
    expect(css).not.toContain("border-radius: 30px;");
    expect(css).not.toContain("border-radius: 999px;");
    expect(css).not.toContain("backdrop-filter: blur");
    expect(css).not.toContain(".shop-mock-ally-panel");
  });
});
