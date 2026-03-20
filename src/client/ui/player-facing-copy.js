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
  readyCount,
  totalCount,
}) {
  if (phase === "Waiting" && heroEnabled && !heroSelected) {
    return "Choose a hero first. Then press Ready to open the first prep phase.";
  }

  if (phase === "Waiting") {
    if (isReady) {
      return "Ready locked. Wait for Prep to open, then buy and place before battle starts.";
    }

    return "Press Ready to open the first prep phase. Buying and placement unlock as soon as Prep begins.";
  }

  if (phase !== "Prep" && phase !== "Waiting") {
    return "Battle in progress. Watch the result, then set up again on the next prep phase.";
  }

  if (isReady) {
    return "Locked in. Cancel Ready if you still want to move units or change your shop plan.";
  }

  const safeReadyCount = Number.isFinite(readyCount) ? readyCount : 0;
  const safeTotalCount = Number.isFinite(totalCount) ? totalCount : 0;
  const waitingPlayers = Math.max(0, safeTotalCount - safeReadyCount);

  if (waitingPlayers > 1) {
    return `${waitingPlayers} players are still setting up. Buy, place, then press Ready when your side is stable.`;
  }

  if (waitingPlayers === 1) {
    return "One player is still setting up. Finish your board, then press Ready to lock it in.";
  }

  return "Buy units, place them on the shared board, then press Ready.";
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

  if (heroEnabled && !heroSelected && (phase === "Waiting" || phase === "Prep")) {
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
      resultText: "Waiting for battle",
      helperText: "Boss phase HP appears here when battle starts. Drop it to 0 to clear the phase.",
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
      valueText: `${remainingHp} HP left (${textPercent}% pushed)`,
      resultText: "Phase cleared",
      helperText: "The raid broke the boss phase HP bar. Rebuild and get ready for the next push.",
    };
  }

  if (progress.result === "failed") {
    return {
      valueText: `${remainingHp} HP left (${textPercent}% pushed)`,
      resultText: "Boss held this phase",
      helperText: `The boss still had ${remainingHp} HP. Rebuild and push harder next round.`,
    };
  }

  return {
    valueText: `${remainingHp} HP left (${textPercent}% pushed)`,
    resultText: "Phase in progress",
    helperText: "This is the boss HP still standing. Drop it to 0 to clear the phase.",
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
      return "Final Judgment: calculating...";
    }

    return winnerPlayerId === bossPlayerId
      ? "Final Judgment: Boss Victory"
      : "Final Judgment: Raid Victory";
  }

  const roundNumber = toRoundNumber(Number(roundIndex));

  if (safePhase === "Prep") {
    return `Round ${roundNumber}: buy, place, then Ready`;
  }

  if (safePhase === "Battle") {
    return `Round ${roundNumber}: hold the line and push phase damage`;
  }

  if (safePhase === "Settle") {
    return `Round ${roundNumber}: read the result and fix one weak lane`;
  }

  return `Round ${roundNumber}: next judgment pending`;
}

export function buildBattleResultCopy({ isVictory, battleResult }) {
  const damageDealt = Math.max(0, Math.round(Number(battleResult?.damageDealt) || 0));
  const damageTaken = Math.max(0, Math.round(Number(battleResult?.damageTaken) || 0));
  const survivors = Math.max(0, Math.round(Number(battleResult?.survivors) || 0));
  const opponentSurvivors = Math.max(0, Math.round(Number(battleResult?.opponentSurvivors) || 0));

  if (isVictory) {
    return {
      title: "🏆 VICTORY",
      subtitle: `You won this fight, dealt ${damageDealt} damage, and kept ${survivors} allies standing.`,
      hint: damageTaken === 0
        ? "Perfect hold. Keep this formation and push the boss even faster next round."
        : damageDealt < damageTaken
          ? "You won, but the trade was rough. Add a sturdier front line before the next push."
          : "You won the trade. Protect the weak lane and turn this lead into boss damage next round.",
      damageDealt,
      damageTaken,
    };
  }

  const survivorGap = Math.max(0, opponentSurvivors - survivors);
  return {
    title: "💀 DEFEAT",
    subtitle: `You lost this fight, took ${damageTaken} HP damage, and finished ${Math.max(
      0,
      survivorGap,
    )} units behind.`,
    hint: survivorGap >= 3
      ? "You were overrun. Add more frontline bodies or move carries away from the first hit."
      : damageDealt >= damageTaken
        ? "The fight was close. Tighten positioning and finish low targets faster next round."
        : "You took too much damage. Reinforce the front and buy time for your backline to work.",
    damageDealt,
    damageTaken,
  };
}

export function buildRoundSummaryCaption({ ranking, sessionId }) {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return "No round damage ranking yet. Watch the next battle to see who is carrying the phase.";
  }

  const topEntry = ranking[0];

  if (topEntry?.playerId === sessionId) {
    return "You led the damage this round. Cover weak lanes before the next fight.";
  }

  return `${shortPlayerId(topEntry?.playerId)} led the damage. Check whether your side needs more front line or focus fire.`;
}

export function buildRoundSummaryTip({ ranking, sessionId }) {
  if (!Array.isArray(ranking) || ranking.length === 0) {
    return "Watch the next fight and note which lane breaks first.";
  }

  const topEntry = ranking[0];
  const ownEntry = ranking.find((entry) => entry?.playerId === sessionId) ?? null;

  if (topEntry?.playerId === sessionId) {
    return "You are carrying damage. Ask allies to cover open lanes and keep your carry safe.";
  }

  if (ownEntry && Number.isFinite(ownEntry.damageDealt) && Number.isFinite(topEntry?.damageDealt)) {
    const damageGap = Math.max(0, topEntry.damageDealt - ownEntry.damageDealt);
    if (damageGap >= 10) {
      return `You trailed by ${damageGap} damage. Try a stronger carry lane or cleaner focus fire next round.`;
    }
  }

  return "Check whether your side needs more frontline, better focus fire, or a safer carry position.";
}

export function buildCommandResultCopy({ accepted, code, hint }) {
  if (accepted === true) {
    return "Action applied. Keep setting up until your board feels ready.";
  }

  if (accepted === false) {
    return `That action did not go through: ${code}${hint ? ` - ${hint}` : ""}`;
  }

  return "";
}
