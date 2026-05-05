function toRoundNumber(roundIndex) {
  return Number.isFinite(roundIndex) ? roundIndex + 1 : 1;
}

function shortPlayerId(value) {
  if (!value || typeof value !== "string") {
    return "ally";
  }

  return value.slice(0, 6);
}

export function buildReadyHint({
  phase,
  isReady,
  heroEnabled,
  heroSelected,
  bossRoleSelectionEnabled,
  lobbyStage,
  isBossPlayer,
  bossSelected,
  readyCount,
  totalCount,
}) {
  if (phase === "Waiting" && bossRoleSelectionEnabled && lobbyStage === "selection") {
    if (isBossPlayer && !bossSelected) {
      return "最初の準備フェーズを開くため、ボスを確定してください。";
    }

    if (!isBossPlayer && !heroSelected) {
      return "ボス確定を待ちながら主人公を選んでください。";
    }

    return "選択を反映中です。最初の準備フェーズが開くのを待ちます。";
  }

  if (phase === "Waiting") {
    if (isReady) {
      return "準備完了済みです。準備フェーズが開いたら、購入と配置を整えます。";
    }

    return "Ready を押すと最初の準備フェーズへ進みます。開始後に購入と配置が解放されます。";
  }

  if (phase === "Prep" && heroEnabled && !isBossPlayer && !heroSelected) {
    return "先に主人公を選び、その後に準備を整えます。";
  }

  if (phase === "End") {
    return "戦闘終了です。最終結果を確認してから次の部屋へ進みます。";
  }

  if (phase !== "Prep" && phase !== "Waiting") {
    return "戦闘中です。結果を見届け、次の準備フェーズで立て直します。";
  }

  if (isReady) {
    return "準備完了済みです。まだ動かすなら Ready を解除します。";
  }

  const safeReadyCount = Number.isFinite(readyCount) ? readyCount : 0;
  const safeTotalCount = Number.isFinite(totalCount) ? totalCount : 0;
  const waitingPlayers = Math.max(0, safeTotalCount - safeReadyCount);

  if (waitingPlayers > 1) {
    return `${waitingPlayers}人が準備中です。購入と配置を終えたら Ready を押します。`;
  }

  if (waitingPlayers === 1) {
    return "あと1人が準備中です。盤面を整えたら Ready を押します。";
  }

  return "ユニットを購入し、共有盤面に配置してから Ready を押します。";
}

export function buildEntryFlowStatus({
  connected,
  connecting,
  phase,
  heroEnabled,
  heroSelected,
  isReady,
  bossRoleSelectionEnabled,
  lobbyStage,
  isBossPlayer,
  bossSelected,
}) {
  if (connecting) {
    return "Opening your raid room. Wait for the board, then follow the next step.";
  }

  if (!connected) {
    return "Step 1: Connect. Then choose a hero, buy units, place them, and press Ready.";
  }

  if (bossRoleSelectionEnabled && phase === "Waiting") {
    if (lobbyStage === "preference") {
      return "Step 2: Choose whether to volunteer as boss, then press Ready.";
    }

    if (lobbyStage === "selection") {
      if (isBossPlayer && !bossSelected) {
        return "Step 3: Confirm your boss character to open the first prep phase.";
      }

      if (!isBossPlayer && !heroSelected) {
        return "Step 3: Choose your hero while the boss locks in.";
      }

      return "Selections are resolving. Wait for the room to open the first prep phase.";
    }
  }

  if (heroEnabled && !heroSelected && phase === "Prep") {
    return "Step 2: Choose a hero before your first Ready. Your hero always stays on the field.";
  }

  if (phase === "Waiting") {
    if (isReady) {
      return "Ready locked. Waiting for the room to open the first prep phase.";
    }

    return "Step 3: Press Ready to open the first prep phase. Buy and place once Prep begins.";
  }

  if (phase === "Prep") {
    if (isReady) {
      return "Ready locked. Wait for the team or cancel Ready if you need one more change.";
    }

    return "Step 3: Buy units, place them, then press Ready to start the battle.";
  }

  if (phase === "Battle") {
    return "Battle is running. Watch phase HP and the result screen, then adjust on the next prep phase.";
  }

  if (phase === "Settle") {
    return "Results are settling. Use the summary to decide what to change next round.";
  }

  if (phase === "End") {
    return "Match finished. Read the final judgment and use it to plan the next room.";
  }

  return "Stay with the flow: Hero, buy, place, Ready, then read the result.";
}

export function buildLobbyRoleCopy({
  lobbyStage,
  isBossPlayer,
  heroSelected,
  bossSelected,
}) {
  if (lobbyStage === "selection") {
    if (isBossPlayer) {
      return bossSelected ? "他プレイヤーの選択完了待ち" : "ボスキャラを選んで開始を待つ";
    }

    return heroSelected ? "他プレイヤーの選択完了待ち" : "主人公を選んで開始を待つ";
  }

  return "ボス希望を出して Ready";
}

export function buildPhaseHpCopy(progress) {
  if (!progress) {
    return {
      valueText: "0 / 0",
      resultText: "戦闘開始待ち",
      helperText: "0 で突破",
    };
  }

  const completionRate = Math.max(0, Number(progress.completionRate) || 0);
  const textPercent = Math.round(completionRate * 100);
  const remainingHp = Math.max(
    0,
    Math.round((Number(progress.targetHp) || 0) - (Number(progress.damageDealt) || 0)),
  );

  if (progress.result === "success") {
    return {
      valueText: `残り ${remainingHp} HP (${textPercent}%削り)`,
      resultText: "フェイズ突破",
      helperText: "次の押し込みへ",
    };
  }

  if (progress.result === "failed") {
    return {
      valueText: `残り ${remainingHp} HP (${textPercent}%削り)`,
      resultText: "ボスが耐えた",
      helperText: `残り ${remainingHp} HP`,
    };
  }

  return {
    valueText: `残り ${remainingHp} HP (${textPercent}%削り)`,
    resultText: "フェイズ進行中",
    helperText: "0 で突破",
  };
}

export function buildFinalJudgmentCopy({
  phase,
  ranking,
  bossPlayerId,
  raidPlayerIds,
  roundIndex,
}) {
  const safePhase = typeof phase === "string" ? phase : "Waiting";
  const safeRanking = Array.isArray(ranking) ? ranking : [];
  const isRaidRound = typeof bossPlayerId === "string" && bossPlayerId !== "" && Array.isArray(raidPlayerIds);

  if (safePhase === "End" && isRaidRound) {
    const winnerPlayerId = typeof safeRanking[0] === "string" ? safeRanking[0] : null;

    if (!winnerPlayerId) {
      return "最終判定: 集計中";
    }

    return winnerPlayerId === bossPlayerId
      ? "最終判定: ボス勝利"
      : "最終判定: レイド勝利";
  }

  const roundNumber = toRoundNumber(Number(roundIndex));

  if (safePhase === "Prep") {
    return `第${roundNumber}ラウンド: 購入、配置、Ready`;
  }

  if (safePhase === "Battle") {
    return `第${roundNumber}ラウンド: 前線を維持してフェイズダメージを押す`;
  }

  if (safePhase === "Settle") {
    return `第${roundNumber}ラウンド: 結果を読んで弱い位置を 1 つ直す`;
  }

  return `第${roundNumber}ラウンド: 次の判定待ち`;
}

export function buildBattleResultCopy({ isVictory, battleResult }) {
  const damageDealt = Math.max(0, Math.round(Number(battleResult?.damageDealt) || 0));
  const damageTaken = Math.max(0, Math.round(Number(battleResult?.damageTaken) || 0));
  const survivors = Math.max(0, Math.round(Number(battleResult?.survivors) || 0));
  const opponentSurvivors = Math.max(0, Math.round(Number(battleResult?.opponentSurvivors) || 0));

  if (isVictory) {
    return {
      title: "勝利",
      subtitle: `${damageDealt} ダメージ / 生存 ${survivors}`,
      hint: damageTaken === 0
        ? "この陣形を維持"
        : damageDealt < damageTaken
          ? "前線を厚く"
          : "弱点を守る",
      damageDealt,
      damageTaken,
    };
  }

  const survivorGap = Math.max(0, opponentSurvivors - survivors);
  return {
    title: "敗北",
    subtitle: `${damageTaken} HP 被弾 / ユニット差 ${Math.max(
      0,
      survivorGap,
    )}`,
    hint: survivorGap >= 3
      ? "前衛を増やす"
      : damageDealt >= damageTaken
        ? "配置を締める"
        : "後衛の時間を作る",
    damageDealt,
    damageTaken,
  };
}

export function buildRoundSummaryCaption({ ranking, sessionId }) {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return "火力集計待ち";
  }

  const topEntry = ranking[0];

  if (topEntry?.playerId === sessionId) {
    return "火力トップ";
  }

  return `${shortPlayerId(topEntry?.playerId)} が火力トップ`;
}

export function buildRoundSummaryTip({ ranking, sessionId }) {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return "崩れた位置を見る";
  }

  const topEntry = ranking[0];
  const ownEntry = ranking.find((entry) => entry?.playerId === sessionId) ?? null;

  if (topEntry?.playerId === sessionId) {
    return "主火力を守る";
  }

  if (ownEntry && Number.isFinite(ownEntry.damageDealt) && Number.isFinite(topEntry?.damageDealt)) {
    const damageGap = Math.max(0, topEntry.damageDealt - ownEntry.damageDealt);
    if (damageGap >= 10) {
      return `${damageGap} ダメージ差`;
    }
  }

  return "前線か集中攻撃を補う";
}

export function buildCommandResultCopy({ accepted, code, hint }) {
  if (accepted === true) {
    return "Action applied. Keep setting up until your board feels ready.";
  }

  if (accepted === false) {
    if (code === "INVALID_PLACEMENT" || code === "INVALID_CELL" || code === "CELL_OCCUPIED") {
      return "ここには置けません";
    }

    if (code === "PHASE_LOCKED" || code === "NOT_PREP" || code === "PREP_ONLY") {
      return "いまは準備時間ではありません";
    }

    if (code === "INSUFFICIENT_GOLD") {
      return "ゴールドが足りません";
    }

    if (code === "BENCH_FULL") {
      return "ベンチがいっぱいです";
    }

    if (typeof hint === "string" && hint.length > 0) {
      return "その操作は反映できませんでした。進行役に声をかけてください。";
    }

    return "その操作は反映できませんでした。";
  }

  return "";
}
