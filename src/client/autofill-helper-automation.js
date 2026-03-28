export const AUTO_FILL_BOSS_ID = "remilia";
export const AUTO_FILL_HERO_IDS = [
  "reimu",
  "marisa",
  "okina",
  "keiki",
  "megumu",
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

function getOfferCost(offer) {
  return offer && typeof offer === "object" && Number.isFinite(offer.cost)
    ? offer.cost
    : null;
}

function pickAffordableOfferIndex(offers, gold) {
  const offerList = toArray(offers);

  if (offerList.length === 0) {
    return null;
  }

  if (!Number.isFinite(gold)) {
    return null;
  }

  for (let index = 0; index < offerList.length; index += 1) {
    const offerCost = getOfferCost(offerList[index]);
    if (offerCost !== null && offerCost <= gold) {
      return index;
    }
  }

  return null;
}

function buildReserveBuyAction(player) {
  if (player?.role === "boss" && hasOffers(player.bossShopOffers)) {
    const affordableBossSlotIndex = pickAffordableOfferIndex(
      player.bossShopOffers,
      player.gold,
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

export function buildAutoFillHelperActions({ state, player, helperIndex = 0 }) {
  if (!state || !player || player.isSpectator === true) {
    return [];
  }

  const phase = typeof state.phase === "string" ? state.phase : "";
  const lobbyStage = typeof state.lobbyStage === "string" ? state.lobbyStage : "";

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

    const nextDeployCell = getNextDeployCell(player.role, helperIndex, player.boardUnits);
    const placedPurchasedUnitCount = getPlacedPurchasedUnitCount(
      player.role,
      player.boardUnits,
    );

    if (hasUnits(player.benchUnits)) {
      if (nextDeployCell === null) {
        return player.ready !== true
          ? [
              {
                type: "ready",
                payload: { ready: true },
              },
            ]
          : [];
      }

      return [
        {
          type: "prep_command",
          payload: {
            benchToBoardCell: {
              benchIndex: 0,
              cell: nextDeployCell,
            },
          },
        },
      ];
    }

    if (nextDeployCell !== null) {
      const reserveBuyAction = buildReserveBuyAction(player);
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

    if (nextDeployCell === null) {
      const reserveBuyAction = buildReserveBuyAction(player);
      if (reserveBuyAction) {
        return [reserveBuyAction];
      }
    }

    if (!Number.isFinite(player.gold) && placedPurchasedUnitCount > 0) {
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
