import {
  createBattleUnit,
  type BattleUnit,
} from "../combat/battle-simulator";
import type {
  BoardUnitPlacement,
  BoardUnitType,
} from "../../shared/room-messages";
import type { FeatureFlags } from "../../shared/feature-flags";
import type { SpellCombatModifiers } from "./battle-resolution";
import { resolveBattlePlacements } from "../unit-id-resolver";

export interface RaidBattleInput {
  bossPlayerId: string;
  raidPlayerIds: string[];
  bossIsLeft: boolean;
  leftPlayerIds: string[];
  rightPlayerIds: string[];
  leftPlacements: BoardUnitPlacement[];
  rightPlacements: BoardUnitPlacement[];
}

export interface MatchupSideContext {
  heroIds: string[];
  resolvedPlacements: BoardUnitPlacement[];
  battleUnits: BattleUnit[];
  heroSynergyBonusTypes: BoardUnitType[];
}

export interface PreparedMatchupContext {
  battleId: string;
  leftPlayerId: string;
  rightPlayerId: string;
  battleIndex: number;
  raidBattleInput: RaidBattleInput | null;
  leftSide: MatchupSideContext;
  rightSide: MatchupSideContext;
}

interface MatchupContextBuilderOptions {
  leftPlayerId: string;
  rightPlayerId: string;
  roundIndex: number;
  raidBattleInput: RaidBattleInput | null;
  battleInputSnapshotByPlayer: ReadonlyMap<string, BoardUnitPlacement[]>;
  currentRoundPairings: Array<{ leftPlayerId: string; rightPlayerId: string | null }>;
  rosterFlags: FeatureFlags;
  buildSpellModifiers: (playerIds: string[]) => SpellCombatModifiers | null;
  applySpellModifiers: (
    battleUnits: BattleUnit[],
    modifiers: SpellCombatModifiers | null,
  ) => void;
  appendHeroBattleUnits: (
    playerIds: string[],
    battleUnits: BattleUnit[],
    side: "left" | "right",
  ) => string[];
  buildHeroSynergyBonusTypes: (playerIds: string[]) => BoardUnitType[];
}

export function buildPreparedMatchupContext(
  options: MatchupContextBuilderOptions,
): PreparedMatchupContext {
  const {
    leftPlayerId,
    rightPlayerId,
    roundIndex,
    raidBattleInput,
    battleInputSnapshotByPlayer,
    currentRoundPairings,
    rosterFlags,
    buildSpellModifiers,
    applySpellModifiers,
    appendHeroBattleUnits,
    buildHeroSynergyBonusTypes,
  } = options;

  const leftPlayerIds = raidBattleInput?.leftPlayerIds ?? [leftPlayerId];
  const rightPlayerIds = raidBattleInput?.rightPlayerIds ?? [rightPlayerId];
  const leftPlacements =
    raidBattleInput?.leftPlacements
    ?? battleInputSnapshotByPlayer.get(leftPlayerId)
    ?? [];
  const rightPlacements =
    raidBattleInput?.rightPlacements
    ?? battleInputSnapshotByPlayer.get(rightPlayerId)
    ?? [];
  const leftSide = createMatchupSideContext({
    side: "left",
    playerIds: leftPlayerIds,
    placements: leftPlacements,
    isBossSide: raidBattleInput?.bossIsLeft ?? false,
    rosterFlags,
    buildSpellModifiers,
    applySpellModifiers,
    appendHeroBattleUnits,
    buildHeroSynergyBonusTypes,
  });
  const rightSide = createMatchupSideContext({
    side: "right",
    playerIds: rightPlayerIds,
    placements: rightPlacements,
    isBossSide: raidBattleInput ? !raidBattleInput.bossIsLeft : false,
    rosterFlags,
    buildSpellModifiers,
    applySpellModifiers,
    appendHeroBattleUnits,
    buildHeroSynergyBonusTypes,
  });

  return {
    battleId: buildBattleId(roundIndex, leftPlayerId, rightPlayerId),
    leftPlayerId,
    rightPlayerId,
    battleIndex: currentRoundPairings.findIndex(
      (pairing) => pairing.leftPlayerId === leftPlayerId && pairing.rightPlayerId === rightPlayerId,
    ),
    raidBattleInput,
    leftSide,
    rightSide,
  };
}

interface MatchupSideContextOptions {
  side: "left" | "right";
  playerIds: string[];
  placements: BoardUnitPlacement[];
  isBossSide: boolean;
  rosterFlags: FeatureFlags;
  buildSpellModifiers: (playerIds: string[]) => SpellCombatModifiers | null;
  applySpellModifiers: (
    battleUnits: BattleUnit[],
    modifiers: SpellCombatModifiers | null,
  ) => void;
  appendHeroBattleUnits: (
    playerIds: string[],
    battleUnits: BattleUnit[],
    side: "left" | "right",
  ) => string[];
  buildHeroSynergyBonusTypes: (playerIds: string[]) => BoardUnitType[];
}

export function createMatchupSideContext(
  options: MatchupSideContextOptions,
): MatchupSideContext {
  const {
    side,
    playerIds,
    placements,
    isBossSide,
    rosterFlags,
    buildSpellModifiers,
    applySpellModifiers,
    appendHeroBattleUnits,
    buildHeroSynergyBonusTypes,
  } = options;
  const ownerPlayerId = playerIds.length === 1 ? playerIds[0] : null;
  const placementsWithOwner = placements.map((placement) => ({
    ...placement,
    ...(
      typeof placement.ownerPlayerId === "string" && placement.ownerPlayerId.length > 0
        ? { ownerPlayerId: placement.ownerPlayerId }
        : ownerPlayerId
          ? { ownerPlayerId }
          : {}
    ),
  }));
  const resolvedPlacements = resolveBattlePlacements(placementsWithOwner, rosterFlags);
  const battleUnits = resolvedPlacements.map((placement, index) =>
    createBattleUnit(placement, side, index, isBossSide, rosterFlags),
  );

  applySpellModifiers(battleUnits, buildSpellModifiers(playerIds));

  return {
    heroIds: appendHeroBattleUnits(playerIds, battleUnits, side),
    resolvedPlacements,
    battleUnits,
    heroSynergyBonusTypes: buildHeroSynergyBonusTypes(playerIds),
  };
}

export function buildBattleId(
  roundIndex: number,
  leftPlayerId: string,
  rightPlayerId: string,
): string {
  return `r${roundIndex}-${leftPlayerId}-${rightPlayerId}`;
}
