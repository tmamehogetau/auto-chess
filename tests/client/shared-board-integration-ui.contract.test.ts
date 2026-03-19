import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("shared board integration ui contract", () => {
  test("共有盤面統合用のdata属性を保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-shared-board-section",
      "data-shared-board-grid",
      "data-shared-board-placement-guide",
      "data-shared-cursor-list",
      "data-shared-board-status-legend",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }
  });
});
