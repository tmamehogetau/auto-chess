export const AUTO_FILL_BOSS_ID = "remilia";
export const AUTO_FILL_HERO_IDS = [
  "reimu",
  "marisa",
  "okina",
  "keiki",
  "jyoon",
];
const AUTO_FILL_BOSS_DEPLOY_SEQUENCES = [
  [4, 10, 16],
  [1, 7, 13],
  [5, 11, 17],
];
const AUTO_FILL_RAID_DEPLOY_SEQUENCES = [
  [31, 25, 19],
  [33, 27, 21],
  [35, 29, 23],
];
const BOSS_OFFER_PRIORITY_BY_UNIT_ID = {
  patchouli: 300,
  sakuya: 200,
  meiling: 100,
};
const RAID_OFFER_PRIORITY_BY_UNIT_ID = {
  nazrin: 220,
  yoshika: 210,
  rin: 200,
  wakasagihime: 190,
  momoyo: 150,
  tojiko: 145,
  kagerou: 140,
  tsukasa: 135,
  sekibanki: 130,
  koishi: 125,
  megumu: 120,
  seiga: 115,
  satori: 110,
  murasa: 105,
  clownpiece: 100,
  ichirin: 95,
  shou: 90,
  futo: 85,
  utsuho: 80,
  chimata: 75,
  junko: 70,
  byakuren: 65,
  hecatia: 60,
  miko: 55,
  zanmu: 50,
};
const RAID_OFFER_PRIORITY_BY_UNIT_TYPE = {
  ranger: 40,
  vanguard: 35,
  mage: 15,
  assassin: 10,
};

function isTouhouAutoPickEnabled(state) {
  return state?.featureFlagsEnableTouhouRoster === true;
}

function toArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : Array.from(value);
}

function hasUnits(units) {
  return toArray(units).length > 0;
}

function hasOffers(offers) {
  return toArray(offers).length > 0;
}

function toFiniteTimestamp(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

export function resolveAutoFillHelperPlayerPhase(state, nowMs = Date.now()) {
  const playerPhase = typeof state?.playerPhase === "string"
    ? state.playerPhase
    : "";

  if (playerPhase !== "purchase") {
    return playerPhase;
  }

  const playerPhaseDeadlineAtMs = toFiniteTimestamp(state?.playerPhaseDeadlineAtMs);
  if (playerPhaseDeadlineAtMs !== null && nowMs >= playerPhaseDeadlineAtMs) {
    return "deploy";
  }

  return playerPhase;
}

function getBaseBoardUnitCount(role) {
  return role === "boss" || role === "raid" ? 1 : 0;
}

function getPlacedPurchasedUnitCount(role, boardUnits) {
  return Math.max(0, toArray(boardUnits).length - getBaseBoardUnitCount(role));
}

function getBossDeploySequence(helperIndex) {
  return AUTO_FILL_BOSS_DEPLOY_SEQUENCES[
    helperIndex % AUTO_FILL_BOSS_DEPLOY_SEQUENCES.length
  ];
}

function getRaidDeploySequence(helperIndex) {
  return AUTO_FILL_RAID_DEPLOY_SEQUENCES[
    helperIndex % AUTO_FILL_RAID_DEPLOY_SEQUENCES.length
  ];
}

function getDeploySequence(role, helperIndex) {
  if (role === "boss") {
    return getBossDeploySequence(helperIndex);
  }

  if (role === "raid") {
    return getRaidDeploySequence(helperIndex);
  }

  return null;
}

function parseBoardCell(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const [rawCell] = value.split(":");
    const parsedCell = Number(rawCell);
    return Number.isInteger(parsedCell) ? parsedCell : null;
  }

  if (value && typeof value === "object" && Number.isInteger(value.cell)) {
    return value.cell;
  }

  return null;
}

function getOccupiedBoardCells(boardUnits) {
  const occupiedCells = new Set();

  for (const unit of toArray(boardUnits)) {
    const cell = parseBoardCell(unit);
    if (cell !== null) {
      occupiedCells.add(cell);
    }
  }

  return occupiedCells;
}

function getNextDeployCell(role, helperIndex, boardUnits) {
  const occupiedCells = getOccupiedBoardCells(boardUnits);
  const deploySequence = getDeploySequence(role, helperIndex);

  if (!deploySequence) {
    return null;
  }

  return deploySequence.find((cell) => !occupiedCells.has(cell)) ?? null;
}

function getAvailableDeployCells(role, helperIndex, boardUnits) {
  const occupiedCells = getOccupiedBoardCells(boardUnits);
  const deploySequence = getDeploySequence(role, helperIndex);

  if (!deploySequence) {
    return [];
  }

  return deploySequence.filter((cell) => !occupiedCells.has(cell));
}

function getAvailableSubDeployCells(role, boardUnits, selectedHeroId, selectedBossId) {
  if (role !== "raid") {
    return [];
  }

  const specialUnitIds = new Set(
    [selectedHeroId, selectedBossId].filter(
      (value) => typeof value === "string" && value.length > 0,
    ),
  );

  return toArray(boardUnits)
    .map((unit) => parseBoardPlacement(unit))
    .filter((placement) => placement !== null)
    .filter((placement) => !specialUnitIds.has(placement.unitId))
    .filter((placement) => placement.subUnit === undefined)
    .map((placement) => placement.cell);
}

function buildDeployActions(
  role,
  helperIndex,
  boardUnits,
  benchUnits,
  selectedHeroId = "",
  selectedBossId = "",
) {
  const availableDeployCells = getAvailableDeployCells(role, helperIndex, boardUnits);
  const benchUnitList = toArray(benchUnits);
  const mainDeployCount = Math.min(availableDeployCells.length, benchUnitList.length);
  const actions = [];

  for (let benchIndex = 0; benchIndex < mainDeployCount; benchIndex += 1) {
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex,
          cell: availableDeployCells[benchIndex],
        },
      },
    });
  }

  const remainingBenchCount = benchUnitList.length - mainDeployCount;
  if (remainingBenchCount <= 0) {
    return actions;
  }

  const availableSubDeployCells = getAvailableSubDeployCells(
    role,
    boardUnits,
    selectedHeroId,
    selectedBossId,
  );
  const subDeployCount = Math.min(remainingBenchCount, availableSubDeployCells.length);

  for (let subIndex = 0; subIndex < subDeployCount; subIndex += 1) {
    actions.push({
      type: "prep_command",
      payload: {
        benchToBoardCell: {
          benchIndex: mainDeployCount + subIndex,
          cell: availableSubDeployCells[subIndex],
          slot: "sub",
        },
      },
    });
  }

  return actions;
}

function getOfferCost(offer) {
  return offer && typeof offer === "object" && Number.isFinite(offer.cost)
    ? offer.cost
    : null;
}

function normalizeOfferUnitId(offer) {
  return offer && typeof offer === "object" && typeof offer.unitId === "string"
    ? offer.unitId.trim().toLowerCase()
    : "";
}

function normalizeOfferUnitType(offer) {
  return offer && typeof offer === "object" && typeof offer.unitType === "string"
    ? offer.unitType.trim().toLowerCase()
    : "";
}

function getBossOfferPriorityScore(offer) {
  return BOSS_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
}

function getRaidOfferPriorityScore(offer) {
  const unitIdPriority = RAID_OFFER_PRIORITY_BY_UNIT_ID[normalizeOfferUnitId(offer)] ?? 0;
  const unitTypePriority = RAID_OFFER_PRIORITY_BY_UNIT_TYPE[normalizeOfferUnitType(offer)] ?? 0;
  const offerCost = getOfferCost(offer) ?? 0;
  return unitIdPriority + unitTypePriority - offerCost * 3;
}

function getOfferPriorityScore(role, offer) {
  if (role === "boss") {
    return getBossOfferPriorityScore(offer);
  }

  if (role === "raid") {
    return getRaidOfferPriorityScore(offer);
  }

  return 0;
}

function pickAffordableOfferIndex(offers, gold, role = "") {
  const offerList = toArray(offers);

  if (offerList.length === 0) {
    return null;
  }

  if (!Number.isFinite(gold)) {
    return null;
  }

  let bestOfferIndex = null;
  let bestOfferScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < offerList.length; index += 1) {
    const offerCost = getOfferCost(offerList[index]);
    if (offerCost !== null && offerCost <= gold) {
      const offerScore = getOfferPriorityScore(role, offerList[index]);
      if (bestOfferIndex === null || offerScore > bestOfferScore) {
        bestOfferIndex = index;
        bestOfferScore = offerScore;
      }
    }
  }

  return bestOfferIndex;
}

function buildReserveBuyAction(player) {
  if (player?.role === "boss" && hasOffers(player.bossShopOffers)) {
    const affordableBossSlotIndex = pickAffordableOfferIndex(
      player.bossShopOffers,
      player.gold,
      player.role,
    );
    if (affordableBossSlotIndex !== null) {
      return {
        type: "prep_command",
        payload: { bossShopBuySlotIndex: affordableBossSlotIndex },
      };
    }
  }

  if (player?.role === "raid" && hasOffers(player.shopOffers)) {
    const affordableShopSlotIndex = pickAffordableOfferIndex(
      player.shopOffers,
      player.gold,
      player.role,
    );
    if (affordableShopSlotIndex !== null) {
      return {
        type: "prep_command",
        payload: { shopBuySlotIndex: affordableShopSlotIndex },
      };
    }
  }

  return null;
}

function parseBoardPlacement(value) {
  const cell = parseBoardCell(value);
  if (cell === null) {
    return null;
  }

  if (value && typeof value === "object") {
    return {
      cell,
      unitId: typeof value.unitId === "string" ? value.unitId : "",
      subUnit: value.subUnit,
    };
  }

  if (typeof value === "string") {
    const [, rawUnitId = ""] = value.split(":");
    return {
      cell,
      unitId: rawUnitId,
      subUnit: undefined,
    };
  }

  return {
    cell,
    unitId: "",
    subUnit: undefined,
  };
}

function getReserveOffers(player) {
  if (player?.role === "boss") {
    return player.bossShopOffers;
  }

  if (player?.role === "raid") {
    return player.shopOffers;
  }

  return [];
}

export function buildAutoFillHelperActions({ state, player, helperIndex = 0 }) {
  if (!state || !player || player.isSpectator === true) {
    return [];
  }

  const phase = typeof state.phase === "string" ? state.phase : "";
  const lobbyStage = typeof state.lobbyStage === "string" ? state.lobbyStage : "";

  if (phase === "Waiting" && lobbyStage === "preference") {
    return player.ready !== true
      ? [
          {
            type: "ready",
            payload: { ready: true },
          },
        ]
      : [];
  }

  if (phase === "Waiting" && lobbyStage === "selection") {
    if (!isTouhouAutoPickEnabled(state)) {
      return [];
    }

    if (player.role === "boss" && !player.selectedBossId) {
      return [
        {
          type: "boss_select",
          payload: { bossId: AUTO_FILL_BOSS_ID },
        },
      ];
    }

    if (player.role === "raid" && !player.selectedHeroId) {
      return [
        {
          type: "HERO_SELECT",
          payload: {
            heroId: AUTO_FILL_HERO_IDS[helperIndex % AUTO_FILL_HERO_IDS.length],
          },
        },
      ];
    }

    return [];
  }

  if (phase === "Prep") {
    if (player.role !== "boss" && player.role !== "raid") {
      return [];
    }

    const playerPhase = resolveAutoFillHelperPlayerPhase(state);
    const nextDeployCell = getNextDeployCell(player.role, helperIndex, player.boardUnits);
    const placedPurchasedUnitCount = getPlacedPurchasedUnitCount(
      player.role,
      player.boardUnits,
    );
    const reserveOffers = getReserveOffers(player);
    const reserveBuyAction = nextDeployCell !== null
      ? buildReserveBuyAction(player)
      : null;
    const deployActions = hasUnits(player.benchUnits)
      ? buildDeployActions(
        player.role,
        helperIndex,
        player.boardUnits,
        player.benchUnits,
        player.selectedHeroId,
        player.selectedBossId,
      )
      : [];

    if (deployActions.length > 0) {
      return deployActions;
    }

    if (playerPhase === "purchase") {
      if (reserveBuyAction) {
        return [reserveBuyAction];
      }

      if (
        placedPurchasedUnitCount === 0
        && !Number.isFinite(player.gold)
      ) {
        if (player.role === "boss" && hasOffers(player.bossShopOffers)) {
          return [
            {
              type: "prep_command",
              payload: { bossShopBuySlotIndex: 0 },
            },
          ];
        }

        if (player.role === "raid" && hasOffers(player.shopOffers)) {
          return [
            {
              type: "prep_command",
              payload: { shopBuySlotIndex: 0 },
            },
          ];
        }
      }

      return [];
    }

    if (playerPhase === "deploy") {
      if (hasUnits(player.benchUnits)) {
        if (deployActions.length === 0) {
          return player.ready !== true
            ? [
                {
                  type: "ready",
                  payload: { ready: true },
                },
              ]
            : [];
        }

        return deployActions;
      }

      if (
        placedPurchasedUnitCount === 0
        && !hasUnits(player.benchUnits)
        && !hasOffers(reserveOffers)
      ) {
        return [];
      }

      return player.ready !== true
        ? [
            {
              type: "ready",
              payload: { ready: true },
            },
          ]
        : [];
    }

    if (hasUnits(player.benchUnits)) {
      if (deployActions.length === 0) {
        return player.ready !== true
          ? [
              {
                type: "ready",
                payload: { ready: true },
              },
          ]
          : [];
      }

      return deployActions;
    }

    if (nextDeployCell !== null) {
      if (reserveBuyAction) {
        return [reserveBuyAction];
      }
    }

    if (
      placedPurchasedUnitCount === 0
      && !Number.isFinite(player.gold)
    ) {
      if (player.role === "boss" && hasOffers(player.bossShopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { bossShopBuySlotIndex: 0 },
          },
        ];
      }

      if (player.role === "raid" && hasOffers(player.shopOffers)) {
        return [
          {
            type: "prep_command",
            payload: { shopBuySlotIndex: 0 },
          },
        ];
      }
    }

    if (!Number.isFinite(player.gold) && placedPurchasedUnitCount > 0) {
      return [];
    }

    if (
      placedPurchasedUnitCount === 0
      && !hasUnits(player.benchUnits)
      && !hasOffers(reserveOffers)
    ) {
      return [];
    }

    if (player.ready !== true) {
      return [
        {
          type: "ready",
          payload: { ready: true },
        },
      ];
    }

    return [];
  }

  return [];
}
