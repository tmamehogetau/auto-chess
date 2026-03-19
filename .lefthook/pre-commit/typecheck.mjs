import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const command = isWindows ? process.env.ComSpec || "cmd.exe" : "npm";
const args = isWindows
  ? ["/d", "/s", "/c", "npm run typecheck"]
  : ["run", "typecheck"];
const result = spawnSync(command, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
