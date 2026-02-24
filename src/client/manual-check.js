const VALID_SET_IDS = new Set(["set1", "set2"]);
const DEFAULT_ROOM_NAME = "game";

const endpointInput = document.querySelector("[data-endpoint-input]");
const roomInput = document.querySelector("[data-room-input]");
const setIdSelect = document.querySelector("[data-setid-select]");
const connectButton = document.querySelector("[data-connect-button]");
const leaveButton = document.querySelector("[data-leave-button]");
const statusElement = document.querySelector("[data-connection-status]");
const errorElement = document.querySelector("[data-connection-error]");
const setIdElement = document.querySelector("[data-set-id-display]");

let activeRoom = null;
let connecting = false;

initializeDefaults();
updateButtons();

connectButton?.addEventListener("click", () => {
  void connect();
});

leaveButton?.addEventListener("click", () => {
  void leave();
});

window.addEventListener("beforeunload", () => {
  void leave();
});

async function connect() {
  if (connecting || activeRoom) {
    return;
  }

  connecting = true;
  updateButtons();
  setStatus("connecting");
  setError("");

  try {
    const { endpoint, roomName, setId } = readConfig();
    const { Client } = await import("https://esm.sh/@colyseus/sdk@0.17.34");
    const client = new Client(endpoint);
    const roomOptions = setId ? { setId } : undefined;
    const room = await client.joinOrCreate(roomName, roomOptions);

    activeRoom = room;
    setStatus("connected");
    setCurrentSet(room.state?.setId);

    room.onStateChange((state) => {
      setCurrentSet(state?.setId);
    });

    room.onLeave(() => {
      activeRoom = null;
      setStatus("disconnected");
      updateButtons();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    setStatus("error");
    setError(message);
  } finally {
    connecting = false;
    updateButtons();
  }
}

async function leave() {
  if (!activeRoom) {
    return;
  }

  const room = activeRoom;

  activeRoom = null;
  setStatus("disconnecting");
  updateButtons();

  try {
    if (typeof room.removeAllListeners === "function") {
      room.removeAllListeners();
    }

    if (typeof room.leave === "function") {
      await room.leave();
    }
  } finally {
    setStatus("disconnected");
    updateButtons();
  }
}

function initializeDefaults() {
  if (endpointInput) {
    endpointInput.value =
      searchParams().get("endpoint") ??
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
  }

  if (roomInput) {
    roomInput.value = searchParams().get("roomName") ?? DEFAULT_ROOM_NAME;
  }

  if (setIdSelect) {
    const setId = normalizeSetId(searchParams().get("setId"));

    setIdSelect.value = setId ?? "";
  }

  if (searchParams().get("autoconnect") === "1") {
    void connect();
  }
}

function readConfig() {
  const endpointValue = endpointInput?.value?.trim();
  const roomValue = roomInput?.value?.trim();
  const selectedSetId = setIdSelect?.value?.trim() ?? "";

  return {
    endpoint: endpointValue || `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`,
    roomName: roomValue || DEFAULT_ROOM_NAME,
    setId: normalizeSetId(selectedSetId),
  };
}

function normalizeSetId(value) {
  if (!value || !VALID_SET_IDS.has(value)) {
    return undefined;
  }

  return value;
}

function searchParams() {
  return new URLSearchParams(location.search);
}

function updateButtons() {
  if (connectButton) {
    connectButton.disabled = connecting || Boolean(activeRoom);
  }

  if (leaveButton) {
    leaveButton.disabled = connecting || !activeRoom;
  }
}

function setStatus(status) {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = status;
}

function setError(message) {
  if (!errorElement) {
    return;
  }

  errorElement.textContent = message;
}

function setCurrentSet(setId) {
  if (!setIdElement) {
    return;
  }

  setIdElement.textContent = normalizeSetId(setId) ?? "-";
}
