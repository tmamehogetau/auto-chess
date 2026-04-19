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
    expect(source.includes("setSharedBoardRoomId(")).toBe(true);
    expect(source.includes("setSharedBoardGamePlayerId(")).toBe(true);
    expect(source.includes("handleSharedCellClick(")).toBe(true);
    expect(source.includes("SERVER_MESSAGE_TYPES.ROUND_STATE")).toBe(true);
    expect(source.includes("data-player-room-code-input")).toBe(true);
    expect(source.includes("roomCodeInput")).toBe(true);
    expect(source.includes("data-player-lobby-ready-copy")).toBe(true);
    expect(source.includes("data-player-lobby-ready-button")).toBe(true);
    expect(source.includes("data-player-hud-round-phase")).toBe(true);
    expect(source.includes("data-player-hud-timer")).toBe(true);
    expect(source.includes("data-player-hud-spell")).toBe(true);
    expect(source.includes("data-player-hud-flow")).toBe(true);
    expect(source.includes("data-player-phase-notes-copy")).toBe(true);
    expect(source.includes("connectButton?.addEventListener(\"click\"")).toBe(true);
    expect(source.includes("readyButtons.forEach((button) => {")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.READY")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.BOSS_SELECT")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.HERO_SELECT")).toBe(true);
    expect(source.includes("gameRoomSession.connect({ roomId")).toBe(true);
    expect(source.includes("gameRoomSession.send(CLIENT_MESSAGE_TYPES.READY")).toBe(true);
    expect(source.includes("gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE")).toBe(true);
    expect(source.includes("gameRoomSession.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT")).toBe(true);
    expect(source.includes("gameRoomSession.send(CLIENT_MESSAGE_TYPES.HERO_SELECT")).toBe(true);
    expect(source.includes("function sharedBoardIndexToCombatCell(")).toBe(false);
    expect(source.includes("handlePlayerShopBuy(")).toBe(true);
    expect(source.includes("handlePlayerBenchSelect(")).toBe(true);
    expect(source.includes("handlePlayerBenchSell(")).toBe(true);
    expect(source.includes("handlePlayerBoardSell(")).toBe(true);
    expect(source.includes("handlePlayerBoardReturn(")).toBe(true);
    expect(source.includes("handlePlayerSharedCellClick(")).toBe(true);
    expect(source.includes("handlePlayerSharedSubSlotClick(")).toBe(true);
    expect(source.includes("handlePlayerBossShopBuy(")).toBe(true);
    expect(source.includes("handlePlayerShopRefresh(")).toBe(true);
    expect(source.includes("handlePlayerBuyXp(")).toBe(true);
    expect(source.includes("shopBuySlotIndex")).toBe(true);
    expect(source.includes("bossShopBuySlotIndex")).toBe(true);
    expect(source.includes("shopRefreshCount")).toBe(true);
    expect(source.includes("specialUnitUpgradeCount")).toBe(true);
    expect(source.includes("benchToBoardCell")).toBe(true);
    expect(source.includes('slot: "sub"')).toBe(true);
    expect(source.includes("boardToBenchCell")).toBe(true);
    expect(source.includes("benchSellIndex")).toBe(true);
    expect(source.includes("boardSellIndex")).toBe(true);
    expect(source.includes("cell: cellIndex,")).toBe(true);
    expect(source.includes("boardToBenchCell: { cell: cellIndex },")).toBe(true);
    expect(source.includes("boardSellIndex: cellIndex,")).toBe(true);
    expect(source.includes("startMonitorPolling")).toBe(false);
    expect(source.includes("connectAutoFillRooms")).toBe(false);
    expect(source.includes("requestAdminMonitorSnapshot")).toBe(false);
  });

  test("player session uses browser-resolvable Colyseus SDK loading", () => {
    const source = readFileSync(resolve(process.cwd(), "src/client/game-room-session.js"), "utf-8");

    expect(source).toMatch(/const DEFAULT_SDK_URL = "https:\/\/esm\.sh\/@colyseus\/sdk@[\d.]+"/);
    expect(source.includes("() => import(DEFAULT_SDK_URL)")).toBe(true);
    expect(source.includes('import("@colyseus/sdk")')).toBe(false);
    expect(source.includes("getClient: () => client")).toBe(true);
  });

  test("phase view resolution helper を持つ", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("function resolvePlayerPhaseView(")).toBe(true);
    expect(source.includes("canUseReadyAction(")).toBe(true);
    expect(source.includes("function syncPlayerBattleStartSweep(")).toBe(true);
    expect(source.includes("function triggerPlayerBattleStartSweep(")).toBe(true);
    expect(source.includes("function clearPlayerBattleStartSweep(")).toBe(true);
    expect(source.includes("function resolveRequestedRoomCode(")).toBe(true);
    expect(source.includes("function resolveSharedBoardRoomId(")).toBe(true);
    expect(source.includes("function updatePhaseNotes(")).toBe(true);
    expect(source.includes("function renderTopHud(")).toBe(true);
    expect(source.includes('const prepPhaseElement = phaseSections.get("prep");')).toBe(true);
    expect(source.includes('phaseSections.get("result")')).toBe(false);
    expect(source.includes('lobbyStage === "preference"')).toBe(true);
    expect(source.includes('lobbyStage === "selection"')).toBe(true);
    expect(source.includes('phase === "Prep"')).toBe(true);
    expect(source.includes('phase === "Battle"')).toBe(true);
    expect(source.includes('phase === "Settle"')).toBe(true);
    expect(source.includes('phase === "Elimination"')).toBe(true);
    expect(source.includes('data-player-battle-start-banner')).toBe(true);
    expect(source.includes("setInterval(")).toBe(true);
    expect(source.includes("function updateReadyCopy(")).toBe(true);
    expect(source.includes("const previousPlayerFacingPhase = latestPlayerFacingPhase;")).toBe(true);
    expect(source.includes("showPlayerPhase(resolvePlayerPhaseView(latestState));")).toBe(true);
  });

  test("page unload 時に deadline refresh と battle sweep を掃除する", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes('window.addEventListener("beforeunload", () => {')).toBe(true);
    expect(source.includes("stopDeadlineRefreshLoop();")).toBe(true);
    expect(source.includes("clearPlayerBattleStartSweep();")).toBe(true);
  });

  test("connect failure は tester が再試行できる文面へ戻す", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("async function connectPlayerSession()")).toBe(true);
    expect(source.includes("try {")).toBe(true);
    expect(source.includes("catch")).toBe(true);
    expect(source.includes("接続できませんでした。進行役に声をかけてください。")).toBe(true);
  });

  test("prep commands use incrementing cmdSeq instead of Date.now()", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("let cmdSeqCounter = 0;")).toBe(true);
    expect(source.includes("function nextCmdSeq()")).toBe(true);
    expect(source.includes("cmdSeq: nextCmdSeq()")).toBe(true);
    expect(source.includes("cmdSeq: Date.now()")).toBe(false);
  });

  test("player app captures non-sub-slot shared-board clicks before cell handlers stop propagation", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("if (!isSubSlotTarget) {")).toBe(true);
    expect(source.includes("event.stopPropagation();")).toBe(true);
    expect(source.includes("event.preventDefault();")).toBe(true);
    expect(source.includes("}, true);")).toBe(true);
  });

  test("bench deploy capture lets sub-slot clicks reach the dedicated sub handler", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes('const isSubSlotTarget = target.closest("[data-shared-board-sub-slot]");')).toBe(true);
    expect(source.includes("if (!isSubSlotTarget) {")).toBe(true);
  });

  test("empty bench click returns the selected board unit instead of stealing bench selection", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("const selectedBoardCell = resolveSelectedSharedBoardCell();")).toBe(true);
    expect(source.includes("const clickedBenchUnit = latestPlayer?.benchUnits?.[index] ?? null;")).toBe(true);
    expect(source.includes("selectedBoardCell")).toBe(true);
    expect(source.includes("!clickedBenchUnit")).toBe(true);
    expect(source.includes("boardToBenchCell: { cell: selectedBoardCell.cellIndex },")).toBe(true);
  });

  test("occupied bench click swaps with the selected board unit instead of keeping both selected", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("selectedBoardCell")).toBe(true);
    expect(source.includes("&& clickedBenchUnit")).toBe(true);
    expect(source.includes("benchToBoardCell: {")).toBe(true);
    expect(source.includes("benchIndex: index,")).toBe(true);
    expect(source.includes("cell: selectedBoardCell.cellIndex,")).toBe(true);
  });

  test("player app routes selected sub-unit interactions through dedicated prep commands", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("getSelectedSharedSubUnitCellIndex")).toBe(true);
    expect(source.includes("setSelectedSharedSubUnitCellIndex")).toBe(true);
    expect(source.includes("refreshSharedBoardRender")).toBe(true);
    expect(source.includes("selectSharedUnitById")).toBe(false);
    expect(source.includes("function resolveSelectedSharedSubUnitToken()")).toBe(true);
    expect(source.includes("function isHeroAttachedSubUnitToken(")).toBe(true);
    expect(source.includes("subUnitToBenchCell")).toBe(true);
    expect(source.includes("subUnitMove")).toBe(true);
    expect(source.includes("subUnitSwapBench")).toBe(true);
    expect(source.includes('slot: "main"')).toBe(true);
    expect(source.includes('slot: "sub"')).toBe(true);
    expect(source.includes("const liveToken = resolvePlayerSubUnitTokenForCell(selectedCellIndex);")).toBe(true);
  });

  test("player app routes Okina sub-slot clicks through a dedicated hero prep command", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("&& (latestPlayer?.selectedHeroId ?? \"\") === \"okina\"")).toBe(true);
    expect(source.includes("heroPlacementCell: cellIndex")).toBe(true);
  });

  test("player app validates shared-board cell indexes before move and hero placement prep commands", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("if (!Number.isInteger(cellIndex) || cellIndex < 0) {")).toBe(true);
    expect(source.includes("const selectedSubUnitCellIndex = getSelectedSharedSubUnitCellIndex();")).toBe(true);
  });

  test("player app can move a selected normal board unit into another host sub slot", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("boardUnitMove")).toBe(true);
    expect(source.includes("fromCell: selectedBoardCell.cellIndex,")).toBe(true);
    expect(source.includes("toCell: cellIndex,")).toBe(true);
    expect(source.includes('slot: "sub",')).toBe(true);
  });

  test("player app wires room code and dedicated shared-board room binding", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes("data-player-room-code-input")).toBe(true);
    expect(source.includes('let latestSharedBoardRoomId = "";')).toBe(true);
    expect(source.includes("function rememberSharedBoardRoomId(")).toBe(true);
    expect(source.includes("gameRoomSession.connect({ roomId: requestedRoomCode })")).toBe(true);
    expect(source.includes('mode: "createPaired"')).toBe(false);
    expect(source.includes('sharedBoardRoomName: "shared_board"')).toBe(false);
    expect(source.includes('const requestedSetId = getSearchParam("setId") ?? undefined;')).toBe(false);
    expect(source.includes("setId: requestedSetId,")).toBe(false);
    expect(source.includes("latestRoundState = message;")).toBe(true);
    expect(source.includes("message?.sharedBoardRoomId")).toBe(true);
    expect(source.includes("state?.sharedBoardRoomId")).toBe(true);
    expect(source.includes("const pairedSharedBoardRoom = gameRoomSession.takeCreatedSharedBoardRoom();")).toBe(false);
    expect(source.includes("pairedSharedBoardRoom?.roomId")).toBe(false);
    expect(source.includes("existingRoom: pairedSharedBoardRoom,")).toBe(false);
    expect(source.includes("latestPlayer = null;")).toBe(true);
    expect(source.includes("latestState = null;")).toBe(true);
  });

  test("player app requires a room code before join or autoconnect", () => {
    const source = readFileSync(playerAppScriptPath, "utf-8");

    expect(source.includes('if (getSearchParam("autoconnect") === "1" && resolveRequestedRoomCode().length > 0)')).toBe(true);
    expect(source.includes("roomCodeRequired")).toBe(true);
    expect(source.includes("ルームコードを入力してから Join してください。")).toBe(true);
    expect(source.includes('resolveRequestedRoomCode() || "pending"')).toBe(true);
  });
});
