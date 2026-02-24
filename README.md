# auto-chess-mvp

Minimal server-authoritative auto chess MVP with Colyseus and TypeScript.

## setId configuration

- Valid values: `"set1"` and `"set2"`
- Default value: `"set1"`
- Canonical source on clients: `room.state.setId`
- `round_state` payload does not include `setId` by design

## How to pass setId

Use room options when creating or joining a room.

```ts
await testServer.createRoom("game", { setId: "set2" })
await testServer.sdk.joinOrCreate("game", { setId: "set2" })
```

If `setId` is omitted, the server applies the default (`set1`).

## Validation behavior

- Server validates `setId` during room creation.
- Invalid values (for example `"set3"`) throw `Error("Invalid setId: ...")`.

## Development checks

```bash
npm run typecheck
npm run test:run
```

## RoundStateReceiver notes

- `RoundStateReceiver` reads `setId` from `room.state`.
- `attach(room)` can be called again for room switching.
- Call `detach()` when you stop listening to avoid stale updates.

## Minimal UI wiring

- `RoundStateDisplayController` can render `setIdForDisplay` into any text target.
- Keep UI code thin and call `render()` after room events.
- `SetIdDisplayApp` wires `room -> RoundStateReceiver -> display` lifecycle with `start()` / `stop()`.
- `createDomTextDisplayTarget()` can bind a DOM selector to a `TextDisplayTarget`.
- `attachSetIdDisplay(room, options)` in `src/client/main.ts` is the minimal composition entry.

## Browser connect helper

- Browser SDK package: `@colyseus/sdk`
- `connectAndAttachSetIdDisplay(options)` joins a room, binds display, and returns `{ room, stop, renderNow, leave }`.
- If display target is missing, it auto-leaves the room and returns `null`.

```ts
import { connectAndAttachSetIdDisplay } from "./src/client/main";

const binding = await connectAndAttachSetIdDisplay({
  endpoint: "http://localhost:2567",
  roomName: "game",
  roomOptions: { setId: "set2" },
});

await binding?.leave();
```

## Browser bootstrap helper

- `startSetIdDisplayBootstrap(options)` in `src/client/bootstrap.ts` wraps connect + attach with optional `setId` forwarding.
- `src/client/index.html` has a minimal `[data-set-id-display]` template for manual checks.

## Manual browser check

- Start local static server: `npm run client:check`
- Open `src/client/index.html` from the local server (do not use `file://`).
- `src/client/manual-check.js` provides `Connect` / `Leave` / `Ready` / `Prep Command` controls.
- Placements format: `cell:unitType,cell:unitType` (example: `0:vanguard,1:assassin,4:ranger,5:ranger`).
- Optional query params: `endpoint`, `roomName`, `setId`, `autoconnect=1`.

Example:

```text
http://localhost:8080/src/client/index.html?endpoint=ws://localhost:2567&roomName=game&setId=set2&autoconnect=1
```
