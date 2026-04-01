import { defineConfig } from "@playwright/test";

const BROWSER_PHASE_HP_SERVER_PORT = 3568;
const BROWSER_PHASE_HP_CLIENT_PORT = 38081;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    browserName: "chromium",
    headless: false,
    viewport: { width: 1600, height: 900 },
    actionTimeout: 10_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `cmd.exe /c "set PORT=${BROWSER_PHASE_HP_SERVER_PORT} && npm.cmd exec tsx scripts/phase-hp-browser-server.ts"`,
      port: BROWSER_PHASE_HP_SERVER_PORT,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: `cmd.exe /c "set CLIENT_CHECK_PORT=${BROWSER_PHASE_HP_CLIENT_PORT} && npm.cmd run client:check"`,
      port: BROWSER_PHASE_HP_CLIENT_PORT,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
