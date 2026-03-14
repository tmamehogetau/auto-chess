import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const indexHtmlPath = resolve(process.cwd(), "src/client/index.html");

describe("phase hp ui contract", () => {
  test("phase HP gauge用のdata属性を保持する", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    const requiredAttributes = [
      "data-phase-hp-section",
      "data-phase-hp-value",
      "data-phase-hp-fill",
      "data-phase-hp-result",
    ];

    for (const attribute of requiredAttributes) {
      expect(html.includes(attribute)).toBe(true);
    }
  });

  test("phase HP section exposes readability hooks", () => {
    const html = readFileSync(indexHtmlPath, "utf-8");

    expect(html.includes(".phase-hp-fill.success")).toBe(true);
    expect(html.includes(".phase-hp-fill.failed")).toBe(true);
    expect(html.includes("data-phase-hp-value")).toBe(true);
  });
});
