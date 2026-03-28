import { describe, expect, test } from "vitest";

import vitestConfig from "../../vitest.config";

describe("vitest config", () => {
  test("default excludes keep node_modules out of test discovery", () => {
    const excludes = vitestConfig.test?.exclude ?? [];

    expect(excludes).toContain("**/node_modules/**");
    expect(excludes).toContain(".worktrees/**");
    expect(excludes).toContain("**/.worktrees/**");
  });
});
