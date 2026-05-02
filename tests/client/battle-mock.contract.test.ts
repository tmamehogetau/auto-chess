import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(__dirname), "..");
const readText = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const battleMockCssPath = resolve(repoRoot, "src/client/battle-mock.css");
const battleMockHtmlPath = resolve(repoRoot, "src/client/battle-mock.html");
const battleMockJsPath = resolve(repoRoot, "src/client/battle-mock.js");
const remiliaFrameAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-theme-remilia-frame.svg",
);
const remiliaStageAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-theme-remilia-stage.svg",
);
const remiliaArcanaAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-theme-remilia-arcana.svg",
);
const remiliaHallAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-theme-remilia-hall.png",
);
const remiliaOrnamentsAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-theme-remilia-ornaments.svg",
);
const remiliaBoardFloorAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-theme-remilia-board-floor.svg",
);
const remiliaPanelSkinAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-theme-remilia-panel-skin.svg",
);
const goldIconAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-icon-gold.svg",
);
const hpIconAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-icon-hp.svg",
);

const levelIconAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-icon-level.svg",
);
const timerIconAssetPath = resolve(
  repoRoot,
  "src/client/mock-assets/battle-icon-timer.svg",
);

describe("battle mock task 3 contract", () => {
  test("declares fixed battle data and boss theme preset scaffolding", () => {
    const js = readText(battleMockJsPath);

    expect(js).toContain("const bossThemePresets");
    expect(js).toContain("remilia: {");
    expect(js).toContain("const boardCells = [");
    expect(js).toContain("const topHud = {");
    expect(js).toContain("function renderTopHud()");
    expect(js).toContain("function renderBossHud()");
    expect(js).toContain("function renderPlayerHud()");
    expect(js).toContain("function renderAllies()");
    expect(js).toContain("function renderBenchHud()");
    expect(js).toContain("function renderBoard()");
    expect(js).toContain("resolveFrontPortraitUrl");
    expect(js).toContain('./mock-assets/battle-icon-gold.svg');
    expect(js).toContain('./mock-assets/battle-icon-hp.svg');
    expect(js).toContain('./mock-assets/battle-icon-level.svg');
    expect(js).toContain('./mock-assets/battle-icon-timer.svg');
  });

  test("ships remilia theme assets and shared utility icons", () => {
    expect(existsSync(remiliaFrameAssetPath)).toBe(true);
    expect(existsSync(remiliaStageAssetPath)).toBe(true);
    expect(existsSync(remiliaArcanaAssetPath)).toBe(true);
    expect(existsSync(remiliaHallAssetPath)).toBe(true);
    expect(existsSync(remiliaOrnamentsAssetPath)).toBe(true);
    expect(existsSync(remiliaBoardFloorAssetPath)).toBe(true);
    expect(existsSync(remiliaPanelSkinAssetPath)).toBe(true);
    expect(existsSync(goldIconAssetPath)).toBe(true);
    expect(existsSync(hpIconAssetPath)).toBe(true);
    expect(existsSync(levelIconAssetPath)).toBe(true);
    expect(existsSync(timerIconAssetPath)).toBe(true);
  });

  test("uses mansion-stage illustration motifs instead of temporary target ornaments", () => {
    const css = readText(battleMockCssPath);
    const remiliaStageSvg = readText(remiliaStageAssetPath);
    const remiliaOrnamentsSvg = readText(remiliaOrnamentsAssetPath);

    expect(remiliaStageSvg).toContain('data-koumakan-hall="true"');
    expect(remiliaStageSvg).toContain('data-koumakan-arched-windows="true"');
    expect(remiliaStageSvg).toContain('data-koumakan-columns="true"');
    expect(remiliaStageSvg).toContain('data-koumakan-floor-perspective="true"');
    expect(remiliaStageSvg).not.toContain('cx="800" cy="520"');
    expect(remiliaOrnamentsSvg).toContain('data-koumakan-side-arches="true"');
    expect(remiliaOrnamentsSvg).toContain('data-koumakan-gold-filagree="true"');
    expect(remiliaOrnamentsSvg).not.toContain('<circle');
    expect(css).toContain("filter: saturate(1.3) contrast(1.12) brightness(1.03);");
    expect(css).toContain("opacity: 0.82;");
  });

  test("uses a desktop-first board-dominant frame instead of the old dashboard layout", () => {
    const css = readText(battleMockCssPath);

    expect(css).toContain(".battle-mock-stage");
    expect(css).toContain(".battle-mock-board-frame");
    expect(css).toContain(".battle-mock-top-hud");
    expect(css).toContain(".battle-mock-boss-hud");
    expect(css).toContain(".battle-mock-player-hud");
    expect(css).toContain(".battle-mock-ally-hud");
    expect(css).toContain(".battle-mock-bench-hud");
    expect(css).toContain("min-width: 1480px;");
    expect(css).not.toContain("grid-template-columns: minmax(250px, 290px) minmax(0, 1fr) minmax(260px, 300px);");
  });

  test("adds image-faithful atmosphere layers and a rail-style bench hud", () => {
    const css = readText(battleMockCssPath);
    const html = readText(battleMockHtmlPath);
    const js = readText(battleMockJsPath);

    expect(html).toContain("data-battle-mock-atmosphere");
    expect(html).toContain("data-battle-mock-arcana");
    expect(html).toContain("data-battle-mock-stage-illustration");
    expect(html).toContain("data-battle-mock-ornaments");
    expect(css).toContain(".battle-mock-atmosphere-layer");
    expect(css).toContain(".battle-mock-arcana-layer");
    expect(css).toContain(".battle-mock-hud-card.is-shelf");
    expect(js).toContain("arcanaAsset");
    expect(js).toContain("battle-theme-remilia-arcana.svg");
    expect(js).toContain('createHudCard("is-shelf")');
  });

  test("keeps hud gutters outside the board playfield at the desktop target", () => {
    const css = readText(battleMockCssPath);

    expect(css).toContain("--panel-rail:");
    expect(css).toContain("--panel-glass:");
    expect(css).toContain(".battle-mock-stage::after");
    expect(css).toContain("inset: 18px 60px 22px;");
    expect(css).toContain("rgba(211, 163, 93, 0.34) 316px 324px");
    expect(css).toContain("radial-gradient(circle at 316px 90px");
    expect(css).toContain("background-blend-mode: screen, screen, screen, normal, normal, normal;");
    expect(css).toContain("inset: 24px 330px 34px;");
    expect(css).toContain("height: 840px;");
    expect(css).toContain(".battle-mock-boss-hud {\n  top: 24px;\n  left: 24px;\n  width: 292px;");
    expect(css).toContain(".battle-mock-player-hud {\n  top: 24px;\n  right: 24px;\n  width: 292px;");
    expect(css).toContain(".battle-mock-ally-hud {\n  left: 24px;\n  bottom: 34px;\n  width: 292px;");
    expect(css).toContain(".battle-mock-bench-hud {\n  right: 24px;\n  bottom: 34px;\n  width: 292px;");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain("grid-row: 1 / 4;");
    expect(css).not.toContain("width: 1070px;");
    expect(css).not.toContain("width: 340px;");
  });

  test("pushes the 80 point visual pass with stage depth and connected hud wings", () => {
    const css = readText(battleMockCssPath);

    expect(css).toContain("--stage-fog:");
    expect(css).toContain("--board-aura:");
    expect(css).toContain(".battle-mock-board-frame::after");
    expect(css).toContain(".battle-mock-board-shell::before");
    expect(css).toContain(".battle-mock-board-shell::after");
    expect(css).toContain(".battle-mock-boss-hud::before,");
    expect(css).toContain(".battle-mock-player-hud::before,");
    expect(css).toContain(".battle-mock-ally-hud::before,");
    expect(css).toContain(".battle-mock-bench-hud::before");
    expect(css).toContain(".battle-mock-hud-card::after");
    expect(css).toContain("linear-gradient(90deg, transparent, var(--panel-rail), transparent)");
    expect(css).toContain("filter: blur(10px);");
    expect(css).toContain(".battle-mock-boss-hud::after,");
    expect(css).toContain("border-inline: 1px solid rgba(247, 210, 141, 0.16);");
    expect(css).toContain("mix-blend-mode: screen;");
  });

  test("moves the battle mock away from rounded web cards into Koumakan stage panels", () => {
    const css = readText(battleMockCssPath);
    const js = readText(battleMockJsPath);

    expect(js).toContain("stageIllustrationAsset");
    expect(js).toContain("ornamentAsset");
    expect(js).toContain("battle-theme-remilia-hall.png");
    expect(js).toContain("battle-theme-remilia-ornaments.svg");

    expect(css).toContain("--plaque-corner:");
    expect(css).toContain("--mansion-red:");
    expect(css).toContain(".battle-mock-stage-illustration");
    expect(css).toContain(".battle-mock-ornament-layer");
    expect(css).toContain("clip-path: polygon(");
    expect(css).toContain(".battle-mock-hud-card.is-plaque");
    expect(css).toContain(".battle-mock-hud-card.is-instrument");
    expect(css).toContain(".battle-mock-hud-card.is-slip");
    expect(css).toContain(".battle-mock-hud-card.is-shelf");

    expect(css).not.toContain("border-radius: 30px;");
    expect(css).not.toContain("border-radius: 999px;");
  });

  test("embeds the central board into the mansion floor instead of a floating glass plate", () => {
    const css = readText(battleMockCssPath);
    const html = readText(battleMockHtmlPath);

    expect(html).toContain("data-battle-mock-board-floor");
    expect(css).toContain("--floor-inlay:");
    expect(css).toContain(".battle-mock-board-floor-inlay");
    expect(css).toContain("inset 0 0 0 2px rgba(211, 163, 93, 0.16)");
    expect(css).toContain("var(--battle-mock-theme-board-floor");
    expect(css).toContain("battle-theme-remilia-board-floor.svg");
    expect(css).not.toContain("linear-gradient(135deg, rgba(211, 163, 93, 0.18) 0 1px, transparent 1px 100%)");
    expect(css).not.toContain("linear-gradient(180deg, rgba(10, 16, 28, 0.56), rgba(8, 14, 25, 0.8)),\n    url(\"./mock-assets/battle-board-texture.svg\")");
  });

  test("mounts the top hud and side huds as mansion architecture instead of web overlays", () => {
    const css = readText(battleMockCssPath);

    expect(css).toContain("--curtain-red:");
    expect(css).toContain("--top-hud-window-cutout:");
    expect(css).toContain("--wall-panel-rivet:");
    expect(css).toContain(".battle-mock-top-hud::before");
    expect(css).toContain(".battle-mock-top-hud::after");
    expect(css).toContain(".battle-mock-hud-card.is-plaque::before");
    expect(css).toContain(".battle-mock-hud-card.is-instrument::before");
    expect(css).toContain(".battle-mock-hud-card.is-slip::before");
    expect(css).toContain(".battle-mock-hud-card.is-shelf::before");
    expect(css).toContain("repeating-linear-gradient(90deg, transparent 0 118px");
    expect(css).toContain("var(--top-hud-window-cutout) 15px 56px");
    expect(css).toContain("box-shadow: inset 0 -10px 0 rgba(70, 17, 31, 0.58)");
    expect(css).not.toContain("backdrop-filter: blur(18px);");
  });

  test("adds side wall architecture that locks the hud panels into the stage", () => {
    const css = readText(battleMockCssPath);
    const html = readText(battleMockHtmlPath);

    expect(html).toContain("data-battle-mock-side-architecture");
    expect(css).toContain(".battle-mock-side-architecture");
    expect(css).toContain("rgba(70, 17, 31, 0.42) 0 316px");
    expect(css).toContain("rgba(70, 17, 31, 0.42) 1164px 100%");
    expect(css).toContain("rgba(211, 163, 93, 0.46) 316px 322px");
    expect(css).toContain("rgba(211, 163, 93, 0.46) 1158px 1164px");
    expect(css).toContain("repeating-linear-gradient(0deg, transparent 0 84px");
    expect(css).toContain("box-shadow: inset 312px 0 72px rgba(3, 5, 10, 0.28)");
  });

  test("compresses the top status into segmented battle tabs", () => {
    const css = readText(battleMockCssPath);
    const js = readText(battleMockJsPath);
    const html = readText(battleMockHtmlPath);

    expect(css).toContain("--top-tab-red:");
    expect(css).toContain("grid-template-columns: 128px 320px minmax(0, 1fr) 178px;");
    expect(css).toContain(".battle-mock-round::before");
    expect(css).toContain(".battle-mock-spell::before");
    expect(css).toContain(".battle-mock-timer::before");
    expect(css).toContain("font-size: 2.34rem;");
    expect(css).toContain("clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 50%");
    expect(css).not.toContain("font-size: 2.84rem;");
    expect(js).not.toContain("共有盤面で持ちこたえる");
    expect(js).not.toContain("topHud.flow");
    expect(css).not.toContain(".battle-mock-subcopy");
    expect(html).not.toContain('class="battle-mock-board-title"');
    expect(html).not.toContain('class="battle-mock-board-copy"');
  });

  test("renders board units as standees instead of rounded portrait cards", () => {
    const css = readText(battleMockCssPath);
    const portraitRule = css.slice(
      css.indexOf(".battle-mock-cell-portrait"),
      css.indexOf(".battle-mock-unit-combat-hud"),
    );

    expect(portraitRule).toContain(".battle-mock-cell-portrait");
    expect(portraitRule).toContain("object-fit: contain;");
    expect(portraitRule).toContain("border-radius: 0;");
    expect(portraitRule).toContain("drop-shadow(0 12px 12px rgba(0, 0, 0, 0.42))");
    expect(portraitRule).toContain("drop-shadow(0 0 10px var(--battle-mock-cell-accent-glow");
    expect(portraitRule).toContain("border: 0;");
    expect(portraitRule).not.toContain("object-fit: cover;");
    expect(portraitRule).not.toContain("border-radius: 16px;");
  });

  test("keeps the battle banner as transient feedback instead of persistent board chrome", () => {
    const css = readText(battleMockCssPath);
    const html = readText(battleMockHtmlPath);
    const js = readText(battleMockJsPath);

    expect(html).toContain("data-battle-mock-battle-banner");
    expect(html).toContain("data-battle-mock-transient-banner");
    expect(css).toContain("--battle-banner-red:");
    expect(css).toContain(".battle-mock-battle-banner");
    expect(css).toContain(".battle-mock-battle-banner::before");
    expect(css).toContain(".battle-mock-battle-banner.is-transient");
    expect(css).toContain("@keyframes battle-mock-banner-flash");
    expect(css).toContain("opacity: 0;");
    expect(css).toContain("戦闘中");
    expect(js).toContain('mode: "transient"');
    expect(js).toContain('root.classList.toggle("is-transient", battleBanner.mode === "transient")');
    expect(js).toContain("root.dataset.mode = battleBanner.mode");
  });

  test("pushes the battle board toward the reference illustration with perspective and unit status plates", () => {
    const css = readText(battleMockCssPath);
    const js = readText(battleMockJsPath);

    expect(css).toContain("transform: perspective(920px) rotateX(7deg) translateY(-6px);");
    expect(css).toContain("clip-path: polygon(34px 0, calc(100% - 10px) 10px, calc(100% - 22px) 100%, 0 calc(100% - 4px));");
    expect(css).toContain(".battle-mock-unit-stars");
    expect(css).toContain(".battle-mock-unit-hp");
    expect(css).toContain(".battle-mock-cell.is-active");
    expect(css).toContain(".battle-mock-cell.is-active .battle-mock-cell-body::before");
    expect(css).toContain(".battle-mock-cell.is-active .battle-mock-cell-body::after");
    expect(css).toContain("conic-gradient(from 18deg");
    expect(css).toContain("transform: translateX(-50%) perspective(240px) rotateX(62deg);");
    expect(css).toContain("box-shadow: none;");
    expect(css).not.toContain(".battle-mock-board-grid {\n  position: relative;\n  z-index: 3;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  height: 100%;\n  padding: 108px 52px 28px 96px;\n  clip-path:");
    expect(js).toContain("createUnitCombatHud");
    expect(js).toContain("battle-mock-unit-stars");
    expect(js).toContain("battle-mock-unit-hp");
  });

  test("removes redundant lane plaques while keeping the bottom battle log readable", () => {
    const css = readText(battleMockCssPath);
    const html = readText(battleMockHtmlPath);
    const js = readText(battleMockJsPath);

    expect(html).toContain("data-battle-mock-battle-log");
    expect(css).toContain(".battle-mock-battle-log");
    expect(css).toContain(".battle-mock-battle-log-row");
    expect(html).not.toContain("battle-mock-board-chrome");
    expect(html).not.toContain("battle-mock-zone-chip");
    expect(html).not.toContain("ボス配置");
    expect(html).not.toContain("レイド配置");
    expect(css).not.toContain(".battle-mock-zone-chip");
    expect(css).toContain("left: 330px;");
    expect(css).toContain("right: 330px;");
    expect(css).toContain("bottom: 34px;");
    expect(css).toContain("grid-template-columns: 56px minmax(0, 1fr);");
    expect(js).toContain("battleLog");
    expect(js).toContain("renderBattleLog");
    expect(js).toContain("battle-mock-battle-log-row");
  });

  test("connects the board and battle log as one mansion floor plane", () => {
    const css = readText(battleMockCssPath);

    expect(css).toContain("bottom: -122px;");
    expect(css).toContain("height: 206px;");
    expect(css).toContain("repeating-linear-gradient(96deg, rgba(211, 163, 93, 0.13) 0 1px");
    expect(css).toContain("clip-path: polygon(54px 0, calc(100% - 38px) 8px, 100% 100%, 0 100%);");
    expect(css).toContain("0 14px 38px rgba(0, 0, 0, 0.24)");
    expect(css).toContain("0 3px 0 rgba(5, 9, 15, 0.22)");
    expect(css).toContain("inset: 6px 6px -18px;");
    expect(css).toContain("inset: -18px -24px -42px;");
    expect(css).toContain("radial-gradient(ellipse at 50% 16%, rgba(239, 91, 114, 0.22), transparent 34%)");
    expect(css).toContain("radial-gradient(ellipse at 50% 48%, rgba(178, 22, 42, 0.12), transparent 38%)");
    expect(css).toContain("linear-gradient(90deg, rgba(211, 163, 93, 0.12), transparent 12% 88%, rgba(211, 163, 93, 0.12))");
    expect(css).toContain(".battle-mock-battle-log::before");
    expect(css).toContain(".battle-mock-battle-log::after");
    expect(css).toContain("z-index: 3;");
  });

  test("trims duplicate combat HUD copy and makes boss/player portraits primary", () => {
    const css = readText(battleMockCssPath);
    const js = readText(battleMockJsPath);

    expect(js).not.toContain("フェーズHP を削り切る準備中");
    expect(js).not.toContain("注目ユニット");
    expect(js).not.toContain("フェーズ圧");
    expect(js).not.toContain("配置の軸");
    expect(js).not.toContain("readyLabel");
    expect(js).not.toContain("readyCopy");
    expect(js).not.toContain('createIconStat(sharedIcons.timer, "Ready"');
    expect(js).not.toContain('createIconStat(sharedIcons.level, "Phase"');
    expect(css).toContain("grid-template-columns: 96px minmax(0, 1fr);");
    expect(css).toContain("width: 98px;");
    expect(css).toContain("height: 98px;");
    expect(css).toContain("object-fit: contain;");
    expect(css).toContain(".battle-mock-hud-card.is-plaque .battle-mock-hud-stat-grid");
    expect(css).toContain(".battle-mock-hud-card.is-instrument .battle-mock-hud-stat-grid");
  });

  test("pushes the stage toward the red-moon courtyard and stone battlefield reference", () => {
    const css = readText(battleMockCssPath);
    const html = readText(battleMockHtmlPath);

    expect(html).toContain("data-battle-mock-skyline");
    expect(css).toContain("--red-moon-core:");
    expect(css).toContain("--stone-groove:");
    expect(css).toContain(".battle-mock-skyline-layer");
    expect(css).toContain(".battle-mock-skyline-layer::before");
    expect(css).toContain(".battle-mock-skyline-layer::after");
    expect(css).toContain("radial-gradient(circle at 50% 10%, var(--red-moon-core)");
    expect(css).toContain("battle-theme-remilia-board-floor.svg");
    expect(css).toContain("var(--battle-mock-theme-board-floor");
    expect(css).not.toContain(".battle-mock-board-floor-inlay::before");
    expect(css).not.toContain(".battle-mock-board-floor-inlay::after");
    const boardFloorSvg = readText(remiliaBoardFloorAssetPath);
    expect(boardFloorSvg).toContain('data-koumakan-board-floor="true"');
    expect(boardFloorSvg).toContain('preserveAspectRatio="none"');
    expect(boardFloorSvg).toContain('data-koumakan-board-grid-groove="true"');
    expect(boardFloorSvg).toContain('data-koumakan-board-broken-grooves="true"');
    expect(boardFloorSvg).toContain('data-koumakan-board-stone-veins="true"');
    expect(boardFloorSvg).not.toContain("M92 109h636");
    expect(boardFloorSvg).not.toContain("M92 205h636");
    expect(boardFloorSvg).not.toContain("M92 300h636");
    expect(boardFloorSvg).not.toContain("M92 395h636");
    expect(boardFloorSvg).not.toContain("M92 491h636");
    expect(boardFloorSvg).not.toContain("M92 586h636");
    expect(boardFloorSvg).not.toContain("c72-36");
    expect(boardFloorSvg).not.toContain("c30-22");
    expect(boardFloorSvg).not.toContain('fill="none" stroke="#f7d28d" stroke-width="1.8"');
    expect(boardFloorSvg).toContain('pattern id="stoneMottle"');
    expect(boardFloorSvg).toContain('fill="url(#sunkenRelief)"');
    expect(boardFloorSvg).toContain('fill="url(#reliefGold)"');
    expect(boardFloorSvg).toContain('stroke="#070a10" stroke-width="4.4"');
    expect(boardFloorSvg).toContain('stroke-dasharray="116 10 78 7"');
    expect(boardFloorSvg).toContain('stroke="#c9aa72" stroke-width="1.15"');
    expect(boardFloorSvg).toContain('stroke-dasharray="92 18"');
  });

  test("keeps the battlefield readable by removing noisy cell labels and separating the log", () => {
    const css = readText(battleMockCssPath);
    const js = readText(battleMockJsPath);

    expect(js).not.toContain("cellElement.append(createZoneTag");
    expect(css).toContain(".battle-mock-board-row:nth-child(1)");
    expect(css).toContain(".battle-mock-board-row:nth-child(6)");
    expect(css).toContain("width: 100%;");
    expect(css).toContain("padding: 56px 92px 69px;");
    expect(css).toContain("gap: 0;");
    expect(css).toContain("inset: 24px 330px 178px;");
    expect(css).toContain("z-index: 4;");
    expect(css).toContain("border: 0;");
    expect(css).toContain("background: transparent;");
    expect(css).toContain("overflow: visible;");
    expect(css).toContain("box-shadow: none;");
    expect(css).toContain(".battle-mock-board-target {\n  display: none;");
    expect(js).toContain("createUnitCombatHud(cell)");
    expect(js).not.toContain("battle-mock-combat-trail");
    expect(css).not.toContain("--cell-skew:");
    expect(css).not.toContain("clip-path: polygon(var(--cell-skew) 0");
    expect(css).not.toContain("repeating-linear-gradient(90deg, transparent 0 86px, rgba(211, 163, 93, 0.22)");
    expect(css).not.toContain("radial-gradient(circle at 50% 53%, rgba(211, 163, 93, 0.18)");
  });

  test("uses a theme board-floor image while keeping board gameplay data in DOM", () => {
    const css = readText(battleMockCssPath);
    const js = readText(battleMockJsPath);
    const html = readText(battleMockHtmlPath);

    expect(js).toContain("boardFloorAsset:");
    expect(js).toContain("panelSkinAsset:");
    expect(js).toContain("--battle-mock-theme-board-floor");
    expect(js).toContain("--battle-mock-theme-panel-skin");
    expect(html).toContain("data-battle-mock-board-floor");
    expect(css).toContain("var(--battle-mock-theme-board-floor");
    expect(css).toContain(".battle-mock-board-grid");
    expect(html).toContain('role="grid"');
    expect(js).toContain("battle-mock-unit-stars");
    expect(js).toContain("battle-mock-unit-hp");
    expect(js).toContain("battle-mock-cell-name");
    expect(css).toContain("width: 124px;");
    expect(css).toContain("min-height: 104px;");
    expect(css).toContain("height: 76px;");
    expect(css).toContain("margin-top: -8px;");
    expect(css).toContain(".battle-mock-board-row:first-child .battle-mock-cell-body");
    expect(css).toContain("bottom: -22px;");
    expect(css).toContain("overflow: visible;");
    expect(css).toContain("text-overflow: clip;");
    expect(css).not.toContain("repeating-linear-gradient(90deg, var(--stone-groove)");
    expect(css).not.toContain("radial-gradient(ellipse at 50% 53%, rgba(211, 163, 93, 0.06)");
  });
});
