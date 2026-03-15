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
      "data-ready-btn",
      "data-shared-board-section",
      "data-shared-board-grid",
      "data-shared-cursor-list",
      "data-unit-shop",
      "data-shop-slot",
      "data-item-shop",
      "data-item-shop-slot",
      "data-board-row-back",
      "data-board-row-front",
      "data-board-cell",
      "data-sell-btn",
      "data-refresh-shop-btn",
      "data-buy-xp-btn",
      "data-bench",
      "data-bench-slot",
      "data-inventory",
      "data-inv-slot",
      "data-combat-log",
      "data-monitor-summary",
      "data-monitor-shadow-details",
      "data-message-bar",
      "data-selection-mode",
      "data-round-summary-overlay",
      "data-round-summary-round",
      "data-round-summary-list",
      "data-round-summary-close",
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
});
