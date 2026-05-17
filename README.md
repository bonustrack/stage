# Metro

Monorepo for **Metro** — a live JSON stream of Telegram + Discord messages for your local Claude Code / Codex session.

## Layout

```
packages/
  metro/              # @stage-labs/metro — Client SDK + daemon + CLI
  _station-template/  # copy-this skeleton for a new station
  discord-station/    # Discord — gateway via discord.js, REST outbound
  telegram-station/   # Telegram — raw fetch Bot API, long-poll
  webhook-station/    # HTTP receive endpoints (GitHub, Intercom, …) + monitor SSE
  claude-station/     # Local Claude Code identity + cross-user notify
  codex-station/      # Local Codex identity + cross-user notify
apps/
  app/                # Metro mobile app (read-only activity monitor; Expo + RN)
```

## Packages

- [`@stage-labs/metro`](packages/metro/README.md) — Client SDK + CLI + daemon.
  Install with `npm i -g @stage-labs/metro` once published; run `metro` to get
  inbound JSON envelopes on stdout. Outbound goes through one generic verb:
  `metro <station> <action> <args.json|@file|->`.
- `packages/*-station/` — one workspace package per integration. Each exports
  a `Station` (`name`, `configured()`, `start(emit)`, `stop()`, `actions`).
  The Client discovers them automatically.
- [`@stage-labs/metro-app`](apps/app/README.md) — Expo / React Native mobile
  companion. View live activity + claimed lines via the daemon's bearer-token-
  gated monitor endpoints. Run with `bun --cwd apps/app start`.

The daemon's monitor endpoints (`/api/state`, `/api/tail`) are spec'd in
[`packages/metro/docs/monitor.md`](packages/metro/docs/monitor.md) — set
`METRO_MONITOR_TOKEN` in `~/.config/metro/.env` to enable them.

## Development

```sh
bun install
bun run build       # turbo run build
bun run test        # turbo run test
bun run typecheck   # turbo run typecheck
bun run lint        # turbo run lint
```

Tasks are orchestrated by [Turbo](https://turbo.build). See `turbo.json` for the pipeline.

## Roadmap

- **Phase 1**: monorepo conversion (no behavior change to the published CLI).
- **Phase 2**: `apps/app` Expo mobile app + `/api/state` + `/api/tail` SSE endpoints on the daemon.
- **Phase 3**: package-per-station rewrite (each integration in its own workspace package; SDK Client; generic `metro <station> <action>` dispatch).
- **Future**: replies/reactions from the app, push notifications, multi-account; gmail-station, github-station, linear-station, notion-station.

## License

[MIT](LICENSE)
