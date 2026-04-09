import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { ColyseusTestServer } from "@colyseus/testing";
import { defineRoom, defineServer } from "colyseus";

import {
  DEFAULT_SET_ID_SELECTOR,
  connectAndAttachSetIdDisplay,
  type BrowserClient,
  type BrowserRoom,
} from "../../../src/client/main";
import {
  buildAutoFillHelperActions,
  resolveAutoFillHelperPlayerPhase,
} from "../../../src/client/autofill-helper-automation.js";
import { GameRoom } from "../../../src/server/rooms/game-room";
import { SharedBoardRoom } from "../../../src/server/rooms/shared-board-room";
import { resolveSharedBoardUnitPresentation } from "../../../src/server/shared-board-unit-presentation";
import { combatCellToRaidBoardIndex } from "../../../src/shared/board-geometry";
import { sharedBoardCoordinateToIndex } from "../../../src/shared/shared-board-config";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type AdminResponseMessage,
  type RoundStateMessage,
} from "../../../src/shared/room-messages";
import type { FeatureFlags } from "../../../src/shared/feature-flags";
import { FeatureFlagService } from "../../../src/server/feature-flag-service";
import {
  FLAG_CONFIGURATIONS,
  FLAG_ENV_VARS,
  withFlags,
  captureManagedFlagEnv,
  createRoomWithForcedFlags,
  restoreManagedFlagEnv,
  restoreForcedFlagFixtures,
} from "../feature-flag-test-helper";
import {
  waitForCondition,
  waitForSharedBoardPropagation,
  waitForText,
} from "../../helpers/wait-helpers";

export { describe, expect, test, vi };
export {
  DEFAULT_SET_ID_SELECTOR,
  connectAndAttachSetIdDisplay,
  GameRoom,
  SharedBoardRoom,
  resolveSharedBoardUnitPresentation,
  combatCellToRaidBoardIndex,
  sharedBoardCoordinateToIndex,
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  FeatureFlagService,
  FLAG_CONFIGURATIONS,
  FLAG_ENV_VARS,
  withFlags,
  captureManagedFlagEnv,
  createRoomWithForcedFlags,
  restoreManagedFlagEnv,
  restoreForcedFlagFixtures,
  waitForCondition,
  waitForSharedBoardPropagation,
  waitForText,
};
export type {
  AdminResponseMessage,
  BrowserClient,
  BrowserRoom,
  FeatureFlags,
  RoundStateMessage,
};

export const SHARED_BOARD_PROPAGATION_TIMEOUT_MS = 10_000;
export const SHARED_BOARD_BOSS_PROPAGATION_TIMEOUT_MS = 15_000;
const HELPER_AUTOMATION_RETRY_DELAY_MS = 10;
const HELPER_AUTOMATION_RETRY_ATTEMPTS = 16;

export type GameRoomIntegrationContext = {
  readonly testServer: ColyseusTestServer;
};

const resolveTestServerPort = (name: string): number => {
  let hash = 0;

  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % 200;
  }

  return 2_570 + hash;
};

export const describeGameRoomIntegration = (
  name: string,
  register: (context: GameRoomIntegrationContext) => void,
): void => {
  describe(name, () => {
    let testServer!: ColyseusTestServer;
    let originalEnv = captureManagedFlagEnv();

    const context: GameRoomIntegrationContext = {
      get testServer() {
        return testServer;
      },
    };

    beforeAll(async () => {
      const server = defineServer({
        rooms: {
          game: defineRoom(GameRoom, {
            readyAutoStartMs: 2_000,
            prepDurationMs: 120,
            battleDurationMs: 120,
            settleDurationMs: 80,
            eliminationDurationMs: 80,
          }),
          shared_board: defineRoom(SharedBoardRoom, {
            lockDurationMs: 1_000,
          }),
        },
      });

      await server.listen(resolveTestServerPort(name));
      testServer = new ColyseusTestServer(server);
    });

    beforeEach(() => {
      originalEnv = captureManagedFlagEnv();
      for (const [flagName, envVarName] of Object.entries(FLAG_ENV_VARS)) {
        process.env[envVarName] = String(
          FLAG_CONFIGURATIONS.ALL_DISABLED[flagName as keyof typeof FLAG_CONFIGURATIONS.ALL_DISABLED],
        );
      }
      FeatureFlagService.resetForTests();
    });

    afterEach(async () => {
      restoreForcedFlagFixtures();
      restoreManagedFlagEnv(originalEnv);
      FeatureFlagService.resetForTests();

      if (!testServer) {
        return;
      }

      await testServer.cleanup();
    });

    afterAll(async () => {
      if (!testServer) {
        return;
      }

      await testServer.shutdown();
    });

    register(context);
  });
};

export const registerRoundStateListeners = (
  clients: Array<{ onMessage: (type: string, handler: (_message: unknown) => void) => void }>,
): void => {
  for (const client of clients) {
    client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (_message: unknown) => {});
  }
};

type PrepCommandTestClient = {
  send: (type: string, message?: unknown) => void;
  waitForMessage: (type: string, rejectTimeout?: number) => Promise<unknown>;
};

export const sendPrepCommandAndWaitForResult = async (
  client: PrepCommandTestClient,
  cmdSeq: number,
  payload: Record<string, unknown> = {},
): Promise<{ accepted: boolean; code?: string }> => {
  const resultPromise = client.waitForMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT);
  client.send(CLIENT_MESSAGE_TYPES.PREP_COMMAND, { cmdSeq, ...payload });
  return (await resultPromise) as { accepted: boolean; code?: string };
};

export const connectBossRoleSelectionRoom = async (
  testServer: ColyseusTestServer,
  roomOptions?: Record<string, unknown>,
  forcedFlags: Partial<FeatureFlags> = {},
): Promise<{
  serverRoom: GameRoom;
  clients: Array<{
    sessionId: string;
    send: (type: string, message?: unknown) => void;
    waitForMessage: (type: string) => Promise<unknown>;
    onMessage: (type: string, handler: (_message: unknown) => void) => void;
    connection: { close: (code?: number, reason?: string) => void };
    reconnectionToken: string;
  }>;
}> => {
  const serverRoom = await createRoomWithForcedFlags(
    testServer,
    {
      enableBossExclusiveShop: true,
      enableHeroSystem: true,
      ...forcedFlags,
    },
    roomOptions,
  );
  const clients = await Promise.all([
    testServer.connectTo(serverRoom),
    testServer.connectTo(serverRoom),
    testServer.connectTo(serverRoom),
    testServer.connectTo(serverRoom),
  ]);

  registerRoundStateListeners(clients);

  return {
    serverRoom,
    clients,
  };
};

export const moveBossRoleSelectionToSelectionStage = async (
  serverRoom: GameRoom,
  clients: Array<{ sessionId: string; send: (type: string, message?: unknown) => void }>,
  bossClientIndex = 1,
): Promise<void> => {
  const bossClient = clients[bossClientIndex];
  if (!bossClient) {
    throw new Error("Expected boss client");
  }

  bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });
  await waitForCondition(
    () => serverRoom.state.players.get(bossClient.sessionId)?.wantsBoss === true,
    1_000,
  );

  for (const client of clients) {
    client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
  }

  await waitForCondition(() => serverRoom.state.lobbyStage === "selection", 1_000);
};

export const resolveBossRoleSelectionToPrep = async (
  serverRoom: GameRoom,
  clients: Array<{
    sessionId: string;
    send: (type: string, message?: unknown) => void;
    waitForMessage: (type: string) => Promise<unknown>;
  }>,
  timeoutMs = 1_000,
): Promise<void> => {
  const bossClient = clients[1];
  const raidClientA = clients[0];
  const raidClientB = clients[2];
  const raidClientC = clients[3];

  if (!bossClient || !raidClientA || !raidClientB || !raidClientC) {
    throw new Error("Expected four clients for boss role selection");
  }

  await moveBossRoleSelectionToSelectionStage(serverRoom, clients);

  raidClientA.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
  raidClientB.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "marisa" });
  raidClientC.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "okina" });
  bossClient.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });

  await waitForCondition(() => serverRoom.state.phase === "Prep", timeoutMs);
};

type AutoFillHelperPlayer = NonNullable<
  Parameters<typeof buildAutoFillHelperActions>[0]["player"]
>;
type AutoFillHelperState = NonNullable<
  Parameters<typeof buildAutoFillHelperActions>[0]["state"]
> & {
  playerPhase?: string | null;
  players?:
    | { get: (key: string) => AutoFillHelperPlayer | null | undefined }
    | Record<string, AutoFillHelperPlayer>
    | null;
};

const mapGetStatePlayer = (
  mapLike: AutoFillHelperState["players"],
  key: string,
): AutoFillHelperPlayer | null => {
  if (!mapLike) {
    return null;
  }

  if ("get" in mapLike && typeof mapLike.get === "function") {
    return mapLike.get(key) ?? null;
  }

  return (mapLike as Record<string, AutoFillHelperPlayer>)[key] ?? null;
};

const buildHelperCorrelationId = (helperIndex: number, cmdSeq: number): string => {
  const nowMs = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `corr_helper_${helperIndex}_${cmdSeq}_${nowMs}_${suffix}`;
};

const toUnknownArray = (value: unknown): unknown[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object" && Symbol.iterator in value) {
    return Array.from(value as Iterable<unknown>);
  }

  return [];
};

const mapOfferUnitTypes = (offers: unknown): unknown[] =>
  toUnknownArray(offers).map((offer) => {
    if (offer && typeof offer === "object" && "unitType" in offer) {
      return (offer as { unitType?: unknown }).unitType ?? offer;
    }

    return offer;
  });

const parseHelperBoardCell = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const [rawCell] = value.split(":");
    const parsedCell = Number(rawCell);
    return Number.isInteger(parsedCell) ? parsedCell : null;
  }

  if (value && typeof value === "object" && "cell" in value) {
    const cell = (value as { cell?: unknown }).cell;
    return typeof cell === "number" && Number.isInteger(cell) ? cell : null;
  }

  return null;
};

const cloneAutoFillHelperPlayer = (player: AutoFillHelperPlayer | null): AutoFillHelperPlayer | null => {
  if (!player) {
    return null;
  }

  return {
    ...player,
    benchUnits: Array.from(player.benchUnits ?? []),
    benchUnitIds: Array.from(player.benchUnitIds ?? []),
    boardUnits: Array.from(player.boardUnits ?? []),
    boardSubUnits: Array.from((player as { boardSubUnits?: unknown[] } | null)?.boardSubUnits ?? []),
    shopOffers: Array.from(player.shopOffers ?? []),
    bossShopOffers: Array.from(player.bossShopOffers ?? []),
  };
};

const buildOptimisticBoardPlacement = (cell: number, unitType: unknown, unitId: unknown) => ({
  cell,
  unitType: typeof unitType === "string" && unitType.length > 0 ? unitType : "vanguard",
  ...(typeof unitId === "string" && unitId.length > 0 ? { unitId } : {}),
});

const applyOptimisticPrepCommandToPlayer = (
  player: AutoFillHelperPlayer | null,
  payload: Record<string, unknown>,
  cmdSeq: number,
): AutoFillHelperPlayer | null => {
  const nextPlayer = cloneAutoFillHelperPlayer(player);
  if (!nextPlayer) {
    return null;
  }

  nextPlayer.lastCmdSeq = cmdSeq;

  if (typeof payload.shopBuySlotIndex === "number") {
    const shopOffers = toUnknownArray(nextPlayer.shopOffers) as Array<{ unitType?: unknown; unitId?: unknown; cost?: unknown }>;
    const offer = shopOffers[payload.shopBuySlotIndex] as
      | { unitType?: unknown; unitId?: unknown; cost?: unknown }
      | undefined;
    if (offer) {
      shopOffers.splice(payload.shopBuySlotIndex, 1);
      nextPlayer.shopOffers = shopOffers;
      const benchUnits = toUnknownArray(nextPlayer.benchUnits) as string[];
      benchUnits.push(
        typeof offer.unitType === "string" && offer.unitType.length > 0 ? offer.unitType : "vanguard",
      );
      nextPlayer.benchUnits = benchUnits;
      nextPlayer.benchUnitIds = [...(nextPlayer.benchUnitIds ?? []), typeof offer.unitId === "string" ? offer.unitId : ""];
      if (typeof offer.cost === "number" && Number.isFinite(offer.cost) && typeof nextPlayer.gold === "number") {
        nextPlayer.gold = Math.max(0, nextPlayer.gold - offer.cost);
      }
    }
    return nextPlayer;
  }

  if (typeof payload.bossShopBuySlotIndex === "number") {
    const bossShopOffers = toUnknownArray(nextPlayer.bossShopOffers) as Array<{ unitType?: unknown; unitId?: unknown; cost?: unknown }>;
    const offer = bossShopOffers[payload.bossShopBuySlotIndex] as
      | { unitType?: unknown; unitId?: unknown; cost?: unknown }
      | undefined;
    if (offer) {
      bossShopOffers.splice(payload.bossShopBuySlotIndex, 1);
      nextPlayer.bossShopOffers = bossShopOffers;
      const benchUnits = toUnknownArray(nextPlayer.benchUnits) as string[];
      benchUnits.push(
        typeof offer.unitType === "string" && offer.unitType.length > 0 ? offer.unitType : "vanguard",
      );
      nextPlayer.benchUnits = benchUnits;
      nextPlayer.benchUnitIds = [...(nextPlayer.benchUnitIds ?? []), typeof offer.unitId === "string" ? offer.unitId : ""];
      if (typeof offer.cost === "number" && Number.isFinite(offer.cost) && typeof nextPlayer.gold === "number") {
        nextPlayer.gold = Math.max(0, nextPlayer.gold - offer.cost);
      }
    }
    return nextPlayer;
  }

  const benchToBoardCell = payload.benchToBoardCell as
    | { benchIndex?: number; cell?: number; slot?: "main" | "sub" }
    | undefined;
  if (!benchToBoardCell || !Number.isInteger(benchToBoardCell.benchIndex) || !Number.isInteger(benchToBoardCell.cell)) {
    return nextPlayer;
  }

  const benchIndex = Number(benchToBoardCell.benchIndex);
  const targetCell = Number(benchToBoardCell.cell);
  const benchUnits = toUnknownArray(nextPlayer.benchUnits) as string[];
  if (benchIndex < 0 || benchIndex >= benchUnits.length) {
    return nextPlayer;
  }

  const [benchUnitType] = benchUnits.splice(benchIndex, 1);
  nextPlayer.benchUnits = benchUnits;
  const benchUnitIds = Array.from(nextPlayer.benchUnitIds ?? []);
  const [benchUnitId] = benchUnitIds.splice(benchIndex, 1);
  nextPlayer.benchUnitIds = benchUnitIds;

  if (benchToBoardCell.slot === "sub") {
    const nextBoardUnits = Array.from(nextPlayer.boardUnits ?? []);
    const hostIndex = nextBoardUnits.findIndex((placement) => parseHelperBoardCell(placement) === targetCell);
    if (hostIndex >= 0) {
      const hostPlacement = nextBoardUnits[hostIndex];
      if (typeof hostPlacement === "string") {
        if (!hostPlacement.endsWith(":sub")) {
          nextBoardUnits[hostIndex] = `${hostPlacement}:sub`;
        }
      } else if (hostPlacement && typeof hostPlacement === "object") {
        nextBoardUnits[hostIndex] = {
          ...hostPlacement,
          subUnit: buildOptimisticBoardPlacement(-1, benchUnitType, benchUnitId),
        };
      }

      nextPlayer.boardUnits = nextBoardUnits;
      const nextToken = `${targetCell}:${typeof benchUnitId === "string" && benchUnitId.length > 0 ? benchUnitId : benchUnitType}`;
      nextPlayer.boardSubUnits = [
        ...Array.from((nextPlayer as { boardSubUnits?: string[] }).boardSubUnits ?? []).filter(
          (token) => !token.startsWith(`${targetCell}:`),
        ),
        nextToken,
      ];
    }

    return nextPlayer;
  }

  nextPlayer.boardUnits = [
    ...Array.from(nextPlayer.boardUnits ?? []),
    buildOptimisticBoardPlacement(targetCell, benchUnitType, benchUnitId),
  ];

  return nextPlayer;
};

export const attachAutoFillHelperAutomationForTest = (
  helperRoom: {
    sessionId: string;
    state?: unknown;
    send: (type: string, message?: unknown) => void;
    onStateChange: (handler: (state: unknown) => void) => void;
    onMessage: (type: string, handler: (_message: unknown) => void) => void;
  },
  helperIndex: number,
  options: {
    strategy?: "upgrade" | "highCost";
  } = {},
): {
  getResults: () => unknown[];
} => {
  let helperCmdSeq = 1;
  let lastAutomationStateKey = "";
  let optimisticHelperPlayer: AutoFillHelperPlayer | null = null;
  let pendingPrepCommand: { cmdSeq: number; payload: Record<string, unknown> } | null = null;
  const results: unknown[] = [];

  const buildAutomationStateKey = (
    state: AutoFillHelperState | null,
    helperPlayer: AutoFillHelperPlayer | null,
  ) => {
    const helperGold = typeof helperPlayer?.gold === "number" ? helperPlayer.gold : null;

    return JSON.stringify({
      bossOffers: mapOfferUnitTypes(helperPlayer?.bossShopOffers),
      boardUnits: Array.from(helperPlayer?.boardUnits ?? []),
      benchUnits: Array.from(helperPlayer?.benchUnits ?? []),
      boardSubUnits: Array.from((helperPlayer as { boardSubUnits?: unknown[] } | null)?.boardSubUnits ?? []),
      featureFlagsEnableTouhouRoster: state?.featureFlagsEnableTouhouRoster === true,
      gold: Number.isFinite(helperGold) ? helperGold : null,
      lastCmdSeq: helperPlayer?.lastCmdSeq ?? null,
      lobbyStage: typeof state?.lobbyStage === "string" ? state.lobbyStage : "",
      phase: typeof state?.phase === "string" ? state.phase : "",
      playerPhase: resolveAutoFillHelperPlayerPhase(state),
      playerPhaseDeadlineAtMs:
        typeof state?.playerPhaseDeadlineAtMs === "number" ? state.playerPhaseDeadlineAtMs : null,
      ready: helperPlayer?.ready === true,
      role: helperPlayer?.role ?? "",
      selectedBossId: helperPlayer?.selectedBossId ?? null,
      selectedHeroId: helperPlayer?.selectedHeroId ?? null,
      shopOffers: mapOfferUnitTypes(helperPlayer?.shopOffers),
    });
  };

  const applyAutomation = (state: unknown) => {
    const helperState = state as AutoFillHelperState | null;
    const syncedHelperPlayer = mapGetStatePlayer(helperState?.players, helperRoom.sessionId);
    if (
      optimisticHelperPlayer
      && typeof syncedHelperPlayer?.lastCmdSeq === "number"
      && typeof optimisticHelperPlayer.lastCmdSeq === "number"
      && syncedHelperPlayer.lastCmdSeq >= optimisticHelperPlayer.lastCmdSeq
    ) {
      optimisticHelperPlayer = null;
    }
    const helperPlayer = optimisticHelperPlayer ?? syncedHelperPlayer;
    const automationStateKey = buildAutomationStateKey(helperState, helperPlayer);

    if (automationStateKey === lastAutomationStateKey) {
      return;
    }

    lastAutomationStateKey = automationStateKey;
    const helperLastCmdSeq = typeof helperPlayer?.lastCmdSeq === "number"
      ? helperPlayer.lastCmdSeq
      : null;
    if (typeof helperLastCmdSeq === "number" && Number.isInteger(helperLastCmdSeq) && helperLastCmdSeq >= helperCmdSeq) {
      helperCmdSeq = helperLastCmdSeq + 1;
    }

    const actions = buildAutoFillHelperActions({
      helperIndex,
      player: helperPlayer,
      sessionId: helperRoom.sessionId,
      state: helperState,
      ...(options.strategy ? { strategy: options.strategy } : {}),
    });

    const [nextAction] = actions;
    if (!nextAction) {
      return;
    }

    if (nextAction.type === CLIENT_MESSAGE_TYPES.PREP_COMMAND) {
      if (pendingPrepCommand) {
        return;
      }
      const cmdSeq = helperCmdSeq;
      pendingPrepCommand = {
        cmdSeq,
        payload: nextAction.payload as Record<string, unknown>,
      };
      helperRoom.send(nextAction.type, {
        cmdSeq,
        correlationId: buildHelperCorrelationId(helperIndex, cmdSeq),
        ...nextAction.payload,
      });
      helperCmdSeq += 1;
      return;
    }

    helperRoom.send(nextAction.type, nextAction.payload);
  };

  const reapplyAutomationSoon = (remainingRetries = HELPER_AUTOMATION_RETRY_ATTEMPTS) => {
    setTimeout(() => {
      if (helperRoom.state) {
        applyAutomation(helperRoom.state);
      }

      if (remainingRetries > 1) {
        reapplyAutomationSoon(remainingRetries - 1);
      }
    }, HELPER_AUTOMATION_RETRY_DELAY_MS);
  };

  const scheduleImmediateAutomationReapply = () => {
    setTimeout(() => {
      if (helperRoom.state) {
        applyAutomation(helperRoom.state);
      }
    }, 0);
  };

  helperRoom.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
  helperRoom.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (message) => {
    results.push(message);
    const commandResult = message as { accepted?: boolean } | null;
    if (commandResult?.accepted === true && pendingPrepCommand) {
      const basePlayer = optimisticHelperPlayer
        ?? (helperRoom.state
          ? mapGetStatePlayer((helperRoom.state as AutoFillHelperState)?.players, helperRoom.sessionId)
          : null);
      optimisticHelperPlayer = applyOptimisticPrepCommandToPlayer(
        basePlayer,
        pendingPrepCommand.payload,
        pendingPrepCommand.cmdSeq,
      );
    } else if (commandResult?.accepted === false) {
      optimisticHelperPlayer = null;
    }
    pendingPrepCommand = null;
    scheduleImmediateAutomationReapply();
    reapplyAutomationSoon();
  });
  helperRoom.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});
  helperRoom.onMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, () => {});

  helperRoom.onStateChange((state) => {
    applyAutomation(state);
  });

  if (helperRoom.state) {
    applyAutomation(helperRoom.state);
  }

  return {
    getResults: () => [...results],
  };
};

export class FakeRoot {
  private readonly elements = new Map<string, { textContent: string | null }>();

  public setElement(
    selector: string,
    initialText: string | null = null,
  ): { textContent: string | null } {
    const element = { textContent: initialText };
    this.elements.set(selector, element);
    return element;
  }

  public querySelector(selector: string): unknown {
    return this.elements.get(selector) ?? null;
  }
}
