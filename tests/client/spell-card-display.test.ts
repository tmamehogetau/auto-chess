import { describe, expect, test } from "vitest";

import { SPELL_CARDS } from "../../src/data/spell-cards";
import {
  SpellCardDisplayApp,
  type SpellCardDisplayTarget,
} from "../../src/client/ui/spell-card-display";
import type { UnitEffectSetId } from "../../src/shared/room-messages";

class FakeDisplayTarget implements SpellCardDisplayTarget {
  public spellCard: {
    id: string;
    name: string;
    description: string;
    roundRange: [number, number];
  } | null = null;

  public getElement(): HTMLElement | null {
    return null;
  }

  public setSpellCard(
    spellCard: {
      id: string;
      name: string;
      description: string;
      roundRange: [number, number];
    } | null,
  ): void {
    this.spellCard = spellCard;
  }
}

class FakeSubscriber {
  private readonly listeners = new Set<
    (state: { declaredSpellId?: string; setId?: UnitEffectSetId }) => void
  >();

  public onMessage(): void {}

  public onStateChange(
    callback: (state: { declaredSpellId?: string; setId?: UnitEffectSetId }) => void,
  ): void {
    this.listeners.add(callback);
  }

  public emitStateChange(state: { declaredSpellId?: string; setId?: UnitEffectSetId }): void {
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

describe("SpellCardDisplayApp", () => {
  test("宣言された全スペルカードを正本データどおり表示できる", () => {
    const displayTarget = new FakeDisplayTarget();
    const app = new SpellCardDisplayApp(displayTarget);
    const subscriber = new FakeSubscriber();

    app.start(subscriber);

    for (const spellCard of SPELL_CARDS) {
      subscriber.emitStateChange({ declaredSpellId: spellCard.id });

      expect(displayTarget.spellCard).toEqual({
        id: spellCard.id,
        name: spellCard.name,
        description: spellCard.description,
        roundRange: spellCard.roundRange,
      });
    }
  });
});
