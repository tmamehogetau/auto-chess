import { resolveFrontPortraitUrl } from "./portrait-resolver.js";

const bossThemePresets = {
  remilia: {
    key: "remilia",
    label: "Remilia Scarlet",
    stageIllustrationAsset: "./mock-assets/battle-theme-remilia-hall.png",
    ornamentAsset: "./mock-assets/battle-theme-remilia-ornaments.svg",
    arcanaAsset: "./mock-assets/battle-theme-remilia-arcana.svg",
    shelfAsset: "./mock-assets/shop-theme-remilia-shelves.svg",
    counterAsset: "./mock-assets/shop-theme-remilia-counter.svg",
    panelSkinAsset: "./mock-assets/battle-theme-remilia-panel-skin.svg",
    accent: "#ef5b72",
    accentSoft: "rgba(239, 91, 114, 0.24)",
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

const topHud = {
  room: "ルーム",
  round: "Round 3",
  phase: "購入",
  flow: "配置前の準備",
  spell: "レミリア・スカーレット",
  timer: "締切 36",
};

const party = [
  { unitId: "marisa", name: "霧雨魔理沙", hp: 100, accent: "#55c7ef" },
  { unitId: "reimu", name: "博麗霊夢", hp: 100, accent: "#ef5b72" },
  { unitId: "sakuya", name: "十六夜咲夜", hp: 100, accent: "#9ad2ef" },
];

const selectedUnit = {
  unitId: "reimu",
  name: "博麗霊夢",
  cost: 2,
  tags: ["巫女", "陰陽"],
  skillName: "陰陽弾",
  skillCopy: "敵1体に魔法ダメージ。3回ごとに追加で1体に跳弾する。",
  stats: [
    { label: "HP", value: "550" },
    { label: "ATK", value: "40" },
    { label: "MP", value: "25" },
    { label: "AS", value: "0.80" },
    { label: "射程", value: "4格" },
    { label: "会心", value: "25%" },
  ],
};

const commonOffers = [
  {
    unitId: "wakasagihime",
    name: "わかさぎ姫",
    cost: 1,
    rarity: "common",
    tags: ["妖精", "サポート"],
    accent: "#7ed7d8",
  },
  {
    unitId: "murasa",
    name: "村紗水蜜",
    cost: 1,
    rarity: "common",
    tags: ["水棲", "前衛"],
    accent: "#75b7e8",
  },
  {
    unitId: "momoyo",
    name: "姫虫百々世",
    cost: 2,
    rarity: "rare",
    tags: ["天狗", "前衛"],
    accent: "#8fd66b",
  },
  {
    unitId: "rin",
    name: "火焔猫燐",
    cost: 2,
    rarity: "rare",
    tags: ["獣", "アタッカー"],
    accent: "#ef694f",
  },
  {
    unitId: "marisa",
    name: "霧雨魔理沙",
    cost: 1,
    rarity: "common",
    tags: ["魔法使い", "サポート"],
    accent: "#d5b767",
  },
];

const exclusiveOffers = [
  {
    unitId: "marisa",
    name: "霧雨魔理沙",
    cost: 3,
    tags: ["魔法使い", "アタッカー"],
    accent: "#55c7ef",
  },
  {
    unitId: "reimu",
    name: "博麗霊夢",
    cost: 3,
    tags: ["巫女", "サポート"],
    accent: "#ef5b72",
  },
];

const upgrades = [
  {
    title: "主人公強化",
    cost: 4,
    accent: "#f05f55",
    lines: ["霊夢の専用強化", "陰陽弾のダメージ +25%", "跳弾回数 +1"],
  },
];

const playerInfo = {
  gold: 14,
  level: 4,
  xp: 4,
  nextXp: 10,
  hp: 100,
  lives: 3,
};

const benchSlots = [
  { unitId: "sakuya", name: "咲夜", accent: "#9ad2ef" },
  { unitId: "wakasagihime", name: "わかさぎ姫", accent: "#7ed7d8" },
  { unitId: "rin", name: "燐", accent: "#ef694f" },
  { unitId: "patchouli", name: "パチュリー", accent: "#9e6bcb" },
  { unitId: "marisa", name: "魔理沙", accent: "#d5b767" },
  { unitId: "murasa", name: "村紗", accent: "#75b7e8" },
  { unitId: "shou", name: "星", accent: "#e4c057" },
  { unitId: null, name: "空き", accent: "#d3a35d" },
];

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

function createIcon(iconPath, alt = "") {
  return createElement("img", {
    className: "shop-mock-icon",
    attributes: { alt, src: iconPath },
  });
}

function createCoin(cost) {
  const coin = createElement("div", { className: "shop-mock-cost" });
  coin.append(createIcon(sharedIcons.gold), createElement("span", { text: cost }));
  return coin;
}

function createSectionTitle(label, side = "") {
  const title = createElement("div", { className: "shop-mock-section-title" });
  title.append(
    createElement("span", { className: "shop-mock-title-flourish", text: side }),
    createElement("strong", { text: label }),
    createElement("span", { className: "shop-mock-title-flourish", text: side }),
  );
  return title;
}

function createMeter(className, current, max, accent) {
  const meter = createElement("div", { className });
  const fill = createElement("span");
  const percent = Math.max(0, Math.min(100, (current / max) * 100));

  fill.style.setProperty("width", `${percent}%`);
  fill.style.setProperty("background", `linear-gradient(90deg, ${accent}, #f7d28d)`);
  meter.append(fill);
  return meter;
}

function renderTheme() {
  const app = document.querySelector("[data-shop-mock-app]");
  const stageIllustration = document.querySelector("[data-shop-mock-stage-illustration]");
  const shelfLayer = document.querySelector("[data-shop-mock-shelf-layer]");
  const ornamentLayer = document.querySelector("[data-shop-mock-ornaments]");
  const counterSurface = document.querySelector("[data-shop-mock-counter-surface]");

  if (!app) {
    return;
  }

  app.style.setProperty("--shop-mock-theme-arcana", `url("${activeBossTheme.arcanaAsset}")`);
  app.style.setProperty("--shop-mock-theme-panel-skin", `url("${activeBossTheme.panelSkinAsset}")`);
  app.style.setProperty("--theme-accent", activeBossTheme.accent);
  app.style.setProperty("--theme-accent-soft", activeBossTheme.accentSoft);
  app.style.setProperty("--theme-glow", activeBossTheme.glow);

  stageIllustration?.style.setProperty(
    "--shop-mock-theme-stage-illustration",
    `url("${activeBossTheme.stageIllustrationAsset}")`,
  );
  shelfLayer?.style.setProperty("--shop-mock-theme-shelves", `url("${activeBossTheme.shelfAsset}")`);
  ornamentLayer?.style.setProperty(
    "--shop-mock-theme-ornaments",
    `url("${activeBossTheme.ornamentAsset}")`,
  );
  counterSurface?.style.setProperty(
    "--shop-mock-theme-counter",
    `url("${activeBossTheme.counterAsset}")`,
  );
}

function renderTopHud() {
  const root = document.querySelector("[data-shop-mock-top-hud]");
  if (!root) {
    return;
  }

  const roomButton = createElement("button", {
    className: "shop-mock-room-button",
    text: topHud.room,
    attributes: { type: "button" },
  });
  const partyRail = createElement("div", { className: "shop-mock-party-rail" });
  const round = createElement("div", { className: "shop-mock-round" });
  const spell = createElement("div", { className: "shop-mock-spell-banner" });
  const timer = createElement("div", { className: "shop-mock-timer" });

  for (const member of party) {
    const item = createElement("article", { className: "shop-mock-party-member" });
    item.style.setProperty("--member-accent", member.accent);
    item.append(
      createElement("img", {
        attributes: { alt: member.name, src: resolveFrontPortraitUrl(member.unitId) },
      }),
      createElement("span", { text: member.name }),
      createElement("b", { text: member.hp }),
    );
    partyRail.append(item);
  }

  round.append(
    createElement("strong", { text: topHud.round }),
    createElement("span", { text: topHud.phase }),
    createElement("small", { text: topHud.flow }),
  );

  spell.append(
    createElement("img", {
      attributes: { alt: topHud.spell, src: resolveFrontPortraitUrl("remilia") },
    }),
    createElement("span", { text: "Spell" }),
    createElement("strong", { text: topHud.spell }),
  );

  timer.append(createIcon(sharedIcons.timer), createElement("strong", { text: topHud.timer }));
  root.replaceChildren(roomButton, partyRail, round, spell, timer);
}

function renderDetailWing() {
  const root = document.querySelector("[data-shop-mock-detail-wing]");
  if (!root) {
    return;
  }

  const selected = createElement("section", { className: "shop-mock-detail-panel" });
  const portraitPlate = createElement("div", { className: "shop-mock-detail-portrait-plate" });
  const statGrid = createElement("div", { className: "shop-mock-stat-grid" });
  const tagList = createElement("div", { className: "shop-mock-tag-list" });
  const skill = createElement("div", { className: "shop-mock-skill-box" });
  const price = createElement("div", { className: "shop-mock-detail-price" });

  portraitPlate.append(
    createElement("img", {
      attributes: { alt: selectedUnit.name, src: resolveFrontPortraitUrl(selectedUnit.unitId) },
    }),
  );

  for (const tag of selectedUnit.tags) {
    tagList.append(createElement("span", { text: tag }));
  }

  for (const stat of selectedUnit.stats) {
    const item = createElement("div", { className: "shop-mock-stat-item" });
    item.append(createElement("span", { text: stat.label }), createElement("b", { text: stat.value }));
    statGrid.append(item);
  }

  skill.append(
    createElement("strong", { text: selectedUnit.skillName }),
    createElement("span", { text: selectedUnit.skillCopy }),
  );
  price.append(createElement("span", { text: "価格" }), createCoin(selectedUnit.cost));

  selected.append(
    createSectionTitle("詳細", ">>"),
    portraitPlate,
    createElement("div", { className: "shop-mock-selected-name", text: selectedUnit.name }),
    price,
    tagList,
    skill,
    statGrid,
  );

  root.replaceChildren(selected);
}

function createOfferPlate(offer, size = "normal") {
  const plate = createElement("article", {
    className: `shop-mock-offer-plate is-${offer.rarity ?? "exclusive"} is-${size}`,
  });
  const tags = createElement("div", { className: "shop-mock-offer-tags" });
  const portrait = createElement("div", { className: "shop-mock-offer-portrait" });

  plate.style.setProperty("--offer-accent", offer.accent);
  portrait.append(
    createElement("img", {
      attributes: { alt: offer.name, src: resolveFrontPortraitUrl(offer.unitId) },
    }),
  );
  for (const tag of offer.tags) {
    tags.append(createElement("span", { text: tag }));
  }

  plate.append(
    portrait,
    createElement("strong", { className: "shop-mock-offer-name", text: offer.name }),
    tags,
    createCoin(offer.cost),
  );
  return plate;
}

function renderCommonShop() {
  const root = document.querySelector("[data-shop-mock-common-shop]");
  if (!root) {
    return;
  }

  const list = createElement("div", { className: "shop-mock-offer-row" });
  for (const offer of commonOffers) {
    list.append(createOfferPlate(offer));
  }
  root.replaceChildren(createSectionTitle("共通ユニット", ">>"), list);
}

function renderExclusiveShop() {
  const root = document.querySelector("[data-shop-mock-exclusive-shop]");
  if (!root) {
    return;
  }

  const list = createElement("div", { className: "shop-mock-exclusive-row" });

  for (const offer of exclusiveOffers) {
    list.append(createOfferPlate(offer, "wide"));
  }
  root.replaceChildren(createSectionTitle("専用ユニット", ">>"), list);
}

function renderUpgradeShop() {
  const root = document.querySelector("[data-shop-mock-upgrade-shop]");
  if (!root) {
    return;
  }

  const list = createElement("div", { className: "shop-mock-upgrade-row" });
  for (const upgrade of upgrades) {
    const seal = createElement("article", { className: "shop-mock-upgrade-seal" });
    const lines = createElement("div", { className: "shop-mock-upgrade-lines" });
    seal.style.setProperty("--upgrade-accent", upgrade.accent);
    for (const line of upgrade.lines) {
      lines.append(createElement("span", { text: line }));
    }
    seal.append(
      createElement("div", { className: "shop-mock-upgrade-sigil", text: "◆" }),
      createElement("strong", { text: upgrade.title }),
      lines,
      createCoin(upgrade.cost),
    );
    list.append(seal);
  }
  root.replaceChildren(createSectionTitle("主人公強化", ">>"), list);
}

function renderRerollStrip() {
  const root = document.querySelector("[data-shop-mock-reroll-strip]");
  if (!root) {
    return;
  }

  const left = createElement("div", { className: "shop-mock-reroll-copy" });
  const button = createElement("button", {
    className: "shop-mock-reroll-button",
    attributes: { type: "button" },
  });
  const right = createElement("div", { className: "shop-mock-reroll-count" });

  left.append(createElement("strong", { text: "リロール" }), createElement("span", { text: "新しいラインナップに変更" }));
  button.append(createElement("span", { text: "更新" }), createCoin(2));
  right.append(createElement("span", { text: "リロール回数" }), createElement("strong", { text: "2" }));
  root.replaceChildren(left, button, right);
}

function renderPlayerWing() {
  const root = document.querySelector("[data-shop-mock-player-wing]");
  if (!root) {
    return;
  }

  const ledger = createElement("section", { className: "shop-mock-player-ledger" });
  const bench = createElement("section", { className: "shop-mock-bench-panel" });
  const xpLine = createElement("div", { className: "shop-mock-ledger-line" });
  const hpLine = createElement("div", { className: "shop-mock-ledger-line" });
  const benchGrid = createElement("div", { className: "shop-mock-bench-grid" });

  xpLine.append(
    createElement("span", { text: "Level" }),
    createElement("strong", { text: playerInfo.level }),
    createMeter("shop-mock-ledger-meter", playerInfo.xp, playerInfo.nextXp, "#55c7ef"),
    createElement("small", { text: `${playerInfo.xp}/${playerInfo.nextXp}` }),
  );
  hpLine.append(
    createElement("span", { text: "HP" }),
    createElement("strong", { text: playerInfo.hp }),
    createMeter("shop-mock-ledger-meter", playerInfo.hp, 100, "#8fd66b"),
  );

  ledger.append(
    createSectionTitle("プレイヤー情報", ">>"),
    createElement("div", { className: "shop-mock-gold-line", text: "Gold" }),
    createCoin(playerInfo.gold),
    xpLine,
    hpLine,
    createElement("div", {
      className: "shop-mock-lives-line",
      text: `Lives ${"♥".repeat(playerInfo.lives)}`,
    }),
    createElement("button", {
      className: "shop-mock-ready-button",
      text: "Ready",
      attributes: { type: "button" },
    }),
  );

  bench.append(createSectionTitle("ベンチ", ">>"), createElement("div", { className: "shop-mock-bench-count", text: "8 / 8" }));
  for (const slot of benchSlots) {
    const item = createElement("article", {
      className: slot.unitId ? "shop-mock-bench-slot" : "shop-mock-bench-slot is-empty",
    });
    item.style.setProperty("--bench-accent", slot.accent);
    if (slot.unitId) {
      item.append(
        createElement("img", {
          attributes: { alt: slot.name, src: resolveFrontPortraitUrl(slot.unitId) },
        }),
        createElement("span", { text: slot.name }),
      );
    } else {
      item.append(createElement("span", { text: "空き" }));
    }
    benchGrid.append(item);
  }
  bench.append(benchGrid);

  root.replaceChildren(ledger, bench);
}

function renderGuidanceRail() {
  const root = document.querySelector("[data-shop-mock-guidance-rail]");
  if (!root) {
    return;
  }

  root.replaceChildren(
    createElement("span", { className: "shop-mock-guidance-icon", text: "?" }),
    createElement("span", { text: "購入フェーズではユニットの購入や強化を行います。締切までに準備を終えましょう。" }),
  );
}

function bootstrap() {
  renderTheme();
  renderTopHud();
  renderDetailWing();
  renderCommonShop();
  renderExclusiveShop();
  renderUpgradeShop();
  renderRerollStrip();
  renderPlayerWing();
  renderGuidanceRail();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
