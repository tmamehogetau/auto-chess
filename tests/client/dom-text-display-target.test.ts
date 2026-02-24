import { describe, expect, test } from "vitest";

import {
  DomTextDisplayTarget,
  createDomTextDisplayTarget,
} from "../../src/client/ui/dom-text-display-target";

describe("DomTextDisplayTarget", () => {
  test("setTextでtextContentを更新する", () => {
    const element = { textContent: "old" };
    const target = new DomTextDisplayTarget(element);

    target.setText("set2");

    expect(element.textContent).toBe("set2");
  });

  test("selectorに一致する要素がない場合はnullを返す", () => {
    const root = {
      querySelector: (_selector: string): null => {
        return null;
      },
    };

    const target = createDomTextDisplayTarget(root, "#set-id");

    expect(target).toBeNull();
  });

  test("selector一致時にDomTextDisplayTargetを作成する", () => {
    const element = { textContent: "-" };
    const root = {
      querySelector: (_selector: string): unknown => {
        return element;
      },
    };

    const target = createDomTextDisplayTarget(root, "#set-id");

    if (!target) {
      throw new Error("Expected target instance");
    }

    target.setText("set1");
    expect(element.textContent).toBe("set1");
  });
});
