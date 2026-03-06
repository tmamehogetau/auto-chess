import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const manualCheckPath = resolve(process.cwd(), "src/client/manual-check.js");

describe("boss shop rendering contract", () => {
  test("boss shop cards render scarlet badge and display names", () => {
    const source = readFileSync(manualCheckPath, "utf-8");

    expect(source.includes("scarlet-badge")).toBe(true);
    expect(source.includes("SCARLET_MANSION_DISPLAY_NAMES")).toBe(true);
    expect(source.includes("紅魔館")).toBe(true);
  });

  test("boss shop cards render scarlet role and skill description", () => {
    const source = readFileSync(manualCheckPath, "utf-8");

    expect(source.includes("SCARLET_MANSION_CARD_DETAILS")).toBe(true);
    expect(source.includes("序盤の壁")).toBe(true);
    expect(source.includes("虹色太極拳")).toBe(true);
    expect(source.includes("boss-shop-role")).toBe(true);
    expect(source.includes("boss-shop-skill")).toBe(true);
  });
});
