import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf-8");

describe("item removal contract", () => {
  test("combat simulator no longer applies item effects", () => {
    const source = readSource("src/server/combat/battle-simulator.ts");

    expect(source.includes("applyItemEffects")).toBe(false);
    expect(source.includes("ITEM_DEFINITIONS")).toBe(false);
    expect(source.includes("ItemType")).toBe(false);
    expect(source.includes("item definition")).toBe(false);
  });

  test("match logger and prep logging no longer track item arrays or item actions", () => {
    const matchLoggerSource = readSource("src/server/match-logger.ts");
    const prepLoggingSource = readSource("src/server/rooms/game-room/prep-command-logging.ts");

    expect(matchLoggerSource.includes("buy_item")).toBe(false);
    expect(matchLoggerSource.includes("equip_item")).toBe(false);
    expect(matchLoggerSource.includes("unequip_item")).toBe(false);
    expect(matchLoggerSource.includes("sell_item")).toBe(false);
    expect(matchLoggerSource).not.toMatch(/\bitems\??\s*:/);

    expect(prepLoggingSource.includes("itemBuySlotIndex")).toBe(false);
    expect(prepLoggingSource.includes("itemEquipToBench")).toBe(false);
    expect(prepLoggingSource.includes("itemUnequipFromBench")).toBe(false);
    expect(prepLoggingSource.includes("itemSellInventoryIndex")).toBe(false);
    expect(prepLoggingSource.includes("itemShopOffers")).toBe(false);
    expect(prepLoggingSource.includes("itemInventory")).toBe(false);
  });
});
