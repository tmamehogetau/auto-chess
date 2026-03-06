import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const manualCheckPath = resolve(process.cwd(), "src/client/manual-check.js");

describe("scarlet synergy ui contract", () => {
  test("manual check renders scarlet mansion synergy label and icon", () => {
    const source = readFileSync(manualCheckPath, "utf-8");

    expect(source.includes("scarletMansion")).toBe(true);
    expect(source.includes("紅魔館")).toBe(true);
    expect(source.includes("🦇")).toBe(true);
  });

  test("manual check renders scarlet mansion synergy description", () => {
    const source = readFileSync(manualCheckPath, "utf-8");

    expect(source.includes("scarlet-synergy-description")).toBe(true);
    expect(source.includes("HP70%以上でATK+10% / 吸血")).toBe(true);
  });
});
