# Metro

Monorepo for **Metro** — an event-interception wire. The daemon supervises train
subprocesses in `~/.metro/trains/`, multiplexes their JSON event streams onto stdout,
and forwards outbound action calls back into the matching train's stdin. Per-platform
code lives in train scripts outside this repo, written on demand by the user or agent.

## Layout

```
packages/
  metro/        # @metro-labs/metro — the daemon + CLI (see packages/metro/README.md)
  client/       # @metro-labs/client — framework-agnostic shared logic for the clients
  kit/          # @metro-labs/kit — shared design-system primitives (tokens, station icons)
apps/
  app/          # app — mobile activity monitor + composer (Expo + RN)
  ui/           # ui — web activity monitor + composer (Vue 3 + Vite)
  api/          # api — daemon-backed HTTP API (api.metro.box; e.g. website "Ask a question")
```

## Packages

- [`@metro-labs/metro`](packages/metro/README.md) — install with `npm i -g @metro-labs/metro`. Run `metro` to multiplex train events onto stdout, forward action calls via `metro call <train> <action> <args>` or `POST /api/call/<train>/<action>`.
- [`app`](apps/app/README.md) — Expo / React Native companion. View live activity, filter lines, send replies from your phone via the daemon's bearer-token-gated monitor endpoints. Start with `bun --cwd apps/app start`.
- `ui` — Vue 3 web companion with the same surface. `bun --cwd apps/ui dev` opens the dev server on `localhost:5173`; `bun --cwd apps/ui build` emits a static bundle in `apps/ui/dist/`.

The monitor endpoints (`/api/state`, `/api/tail` SSE, `/api/call/<train>/<action>`)
are documented in
[`packages/metro/docs/monitor.md`](packages/metro/docs/monitor.md); enable them by
setting `METRO_MONITOR_TOKEN` in `~/.config/metro/.env`. Broker semantics (claims,
multi-user fan-out) are in
[`packages/metro/docs/broker.md`](packages/metro/docs/broker.md); the `metro://` URI
scheme is in
[`packages/metro/docs/uri-scheme.md`](packages/metro/docs/uri-scheme.md).

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
