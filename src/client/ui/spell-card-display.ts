/**
 * スペルカード表示用UIコンポーネント
 * Phase2 P1-1: スペルカード最小版
 */

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
    setSpellCard: (spellCard) => {
      element.innerHTML = spellCard
        ? `
          <div class="spell-card" data-spell-id="${spellCard.id}">
            <div class="spell-card-name">${spellCard.name}</div>
            <div class="spell-card-description">${spellCard.description}</div>
            <div class="spell-card-round">R${spellCard.roundRange[0]}-${spellCard.roundRange[1]}</div>
          </div>
        `
        : '<div class="spell-card empty">スペルなし</div>';
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
    this.spellCardMap = new Map([
      ['sdl-1', {
        id: 'sdl-1',
        name: 'スカーレットデスレーザー',
        description: 'レイドメンバー全員に50ダメージを与える',
        roundRange: [1, 4],
      }],
    ]);
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
  }

  private onStateChange(state: unknown): void {
    if (!state || typeof state !== "object") {
      return;
    }

    // Colyseus SchemaからdeclaredSpellIdを取得
    const stateObj = state as { declaredSpellId?: string };
    const declaredSpellId = stateObj.declaredSpellId;

    if (!declaredSpellId) {
      this.displayTarget.setSpellCard(null);
      return;
    }

    const spellCard = this.spellCardMap.get(declaredSpellId);
    this.displayTarget.setSpellCard(spellCard ?? null);
  }
}
