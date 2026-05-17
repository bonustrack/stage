# station-template

Skeleton for a new metro station. Copy this folder to `packages/<name>-station/`
and edit `index.ts`.

## Checklist

1. Rename the folder: must match the glob `*-station`.
2. In `package.json`:
   - set `"name"` to `@stage-labs/<name>-station`,
   - flip `"metroStation"` from `false` to `true`,
   - add any platform SDK dependency you need (most stations only use `fetch`).
3. In `index.ts`:
   - `name`: short station id (`'discord'`, `'gmail'`, `'linear'`, …) — also the
     scheme for `metro://<name>/...` lines.
   - `configured()`: return `true` only when env/state for this station is
     present. Stations that return `false` are loaded but never started.
   - `start(emit)`: connect to the upstream platform; call `emit(envelope)` for
     every inbound event. Set `envelope.text` so the chat-bubble formatter and
     the mobile app render something readable. `kind` is open — use `'message'`,
     `'reaction'`, `'webhook'`, or whatever your platform emits.
   - `stop()`: drop sockets / timers. Idempotent.
   - `actions`: object of `name → async function`. Each action receives one args
     object and returns a result. Declare the names your station exposes — the
     core knows nothing about them; users invoke them via `Client.call(station,
     action, args)` or `metro <station> <action> <args.json>`.

## Validation

The Client checks `name/start/stop/configured/actions` exist and have the right
types at discovery time. If any are missing the station is logged and skipped —
the daemon keeps running.
