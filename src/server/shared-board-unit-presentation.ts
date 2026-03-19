import { getScarletMansionUnitById } from "../data/scarlet-mansion-units";
import { getTouhouUnitById } from "../data/touhou-units";
import type { BoardUnitType } from "../shared/room-messages";
import type { UnitId } from "../shared/types";

const PORTRAIT_KEY_BY_UNIT_ID: Readonly<Record<string, string>> = {
  byakuren: "Reimu",
  chimata: "Marisa",
  clownpiece: "Cirno",
  futo: "Patchouli",
  hecatia: "Flandre",
  ichirin: "Hong",
  junko: "Remilia",
  kagerou: "Rumia",
  koishi: "Koishi",
  meiling: "Hong",
  megumu: "Marisa",
  miko: "Remilia",
  momoyo: "Hong",
  murasa: "Satori",
  nazrin: "Cirno",
  patchouli: "Patchouli",
  rin: "Rumia",
  sakuya: "Sakuya",
  satori: "Satori",
  seiga: "Sakuya",
  sekibanki: "Koishi",
  shou: "Marisa",
  tojiko: "Cirno",
  tsukasa: "Rumia",
  utsuho: "Flandre",
  wakasagihime: "Cirno",
  yoshika: "Rumia",
  zanmu: "Remilia",
};

const PORTRAIT_KEY_BY_UNIT_TYPE: Readonly<Record<BoardUnitType, string>> = {
  vanguard: "Hong",
  ranger: "Cirno",
  mage: "Patchouli",
  assassin: "Sakuya",
};

export interface SharedBoardUnitPresentation {
  displayName: string;
  portraitKey: string;
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
      portraitKey: PORTRAIT_KEY_BY_UNIT_ID[unitId] ?? PORTRAIT_KEY_BY_UNIT_TYPE[unitType],
    };
  }

  const scarletUnit = getScarletMansionUnitById(unitId);
  if (scarletUnit) {
    return {
      displayName: scarletUnit.displayName,
      portraitKey: PORTRAIT_KEY_BY_UNIT_ID[unitId] ?? PORTRAIT_KEY_BY_UNIT_TYPE[unitType],
    };
  }

  return null;
}
