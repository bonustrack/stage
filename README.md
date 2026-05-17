# Metro

Monorepo for **Metro** — a live JSON stream of Telegram + Discord messages for your local Claude Code / Codex session.

## Layout

```
packages/
  metro/        # @stage-labs/metro — the CLI + daemon (see packages/metro/README.md)
apps/
  app/          # Metro mobile app — read-only activity monitor (Expo + RN, see apps/app/README.md)
```

## Packages

- [`@stage-labs/metro`](packages/metro/README.md) — install with `npm i -g @stage-labs/metro`. Run `metro` to get inbound Telegram + Discord messages on stdout and reply via CLI subcommands.
- [`@stage-labs/metro-app`](apps/app/README.md) — Expo / React Native mobile companion. View live activity + claimed lines from your phone via the daemon's bearer-token-gated monitor endpoints. Run with `bun --cwd apps/app start`.

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

- **Phase 1**: monorepo conversion, no behavior change to the published CLI.
- **Phase 2** (this PR, ref [#36](https://github.com/bonustrack/metro/issues/36)): `apps/app` Expo mobile app + new `/api/state` + `/api/tail` SSE endpoints on the daemon, plus `monitor.metro.box` hostname (cloudflared config note in [`packages/metro/docs/monitor.md`](packages/metro/docs/monitor.md)).
- **Phase 3** (future): replies/reactions from the app, push notifications, multi-account.

## License

[MIT](LICENSE)
