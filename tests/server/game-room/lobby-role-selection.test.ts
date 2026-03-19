import { MapSchema } from "@colyseus/schema";
import { describe, expect, it } from "vitest";

import { PlayerPresenceState } from "../../../src/server/schema/match-room-state";
import {
  canAcceptBossPreference,
  resetSelectionStage,
  resolveBossPlayerId,
} from "../../../src/server/rooms/game-room/lobby-role-selection";

describe("lobby-role-selection", () => {
  describe("resolveBossPlayerId", () => {
    it("returns the only connected volunteer", () => {
      const result = resolveBossPlayerId({
        connectedPlayerIds: ["p1", "p2", "p3"],
        wantsBossByPlayer: new Map([
          ["p2", true],
          ["p3", false],
        ]),
        random: () => 0.99,
      });

      expect(result).toBe("p2");
    });

    it("picks among connected volunteers using the random index", () => {
      const result = resolveBossPlayerId({
        connectedPlayerIds: ["p1", "p2", "p3"],
        wantsBossByPlayer: new Map([
          ["p1", true],
          ["p3", true],
        ]),
        random: () => 0.75,
      });

      expect(result).toBe("p3");
    });

    it("falls back to connected players when nobody wants boss", () => {
      const result = resolveBossPlayerId({
        connectedPlayerIds: ["p1", "p2", "p3"],
        wantsBossByPlayer: new Map([
          ["p1", false],
          ["p2", false],
        ]),
        random: () => 0.34,
      });

      expect(result).toBe("p2");
    });
  });

  describe("resetSelectionStage", () => {
    it("resets connected players and leaves disconnected players untouched", () => {
      const players = new MapSchema<PlayerPresenceState>();

      const connectedOne = new PlayerPresenceState();
      connectedOne.wantsBoss = true;
      connectedOne.role = "boss";
      connectedOne.selectedBossId = "remilia";
      connectedOne.selectedHeroId = "hero-a";
      connectedOne.ready = true;
      players.set("p1", connectedOne);

      const connectedTwo = new PlayerPresenceState();
      connectedTwo.wantsBoss = false;
      connectedTwo.role = "raid";
      connectedTwo.selectedBossId = "boss-b";
      connectedTwo.selectedHeroId = "hero-b";
      connectedTwo.ready = true;
      players.set("p2", connectedTwo);

      const disconnected = new PlayerPresenceState();
      disconnected.wantsBoss = true;
      disconnected.role = "boss";
      disconnected.selectedBossId = "boss-c";
      disconnected.selectedHeroId = "hero-c";
      disconnected.ready = true;
      players.set("p3", disconnected);

      const result = resetSelectionStage({
        connectedPlayerIds: ["p1", "p2"],
        players,
      });

      expect(result).toEqual({
        lobbyStage: "preference",
        selectionDeadlineAtMs: 0,
        bossPlayerId: "",
      });

      expect(players.get("p1")).toMatchObject({
        wantsBoss: true,
        role: "unassigned",
        selectedBossId: "",
        selectedHeroId: "",
        ready: false,
      });
      expect(players.get("p2")).toMatchObject({
        wantsBoss: false,
        role: "unassigned",
        selectedBossId: "",
        selectedHeroId: "",
        ready: false,
      });
      expect(players.get("p3")).toMatchObject({
        wantsBoss: true,
        role: "boss",
        selectedBossId: "boss-c",
        selectedHeroId: "hero-c",
        ready: true,
      });
    });
  });

  describe("canAcceptBossPreference", () => {
    it.each([
      { phase: "Waiting", lobbyStage: "preference", expected: true },
      { phase: "Waiting", lobbyStage: "selection", expected: false },
      { phase: "Prep", lobbyStage: "preference", expected: false },
      { phase: "Battle", lobbyStage: "preference", expected: false },
    ] as const)("returns $expected for $phase / $lobbyStage", ({ phase, lobbyStage, expected }) => {
      expect(canAcceptBossPreference({ phase, lobbyStage })).toBe(expected);
    });
  });
});
