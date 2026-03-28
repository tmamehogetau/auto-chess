import type { ShadowDiffMessage } from "../../../../src/shared/room-messages";
export { waitForCondition } from "../../../helpers/wait-helpers";

/**
 * Wait for a specific message type from a client
 * @param client Colyseus test client
 * @param messageType Message type to wait for
 * @param timeoutMs Maximum time to wait
 */
export async function waitForMessage<T>(
  client: { onMessage: (type: string, handler: (msg: T) => void) => void },
  messageType: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message: ${messageType}`));
    }, timeoutMs);

    client.onMessage(messageType, (message: T) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}

/**
 * Collect messages of a specific type over a time window
 * @param client Colyseus test client
 * @param messageType Message type to collect
 * @param windowMs Time window in milliseconds
 * @returns Array of collected messages
 */
export async function collectMessages<T>(
  client: { onMessage: (type: string, handler: (msg: T) => void) => void },
  messageType: string,
  windowMs: number,
): Promise<T[]> {
  const messages: T[] = [];
  
  client.onMessage(messageType, (message: T) => {
    messages.push(message);
  });

  await new Promise((resolve) => setTimeout(resolve, windowMs));
  
  return messages;
}

/**
 * Wait for a minimum number of messages
 * @param client Colyseus test client
 * @param messageType Message type to wait for
 * @param minCount Minimum number of messages
 * @param timeoutMs Maximum time to wait
 */
export async function waitForMessageCount<T>(
  client: { onMessage: (type: string, handler: (msg: T) => void) => void },
  messageType: string,
  minCount: number,
  timeoutMs: number,
): Promise<T[]> {
  const messages: T[] = [];
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (messages.length >= minCount) {
        resolve(messages);
      } else {
        reject(new Error(
          `Expected ${minCount} messages, got ${messages.length} for ${messageType}`
        ));
      }
    }, timeoutMs);

    client.onMessage(messageType, (message: T) => {
      messages.push(message);
      if (messages.length >= minCount) {
        clearTimeout(timer);
        resolve(messages);
      }
    });
  });
}

/**
 * Assert that no messages of a specific type are received
 * @param client Colyseus test client
 * @param messageType Message type to check
 * @param windowMs Time window in milliseconds
 */
export async function assertNoMessage<T>(
  client: { onMessage: (type: string, handler: (msg: T) => void) => void },
  messageType: string,
  windowMs: number,
): Promise<void> {
  let received = false;
  
  client.onMessage(messageType, () => {
    received = true;
  });

  await new Promise((resolve) => setTimeout(resolve, windowMs));
  
  if (received) {
    throw new Error(`Expected no ${messageType} messages, but received at least one`);
  }
}

/**
 * Type guard for ShadowDiffMessage
 */
export function isShadowDiffMessage(msg: unknown): msg is ShadowDiffMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "shadow_diff" &&
    typeof m.seq === "number" &&
    typeof m.roomId === "string" &&
    typeof m.sourceVersion === "number" &&
    typeof m.ts === "number" &&
    typeof m.status === "string" &&
    typeof m.mismatchCount === "number" &&
    Array.isArray(m.mismatchedCells)
  );
}

/**
 * Validate ShadowDiffMessage structure
 */
export function validateShadowDiffMessage(msg: unknown): asserts msg is ShadowDiffMessage {
  if (!isShadowDiffMessage(msg)) {
    throw new Error(`Invalid ShadowDiffMessage structure: ${JSON.stringify(msg)}`);
  }
}
