# Stage

Monorepo for **Stage** — an event-interception wire. The daemon supervises train
subprocesses in `~/.metro/trains/`, multiplexes their JSON event streams onto stdout,
and forwards outbound action calls back into the matching train's stdin. Per-platform
code lives in train scripts outside this repo, written on demand by the user or agent.

## Layout

```
packages/
  metro/        # @metro-labs/metro — the daemon + CLI (see packages/metro/README.md)
  client/       # framework-neutral client logic shared by mobile + web
  kit/          # design tokens, icon data, theme contracts
apps/
  app/          # app — mobile activity monitor + composer (Expo + RN)
  ui/           # ui — web activity monitor + composer (Vue 3 + Vite)
```

## Packages

- [`@metro-labs/metro`](packages/metro/README.md) — install with `npm i -g @metro-labs/metro`. Run `metro` to multiplex train events onto stdout, act on conversations with the standardized verbs (`metro send`/`reply`/`react`/`unreact`/`edit`/`delete`/`read`, routed by the line's station), or use the low-level `metro call <train> <action> <args>` / `POST /api/call/<train>/<action>` escape hatch.
- [`app`](apps/app/README.md) — Expo / React Native companion. View live activity, filter lines, send replies from your phone via the daemon's bearer-token-gated monitor endpoints. Start with `bun --cwd apps/app start`.
- [`ui`](apps/ui/README.md) — Vue 3 web companion with the same surface. `bun --cwd apps/ui dev` opens the dev server on `localhost:5173`; `bun --cwd apps/ui build` emits a static bundle in `apps/ui/dist/`.
- [`@stage-labs/client`](packages/client/README.md) — pure shared logic for client apps.
- [`@stage-labs/kit`](packages/kit/README.md) — shared visual tokens, icon data, and theme contracts.

The monitor endpoints (`/api/state`, `/api/tail` SSE, `/api/call/<train>/<action>`) are documented in
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
