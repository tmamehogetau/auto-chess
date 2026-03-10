import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("boss shop ui contract", () => {
  test("boss専用ショップの識別用属性とラベルを保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes("data-boss-shop-section")).toBe(true);
    expect(html.includes("data-boss-shop-title")).toBe(true);
    expect(html.includes('aria-label="Boss Exclusive Shop"')).toBe(true);
    expect(html.includes("data-boss-shop-slot=\"0\"")).toBe(true);
    expect(html.includes("data-boss-shop-slot=\"1\"")).toBe(true);
    expect(html.includes("Boss Exclusive")).toBe(true);
  });

  test("boss専用ショップの2スロットが同じセクション内に並ぶ", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(
      /data-boss-shop-section[\s\S]*data-boss-shop-slot="0"[\s\S]*data-boss-shop-slot="1"/.test(html),
    ).toBe(true);
  });

  test("boss専用ショップのグリッドがセクション内に配置される", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    // data-boss-shop-section の中に data-boss-shop-grid が含まれているか
    expect(
      /data-boss-shop-section[^>]*>[\s\S]*?<[^>]*data-boss-shop-grid/.test(html),
    ).toBe(true);
  });

  test("boss専用ショップカードが visual badge と sold state 用のクラスを保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes("boss-exclusive")).toBe(true);
    expect(html.includes("boss-shop-badge")).toBe(true);
    expect(html.includes("EXCLUSIVE")).toBe(true);
    expect(html.includes("is-purchased")).toBe(true);
    expect(html.includes("boss-shop-sold")).toBe(true);
    expect(html.includes("SOLD")).toBe(true);
  });
});
