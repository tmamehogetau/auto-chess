import type { RoomMessageSubscriber } from "./round-state-receiver";
import { createDomTextDisplayTarget } from "./ui/dom-text-display-target";
import { SetIdDisplayApp } from "./ui/set-id-display-app";

interface QueryRoot {
  querySelector(selector: string): unknown;
}

export interface AttachSetIdDisplayOptions {
  selector?: string;
  root?: QueryRoot;
}

export interface SetIdDisplayBinding {
  stop(): void;
  renderNow(): void;
}

export interface BrowserRoom extends RoomMessageSubscriber {
  leave?(consented?: boolean): void | Promise<unknown>;
}

export interface BrowserClient {
  joinOrCreate(
    roomName: string,
    options?: Record<string, unknown>,
  ): Promise<BrowserRoom>;
}

export type BrowserClientFactory =
  | ((endpoint: string) => BrowserClient)
  | ((endpoint: string) => Promise<BrowserClient>);

export interface ConnectAndAttachSetIdDisplayOptions
  extends AttachSetIdDisplayOptions {
  endpoint: string;
  roomName?: string;
  roomOptions?: Record<string, unknown>;
  createClient?: BrowserClientFactory;
}

export interface ConnectedSetIdDisplayBinding extends SetIdDisplayBinding {
  readonly room: BrowserRoom;
  leave(consented?: boolean): Promise<void>;
}

export const DEFAULT_SET_ID_SELECTOR = "[data-set-id-display]";

export const DEFAULT_ROOM_NAME = "game";

export function attachSetIdDisplay(
  room: RoomMessageSubscriber,
  options: AttachSetIdDisplayOptions = {},
): SetIdDisplayBinding | null {
  const root = resolveQueryRoot(options.root);

  if (!root) {
    return null;
  }

  const selector = options.selector ?? DEFAULT_SET_ID_SELECTOR;
  const displayTarget = createDomTextDisplayTarget(root, selector);

  if (!displayTarget) {
    return null;
  }

  const app = new SetIdDisplayApp(displayTarget);
  app.start(room);

  return {
    stop: () => {
      app.stop();
    },
    renderNow: () => {
      app.renderNow();
    },
  };
}

export async function connectAndAttachSetIdDisplay(
  options: ConnectAndAttachSetIdDisplayOptions,
): Promise<ConnectedSetIdDisplayBinding | null> {
  const createClient = options.createClient ?? createDefaultBrowserClient;
  const roomName = options.roomName ?? DEFAULT_ROOM_NAME;
  const client = await createClient(options.endpoint);
  const room = await client.joinOrCreate(roomName, options.roomOptions);
  const binding = attachSetIdDisplay(room, options);

  if (!binding) {
    await leaveRoomSafely(room);
    return null;
  }

  let stopped = false;
  let left = false;

  const stop = (): void => {
    if (stopped) {
      return;
    }

    stopped = true;
    binding.stop();
  };

  const leave = async (consented = true): Promise<void> => {
    stop();

    if (left) {
      return;
    }

    left = true;
    await leaveRoomSafely(room, consented);
  };

  return {
    room,
    stop,
    renderNow: () => {
      if (stopped) {
        return;
      }

      binding.renderNow();
    },
    leave,
  };
}

async function createDefaultBrowserClient(endpoint: string): Promise<BrowserClient> {
  const sdk = await import("@colyseus/sdk");

  return new sdk.Client(endpoint) as BrowserClient;
}

function resolveQueryRoot(root?: QueryRoot): QueryRoot | null {
  if (root) {
    return root;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return document;
}

async function leaveRoomSafely(
  room: BrowserRoom,
  consented = true,
): Promise<void> {
  if (typeof room.leave !== "function") {
    return;
  }

  await room.leave(consented);
}
