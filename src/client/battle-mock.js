import { resolveFrontPortraitUrl } from "./portrait-resolver.js";

const bossThemePresets = {
  remilia: {
    key: "remilia",
    label: "Remilia Scarlet",
    frameAsset: "./mock-assets/battle-theme-remilia-frame.svg",
    stageAsset: "./mock-assets/battle-theme-remilia-stage.svg",
    arcanaAsset: "./mock-assets/battle-theme-remilia-arcana.svg",
    stageIllustrationAsset: "./mock-assets/battle-theme-remilia-hall.png",
    ornamentAsset: "./mock-assets/battle-theme-remilia-ornaments.svg",
    boardFloorAsset: "./mock-assets/battle-theme-remilia-board-floor.svg",
    panelSkinAsset: "./mock-assets/battle-theme-remilia-panel-skin.svg",
    accent: "#ef5b72",
    accentSoft: "rgba(239, 91, 114, 0.22)",
    glow: "#d3a35d",
  },
};

const activeBossTheme = bossThemePresets.remilia;

const sharedIcons = {
  gold: "./mock-assets/battle-icon-gold.svg",
  hp: "./mock-assets/battle-icon-hp.svg",
  level: "./mock-assets/battle-icon-level.svg",
  timer: "./mock-assets/battle-icon-timer.svg",
};

const boardCells = [
  { index: 0, label: "空", zone: "boss", kind: "empty" },
  { index: 1, label: "空", zone: "boss", kind: "empty" },
  {
    index: 2,
    zone: "boss",
    kind: "boss",
    name: "レミリア",
    unitId: "remilia",
    hp: 418,
    maxHp: 580,
    note: "主戦力",
    accent: "#ef5b72",
  },
  { index: 3, label: "空", zone: "boss", kind: "empty" },
  {
    index: 4,
    zone: "boss",
    kind: "boss",
    name: "十六夜咲夜",
    unitId: "sakuya",
    hp: 206,
    maxHp: 260,
    note: "時計支援",
    accent: "#8fd3ff",
  },
  { index: 5, label: "空", zone: "boss", kind: "empty" },
  { index: 6, label: "空", zone: "boss", kind: "empty" },
  {
    index: 7,
    zone: "boss",
    kind: "boss",
    name: "紅美鈴",
    unitId: "meiling",
    hp: 278,
    maxHp: 320,
    note: "前衛",
    accent: "#d8b36a",
  },
  { index: 8, label: "空", zone: "boss", kind: "empty" },
  { index: 9, label: "空", zone: "boss", kind: "empty" },
  { index: 10, label: "空", zone: "boss", kind: "empty" },
  { index: 11, label: "空", zone: "boss", kind: "empty" },
  { index: 12, label: "空", zone: "boss", kind: "empty" },
  { index: 13, label: "空", zone: "boss", kind: "empty" },
  { index: 14, label: "空", zone: "boss", kind: "empty" },
  { index: 15, label: "空", zone: "boss", kind: "empty" },
  { index: 16, label: "空", zone: "boss", kind: "empty" },
  { index: 17, label: "空", zone: "boss", kind: "empty" },
  { index: 18, label: "空", zone: "raid", kind: "empty" },
  { index: 19, label: "空", zone: "raid", kind: "empty" },
  {
    index: 20,
    zone: "raid",
    kind: "raid",
    name: "博麗霊夢",
    unitId: "reimu",
    hp: 264,
    maxHp: 320,
    note: "守護",
    accent: "#efcf75",
  },
  { index: 21, label: "空", zone: "raid", kind: "empty" },
  {
    index: 22,
    zone: "raid",
    kind: "raid",
    name: "霧雨魔理沙",
    unitId: "marisa",
    hp: 184,
    maxHp: 240,
    note: "火力",
    accent: "#7bd4ff",
  },
  { index: 23, label: "空", zone: "raid", kind: "empty" },
  { index: 24, label: "空", zone: "raid", kind: "empty" },
  {
    index: 25,
    zone: "raid",
    kind: "raid",
    name: "摩多羅隠岐奈",
    unitId: "okina",
    hp: 302,
    maxHp: 360,
    note: "支援",
    accent: "#9fe29d",
  },
  { index: 26, label: "空", zone: "raid", kind: "empty" },
  {
    index: 27,
    zone: "raid",
    kind: "raid",
    name: "埴安神袿姫",
    unitId: "keiki",
    hp: 350,
    maxHp: 380,
    note: "守勢",
    accent: "#d1a35e",
  },
  { index: 28, label: "空", zone: "raid", kind: "empty" },
  { index: 29, label: "空", zone: "raid", kind: "empty" },
  { index: 30, label: "空", zone: "raid", kind: "empty" },
  { index: 31, label: "空", zone: "raid", kind: "empty" },
  { index: 32, label: "空", zone: "raid", kind: "empty" },
  { index: 33, label: "空", zone: "raid", kind: "empty" },
  { index: 34, label: "空", zone: "raid", kind: "empty" },
  { index: 35, label: "空", zone: "raid", kind: "empty" },
];

const bossSummary = {
  unitId: "remilia",
  name: "レミリア・スカーレット",
  subtitle: "紅魔館の主",
  hp: 418,
  maxHp: 580,
};

const playerSummary = {
  unitId: "reimu",
  name: "博麗霊夢",
  subtitle: "",
  stats: {
    gold: "12",
    hp: "28",
    level: "5",
  },
};

const allies = [
  {
    unitId: "reimu",
    name: "博麗霊夢",
    role: "安定役",
    hp: 264,
    maxHp: 320,
    accent: "#efcf75",
    copy: "中央を受ける主軸",
  },
  {
    unitId: "marisa",
    name: "霧雨魔理沙",
    role: "火力役",
    hp: 184,
    maxHp: 240,
    accent: "#7bd4ff",
    copy: "右寄りで削りを担当",
  },
  {
    unitId: "okina",
    name: "摩多羅隠岐奈",
    role: "支援役",
    hp: 302,
    maxHp: 360,
    accent: "#9fe29d",
    copy: "連携の支点",
  },
];

const benchSlots = [
  { unitId: "koishi", name: "古明地こいし", note: "待機", hp: 228 },
  { unitId: "patchouli", name: "パチュリー", note: "魔法", hp: 191 },
  { unitId: "sakuya", name: "十六夜咲夜", note: "手数", hp: 210 },
  { unitId: "meiling", name: "紅美鈴", note: "前衛", hp: 278 },
  { unitId: null, name: "空き", note: "ベンチ", hp: null },
  { unitId: "yoshika", name: "宮古芳香", note: "守護", hp: 240 },
  { unitId: null, name: "空き", note: "ベンチ", hp: null },
  { unitId: "rin", name: "火焔猫燐", note: "片付け", hp: 260 },
];

const topHud = {
  phase: "Battle",
  round: "Round 7",
  timer: "残り 18 秒",
  spell: "Spell: 紅符「スカーレットシュート」",
};

const battleBanner = {
  label: "戦闘中",
  sublabel: "BATTLE LIVE",
  mode: "transient",
};

const battleLog = [
  { time: "00:12", text: "レミリアが紅符を発動。前列に 856 ダメージ。" },
  { time: "00:10", text: "霧雨魔理沙が弾幕で右列を押し返す。" },
  { time: "00:08", text: "博麗霊夢が守護結界を展開。味方HPを維持。" },
];

const BOARD_SIZE = 6;

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  if (options.attributes) {
    for (const [name, value] of Object.entries(options.attributes)) {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, String(value));
      }
    }
  }

  return element;
}

function createMeter(className, value, maxValue, accent) {
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  const safeValue = Number.isFinite(value) ? value : 0;
  const percent = Math.max(0, Math.min(100, (safeValue / safeMax) * 100));
  const meter = createElement("div", { className });
  const fill = createElement("span");

  fill.style.setProperty("width", `${percent}%`);
  fill.style.setProperty("background", `linear-gradient(90deg, ${accent}, #f7d28d)`);
  meter.append(fill);
  return meter;
}

function createHudCard(className = "") {
  return createElement("section", {
    className: `battle-mock-hud-card ${className}`.trim(),
  });
}

function createHudHeadline(kicker, title, subtitle, portraitUrl, portraitAlt) {
  const wrapper = createElement("div", { className: "battle-mock-hud-card-headline" });
  const portrait = createElement("img", {
    className: "battle-mock-hud-portrait",
    attributes: { alt: portraitAlt, src: portraitUrl },
  });
  const copy = createElement("div");

  copy.append(
    createElement("div", {
      className: "battle-mock-hud-kicker",
      text: kicker,
    }),
    createElement("div", {
      className: "battle-mock-hud-name",
      text: title,
    }),
  );

  if (subtitle) {
    copy.append(
      createElement("div", {
        className: "battle-mock-hud-subline",
        text: subtitle,
      }),
    );
  }

  wrapper.append(portrait, copy);
  return wrapper;
}

function createIconStat(iconPath, label, value) {
  const stat = createElement("div", { className: "battle-mock-icon-stat" });
  const icon = createElement("img", {
    attributes: { alt: "", src: iconPath },
  });
  const copy = createElement("div");

  copy.append(
    createElement("div", {
      className: "battle-mock-icon-stat-label",
      text: label,
    }),
    createElement("div", {
      className: "battle-mock-icon-stat-value",
      text: value,
    }),
  );

  stat.append(icon, copy);
  return stat;
}

function getApp() {
  return document.querySelector("[data-battle-mock-app]");
}

function getTopHud() {
  return document.querySelector("[data-battle-mock-top-hud]");
}

function getBossHud() {
  return document.querySelector("[data-battle-mock-boss-hud]");
}

function getPlayerHud() {
  return document.querySelector("[data-battle-mock-player-hud]");
}

function getAllyHud() {
  return document.querySelector("[data-battle-mock-ally-hud]");
}

function getBenchHud() {
  return document.querySelector("[data-battle-mock-bench-hud]");
}

function getStageIllustration() {
  return document.querySelector("[data-battle-mock-stage-illustration]");
}

function getOrnamentLayer() {
  return document.querySelector("[data-battle-mock-ornaments]");
}

function getBattleBanner() {
  return document.querySelector("[data-battle-mock-battle-banner]");
}

function getBattleLog() {
  return document.querySelector("[data-battle-mock-battle-log]");
}

function getBoardGrid() {
  return document.querySelector("[data-battle-mock-board-grid]");
}

function renderTopHud() {
  const root = getTopHud();
  const app = getApp();
  const stageIllustration = getStageIllustration();
  const ornamentLayer = getOrnamentLayer();

  if (app) {
    app.setAttribute("data-battle-mock-theme", activeBossTheme.key);
    app.style.setProperty("--battle-mock-theme-frame", `url("${activeBossTheme.frameAsset}")`);
    app.style.setProperty("--battle-mock-theme-stage", `url("${activeBossTheme.stageAsset}")`);
    app.style.setProperty("--battle-mock-theme-arcana", `url("${activeBossTheme.arcanaAsset}")`);
    app.style.setProperty(
      "--battle-mock-theme-board-floor",
      `url("${activeBossTheme.boardFloorAsset}")`,
    );
    app.style.setProperty(
      "--battle-mock-theme-panel-skin",
      `url("${activeBossTheme.panelSkinAsset}")`,
    );
    app.style.setProperty("--theme-accent", activeBossTheme.accent);
    app.style.setProperty("--theme-accent-soft", activeBossTheme.accentSoft);
    app.style.setProperty("--theme-glow", activeBossTheme.glow);
  }

  if (stageIllustration) {
    stageIllustration.style.setProperty(
      "--battle-mock-theme-stage-illustration",
      `url("${activeBossTheme.stageIllustrationAsset}")`,
    );
  }

  if (ornamentLayer) {
    ornamentLayer.style.setProperty(
      "--battle-mock-theme-ornaments",
      `url("${activeBossTheme.ornamentAsset}")`,
    );
  }

  if (!root) {
    return;
  }

  const row = createElement("div", { className: "battle-mock-top-hud-row" });
  const phaseChip = createElement("div", { className: "battle-mock-phase-chip" });
  const round = createElement("div", {
    className: "battle-mock-round",
    text: topHud.round,
  });
  const spell = createElement("div", {
    className: "battle-mock-spell",
    text: topHud.spell,
  });
  const timer = createElement("div", { className: "battle-mock-timer" });

  phaseChip.append(
    createElement("span", { className: "battle-mock-phase-dot" }),
    createElement("span", { text: topHud.phase }),
  );
  timer.append(
    createElement("img", {
      attributes: { alt: "", src: sharedIcons.timer },
    }),
    createElement("span", { text: topHud.timer }),
  );
  row.append(phaseChip, round, spell, timer);

  root.replaceChildren(row);
}

function renderBattleBanner() {
  const root = getBattleBanner();
  if (!root) {
    return;
  }

  root.classList.toggle("is-transient", battleBanner.mode === "transient");
  root.dataset.mode = battleBanner.mode;
  root.dataset.label = battleBanner.label;
  root.setAttribute("aria-label", battleBanner.label);
  root.replaceChildren(
    createElement("span", {
      className: "battle-mock-battle-banner-sub",
      text: battleBanner.sublabel,
    }),
  );
}

function renderBattleLog() {
  const root = getBattleLog();
  if (!root) {
    return;
  }

  const title = createElement("div", {
    className: "battle-mock-battle-log-title",
    text: "バトルログ",
  });
  const list = createElement("div", { className: "battle-mock-battle-log-list" });

  for (const log of battleLog) {
    const row = createElement("div", { className: "battle-mock-battle-log-row" });
    row.append(
      createElement("span", { text: log.time }),
      createElement("span", { text: log.text }),
    );
    list.append(row);
  }

  root.replaceChildren(title, list);
}

function renderBossHud() {
  const root = getBossHud();
  if (!root) {
    return;
  }

  const card = createHudCard("is-plaque");
  const meter = createMeter(
    "battle-mock-hud-meter",
    bossSummary.hp,
    bossSummary.maxHp,
    activeBossTheme.accent,
  );
  const stats = createElement("div", { className: "battle-mock-hud-stat-grid" });

  stats.append(
    createIconStat(sharedIcons.hp, "HP", `${bossSummary.hp} / ${bossSummary.maxHp}`),
  );

  card.append(
    createHudHeadline(
      "Boss",
      bossSummary.name,
      bossSummary.subtitle,
      resolveFrontPortraitUrl(bossSummary.unitId),
      bossSummary.name,
    ),
    meter,
    stats,
  );

  root.replaceChildren(card);
}

function renderPlayerHud() {
  const root = getPlayerHud();
  if (!root) {
    return;
  }

  const card = createHudCard("is-instrument");
  const stats = createElement("div", { className: "battle-mock-hud-stat-grid" });

  stats.append(
    createIconStat(sharedIcons.hp, "HP", playerSummary.stats.hp),
    createIconStat(sharedIcons.gold, "Gold", playerSummary.stats.gold),
    createIconStat(sharedIcons.level, "Level", playerSummary.stats.level),
  );

  card.append(
    createHudHeadline(
      "Player",
      playerSummary.name,
      playerSummary.subtitle,
      resolveFrontPortraitUrl(playerSummary.unitId),
      playerSummary.name,
    ),
    stats,
  );

  root.replaceChildren(card);
}

function renderAllies() {
  const root = getAllyHud();
  if (!root) {
    return;
  }

  const card = createHudCard("is-slip");
  const head = createElement("div", { className: "battle-mock-hud-card-head" });
  const list = createElement("div", { className: "battle-mock-ally-list" });

  head.append(
    createElement("div", {
      className: "battle-mock-hud-kicker",
      text: "Allies",
    }),
  );

  for (const ally of allies) {
    const allyCard = createElement("article", { className: "battle-mock-ally-card" });
    const avatar = createElement("img", {
      className: "battle-mock-ally-avatar",
      attributes: { alt: ally.name, src: resolveFrontPortraitUrl(ally.unitId) },
    });
    const copy = createElement("div");

    avatar.style.setProperty("border-color", `${ally.accent}55`);
    copy.append(
      createElement("div", {
        className: "battle-mock-ally-name",
        text: ally.name,
      }),
      createElement("div", {
        className: "battle-mock-ally-copy",
        text: ally.copy,
      }),
      createElement("div", {
        className: "battle-mock-ally-meta",
        text: `${ally.role} ・ HP ${ally.hp} / ${ally.maxHp}`,
      }),
    );
    allyCard.append(avatar, copy);
    list.append(allyCard);
  }

  card.append(head, list);
  root.replaceChildren(card);
}

function renderBenchHud() {
  const root = getBenchHud();
  if (!root) {
    return;
  }

  const card = createHudCard("is-shelf");
  const head = createElement("div", { className: "battle-mock-hud-card-head" });
  const list = createElement("div", { className: "battle-mock-bench-list" });

  head.append(
    createElement("div", {
      className: "battle-mock-hud-kicker",
      text: "Bench",
    }),
    createElement("div", {
      className: "battle-mock-hud-state",
      text: "8 slots",
    }),
  );

  benchSlots.forEach((slot, slotIndex) => {
    const className = slot.unitId
      ? `battle-mock-bench-slot${slotIndex < 2 ? " is-highlight" : ""}`
      : "battle-mock-bench-slot is-empty";
    const slotCard = createElement("article", { className });

    if (!slot.unitId) {
      slotCard.append(
        createElement("span", { text: "空き" }),
        createElement("span", { text: `Slot ${slotIndex + 1}` }),
      );
      list.append(slotCard);
      return;
    }

    slotCard.append(
      createElement("img", {
        className: "battle-mock-bench-avatar",
        attributes: { alt: slot.name, src: resolveFrontPortraitUrl(slot.unitId) },
      }),
      createElement("div", {
        className: "battle-mock-bench-name",
        text: slot.name,
      }),
      createElement("div", {
        className: "battle-mock-bench-copy",
        text: slot.note,
      }),
      createElement("div", {
        className: "battle-mock-bench-meta",
        text: `HP ${slot.hp}`,
      }),
    );
    list.append(slotCard);
  });

  card.append(head, list);
  root.replaceChildren(card);
}

function createGridCell(cell, className, label) {
  const rowIndex = Math.floor(cell.index / BOARD_SIZE) + 1;
  const columnIndex = (cell.index % BOARD_SIZE) + 1;

  return createElement("article", {
    className,
    attributes: {
      role: "gridcell",
      "aria-rowindex": rowIndex,
      "aria-colindex": columnIndex,
      "aria-label": `${rowIndex}行${columnIndex}列 ${label}`,
    },
  });
}

function createUnitCombatHud(cell) {
  const wrapper = createElement("div", {
    className: "battle-mock-unit-combat-hud",
  });
  const starCount = cell.zone === "boss" ? 2 : 3;

  wrapper.append(
    createElement("div", {
      className: "battle-mock-unit-stars",
      text: "★".repeat(starCount),
    }),
    createMeter("battle-mock-unit-hp", cell.hp, cell.maxHp, cell.accent),
  );

  return wrapper;
}

function createEmptyCell(cell, zoneClass) {
  return createGridCell(
    cell,
    `battle-mock-cell ${zoneClass}`,
    `盤面の空きマス ${cell.zone === "boss" ? "ボス側" : "レイド側"}`,
  );
}

function createActiveCell(cell, zoneClass) {
  const cellElement = createGridCell(
    cell,
    `battle-mock-cell ${zoneClass} is-active`,
    `${cell.zone === "boss" ? "ボス" : "レイド"}の ${cell.name} HP ${cell.hp} / ${cell.maxHp}`,
  );
  const body = createElement("div", { className: "battle-mock-cell-body" });

  cellElement.style.setProperty("--battle-mock-cell-accent-glow", `${cell.accent}33`);
  body.append(
    createElement("img", {
      className: "battle-mock-cell-portrait",
      attributes: { alt: cell.name, src: resolveFrontPortraitUrl(cell.unitId) },
    }),
    createElement("div", {
      className: "battle-mock-cell-name",
      text: cell.name,
    }),
    createUnitCombatHud(cell),
  );

  cellElement.append(body);
  return cellElement;
}

function renderBoard() {
  const grid = getBoardGrid();
  if (!grid) {
    return;
  }

  grid.setAttribute("aria-rowcount", String(BOARD_SIZE));
  grid.setAttribute("aria-colcount", String(BOARD_SIZE));

  const fragment = document.createDocumentFragment();

  for (let rowIndex = 0; rowIndex < BOARD_SIZE; rowIndex += 1) {
    const row = createElement("div", {
      className: "battle-mock-board-row",
      attributes: { role: "row", "aria-label": `${rowIndex + 1} 行目` },
    });
    const rowCells = boardCells.slice(rowIndex * BOARD_SIZE, (rowIndex + 1) * BOARD_SIZE);

    for (const cell of rowCells) {
      const zoneClass = cell.zone === "boss" ? "is-boss-zone" : "is-raid-zone";
      row.append(
        cell.kind === "empty"
          ? createEmptyCell(cell, zoneClass)
          : createActiveCell(cell, zoneClass),
      );
    }

    fragment.append(row);
  }

  grid.replaceChildren(fragment);
}

function bootstrap() {
  renderTopHud();
  renderBattleBanner();
  renderBattleLog();
  renderBossHud();
  renderPlayerHud();
  renderAllies();
  renderBenchHud();
  renderBoard();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
