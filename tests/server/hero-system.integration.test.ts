import { describe, it, expect, beforeEach } from "vitest";
import { MatchRoomController } from "../../src/server/match-room-controller";
import { DEFAULT_FLAGS } from "../../src/shared/feature-flags";
import { FLAG_CONFIGURATIONS, withFlags } from "./feature-flag-test-helper";

describe("Hero System Integration Tests", () => {
  let controller: MatchRoomController;
  const playerIds = ["player1", "player2"];
  const createdAtMs = Date.now();

  beforeEach(() => {
    controller = new MatchRoomController(playerIds, createdAtMs, {
      readyAutoStartMs: 0, // Auto-start immediately
      prepDurationMs: 45_000,
      battleDurationMs: 40_000,
      settleDurationMs: 5_000,
      eliminationDurationMs: 2_000,
    });
  });

  describe("Hero Selection", () => {
    it("should allow hero selection with valid hero ID", () => {
      expect(() => {
        controller.selectHero("player1", "reimu");
      }).not.toThrow();

      expect(controller.getSelectedHero("player1")).toBe("reimu");
    });

    it("should throw error for invalid hero ID", () => {
      expect(() => {
        controller.selectHero("player1", "invalid-hero");
      }).toThrow("Unknown hero: invalid-hero");
    });

    it("should throw error for unknown player", () => {
      expect(() => {
        controller.selectHero("unknown-player", "reimu");
      }).toThrow("Unknown player: unknown-player");
    });

    it("should update player status with selected hero ID", () => {
      controller.selectHero("player1", "reimu");
      const started = controller.startIfReady(createdAtMs, playerIds);
      expect(started).toBe(true);

      const status = controller.getPlayerStatus("player1");
      expect(status.selectedHeroId).toBe("reimu");
    });
  });

  describe("Hero in Battle Simulation", () => {
    it("should include hero in battle units when selected", () => {
      controller.selectHero("player1", "reimu");
      controller.selectHero("player2", "reimu");
      const started = controller.startIfReady(createdAtMs, playerIds);
      expect(started).toBe(true);

      // Start battle phase
      controller.advanceByTime(createdAtMs + 45_001);

      // Check that battle units include heroes
      const status1 = controller.getPlayerStatus("player1");
      const status2 = controller.getPlayerStatus("player2");

      expect(status1.selectedHeroId).toBe("reimu");
      expect(status2.selectedHeroId).toBe("reimu");
    });

    it("should not include hero when not selected", () => {
      const started = controller.startIfReady(createdAtMs, playerIds);
      expect(started).toBe(true);
      controller.advanceByTime(createdAtMs + 45_001);

      const status = controller.getPlayerStatus("player1");
      expect(status.selectedHeroId).toBe("");
    });

    it("selected hero should grant +1 synergy count for player status", () => {
      controller.selectHero("player1", "reimu");
      controller.selectHero("player2", "reimu");

      const started = controller.startIfReady(createdAtMs, playerIds);
      expect(started).toBe(true);

      const placementResult = controller.submitPrepCommand("player1", 1, createdAtMs + 1_000, {
        boardPlacements: [
          { cell: 0, unitType: "vanguard" },
          { cell: 1, unitType: "vanguard" },
        ],
      });

      expect(placementResult).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("player1");
      const vanguardSynergy = status.activeSynergies?.find((synergy) => synergy.unitType === "vanguard");

      expect(vanguardSynergy).toBeDefined();
      expect(vanguardSynergy?.count).toBe(3);
      expect(vanguardSynergy?.tier).toBe(1);
    });

    it("should include scarlet mansion synergy in player status", () => {
      const started = controller.startIfReady(createdAtMs, playerIds);
      expect(started).toBe(true);

      const placementResult = controller.submitPrepCommand("player1", 1, createdAtMs + 1_000, {
        boardPlacements: [
          { cell: 0, unitType: "vanguard", archetype: "meiling" },
          { cell: 1, unitType: "assassin", archetype: "sakuya" },
        ],
      });

      expect(placementResult).toEqual({ accepted: true });

      const status = controller.getPlayerStatus("player1");
      const scarletSynergy = status.activeSynergies?.find((synergy) => synergy.unitType === "scarletMansion");

      expect(scarletSynergy).toBeDefined();
      expect(scarletSynergy?.count).toBe(2);
      expect(scarletSynergy?.tier).toBe(1);
    });

    it("enableTouhouFactions=false のとき Touhou faction synergy は player status に出さない", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableTouhouRoster: true,
        enableTouhouFactions: false,
      }, async () => {
        const touhouController = new MatchRoomController(playerIds, createdAtMs, {
          readyAutoStartMs: 0,
          prepDurationMs: 45_000,
          battleDurationMs: 40_000,
          settleDurationMs: 5_000,
          eliminationDurationMs: 2_000,
        });

        expect(touhouController.startIfReady(createdAtMs, playerIds)).toBe(true);

        const placementResult = touhouController.submitPrepCommand("player1", 1, createdAtMs + 1_000, {
          boardPlacements: [
            { cell: 0, unitType: "vanguard", unitId: "rin" },
            { cell: 1, unitType: "mage", unitId: "satori" },
          ],
        });

        expect(placementResult).toEqual({ accepted: true });

        const status = touhouController.getPlayerStatus("player1");
        expect(status.activeSynergies?.find((synergy) => synergy.unitType === "chireiden")).toBeUndefined();
      });
    });

    it("enableTouhouFactions=true のとき Touhou faction synergy を player status に含める", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableTouhouRoster: true,
        enableTouhouFactions: true,
      }, async () => {
        const touhouController = new MatchRoomController(playerIds, createdAtMs, {
          readyAutoStartMs: 0,
          prepDurationMs: 45_000,
          battleDurationMs: 40_000,
          settleDurationMs: 5_000,
          eliminationDurationMs: 2_000,
        });

        expect(touhouController.startIfReady(createdAtMs, playerIds)).toBe(true);

        const placementResult = touhouController.submitPrepCommand("player1", 1, createdAtMs + 1_000, {
          boardPlacements: [
            { cell: 0, unitType: "vanguard", unitId: "rin" },
            { cell: 1, unitType: "mage", unitId: "satori" },
            { cell: 2, unitType: "assassin", unitId: "koishi" },
          ],
        });

        expect(placementResult).toEqual({ accepted: true });

        const status = touhouController.getPlayerStatus("player1");
        const factionSynergy = status.activeSynergies?.find((synergy) => synergy.unitType === "chireiden");
        const classSynergy = status.activeSynergies?.find((synergy) => synergy.unitType === "mage");

        expect(factionSynergy).toBeDefined();
        expect(factionSynergy?.count).toBe(3);
        expect(factionSynergy?.tier).toBe(1);
        expect(classSynergy).toBeDefined();
        expect(classSynergy?.count).toBe(1);
        expect(classSynergy?.tier).toBe(0);
      });
    });
  });

  describe("Hero System Disabled (Feature Flag OFF)", () => {
    it("should work normally when hero system is disabled", () => {
      const started = controller.startIfReady(createdAtMs, playerIds);
      expect(started).toBe(true);

      const status = controller.getPlayerStatus("player1");
      expect(status.selectedHeroId).toBe("");
      expect(status.boardUnits).toEqual([]);
      expect(status.benchUnits).toEqual([]);
    });

    it("should not require hero selection when flag is OFF", () => {
      const started = controller.startIfReady(createdAtMs, playerIds);
      expect(started).toBe(true);

      const status = controller.getPlayerStatus("player1");
      expect(status.selectedHeroId).toBe("");
    });
  });
});
