import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("index.html contract", () => {
  test("現在のUIで必要なdata属性を保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    const requiredAttributes = [
      // Connection panel
      "data-endpoint-input",
      "data-room-input",
      "data-setid-select",
      "data-autofill-input",
      "data-connect-button",
      "data-leave-button",
      // Game container
      "data-game-container",
      // Status bar
      "data-round-display",
      "data-gold-display",
      "data-hp-display",
      "data-level-display",
      "data-xp-display",
      "data-phase-display",
      "data-ready-count",
      // Phase HP (Week3)
      "data-phase-hp-section",
      "data-phase-hp-value",
      "data-phase-hp-fill",
      "data-phase-hp-result",
      // Ready button
      "data-ready-btn",
      // Shared board (Week3)
      "data-shared-board-section",
      "data-shared-board-grid",
      "data-shared-cursor-list",
      // Shop
      "data-unit-shop",
      "data-shop-slot",
      "data-item-shop",
      "data-item-shop-slot",
      // Board
      "data-board-row-back",
      "data-board-row-front",
      "data-board-cell",
      // Action buttons
      "data-sell-btn",
      "data-refresh-shop-btn",
      "data-buy-xp-btn",
      // Bench
      "data-bench",
      "data-bench-slot",
      // Inventory
      "data-inventory",
      "data-inv-slot",
      // Combat log
      "data-combat-log",
      // Message bar
      "data-message-bar",
      // Selection mode
      "data-selection-mode",
      // Round summary (Week3)
      "data-round-summary-overlay",
      "data-round-summary-round",
      "data-round-summary-list",
      "data-round-summary-close",
      // Set ID display (for test compatibility)
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
