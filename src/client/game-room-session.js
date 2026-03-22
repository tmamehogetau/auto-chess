const DEFAULT_ENDPOINT = "ws://localhost:2567";
export const DEFAULT_ROOM_NAME = "game";
const DEFAULT_SDK_URL = "https://esm.sh/@colyseus/sdk@0.17.34";

export const CLIENT_MESSAGE_TYPES = {
  READY: "ready",
  PREP_COMMAND: "prep_command",
  ADMIN_QUERY: "admin_query",
  BOSS_PREFERENCE: "boss_preference",
  BOSS_SELECT: "boss_select",
  HERO_SELECT: "HERO_SELECT",
};

export const SERVER_MESSAGE_TYPES = {
  COMMAND_RESULT: "command_result",
  ROUND_STATE: "round_state",
  SHADOW_DIFF: "shadow_diff",
  ADMIN_RESPONSE: "admin_response",
};

export function createGameRoomSession(options = {}) {
  const endpoint = typeof options.endpoint === "string" && options.endpoint.length > 0
    ? options.endpoint
    : getSearchParam("endpoint") ?? resolveDefaultEndpoint();
  const roomName = typeof options.roomName === "string" && options.roomName.length > 0
    ? options.roomName
    : getSearchParam("roomName") ?? DEFAULT_ROOM_NAME;
  const loadSdk = typeof options.loadSdk === "function"
    ? options.loadSdk
    : () => import(DEFAULT_SDK_URL);

  let client = null;
  let room = null;
  let state = null;
  let connectionState = "idle";

  const stateListeners = new Set();
  const connectionListeners = new Set();
  const messageListeners = new Map();

  function notifyConnection() {
    for (const listener of connectionListeners) {
      listener(connectionState);
    }
  }

  function notifyState(nextState) {
    state = nextState;
    for (const listener of stateListeners) {
      listener(nextState);
    }
  }

  function notifyMessage(type, payload) {
    const listeners = messageListeners.get(type) ?? [];
    for (const listener of listeners) {
      listener(payload);
    }
  }

  async function connect(connectOptions = {}) {
    if (room) {
      return room;
    }

    connectionState = "connecting";
    notifyConnection();

    try {
      const sdk = await loadSdk();
      client = new sdk.Client(endpoint);
      const { roomId, roomOptions } = normalizeConnectOptions(connectOptions);
      if (typeof roomId === "string" && roomId.length > 0) {
        if (typeof client.joinById !== "function") {
          throw new Error("joinById not available");
        }
        room = await client.joinById(roomId, roomOptions);
      } else {
        room = await client.joinOrCreate(roomName, roomOptions);
      }
      connectionState = "connected";
      notifyConnection();

      room.onStateChange((nextState) => {
        notifyState(nextState);
      });

      room.onMessage("*", (type, payload) => {
        notifyMessage(type, payload);
      });

      if (room.state) {
        notifyState(room.state);
      }

      return room;
    } catch (error) {
      client = null;
      room = null;
      state = null;
      connectionState = "idle";
      notifyConnection();
      throw error;
    }
  }

  async function disconnect(consented = true) {
    if (!room) {
      connectionState = "idle";
      notifyConnection();
      return;
    }

    const roomToLeave = room;
    room = null;
    state = null;
    client = null;
    connectionState = "disconnecting";
    notifyConnection();
    try {
      await roomToLeave.leave(consented);
    } finally {
      connectionState = "idle";
      notifyConnection();
    }
  }

  function onStateChange(listener) {
    stateListeners.add(listener);
    if (state) {
      listener(state);
    }

    return () => {
      stateListeners.delete(listener);
    };
  }

  function onConnectionState(listener) {
    connectionListeners.add(listener);
    listener(connectionState);

    return () => {
      connectionListeners.delete(listener);
    };
  }

  function onMessage(type, listener) {
    const listeners = messageListeners.get(type) ?? [];
    listeners.push(listener);
    messageListeners.set(type, listeners);

    return () => {
      const activeListeners = messageListeners.get(type) ?? [];
      messageListeners.set(
        type,
        activeListeners.filter((entry) => entry !== listener),
      );
    };
  }

  function send(type, payload) {
    if (!room) {
      return false;
    }

    room.send(type, payload);
    return true;
  }

  return {
    connect,
    disconnect,
    onConnectionState,
    onMessage,
    onStateChange,
    send,
    getClient: () => client,
    getConnectionState: () => connectionState,
    getRoom: () => room,
    getState: () => state,
  };
}

function normalizeConnectOptions(connectOptions) {
  if (!connectOptions || typeof connectOptions !== "object" || Array.isArray(connectOptions)) {
    return { roomId: "", roomOptions: {} };
  }

  const hasStructuredFields = Object.prototype.hasOwnProperty.call(connectOptions, "roomId")
    || Object.prototype.hasOwnProperty.call(connectOptions, "roomOptions");

  if (!hasStructuredFields) {
    return {
      roomId: "",
      roomOptions: connectOptions,
    };
  }

  return {
    roomId: typeof connectOptions.roomId === "string" ? connectOptions.roomId.trim() : "",
    roomOptions:
      connectOptions.roomOptions && typeof connectOptions.roomOptions === "object"
        ? connectOptions.roomOptions
        : {},
  };
}

function getSearchParam(key) {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(key);
}

function resolveDefaultEndpoint() {
  if (typeof window === "undefined") {
    return DEFAULT_ENDPOINT;
  }

  const host = typeof window.location?.host === "string"
    ? window.location.host.trim()
    : "";
  if (host.length === 0) {
    return DEFAULT_ENDPOINT;
  }

  const protocol = window.location?.protocol === "https:" ? "wss://" : "ws://";
  return `${protocol}${host}`;
}
