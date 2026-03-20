export const DEFAULT_ROOM_NAME: string;

export const CLIENT_MESSAGE_TYPES: {
  READY: string;
  PREP_COMMAND: string;
  ADMIN_QUERY: string;
  BOSS_PREFERENCE: string;
  BOSS_SELECT: string;
  HERO_SELECT: string;
};

export const SERVER_MESSAGE_TYPES: {
  COMMAND_RESULT: string;
  ROUND_STATE: string;
  SHADOW_DIFF: string;
  ADMIN_RESPONSE: string;
};

export type GameRoomSdkModule = {
  Client: new (endpoint: string) => {
    joinOrCreate: (roomName: string, roomOptions?: Record<string, unknown>) => Promise<{
      sessionId?: string;
      state?: unknown;
      onStateChange: (listener: (state: unknown) => void) => void;
      onMessage: (type: string, listener: (...args: unknown[]) => void) => void;
      send?: (type: string, payload?: unknown) => void;
      leave?: (consented?: boolean) => Promise<void>;
    }>;
  };
};

export type GameRoomSessionOptions = {
  endpoint?: string;
  roomName?: string;
  loadSdk?: () => Promise<GameRoomSdkModule>;
};

export type GameRoomSession = {
  connect: (roomOptions?: Record<string, unknown>) => Promise<unknown>;
  disconnect: (consented?: boolean) => Promise<void>;
  onConnectionState: (listener: (state: string) => void) => () => void;
  onMessage: (type: string, listener: (payload: unknown) => void) => () => void;
  onStateChange: (listener: (state: unknown) => void) => () => void;
  send: (type: string, payload?: unknown) => boolean;
  getClient: () => unknown;
  getConnectionState: () => string;
  getRoom: () => {
    sessionId?: string;
  } | null;
  getState: () => unknown;
};

export function createGameRoomSession(options?: GameRoomSessionOptions): GameRoomSession;
