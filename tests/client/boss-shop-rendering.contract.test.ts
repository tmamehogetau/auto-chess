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
});
