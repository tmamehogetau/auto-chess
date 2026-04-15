export interface BattleRng {
  nextFloat(): number;
}

class MathRandomBattleRng implements BattleRng {
  nextFloat(): number {
    return Math.random();
  }
}

class SeededBattleRng implements BattleRng {
  private state: number;

  constructor(seed: number) {
    const normalizedSeed = seed >>> 0;
    this.state = normalizedSeed === 0 ? 0x6d2b79f5 : normalizedSeed;
  }

  nextFloat(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

export function createDefaultBattleRng(): BattleRng {
  return new MathRandomBattleRng();
}

export function createSeededBattleRng(seed: number): BattleRng {
  return new SeededBattleRng(seed);
}
