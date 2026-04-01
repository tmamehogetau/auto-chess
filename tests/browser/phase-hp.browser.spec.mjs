import { writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const OPERATOR_URL =
  "http://127.0.0.1:38081/src/client/index.html?endpoint=ws://127.0.0.1:3568&setId=set2&autoconnect=1&autoFillBots=3";
const PLAYER_URL_PREFIX =
  "http://127.0.0.1:38081/src/client/player.html?endpoint=ws://127.0.0.1:3568&autoconnect=1&roomId=";

function parsePhaseHpValue(valueText) {
  const legacyMatched = valueText.match(/(\d+)\s*\/\s*(\d+)/);
  if (legacyMatched) {
    return {
      remainingHp: Number.parseInt(legacyMatched[1], 10),
      targetHp: Number.parseInt(legacyMatched[2], 10),
      pushedPct: null,
    };
  }

  const matched = valueText.match(/(\d+)\s*HP left\s*\((\d+)% pushed\)/i);
  if (!matched) {
    return null;
  }

  return {
    remainingHp: Number.parseInt(matched[1], 10),
    targetHp: null,
    pushedPct: Number.parseInt(matched[2], 10),
  };
}

async function ensurePlayerBossFlow(playerPage) {
  const statusCopy = playerPage.locator("[data-player-status-copy]");
  const connectButton = playerPage.locator("[data-player-connect-btn]");
  const bossPreferenceOnButton = playerPage.locator("[data-player-boss-pref-on]");
  const lobbyReadyButton = playerPage.locator("[data-player-lobby-ready-button]");
  const bossOptions = playerPage.locator("[data-player-boss-options] .player-choice-btn");
  const prepReadyButton = playerPage.locator("[data-player-ready-button]");

  await expect(connectButton).toHaveText(/Connected|Joining...|Join Session/, { timeout: 15_000 });
  await expect(statusCopy).not.toContainText("接続できませんでした", { timeout: 15_000 });

  if (await bossPreferenceOnButton.isVisible().catch(() => false)) {
    const bossPreferenceDisabled = await bossPreferenceOnButton.isDisabled().catch(() => true);
    if (!bossPreferenceDisabled) {
      await bossPreferenceOnButton.click();
    }
  }

  if (await lobbyReadyButton.isVisible().catch(() => false)) {
    const lobbyReadyDisabled = await lobbyReadyButton.isDisabled().catch(() => true);
    const lobbyReadyLabel = ((await lobbyReadyButton.textContent()) ?? "").trim();
    if (!lobbyReadyDisabled && lobbyReadyLabel === "Ready") {
      await lobbyReadyButton.click();
    }
  }

  if (await bossOptions.first().isVisible().catch(() => false)) {
    await bossOptions.first().click({ timeout: 1_000 }).catch(() => {});
  }

  if (await prepReadyButton.isVisible().catch(() => false)) {
    const prepReadyDisabled = await prepReadyButton.isDisabled().catch(() => true);
    const prepReadyLabel = ((await prepReadyButton.textContent()) ?? "").trim();
    if (!prepReadyDisabled && prepReadyLabel === "Ready") {
      await prepReadyButton.click();
    }
  }
}

test("operator browser shows boss phase hp progress across auto-played rounds", async ({ page, context }, testInfo) => {
  await page.goto(OPERATOR_URL, { waitUntil: "domcontentloaded" });

  const roomCodeOutput = page.locator("[data-room-code-output]");
  const roundDisplay = page.locator("[data-round-display]");
  const phaseDisplay = page.locator("[data-phase-display]");
  const readyCountDisplay = page.locator("[data-ready-count]");
  const phaseHpValue = page.locator("[data-boss-phase-hp-display]");
  const phaseHpResult = page.locator("[data-phase-hp-result]");

  await expect(roomCodeOutput).not.toHaveText("-", { timeout: 15_000 });
  await expect(roundDisplay).toHaveText(/\d+/, { timeout: 15_000 });

  const roomCode = ((await roomCodeOutput.textContent()) ?? "").trim();
  expect(roomCode.length).toBeGreaterThan(0);

  const playerPage = await context.newPage();
  await playerPage.goto(`${PLAYER_URL_PREFIX}${roomCode}`, { waitUntil: "domcontentloaded" });

  await expect(playerPage.locator("[data-player-room-code-input]")).toHaveValue(roomCode, { timeout: 10_000 });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    await ensurePlayerBossFlow(playerPage);
    const phaseText = ((await phaseDisplay.textContent()) ?? "").trim();
    const phaseHpText = ((await phaseHpValue.textContent()) ?? "").trim();
    if (phaseText.length > 0 && phaseHpText !== "0 / 0") {
      break;
    }
    await page.waitForTimeout(250);
  }

  const observations = [];
  let lastObservationKey = "";
  const observationStartedAt = Date.now();

  while (Date.now() - observationStartedAt < 30_000) {
    await ensurePlayerBossFlow(playerPage);

    const observation = {
      atMs: Date.now() - observationStartedAt,
      round: (await roundDisplay.textContent())?.trim() ?? "",
      phase: (await phaseDisplay.textContent())?.trim() ?? "",
      ready: (await readyCountDisplay.textContent())?.trim() ?? "",
      phaseHp: (await phaseHpValue.textContent())?.trim() ?? "",
      phaseResult: (await phaseHpResult.textContent())?.trim() ?? "",
    };

    const observationKey = JSON.stringify({
      round: observation.round,
      phase: observation.phase,
      ready: observation.ready,
      phaseHp: observation.phaseHp,
      phaseResult: observation.phaseResult,
    });

    if (observationKey !== lastObservationKey) {
      observations.push(observation);
      lastObservationKey = observationKey;
    }

    if (observation.phase === "End") {
      break;
    }

    await page.waitForTimeout(250);
  }

  const phaseHpSnapshots = observations
    .map((observation) => ({
      ...observation,
      parsedPhaseHp: parsePhaseHpValue(observation.phaseHp),
    }))
    .filter((observation) => observation.parsedPhaseHp !== null);

  expect(phaseHpSnapshots.length).toBeGreaterThan(0);
  expect(
    phaseHpSnapshots.some(
      (observation) =>
        observation.parsedPhaseHp !== null
        && (
          (typeof observation.parsedPhaseHp.pushedPct === "number" && observation.parsedPhaseHp.pushedPct > 0)
          || observation.parsedPhaseHp.remainingHp < phaseHpSnapshots[0].parsedPhaseHp.remainingHp
        ),
    ),
  ).toBe(true);

  const distinctRounds = new Set(
    phaseHpSnapshots
      .map((observation) => observation.round)
      .filter((roundText) => roundText.length > 0),
  );
  expect(distinctRounds.size).toBeGreaterThanOrEqual(2);

  const resultStates = observations.filter(
    (observation) => observation.phaseResult.length > 0 && observation.phaseResult !== "pending",
  );
  expect(resultStates.length).toBeGreaterThan(0);

  const observationPath = testInfo.outputPath("phase-hp-observations.json");
  await writeFile(observationPath, `${JSON.stringify(observations, null, 2)}\n`, "utf8");

  await page.screenshot({
    path: testInfo.outputPath("phase-hp-operator.png"),
    fullPage: true,
  });
  await playerPage.screenshot({
    path: testInfo.outputPath("phase-hp-player.png"),
    fullPage: true,
  });

  // eslint-disable-next-line no-console
  console.log(`phase hp observations saved to ${observationPath}`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(observations, null, 2));
});
