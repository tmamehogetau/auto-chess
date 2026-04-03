import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("index.html contract", () => {
  test("現在のUIで必要なdata属性を保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-endpoint-input",
      "data-room-input",
      "data-room-code-input",
      "data-room-code-output",
      "data-setid-select",
      "data-autofill-input",
      "data-connect-button",
      "data-leave-button",
      "data-connection-guide",
      "data-game-container",
      "data-round-display",
      "data-gold-display",
      "data-hp-display",
      "data-level-display",
      "data-xp-display",
      "data-phase-display",
      "data-ready-count",
      "data-phase-hp-section",
      "data-phase-hp-value",
      "data-phase-hp-fill",
      "data-phase-hp-result",
      "data-phase-hp-help",
      "data-ready-btn",
      "data-ready-hint",
      "data-boss-preference-toggle",
      "data-boss-preference-summary",
      "data-boss-preference-list",
      "data-boss-role-copy",
      "data-shared-board-section",
      "data-shared-board-grid",
      "data-shared-board-help",
      "data-shared-board-placement-guide",
      "data-shared-board-status-legend",
      "data-shared-board-own-status",
      "data-shared-board-ally-status",
      "data-shared-board-open-status",
      "data-shared-board-blocked-status",
      "data-shared-board-stage-banner",
      "data-shared-board-stage-tag",
      "data-shared-board-stage-copy",
      "data-shared-cursor-list",
      "data-unit-shop",
      "data-shop-slot",
      "data-sell-btn",
      "data-refresh-shop-btn",
      "data-buy-xp-btn",
      "data-bench",
      "data-bench-slot",
      "data-combat-log",
      "data-monitor-summary",
      "data-monitor-shadow-details",
      "data-monitor-player-snapshot",
      "data-message-bar",
      "data-selection-mode",
      "data-entry-flow-status",
      "data-round-summary-overlay",
      "data-round-summary-kicker",
      "data-round-summary-round",
      "data-round-summary-caption",
      "data-round-summary-tip",
      "data-round-summary-list",
      "data-round-summary-close",
      "data-battle-result-subtitle",
      "data-battle-result-kicker",
      "data-battle-result-hint",
      "data-battle-start-kicker",
      "data-hero-selection-kicker",
      "data-boss-selection-overlay",
      "data-boss-selection-card",
      "data-boss-selection-portrait",
      "data-boss-selection-name",
      "data-boss-selection-role-copy",
      "data-boss-confirm-btn",
      "data-set-id-display",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }
  });

  test("manual-check.jsをmodule scriptとして読み込む", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html).toMatch(/<script\s+type="module"\s+src="\.\/manual-check\.js"><\/script>/);
  });

  test("setId表示の初期値はハイフン", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html).toMatch(/data-set-id-display>-<\/strong>/);
  });

  test("solo first-play 用でも auto fill は 0 を既定値にする", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html).toMatch(/data-autofill-input[^>]*value="0"/);
  });

  test("works-version presentation shell を示す stage banner と overlay kicker を持つ", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes("Shared Battle Board")).toBe(true);
    expect(html.includes("Round Outcome")).toBe(true);
    expect(html.includes("Damage Leaders")).toBe(true);
    expect(html.includes("Boss Raid")).toBe(true);
    expect(html.includes(".shared-board-section.raid-stage")).toBe(true);
  });

  test("legacy local board shell and styling are removed from the operator page", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes(".board-section {")).toBe(false);
    expect(html.includes(".board-grid {")).toBe(false);
    expect(html.includes(".board-cell {")).toBe(false);
    expect(html.includes(".board-cell .unit-icon {")).toBe(false);
    expect(html.includes(".board-section.battle-start")).toBe(false);
    expect(html.includes("data-board-cell")).toBe(false);
    expect(html.includes("data-local-board-section")).toBe(false);
  });

  test("operator shared-board copy is aligned to the 6x6 live battle spec", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes("Shared Battle Board (6 x 6)")).toBe(true);
    expect(html.includes("Boss deploys on the upper half, raid deploys on the lower half, and both sides can invade freely once Battle starts.")).toBe(true);
    expect(html.includes("Active cell")).toBe(true);
    expect(html.includes("Inactive cell")).toBe(true);
    expect(html.includes("boss lane")).toBe(false);
    expect(html.includes("raid line")).toBe(false);
    expect(html.includes("Open lane")).toBe(false);
    expect(html.includes("Blocked lane")).toBe(false);
  });

  test("operator shell として tester を player.html へ誘導する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes("Operator Console")).toBe(true);
    expect(html.includes("data-operator-guide")).toBe(true);
    expect(html.includes("./player.html")).toBe(true);
  });

  test("room code controls は accessible copy を持つ", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes('data-room-code-input')).toBe(true);
    expect(html.includes('aria-label="Room code"')).toBe(true);
    expect(html.includes('data-room-code-output aria-live="polite"')).toBe(true);
  });

  test("operator autofill は real player join を妨げない default になっている", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes('data-autofill-input type="number" min="0" max="3" value="0"')).toBe(true);
  });

  test("operator shared-board shell fixes board and guide dimensions to avoid layout jumps", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes("--shared-board-columns: 6;")).toBe(true);
    expect(html.includes("--shared-board-rows: 6;")).toBe(true);
    expect(html.includes("grid-template-rows: repeat(var(--shared-board-rows, 6), minmax(0, 1fr));")).toBe(true);
    expect(html.includes("aspect-ratio: var(--shared-board-columns, 6) / var(--shared-board-rows, 6);")).toBe(true);
    expect(html.includes("--shared-board-guide-lines: 3;")).toBe(true);
    expect(html.includes("height: calc(1.45em * var(--shared-board-guide-lines));")).toBe(true);
    expect(html.includes("overflow-y: auto;")).toBe(true);
  });
});
