import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const manualCheckPath = resolve(process.cwd(), "src/client/manual-check.js");
const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("scarlet synergy ui contract", () => {
  test("manual check renders scarlet mansion synergy label and icon", () => {
    const source = readFileSync(manualCheckPath, "utf-8");

    expect(source.includes("scarletMansion")).toBe(true);
    expect(source.includes("紅魔館")).toBe(true);
    expect(source.includes("🦇")).toBe(true);
  });

  test("manual check keeps remilia boss support description current", () => {
    const source = readFileSync(manualCheckPath, "utf-8");

    expect(source.includes("SCARLET_MANSION_DATA.synergyDescription")).toBe(true);
    expect(source.includes("scarlet-synergy-description")).toBe(true);
    expect(source.includes("幼きデーモンロード: 被ダメ軽減 / 高HP攻撃 / 吸血")).toBe(true);
  });

  test("scarlet mansion synergy description has dedicated styling", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes(".scarlet-synergy-description")).toBe(true);
    expect(html.includes("--scarlet-accent")).toBe(true);
    expect(html.includes("var(--scarlet-accent-soft)")).toBe(true);
  });

  test("manual check uses consolidated scarlet mansion data object", () => {
    const source = readFileSync(manualCheckPath, "utf-8");

    expect(source.includes("SCARLET_MANSION_DATA")).toBe(true);
  });
});
