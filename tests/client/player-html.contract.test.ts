import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const playerHtmlPath = resolve(process.cwd(), "src/client/player.html");

describe("player.html contract", () => {
  test("phase-driven player shell を持ち operator-only controls を含まない", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-player-shell",
      'data-player-phase="lobby"',
      'data-player-phase="selection"',
      'data-player-phase="prep"',
      'data-player-phase="result"',
      "data-player-status-copy",
      "data-player-connect-btn",
      "data-player-participant-summary",
      "data-player-preference-copy",
      "data-player-role-summary",
      "data-player-role-options",
      "data-player-boss-pref-on",
      "data-player-boss-pref-off",
      "data-player-hero-options",
      "data-player-boss-options",
      "data-player-prep-surface",
      "data-player-shared-board-grid",
      "data-player-shared-cell",
      "data-player-unit-shop",
      "data-player-shop-slot",
      "data-player-bench",
      "data-player-bench-slot",
      "data-player-ready-btn",
      "data-player-ready-button",
      "data-player-result-surface",
      "data-player-host-help",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }

    expect(html).toMatch(
      /data-player-phase="lobby"[\s\S]*data-player-boss-pref-on[\s\S]*data-player-ready-button/,
    );
    expect(html).not.toMatch(
      /data-player-phase="selection"[\s\S]*data-player-boss-pref-on/,
    );

    const operatorOnlyAttributes = [
      "data-endpoint-input",
      "data-room-input",
      "data-setid-select",
      "data-autofill-input",
      "data-monitor-summary",
      "data-monitor-log",
      "data-combat-log",
    ];

    for (const attribute of operatorOnlyAttributes) {
      expect(html.includes(attribute)).toBe(false);
    }
  });

  test("player-app.js を module script として読み込む", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    expect(html).toMatch(/<script\s+type="module"\s+src="\.\/player-app\.js"><\/script>/);
  });

  test("initial load では lobby 以外の phase を hidden にしておく", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    expect(html).toMatch(/data-player-phase="lobby"(?![^>]*hidden)/);
    expect(html).toMatch(/data-player-phase="selection"[^>]*hidden/);
    expect(html).toMatch(/data-player-phase="prep"[^>]*hidden/);
    expect(html).toMatch(/data-player-phase="result"[^>]*hidden/);
  });
});
