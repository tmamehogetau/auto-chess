import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const playerAppScriptPath = resolve(process.cwd(), "src/client/player-app.js");

describe("player-app script contract", () => {
  test("shared room session helper を使い operator-only logic を持ち込まない", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes('from "./game-room-session.js"')).toBe(true);
    expect(source.includes('from "./player-surface-renderers.js"')).toBe(true);
    expect(source.includes('from "./shared-board-client.js"')).toBe(true);
    expect(source.includes("createGameRoomSession(")).toBe(true);
    expect(source.includes("renderPlayerLobbySummary(")).toBe(true);
    expect(source.includes("renderPlayerLobbyPreferenceSummary(")).toBe(true);
    expect(source.includes("renderPlayerSelectionSummary(")).toBe(true);
    expect(source.includes("renderPlayerPrepSummary(")).toBe(true);
    expect(source.includes("renderPlayerResultSummary(")).toBe(true);
    expect(source.includes("initSharedBoardClient(")).toBe(true);
    expect(source.includes("connectSharedBoard(")).toBe(true);
    expect(source.includes("setSharedBoardGamePlayerId(")).toBe(true);
    expect(source.includes("handleSharedCellClick(")).toBe(true);
    expect(source.includes("SERVER_MESSAGE_TYPES.ROUND_STATE")).toBe(true);
    expect(source.includes("connectButton?.addEventListener(\"click\"")).toBe(true);
    expect(source.includes("readyButton?.addEventListener(\"click\"")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.READY")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.BOSS_SELECT")).toBe(true);
    expect(source.includes('"HERO_SELECT"')).toBe(true);
    expect(source.includes("gameRoomSession.connect()")).toBe(true);
    expect(source.includes("gameRoomSession.send(CLIENT_MESSAGE_TYPES.READY")).toBe(true);
    expect(source.includes("gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE")).toBe(true);
    expect(source.includes("gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT")).toBe(true);
    expect(source.includes('gameRoomSession.send("HERO_SELECT"')).toBe(true);
    expect(source.includes("function sharedBoardIndexToCombatCell(")).toBe(true);
    expect(source.includes("handlePlayerShopBuy(")).toBe(true);
    expect(source.includes("handlePlayerBenchSelect(")).toBe(true);
    expect(source.includes("handlePlayerSharedCellClick(")).toBe(true);
    expect(source.includes("shopBuySlotIndex")).toBe(true);
    expect(source.includes("benchToBoardCell")).toBe(true);
    expect(source.includes("startMonitorPolling")).toBe(false);
    expect(source.includes("connectAutoFillRooms")).toBe(false);
    expect(source.includes("requestAdminMonitorSnapshot")).toBe(false);
  });

  test("player session uses browser-resolvable Colyseus SDK loading", () => {
    const source = readFileSync(resolve(process.cwd(), "src/client/game-room-session.js"), "utf-8");

    expect(source.includes('const DEFAULT_SDK_URL = "https://esm.sh/@colyseus/sdk@0.17.34"')).toBe(true);
    expect(source.includes("() => import(DEFAULT_SDK_URL)")).toBe(true);
    expect(source.includes('import("@colyseus/sdk")')).toBe(false);
    expect(source.includes("getClient: () => client")).toBe(true);
  });

  test("phase view resolution helper を持つ", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("function resolvePlayerPhaseView(")).toBe(true);
    expect(source.includes('lobbyStage === "preference"')).toBe(true);
    expect(source.includes('lobbyStage === "selection"')).toBe(true);
    expect(source.includes('phase === "Prep"')).toBe(true);
    expect(source.includes('phase === "Battle"')).toBe(true);
    expect(source.includes('phase === "Settle"')).toBe(true);
  });

  test("connect failure は tester が再試行できる文面へ戻す", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("async function connectPlayerSession()")).toBe(true);
    expect(source.includes("try {")).toBe(true);
    expect(source.includes("catch")).toBe(true);
    expect(source.includes("接続できませんでした。進行役に声をかけてください。")).toBe(true);
  });
});
