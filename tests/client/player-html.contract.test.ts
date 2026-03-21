import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const playerHtmlPath = resolve(process.cwd(), "src/client/player.html");

function extractPhaseSection(html: string, phaseName: string): string {
  const match = html.match(
    new RegExp(`<section[^>]*data-player-phase="${phaseName}"[^>]*>[\\s\\S]*?<\\/section>`),
  );

  if (!match?.[0]) {
    throw new Error(`Missing phase section: ${phaseName}`);
  }

  return match[0];
}

describe("player.html contract", () => {
  test("phase-driven player shell を持ち operator-only controls を含まない", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const lobbySection = extractPhaseSection(html, "lobby");
    const selectionSection = extractPhaseSection(html, "selection");

    const requiredAttributes = [
      "data-player-shell",
      'data-player-phase="lobby"',
      'data-player-phase="selection"',
      'data-player-phase="prep"',
      'data-player-phase="result"',
      "data-player-battle-start-banner",
      "data-player-battle-start-kicker",
      "data-player-battle-start-round",
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
      "data-player-bench-sell-button",
      "data-player-board-sell-button",
      "data-player-board-return-button",
      "data-player-ready-btn",
      "data-player-ready-button",
      "data-player-result-surface",
      "data-player-host-help",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }

    expect(lobbySection.includes("data-player-boss-pref-on")).toBe(true);
    expect(lobbySection.includes("data-player-ready-button")).toBe(true);
    expect(selectionSection.includes("data-player-boss-pref-on")).toBe(false);

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
    const lobbySection = extractPhaseSection(html, "lobby");
    const selectionSection = extractPhaseSection(html, "selection");
    const prepSection = extractPhaseSection(html, "prep");
    const resultSection = extractPhaseSection(html, "result");

    expect(lobbySection).not.toMatch(/data-player-phase="lobby"[^>]*hidden/);
    expect(selectionSection).toMatch(/data-player-phase="selection"[^>]*hidden/);
    expect(prepSection).toMatch(/data-player-phase="prep"[^>]*hidden/);
    expect(resultSection).toMatch(/data-player-phase="result"[^>]*hidden/);
  });

  test("player prep shell も shared-board help と status legend を持つ", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-shared-board-help",
      "data-shared-board-placement-guide",
      "data-shared-board-status-legend",
      "data-shared-board-own-status",
      "data-shared-board-ally-status",
      "data-shared-board-open-status",
      "data-shared-board-blocked-status",
      'aria-label="Board cell 0"',
      'aria-label="Shop slot 0"',
      'aria-label="Bench slot 0"',
      'data-player-board-sell-button',
      'data-player-bench-sell-button',
      'data-player-board-return-button',
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }
  });
});
