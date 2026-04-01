import { defineConfig } from "@playwright/test";

const BROWSER_PHASE_HP_SERVER_PORT = 3568;
const BROWSER_PHASE_HP_CLIENT_PORT = 38081;
const IS_WINDOWS = process.platform === "win32";

function withEnvCommand(envName, value, command) {
  if (IS_WINDOWS) {
    return `cmd.exe /c "set ${envName}=${value} && ${command}"`;
  }

  return `${envName}=${value} ${command}`;
}

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
      command: withEnvCommand(
        "PORT",
        BROWSER_PHASE_HP_SERVER_PORT,
        IS_WINDOWS
          ? "npm.cmd exec tsx scripts/phase-hp-browser-server.ts"
          : "npm exec tsx scripts/phase-hp-browser-server.ts",
      ),
      port: BROWSER_PHASE_HP_SERVER_PORT,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: withEnvCommand(
        "CLIENT_CHECK_PORT",
        BROWSER_PHASE_HP_CLIENT_PORT,
        IS_WINDOWS
          ? "npm.cmd run client:check"
          : "npm run client:check",
      ),
      port: BROWSER_PHASE_HP_CLIENT_PORT,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
