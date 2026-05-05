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
  test("player title screen uses the decided game title", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    expect(html.includes('<base href="/src/client/" />')).toBe(true);
    expect(html.includes("<title>東方盤上演 ～ Incident Re:Stage ～</title>")).toBe(true);
    expect(html.includes('<h1 class="player-title">東方盤上演</h1>')).toBe(true);
    expect(html.includes('<p class="player-phase-tag">Incident Re:Stage</p>')).toBe(true);
    expect(html.includes("title-stage-board-remilia-v3.png")).toBe(true);
    expect(html.includes("title-stage-board-yuyuko.png")).toBe(true);
    expect(html.includes("title-logo-touhou-banjouen-generated-custom-v2.png")).toBe(true);
    expect(html.includes('class="player-title-command-logo"')).toBe(true);
    expect(html.includes('alt="東方盤上演 Incident Re:Stage"')).toBe(true);
    expect(html.includes("Co-op Board Raid")).toBe(false);
    expect(html.includes("player-title-command-subtitle")).toBe(false);
    expect(html.includes("title-panel-yuyuko-frame-v1.png")).toBe(true);
    expect(html.includes("aspect-ratio: 3 / 2")).toBe(true);
    expect(html.includes("--title-command-content-y: 4px")).toBe(true);
    expect(html.includes("--title-panel-art")).toBe(true);
    expect(html.includes("--title-action-art")).toBe(true);
    expect(html.includes("--title-stage-ornaments")).toBe(true);
    expect(html.includes("--title-stage-ornaments: none")).toBe(true);
    expect(html.includes("--title-hero-art-scale")).toBe(true);
    expect(html.includes("--title-boss-art-scale")).toBe(true);
    expect(html.includes("--title-hero-art-side")).toBe(true);
    expect(html.includes("--title-boss-art-side")).toBe(true);
    expect(html.includes("--title-boss-art-y")).toBe(true);
    expect(html.includes('data-title-hero-id="jyoon"')).toBe(true);
    expect(html.includes('data-title-boss-id="yuyuko"')).toBe(true);
    expect(html.includes("player-title-hero-is-fading")).toBe(true);
    expect(html.includes("player-title-boss-is-fading")).toBe(true);
    expect(html.includes("player-title-bg-is-fading")).toBe(true);
    expect(html.includes("player-title-command-theme")).toBe(true);
    expect(html.includes(".player-shell.player-title-bg-is-fading .player-title-command-theme")).toBe(true);
    expect(html.includes('[data-title-boss-theme="yuyuko"] .player-title-command::before')).toBe(true);
    expect(html.includes('[data-title-boss-theme="yuyuko"] .player-title-command::after')).toBe(true);
    expect(html.includes("player-title-effects")).toBe(true);
    expect(html.includes('[data-title-boss-theme="remilia"] .player-title-effects')).toBe(true);
    expect(html.includes("player-title-effect-petals")).toBe(true);
    expect(html.includes("player-title-effect-snow")).toBe(true);
    expect(html.includes("player-title-effect-spirits")).toBe(true);
    expect(html.includes("title-remilia-crimson-mist")).toBe(true);
    expect(html.includes("title-remilia-moon-pulse")).toBe(true);
    expect(html.includes("title-remilia-wing-shadows")).toBe(true);
    expect(html.includes("title-panel-yuyuko-frame-v1.png")).toBe(true);
    expect(html.includes("prefers-reduced-motion: reduce")).toBe(true);
  });

  test("phase-driven player shell を持ち operator-only controls を含まない", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const lobbySection = extractPhaseSection(html, "lobby");
    const selectionSection = extractPhaseSection(html, "selection");
    const prepSection = extractPhaseSection(html, "prep");

    const requiredAttributes = [
      "data-player-shell",
      'data-player-phase="title"',
      'data-player-phase="lobby"',
      'data-player-phase="selection"',
      'data-player-phase="prep"',
      'data-player-phase="result"',
      "data-player-battle-start-banner",
      "data-player-battle-start-kicker",
      "data-player-battle-start-round",
      "data-player-status-copy",
      "data-player-room-code-input",
      "data-player-name-input",
      "data-player-connect-btn",
      "data-player-create-room-btn",
      "data-player-title-screen",
      "data-title-stage",
      "data-title-hero-art",
      "data-title-boss-art",
      "data-player-room-copy",
      "data-player-participant-summary",
      "data-player-preference-copy",
      "data-player-lobby-ready-btn",
      "data-player-lobby-ready-copy",
      "data-player-lobby-ready-button",
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
      "data-player-self-summary-card",
      "data-player-player-stats-copy",
      "data-player-special-unit-copy",
      "data-player-bench",
      "data-player-bench-slot",
      "data-player-bench-sell-button",
      "data-player-board-sell-button",
      "data-player-board-return-button",
      "data-player-ready-button",
      "data-player-result-surface",
      "data-player-host-help",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }

    expect(lobbySection.includes("data-player-boss-pref-on")).toBe(true);
    expect(lobbySection.includes("data-player-lobby-ready-button")).toBe(true);
    expect(lobbySection.includes("data-player-ready-button")).toBe(false);
    expect(selectionSection.includes("data-player-boss-pref-on")).toBe(false);
    expect(prepSection.includes("data-player-ready-button")).toBe(true);

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

  test("initial load では title だけを表示しておく", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const titleSection = extractPhaseSection(html, "title");
    const lobbySection = extractPhaseSection(html, "lobby");
    const selectionSection = extractPhaseSection(html, "selection");
    const prepSection = extractPhaseSection(html, "prep");
    const resultSection = extractPhaseSection(html, "result");

    expect(titleSection).not.toMatch(/data-player-phase="title"[^>]*hidden/);
    expect(lobbySection).toMatch(/data-player-phase="lobby"[^>]*hidden/);
    expect(selectionSection).toMatch(/data-player-phase="selection"[^>]*hidden/);
    expect(prepSection).toMatch(/data-player-phase="prep"[^>]*hidden/);
    expect(resultSection).toMatch(/data-player-phase="result"[^>]*hidden/);
  });

  test("ready controls stay outside lobby-only section so prep can still finish from the player shell", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const lobbySection = extractPhaseSection(html, "lobby");
    const prepSection = extractPhaseSection(html, "prep");

    expect(lobbySection.includes("data-player-lobby-ready-btn")).toBe(true);
    expect(lobbySection.includes("data-player-lobby-ready-button")).toBe(true);
    expect(prepSection.includes("data-player-ready-button")).toBe(true);
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
      'placeholder="ルームコード"',
      'placeholder="ユーザーネーム"',
      'autocomplete="nickname"',
      'data-player-connect-btn',
      'data-player-create-room-btn',
      '>ルーム作成<',
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }

    expect(html).toMatch(/<button[^>]*(?:data-player-connect-btn[^>]*disabled|disabled[^>]*data-player-connect-btn)[^>]*>/);
  });

  test("shared board shell keeps board guide sizing inside the shared-board CSS block", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const sharedBoardGuideIndex = html.indexOf("[data-shared-board-placement-guide]");

    expect(sharedBoardGuideIndex).toBeGreaterThan(0);

    const blockEnd = html.indexOf("}", sharedBoardGuideIndex);
    const block = html.slice(sharedBoardGuideIndex, blockEnd + 1);

    expect(block.includes("--shared-board-guide-lines")).toBe(true);
    expect(block.includes("height: calc(1.45em * var(--shared-board-guide-lines));")).toBe(true);
    expect(block.includes("overflow-y: auto;")).toBe(true);
    expect(html.lastIndexOf("</html>")).toBeGreaterThan(blockEnd);
  });

  test("player prep shell seeds a 6x6 shared-board placeholder without legacy 4x2 copy", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const sharedCellCount = (html.match(/data-player-shared-cell="/g) ?? []).length;

    expect(sharedCellCount).toBe(36);
    expect(html.includes("center 4x2")).toBe(false);
    expect(html.includes("中央 4x2")).toBe(false);
    expect(html.includes("open lane")).toBe(false);
    expect(html.includes("ボスは上半分、レイドは下半分の配置セルを使います。")).toBe(true);
    expect(html.includes("highlighted raid cells")).toBe(false);
  });

  test("shared phase shell uses 3-column rails and dedicated purchase/deploy surfaces", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const prepSection = extractPhaseSection(html, "prep");
    const resultSection = extractPhaseSection(html, "result");

    const requiredAttributes = [
      "data-player-top-hud",
      "data-player-hud-round-phase",
      "data-player-hud-timer",
      "data-player-hud-spell",
      "data-player-hud-flow",
      "data-player-phase-shell",
      "data-player-left-rail",
      "data-player-center-rail",
      "data-player-right-rail",
      "data-player-self-summary-card",
      "data-player-phase-notes-card",
      "data-player-phase-surface",
      "data-player-purchase-surface",
      "data-player-purchase-shop",
      "data-player-deploy-surface",
      "data-player-deploy-board",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }

    expect(resultSection.includes("data-player-phase-shell")).toBe(true);
    expect(resultSection.includes("data-player-left-rail")).toBe(true);
    expect(resultSection.includes("data-player-center-rail")).toBe(true);
    expect(resultSection.includes("data-player-right-rail")).toBe(true);
    expect(resultSection.includes("data-player-phase-notes-card")).toBe(true);
  });

  test("prep right rail keeps self summary and bench inside the phase shell instead of the global header", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const prepSection = extractPhaseSection(html, "prep");
    const shellHeaderMatch = html.match(
      /<header class="[^"]*\bplayer-shell-header\b[^"]*">[\s\S]*?<\/header>/,
    );

    expect(prepSection.includes("data-player-room-copy")).toBe(true);
    expect(prepSection.includes("data-player-ready-copy")).toBe(true);
    expect(prepSection.includes("data-player-phase-notes-copy")).toBe(true);
    expect(shellHeaderMatch?.[0]?.includes("data-player-room-copy")).toBe(false);
    expect(shellHeaderMatch?.[0]?.includes("data-player-ready-copy")).toBe(false);
  });

  test("prep left detail card fits without scroll and player summary stays compact", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const prepSection = extractPhaseSection(html, "prep");

    expect(html.includes("[data-player-detail-card]")).toBe(true);
    expect(html.includes("height: 332px;")).toBe(true);
    expect(html.includes("overflow: hidden;")).toBe(true);
    expect(prepSection.includes("data-player-deadline-summary")).toBe(false);
    expect(prepSection.includes("data-player-spell-copy")).toBe(false);
    expect(prepSection.includes("data-player-ready-btn")).toBe(true);
    expect(prepSection.includes("data-player-room-summary")).toBe(false);
    expect(prepSection.includes("data-player-synergy-copy")).toBe(false);
    expect(prepSection.includes("Gold、HP、残機、成長状況")).toBe(false);
    expect(prepSection.includes("配置数と状態")).toBe(true);
  });

  test("shared board shell keeps board and guide heights stable to avoid layout jumps", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    expect(html.includes("--shared-board-columns: 6;")).toBe(true);
    expect(html.includes("--shared-board-rows: 6;")).toBe(true);
    expect(html.includes("grid-template-rows: repeat(var(--shared-board-rows, 6), minmax(0, 1fr));")).toBe(true);
    expect(html.includes("aspect-ratio: var(--shared-board-columns, 6) / var(--shared-board-rows, 6);")).toBe(true);
    expect(html.includes("--shared-board-guide-lines: 3;")).toBe(true);
    expect(html.includes("height: calc(1.45em * var(--shared-board-guide-lines));")).toBe(true);
    expect(html.includes("overflow-y: auto;")).toBe(true);
  });

  test("bench keeps a dedicated two-column grid and non-wrapping slot labels", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    expect(html.includes("[data-player-bench-grid].player-bench-grid-two-column")).toBe(true);
    expect(html.includes("grid-template-columns: repeat(2, minmax(0, 1fr));")).toBe(true);
    expect(html.includes("grid-auto-flow: row;")).toBe(true);
    expect(html.includes("flex-wrap: nowrap;")).toBe(true);
    expect(html.includes("word-break: keep-all;")).toBe(true);
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
    expect(prepSection.includes(">Buy XP<")).toBe(false);
    expect(prepSection.includes("data-player-buy-xp-button")).toBe(true);
    expect(prepSection.includes(">強化 +1<")).toBe(true);
    expect(prepSection.includes(">リロード<")).toBe(true);
  });

  test("battle start banner placeholder is declared only once in the prep shell", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const bannerCount = (html.match(/data-player-battle-start-banner/g) ?? []).length;

    expect(bannerCount).toBe(1);
    expect(extractPhaseSection(html, "prep").includes("data-player-battle-start-banner")).toBe(true);
    expect(extractPhaseSection(html, "result").includes("data-player-battle-start-banner")).toBe(false);
  });

  test("bench uses 8 visible slots in the player shell", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const benchSlotCount = (html.match(/data-player-bench-slot="/g) ?? []).length;

    expect(benchSlotCount).toBe(8);
    expect(html.includes('data-player-bench-slot="7"')).toBe(true);
    expect(html.includes('data-player-bench-slot="8"')).toBe(false);
  });

  test("real player prep shell adopts the battle and shop mock theme layers", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const prepSection = extractPhaseSection(html, "prep");

    const requiredMarkers = [
      'data-player-runtime-theme="remilia"',
      "data-player-runtime-stage-layer",
      "data-player-runtime-shop-counter-surface",
      "data-player-runtime-board-floor",
      "--player-theme-stage-illustration",
      "--player-theme-board-floor",
      "--player-theme-shop-counter",
      "--player-theme-panel-skin",
      "--player-theme-hud-frame",
      "--player-theme-action-button",
      "--player-theme-stat-plate",
      "--player-theme-label-ribbon",
      "--player-theme-portrait-frame",
      "--player-theme-unit-slot",
      "--player-theme-hp-gauge",
      "--player-theme-coin-badge",
      "--player-theme-status-chip",
      "--player-theme-ready-button",
      "generated-remilia-stage-bg-v3-crimson-dusk.png",
      "generated-remilia-board-floor-v1.png",
      "generated-remilia-panel-skin-v1.png",
      "generated-remilia-hud-frame-v1.png",
      "generated-remilia-shop-counter-v1.png",
      "generated-remilia-action-button-v1.png",
      "generated-remilia-stat-plate-v1.png",
      "generated-remilia-label-ribbon-v1.png",
      "generated-remilia-portrait-frame-v1.png",
      "generated-remilia-unit-slot-v1.png",
      "generated-remilia-hp-gauge-v1.png",
      "generated-remilia-coin-badge-v1.png",
      "generated-remilia-status-chip-v1.png",
      "generated-remilia-ready-button-v1.png",
      ".player-runtime-stage-layer",
      ".player-runtime-shop-counter-surface",
      ".player-runtime-board-floor",
    ];

    for (const marker of requiredMarkers) {
      expect(html.includes(marker)).toBe(true);
    }

    expect(prepSection.includes("data-player-runtime-stage-layer")).toBe(true);
    expect(prepSection.includes("data-player-runtime-shop-counter-surface")).toBe(true);
    expect(prepSection.includes("data-player-runtime-board-floor")).toBe(true);
  });

  test("runtime surfaces include static decision aids and accessible focus styling", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");
    const requiredCss = [
      ".player-shop-summary",
      ".player-shop-offer-badges",
      ".player-ready-checklist",
      ".player-board-cell-recommended",
      ".player-battle-intel",
      ".player-battle-player-hp",
      ".player-battle-player-row .player-bench-slot-state",
      ".player-board .shared-board-zone-label",
      ".player-shell[data-player-facing-phase=\"battle\"] .player-board .shared-board-unit-meta-wrap",
      "shared-board-battle-strike-flash",
      "shared-board-battle-projectile-shot",
      "shared-board-battle-damage-float",
      "shared-board-battle-defeat-fade",
      ".shared-board-unit-card > img",
      "button:focus-visible",
    ];

    for (const css of requiredCss) {
      expect(html.includes(css)).toBe(true);
    }
  });

  test("battle themed runtime shell hides deploy-only board help and controls", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    expect(html.includes('.player-shell[data-player-facing-phase="battle"] [data-shared-board-help]')).toBe(true);
    expect(html.includes('.player-shell[data-player-facing-phase="battle"] [data-player-board-copy]')).toBe(true);
    expect(html.includes('.player-shell[data-player-facing-phase="battle"] [data-shared-board-status-legend]')).toBe(true);
    expect(html.includes('.player-shell[data-player-facing-phase="battle"] [data-player-board-return-button]')).toBe(true);
  });

  test("themed runtime shell keeps responsive and short-viewport escape hatches", () => {
    const html = readFileSync(playerHtmlPath, "utf-8");

    expect(html.includes("@media (max-height: 820px) and (min-width: 1121px)")).toBe(true);
    expect(html.includes("@media (max-width: 1120px)")).toBe(true);
    expect(html.includes('.player-shell[data-player-facing-phase="purchase"] [data-player-phase-notes-card]')).toBe(true);
    expect(html.includes("position: relative")).toBe(true);
    expect(html.includes('.player-shell[data-player-facing-phase="battle"] .player-prep-grid')).toBe(true);
    expect(html.includes("grid-template-rows: minmax(0, 1fr)")).toBe(true);
    expect(html.includes("aspect-ratio: auto !important")).toBe(true);
  });
});
