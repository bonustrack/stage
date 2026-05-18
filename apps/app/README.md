# Metro app

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fmetro%26ignored%3Dpackages&query=%24%5B0%5D.linesOfCode&label=lines%20of%20TypeScript&color=blue)](https://github.com/bonustrack/metro/tree/main/apps/app)

Mobile companion for the Metro daemon. View your live activity feed and
claimed lines from anywhere — same data the `metro tail` CLI produces, surfaced over
the daemon's monitor endpoints (`/api/state`, `/api/tail` SSE,
`/api/call/<train>/<action>` for sends).

Supports search (substring on text / fromName / lineName) and sending replies when a
chat filter is active. The compose box derives the train name from the line's
`metro://<station>/` prefix and POSTs to `/api/call/<train>/send`.

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
    _layout.tsx          ← stack navigator (light/dark auto)
    index.tsx            ← Activity feed (SSE tail, search, compose)
    lines.tsx            ← Lines list (claims overview, tap to filter)
    settings.tsx         ← Daemon URL + token + self URI
    event/[id].tsx       ← Event detail (full text + metadata)
  components/
    ActivityHeader.tsx   ← top bar: status, filter / lines / settings actions
    Composer.tsx         ← chat-bound send box, POSTs /api/call/<train>/send
    EventRow.tsx         ← one history entry row (brand-coloured station pill)
    FilterSheet.tsx      ← bottom-sheet kind/station/from/to filter
    FilterSheetParts.tsx ← Section / Chip / StationChip building blocks
    SearchBar.tsx        ← case-insensitive substring search
    StationIcon.tsx      ← two-letter brand-coloured pill
  lib/
    config.ts            ← persisted config (expo-secure-store)
    sse.ts               ← SSE reader + useTail hook + fetchState
    types.ts             ← shapes mirroring packages/metro/src/history.ts
```

Brand colours + glyphs come from `apps/_shared/icons/stations.ts` so the
mobile + web shells stay in sync.

## What's not here

- Push notifications for inbounds — would need the daemon to mint Expo push tokens.
- React / edit — only send is wired into the composer.
- Multi-account / multi-daemon — single config slot today.
- App Store / Play Store builds — Expo Go runnable only.
