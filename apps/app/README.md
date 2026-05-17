# Metro app

Read-only mobile companion for the Metro daemon. View your live activity feed and
claimed lines from anywhere — same data the `metro tail` CLI produces, surfaced over
the daemon's monitor endpoints (`/api/state`, `/api/tail` SSE).

This is **v1, read-only**. No replying, editing, or reacting from the app yet —
that's Phase 3.

## Stack

- Expo (managed workflow) + expo-router (file-based navigation)
- React Native + plain RN components (no NativeWind, no state library)
- `expo-secure-store` for the bearer token (Keychain / Keystore on native)

## Run locally

From the repo root:

```bash
bun install                 # installs the workspace, including apps/app
bun --cwd apps/app start    # launches the Expo Metro bundler — scan the QR with Expo Go
```

The Expo bundler is itself called **Metro** (Facebook's RN bundler) — naming collision
with the daemon in `packages/metro/`. Don't confuse the two: the daemon is `bun run metro`
from `packages/metro/`; the bundler is `bun --cwd apps/app start`.

Once the bundler is up:

- iOS / Android: install [Expo Go](https://expo.dev/go) on your device, scan the QR.
- Web: press `w` in the bundler terminal (limited — `expo-secure-store` is in-memory only on web).

## First-time setup

The app needs three things, entered on the **Settings** screen:

1. **Daemon URL** — where the monitor endpoints live. Locally: `http://<your-mac-lan-ip>:8420`.
   For real phone use, set up the Cloudflare tunnel hostname (see below) and point at
   `https://monitor.metro.box`.
2. **Bearer token** — the value of `METRO_MONITOR_TOKEN` in your daemon's
   `~/.config/metro/.env`. Generate one with `openssl rand -base64 32`.
3. **Self URI** (optional) — your metro participant URI, e.g.
   `metro://claude/user/<id>`. Setting this enables claim-aware "mine + free"
   filtering (matches `metro tail --as <id>`). Leave blank to see everything.

Tap **Test connection** to verify; **Save** to persist.

## Exposing the daemon to your phone (Cloudflare tunnel)

The daemon listens on `127.0.0.1:8420` only. Use the existing
`webhook.metro.box` cloudflared tunnel — add a second hostname route to your
`~/.cloudflared/config.yml`:

```yaml
ingress:
  - hostname: webhook.metro.box
    service: http://127.0.0.1:8420
  - hostname: monitor.metro.box     # new — same backing service
    service: http://127.0.0.1:8420
  - service: http_status:404
```

Then:

```bash
cloudflared tunnel route dns <tunnel-name> monitor.metro.box
```

Restart the tunnel. Both hostnames now reach the daemon. The bearer token gate
is the same regardless of hostname — `monitor.metro.box` is just a routing
convenience.

See [`packages/metro/docs/monitor.md`](../../packages/metro/docs/monitor.md) for
the full endpoint spec.

## Layout

```
apps/app/
  app/
    _layout.tsx        ← stack navigator (light/dark auto)
    index.tsx          ← Activity feed (SSE tail, newest first)
    lines.tsx          ← Lines list (claims overview, tap to filter)
    settings.tsx       ← Daemon URL + token + self URI
    event/[id].tsx     ← Event detail (full text + metadata)
  components/
    EventRow.tsx       ← one history entry row
    StationIcon.tsx    ← two-letter station pill
  lib/
    config.ts          ← persisted config (expo-secure-store)
    sse.ts             ← SSE reader + useTail hook + fetchState
    types.ts           ← shapes mirroring packages/metro/src/history.ts
```

## What's not here (yet)

- Push notifications for inbounds (Phase 3 — needs the daemon to mint Expo push tokens).
- Reply / react / edit / send (Phase 3 — needs auth-scoped action endpoints).
- Multi-account / multi-daemon (Phase 3 — single config slot today).
- App Store / Play Store builds — Expo Go runnable only.
