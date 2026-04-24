import { HEROES } from "../data/heroes";
import { getHeroExclusiveUnitById } from "../data/hero-exclusive-units";
import { resolveFrontPortraitAssetId } from "../shared/portrait-asset-manifest.js";
import { getScarletMansionUnitById } from "../data/scarlet-mansion-units";
import { getTouhouUnitById } from "../data/touhou-units";
import { BOSS_CHARACTERS } from "../shared/boss-characters";
import type { BoardUnitType } from "../shared/room-messages";
import type { UnitId } from "../shared/types";

export interface SharedBoardUnitPresentation {
  displayName: string;
  portraitKey: string;
}

function resolvePortraitKey(unitId: string | undefined): string {
  return resolveFrontPortraitAssetId(unitId) ?? "";
}

export function resolveSharedBoardUnitPresentation(
  unitId: UnitId | string | undefined,
  unitType: BoardUnitType,
): SharedBoardUnitPresentation | null {
  if (typeof unitId !== "string" || unitId.length === 0) {
    return null;
  }

  const touhouUnit = getTouhouUnitById(unitId as UnitId);
  if (touhouUnit) {
    return {
      displayName: touhouUnit.displayName,
      portraitKey: resolvePortraitKey(unitId),
    };
  }

  const scarletUnit = getScarletMansionUnitById(unitId);
  if (scarletUnit) {
    return {
      displayName: scarletUnit.displayName,
      portraitKey: resolvePortraitKey(unitId),
    };
  }

  const heroExclusiveUnit = getHeroExclusiveUnitById(unitId);
  if (heroExclusiveUnit) {
    return {
      displayName: heroExclusiveUnit.displayName,
      portraitKey: resolvePortraitKey(unitId),
    };
  }

  return null;
}

export function resolveSharedBoardHeroPresentation(
  heroId: string | undefined,
): SharedBoardUnitPresentation | null {
  if (typeof heroId !== "string" || heroId.length === 0) {
    return null;
  }

  const hero = HEROES.find((candidate) => candidate.id === heroId);
  if (!hero) {
    return null;
  }

  return {
    displayName: hero.name,
    portraitKey: resolvePortraitKey(heroId),
  };
}

export function resolveSharedBoardBossPresentation(
  bossId: string | undefined,
): SharedBoardUnitPresentation | null {
  if (typeof bossId !== "string" || bossId.length === 0) {
    return null;
  }

  const boss = BOSS_CHARACTERS.find((candidate) => candidate.id === bossId);
  if (!boss) {
    return null;
  }

  return {
    displayName: boss.displayName,
    portraitKey: boss.portraitKey,
  };
}
