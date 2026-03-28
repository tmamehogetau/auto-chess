export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  options: {
    pollMs?: number;
    timeoutMessage?: string;
  } = {},
): Promise<void> {
  const startMs = Date.now();
  const pollMs = options.pollMs ?? 15;

  while (Date.now() - startMs < timeoutMs) {
    if (predicate()) {
      return;
    }

    await sleep(pollMs);
  }

  throw new Error(options.timeoutMessage ?? `Timed out while waiting for condition (${timeoutMs}ms)`);
}

export async function waitForText(
  element: { textContent: string | null },
  expected: string,
  timeoutMs: number,
): Promise<void> {
  await waitForCondition(
    () => element.textContent === expected,
    timeoutMs,
    { timeoutMessage: `Timed out while waiting text: ${expected}` },
  );
}

export async function waitForSharedBoardPropagation(
  bridge: {
    flushPlacementChangeBatch?: () => Promise<void>;
    syncSharedBoardViewFromController?: (forcePrepSync?: boolean) => void;
  } | undefined,
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const startMs = Date.now();

  while (Date.now() - startMs < timeoutMs) {
    await bridge?.flushPlacementChangeBatch?.();
    bridge?.syncSharedBoardViewFromController?.(true);

    if (predicate()) {
      return;
    }

    await sleep(15);
  }

  throw new Error("Timed out while waiting for shared board propagation");
}
