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
    const prepSection = extractPhaseSection(html, "prep");

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
      "data-player-room-code-input",
      "data-player-connect-btn",
      "data-player-room-summary",
      "data-player-room-copy",
      "data-player-deadline-summary",
      "data-player-deadline-copy",
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
      "data-player-shop-refresh-button",
      "data-player-buy-xp-button",
      "data-player-boss-shop",
      "data-player-boss-shop-slot",
      "data-player-special-unit-card",
      "data-player-special-unit-copy",
      "data-player-spell-card",
      "data-player-spell-copy",
      "data-player-synergy-card",
      "data-player-synergy-copy",
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
    expect(lobbySection.includes("data-player-ready-button")).toBe(false);
    expect(selectionSection.includes("data-player-boss-pref-on")).toBe(false);
    expect(prepSection.includes("data-player-ready-button")).toBe(false);

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

  test("ready controls stay outside lobby-only section so prep can still finish from the player shell", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const lobbySection = extractPhaseSection(html, "lobby");
    const shellHeaderMatch = html.match(
      /<header class="[^"]*\bplayer-shell-header\b[^"]*">[\s\S]*?<\/header>/,
    );

    expect(shellHeaderMatch?.[0]?.includes("data-player-ready-btn")).toBe(true);
    expect(shellHeaderMatch?.[0]?.includes("data-player-ready-button")).toBe(true);
    expect(lobbySection.includes("data-player-ready-btn")).toBe(false);
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
      'aria-label="Board cell 35"',
      'aria-label="Shop slot 0"',
      'aria-label="Boss shop slot 0"',
      'aria-label="Bench slot 0"',
      'data-player-board-sell-button',
      'data-player-bench-sell-button',
      'data-player-board-return-button',
      'placeholder="Room code"',
      'data-player-connect-btn',
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }

    expect(html).toMatch(/<button[^>]*(?:data-player-connect-btn[^>]*disabled|disabled[^>]*data-player-connect-btn)[^>]*>/);
  });

  test("player prep shell seeds a 6x6 shared-board placeholder without legacy 4x2 copy", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const sharedCellCount = (html.match(/data-player-shared-cell="/g) ?? []).length;

    expect(sharedCellCount).toBe(36);
    expect(html.includes("center 4x2")).toBe(false);
    expect(html.includes("中央 4x2")).toBe(false);
    expect(html.includes("open lane")).toBe(false);
    expect(html.includes("Boss は上半分、raid は下半分の配置セルを使います。")).toBe(true);
    expect(html.includes("highlighted raid cells")).toBe(false);
  });

  test("shared phase shell uses 3-column rails and dedicated purchase/deploy surfaces", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const prepSection = extractPhaseSection(html, "prep");

    const requiredAttributes = [
      "data-player-phase-shell",
      "data-player-left-rail",
      "data-player-center-rail",
      "data-player-right-rail",
      "data-player-phase-surface",
      "data-player-purchase-surface",
      "data-player-purchase-shop",
      "data-player-deploy-surface",
      "data-player-deploy-board",
    ];

    for (const attribute of requiredAttributes) {
      expect(prepSection.includes(attribute)).toBe(true);
    }
  });

  test("purchase phase shop is split into four named vertical sections", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const prepSection = extractPhaseSection(html, "prep");

    const requiredAttributes = [
      'data-player-purchase-section="common-units"',
      'data-player-purchase-section="dedicated-units"',
      'data-player-purchase-section="hero-upgrade"',
      'data-player-purchase-section="refresh"',
      "data-player-hero-upgrade-copy",
      "data-player-refresh-copy",
    ];

    for (const attribute of requiredAttributes) {
      expect(prepSection.includes(attribute)).toBe(true);
    }

    expect(prepSection.includes(">共通ユニット<")).toBe(true);
    expect(prepSection.includes(">専用ユニット<")).toBe(true);
    expect(prepSection.includes(">主人公強化<")).toBe(true);
    expect(prepSection.includes(">リロード<")).toBe(true);
  });

  test("battle start banner placeholder is declared only once in the prep shell", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const bannerCount = (html.match(/data-player-battle-start-banner/g) ?? []).length;

    expect(bannerCount).toBe(1);
    expect(extractPhaseSection(html, "prep").includes("data-player-battle-start-banner")).toBe(true);
    expect(extractPhaseSection(html, "result").includes("data-player-battle-start-banner")).toBe(false);
  });
});
