import { MapSchema } from "@colyseus/schema";

import { PlayerPresenceState } from "../../schema/match-room-state";

export interface ResolveBossPlayerIdParams {
  connectedPlayerIds: string[];
  wantsBossByPlayer: Map<string, boolean>;
  random: () => number;
}

export interface ResetSelectionStageParams {
  connectedPlayerIds: string[];
  players: MapSchema<PlayerPresenceState>;
}

export interface CanAcceptBossPreferenceParams {
  phase: string;
  lobbyStage: string;
}

export interface ResetSelectionStageResult {
  lobbyStage: "preference";
  selectionDeadlineAtMs: 0;
  bossPlayerId: "";
}

function pickConnectedPlayerId(playerIds: string[], random: () => number): string {
  if (playerIds.length === 0) {
    return "";
  }

  const index = Math.floor(random() * playerIds.length);
  return playerIds[index] ?? playerIds[0] ?? "";
}

export function resolveBossPlayerId(params: ResolveBossPlayerIdParams): string {
  const volunteerIds = params.connectedPlayerIds.filter((playerId) => params.wantsBossByPlayer.get(playerId));
  const candidates = volunteerIds.length > 0 ? volunteerIds : params.connectedPlayerIds;

  return pickConnectedPlayerId(candidates, params.random);
}

export function resetSelectionStage(params: ResetSelectionStageParams): ResetSelectionStageResult {
  for (const playerId of params.connectedPlayerIds) {
    const player = params.players.get(playerId);
    if (!player) {
      continue;
    }

    if (player.isSpectator) {
      player.role = "spectator";
      player.selectedBossId = "";
      player.selectedHeroId = "";
      player.ready = false;
      continue;
    }

    player.role = "unassigned";
    player.selectedBossId = "";
    player.selectedHeroId = "";
    player.ready = false;
  }

  return {
    lobbyStage: "preference",
    selectionDeadlineAtMs: 0,
    bossPlayerId: "",
  };
}

export function canAcceptBossPreference(params: CanAcceptBossPreferenceParams): boolean {
  return params.phase === "Waiting" && params.lobbyStage === "preference";
}
