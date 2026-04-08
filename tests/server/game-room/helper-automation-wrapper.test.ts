import { describe, expect, test } from "vitest";

import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } from "../../../src/shared/room-messages";
import { attachAutoFillHelperAutomationForTest } from "./helpers";

type FakeHelperPlayer = {
  role: string;
  ready: boolean;
  gold: number;
  benchUnits: string[];
  benchUnitIds?: string[];
  boardUnits: string[];
  boardSubUnits?: string[];
  shopOffers: Array<{ unitType: string; cost: number; unitId?: string; factionId?: string }>;
  bossShopOffers: Array<{ unitType: string; cost: number }>;
  selectedHeroId: string;
  selectedBossId: string;
  lastCmdSeq: number;
};

type FakeHelperState = {
  phase: string;
  playerPhase?: string;
  lobbyStage?: string;
  featureFlagsEnableTouhouRoster?: boolean;
  players: Map<string, FakeHelperPlayer>;
};

class FakeHelperRoom {
  public readonly sessionId = "player-1";
  public state: FakeHelperState | undefined;
  public readonly sentMessages: Array<{ type: string; message: unknown }> = [];

  private stateHandlers: Array<(state: unknown) => void> = [];
  private messageHandlers = new Map<string, Array<(message: unknown) => void>>();

  constructor(
    state?: FakeHelperState,
    private readonly options: {
      advanceToDeployAfterBuy?: boolean;
      deferStateUpdateAfterBuy?: boolean;
      deferStateUpdateAfterBuyMs?: number;
      deferStateUpdateAfterDeployMs?: number;
    } = {},
  ) {
    this.state = state;
  }

  public send(type: string, message?: unknown): void {
    this.sentMessages.push({ type, message });

    if (type !== CLIENT_MESSAGE_TYPES.PREP_COMMAND) {
      return;
    }

    const payload = message as {
      cmdSeq?: number;
      shopBuySlotIndex?: number;
      benchToBoardCell?: { benchIndex: number; cell: number; slot?: "main" | "sub" };
    };
    const player = this.state?.players.get(this.sessionId);
    if (!player) {
      return;
    }

    if (typeof payload.shopBuySlotIndex === "number") {
      const applyPurchaseStateUpdate = () => {
        player.shopOffers = [];
        player.benchUnits = ["vanguard"];
        player.gold = 14;
        player.lastCmdSeq = payload.cmdSeq ?? player.lastCmdSeq;
        if (this.state && this.options.advanceToDeployAfterBuy !== false) {
          this.state.playerPhase = "deploy";
        }
      };

      if (typeof this.options.deferStateUpdateAfterBuyMs === "number") {
        setTimeout(applyPurchaseStateUpdate, this.options.deferStateUpdateAfterBuyMs);
      } else if (this.options.deferStateUpdateAfterBuy === true) {
        queueMicrotask(applyPurchaseStateUpdate);
      } else {
        applyPurchaseStateUpdate();
      }

      this.emitMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: true });
      return;
    }

    if (payload.benchToBoardCell) {
      const applyDeployStateUpdate = () => {
        const { benchIndex, cell, slot } = payload.benchToBoardCell ?? {};
        const safeBenchIndex = Number(benchIndex);
        if (!Number.isInteger(safeBenchIndex) || safeBenchIndex < 0 || safeBenchIndex >= player.benchUnits.length) {
          this.emitMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: false, code: "invalid_bench_index" });
          return;
        }
        const safeCell = Number(cell);
        if (!Number.isInteger(safeCell)) {
          this.emitMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: false, code: "invalid_cell" });
          return;
        }

        const [benchUnit] = player.benchUnits.splice(safeBenchIndex, 1);
        player.boardSubUnits ??= [];

        if (slot === "sub") {
          const existingPlacementIndex = player.boardUnits.findIndex((placement) =>
            placement.startsWith(`${safeCell}:`)
          );
          if (existingPlacementIndex >= 0) {
            if (!player.boardUnits[existingPlacementIndex]?.endsWith(":sub")) {
              player.boardUnits[existingPlacementIndex] = `${player.boardUnits[existingPlacementIndex]}:sub`;
            }
            player.boardSubUnits = [...player.boardSubUnits.filter((token) => !token.startsWith(`${safeCell}:`)), `${safeCell}:${benchUnit}`];
          } else {
            this.emitMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: false, code: "invalid_sub_host" });
            return;
          }
        } else {
          player.boardUnits = [...player.boardUnits, `${safeCell}:${benchUnit}`];
        }

        player.lastCmdSeq = payload.cmdSeq ?? player.lastCmdSeq;
        this.emitMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: true });
      };

      if (this.state?.playerPhase === "purchase") {
        this.emitMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: false, code: "phase_locked" });
        return;
      }

      if (typeof this.options.deferStateUpdateAfterDeployMs === "number") {
        this.emitMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, { accepted: true });
        setTimeout(applyDeployStateUpdate, this.options.deferStateUpdateAfterDeployMs);
        return;
      }

      applyDeployStateUpdate();
    }
  }

  public onStateChange(handler: (state: unknown) => void): void {
    this.stateHandlers.push(handler);
  }

  public onMessage(type: string, handler: (message: unknown) => void): void {
    const handlers = this.messageHandlers.get(type) ?? [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  public emitState(): void {
    for (const handler of this.stateHandlers) {
      handler(this.state);
    }
  }

  private emitMessage(type: string, message: unknown): void {
    for (const handler of this.messageHandlers.get(type) ?? []) {
      handler(message);
    }
  }
}

describe("helper automation wrapper", () => {
  test("command result triggers a follow-up deploy after a buy updates bench state", async () => {
    const state: FakeHelperState = {
      phase: "Prep",
      playerPhase: "purchase",
      players: new Map([
        ["player-1", {
          role: "raid",
          ready: false,
          gold: 15,
          benchUnits: [],
          boardUnits: [],
          shopOffers: [{ unitType: "vanguard", cost: 1 }],
          bossShopOffers: [],
          selectedHeroId: "reimu",
          selectedBossId: "",
          lastCmdSeq: 0,
        }],
      ]),
    };
    const room = new FakeHelperRoom();

    attachAutoFillHelperAutomationForTest(room, 0);

    room.state = state;
    room.emitState();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(room.sentMessages).toHaveLength(2);
    expect(room.sentMessages[0]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 1,
        shopBuySlotIndex: 0,
      }),
    });
    expect(room.sentMessages[1]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: 19,
        },
      }),
    });
  });

  test("state changes in playerPhase retrigger deploy after an early deploy is rejected", async () => {
    const state: FakeHelperState = {
      phase: "Prep",
      playerPhase: "purchase",
      players: new Map([
        ["player-1", {
          role: "raid",
          ready: false,
          gold: 15,
          benchUnits: [],
          boardUnits: [],
          shopOffers: [{ unitType: "vanguard", cost: 1 }],
          bossShopOffers: [],
          selectedHeroId: "reimu",
          selectedBossId: "",
          lastCmdSeq: 0,
        }],
      ]),
    };
    const room = new FakeHelperRoom(undefined, { advanceToDeployAfterBuy: false });

    attachAutoFillHelperAutomationForTest(room, 0);

    room.state = state;
    room.emitState();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(room.sentMessages).toHaveLength(1);
    expect(room.sentMessages[0]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 1,
        shopBuySlotIndex: 0,
      }),
    });
    expect(state.players.get("player-1")?.boardUnits).toEqual([]);
    expect(state.players.get("player-1")?.benchUnits).toEqual(["vanguard"]);

    state.playerPhase = "deploy";
    room.emitState();

    expect(room.sentMessages).toHaveLength(2);
    expect(room.sentMessages[1]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: expect.any(Number),
        benchToBoardCell: {
          benchIndex: 0,
          cell: 19,
        },
      }),
    });
    expect(state.players.get("player-1")?.boardUnits).toEqual(["19:vanguard"]);
  });

  test("delayed bench sync after command result still triggers follow-up deploy", async () => {
    const state: FakeHelperState = {
      phase: "Prep",
      playerPhase: "purchase",
      players: new Map([
        ["player-1", {
          role: "raid",
          ready: false,
          gold: 15,
          benchUnits: [],
          boardUnits: [],
          shopOffers: [{ unitType: "vanguard", cost: 1 }],
          bossShopOffers: [],
          selectedHeroId: "reimu",
          selectedBossId: "",
          lastCmdSeq: 0,
        }],
      ]),
    };
    const room = new FakeHelperRoom(undefined, {
      deferStateUpdateAfterBuy: true,
    });

    attachAutoFillHelperAutomationForTest(room, 0);

    room.state = state;
    room.emitState();

    expect(room.sentMessages).toHaveLength(1);
    expect(room.sentMessages[0]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 1,
        shopBuySlotIndex: 0,
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(room.sentMessages).toHaveLength(2);
    expect(room.sentMessages[1]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: 19,
        },
      }),
    });
    expect(state.players.get("player-1")?.boardUnits).toEqual(["19:vanguard"]);
  });

  test("helper keeps retrying long enough to catch delayed post-buy state sync", async () => {
    const state: FakeHelperState = {
      phase: "Prep",
      playerPhase: "purchase",
      players: new Map([
        ["player-1", {
          role: "raid",
          ready: false,
          gold: 15,
          benchUnits: [],
          boardUnits: [],
          shopOffers: [{ unitType: "vanguard", cost: 1 }],
          bossShopOffers: [],
          selectedHeroId: "reimu",
          selectedBossId: "",
          lastCmdSeq: 0,
        }],
      ]),
    };
    const room = new FakeHelperRoom(undefined, {
      deferStateUpdateAfterBuyMs: 25,
    });

    attachAutoFillHelperAutomationForTest(room, 0);

    room.state = state;
    room.emitState();

    expect(room.sentMessages).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(room.sentMessages).toHaveLength(2);
    expect(room.sentMessages[1]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: 19,
        },
      }),
    });
    expect(state.players.get("player-1")?.boardUnits).toEqual(["19:vanguard"]);
  });

  test("helper keeps retrying through a slow first-round bench sync", async () => {
    const state: FakeHelperState = {
      phase: "Prep",
      playerPhase: "purchase",
      players: new Map([
        ["player-1", {
          role: "raid",
          ready: false,
          gold: 15,
          benchUnits: [],
          boardUnits: [],
          shopOffers: [{ unitType: "vanguard", cost: 1 }],
          bossShopOffers: [],
          selectedHeroId: "reimu",
          selectedBossId: "",
          lastCmdSeq: 0,
        }],
      ]),
    };
    const room = new FakeHelperRoom(undefined, {
      deferStateUpdateAfterBuyMs: 80,
    });

    attachAutoFillHelperAutomationForTest(room, 0);

    room.state = state;
    room.emitState();

    expect(room.sentMessages).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(room.sentMessages).toHaveLength(2);
    expect(room.sentMessages[1]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 2,
        benchToBoardCell: {
          benchIndex: 0,
          cell: 19,
        },
      }),
    });
    expect(state.players.get("player-1")?.boardUnits).toEqual(["19:vanguard"]);
  });

  test("wrapper can drive a high-cost raid helper that buys before deploying a duplicate bench unit", () => {
    const state: FakeHelperState = {
      phase: "Prep",
      playerPhase: "purchase",
      players: new Map([
        ["player-1", {
          role: "raid",
          ready: false,
          gold: 5,
          benchUnits: ["reserve"],
          benchUnitIds: ["yoshika"],
          boardUnits: [],
          shopOffers: [
            { unitType: "vanguard", unitId: "yoshika", factionId: "shinreibyou", cost: 1 },
            { unitType: "mage", unitId: "junko", factionId: "lunarian", cost: 3 },
          ],
          bossShopOffers: [],
          selectedHeroId: "reimu",
          selectedBossId: "",
          lastCmdSeq: 0,
        }],
      ]),
    };
    const room = new FakeHelperRoom();

    attachAutoFillHelperAutomationForTest(room, 0, { strategy: "highCost" });

    room.state = state;
    room.emitState();

    expect(room.sentMessages[0]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 1,
        shopBuySlotIndex: 1,
      }),
    });
  });

  test("delayed deploy sync still lets the wrapper attach a raid sub unit after the first host lands", async () => {
    const state: FakeHelperState = {
      phase: "Prep",
      playerPhase: "deploy",
      players: new Map([
        ["player-1", {
          role: "raid",
          ready: false,
          gold: 5,
          benchUnits: ["ranger", "assassin"],
          boardUnits: ["30:reimu"],
          boardSubUnits: [],
          shopOffers: [],
          bossShopOffers: [],
          selectedHeroId: "reimu",
          selectedBossId: "",
          lastCmdSeq: 0,
        }],
      ]),
    };
    const room = new FakeHelperRoom(undefined, {
      deferStateUpdateAfterDeployMs: 25,
    });

    attachAutoFillHelperAutomationForTest(room, 0);

    room.state = state;
    room.emitState();

    expect(room.sentMessages).toHaveLength(1);
    expect(room.sentMessages[0]).toMatchObject({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        cmdSeq: 1,
        benchToBoardCell: {
          benchIndex: 0,
          cell: 31,
        },
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(room.sentMessages.length).toBeGreaterThanOrEqual(2);
    expect(room.sentMessages).toContainEqual(expect.objectContaining({
      type: CLIENT_MESSAGE_TYPES.PREP_COMMAND,
      message: expect.objectContaining({
        benchToBoardCell: {
          benchIndex: 0,
          cell: 31,
          slot: "sub",
        },
      }),
    }));
    expect(state.players.get("player-1")?.boardUnits).toEqual(["30:reimu", "31:ranger:sub"]);
    expect(state.players.get("player-1")?.boardSubUnits).toEqual(["31:assassin"]);
  });
});
