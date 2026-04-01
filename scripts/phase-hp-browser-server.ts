import { buildServer } from "../server";

const PORT = Number.parseInt(process.env.PORT ?? "2568", 10);

async function main(): Promise<void> {
  const server = buildServer({
    gameRoomOptions: {
      readyAutoStartMs: 200,
      prepDurationMs: 1_000,
      battleDurationMs: 500,
      settleDurationMs: 200,
      eliminationDurationMs: 100,
    },
  });

  await server.listen(PORT);

  // eslint-disable-next-line no-console
  console.log(`phase-hp browser server running on ws://127.0.0.1:${PORT}`);
}

void main();
