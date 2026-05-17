# Metro

Monorepo for **Metro** — an event-interception wire. The daemon supervises train
subprocesses in `~/.metro/trains/`, multiplexes their JSON event streams onto stdout,
and forwards outbound action calls back into the matching train's stdin. Per-platform
code lives in train scripts outside this repo, written on demand by the user or agent.

## Layout

```
packages/
  metro/        # @stage-labs/metro — the daemon + CLI (see packages/metro/README.md)
apps/
  app/          # @stage-labs/metro-app — read-only mobile activity monitor (Expo + RN)
```

## Packages

- [`@stage-labs/metro`](packages/metro/README.md) — install with `npm i -g @stage-labs/metro`. Run `metro` to multiplex train events onto stdout, forward action calls via `metro call <train> <action> <args>`.
- [`@stage-labs/metro-app`](apps/app/README.md) — Expo / React Native companion. View live activity + claimed lines from your phone over the daemon's bearer-token-gated monitor endpoints. Start with `bun --cwd apps/app start`.

The monitor endpoints (`/api/state`, `/api/tail` SSE) are documented in
[`packages/metro/docs/monitor.md`](packages/metro/docs/monitor.md); enable them by setting
`METRO_MONITOR_TOKEN` in `~/.config/metro/.env`. Broker semantics (claims, multi-user
fan-out) are in [`packages/metro/docs/broker.md`](packages/metro/docs/broker.md); the
`metro://` URI scheme is in [`packages/metro/docs/uri-scheme.md`](packages/metro/docs/uri-scheme.md).

## Development

```sh
bun install
bun run build       # turbo run build
bun run test        # turbo run test
bun run typecheck   # turbo run typecheck
bun run lint        # turbo run lint
```

Tasks are orchestrated by [Turbo](https://turbo.build). See `turbo.json` for the pipeline.

## License

[MIT](LICENSE)
