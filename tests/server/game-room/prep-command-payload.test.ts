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
});
