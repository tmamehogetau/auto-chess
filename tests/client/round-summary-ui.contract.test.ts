import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("round summary ui contract", () => {
  test("ラウンドサマリー表示用のdata属性を保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-round-summary-overlay",
      "data-round-summary-round",
      "data-round-summary-list",
      "data-round-summary-close",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }
  });
});
