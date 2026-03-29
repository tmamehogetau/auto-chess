import {
  buildBattleResultCopy,
  buildFinalJudgmentCopy,
  buildLobbyRoleCopy,
  buildPhaseHpCopy,
  buildReadyHint,
  buildRoundSummaryCaption,
  buildRoundSummaryTip,
} from "./ui/player-facing-copy.js";
import { mapEntries, readPhase, shortPlayerId } from "./utils/pure-utils.js";

const UNIT_ICONS = {
  vanguard: "🛡️",
  ranger: "🏹",
  mage: "✨",
  assassin: "🗡️",
};

const UNIT_DETAIL_NAMES = {
  vanguard: "Vanguard",
  ranger: "Ranger",
  mage: "Mage",
  assassin: "Assassin",
};

const HERO_DETAILS = {
  reimu: { name: "霊夢", role: "balance", hp: 120, attack: 18 },
  marisa: { name: "魔理沙", role: "dps", hp: 100, attack: 25 },
  okina: { name: "隠岐奈", role: "support", hp: 110, attack: 16 },
  keiki: { name: "袿姫", role: "tank", hp: 180, attack: 12 },
  jyoon: { name: "女苑", role: "economy", hp: 90, attack: 14 },
};

const BOSS_DETAILS = {
  remilia: { name: "レミリア", roleCopy: "紅魔館の主" },
};

const SPELL_DETAILS = {
  "instant-1": { name: "紅符「スカーレットシュート」", description: "レイド全体へ 50 ダメージ" },
  "instant-2": { name: "必殺「ハートブレイク」", description: "レイド全体へ 65 ダメージ" },
  "instant-3": { name: "神槍「スピア・ザ・グングニル」", description: "レイド全体へ 80 ダメージ" },
  "area-1": { name: "紅符「不夜城レッド」", description: "レイド全体へ 40 ダメージ" },
  "area-2": { name: "紅魔「スカーレットデビル」", description: "レイド全体へ 55 ダメージ" },
  "area-3": { name: "魔符「全世界ナイトメア」", description: "レイド全体へ 70 ダメージ" },
  "rush-1": { name: "神鬼「レミリアストーカー」", description: "レイド全体へ 45 ダメージ" },
  "rush-2": { name: "夜符「デーモンキングクレイドル」", description: "レイド全体へ 60 ダメージ" },
  "rush-3": { name: "夜王「ドラキュラクレイドル」", description: "レイド全体へ 75 ダメージ" },
  "last-word": { name: "「紅色の幻想郷」", description: "レイド全体へ 100 ダメージ" },
};

const RESULT_IMPRINT_BOARD_WIDTH = 6;
const RESULT_IMPRINT_BOARD_HEIGHT = 6;

function buildHeroRuleLines(heroId) {
  const lines = ["Bench に戻らず、自軍 main と位置交換できます。"];

  if (heroId === "okina") {
    lines.push("他の自軍 unit の sub slot に入れます。");
  }

  return lines;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    : "Hover Detail";
  const title = typeof hoverDetail?.title === "string" && hoverDetail.title.length > 0
    ? hoverDetail.title
    : "何も選ばれていません";
  const lines = Array.isArray(hoverDetail?.lines) && hoverDetail.lines.length > 0
    ? hoverDetail.lines
    : [
      "hover したユニットの詳細をここに表示します。",
      "主人公、味方主人公、味方 bench、shared-board の sub 効果もここで確認できます。",
    ];

  detailCardElement.innerHTML = `
    <strong>Unit Detail</strong>
    <div class="player-ally-card-copy">${escapeHtml(kicker)}</div>
    <div class="player-ally-card-copy"><strong>${escapeHtml(title)}</strong></div>
    <div class="player-ally-card-copy">${lines.map((line) => escapeHtml(line)).join(" / ")}</div>
  `;
}

function createHoverChip({ target, label, detail, onHoverDetailChange }) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "player-choice-btn player-slot-btn";
  chip.dataset.hoverDetailTarget = target;
  chip.textContent = label;
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
        lines: [bossDetail.roleCopy, "共有ボードでは位置だけ調整できます。"],
      };
    }
  }

  return null;
}

function buildBenchHoverDetail(benchUnit, displayName, kicker) {
  const title = formatBenchUnitLabel(benchUnit, displayName);
  if (!title) {
    return null;
  }

  return {
    kicker,
    title,
    lines: ["味方の bench 候補です。shared-board の配置と噛み合うかを見ます。"],
  };
}

function renderPrepAllyRail({
  allyRailElement,
  state,
  player,
  sessionId,
  onHoverDetailChange,
}) {
  if (!(allyRailElement instanceof HTMLElement)) {
    return;
  }

  allyRailElement.innerHTML = "";
  allyRailElement.textContent = "";

  const title = typeof document !== "undefined" && typeof document.createElement === "function"
    ? document.createElement("strong")
    : null;
  if (title) {
    title.textContent = "Allies";
    allyRailElement.appendChild(title);
  }

  const ownHeroId = typeof player?.selectedHeroId === "string" ? player.selectedHeroId : "";
  const ownBossId = typeof player?.selectedBossId === "string" ? player.selectedBossId : "";
  const ownHeroDetail = buildHeroHoverDetail(
    ownHeroId,
    ownHeroId.length > 0 ? "Your Hero" : "Your Boss",
    ownBossId,
  );
  if (ownHeroDetail) {
    const ownHeroChip = createHoverChip({
      target: "self-hero",
      label: ownHeroDetail.title,
      detail: ownHeroDetail,
      onHoverDetailChange,
    });
    if (ownHeroChip) {
      allyRailElement.appendChild(ownHeroChip);
    }
  }

  for (const [playerId, allyPlayer] of mapEntries(state?.players)) {
    if (playerId === sessionId || allyPlayer?.isSpectator === true) {
      continue;
    }

    const allyHeroId = typeof allyPlayer?.selectedHeroId === "string" ? allyPlayer.selectedHeroId : "";
    const allyBossId = typeof allyPlayer?.selectedBossId === "string" ? allyPlayer.selectedBossId : "";
    const allyHeroDetail = buildHeroHoverDetail(
      allyHeroId,
      allyHeroId.length > 0 ? "Ally Hero" : "Ally Boss",
      allyBossId,
    );
    if (allyHeroDetail) {
      const allyHeroChip = createHoverChip({
        target: "ally-hero",
        label: allyHeroDetail.title,
        detail: allyHeroDetail,
        onHoverDetailChange,
      });
      if (allyHeroChip) {
        allyRailElement.appendChild(allyHeroChip);
      }
    }

    const allyBenchUnits = toRenderableArray(allyPlayer?.benchUnits);
    const allyBenchDisplayNames = toRenderableArray(allyPlayer?.benchDisplayNames);
    for (let index = 0; index < allyBenchUnits.length; index += 1) {
      const benchDetail = buildBenchHoverDetail(
        allyBenchUnits[index],
        allyBenchDisplayNames[index],
        "Ally Bench",
      );
      if (!benchDetail) {
        continue;
      }

      const allyBenchChip = createHoverChip({
        target: "ally-bench",
        label: benchDetail.title,
        detail: benchDetail,
        onHoverDetailChange,
      });
      if (allyBenchChip) {
        allyRailElement.appendChild(allyBenchChip);
      }
    }
  }

  if (allyRailElement.children.length <= 1) {
    allyRailElement.textContent = "味方情報の到着待ちです。";
  }
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

  if (expectedPlayers > totalPlayers) {
    const remainingSeats = expectedPlayers - totalPlayers;
    participantSummaryElement.textContent = `${readyPlayers} / ${expectedPlayers} ready。あと ${remainingSeats} 人の参加待ちです。`;
    return;
  }

  participantSummaryElement.textContent = `${readyPlayers} / ${expectedPlayers} ready。${expectedPlayers > 0 ? "全員の Ready が揃うと role selection が始まります。" : "プレイヤー接続待ちです。"}`;
}

export function renderPlayerLobbyPreferenceSummary({ preferenceCopyElement, state, player }) {
  if (!(preferenceCopyElement instanceof HTMLElement)) {
    return;
  }

  const lobbyStage = typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference";

  if (lobbyStage !== "preference") {
    preferenceCopyElement.textContent = "boss 希望の集計は完了しました。role selection に進みます。";
    return;
  }

  preferenceCopyElement.textContent = player?.wantsBoss === true
    ? "いまは boss 希望です。変更するなら OFF を押してください。"
    : "boss を担当したいときだけ ON を押してください。";
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

    roleSummaryElement.textContent = `role: ${isBossPlayer ? "boss" : resolvedRole} / lobby stage: ${typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference"}`;
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

    roleOptionsElement.textContent = `${selectionCopy} / ${wantsBossPlayers.length > 0 ? `boss希望: ${wantsBossPlayers.join(", ")}` : "boss希望者なし"}`;
  }
}

export function renderPlayerPrepSummary({
  detailCardElement,
  allyRailElement,
  boardCopyElement,
  shopCopyElement,
  bossShopCopyElement,
  heroUpgradeCopyElement,
  refreshCopyElement,
  specialUnitCopyElement,
  spellCopyElement,
  synergyCopyElement,
  benchCopyElement,
  roomCopyElement,
  deadlineCopyElement,
  boardElement,
  shopElement,
  shopSlotElements = [],
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
  renderPrepDetailCard(detailCardElement, hoverDetail);
  renderPrepAllyRail({
    allyRailElement,
    state,
    player,
    sessionId,
    onHoverDetailChange,
  });

  const isBossPlayer = state?.bossPlayerId === sessionId || player?.role === "boss";
  const bossRoleSelectionEnabled = state?.featureFlagsEnableBossExclusiveShop === true;

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

  const selectedHeroId = typeof player?.selectedHeroId === "string" ? player.selectedHeroId : "";
  const selectedBossId = typeof player?.selectedBossId === "string" ? player.selectedBossId : "";
  const heroDetail = HERO_DETAILS[selectedHeroId] ?? null;
  const bossDetail = BOSS_DETAILS[selectedBossId] ?? null;

  if (specialUnitCopyElement instanceof HTMLElement) {
    if (isBossPlayer) {
      specialUnitCopyElement.textContent = bossDetail
        ? `${bossDetail.name} / ${bossDetail.roleCopy}。共有ボード上で位置だけ調整できます。`
        : "Boss role は boss character の選択待ちです。";
    } else {
      specialUnitCopyElement.textContent = heroDetail
        ? `${heroDetail.name} / ${heroDetail.role} / HP ${heroDetail.hp} / ATK ${heroDetail.attack}。主人公は常設で、bench には戻りません。${selectedHeroId === "okina" ? "隠岐奈だけは他の自軍 unit の sub slot に入れます。" : ""}`
        : "Raid role は hero selection の完了待ちです。";
    }
  }

  if (synergyCopyElement instanceof HTMLElement) {
    const activeSynergies = toRenderableArray(player?.activeSynergies);
    if (activeSynergies.length === 0) {
      synergyCopyElement.textContent = "有効な synergy はまだありません。盤面を広げるとここに出ます。";
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
      spellCopyElement.textContent = "Spell card system はこのルールセットでは無効です。";
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
  const gold = Number(player?.gold ?? 0);
  const level = Math.max(1, Math.round(Number(player?.level ?? 1) || 1));
  const xp = Math.max(0, Math.round(Number(player?.xp ?? 0) || 0));
  const hp = Math.max(0, Math.round(Number(player?.hp ?? 0) || 0));
  const remainingLives = Math.max(0, Math.round(Number(player?.remainingLives ?? 0) || 0));
  if (shopCopyElement instanceof HTMLElement) {
    shopCopyElement.textContent = offers.length > 0
      ? `共通ユニット / 所持 ${gold}G / LV ${level} / XP ${xp} / HP ${hp}${remainingLives > 0 ? ` / Lives ${remainingLives}` : ""}。shop を押して bench へ購入します。`
      : `共通ユニット / 所持 ${gold}G / LV ${level} / XP ${xp} / HP ${hp}${remainingLives > 0 ? ` / Lives ${remainingLives}` : ""}。shop offer の更新待ちです。`;
  }

  if (heroUpgradeCopyElement instanceof HTMLElement) {
    heroUpgradeCopyElement.textContent = `主人公強化 / LV ${level} / XP ${xp}。経験値を買って主人公レベルを上げます。`;
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
    const cost = Number(offer?.cost ?? 0);
    const displayName = typeof offer?.displayName === "string" && offer.displayName.length > 0
      ? offer.displayName
      : unitType;
    button.disabled = !offer || currentPhase !== "Prep";
    button.classList.toggle("selected", false);
    button.textContent = offer ? `${UNIT_ICONS[unitType] ?? "❓"} ${displayName} / ${cost}G` : `Shop ${index + 1}`;
  });

  const bossShopOffers = toRenderableArray(player?.bossShopOffers);
  if (bossShopElement instanceof HTMLElement) {
    bossShopElement.hidden = !bossRoleSelectionEnabled;
  }
  if (bossShopCopyElement instanceof HTMLElement) {
    if (!bossRoleSelectionEnabled) {
      bossShopCopyElement.textContent = "専用ユニット / Boss shop はこのルールセットでは無効です。";
    } else if (!isBossPlayer) {
      bossShopCopyElement.textContent = "専用ユニット / Boss shop は boss role のみ利用できます。";
    } else if (bossShopOffers.length === 0) {
      bossShopCopyElement.textContent = "専用ユニット / Boss shop offer の更新待ちです。";
    } else {
      const firstOffer = bossShopOffers[0];
      const firstCost = Math.max(0, Math.round(Number(firstOffer?.cost) || 0));
      bossShopCopyElement.textContent = `専用ユニット / Boss shop / ${bossShopOffers.length} offers。先頭 ${firstCost}G、boss 専用ユニットを直接 bench へ追加します。`;
    }
  }

  bossShopSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const offer = bossShopOffers[index];
    const unitType = offer?.unitType ?? null;
    const cost = Number(offer?.cost ?? 0);
    const displayName = typeof offer?.displayName === "string" && offer.displayName.length > 0
      ? offer.displayName
      : unitType;
    button.disabled = !offer || currentPhase !== "Prep" || !isBossPlayer;
    button.classList.toggle("selected", false);
    button.textContent = offer ? `${UNIT_ICONS[unitType] ?? "👑"} ${displayName} / ${cost}G` : `Boss ${index + 1}`;
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

  const benchUnits = toRenderableArray(player?.benchUnits);
  const benchDisplayNames = toRenderableArray(player?.benchDisplayNames);
  if (benchCopyElement instanceof HTMLElement) {
    benchCopyElement.textContent = selectedBenchIndex === null
      ? `${benchUnits.length} / 9 on bench。配置か売却したい unit を選びます。`
      : `${benchUnits.length} / 9 on bench。Bench ${selectedBenchIndex + 1} を選択中です。`;
  }

  benchSlotElements.forEach((button, index) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const unitText = formatBenchUnitLabel(benchUnits[index], benchDisplayNames[index]);
    button.disabled = !unitText || currentPhase !== "Prep";
    button.classList.toggle("selected", selectedBenchIndex === index);
    button.textContent = unitText ?? `Bench ${index + 1}`;
  });

  boardCellElements.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.disabled = currentPhase !== "Prep";
  });

  if (benchSellButton instanceof HTMLButtonElement) {
    benchSellButton.disabled = currentPhase !== "Prep" || !canSellBench;
  }

  if (boardSellButton instanceof HTMLButtonElement) {
    boardSellButton.disabled = currentPhase !== "Prep" || !canSellBoard;
  }

  if (boardReturnButton instanceof HTMLButtonElement) {
    boardReturnButton.disabled = currentPhase !== "Prep" || !canReturnBoard;
  }

  if (readyCopyElement instanceof HTMLElement) {
    const players = getActivePlayers(state);
    const readyCount = players.filter((currentPlayer) => currentPlayer?.ready === true).length;
    readyCopyElement.textContent = buildReadyHint({
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
      title: "Battle result pending",
      subtitle: "戦闘結果の到着待ちです。",
      hint: "結果が出たら、次に直す weak position を 1 つ決めます。",
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
    <div class="player-card">
      <strong>Final Judgment</strong>
      <div>${judgmentCopy}</div>
      <div>${phase}</div>
    </div>
    <div class="player-card">
      <strong>Phase HP</strong>
      <div>${phaseHpCopy.valueText}</div>
      <div>${phaseHpCopy.resultText}</div>
      <div>${phaseHpCopy.helperText}</div>
    </div>
    <div class="player-card">
      <strong>${resultCopy.title}</strong>
      <div>${resultCopy.subtitle}</div>
      <div>${resultCopy.hint}</div>
    </div>
    <div class="player-card">
      <strong>Round Read</strong>
      <div>${caption}</div>
      <div>${tip}</div>
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

  if (typeof displayName === "string" && displayName.length > 0) {
    return displayName;
  }

  if (typeof unit === "string") {
    const [unitType] = unit.split("-");
    return unitType || unit;
  }

  if (typeof unit?.displayName === "string" && unit.displayName.length > 0) {
    return unit.displayName;
  }

  if (typeof unit?.unitType === "string" && unit.unitType.length > 0) {
    return unit.unitType;
  }

  return String(unit);
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
      <strong>Surviving Units</strong>
      <div>戦闘後に立っていた unit の残HPです。</div>
      <div class="player-survivor-list">${survivorRows}</div>
    </div>
  `;
}

function buildSharedBoardImprintMarkup({ survivorSnapshots, timelineEndState, timelineEvents }) {
  const imprintState = resolveResultImprintState({ survivorSnapshots, timelineEndState, timelineEvents });

  if (!imprintState) {
    return `
      <div class="player-card">
        <strong>Shared-board Imprint</strong>
        <div>No surviving units remained on the shared board.</div>
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
    <div class="player-card">
      <strong>Shared-board Imprint</strong>
      <div>Battle end-state on the ${imprintState.boardWidth}x${imprintState.boardHeight} shared board.</div>
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
  const survivorsByUnitId = new Map(survivorSnapshots.map((snapshot) => [snapshot?.unitId, snapshot]));
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
