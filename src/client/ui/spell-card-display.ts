/**
 * スペルカード表示用UIコンポーネント
 * Phase2 P1-1: スペルカード最小版
 */

import { SPELL_CARDS } from "../../data/spell-cards";
import type { RoomMessageSubscriber } from "../round-state-receiver";

/**
 * スペルカード情報
 */
export interface SpellCardInfo {
  id: string;
  name: string;
  description: string;
  roundRange: [number, number];
}

/**
 * スペルカード表示ターゲット
 */
export interface SpellCardDisplayTarget {
  getElement(): HTMLElement | null;
  setSpellCard(spellCard: SpellCardInfo | null): void;
  setUsedSpellCards(spellCards: SpellCardInfo[]): void;
}

/**
 * DOMターゲットを作成
 */
export function createSpellCardDisplayTarget(
  root: { querySelector(selector: string): unknown },
  selector: string,
): SpellCardDisplayTarget | null {
  const element = root.querySelector(selector) as HTMLElement | null;

  if (!element) {
    return null;
  }

  return {
    getElement: () => element,
    setUsedSpellCards: (spellCards) => {
      const usedSpellMarkup = spellCards.length > 0
        ? `
          <div class="spell-card-used-list">
            <div class="spell-card-used-label">使用済み</div>
            <div class="spell-card-used-items">${spellCards.map((spellCard) => `<span class="spell-card-used-item" data-used-spell-id="${spellCard.id}">${spellCard.name}</span>`).join("")}</div>
          </div>
        `
        : "";

      const currentMarkup = element.querySelector("[data-current-spell-card]")?.outerHTML
        ?? '<div class="spell-card empty" data-current-spell-card>スペルなし</div>';

      element.innerHTML = `${currentMarkup}${usedSpellMarkup}`;
    },
    setSpellCard: (spellCard) => {
      const usedSpellMarkup = element.querySelector(".spell-card-used-list")?.outerHTML ?? "";
      element.innerHTML = spellCard
        ? `
          <div class="spell-card" data-current-spell-card data-spell-id="${spellCard.id}">
            <div class="spell-card-name">${spellCard.name}</div>
            <div class="spell-card-description">${spellCard.description}</div>
            <div class="spell-card-round">R${spellCard.roundRange[0]}-${spellCard.roundRange[1]}</div>
          </div>
          ${usedSpellMarkup}
        `
        : `<div class="spell-card empty" data-current-spell-card>スペルなし</div>${usedSpellMarkup}`;
    },
  };
}

/**
 * スペルカード表示App
 */
export class SpellCardDisplayApp {
  private readonly displayTarget: SpellCardDisplayTarget;
  private readonly spellCardMap: Map<string, SpellCardInfo>;

  constructor(displayTarget: SpellCardDisplayTarget) {
    this.displayTarget = displayTarget;
    this.spellCardMap = new Map(
      SPELL_CARDS.map((spellCard) => [
        spellCard.id,
        {
          id: spellCard.id,
          name: spellCard.name,
          description: spellCard.description,
          roundRange: spellCard.roundRange,
        },
      ]),
    );
  }

  public start(subscriber: RoomMessageSubscriber): void {
    if (subscriber.onStateChange) {
      subscriber.onStateChange((state) => {
        this.onStateChange(state);
      });
    }
  }

  public stop(): void {
    // Clean up is handled by the subscriber
  }

  public renderNow(): void {
    this.displayTarget.setSpellCard(null);
    this.displayTarget.setUsedSpellCards([]);
  }

  private onStateChange(state: unknown): void {
    if (!state || typeof state !== "object") {
      return;
    }

    // Colyseus SchemaからdeclaredSpellIdを取得
    const stateObj = state as { declaredSpellId?: string; usedSpellIds?: string[] };
    const declaredSpellId = stateObj.declaredSpellId;
    const usedSpellCards = (stateObj.usedSpellIds ?? [])
      .map((spellId) => this.spellCardMap.get(spellId))
      .filter((spellCard): spellCard is SpellCardInfo => spellCard !== undefined);

    this.displayTarget.setUsedSpellCards(usedSpellCards);

    if (!declaredSpellId) {
      this.displayTarget.setSpellCard(null);
      return;
    }

    const spellCard = this.spellCardMap.get(declaredSpellId);
    this.displayTarget.setSpellCard(spellCard ?? null);
  }
}
