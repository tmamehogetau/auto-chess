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

  test("solo first-play 用に auto fill は 3 を既定値にする", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html).toMatch(/data-autofill-input[^>]*value="3"/);
  });

  test("works-version presentation shell を示す stage banner と overlay kicker を持つ", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes("Shared Battle Board")).toBe(true);
    expect(html.includes("Round Outcome")).toBe(true);
    expect(html.includes("Damage Leaders")).toBe(true);
    expect(html.includes("Boss Raid")).toBe(true);
    expect(html.includes(".shared-board-section.raid-stage")).toBe(true);
  });
});
