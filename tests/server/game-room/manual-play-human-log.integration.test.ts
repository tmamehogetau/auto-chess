import {
  buildManualPlayHumanReportText,
  type ManualPlayHumanReport,
} from "../../../src/server/manual-play-human-log";
import {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  attachAutoFillHelperAutomationForTest,
  createRoomWithForcedFlags,
  describeGameRoomIntegration,
  expect,
  test,
  waitForCondition,
} from "./helpers";

type IntegrationClient = {
  sessionId: string;
  state?: unknown;
  send: (type: string, message?: unknown) => void;
  onStateChange: (handler: (state: unknown) => void) => void;
  onMessage: (type: string, handler: (_message: unknown) => void) => void;
};

type PrivateManualPlayReportRoom = {
  buildManualPlayHumanReport: () => ManualPlayHumanReport;
};

const MANUAL_PLAY_TEST_TIMINGS = {
  readyAutoStartMs: 100,
  prepDurationMs: 240,
  battleDurationMs: 80,
  settleDurationMs: 50,
  eliminationDurationMs: 50,
} as const;

function attachManualRaidAutomation(client: IntegrationClient): void {
  let heroSelected = false;

  client.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, () => {});
  client.onStateChange((state) => {
    const typedState = state as {
      phase?: string;
      lobbyStage?: string;
      players?: Map<string, {
        ready?: boolean;
        role?: string;
        selectedHeroId?: string;
        selectedBossId?: string;
      }>;
    } | null;
    const player = typedState?.players?.get(client.sessionId);

    if (!player) {
      return;
    }

    if (typedState?.phase === "Waiting" && typedState.lobbyStage === "preference") {
      client.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: false });
      if (player.ready !== true) {
        client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
      }
      return;
    }

    if (typedState?.phase === "Waiting" && typedState.lobbyStage === "selection") {
      if (player.role === "raid" && !heroSelected && !player.selectedHeroId) {
        client.send(CLIENT_MESSAGE_TYPES.HERO_SELECT, { heroId: "reimu" });
        heroSelected = true;
        return;
      }

      if (player.role === "boss" && !player.selectedBossId) {
        client.send(CLIENT_MESSAGE_TYPES.BOSS_SELECT, { bossId: "remilia" });
      }
      return;
    }

    if (typedState?.phase === "Prep" && player.ready !== true) {
      client.send(CLIENT_MESSAGE_TYPES.READY, { ready: true });
    }
  });
}

describeGameRoomIntegration("GameRoom integration / manual play human log", (context) => {
  test(
    "manual+helper match report includes battle-level unit details",
    async () => {
      const serverRoom = await createRoomWithForcedFlags(context.testServer, {
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
        enableSubUnitSystem: true,
        enableTouhouRoster: true,
      }, MANUAL_PLAY_TEST_TIMINGS);

      const clients = await Promise.all([
        context.testServer.connectTo(serverRoom) as Promise<IntegrationClient>,
        context.testServer.connectTo(serverRoom) as Promise<IntegrationClient>,
        context.testServer.connectTo(serverRoom) as Promise<IntegrationClient>,
        context.testServer.connectTo(serverRoom) as Promise<IntegrationClient>,
      ]);

      attachManualRaidAutomation(clients[0]!);
      attachAutoFillHelperAutomationForTest(clients[1]!, 0);
      attachAutoFillHelperAutomationForTest(clients[2]!, 1);
      attachAutoFillHelperAutomationForTest(clients[3]!, 2);

      clients[1]!.send(CLIENT_MESSAGE_TYPES.BOSS_PREFERENCE, { wantsBoss: true });

      await waitForCondition(() => serverRoom.state.phase === "End", 30_000);

      const report = buildManualPlayHumanReportText(
        (serverRoom as unknown as PrivateManualPlayReportRoom).buildManualPlayHumanReport(),
      );

      expect(report).toContain("Boss");
      expect(report).toContain("与ダメージ");
      expect(report).toContain("フェーズ貢献ダメージ");
      expect(report).toContain("最終HP");
    },
    35_000,
  );
});
