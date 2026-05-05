import {
  buildBattleResultCopy,
  buildFinalJudgmentCopy,
  buildLobbyRoleCopy,
  buildPhaseHpCopy,
  buildReadyHint,
  buildRoundSummaryCaption,
  buildRoundSummaryTip,
} from "./ui/player-facing-copy.js";
import { canUseBenchAction, canUseBoardAction, canUseShopAction } from "./player-prep-phase.js";
import { resolveFrontPortraitUrl, resolvePortraitKeyByUnitId, resolveShopPortraitUrl } from "./portrait-resolver.js";
import { getClientSpecialUnitLevel, getClientSpecialUnitUpgradeCost } from "./special-unit-progression.js";
import { mapEntries, readPhase, shortPlayerId } from "./utils/pure-utils.js";

const UNIT_ICONS = {
  vanguard: "盾",
  ranger: "弾",
  mage: "魔",
  assassin: "刃",
};

const UNIT_DETAIL_NAMES = {
  vanguard: "前衛",
  ranger: "射撃",
  mage: "魔法",
  assassin: "奇襲",
};

const HERO_DETAILS = {
  reimu: { name: "博麗霊夢", role: "均衡", hp: 680, attack: 45 },
  marisa: { name: "霧雨魔理沙", role: "火力", hp: 400, attack: 60 },
  okina: { name: "摩多羅隠岐奈", role: "支援", hp: 540, attack: 40 },
  keiki: { name: "埴安神袿姫", role: "支援", hp: 880, attack: 30 },
  jyoon: { name: "依神女苑", role: "火力", hp: 500, attack: 35 },
  yuiman: { name: "ユイマン・浅間", role: "支援", hp: 520, attack: 38 },
};

const BOSS_DETAILS = {
  remilia: { name: "レミリア", roleCopy: "紅魔館の主" },
};

const HERO_SELECTION_NOTES = {
  reimu: "均衡型。前線の隙間を埋めながら安定して戦えます。",
  marisa: "火力型。早めに攻撃札を重ねると押し切りやすいです。",
  okina: "支援型。支援枠を使った位置調整で味方を伸ばします。",
  keiki: "支援型。高いHPで盤面を支え、長期戦に向きます。",
  jyoon: "火力型。攻撃を重ねて短期決着を狙います。",
  yuiman: "支援型。味方の補助と盤面維持を両立します。",
};

const PORTRAIT_KEY_BY_DISPLAY_NAME = {
  "博麗霊夢": "reimu",
  "霧雨魔理沙": "marisa",
  "摩多羅隠岐奈": "okina",
  "埴安神袿姫": "keiki",
  "依神女苑": "jyoon",
  "霊夢": "reimu",
  "魔理沙": "marisa",
  "隠岐奈": "okina",
  "袿姫": "keiki",
  "女苑": "jyoon",
  "ユイマン・浅間": "yuiman",
  "レミリア": "remilia",
};

const SPELL_DETAILS = {
  "instant-1": { name: "紅符「スカーレットシュート」", description: "マナ発動: 攻撃力依存の直線貫通レーザー" },
  "instant-2": { name: "必殺「ハートブレイク」", description: "マナ発動: 最高攻撃力の敵を狙う攻撃力依存の直線貫通攻撃" },
  "instant-3": { name: "神槍「スピア・ザ・グングニル」", description: "マナ発動: 最高攻撃力の敵を狙う高威力の直線貫通攻撃" },
  "area-1": { name: "紅符「不夜城レッド」", description: "マナ発動: 上下左右2マスに攻撃力依存ダメージ" },
  "area-2": { name: "紅魔「スカーレットデビル」", description: "マナ発動: 周囲2マスに攻撃力依存ダメージ" },
  "area-3": { name: "魔符「全世界ナイトメア」", description: "マナ発動: 敵全体に攻撃力依存ダメージ" },
  "rush-1": { name: "夜符「デーモンキングクレイドル」", description: "マナ発動: 盤面端まで横突進し上下1マスにも攻撃力依存ダメージ" },
  "rush-2": { name: "夜符「バッドレディスクランブル」", description: "マナ発動: 盤面端まで横突進し上下1マスにも攻撃力依存ダメージ" },
  "rush-3": { name: "夜王「ドラキュラクレイドル」", description: "マナ発動: 縦に最大1マス軌道調整して横突進し上下1マスにも攻撃力依存ダメージ" },
  "last-word": { name: "「紅色の幻想郷」", description: "マナ発動: 敵全体へ永続DoT、5秒ごとにDoTとボス攻撃バフが累積" },
};

const RESULT_IMPRINT_BOARD_WIDTH = 6;
const RESULT_IMPRINT_BOARD_HEIGHT = 6;
const MAX_RAID_BOARD_UNITS = 2;
const MAX_BOSS_BOARD_UNITS = 6;

function buildHeroRuleLines(heroId) {
  const lines = ["位置交換可"];

  if (heroId === "okina") {
    lines.push("支援枠可");
  }

  return lines;
}

function buildSelectionDetailMarkup({ isBossPlayer, selectedHeroId, selectedBossId }) {
  if (isBossPlayer) {
    const bossId = selectedBossId || "remilia";
    const bossDetail = BOSS_DETAILS[bossId] ?? BOSS_DETAILS.remilia;
    const portraitUrl = resolvePortraitUrlFromKey(bossId, "remilia") ?? "";

    return `
      <div class="player-selection-picked-card">
        <span class="player-selection-picked-portrait">${portraitUrl
          ? `<img src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(bossDetail.name)}" loading="lazy" />`
          : escapeHtml(getDisplayInitial(bossDetail.name))}</span>
        <span class="player-selection-picked-copy">
          <span class="player-selection-picked-kicker">選択中のボス</span>
          <strong>${escapeHtml(bossDetail.name)}</strong>
          <span>${escapeHtml(bossDetail.roleCopy)}</span>
        </span>
      </div>
    `;
  }

  if (!selectedHeroId) {
    return `
      <div class="player-selection-picked-card">
        <span class="player-selection-picked-portrait">?</span>
        <span class="player-selection-picked-copy">
          <span class="player-selection-picked-kicker">選択中の主人公</span>
          <strong>未選択</strong>
          <span>右の札から主人公を選んでください。</span>
        </span>
      </div>
    `;
  }

  const heroId = selectedHeroId;
  const heroDetail = HERO_DETAILS[heroId] ?? HERO_DETAILS.reimu;
  const portraitUrl = resolvePortraitUrlFromKey(heroId, "reimu") ?? "";
  const ruleLines = buildHeroRuleLines(heroId).join(" / ");
  const note = HERO_SELECTION_NOTES[heroId] ?? "選択中の主人公を中心に編成します。";

  return `
    <div class="player-selection-picked-card">
      <span class="player-selection-picked-portrait">${portraitUrl
        ? `<img src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(heroDetail.name)}" loading="lazy" />`
        : escapeHtml(getDisplayInitial(heroDetail.name))}</span>
      <span class="player-selection-picked-copy">
        <span class="player-selection-picked-kicker">選択中の主人公</span>
        <strong>${escapeHtml(heroDetail.name)}</strong>
        <span>${escapeHtml(heroDetail.role)} / HP ${escapeHtml(heroDetail.hp)} / ATK ${escapeHtml(heroDetail.attack)}</span>
      </span>
    </div>
    <div class="player-selection-picked-note">
      <strong>${escapeHtml(ruleLines)}</strong>
      <span>${escapeHtml(note)}</span>
    </div>
  `;
}

function buildSelectionFeatureMarkup({ isBossPlayer, selectedHeroId, selectedBossId }) {
  if (isBossPlayer) {
    const bossId = selectedBossId || "remilia";
    const bossDetail = BOSS_DETAILS[bossId] ?? BOSS_DETAILS.remilia;
    const portraitUrl = resolvePortraitUrlFromKey(bossId, "remilia") ?? "";

    return `
      <div class="player-selection-feature-portrait">
        ${portraitUrl
          ? `<img src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(bossDetail.name)}" loading="lazy" />`
          : `<span>${escapeHtml(getDisplayInitial(bossDetail.name))}</span>`}
      </div>
    `;
  }

  if (!selectedHeroId) {
    return `
      <div class="player-selection-feature-portrait">
        <span>?</span>
      </div>
    `;
  }

  const heroDetail = HERO_DETAILS[selectedHeroId] ?? HERO_DETAILS.reimu;
  const portraitUrl = resolvePortraitUrlFromKey(selectedHeroId, "reimu") ?? "";

  return `
    <div class="player-selection-feature-portrait">
      ${portraitUrl
        ? `<img src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(heroDetail.name)}" loading="lazy" />`
        : `<span>${escapeHtml(getDisplayInitial(heroDetail.name))}</span>`}
    </div>
  `;
}

function buildSelectionDetailText({ isBossPlayer, selectedHeroId, selectedBossId }) {
  if (isBossPlayer) {
    const bossId = selectedBossId || "remilia";
    const bossDetail = BOSS_DETAILS[bossId] ?? BOSS_DETAILS.remilia;
    return `選択中のボス ${bossDetail.name} ${bossDetail.roleCopy}`;
  }

  if (!selectedHeroId) {
    return "選択中の主人公 未選択";
  }

  const heroDetail = HERO_DETAILS[selectedHeroId] ?? HERO_DETAILS.reimu;
  const ruleLines = buildHeroRuleLines(selectedHeroId).join(" / ");
  const note = HERO_SELECTION_NOTES[selectedHeroId] ?? "選択中の主人公を中心に編成します。";
  return `選択中の主人公 ${heroDetail.name} ${heroDetail.role} / HP ${heroDetail.hp} / ATK ${heroDetail.attack} ${ruleLines} ${note}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isFakeElement(element) {
  return !element || !("ownerDocument" in element);
}

function setElementMarkup(element, html, fallbackText = "") {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (isFakeElement(element)) {
    if (element.innerHTML === html && element.textContent === fallbackText) {
      return;
    }
    element.innerHTML = html;
    element.textContent = fallbackText;
    return;
  }

  if (element.innerHTML === html) {
    return;
  }
  element.innerHTML = html;
}

function setElementChildren(element, children) {
  const nextChildren = children.filter(Boolean);
  if (typeof element?.replaceChildren === "function") {
    element.replaceChildren(...nextChildren);
    return;
  }

  if (Array.isArray(element?.children)) {
    element.children = nextChildren;
  }
}

function getElementRenderCache(element, cacheKey, createCache) {
  if (!element) {
    return createCache();
  }

  if (!element[cacheKey]) {
    element[cacheKey] = createCache();
  }

  return element[cacheKey];
}

function getDisplayInitial(value = "") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text.slice(0, 1) : "?";
}

function resolvePortraitUrlFromKey(key, fallbackKey = "meiling") {
  return typeof key === "string" && key.length > 0
    ? resolveFrontPortraitUrl(key, fallbackKey)
    : null;
}

function resolvePortraitUrlFromDisplayName(displayName, fallbackKey = "meiling") {
  if (typeof displayName !== "string" || displayName.length === 0) {
    return null;
  }

  const portraitKey = PORTRAIT_KEY_BY_DISPLAY_NAME[displayName] ?? null;
  return portraitKey ? resolveFrontPortraitUrl(portraitKey, fallbackKey) : null;
}

function resolveHoverDetailPortraitUrl(detail) {
  if (typeof detail?.portraitUrl === "string" && detail.portraitUrl.length > 0) {
    return detail.portraitUrl;
  }

  if (typeof detail?.portraitKey === "string" && detail.portraitKey.length > 0) {
    return resolveFrontPortraitUrl(detail.portraitKey, "meiling");
  }

  return resolvePortraitUrlFromDisplayName(detail?.title, "meiling");
}

function resolveBenchPortraitUrl(unit, displayName, benchUnitId = "") {
  if (typeof unit?.portraitUrl === "string" && unit.portraitUrl.length > 0) {
    return unit.portraitUrl;
  }

  if (typeof unit?.portraitKey === "string" && unit.portraitKey.length > 0) {
    return resolveFrontPortraitUrl(unit.portraitKey, "meiling");
  }

  if (typeof unit?.unitId === "string" && unit.unitId.length > 0) {
    return resolveShopPortraitUrl({
      unitId: unit.unitId,
      unitType: typeof unit?.unitType === "string" ? unit.unitType : "",
    });
  }

  if (typeof benchUnitId === "string" && benchUnitId.length > 0) {
    return resolveShopPortraitUrl({
      unitId: benchUnitId,
      unitType: resolveBenchUnitType(unit),
    });
  }

  if (typeof unit === "string" && unit.length > 0) {
    const [unitType] = unit.split("-");
    if (unitType) {
      return resolveShopPortraitUrl({ unitType });
    }
  }

  return resolvePortraitUrlFromDisplayName(displayName, "meiling");
}

function resolveUnitDetailName(unitType, displayName = "") {
  if (typeof displayName === "string" && displayName.length > 0) {
    return displayName;
  }

  if (typeof unitType !== "string" || unitType.length === 0) {
    return "Unknown";
  }

  return UNIT_DETAIL_NAMES[unitType] ?? unitType;
}

function renderPrepDetailCard(detailCardElement, hoverDetail) {
  if (!(detailCardElement instanceof HTMLElement)) {
    return;
  }

  const kicker = typeof hoverDetail?.kicker === "string" && hoverDetail.kicker.length > 0
    ? hoverDetail.kicker
    : "詳細";
  const title = typeof hoverDetail?.title === "string" && hoverDetail.title.length > 0
    ? hoverDetail.title
    : "何も選ばれていません";
  const lines = Array.isArray(hoverDetail?.lines) && hoverDetail.lines.length > 0
    ? hoverDetail.lines
    : [
      "選択したユニットの詳細をここに表示します。",
      "主人公、味方主人公、味方ベンチ、共有盤面の支援効果もここで確認できます。",
    ];
  const statEntries = [];
  const noteLines = [];
  for (const line of lines) {
    if (typeof line !== "string" || line.length === 0) {
      continue;
    }

    if (line.startsWith("HP ")) {
      statEntries.push({ label: "HP", value: line.replace("HP ", "") });
      continue;
    }

    if (line.startsWith("ATK ")) {
      statEntries.push({ label: "ATK", value: line.replace("ATK ", "") });
      continue;
    }

    if (statEntries.length === 0) {
      statEntries.push({ label: "役割", value: line });
      continue;
    }

    noteLines.push(line);
  }

  const statsToRender = statEntries.slice(0, 3);
  const summaryLine = noteLines[0] ?? lines[0] ?? "";
  const effectLine = noteLines.slice(1).join(" / ") || noteLines[0] || "選択した対象の補足がここに出ます。";
  const portraitUrl = resolveHoverDetailPortraitUrl(hoverDetail);
  const statsMarkup = statsToRender.map((entry) => `
      <div class="player-detail-stat">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${escapeHtml(entry.value)}</span>
      </div>
    `).join("");
  const html = `
    <strong>詳細</strong>
    <div class="player-detail-head">
      <div class="player-detail-portrait">${portraitUrl
        ? `<img class="player-detail-portrait-img" src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(title)}" loading="lazy" />`
        : escapeHtml(getDisplayInitial(title))}</div>
      <div class="player-detail-main">
        <div class="player-detail-kicker player-ally-card-copy">${escapeHtml(kicker)}</div>
        <div class="player-detail-title player-ally-card-copy"><strong>${escapeHtml(title)}</strong></div>
        <div class="player-detail-tags">
          <span class="player-detail-tag">${escapeHtml(kicker)}</span>
          <span class="player-detail-tag">${escapeHtml(statsToRender[0]?.value ?? "情報")}</span>
        </div>
        <div class="player-detail-lines player-ally-card-copy">${escapeHtml(summaryLine)}</div>
      </div>
    </div>
    <div class="player-detail-stats">${statsMarkup}</div>
    <div class="player-detail-effect"><strong>効果</strong><div>${escapeHtml(effectLine)}</div></div>
  `;
  setElementMarkup(detailCardElement, html, `詳細 ${title} ${lines.join(" / ")}`);
}

function createHoverChip({ target, label, detail, onHoverDetailChange, variant = "", subtitle = "", portraitUrl = "" }) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `player-choice-btn player-slot-btn player-ally-card ${variant}`.trim();
  chip.dataset.hoverDetailTarget = target;
  chip.textContent = label;
  if (!isFakeElement(chip)) {
    chip.innerHTML = `
      <span class="player-ally-card-avatar">${portraitUrl
        ? `<img class="player-ally-card-avatar-img" src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(label)}" loading="lazy" />`
        : escapeHtml(getDisplayInitial(label))}</span>
      <span class="player-ally-card-body">
        <span class="player-ally-card-title">${escapeHtml(label)}</span>
        <span class="player-ally-card-meta">${escapeHtml(subtitle)}</span>
      </span>
    `;
  }
  chip.onmouseenter = () => {
    onHoverDetailChange?.(detail);
  };
  chip.onfocus = () => {
    onHoverDetailChange?.(detail);
  };
  chip.onmouseleave = () => {
    onHoverDetailChange?.(null);
  };
  chip.onblur = () => {
    onHoverDetailChange?.(null);
  };
  return chip;
}

function buildHeroHoverDetail(heroId, kicker, bossId = "") {
  if (typeof heroId === "string" && heroId.length > 0) {
    const heroDetail = HERO_DETAILS[heroId];
    if (heroDetail) {
      return {
        kicker,
        title: heroDetail.name,
        portraitKey: heroId,
        lines: [
          heroDetail.role,
          `HP ${heroDetail.hp}`,
          `ATK ${heroDetail.attack}`,
          ...buildHeroRuleLines(heroId),
        ],
      };
    }
  }

  if (typeof bossId === "string" && bossId.length > 0) {
    const bossDetail = BOSS_DETAILS[bossId];
    if (bossDetail) {
      return {
        kicker,
        title: bossDetail.name,
        portraitKey: bossId,
        lines: [bossDetail.roleCopy, "共有ボードでは位置だけ調整できます。"],
      };
    }
  }

  return null;
}

function buildBenchHoverDetail(unit, displayName, kicker = "味方ベンチ") {
  const title = formatBenchUnitLabel(unit, displayName);
  if (!title) {
    return null;
  }

  const unitType = resolveBenchUnitType(unit) || title;
  const unitLevel = resolveBenchUnitLevel(unit);
  const lines = [];

  if (unitLevel > 1) {
    lines.push(`LV ${unitLevel}`);
  }
  lines.push("ベンチユニット", `${unitType}`);

  return {
    kicker,
    title,
    lines,
  };
}

function formatUnitTypeName(unitType) {
  return UNIT_DETAIL_NAMES[unitType] ?? unitType ?? "不明";
}

function getOfferRarityLabel(offer, labelPrefix = "") {
  const rarity = Number(offer?.rarity);
  if (Number.isFinite(rarity) && rarity > 0) {
    return `★${Math.min(5, Math.max(1, Math.round(rarity)))}`;
  }

  if (labelPrefix) {
    return labelPrefix;
  }

  return "標準";
}

function countOwnedOfferType(offer, { benchUnits = [], benchUnitIds = [], boardUnits = [] } = {}) {
  const offerUnitId = typeof offer?.unitId === "string" ? offer.unitId : "";
  const offerUnitType = typeof offer?.unitType === "string" ? offer.unitType : "";
  if (!offerUnitId && !offerUnitType) {
    return 0;
  }

  const ownedTokens = [
    ...toRenderableArray(benchUnits),
    ...toRenderableArray(benchUnitIds),
    ...toRenderableArray(boardUnits),
  ];

  return ownedTokens.filter((token) => {
    if (typeof token === "string") {
      return (offerUnitId && token.includes(offerUnitId)) || (offerUnitType && resolveBenchUnitType(token) === offerUnitType);
    }

    return (offerUnitId && token?.unitId === offerUnitId) || (offerUnitType && token?.unitType === offerUnitType);
  }).length;
}

function buildOfferDecisionMeta({ offer, gold = 0, ownedCount = 0, labelPrefix = "" }) {
  const unitType = typeof offer?.unitType === "string" ? offer.unitType : "";
  const cost = Math.max(0, Math.round(Number(offer?.cost) || 0));
  const canAfford = gold >= cost;
  const unitIcon = UNIT_ICONS[unitType] ?? "札";
  const roleLabel = formatUnitTypeName(unitType);
  const rarityLabel = getOfferRarityLabel(offer, labelPrefix);
  const buyState = canAfford ? "購入可" : `${cost - gold}G不足`;
  const ownedLabel = ownedCount > 0 ? `所持${ownedCount}` : "未所持";
  const hint = ownedCount > 0
    ? "重ね候補"
    : unitType === "vanguard"
      ? "前列補強"
      : unitType === "mage"
        ? "火力支援"
        : unitType === "ranger"
          ? "後列火力"
          : unitType === "assassin"
            ? "突破役"
            : "編成候補";

  return {
    unitIcon,
    roleLabel,
    rarityLabel,
    buyState,
    ownedLabel,
    hint,
    cost,
  };
}

function buildReadyChecklistItems({ player, selectedHeroId, selectedBossId, isBossPlayer, boardUnitCount, placementLimit }) {
  const hasSpecialUnit = isBossPlayer ? selectedBossId.length > 0 : selectedHeroId.length > 0;
  const hasBoardPlan = boardUnitCount > 0 || isBossPlayer;
  const isReady = player?.ready === true;

  return [
    { label: isBossPlayer ? "ボス選択" : "主人公選択", done: hasSpecialUnit },
    { label: `配置 ${boardUnitCount}/${placementLimit}`, done: hasBoardPlan && boardUnitCount <= placementLimit },
    { label: "Ready", done: isReady },
  ];
}

function buildReadyChecklistMarkup(items) {
  return `
    <div class="player-ready-checklist" aria-label="準備チェック">
      ${items.map((item) => `
        <span class="player-ready-check ${item.done ? "is-done" : "is-open"}">
          <span class="player-ready-check-mark">${item.done ? "✓" : "!"}</span>
          <span>${escapeHtml(item.label)}</span>
        </span>
      `).join("")}
    </div>
  `;
}

function buildBattlePlayerRows({ state, player, sessionId }) {
  const rows = [];
  const activePlayers = mapEntries(state?.players)
    .filter(([, currentPlayer]) => currentPlayer?.isSpectator !== true);

  if (activePlayers.length > 0) {
    for (const [playerId, currentPlayer] of activePlayers) {
      const heroId = typeof currentPlayer?.selectedHeroId === "string" && currentPlayer.selectedHeroId.length > 0
        ? currentPlayer.selectedHeroId
        : typeof currentPlayer?.selectedBossId === "string" && currentPlayer.selectedBossId.length > 0
          ? currentPlayer.selectedBossId
          : "";
      const heroDetail = HERO_DETAILS[heroId] ?? BOSS_DETAILS[heroId] ?? null;
      const name = heroDetail?.name ?? shortPlayerId(playerId);
      const hp = Math.max(0, Math.round(Number(currentPlayer?.hp ?? currentPlayer?.currentHp ?? 0) || 0));
      const maxHp = Math.max(hp, Math.round(Number(currentPlayer?.maxHp ?? 100) || 100));
      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))) : 0;
      const isSelf = playerId === sessionId;
    rows.push({
      name,
      heroId,
      hp,
      hpPercent,
      state: currentPlayer?.ready === true ? "Ready" : "準備中",
      isSelf,
    });
    }
  }

  if (rows.length === 0) {
    const selectedHeroId = typeof player?.selectedHeroId === "string" ? player.selectedHeroId : "";
    const selectedBossId = typeof player?.selectedBossId === "string" ? player.selectedBossId : "";
    const heroId = selectedHeroId || selectedBossId || "reimu";
    const heroDetail = HERO_DETAILS[heroId] ?? BOSS_DETAILS[heroId] ?? HERO_DETAILS.reimu;
    rows.push({
      name: heroDetail.name,
      heroId,
      hp: Math.max(0, Math.round(Number(player?.hp ?? 0) || 0)),
      hpPercent: 100,
      state: "自分",
      isSelf: true,
    });
  }

  return rows.slice(0, 8);
}

function renderBattlePlayerStatusSlots({ benchSlotElements, state, player, sessionId }) {
  const rows = buildBattlePlayerRows({ state, player, sessionId });
  benchSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const row = rows[index];
    button.disabled = true;
    button.classList.toggle("player-bench-slot-filled", Boolean(row));
    button.classList.toggle("player-bench-slot-empty", !row);
    button.classList.toggle("player-battle-player-row", Boolean(row));
    button.classList.toggle("is-self", row?.isSelf === true);
    button.classList.toggle("selected", false);

    if (!row) {
      setElementMarkup(button, `<span class="player-shop-offer-empty">空席</span>`, "空席");
      return;
    }

    const portraitUrl = resolvePortraitUrlFromKey(row.heroId, "reimu") ?? "";
    setElementMarkup(
      button,
      `
        <span class="player-bench-slot-avatar">${portraitUrl
          ? `<img class="player-bench-slot-avatar-img" src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(row.name)}" loading="lazy" />`
          : escapeHtml(getDisplayInitial(row.name))}</span>
        <span class="player-battle-player-body">
          <span class="player-battle-player-heading">
            <span class="player-bench-slot-name">${escapeHtml(row.name)}</span>
            <span class="player-battle-player-hp-value">HP ${escapeHtml(row.hp)}</span>
          </span>
          <span class="player-battle-player-hp"><span style="width:${escapeHtml(`${row.hpPercent}%`)}"></span></span>
          <span class="player-bench-slot-state">${escapeHtml(row.state)}</span>
        </span>
      `,
      `${row.name} HP ${row.hp} ${row.state}`,
    );
  });
}

function renderPrepAllyRail({
  allyRailElement,
  state,
  player,
  sessionId,
  onHoverDetailChange,
  playerFacingPhase = "lobby",
}) {
  if (!(allyRailElement instanceof HTMLElement)) {
    return;
  }

  const allyRailSignature = JSON.stringify({
    sessionId,
    selfHeroId: typeof player?.selectedHeroId === "string" ? player.selectedHeroId : "",
    selfBossId: typeof player?.selectedBossId === "string" ? player.selectedBossId : "",
    selfLives: Number(player?.remainingLives ?? 0),
    playerFacingPhase,
    declaredSpellId: typeof state?.declaredSpellId === "string" ? state.declaredSpellId : "",
    players: mapEntries(state?.players)
      .filter(([, allyPlayer]) => allyPlayer?.isSpectator !== true)
      .map(([playerId, allyPlayer]) => ({
        playerId,
        heroId: typeof allyPlayer?.selectedHeroId === "string" ? allyPlayer.selectedHeroId : "",
        lives: Number(allyPlayer?.remainingLives ?? 0),
      })),
  });
  if (allyRailElement.dataset.renderSignature === allyRailSignature) {
    return;
  }
  allyRailElement.dataset.renderSignature = allyRailSignature;

  allyRailElement.innerHTML = "";
  allyRailElement.textContent = "";

  if (playerFacingPhase === "battle") {
    const declaredSpellId = typeof state?.declaredSpellId === "string" ? state.declaredSpellId : "";
    const spellDetail = SPELL_DETAILS[declaredSpellId] ?? null;
    const effectCopy = spellDetail
      ? spellDetail.name
      : "スペル待ち";
    setElementMarkup(
      allyRailElement,
      `
        <strong>攻略情報</strong>
        <div class="player-battle-intel">
          <div class="player-battle-intel-row">
            <span>勝利条件</span>
            <strong>${state?.bossPlayerId ? "ボスHPを削り切る" : "フェーズ目標を達成"}</strong>
          </div>
          <div class="player-battle-intel-row">
            <span>ボス効果</span>
            <strong>紅霧の夜</strong>
          </div>
          <div class="player-battle-intel-note">${escapeHtml(effectCopy)}</div>
        </div>
      `,
      `攻略情報 勝利条件 ${effectCopy}`,
    );
    return;
  }

  const title = typeof document !== "undefined" && typeof document.createElement === "function"
    ? document.createElement("strong")
    : null;
  if (title) {
    title.textContent = "Allies";
    allyRailElement.appendChild(title);
  }

  const appendAllyPanel = (label, chip) => {
    if (!chip || typeof document === "undefined" || typeof document.createElement !== "function") {
      return;
    }

    const panel = document.createElement("div");
    panel.className = "player-ally-panel";

    const panelLabel = document.createElement("div");
    panelLabel.className = "player-ally-panel-label";
    panelLabel.textContent = label;

    panel.append(panelLabel, chip);
    allyRailElement.appendChild(panel);
  };

  const selfHeroId = typeof player?.selectedHeroId === "string" ? player.selectedHeroId : "";
  const selfBossId = typeof player?.selectedBossId === "string" ? player.selectedBossId : "";
  const selfLives = Math.max(0, Math.round(Number(player?.remainingLives ?? 0) || 0));
  const selfHeroDetail = buildHeroHoverDetail(selfHeroId, "味方主人公", selfBossId);
  if (selfHeroDetail) {
    const selfHeroChip = createHoverChip({
      target: "self-hero",
      label: selfHeroDetail.title,
      detail: selfHeroDetail,
      onHoverDetailChange,
      variant: "player-ally-chip-self",
      subtitle: selfLives > 0 ? `残機 ${selfLives}` : "your hero",
      portraitUrl: resolvePortraitUrlFromKey(selfHeroId || selfBossId, "meiling") ?? "",
    });
    appendAllyPanel("You", selfHeroChip);
  }

  let allyIndex = 0;
  for (const [playerId, allyPlayer] of mapEntries(state?.players)) {
    if (playerId === sessionId || allyPlayer?.isSpectator === true) {
      continue;
    }

    const allyHeroId = typeof allyPlayer?.selectedHeroId === "string" ? allyPlayer.selectedHeroId : "";
    const allyLives = Math.max(0, Math.round(Number(allyPlayer?.remainingLives ?? 0) || 0));
    const allyHeroDetail = buildHeroHoverDetail(allyHeroId, "Ally Hero");
    if (allyHeroDetail) {
      const allyHeroChip = createHoverChip({
        target: "ally-hero",
        label: allyHeroDetail.title,
        detail: allyHeroDetail,
        onHoverDetailChange,
        variant: "player-ally-chip-ally",
        subtitle: allyLives > 0 ? `残機 ${allyLives}` : "ally hero",
        portraitUrl: resolvePortraitUrlFromKey(allyHeroId, "meiling") ?? "",
      });
      allyIndex += 1;
      appendAllyPanel(`Ally ${String.fromCharCode(64 + allyIndex)}`, allyHeroChip);
    }
  }

  if (allyRailElement.children.length <= 1) {
    allyRailElement.textContent = "味方情報の到着待ちです。";
  }
}

function updateBenchSlotButton(button, { unitText, portraitUrl, isSelected }) {
  const cache = getElementRenderCache(button, "__benchRenderCache", () => ({
    avatar: document.createElement("span"),
    avatarImg: document.createElement("img"),
    copy: document.createElement("span"),
    name: document.createElement("span"),
    state: document.createElement("span"),
    empty: document.createElement("span"),
  }));

  cache.avatar.className = "player-bench-slot-avatar";
  cache.copy.className = "player-bench-slot-copy";
  cache.name.className = "player-bench-slot-name";
  cache.state.className = "player-bench-slot-state";
  cache.empty.className = "player-bench-slot-empty-copy";

  if (unitText) {
    if (portraitUrl) {
      cache.avatarImg.className = "player-bench-slot-avatar-img";
      cache.avatarImg.src = portraitUrl;
      cache.avatarImg.alt = unitText;
      cache.avatarImg.loading = "lazy";
      setElementChildren(cache.avatar, [cache.avatarImg]);
      if (isFakeElement(cache.avatar)) {
        cache.avatar.textContent = "";
      }
    } else {
      setElementChildren(cache.avatar, []);
      cache.avatar.textContent = getDisplayInitial(unitText);
    }

    cache.name.textContent = unitText;
    cache.state.textContent = isSelected ? "selected" : "reserve";
    setElementChildren(cache.copy, [cache.name, cache.state]);
    setElementChildren(button, [cache.avatar, cache.copy]);
    if (isFakeElement(button)) {
      button.textContent = unitText;
    }
    return;
  }

  cache.empty.textContent = "空き";
  setElementChildren(button, [cache.empty]);
  if (isFakeElement(button)) {
    button.textContent = "空き";
  }
}

function resolveOfferPortraitUrl(offer) {
  if (!offer) {
    return "";
  }

  if (typeof offer.portraitUrl === "string" && offer.portraitUrl.length > 0) {
    return offer.portraitUrl;
  }

  if (typeof offer.portraitKey === "string" && offer.portraitKey.length > 0) {
    return resolveFrontPortraitUrl(offer.portraitKey, "meiling");
  }

  return resolveShopPortraitUrl({
    unitId: typeof offer.unitId === "string" ? offer.unitId : "",
    unitType: typeof offer.unitType === "string" ? offer.unitType : "",
  });
}

function updateShopOfferButton(button, {
  offer,
  labelPrefix = "",
  fallbackLabel,
  disabledLabel,
  gold = 0,
  ownedCount = 0,
}) {
  if (!offer) {
    button.classList.remove(
      "player-shop-offer-affordable",
      "player-shop-offer-unaffordable",
      "player-shop-offer-owned",
      "player-shop-offer-stack-candidate",
    );
    setElementMarkup(
      button,
      `<span class="player-shop-offer-empty"><span>空き札</span><strong>${escapeHtml(disabledLabel)}</strong></span>`,
      disabledLabel,
    );
    return;
  }

  const unitType = typeof offer?.unitType === "string" ? offer.unitType : "";
  const cost = Math.max(0, Math.round(Number(offer?.cost) || 0));
  const displayName = typeof offer?.displayName === "string" && offer.displayName.length > 0
    ? offer.displayName
    : fallbackLabel;
  const portraitUrl = resolveOfferPortraitUrl(offer);
  const decisionMeta = buildOfferDecisionMeta({ offer, gold, ownedCount, labelPrefix });
  const unitIcon = UNIT_ICONS[unitType] ?? (labelPrefix ? "◆" : "?");
  const canAfford = gold >= cost;
  button.classList.toggle("player-shop-offer-affordable", canAfford);
  button.classList.toggle("player-shop-offer-unaffordable", !canAfford);
  button.classList.toggle("player-shop-offer-owned", ownedCount > 0);
  button.classList.toggle("player-shop-offer-stack-candidate", ownedCount > 0 && canAfford);
  const fallbackText = `${unitIcon} ${labelPrefix ? `${labelPrefix} ` : ""}${displayName} / ${decisionMeta.roleLabel} / ${decisionMeta.buyState} / ${cost}G`;
  const tagText = decisionMeta.buyState === "購入可"
    ? `${decisionMeta.roleLabel}${ownedCount > 0 ? ` / ${decisionMeta.ownedLabel}` : ""}`
    : decisionMeta.buyState;

  setElementMarkup(
    button,
    `
      <span class="player-shop-offer-portrait">${portraitUrl
        ? `<img class="player-shop-offer-portrait-img" src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" />`
        : escapeHtml(getDisplayInitial(displayName))}</span>
      <span class="player-shop-offer-copy">
        <span class="player-shop-offer-badges">
          <span class="player-shop-offer-role">${escapeHtml(decisionMeta.unitIcon)}</span>
        </span>
        <span class="player-shop-offer-name">${escapeHtml(displayName)}</span>
        <span class="player-shop-offer-tags">${escapeHtml(tagText)}</span>
      </span>
      <span class="player-shop-offer-state">${escapeHtml(ownedCount > 0 ? decisionMeta.hint : decisionMeta.buyState)}</span>
      <span class="player-shop-offer-cost">${escapeHtml(`${cost}G`)}</span>
    `,
    fallbackText,
  );
}

function resolvePlacementLimit(isBossPlayer) {
  return isBossPlayer ? MAX_BOSS_BOARD_UNITS : MAX_RAID_BOARD_UNITS;
}

function resolvePlayerStateLabel({ currentPhase, playerFacingPhase, isReady }) {
  if (isReady) {
    return "準備完了";
  }

  if (playerFacingPhase === "purchase") {
    return "購入";
  }

  if (playerFacingPhase === "deploy") {
    return "配置";
  }

  if (playerFacingPhase === "battle") {
    return "戦闘";
  }

  const normalizedPhase = readPhase(currentPhase);
  if (normalizedPhase === "Prep") {
    return "準備";
  }

  if (normalizedPhase === "Settle") {
    return "結果";
  }

  return normalizedPhase;
}

function getActivePlayers(state) {
  return mapEntries(state?.players)
    .map(([, player]) => player)
    .filter((player) => player?.isSpectator !== true);
}

export function renderPlayerLobbySummary({ participantSummaryElement, state }) {
  if (!(participantSummaryElement instanceof HTMLElement)) {
    return;
  }

  const players = getActivePlayers(state);
  const totalPlayers = players.length;
  const expectedPlayers = Number.isInteger(state?.maxPlayers) && state.maxPlayers > 0
    ? state.maxPlayers
    : totalPlayers;
  const readyPlayers = players.filter((player) => player?.ready === true).length;
  const seatCopy = expectedPlayers > totalPlayers
    ? `あと ${expectedPlayers - totalPlayers} 人の参加待ち`
    : expectedPlayers > 0
      ? "全員 Ready で role selection へ"
      : "プレイヤー接続待ち";
  setElementMarkup(
    participantSummaryElement,
    `<div class="player-lobby-meter">
      <span>${readyPlayers}</span><small>/ ${expectedPlayers} ready</small>
    </div>
    <div class="player-lobby-state-copy">${escapeHtml(seatCopy)}</div>`,
    `${readyPlayers} / ${expectedPlayers} ready。${seatCopy}。`,
  );
}

export function renderPlayerLobbyPreferenceSummary({ preferenceCopyElement, state, player }) {
  if (!(preferenceCopyElement instanceof HTMLElement)) {
    return;
  }

  const lobbyStage = typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference";

  if (lobbyStage !== "preference") {
    setElementMarkup(
      preferenceCopyElement,
      `<div class="player-lobby-choice-state">集計完了</div><div>role selection に進みます。</div>`,
      "boss 希望の集計は完了しました。role selection に進みます。",
    );
    return;
  }

  const wantsBoss = player?.wantsBoss === true;
  setElementMarkup(
    preferenceCopyElement,
    `<div class="player-lobby-choice-state">${wantsBoss ? "Boss 希望中" : "Raid 参加"}</div>
    <div>${wantsBoss ? "変更するなら OFF を押してください。" : "boss を担当したいときだけ ON を押してください。"}</div>`,
    wantsBoss
      ? "いまは boss 希望です。変更するなら OFF を押してください。"
      : "boss を担当したいときだけ ON を押してください。",
  );
}

export function renderPlayerSelectionSummary({
  roleSummaryElement,
  roleOptionsElement,
  state,
  player,
  sessionId,
}) {
  if (roleSummaryElement instanceof HTMLElement) {
    const resolvedRole = typeof player?.role === "string" && player.role.length > 0
      ? player.role
      : "unassigned";
    const bossPlayerId = typeof state?.bossPlayerId === "string" ? state.bossPlayerId : "";
    const isBossPlayer = bossPlayerId === sessionId;
    const lobbyStage = typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference";
    const roleCopy = isBossPlayer
      ? "Boss"
      : resolvedRole === "raid"
        ? "Raid"
        : "未確定";
    const selectedHeroId = typeof player?.selectedHeroId === "string" ? player.selectedHeroId : "";
    const selectedBossId = typeof player?.selectedBossId === "string" ? player.selectedBossId : "";
    const selectionFeatureMarkup = buildSelectionFeatureMarkup({ isBossPlayer, selectedHeroId, selectedBossId });
    const selectionDetailMarkup = buildSelectionDetailMarkup({ isBossPlayer, selectedHeroId, selectedBossId });
    const selectionDetailText = buildSelectionDetailText({ isBossPlayer, selectedHeroId, selectedBossId });

    setElementMarkup(
      roleSummaryElement,
      `${selectionFeatureMarkup}
      <div class="player-selection-role-copy">
        ${selectionDetailMarkup}
      </div>`,
      `role: ${isBossPlayer ? "boss" : resolvedRole} / lobby stage: ${lobbyStage} / ${selectionDetailText}`,
    );
  }

  if (roleOptionsElement instanceof HTMLElement) {
    const wantsBossPlayers = mapEntries(state?.players)
      .filter(([, currentPlayer]) => currentPlayer?.isSpectator !== true && currentPlayer?.wantsBoss === true)
      .map(([playerId]) => shortPlayerId(playerId));

    const selectionCopy = buildLobbyRoleCopy({
      lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
      isBossPlayer: player?.role === "boss" || state?.bossPlayerId === sessionId,
      heroSelected: typeof player?.selectedHeroId === "string" && player.selectedHeroId.length > 0,
      bossSelected: typeof player?.selectedBossId === "string" && player.selectedBossId.length > 0,
    });

    const bossCopy = wantsBossPlayers.length > 0 ? `boss希望: ${wantsBossPlayers.join(", ")}` : "boss希望者なし";
    setElementMarkup(
      roleOptionsElement,
      `<div class="player-selection-directive">${escapeHtml(selectionCopy)}</div>`,
      `${selectionCopy} / ${bossCopy}`,
    );
  }
}

export function renderPlayerPrepSummary({
  detailCardElement,
  allyRailElement,
  boardCopyElement,
  shopCopyElement,
  heroExclusiveShopCopyElement,
  bossShopCopyElement,
  heroUpgradeCopyElement,
  refreshCopyElement,
  specialUnitCopyElement,
  playerStatsCopyElement,
  spellCopyElement,
  synergyCopyElement,
  benchCopyElement,
  roomCopyElement,
  deadlineCopyElement,
  boardElement,
  shopElement,
  shopSlotElements = [],
  heroExclusiveShopElement,
  heroExclusiveShopSlotElements = [],
  bossShopElement,
  bossShopSlotElements = [],
  benchElement,
  benchSlotElements = [],
  readyElement,
  readyCopyElement,
  boardCellElements = [],
  state,
  player,
  sessionId = "",
  currentPhase,
  playerFacingPhase = "lobby",
  selectedBenchIndex,
  canSellBench = false,
  canSellBoard = false,
  canReturnBoard = false,
  roomSummary = null,
  deadlineSummary = null,
  hoverDetail = null,
  onHoverDetailChange = null,
  benchSellButton,
  boardReturnButton,
  boardSellButton,
  sharedBoardConnected = false,
}) {
  const isBossPlayer = state?.bossPlayerId === sessionId || player?.role === "boss";
  const bossRoleSelectionEnabled = state?.featureFlagsEnableBossExclusiveShop === true;
  const heroSystemEnabled = state?.featureFlagsEnableHeroSystem === true;
  const selectedHeroId = typeof player?.selectedHeroId === "string" ? player.selectedHeroId : "";
  const selectedBossId = typeof player?.selectedBossId === "string" ? player.selectedBossId : "";
  const defaultHoverDetail = isBossPlayer
    ? buildHeroHoverDetail("", "選択ボス", selectedBossId)
    : buildHeroHoverDetail(selectedHeroId, "選択主人公", selectedBossId);
  renderPrepDetailCard(detailCardElement, hoverDetail ?? defaultHoverDetail);
  renderPrepAllyRail({
    allyRailElement,
    state,
    player,
    sessionId,
    onHoverDetailChange,
    playerFacingPhase,
  });

  if (boardCopyElement instanceof HTMLElement && !sharedBoardConnected) {
    if (selectedBenchIndex === null) {
      boardCopyElement.textContent = isBossPlayer
        ? "共有ボードは 6x6 です。boss は上半分から布陣し、ボス駒は常設のまま位置調整できます。"
        : "共有ボードは 6x6 です。raid は下半分から布陣し、主人公は常設のまま位置調整できます。";
    } else {
      boardCopyElement.textContent = isBossPlayer
        ? `Bench ${selectedBenchIndex + 1} を選択中です。上側の配置可能セルをクリックして配置するか、Sell で売却します。`
        : `Bench ${selectedBenchIndex + 1} を選択中です。下側の配置可能セルをクリックして配置するか、Sell で売却します。`;
    }
  }

  const heroDetail = HERO_DETAILS[selectedHeroId] ?? null;
  const bossDetail = BOSS_DETAILS[selectedBossId] ?? null;
  const gold = Number(player?.gold ?? 0);
  const specialUnitLevel = getClientSpecialUnitLevel(player);
  const nextSpecialUnitUpgradeCost = getClientSpecialUnitUpgradeCost(player);
  const hp = Math.max(0, Math.round(Number(player?.hp ?? 0) || 0));
  const remainingLives = Math.max(0, Math.round(Number(player?.remainingLives ?? 0) || 0));
  const boardUnitCount = Math.max(0, Math.round(Number(player?.boardUnitCount ?? 0) || 0));
  const shopActionsEnabled = canUseShopAction({
    currentPhase,
    playerFacingPhase,
    isReady: player?.ready === true,
  });
  const boardActionsEnabled = canUseBoardAction({
    currentPhase,
    playerFacingPhase,
    isReady: player?.ready === true,
  });
  const benchActionsEnabled = canUseBenchAction({
    currentPhase,
    playerFacingPhase,
    isReady: player?.ready === true,
  });

  if (specialUnitCopyElement instanceof HTMLElement) {
    const livesCopy = remainingLives > 0 ? `${remainingLives}` : "0";
    if (isBossPlayer) {
      const summaryText = bossDetail
        ? `${bossDetail.name} / LV ${specialUnitLevel} / ${bossDetail.roleCopy}`
        : "Boss role は boss character の選択待ちです。";
      setElementMarkup(
        specialUnitCopyElement,
        `
          <div class="player-special-unit-panel">
            <div class="player-special-unit-avatar">${bossDetail
              ? `<img class="player-special-unit-avatar-img" src="${escapeHtml(resolveFrontPortraitUrl(selectedBossId || "remilia", "remilia"))}" alt="${escapeHtml(bossDetail.name)}" loading="lazy" />`
              : escapeHtml(getDisplayInitial(bossDetail?.name ?? "B"))}</div>
            <div class="player-special-unit-main">
              <strong>${escapeHtml(bossDetail?.name ?? "Boss")}</strong>
              <div class="player-special-unit-copy">${escapeHtml(summaryText)}</div>
            </div>
            <div class="player-special-unit-lives">${escapeHtml(livesCopy)}<span>Lives</span></div>
          </div>
        `,
        summaryText,
      );
    } else {
      const summaryText = heroDetail
        ? `${heroDetail.name} / LV ${specialUnitLevel} / HP ${heroDetail.hp} / ATK ${heroDetail.attack}`
        : "レイド役は主人公選択の完了待ちです。";
      setElementMarkup(
        specialUnitCopyElement,
        `
          <div class="player-special-unit-panel">
            <div class="player-special-unit-avatar">${heroDetail
              ? `<img class="player-special-unit-avatar-img" src="${escapeHtml(resolveFrontPortraitUrl(selectedHeroId || "reimu", "reimu"))}" alt="${escapeHtml(heroDetail.name)}" loading="lazy" />`
              : escapeHtml(getDisplayInitial(heroDetail?.name ?? "H"))}</div>
            <div class="player-special-unit-main">
              <strong>${escapeHtml(heroDetail?.name ?? "Hero")}</strong>
              <div class="player-special-unit-copy">${escapeHtml(summaryText)}</div>
            </div>
            <div class="player-special-unit-lives">${escapeHtml(livesCopy)}<span>残機</span></div>
          </div>
        `,
        summaryText,
      );
    }
  }

  if (synergyCopyElement instanceof HTMLElement) {
    const activeSynergies = toRenderableArray(player?.activeSynergies)
      .filter((synergy) => Number(synergy?.tier ?? 0) > 0);
    if (activeSynergies.length === 0) {
      synergyCopyElement.textContent = "有効なシナジーはまだありません。盤面を広げるとここに出ます。";
    } else {
      synergyCopyElement.textContent = activeSynergies
        .map((synergy) => `${synergy.unitType} x${synergy.count} (T${synergy.tier})`)
        .join(" / ");
    }
  }

  if (spellCopyElement instanceof HTMLElement) {
    const spellEnabled = state?.featureFlagsEnableSpellCard === true;
    const declaredSpellId = typeof state?.declaredSpellId === "string" ? state.declaredSpellId : "";
    const usedSpellIds = toRenderableArray(state?.usedSpellIds);
    const declaredSpell = SPELL_DETAILS[declaredSpellId] ?? null;

    if (!spellEnabled) {
      spellCopyElement.textContent = "スペルカードはこのルールセットでは無効です。";
    } else if (declaredSpell) {
      const usedSpellCopy = usedSpellIds.length > 0
        ? ` / used: ${usedSpellIds.map((spellId) => SPELL_DETAILS[spellId]?.name ?? spellId).join(", ")}`
        : "";
      spellCopyElement.textContent = `${declaredSpell.name}。${declaredSpell.description}${usedSpellCopy}`;
    } else if (usedSpellIds.length > 0) {
      spellCopyElement.textContent = `この round の宣言待ちです。used: ${usedSpellIds.map((spellId) => SPELL_DETAILS[spellId]?.name ?? spellId).join(", ")}`;
    } else {
      spellCopyElement.textContent = "Spell はまだ宣言されていません。Battle が始まるとここに current spell が出ます。";
    }
  }

  const offers = toRenderableArray(player?.shopOffers);
  const benchUnits = toRenderableArray(player?.benchUnits);
  const benchUnitIds = toRenderableArray(player?.benchUnitIds);
  const benchDisplayNames = toRenderableArray(player?.benchDisplayNames);
  const boardUnits = toRenderableArray(player?.boardUnits);
  const placementLimit = resolvePlacementLimit(isBossPlayer);
  if (playerStatsCopyElement instanceof HTMLElement) {
    const stateLabel = resolvePlayerStateLabel({
      currentPhase,
      playerFacingPhase,
      isReady: player?.ready === true,
    });
    const level = Math.max(1, Math.round(Number(player?.level ?? specialUnitLevel) || 1));
    const statsText = playerFacingPhase === "purchase"
      ? `Gold ${gold} / Level ${level} / HP ${hp} / Lives ${remainingLives}`
      : `配置 ${boardUnitCount} / ${placementLimit} / 状態 ${stateLabel}`;
    setElementMarkup(
      playerStatsCopyElement,
      playerFacingPhase === "purchase"
        ? `
          <div class="player-player-stat-grid player-player-stat-grid-purchase">
            <div class="player-player-stat"><strong>Gold</strong><span>${escapeHtml(`${gold}`)}</span></div>
            <div class="player-player-stat"><strong>Level</strong><span>${escapeHtml(`${level}`)}</span></div>
            <div class="player-player-stat"><strong>HP</strong><span>${escapeHtml(`${hp}`)}</span></div>
            <div class="player-player-stat"><strong>Lives</strong><span>${escapeHtml(`${remainingLives}`)}</span></div>
          </div>
        `
        : `
          <div class="player-player-stat-grid">
            <div class="player-player-stat"><strong>配置</strong><span>${escapeHtml(`${boardUnitCount} / ${placementLimit}`)}</span></div>
            <div class="player-player-stat"><strong>状態</strong><span>${escapeHtml(stateLabel)}</span></div>
          </div>
        `,
      statsText,
    );
  }
  if (shopCopyElement instanceof HTMLElement) {
    const affordableCount = offers.filter((offer) => gold >= Math.max(0, Math.round(Number(offer?.cost) || 0))).length;
    const strongestHint = offers
      .map((offer) => ({
        offer,
        ownedCount: countOwnedOfferType(offer, { benchUnits, benchUnitIds, boardUnits }),
      }))
      .sort((left, right) => right.ownedCount - left.ownedCount)[0];
    const recommendedName = typeof strongestHint?.offer?.displayName === "string" && strongestHint.offer.displayName.length > 0
      ? strongestHint.offer.displayName
      : strongestHint?.offer?.unitType ?? "更新待ち";
    const shopSummaryText = offers.length > 0
      ? `共通ユニット / 所持 ${gold}G / 購入可 ${affordableCount}/${offers.length} / 推奨 ${recommendedName}。札を押してベンチへ購入します。`
      : `共通ユニット / 所持 ${gold}G / 強化LV ${specialUnitLevel} / HP ${hp}${remainingLives > 0 ? ` / 残機 ${remainingLives}` : ""}。ショップ更新待ちです。`;
    setElementMarkup(
      shopCopyElement,
      offers.length > 0
        ? `
          <div class="player-shop-summary">
            <span><strong>所持</strong>${escapeHtml(`${gold}G`)}</span>
            <span><strong>購入可</strong>${escapeHtml(`${affordableCount}/${offers.length}`)}</span>
            <span><strong>推奨</strong>${escapeHtml(recommendedName)}</span>
          </div>
        `
        : `<div class="player-empty-state"><strong>札待ち</strong><span>${escapeHtml(shopSummaryText)}</span></div>`,
      shopSummaryText,
    );
  }

  if (heroUpgradeCopyElement instanceof HTMLElement) {
    const upgradeLabel = isBossPlayer ? "ボス強化" : "主人公強化";
    heroUpgradeCopyElement.textContent = nextSpecialUnitUpgradeCost === null
      ? `${upgradeLabel} / LV ${specialUnitLevel}。最大まで強化済みです。`
      : `${upgradeLabel} / LV ${specialUnitLevel}。次の強化は ${nextSpecialUnitUpgradeCost}G です。`;
  }

  if (refreshCopyElement instanceof HTMLElement) {
    refreshCopyElement.textContent = "リロード / 共通ユニット shop を更新して次の候補を見ます。";
  }

  shopSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const offer = offers[index];
    const unitType = offer?.unitType ?? null;
    const cost = Math.max(0, Math.round(Number(offer?.cost ?? 0) || 0));
    const displayName = typeof offer?.displayName === "string" && offer.displayName.length > 0
      ? offer.displayName
      : unitType;
    button.disabled = !offer || !shopActionsEnabled || gold < cost;
    button.classList.toggle("selected", false);
    updateShopOfferButton(button, {
      offer,
      fallbackLabel: displayName,
      disabledLabel: `Shop ${index + 1}`,
      gold,
      ownedCount: countOwnedOfferType(offer, { benchUnits, benchUnitIds, boardUnits }),
    });
  });

  const bossShopOffers = toRenderableArray(player?.bossShopOffers);
  const heroExclusiveShopOffers = toRenderableArray(player?.heroExclusiveShopOffers);
  const heroExclusiveShopVisible = heroSystemEnabled && !isBossPlayer && selectedHeroId.length > 0;
  if (heroExclusiveShopElement instanceof HTMLElement) {
    heroExclusiveShopElement.hidden = !heroExclusiveShopVisible;
  }
  if (heroExclusiveShopCopyElement instanceof HTMLElement) {
    if (!heroSystemEnabled) {
      heroExclusiveShopCopyElement.textContent = "主人公専用札はこのルールセットでは無効です。";
    } else if (isBossPlayer) {
      heroExclusiveShopCopyElement.textContent = "主人公専用札はレイド役のみ利用できます。";
    } else if (selectedHeroId.length === 0) {
      heroExclusiveShopCopyElement.textContent = "主人公選択後に専用札が表示されます。";
    } else if (heroExclusiveShopOffers.length === 0) {
      heroExclusiveShopCopyElement.textContent = "主人公専用 / 通常配置可能 / 主枠・支援枠 / 更新待ち";
    } else {
      const firstOffer = heroExclusiveShopOffers[0];
      const firstCost = Math.max(0, Math.round(Number(firstOffer?.cost) || 0));
      heroExclusiveShopCopyElement.textContent = `主人公専用 / 通常配置可能 / 主枠・支援枠 / 先頭 ${firstCost}G`;
    }
  }

  heroExclusiveShopSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const offer = heroExclusiveShopOffers[index];
    const unitType = offer?.unitType ?? null;
    const cost = Number(offer?.cost ?? 0);
    const isPurchased = offer?.purchased === true;
    const displayName = typeof offer?.displayName === "string" && offer.displayName.length > 0
      ? offer.displayName
      : unitType;
    const canAfford = gold >= cost;
    button.disabled = !offer || !shopActionsEnabled || !heroExclusiveShopVisible || isPurchased || !canAfford;
    button.classList.toggle("selected", false);
    updateShopOfferButton(button, {
      offer,
      labelPrefix: "専用",
      fallbackLabel: displayName,
      disabledLabel: `Exclusive ${index + 1}`,
      gold,
      ownedCount: countOwnedOfferType(offer, { benchUnits, benchUnitIds, boardUnits }),
    });
  });

  if (bossShopElement instanceof HTMLElement) {
    bossShopElement.hidden = !bossRoleSelectionEnabled || !isBossPlayer;
  }
  if (bossShopCopyElement instanceof HTMLElement) {
    if (!bossRoleSelectionEnabled) {
      bossShopCopyElement.textContent = "専用ユニットはこのルールセットでは無効です。";
    } else if (!isBossPlayer) {
      bossShopCopyElement.textContent = "専用ユニットはボス役のみ利用できます。";
    } else if (bossShopOffers.length === 0) {
      bossShopCopyElement.textContent = "専用ユニットの更新待ちです。";
    } else {
      const firstOffer = bossShopOffers[0];
      const firstCost = Math.max(0, Math.round(Number(firstOffer?.cost) || 0));
      bossShopCopyElement.textContent = `専用ユニット / ${bossShopOffers.length} 枚 / 先頭 ${firstCost}G`;
    }
  }

  bossShopSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const offer = bossShopOffers[index];
    const unitType = offer?.unitType ?? null;
    const cost = Math.max(0, Math.round(Number(offer?.cost ?? 0) || 0));
    const displayName = typeof offer?.displayName === "string" && offer.displayName.length > 0
      ? offer.displayName
      : unitType;
    button.disabled = !offer || !shopActionsEnabled || !isBossPlayer || gold < cost;
    button.classList.toggle("selected", false);
    updateShopOfferButton(button, {
      offer,
      labelPrefix: "ボス",
      fallbackLabel: displayName,
      disabledLabel: `Boss ${index + 1}`,
      gold,
      ownedCount: countOwnedOfferType(offer, { benchUnits, benchUnitIds, boardUnits }),
    });
  });

  if (roomCopyElement instanceof HTMLElement) {
    const roomId = typeof roomSummary?.roomId === "string" && roomSummary.roomId.length > 0
      ? roomSummary.roomId
      : "default";
    const sharedBoardRoomId = typeof roomSummary?.sharedBoardRoomId === "string" && roomSummary.sharedBoardRoomId.length > 0
      ? roomSummary.sharedBoardRoomId
      : "unbound";
    const sharedBoardMode = typeof state?.sharedBoardMode === "string" && state.sharedBoardMode.length > 0
      ? state.sharedBoardMode
      : "local";
    roomCopyElement.textContent = `Room ${roomId} / Shared board ${sharedBoardRoomId} / Mode ${sharedBoardMode}`;
  }

  if (deadlineCopyElement instanceof HTMLElement) {
    const label = typeof deadlineSummary?.label === "string" && deadlineSummary.label.length > 0
      ? deadlineSummary.label
      : "Deadline";
    const valueText = typeof deadlineSummary?.valueText === "string" && deadlineSummary.valueText.length > 0
      ? deadlineSummary.valueText
      : "pending";
    deadlineCopyElement.textContent = `${label}: ${valueText}`;
  }

  if (benchCopyElement instanceof HTMLElement) {
    if (playerFacingPhase === "battle") {
      const playerRows = buildBattlePlayerRows({ state, player, sessionId });
      benchCopyElement.textContent = `${playerRows.length}人`;
      if (benchElement instanceof HTMLElement && !isFakeElement(benchElement)) {
        const title = benchElement.closest("[data-player-bench]")?.querySelector("strong");
        if (title) {
          title.textContent = "味方状態";
        }
      }
    } else {
      benchCopyElement.textContent = selectedBenchIndex === null
        ? `${benchUnits.length} / 8`
        : `${benchUnits.length} / 8 / ${selectedBenchIndex + 1}番選択`;
      if (benchElement instanceof HTMLElement && !isFakeElement(benchElement)) {
        const title = benchElement.querySelector("strong");
        if (title) {
          title.textContent = "ベンチ";
        }
      }
    }
  }

  if (playerFacingPhase === "battle") {
    renderBattlePlayerStatusSlots({ benchSlotElements, state, player, sessionId });
  } else {
    benchSlotElements.forEach((button, index) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const unitText = formatBenchUnitLabel(benchUnits[index], benchDisplayNames[index]);
      const portraitUrl = resolveBenchPortraitUrl(benchUnits[index], benchDisplayNames[index], benchUnitIds[index]);
      button.disabled = !benchActionsEnabled || (!unitText && !canReturnBoard);
      button.classList.toggle("selected", selectedBenchIndex === index);
      button.classList.toggle("player-bench-slot-filled", Boolean(unitText));
      button.classList.toggle("player-bench-slot-empty", !unitText);
      button.classList.toggle("player-bench-slot-selected", selectedBenchIndex === index);
      updateBenchSlotButton(button, {
        unitText,
        portraitUrl,
        isSelected: selectedBenchIndex === index,
      });
    });
  }

  boardCellElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const row = Math.floor(index / 6);
    const inPlayerZone = isBossPlayer ? row < 3 : row >= 3;
    const isRecommended = selectedBenchIndex !== null && inPlayerZone && (isBossPlayer ? row === 1 : row === 4);
    button.disabled = !boardActionsEnabled;
    button.classList.toggle("player-board-cell-open", boardActionsEnabled && inPlayerZone);
    button.classList.toggle("player-board-cell-locked", boardActionsEnabled && !inPlayerZone);
    button.classList.toggle("player-board-cell-recommended", boardActionsEnabled && isRecommended);
  });

  if (benchSellButton instanceof HTMLButtonElement) {
    benchSellButton.disabled = !benchActionsEnabled || !canSellBench;
  }

  if (boardSellButton instanceof HTMLButtonElement) {
    boardSellButton.disabled = !boardActionsEnabled || !canSellBoard;
  }

  if (boardReturnButton instanceof HTMLButtonElement) {
    boardReturnButton.disabled = !boardActionsEnabled || !canReturnBoard;
  }

  if (readyCopyElement instanceof HTMLElement) {
    const players = getActivePlayers(state);
    const readyCount = players.filter((currentPlayer) => currentPlayer?.ready === true).length;
    const readyHint = buildReadyHint({
      phase: currentPhase,
      isReady: player?.ready === true,
      heroEnabled: state?.featureFlagsEnableHeroSystem === true,
      heroSelected: typeof player?.selectedHeroId === "string" && player.selectedHeroId.length > 0,
      bossRoleSelectionEnabled: state?.featureFlagsEnableBossExclusiveShop === true,
      lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference",
      isBossPlayer: state?.bossPlayerId === sessionId || player?.role === "boss",
      bossSelected: typeof player?.selectedBossId === "string" && player.selectedBossId.length > 0,
      readyCount,
      totalCount: players.length,
    });
    const checklistItems = buildReadyChecklistItems({
      player,
      selectedHeroId,
      selectedBossId,
      isBossPlayer,
      boardUnitCount,
      placementLimit,
    });
    setElementMarkup(
      readyCopyElement,
      `<div class="player-ready-copy-main">${escapeHtml(readyHint)}</div>${buildReadyChecklistMarkup(checklistItems)}`,
      `${readyHint} ${checklistItems.map((item) => `${item.done ? "完了" : "未完了"} ${item.label}`).join(" / ")}`,
    );
  }
}

export function renderPlayerResultSummary({
  resultSurfaceElement,
  state,
  player,
  phaseHpProgress = null,
  sessionId = "",
}) {
  if (!(resultSurfaceElement instanceof HTMLElement)) {
    return;
  }

  const battleResult = player?.lastBattleResult ?? null;
  const phase = readPhase(state?.phase);
  const phaseHpCopy = buildPhaseHpCopy(phaseHpProgress);
  const rankingEntries = toRenderableArray(state?.ranking);
  const raidPlayerIds = toRenderableArray(state?.raidPlayerIds);
  const judgmentCopy = buildFinalJudgmentCopy({
    phase,
    ranking: rankingEntries,
    bossPlayerId: typeof state?.bossPlayerId === "string" ? state.bossPlayerId : "",
    raidPlayerIds,
    roundIndex: Number(state?.roundIndex),
  });
  const ranking = buildRoundDamageRanking(state?.players);
  const resultCopy = battleResult
    ? buildBattleResultCopy({
      isVictory: battleResult.won === true,
      battleResult,
    })
    : {
      title: "結果待ち",
      subtitle: "戦闘結果の到着待ちです。",
      hint: "次に直す位置を 1 つ選びます。",
    };
  const caption = buildRoundSummaryCaption({ ranking, sessionId });
  const tip = buildRoundSummaryTip({ ranking, sessionId });
  const survivorSnapshots = toRenderableArray(battleResult?.survivorSnapshots);
  const timelineEndState = toRenderableArray(battleResult?.timelineEndState);
  const timelineEvents = parseBattleTimelineEvents(battleResult?.timelineEvents);
  const survivorMarkup = buildSurvivorSnapshotMarkup(survivorSnapshots);
  const imprintMarkup = buildSharedBoardImprintMarkup({
    survivorSnapshots,
    timelineEndState,
    timelineEvents,
  });

  resultSurfaceElement.innerHTML = `
    <div class="player-card player-result-hero-card">
      <strong>最終判定</strong>
      <div class="player-result-main-copy">${judgmentCopy}</div>
    </div>
    <div class="player-card player-result-support-card">
      <strong>フェイズHP</strong>
      <div class="player-result-main-copy">${phaseHpCopy.valueText}</div>
      <div class="player-result-sub-copy">${phaseHpCopy.resultText}</div>
    </div>
    <div class="player-card player-result-support-card">
      <strong>${resultCopy.title}</strong>
      <div class="player-result-main-copy">${resultCopy.subtitle}</div>
      <div class="player-result-helper-copy">${resultCopy.hint}</div>
    </div>
    <div class="player-card player-result-support-card">
      <strong>ラウンド読解</strong>
      <div class="player-result-main-copy">${caption}</div>
      <div class="player-result-helper-copy">${tip}</div>
    </div>
    ${imprintMarkup}
    ${survivorMarkup}
  `;
}

function buildRoundDamageRanking(players) {
  const ranking = [];

  for (const [playerId, player] of mapEntries(players)) {
    const damageValue = Number(player?.lastBattleResult?.damageDealt);
    if (!Number.isFinite(damageValue)) {
      continue;
    }

    ranking.push({
      playerId,
      damageDealt: Math.max(0, Math.round(damageValue)),
    });
  }

  ranking.sort((left, right) => right.damageDealt - left.damageDealt);
  return ranking.slice(0, 3);
}

function formatBenchUnitLabel(unit, displayName) {
  if (!unit) {
    return null;
  }

  const unitLevel = resolveBenchUnitLevel(unit);
  const levelSuffix = unitLevel > 1 ? ` Lv${unitLevel}` : "";

  if (typeof displayName === "string" && displayName.length > 0) {
    return `${displayName}${levelSuffix}`;
  }

  if (typeof unit === "string") {
    const unitType = resolveBenchUnitType(unit);
    return `${unitType || unit}${levelSuffix}`;
  }

  if (typeof unit?.displayName === "string" && unit.displayName.length > 0) {
    return `${unit.displayName}${levelSuffix}`;
  }

  if (typeof unit?.unitType === "string" && unit.unitType.length > 0) {
    return `${unit.unitType}${levelSuffix}`;
  }

  return `${String(unit)}${levelSuffix}`;
}

function resolveBenchUnitType(unit) {
  if (!unit) {
    return "";
  }

  if (typeof unit === "string") {
    const [rawUnitType] = unit.split(":");
    return rawUnitType.split("-")[0] || rawUnitType;
  }

  if (typeof unit?.unitType === "string" && unit.unitType.length > 0) {
    return unit.unitType;
  }

  if (typeof unit?.unitId === "string" && unit.unitId.length > 0) {
    return unit.unitId.split("-")[0] || unit.unitId;
  }

  return "";
}

function resolveBenchUnitLevel(unit) {
  if (!unit) {
    return 1;
  }

  if (typeof unit === "string") {
    const [, rawLevel] = unit.split(":");
    const parsedLevel = Number.parseInt(rawLevel ?? "", 10);
    return Number.isInteger(parsedLevel) && parsedLevel > 1 ? parsedLevel : 1;
  }

  const parsedLevel = Number.parseInt(String(unit?.unitLevel ?? ""), 10);
  return Number.isInteger(parsedLevel) && parsedLevel > 1 ? parsedLevel : 1;
}

function resolveBenchUnitIcon(unit) {
  const unitType = resolveBenchUnitType(unit);
  return UNIT_ICONS[unitType] ?? "❓";
}

function toRenderableArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value[Symbol.iterator] !== "function") {
    return [];
  }

  return Array.from(value);
}

function buildSurvivorSnapshotMarkup(survivorSnapshots) {
  if (survivorSnapshots.length === 0) {
    return "";
  }

  const survivorRows = survivorSnapshots.map((snapshot) => {
    const currentHp = Math.max(0, Math.round(Number(snapshot?.hp) || 0));
    const maxHp = Math.max(currentHp, Math.round(Number(snapshot?.maxHp) || 0));
    const displayName = typeof snapshot?.displayName === "string" && snapshot.displayName.length > 0
      ? snapshot.displayName
      : typeof snapshot?.unitType === "string" && snapshot.unitType.length > 0
        ? snapshot.unitType
        : "Unknown unit";
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

    return `
      <div class="player-survivor-row">
        <div class="player-survivor-copy">
          <span>${displayName}</span>
          <span>${currentHp} / ${maxHp}</span>
        </div>
        <div class="player-survivor-bar">
          <div class="player-survivor-bar-fill" style="width: ${hpPercent}%"></div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="player-card">
      <strong>生存ユニット</strong>
      <div>戦闘後に立っていた unit の残HPです。</div>
      <div class="player-survivor-list">${survivorRows}</div>
    </div>
  `;
}

function buildSharedBoardImprintMarkup({ survivorSnapshots, timelineEndState, timelineEvents }) {
  const imprintState = resolveResultImprintState({ survivorSnapshots, timelineEndState, timelineEvents });

  if (!imprintState) {
    return `
      <div class="player-card player-result-imprint-card">
        <strong>共有盤面の痕跡</strong>
        <div class="player-result-imprint-copy">共有盤面に生存ユニットは残りませんでした。</div>
      </div>
    `;
  }

  const cellMarkup = [];
  for (let boardCellIndex = 0; boardCellIndex < imprintState.boardWidth * imprintState.boardHeight; boardCellIndex += 1) {
    const deploymentZone = resolveResultImprintDeploymentZone(boardCellIndex, imprintState.boardWidth, imprintState.boardHeight);
    const snapshot = imprintState.snapshotByBoardCellIndex.get(boardCellIndex) ?? null;
    const classNames = [
      "shared-board-cell",
      deploymentZone === "boss" ? "zone-boss" : "zone-raid",
    ];

    if (snapshot) {
      classNames.push("result-imprint-survivor");
    } else {
      classNames.push("result-imprint-empty");
    }

    if (!snapshot) {
      cellMarkup.push(`
        <div
          class="${classNames.join(" ")}"
          data-result-imprint-cell="${boardCellIndex}"
        ></div>
      `);
      continue;
    }

    const currentHp = Math.max(0, Math.round(Number(snapshot?.hp) || 0));
    const maxHp = Math.max(currentHp, Math.round(Number(snapshot?.maxHp) || 0));
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
    const displayName = typeof snapshot?.displayName === "string" && snapshot.displayName.length > 0
      ? snapshot.displayName
      : typeof snapshot?.unitType === "string" && snapshot.unitType.length > 0
        ? snapshot.unitType
        : "Unknown unit";

    cellMarkup.push(`
      <div
        class="${classNames.join(" ")}"
        data-result-imprint-cell="${boardCellIndex}"
      >
        <div class="shared-board-unit result-imprint-unit">
          <span class="shared-board-display-name">${displayName}</span>
          <span class="result-imprint-hp-copy">${currentHp} / ${maxHp}</span>
          <div class="result-imprint-hp-bar">
            <div class="result-imprint-hp-bar-fill" style="width: ${hpPercent}%"></div>
          </div>
        </div>
      </div>
    `);
  }

  return `
    <div class="player-card player-result-imprint-card">
      <strong>共有盤面の痕跡</strong>
      <div class="player-result-imprint-copy">${imprintState.boardWidth}x${imprintState.boardHeight} 共有盤面の戦闘終了時点です。</div>
      <div class="shared-board-grid result-imprint-grid">${cellMarkup.join("")}</div>
    </div>
  `;
}

function resolveResultImprintState({ survivorSnapshots, timelineEndState, timelineEvents }) {
  const compactEndState = resolveCompactTimelineEndState(timelineEndState);
  if (compactEndState) {
    return compactEndState;
  }

  const timelineState = resolveTimelineEndState(timelineEvents, survivorSnapshots);
  if (timelineState) {
    return timelineState;
  }

  if (survivorSnapshots.length === 0) {
    return null;
  }

  const snapshotByBoardCellIndex = new Map();
  for (const snapshot of survivorSnapshots) {
    const boardCellIndex = normalizeResultBoardCellIndex(Number(snapshot?.sharedBoardCellIndex));
    if (boardCellIndex === null) {
      continue;
    }

    snapshotByBoardCellIndex.set(boardCellIndex, snapshot);
  }

  return {
    boardWidth: RESULT_IMPRINT_BOARD_WIDTH,
    boardHeight: RESULT_IMPRINT_BOARD_HEIGHT,
    snapshotByBoardCellIndex,
  };
}

function resolveCompactTimelineEndState(timelineEndState) {
  if (!Array.isArray(timelineEndState) || timelineEndState.length === 0) {
    return null;
  }

  const snapshotByBoardCellIndex = new Map();

  for (const unit of timelineEndState) {
    const x = Number(unit?.x);
    const y = Number(unit?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      continue;
    }

    const boardCellIndex = y * RESULT_IMPRINT_BOARD_WIDTH + x;
    if (boardCellIndex < 0 || boardCellIndex >= RESULT_IMPRINT_BOARD_WIDTH * RESULT_IMPRINT_BOARD_HEIGHT) {
      continue;
    }

    snapshotByBoardCellIndex.set(boardCellIndex, {
      hp: Math.max(0, Math.round(Number(unit?.currentHp) || 0)),
      maxHp: Math.max(0, Math.round(Number(unit?.maxHp) || 0)),
      displayName: typeof unit?.displayName === "string" && unit.displayName.length > 0
        ? unit.displayName
        : resolveBattleTimelineUnitLabel(unit?.battleUnitId),
      unitType: typeof unit?.unitType === "string" && unit.unitType.length > 0
        ? unit.unitType
        : resolveBattleTimelineUnitLabel(unit?.battleUnitId),
      side: unit?.side === "boss" ? "boss" : "raid",
    });
  }

  if (snapshotByBoardCellIndex.size === 0) {
    return null;
  }

  return {
    boardWidth: RESULT_IMPRINT_BOARD_WIDTH,
    boardHeight: RESULT_IMPRINT_BOARD_HEIGHT,
    snapshotByBoardCellIndex,
  };
}

function resolveTimelineEndState(timelineEvents, survivorSnapshots) {
  if (!Array.isArray(timelineEvents) || timelineEvents.length === 0) {
    return null;
  }

  const battleStartEvent = timelineEvents.find((event) => event?.type === "battleStart");
  if (!battleStartEvent) {
    return null;
  }

  const boardWidth = Number.isInteger(battleStartEvent?.boardConfig?.width)
    ? battleStartEvent.boardConfig.width
    : RESULT_IMPRINT_BOARD_WIDTH;
  const boardHeight = Number.isInteger(battleStartEvent?.boardConfig?.height)
    ? battleStartEvent.boardConfig.height
    : RESULT_IMPRINT_BOARD_HEIGHT;
  const survivorsByUnitId = new Map(
    survivorSnapshots
      .map((snapshot) => [
        typeof snapshot?.battleUnitId === "string" && snapshot.battleUnitId.length > 0
          ? snapshot.battleUnitId
          : snapshot?.unitId,
        snapshot,
      ])
      .filter(([unitId]) => typeof unitId === "string" && unitId.length > 0),
  );
  const unitsById = new Map();

  for (const unit of battleStartEvent.units ?? []) {
    if (typeof unit?.battleUnitId !== "string" || unit.battleUnitId.length === 0) {
      continue;
    }

    unitsById.set(unit.battleUnitId, {
      battleUnitId: unit.battleUnitId,
      side: unit.side === "boss" ? "boss" : "raid",
      x: Number.isInteger(unit.x) ? unit.x : 0,
      y: Number.isInteger(unit.y) ? unit.y : 0,
      hp: Math.max(0, Math.round(Number(unit.currentHp) || 0)),
      maxHp: Math.max(0, Math.round(Number(unit.maxHp) || 0)),
      alive: true,
    });
  }

  for (const event of timelineEvents) {
    if (!event || event.type === "battleStart" || event.type === "battleEnd" || event.type === "attackStart") {
      continue;
    }

    if (event.type === "move") {
      const unit = unitsById.get(event.battleUnitId);
      if (!unit) {
        continue;
      }

      unit.x = Number.isInteger(event?.to?.x) ? event.to.x : unit.x;
      unit.y = Number.isInteger(event?.to?.y) ? event.to.y : unit.y;
      continue;
    }

    if (event.type === "damageApplied") {
      const unit = unitsById.get(event.targetBattleUnitId);
      if (!unit) {
        continue;
      }

      unit.hp = Math.max(0, Math.round(Number(event.remainingHp) || 0));
      if (unit.hp <= 0) {
        unit.alive = false;
      }
      continue;
    }

    if (event.type === "unitDeath") {
      const unit = unitsById.get(event.battleUnitId);
      if (!unit) {
        continue;
      }

      unit.alive = false;
      unit.hp = 0;
      continue;
    }

    if (event.type === "keyframe") {
      for (const keyframeUnit of event.units ?? []) {
        const unit = unitsById.get(keyframeUnit?.battleUnitId);
        if (!unit) {
          continue;
        }

        unit.x = Number.isInteger(keyframeUnit.x) ? keyframeUnit.x : unit.x;
        unit.y = Number.isInteger(keyframeUnit.y) ? keyframeUnit.y : unit.y;
        unit.hp = Math.max(0, Math.round(Number(keyframeUnit.currentHp) || 0));
        unit.maxHp = Math.max(unit.hp, Math.round(Number(keyframeUnit.maxHp) || 0));
        unit.alive = keyframeUnit.alive === true;
      }
    }
  }

  const snapshotByBoardCellIndex = new Map();
  for (const unit of unitsById.values()) {
    if (unit.alive !== true) {
      continue;
    }

    const boardCellIndex = unit.y * boardWidth + unit.x;
    if (!Number.isInteger(boardCellIndex) || boardCellIndex < 0 || boardCellIndex >= boardWidth * boardHeight) {
      continue;
    }

    const survivorSnapshot = survivorsByUnitId.get(unit.battleUnitId) ?? null;
    snapshotByBoardCellIndex.set(boardCellIndex, {
      hp: survivorSnapshot?.hp ?? unit.hp,
      maxHp: survivorSnapshot?.maxHp ?? unit.maxHp,
      displayName: typeof survivorSnapshot?.displayName === "string" && survivorSnapshot.displayName.length > 0
        ? survivorSnapshot.displayName
        : resolveBattleTimelineUnitLabel(unit.battleUnitId),
      unitType: typeof survivorSnapshot?.unitType === "string" && survivorSnapshot.unitType.length > 0
        ? survivorSnapshot.unitType
        : resolveBattleTimelineUnitLabel(unit.battleUnitId),
      side: unit.side,
    });
  }

  return {
    boardWidth,
    boardHeight,
    snapshotByBoardCellIndex,
  };
}

function normalizeResultBoardCellIndex(sharedBoardCellIndex) {
  if (
    !Number.isInteger(sharedBoardCellIndex) ||
    sharedBoardCellIndex < 0 ||
    sharedBoardCellIndex >= RESULT_IMPRINT_BOARD_WIDTH * RESULT_IMPRINT_BOARD_HEIGHT
  ) {
    return null;
  }

  return sharedBoardCellIndex;
}

function resolveResultImprintDeploymentZone(boardCellIndex, boardWidth, boardHeight) {
  const maxBoardCellIndex = boardWidth * boardHeight - 1;
  if (!Number.isInteger(boardCellIndex) || boardCellIndex < 0 || boardCellIndex > maxBoardCellIndex) {
    return "raid";
  }

  const y = Math.floor(boardCellIndex / boardWidth);
  return y < Math.floor(boardHeight / 2) ? "boss" : "raid";
}

function resolveBattleTimelineUnitLabel(battleUnitId) {
  if (typeof battleUnitId !== "string" || battleUnitId.length === 0) {
    return "Unknown unit";
  }

  const tokens = battleUnitId.split("-");
  return tokens.find((token) => ["vanguard", "ranger", "mage", "assassin"].includes(token)) ?? shortPlayerId(battleUnitId);
}

function parseBattleTimelineEvents(timelineEvents) {
  const parsedEvents = [];

  for (const rawEvent of toRenderableArray(timelineEvents)) {
    if (rawEvent && typeof rawEvent === "object") {
      parsedEvents.push(rawEvent);
      continue;
    }

    if (typeof rawEvent !== "string" || rawEvent.length === 0) {
      continue;
    }

    try {
      const parsedEvent = JSON.parse(rawEvent);
      if (parsedEvent && typeof parsedEvent === "object") {
        parsedEvents.push(parsedEvent);
      }
    } catch {
      // Ignore malformed timeline payloads and fall back to survivor snapshots.
    }
  }

  return parsedEvents;
}
