import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const manualCheckScriptPath = resolve(process.cwd(), "src/client/manual-check.js");

describe("manual-check script contract", () => {
  test("module script として構文エラーなく解釈できる", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");
    const tempDir = mkdtempSync(join(tmpdir(), "manual-check-parse-"));
    const tempFilePath = join(tempDir, "manual-check.mjs");

    writeFileSync(tempFilePath, source, "utf-8");

    try {
      expect(() => {
        execFileSync(process.execPath, ["--check", tempFilePath], {
          stdio: "pipe",
        });
      }).not.toThrow();
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("raid presentation uses MapSchema-safe player iteration and raid-only final judgment gating", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("mapEntries(state?.players).map(([, player]) => player)")).toBe(true);
    expect(source.includes("buildFinalJudgmentCopy({")).toBe(true);
    expect(source.includes("raidPlayerIds: state?.raidPlayerIds")).toBe(true);
  });

  test("entry flow guidance と command result copy を player-facing helper で扱う", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("buildEntryFlowStatus({")).toBe(true);
    expect(source.includes("buildLobbyRoleCopy({")).toBe(true);
    expect(source.includes("updateEntryFlowStatus(")).toBe(true);
    expect(source.includes("buildCommandResultCopy({ accepted: false, code: result.code, hint })")).toBe(true);
  });

  test("room create / join 用に room code と shared board pairing を扱う", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("data-room-code-input")).toBe(true);
    expect(source.includes("data-room-code-output")).toBe(true);
    expect(source.includes("client.create(\"shared_board\"")).toBe(true);
    expect(source.includes("sharedBoardRoomId: sharedBoardSeedRoom.roomId")).toBe(true);
    expect(source.includes("spectator: true")).toBe(true);
    expect(source.includes("client.joinById(roomCode")).toBe(true);
    expect(source.includes("setSharedBoardRoomId(")).toBe(true);
  });

  test("spectator host keeps Ready disabled after syncButtonAvailability reruns", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("const isSpectator = player?.isSpectator === true;")).toBe(true);
    expect(source.includes("readyBtn.disabled = connecting || !connected || isSpectator;")).toBe(true);
    expect(source.includes("currentGameState?.players?.get?.(sessionId)")).toBe(true);
    expect(source.includes("latestState?.players")).toBe(false);
  });

  test("boss role selection uses explicit preference and selection actions", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE")).toBe(true);
    expect(source.includes("CLIENT_MESSAGE_TYPES.BOSS_SELECT")).toBe(true);
    expect(source.includes("state.bossPlayerId === sessionId")).toBe(true);
    expect(source.includes("showBossSelection()")).toBe(true);
    expect(source.includes("hideHeroSelection()")).toBe(true);
  });

  test("portrait resolver drives processed front portraits for boss selection", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes('from "./portrait-resolver.js"')).toBe(true);
    expect(source.includes("portraitKey: \"remilia\"")).toBe(true);
    expect(source.includes("bossSelectionPortrait.src = resolveFrontPortraitUrl(")).toBe(true);
    expect(source.includes('portraitSrc: "/pics/Remilia.png"')).toBe(false);
  });

  test("shop cards use portrait resolver output instead of icon-only rendering", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("resolveShopPortraitUrl(")).toBe(true);
    expect(source.includes('class="shop-portrait"')).toBe(true);
    expect(source.includes('class="shop-card-media"')).toBe(true);
  });

  test("bench presentation uses level badges instead of legacy star badges", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes('class="unit-level-badge')).toBe(true);
    expect(source.includes('class="unit-stars')).toBe(false);
    expect(source.includes("Parse unit type and star level")).toBe(false);
  });

  test("legacy local board presentation helpers are removed from the operator client", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("function updateBoard(boardUnits) {")).toBe(false);
    expect(source.includes("function detectDefeatedUnits(currentUnits) {")).toBe(false);
    expect(source.includes("function animateUnitDeath(cellElement, unitId) {")).toBe(false);
    expect(source.includes("function createDeathParticles(element) {")).toBe(false);
    expect(source.includes("document.querySelector('.board-section')")).toBe(false);
    expect(source.includes("data-board-cell")).toBe(false);
    expect(source.includes("previousBoardUnits")).toBe(false);
    expect(source.includes("DEFEATED_UNITS")).toBe(false);
  });

  test("bench から shared-board へ配置する click 導線を持つ", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("sharedBoardGrid?.addEventListener(\"click\"")).toBe(true);
    expect(source.includes("handleSharedCellClick(getSharedBoardState(), cellIndex)")).toBe(true);
    expect(source.includes("benchToBoardCell")).toBe(true);
  });

  test("manual-check routes sub-slot clicks through dedicated prep commands including Okina hero placement", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("const isSubSlotTarget = target.closest(\"[data-shared-board-sub-slot]\");")).toBe(true);
    expect(source.includes("handleSharedSubSlotClickForManualCheck(cellIndex);")).toBe(true);
    expect(source.includes("slot: \"sub\",")).toBe(true);
    expect(source.includes("boardUnitMove: {")).toBe(true);
    expect(source.includes("subUnitMove: {")).toBe(true);
    expect(source.includes("heroPlacementCell: cellIndex")).toBe(true);
    expect(source.includes("setSelectedSharedSubUnitCellIndex(cellIndex);")).toBe(true);
  });

  test("bench deploy sends shared-board index directly and rejects non-playable cells", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("function sharedBoardIndexToCombatCell(boardIndex) {")).toBe(false);
    expect(source.includes("const combatCell = sharedBoardIndexToCombatCell(cellIndex);")).toBe(false);
    expect(source.includes("cell: cellIndex,")).toBe(true);
    expect(source.includes("highlighted raid cells")).toBe(true);
    expect(source.includes("center lane")).toBe(false);
    expect(source.includes("playable combat area")).toBe(false);
  });

  test("manual-check sets gamePlayerId on the shared-board client before shared-board connect", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("setSharedBoardGamePlayerId(room.sessionId);")).toBe(true);
    expect(source.includes("await connectSharedBoard(")).toBe(true);
    expect(source.includes("existingRoom: sharedBoardSeedRoom, spectator: true")).toBe(true);
    expect(source.includes(": { spectator: true },")).toBe(true);
    expect(source.indexOf("setSharedBoardGamePlayerId(room.sessionId);"))
      .toBeLessThan(source.indexOf("await connectSharedBoard("));
  });

  test("phase hp と battle result は読み切れる表示時間と待機説明を持つ", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("phaseHpSection.style.display = \"block\"")).toBe(true);
    expect(source.includes("}, 4500);")).toBe(true);
  });

  test("state listeners are registered before auto-fill rooms are connected", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.indexOf("room.onStateChange((state) => {")).toBeGreaterThan(-1);
    expect(source.indexOf("room.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message) => {")).toBeGreaterThan(-1);
    expect(source.indexOf("await connectAutoFillRooms(client, roomName, roomOptions, room.roomId ?? roomCodeValue);")).toBeGreaterThan(-1);
    expect(source.indexOf("room.onStateChange((state) => {"))
      .toBeLessThan(source.indexOf("await connectAutoFillRooms(client, roomName, roomOptions, room.roomId ?? roomCodeValue);"));
    expect(source.indexOf("room.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (message) => {"))
      .toBeLessThan(source.indexOf("await connectAutoFillRooms(client, roomName, roomOptions, room.roomId ?? roomCodeValue);"));
  });

  test("empty lastBattleResult does not produce a Round 0 defeat log", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("const hasBattleResult = Boolean(")).toBe(true);
    expect(source.includes("battleResult?.opponentId")).toBe(true);
    expect(source.includes("lastShownBattleRound !== state.roundIndex")).toBe(true);
    expect(source.includes("const roundNumber = Number(state.roundIndex) + 1;")).toBe(true);
    expect(source.includes("addCombatLogEntry(`--- Round ${roundNumber} ---`, 'info');")).toBe(true);
  });

  test("UI presentation updates do not depend on lastCmdSeq being present", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");
    const normalizedSource = source.replace(/\r\n/g, "\n");
    const nextCmdSeqIndex = normalizedSource.indexOf("nextCmdSeq = player.lastCmdSeq + 1;");
    const raidPresentationIndex = normalizedSource.indexOf("updateRaidBoardPresentation(state);");
    const guardStartIndex = normalizedSource.indexOf("if (typeof player.lastCmdSeq === \"number\") {");

    expect(guardStartIndex).toBeGreaterThan(-1);
    expect(nextCmdSeqIndex).toBeGreaterThan(guardStartIndex);
    expect(raidPresentationIndex).toBeGreaterThan(nextCmdSeqIndex);
    expect(normalizedSource.includes("if (typeof player.lastCmdSeq === \"number\") {\n    nextCmdSeq = player.lastCmdSeq + 1;\n  }\n\n  if (state.phase === \"Waiting\"")).toBe(true);
  });

  test("prep command trace update does not depend on admin-monitor private helpers", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("setMonitorText(monitorTraceValue, correlationId);")).toBe(false);
    expect(source.includes("monitorTraceValue.textContent = correlationId;")).toBe(true);
  });

  test("page exit uses synchronous room cleanup instead of awaiting leave()", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");
    const normalizedSource = source.replace(/\r\n/g, "\n");

    expect(source.includes("window.addEventListener(\"pagehide\", () => {")).toBe(true);
    expect(source.includes("disconnectRoomsForPageExit();")).toBe(true);
    expect(source.includes("void leave();")).toBe(true);
    expect(normalizedSource.includes("window.addEventListener(\"beforeunload\", () => {\n  disconnectRoomsForPageExit();\n});")).toBe(true);
    expect(normalizedSource.includes("window.addEventListener(\"pagehide\", () => {\n  disconnectRoomsForPageExit();\n});")).toBe(true);
  });

  test("page exit cleanup leaves active, shared-board, and autofill rooms immediately", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("function disconnectRoomsForPageExit() {")).toBe(true);
    expect(source.includes("function releaseRoomOnPageExit(room) {")).toBe(true);
    expect(source.includes("stopMonitorPolling();")).toBe(true);
    expect(source.includes("leaveSharedBoardRoom();")).toBe(true);
    expect(source.includes("const leavingRooms = autoFillRooms.splice(0, autoFillRooms.length);")).toBe(true);
    expect(source.includes("void room.leave();")).toBe(true);
    expect(source.includes("releaseRoomOnPageExit(roomToLeave);")).toBe(true);
  });

  test("autofill helpers join first and send ready after the full helper batch is connected", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("const joinedHelperRooms = [];")).toBe(true);
    expect(source.includes("joinedHelperRooms.push(helperRoom);")).toBe(true);
    expect(source.includes("for (const helperRoom of joinedHelperRooms) {")).toBe(true);
    expect(source.includes("helperRoom.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });")).toBe(true);
    expect(source.indexOf("joinedHelperRooms.push(helperRoom);"))
      .toBeLessThan(source.indexOf("for (const helperRoom of joinedHelperRooms) {"));
  });

  test("initializeDefaults keeps autoFillBots from URL params instead of overwriting them with the DOM default", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");
    const normalizedSource = source.replace(/\r\n/g, "\n");
    const initializeDefaultsStart = normalizedSource.indexOf("function initializeDefaults() {");
    const readConfigStart = normalizedSource.indexOf("function readConfig() {");

    expect(initializeDefaultsStart).toBeGreaterThan(-1);
    expect(readConfigStart).toBeGreaterThan(initializeDefaultsStart);

    const initializeDefaultsBlock = normalizedSource.slice(initializeDefaultsStart, readConfigStart);

    expect(initializeDefaultsBlock.includes("autoConfig.autoFillBots = parseAutoFillBots(params.get(\"autoFillBots\"));")).toBe(true);
    expect(initializeDefaultsBlock.includes("const parsedAutoFillBots = parseAutoFillBots(autoFillInput.value);")).toBe(false);
    expect(initializeDefaultsBlock.includes("autoFillInput.value = String(autoConfig.autoFillBots);")).toBe(true);
  });

  test("optimistic reserve buys preserve unitLevel in bench tokens and do not duplicate boardSubUnits keys", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("const buildOptimisticBenchToken = (offer) => {")).toBe(true);
    expect(source.includes("`${offerUnitType}:${offerUnitLevel}`")).toBe(true);
    expect(source.includes("boardSubUnits: Array.from(helperPlayer?.boardSubUnits ?? []),\n    benchUnits: Array.from(helperPlayer?.benchUnits ?? []),\n    boardSubUnits: Array.from(helperPlayer?.boardSubUnits ?? []),")).toBe(false);
  });

  test("autofill helper prep commands carry helper-local cmdSeq and skip duplicate snapshots", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("let helperCmdSeq = 1;")).toBe(true);
    expect(source.includes("let lastAutomationStateKey = \"\";")).toBe(true);
    expect(source.includes("let optimisticHelperPlayer = null;")).toBe(true);
    expect(source.includes("let pendingPrepCommand = null;")).toBe(true);
    expect(source.includes("if (automationStateKey === lastAutomationStateKey) {")).toBe(true);
    expect(source.includes("const [nextAction] = actions;")).toBe(true);
    expect(source.includes("if (nextAction.type === CLIENT_MESSAGE_TYPES.PREP_COMMAND) {")).toBe(true);
    expect(source.includes("if (pendingPrepCommand) {")).toBe(true);
    expect(source.includes("correlationId: createCorrelationId(`helper_${helperIndex}`, cmdSeq),")).toBe(true);
    expect(source.includes("helperCmdSeq += 1;")).toBe(true);
    expect(source.includes("optimisticHelperPlayer = applyOptimisticPrepCommandToPlayer(")).toBe(true);
    expect(source.includes("pendingPrepCommand = {")).toBe(true);
  });

  test("autofill helper rooms register known server messages to avoid Colyseus warning noise", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("helperRoom.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});")).toBe(true);
    expect(source.includes("helperRoom.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (message) => {")).toBe(true);
    expect(source.includes("applyAutomation(helperRoom.state);")).toBe(true);
    expect(source.includes("helperRoom.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, () => {});")).toBe(true);
    expect(source.includes("helperRoom.onMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, () => {});")).toBe(true);
  });

  test("manual-check recognizes shared-board hero and boss ids with colon prefixes", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes('unitId.startsWith("hero:")')).toBe(true);
    expect(source.includes('unitId.startsWith("boss:")')).toBe(true);
    expect(source.includes('unitId.startsWith("hero-")')).toBe(false);
  });

  test("autofill helper automation state key uses resolved playerPhase so deploy retries can re-run after purchase", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("playerPhase: resolveAutoFillHelperPlayerPhase(state),")).toBe(true);
    expect(source.includes("playerPhaseDeadlineAtMs:")).toBe(true);
    expect(source.includes("offer?.unitId ?? null")).toBe(true);
    expect(source.includes("offer?.factionId ?? null")).toBe(true);
    expect(source.includes("offer?.cost ?? null")).toBe(true);
    expect(source.includes("purchased: offer?.purchased === true")).toBe(true);
  });

  test("manual-check tracks the selected shared cell and clears bench selection after sub-slot deploy", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("let selectedSharedBoardCellIndex = null;")).toBe(true);
    expect(source.includes("const selectedCellKey = String(selectedSharedBoardCellIndex);")).toBe(true);
    expect(source.includes("selectedSharedBoardCellIndex = cellIndex;")).toBe(true);
    expect(source.includes("clearSelections();")).toBe(true);
  });

  test("boss shop optimistic purchase keeps offer slots and marks them purchased", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("bossShopOffers[payload.bossShopBuySlotIndex] = {")).toBe(true);
    expect(source.includes("purchased: true,")).toBe(true);
    expect(source.includes("bossShopOffers.splice(payload.bossShopBuySlotIndex, 1);")).toBe(false);
  });

  test("hero-exclusive shop wiring sends dedicated prep command and keeps optimistic slots", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("data-hero-exclusive-shop")).toBe(true);
    expect(source.includes("data-hero-exclusive-shop-slot")).toBe(true);
    expect(source.includes("handleBuyHeroExclusiveUnit(")).toBe(true);
    expect(source.includes("sendPrepCommand({ heroExclusiveShopBuySlotIndex: shopSlot });")).toBe(true);
    expect(source.includes("heroExclusiveShopOffers[payload.heroExclusiveShopBuySlotIndex] = {")).toBe(true);
    expect(source.includes("nextPlayer.heroExclusiveShopOffers = heroExclusiveShopOffers;")).toBe(true);
    expect(source.includes("state.featureFlagsEnableHeroSystem === true")).toBe(true);
    expect(source.includes("currentPlayer?.selectedHeroId")).toBe(false);
  });

  test("presentation audio helper is used for confirm, purchase, battle start, and result cues", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes('from "./ui/audio-cues.js"')).toBe(true);
    expect(source.includes('playUiCue("confirm")')).toBe(true);
    expect(source.includes('playUiCue("purchase")')).toBe(true);
    expect(source.includes('playUiCue("battle-start")')).toBe(true);
    expect(source.includes('playUiCue(isVictory ? "victory" : "defeat")')).toBe(true);
  });

  test("hero selection uses the current hero roster instead of the legacy lineup", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("id: 'okina'")).toBe(true);
    expect(source.includes("id: 'keiki'")).toBe(true);
    expect(source.includes("id: 'jyoon'")).toBe(true);
    expect(source.includes("name: '隠岐奈'")).toBe(true);
    expect(source.includes("name: '袿姫'")).toBe(true);
    expect(source.includes("name: '女苑'")).toBe(true);
    expect(source.includes("id: 'sanae'")).toBe(false);
    expect(source.includes("id: 'youmu'")).toBe(false);
    expect(source.includes("id: 'sakuya'")).toBe(false);
    expect(source.includes('balance: "⚖️"')).toBe(true);
    expect(source.includes('economy: "💰"')).toBe(true);
  });

  test("spell selection does not depend on missing roundRange metadata in the inline operator roster", () => {
    const source = readFileSync(manualCheckScriptPath, "utf-8");

    expect(source.includes("s.roundRange[0]")).toBe(false);
    expect(source.includes("instant-1")).toBe(true);
    expect(source.includes("last-word")).toBe(true);
  });
});
