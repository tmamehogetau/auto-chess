const TEST_SERVER_PORT_BASE = 2_570;
const TEST_SERVER_PORT_HASH_RANGE = 200;
const TEST_SERVER_PORT_MAX = 65_535;
const TEST_SERVER_PORT_MAX_OFFSET =
  TEST_SERVER_PORT_MAX - TEST_SERVER_PORT_BASE - (TEST_SERVER_PORT_HASH_RANGE - 1);
export const TEST_SERVER_PORT_OFFSET_ENV = "TEST_SERVER_PORT_OFFSET";

function resolveSuiteNameHash(name: string): number {
  let hash = 0;

  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % TEST_SERVER_PORT_HASH_RANGE;
  }

  return hash;
}

export function parseTestServerPortOffset(rawValue: string | undefined): number {
  if (rawValue == null) {
    return 0;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(parsed, TEST_SERVER_PORT_MAX_OFFSET);
}

export function resolveTestServerPort(
  name: string,
  offset = parseTestServerPortOffset(process.env[TEST_SERVER_PORT_OFFSET_ENV]),
): number {
  return Math.min(TEST_SERVER_PORT_MAX, TEST_SERVER_PORT_BASE + offset + resolveSuiteNameHash(name));
}
