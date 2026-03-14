import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");
const manualCheckPath = resolve(process.cwd(), "src/client/manual-check.js");

describe("raid board ui contract", () => {
  test("shared board shows boss top half and raid bottom half", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-raid-board-header",
      "data-raid-board-mode-badge",
      "data-raid-board-boss-label",
      "data-raid-board-raid-label",
      "data-raid-board-zone-legend",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }
  });

  test("battle and result reuse the same board presentation", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");
    const js = readFileSync(manualCheckPath, "utf-8");

    expect(html.includes("data-shared-board-section")).toBe(true);
    expect(html.includes("data-local-board-section")).toBe(false);
    expect(js.includes("updateRaidBoardPresentation(")).toBe(true);
    expect(js.includes("hideSharedBoardDuringBattle")).toBe(false);
  });

  test("raid board presentation publishes readable mode and final judgment labels", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");
    const js = readFileSync(manualCheckPath, "utf-8");

    expect(html.includes("lives-label")).toBe(true);
    expect(html.includes("boss-victory")).toBe(true);
    expect(html.includes("raid-victory")).toBe(true);
    expect(html.includes("mode-badge")).toBe(true);
    expect(js.includes("const readableMode = sharedBoardMode === \"half-shared\" ? \"Half Shared\"")).toBe(true);
    expect(js.includes("raidBoardModeBadge.textContent = `Mode: ${readableMode}`")).toBe(true);
    expect(js.includes('Final Judgment: ${isBossVictory ? "Boss Victory" : "Raid Victory"}')).toBe(true);
    expect(js.includes('Final Judgment: Pending')).toBe(true);
    expect(js.includes("HP remaining")).toBe(true);
    expect(js.includes("% completed")).toBe(true);
    expect(js.includes("Round ${Number.isFinite(roundIndex) ? roundIndex + 1 : 1}")).toBe(true);
  });
});
