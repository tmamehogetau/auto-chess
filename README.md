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
