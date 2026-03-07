import { describe, it, expect, vi } from "vitest";
import { syncRanking } from "../../../src/server/rooms/game-room/ranking-sync";

// Mock schema types
const createMockRankingArray = () => ({
  length: 0,
  pop: vi.fn(),
  push: vi.fn(),
  splice: vi.fn(),
  [Symbol.iterator]: function* () {
    const items: string[] = [];
    for (let i = 0; i < this.length; i++) {
      if (items[i]) yield items[i];
    }
  },
});

describe("syncRanking", () => {
  it("should clear existing ranking and populate with new ranking", () => {
    const stateRanking: { length: number; pop: () => void; push: (item: string) => void } = {
      length: 3,
      pop: vi.fn(function(this: { length: number }) {
        this.length = Math.max(0, this.length - 1);
      }),
      push: vi.fn(function(this: { length: number }, item: string) {
        this.length++;
      }),
    };

    const newRanking = ["player-a", "player-b", "player-c"];
    
    syncRanking(stateRanking as unknown as string[], newRanking);

    // Should pop all existing items
    expect(stateRanking.pop).toHaveBeenCalledTimes(3);
    // Should push all new items
    expect(stateRanking.push).toHaveBeenCalledTimes(3);
    expect(stateRanking.push).toHaveBeenNthCalledWith(1, "player-a");
    expect(stateRanking.push).toHaveBeenNthCalledWith(2, "player-b");
    expect(stateRanking.push).toHaveBeenNthCalledWith(3, "player-c");
  });

  it("should handle empty new ranking", () => {
    const stateRanking: { length: number; pop: () => void; push: (item: string) => void } = {
      length: 2,
      pop: vi.fn(function(this: { length: number }) {
        this.length = Math.max(0, this.length - 1);
      }),
      push: vi.fn(function(this: { length: number }) {
        this.length++;
      }),
    };

    syncRanking(stateRanking as unknown as string[], []);

    expect(stateRanking.pop).toHaveBeenCalledTimes(2);
    expect(stateRanking.push).not.toHaveBeenCalled();
  });

  it("should handle empty existing ranking", () => {
    const stateRanking: { length: number; pop: () => void; push: (item: string) => void } = {
      length: 0,
      pop: vi.fn(function(this: { length: number }) {
        this.length = Math.max(0, this.length - 1);
      }),
      push: vi.fn(function(this: { length: number }) {
        this.length++;
      }),
    };

    const newRanking = ["player-1", "player-2"];
    
    syncRanking(stateRanking as unknown as string[], newRanking);

    expect(stateRanking.pop).not.toHaveBeenCalled();
    expect(stateRanking.push).toHaveBeenCalledTimes(2);
  });

  it("should preserve ranking order (top to bottom)", () => {
    const pushedItems: string[] = [];
    const stateRanking: { length: number; pop: () => void; push: (item: string) => void } = {
      length: 0,
      pop: vi.fn(),
      push: vi.fn(function(this: { length: number }, item: string) {
        this.length++;
        pushedItems.push(item);
      }),
    };

    const newRanking = ["first", "second", "third", "fourth"];
    
    syncRanking(stateRanking as unknown as string[], newRanking);

    expect(pushedItems).toEqual(["first", "second", "third", "fourth"]);
  });

  it("should handle large ranking lists", () => {
    let popCount = 0;
    let pushCount = 0;
    const stateRanking: { length: number; pop: () => void; push: (item: string) => void } = {
      length: 100,
      pop: vi.fn(function(this: { length: number }) {
        popCount++;
        this.length = Math.max(0, this.length - 1);
      }),
      push: vi.fn(function(this: { length: number }) {
        pushCount++;
        this.length++;
      }),
    };

    const newRanking = Array.from({ length: 50 }, (_, i) => `player-${i}`);
    
    syncRanking(stateRanking as unknown as string[], newRanking);

    expect(popCount).toBe(100);
    expect(pushCount).toBe(50);
  });
});
