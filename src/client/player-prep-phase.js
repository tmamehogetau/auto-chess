function resolveExplicitPlayerPhase(state, roundState) {
  const playerPhaseFromState = typeof state?.playerPhase === "string" ? state.playerPhase : "";
  if (playerPhaseFromState.length > 0) {
    return playerPhaseFromState;
  }

  const playerPhaseFromRoundState = typeof roundState?.playerPhase === "string" ? roundState.playerPhase : "";
  if (playerPhaseFromRoundState.length > 0) {
    return playerPhaseFromRoundState;
  }

  return "";
}

function resolvePrepDeadlineAtMs(state, roundState) {
  const prepDeadline = Number(state?.prepDeadlineAtMs ?? roundState?.phaseDeadlineAtMs ?? state?.phaseDeadlineAtMs);
  return Number.isFinite(prepDeadline) && prepDeadline > 0 ? prepDeadline : 0;
}

function resolvePlayerPhaseDeadlineAtMs(state, roundState) {
  const playerPhaseDeadline = Number(roundState?.playerPhaseDeadlineAtMs ?? state?.playerPhaseDeadlineAtMs);
  return Number.isFinite(playerPhaseDeadline) && playerPhaseDeadline > 0 ? playerPhaseDeadline : 0;
}

function isPrepInteractionUnlocked(currentPhase, playerFacingPhase, isReady) {
  return currentPhase === "Prep"
    && isReady !== true
    && playerFacingPhase !== "battle"
    && playerFacingPhase !== "lobby"
    && playerFacingPhase !== "selection";
}

function formatActiveDeadlineCountdown(deadlineAtMs, nowMs = Date.now()) {
  const valueText = formatDeadlineCountdown(deadlineAtMs, nowMs);
  return valueText === "0s" ? "1s" : valueText;
}

export function resolvePlayerFacingPhase(state, roundState, nowMs = Date.now()) {
  const explicitPlayerPhase = resolveExplicitPlayerPhase(state, roundState);
  const phase = typeof state?.phase === "string" ? state.phase : "Waiting";
  const lobbyStage = typeof state?.lobbyStage === "string" ? state.lobbyStage : "preference";

  if (phase === "Prep") {
    if (explicitPlayerPhase === "purchase" || explicitPlayerPhase === "deploy") {
      return explicitPlayerPhase;
    }

    const prepDeadlineAtMs = resolvePrepDeadlineAtMs(state, roundState);
    const playerPhaseDeadlineAtMs = resolvePlayerPhaseDeadlineAtMs(state, roundState);

    if (prepDeadlineAtMs > 0 && playerPhaseDeadlineAtMs > 0 && prepDeadlineAtMs > playerPhaseDeadlineAtMs) {
      return nowMs < playerPhaseDeadlineAtMs ? "purchase" : "deploy";
    }

    return "deploy";
  }

  if (phase === "Settle" || phase === "Elimination" || phase === "End") {
    return "result";
  }

  if (phase === "Battle") {
    return "battle";
  }

  if (explicitPlayerPhase.length > 0) {
    return explicitPlayerPhase;
  }

  if (phase === "Waiting" && lobbyStage === "selection") {
    return "selection";
  }

  return "lobby";
}

export function formatDeadlineCountdown(deadlineAtMs, nowMs = Date.now()) {
  const remainingMs = Math.max(0, Math.round(Number(deadlineAtMs) - nowMs));
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  return `${remainingSeconds}s`;
}

export function buildDeadlineSummary(state, roundState, nowMs = Date.now()) {
  const playerFacingPhase = resolvePlayerFacingPhase(state, roundState, nowMs);
  const playerPhaseDeadlineAtMs = resolvePlayerPhaseDeadlineAtMs(state, roundState);
  const prepDeadlineAtMs = resolvePrepDeadlineAtMs(state, roundState);
  const phase = typeof state?.phase === "string" ? state.phase : "Waiting";

  if (playerFacingPhase === "purchase" && playerPhaseDeadlineAtMs > 0) {
    return {
      label: "Purchase",
      valueText: formatActiveDeadlineCountdown(playerPhaseDeadlineAtMs, nowMs),
    };
  }

  if (playerFacingPhase === "deploy" && prepDeadlineAtMs > 0) {
    return {
      label: "Deploy",
      valueText: formatActiveDeadlineCountdown(prepDeadlineAtMs, nowMs),
    };
  }

  if (playerFacingPhase === "deploy" && playerPhaseDeadlineAtMs > 0) {
    return {
      label: "Deploy",
      valueText: formatActiveDeadlineCountdown(playerPhaseDeadlineAtMs, nowMs),
    };
  }

  if (phase === "Settle") {
    const resultDeadlineAtMs = Number(roundState?.phaseDeadlineAtMs ?? state?.phaseDeadlineAtMs);
    if (Number.isFinite(resultDeadlineAtMs) && resultDeadlineAtMs > 0) {
      return {
        label: "Result",
        valueText: formatActiveDeadlineCountdown(resultDeadlineAtMs, nowMs),
      };
    }
  }

  if (playerFacingPhase === "result") {
    const resultDeadlineAtMs = Number(
      roundState?.playerPhaseDeadlineAtMs
      ?? roundState?.phaseDeadlineAtMs
      ?? state?.phaseDeadlineAtMs,
    );
    if (Number.isFinite(resultDeadlineAtMs) && resultDeadlineAtMs > 0) {
      return {
        label: phase === "End" ? "Final Judgment" : "Result",
        valueText: formatActiveDeadlineCountdown(resultDeadlineAtMs, nowMs),
      };
    }

    if (phase === "End") {
      return {
        label: "Final Judgment",
        valueText: "complete",
      };
    }
  }

  if (playerFacingPhase === "battle") {
    const battleDeadlineAtMs = Number(roundState?.playerPhaseDeadlineAtMs ?? roundState?.phaseDeadlineAtMs ?? state?.phaseDeadlineAtMs);
    if (Number.isFinite(battleDeadlineAtMs) && battleDeadlineAtMs > 0) {
      return {
        label: "Battle",
        valueText: formatActiveDeadlineCountdown(battleDeadlineAtMs, nowMs),
      };
    }

    if (phase === "Battle") {
      return {
        label: "Final Battle",
        valueText: "until resolution",
      };
    }
  }

  if (phase === "Waiting" && Number(state?.selectionDeadlineAtMs) > 0) {
    return {
      label: "Selection",
      valueText: formatActiveDeadlineCountdown(state.selectionDeadlineAtMs, nowMs),
    };
  }

  if (phase === "Prep" && prepDeadlineAtMs > 0) {
    return {
      label: "Prep",
      valueText: formatActiveDeadlineCountdown(prepDeadlineAtMs, nowMs),
    };
  }

  const phaseDeadlineAtMs = Number(roundState?.phaseDeadlineAtMs ?? state?.phaseDeadlineAtMs);
  if (Number.isFinite(phaseDeadlineAtMs) && phaseDeadlineAtMs > 0) {
    return {
      label: phase === "Waiting" ? "Lobby" : phase,
      valueText: formatActiveDeadlineCountdown(phaseDeadlineAtMs, nowMs),
    };
  }

  return {
    label: "Deadline",
    valueText: "pending",
  };
}

export function canUseShopAction({ currentPhase, playerFacingPhase, isReady }) {
  return isPrepInteractionUnlocked(currentPhase, playerFacingPhase, isReady)
    && playerFacingPhase === "purchase";
}

export function canUseBoardAction({ currentPhase, playerFacingPhase, isReady }) {
  return isPrepInteractionUnlocked(currentPhase, playerFacingPhase, isReady)
    && playerFacingPhase === "deploy";
}

export function canUseBenchAction({ currentPhase, playerFacingPhase, isReady }) {
  return isPrepInteractionUnlocked(currentPhase, playerFacingPhase, isReady)
    && (playerFacingPhase === "purchase" || playerFacingPhase === "deploy");
}
