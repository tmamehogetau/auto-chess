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
      "data-shared-board-help",
      "data-shared-board-placement-guide",
      "data-shared-board-status-legend",
      "data-shared-board-own-status",
      "data-shared-board-ally-status",
      "data-shared-board-open-status",
      "data-shared-board-blocked-status",
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
    expect(html.includes("Boss Pressure Zone")).toBe(true);
    expect(html.includes("Raid Defense Zone")).toBe(true);
    expect(html.includes("Your unit")).toBe(true);
    expect(html.includes("Ally unit")).toBe(true);
    expect(html.includes("Open lane")).toBe(true);
    expect(html.includes("Blocked lane")).toBe(true);
    expect(js.includes("const readableMode = sharedBoardMode === \"half-shared\" ? \"Half Shared\"")).toBe(true);
    expect(js.includes("raidBoardModeBadge.textContent = `Mode: ${readableMode}`")).toBe(true);
    expect(js.includes("buildFinalJudgmentCopy({")).toBe(true);
    expect(js.includes("buildPhaseHpCopy(progress)")).toBe(true);
  });
});
