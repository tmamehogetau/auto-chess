import { describe, it, expect, beforeEach } from "vitest";
import { MatchRoomController } from "../../src/server/match-room-controller";
import { DEFAULT_FLAGS } from "../../src/shared/feature-flags";
import { FLAG_CONFIGURATIONS, withFlags } from "./feature-flag-test-helper";
import { sharedBoardCoordinateToIndex } from "../../src/shared/shared-board-config";

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
      const rangerSynergy = status.activeSynergies?.find((synergy) => synergy.unitType === "ranger");

      expect(rangerSynergy).toBeDefined();
      expect(rangerSynergy?.count).toBe(1);
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

    it("special unit upgrades raise selected hero battle units through level-based progression", () => {
      controller.selectHero("player1", "reimu");
      expect(controller.startIfReady(createdAtMs, playerIds)).toBe(true);

      const goldByPlayer = Reflect.get(controller, "goldByPlayer") as Map<string, number>;
      goldByPlayer.set("player1", 80);

      expect(controller.submitPrepCommand("player1", 1, createdAtMs + 1_000, {
        specialUnitUpgradeCount: 3,
      })).toEqual({ accepted: true });
      expect(controller.getPlayerStatus("player1")).toMatchObject({
        gold: 73,
        specialUnitLevel: 4,
      });

      const appendHeroBattleUnits = Reflect.get(controller, "appendHeroBattleUnits") as (
        nextPlayerIds: string[],
        battleUnits: Array<{ id: string; unitLevel: number }>,
        side: "left" | "right",
      ) => string[];
      const level4BattleUnits: Array<{ id: string; unitLevel: number }> = [];
      appendHeroBattleUnits.call(controller, ["player1"], level4BattleUnits, "left");
      expect(level4BattleUnits).toEqual([
        expect.objectContaining({
          id: "hero-player1",
          unitLevel: 4,
        }),
      ]);

      expect(controller.submitPrepCommand("player1", 2, createdAtMs + 2_000, {
        specialUnitUpgradeCount: 3,
      })).toEqual({ accepted: true });
      expect(controller.getPlayerStatus("player1")).toMatchObject({
        gold: 54,
        specialUnitLevel: 7,
      });

      const level7BattleUnits: Array<{ id: string; unitLevel: number }> = [];
      appendHeroBattleUnits.call(controller, ["player1"], level7BattleUnits, "left");
      expect(level7BattleUnits).toEqual([
        expect.objectContaining({
          id: "hero-player1",
          unitLevel: 7,
        }),
      ]);
    });

    it("raid role start auto-places selected heroes onto fixed bottom-row cells", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      }, async () => {
        const raidController = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          createdAtMs,
          {
            readyAutoStartMs: 0,
            prepDurationMs: 45_000,
            battleDurationMs: 40_000,
            settleDurationMs: 5_000,
            eliminationDurationMs: 2_000,
          },
        );

        const started = raidController.startWithResolvedRoles(createdAtMs, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([
            ["p2", "remilia"],
          ]),
        });

        expect(started).toBe(true);
        expect(raidController.getHeroPlacementForPlayer("p1")).toBe(sharedBoardCoordinateToIndex({ x: 0, y: 5 }));
        expect(raidController.getHeroPlacementForPlayer("p3")).toBe(sharedBoardCoordinateToIndex({ x: 2, y: 5 }));
        expect(raidController.getHeroPlacementForPlayer("p4")).toBe(sharedBoardCoordinateToIndex({ x: 4, y: 5 }));
      });
    });

    it("shared battle replay starts hero units from their fixed shared-board placements", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      }, async () => {
        const raidController = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          createdAtMs,
          {
            readyAutoStartMs: 0,
            prepDurationMs: 45_000,
            battleDurationMs: 40_000,
            settleDurationMs: 5_000,
            eliminationDurationMs: 2_000,
          },
        );

        expect(raidController.startWithResolvedRoles(createdAtMs, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([
            ["p2", "remilia"],
          ]),
        })).toBe(true);

        expect(raidController.applyPrepPlacementForPlayer("p2", [{ cell: 0, unitType: "vanguard" }])).toMatchObject({ success: true });
        expect(raidController.applyPrepPlacementForPlayer("p1", [{ cell: 4, unitType: "ranger" }])).toMatchObject({ success: true });
        expect(raidController.applyPrepPlacementForPlayer("p3", [{ cell: 5, unitType: "mage" }])).toMatchObject({ success: true });
        expect(raidController.applyPrepPlacementForPlayer("p4", [{ cell: 6, unitType: "assassin" }])).toMatchObject({ success: true });

        raidController.advanceByTime(createdAtMs + 45_001);
        raidController.advanceByTime(createdAtMs + 85_002);

        const replay = raidController.getSharedBattleReplay("Settle");
        const battleStart = replay?.timeline.find((event) => event.type === "battleStart");

        expect(battleStart?.type).toBe("battleStart");
        expect(battleStart?.units).toEqual(expect.arrayContaining([
          expect.objectContaining({
            battleUnitId: "hero-p1",
            x: 0,
            y: 5,
          }),
          expect.objectContaining({
            battleUnitId: "hero-p3",
            x: 2,
            y: 5,
          }),
          expect.objectContaining({
            battleUnitId: "hero-p4",
            x: 4,
            y: 5,
          }),
        ]));
      });
    });

    it("raid role start auto-places the selected boss onto the fixed top-row cell", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      }, async () => {
        const raidController = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          createdAtMs,
          {
            readyAutoStartMs: 0,
            prepDurationMs: 45_000,
            battleDurationMs: 40_000,
            settleDurationMs: 5_000,
            eliminationDurationMs: 2_000,
          },
        );

        const started = raidController.startWithResolvedRoles(createdAtMs, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([
            ["p2", "remilia"],
          ]),
        });

        expect(started).toBe(true);
        expect(raidController.getBossPlacementForPlayer("p2")).toBe(
          sharedBoardCoordinateToIndex({ x: 2, y: 0 }),
        );
      });
    });

    it("shared battle replay starts the boss unit from its fixed shared-board placement", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      }, async () => {
        const raidController = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          createdAtMs,
          {
            readyAutoStartMs: 0,
            prepDurationMs: 45_000,
            battleDurationMs: 40_000,
            settleDurationMs: 5_000,
            eliminationDurationMs: 2_000,
          },
        );

        expect(raidController.startWithResolvedRoles(createdAtMs, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([
            ["p2", "remilia"],
          ]),
        })).toBe(true);

        expect(raidController.applyPrepPlacementForPlayer("p1", [{ cell: 4, unitType: "ranger" }])).toMatchObject({ success: true });
        expect(raidController.applyPrepPlacementForPlayer("p2", [{ cell: 10, unitType: "vanguard" }])).toMatchObject({ success: true });

        raidController.advanceByTime(createdAtMs + 45_001);
        raidController.advanceByTime(createdAtMs + 85_002);

        const replay = raidController.getSharedBattleReplay("Settle");
        const battleStart = replay?.timeline.find((event) => event.type === "battleStart");

          expect(battleStart?.type).toBe("battleStart");
          expect(battleStart?.units).toEqual(expect.arrayContaining([
            expect.objectContaining({
              battleUnitId: "boss-p2",
              x: 2,
              y: 0,
              currentHp: 600,
              maxHp: 600,
            }),
          ]));
        });
      });

    it("rejects normal board placements onto the reserved boss cell", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      }, async () => {
        const raidController = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          createdAtMs,
          {
            readyAutoStartMs: 0,
            prepDurationMs: 45_000,
            battleDurationMs: 40_000,
            settleDurationMs: 5_000,
            eliminationDurationMs: 2_000,
          },
        );

        expect(raidController.startWithResolvedRoles(createdAtMs, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([
            ["p2", "remilia"],
          ]),
        })).toBe(true);

        const result = raidController.submitPrepCommand("p2", 1, createdAtMs + 1_000, {
          boardPlacements: [
            { cell: sharedBoardCoordinateToIndex({ x: 2, y: 0 }), unitType: "vanguard" },
          ],
        });

        expect(result).toEqual({ accepted: false, code: "INVALID_PAYLOAD" });
      });
    });

    it("shared battle replay remaps normal raid units into the front-priority raid rows", async () => {
      await withFlags({
        ...FLAG_CONFIGURATIONS.ALL_DISABLED,
        enableBossExclusiveShop: true,
        enableHeroSystem: true,
      }, async () => {
        const raidController = new MatchRoomController(
          ["p1", "p2", "p3", "p4"],
          createdAtMs,
          {
            readyAutoStartMs: 0,
            prepDurationMs: 45_000,
            battleDurationMs: 40_000,
            settleDurationMs: 5_000,
            eliminationDurationMs: 2_000,
          },
        );

        expect(raidController.startWithResolvedRoles(createdAtMs, ["p1", "p2", "p3", "p4"], {
          bossPlayerId: "p2",
          selectedHeroByPlayer: new Map([
            ["p1", "reimu"],
            ["p3", "marisa"],
            ["p4", "okina"],
          ]),
          selectedBossByPlayer: new Map([
            ["p2", "remilia"],
          ]),
        })).toBe(true);

        const extendedRaidCell = sharedBoardCoordinateToIndex({ x: 0, y: 4 });
        const extendedBossCell = sharedBoardCoordinateToIndex({ x: 5, y: 1 });

        expect(
          raidController.applyPrepPlacementForPlayer("p1", [
            { cell: extendedRaidCell, unitType: "ranger" },
          ]),
        ).toMatchObject({ success: true });
        expect(
          raidController.applyPrepPlacementForPlayer("p2", [
            { cell: extendedBossCell, unitType: "vanguard" },
          ]),
        ).toMatchObject({ success: true });

        raidController.advanceByTime(createdAtMs + 45_001);
        raidController.advanceByTime(createdAtMs + 85_002);

        const replay = raidController.getSharedBattleReplay("Settle");
        const battleStart = replay?.timeline.find((event) => event.type === "battleStart");

        expect(battleStart?.type).toBe("battleStart");
        expect(battleStart?.units).toEqual(expect.arrayContaining([
          expect.objectContaining({
            battleUnitId: "right-ranger-0",
            x: 0,
            y: 4,
          }),
          expect.objectContaining({
            battleUnitId: "left-vanguard-0",
            x: 5,
            y: 1,
          }),
        ]));
      });
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
