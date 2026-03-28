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

function normalizeConnectOptions(rawOptions) {
  if (!rawOptions || typeof rawOptions !== "object") {
    return { mode: "joinOrCreate", roomId: "", roomOptions: {}, sharedBoardRoomName: "shared_board" };
  }

  const candidate = rawOptions;
  const hasStructuredKeys = "mode" in candidate || "roomId" in candidate || "roomOptions" in candidate;
  if (!hasStructuredKeys) {
    return {
      mode: "joinOrCreate",
      roomId: "",
      roomOptions: candidate,
      sharedBoardRoomName: "shared_board",
    };
  }

  const topLevelRoomOptions = { ...candidate };
  delete topLevelRoomOptions.mode;
  delete topLevelRoomOptions.roomId;
  delete topLevelRoomOptions.roomOptions;
  delete topLevelRoomOptions.sharedBoardRoomName;

  return {
    mode: candidate.mode === "create" || candidate.mode === "createPaired"
      ? candidate.mode
      : "joinOrCreate",
    roomId: typeof candidate.roomId === "string" ? candidate.roomId.trim() : "",
    sharedBoardRoomName:
      typeof candidate.sharedBoardRoomName === "string" && candidate.sharedBoardRoomName.trim().length > 0
        ? candidate.sharedBoardRoomName.trim()
        : "shared_board",
    roomOptions: {
      ...topLevelRoomOptions,
      ...(candidate.roomOptions && typeof candidate.roomOptions === "object"
        ? candidate.roomOptions
        : {}),
    },
  };
}

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
  let createdSharedBoardRoom = null;

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

  function bindServerMessageHandlers(activeRoom) {
    if (!activeRoom || typeof activeRoom.onMessage !== "function") {
      return;
    }

    activeRoom.onMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, (payload) => {
      notifyMessage(SERVER_MESSAGE_TYPES.COMMAND_RESULT, payload);
    });
    activeRoom.onMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, (payload) => {
      notifyMessage(SERVER_MESSAGE_TYPES.ROUND_STATE, payload);
    });
    activeRoom.onMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, (payload) => {
      notifyMessage(SERVER_MESSAGE_TYPES.SHADOW_DIFF, payload);
    });
    activeRoom.onMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, (payload) => {
      notifyMessage(SERVER_MESSAGE_TYPES.ADMIN_RESPONSE, payload);
    });
  }

  async function leaveRoomQuietly(roomToLeave, consented = true) {
    if (!roomToLeave || typeof roomToLeave.leave !== "function") {
      return;
    }

    try {
      await roomToLeave.leave(consented);
    } catch {
      // Cleanup should not mask the original connection error.
    }
  }

  async function connect(rawOptions = {}) {
    if (room) {
      return room;
    }

    const connectOptions = normalizeConnectOptions(rawOptions);

    connectionState = "connecting";
    notifyConnection();

    try {
      const sdk = await loadSdk();
      client = new sdk.Client(endpoint);
      if (connectOptions.roomId.length > 0) {
        room = await client.joinById(connectOptions.roomId, connectOptions.roomOptions);
      } else if (connectOptions.mode === "createPaired") {
        const sharedBoardRoom = await client.create(connectOptions.sharedBoardRoomName);
        createdSharedBoardRoom = sharedBoardRoom;
        room = await client.create(roomName, {
          ...connectOptions.roomOptions,
          sharedBoardRoomId: sharedBoardRoom.roomId,
        });
      } else if (connectOptions.mode === "create") {
        room = await client.create(roomName, connectOptions.roomOptions);
      } else {
        room = await client.joinOrCreate(roomName, connectOptions.roomOptions);
      }
      connectionState = "connected";
      notifyConnection();

      room.onStateChange((nextState) => {
        notifyState(nextState);
      });

      bindServerMessageHandlers(room);

      if (room.state) {
        notifyState(room.state);
      }

      return room;
    } catch (error) {
      const ownedSharedBoardRoom = createdSharedBoardRoom;
      client = null;
      room = null;
      state = null;
      createdSharedBoardRoom = null;
      connectionState = "idle";
      notifyConnection();
      await leaveRoomQuietly(ownedSharedBoardRoom);
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
    const sharedBoardRoomToLeave = createdSharedBoardRoom;
    room = null;
    state = null;
    client = null;
    createdSharedBoardRoom = null;
    connectionState = "disconnecting";
    notifyConnection();
    let leaveError = null;
    try {
      await roomToLeave.leave(consented);
    } catch (error) {
      leaveError = error;
    } finally {
      await leaveRoomQuietly(
        sharedBoardRoomToLeave && sharedBoardRoomToLeave !== roomToLeave
          ? sharedBoardRoomToLeave
          : null,
        consented,
      );
      connectionState = "idle";
      notifyConnection();
    }

    if (leaveError) {
      throw leaveError;
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

  function takeCreatedSharedBoardRoom() {
    const nextRoom = createdSharedBoardRoom;
    createdSharedBoardRoom = null;
    return nextRoom;
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
    takeCreatedSharedBoardRoom,
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
