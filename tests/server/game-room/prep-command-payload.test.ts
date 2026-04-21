import { describe, expect, it } from "vitest";

import { buildPrepCommandPayload } from "../../../src/server/rooms/game-room/prep-command-payload";
import type { PrepCommandMessage } from "../../../src/shared/room-messages";

describe("prep-command-payload", () => {
  it("returns undefined when the message carries no prep command fields", () => {
    const message: PrepCommandMessage = {
      cmdSeq: 1,
      correlationId: "corr-1",
    };

    expect(buildPrepCommandPayload(message)).toBeUndefined();
  });

  it("keeps only defined prep command fields in the built payload", () => {
    const message: PrepCommandMessage = {
      cmdSeq: 2,
      boardPlacements: [{ cell: 1, unitType: "vanguard" }],
      shopRefreshCount: 1,
      shopLock: false,
      benchToBoardCell: { benchIndex: 2, cell: 7 },
    };

    expect(buildPrepCommandPayload(message)).toEqual({
      boardPlacements: [{ cell: 1, unitType: "vanguard" }],
      shopRefreshCount: 1,
      shopLock: false,
      benchToBoardCell: { benchIndex: 2, cell: 7 },
    });
  });

  it("preserves benchToBoardCell slot targets for sub-slot commands", () => {
    const message: PrepCommandMessage = {
      cmdSeq: 3,
      benchToBoardCell: { benchIndex: 1, cell: 24, slot: "sub" },
    };

    expect(buildPrepCommandPayload(message)).toEqual({
      benchToBoardCell: { benchIndex: 1, cell: 24, slot: "sub" },
    });
  });

  it("preserves boardUnitMove slot targets for board-to-sub commands", () => {
    const message: PrepCommandMessage = {
      cmdSeq: 4,
      boardUnitMove: { fromCell: 24, toCell: 25, slot: "sub" },
    };

    expect(buildPrepCommandPayload(message)).toEqual({
      boardUnitMove: { fromCell: 24, toCell: 25, slot: "sub" },
    });
  });

  it("preserves heroPlacementCell for dedicated hero placement commands", () => {
    const message: PrepCommandMessage = {
      cmdSeq: 5,
      heroPlacementCell: 24,
    };

    expect(buildPrepCommandPayload(message)).toEqual({
      heroPlacementCell: 24,
    });
  });

  it("preserves zero-valued hero and board move cells", () => {
    const message: PrepCommandMessage = {
      cmdSeq: 6,
      heroPlacementCell: 0,
      boardUnitMove: { fromCell: 0, toCell: 0, slot: "main" },
    };

    expect(buildPrepCommandPayload(message)).toEqual({
      heroPlacementCell: 0,
      boardUnitMove: { fromCell: 0, toCell: 0, slot: "main" },
    });
  });

  it("preserves legacy mergeUnits payloads so the server can reject them explicitly", () => {
    const message = {
      cmdSeq: 7,
      mergeUnits: {
        unitType: "vanguard",
        unitLevel: 2,
        benchIndices: [0, 1, 2],
      },
    } as PrepCommandMessage & {
      mergeUnits: {
        unitType: string;
        unitLevel: number;
        benchIndices: number[];
      };
    };

    expect(buildPrepCommandPayload(message)).toEqual({
      mergeUnits: {
        unitType: "vanguard",
        unitLevel: 2,
        benchIndices: [0, 1, 2],
      },
    });
  });

  it("preserves hero-exclusive shop buys so dedicated prep commands are forwarded", () => {
    const message: PrepCommandMessage = {
      cmdSeq: 8,
      heroExclusiveShopBuySlotIndex: 0,
    };

    expect(buildPrepCommandPayload(message)).toEqual({
      heroExclusiveShopBuySlotIndex: 0,
    });
  });
});
