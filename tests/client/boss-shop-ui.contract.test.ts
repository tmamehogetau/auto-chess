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
});
