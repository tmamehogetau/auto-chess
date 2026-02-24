import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("index.html contract", () => {
  test("manual-checkで必要なdata属性を保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-endpoint-input",
      "data-room-input",
      "data-setid-select",
      "data-autofill-input",
      "data-connect-button",
      "data-leave-button",
      "data-ready-checkbox",
      "data-ready-button",
      "data-cmdseq-input",
      "data-xp-purchase-input",
      "data-shop-refresh-input",
      "data-shop-buy-slot-input",
      "data-shop-lock-input",
      "data-bench-deploy-index-input",
      "data-bench-deploy-cell-input",
      "data-bench-sell-index-input",
      "data-placements-input",
      "data-prep-button",
      "data-connection-status",
      "data-autofill-status",
      "data-phase-value",
      "data-round-value",
      "data-self-status",
      "data-bench-list",
      "data-command-result",
      "data-connection-error",
      "data-set-id-display",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }
  });

  test("manual-check.jsをmodule scriptとして読み込む", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html).toMatch(/<script\s+type="module"\s+src="\.\/manual-check\.js"><\/script>/);
  });

  test("setId表示の初期値はハイフン", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html).toMatch(/data-set-id-display>\-<\/strong>/);
  });
});
