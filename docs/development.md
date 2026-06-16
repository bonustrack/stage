# Development

## Requirements

- Bun `1.3.x`
- Node `>=22`

Install dependencies from the repo root:

```sh
bun install
```

## Repo Layout

```text
apps/
  api/      small API app
  app/      Expo mobile companion
  ui/       Vue web companion
packages/
  client/   shared client logic
  kit/      shared tokens/icons/theme data
  metro/    daemon, CLI, broker, monitor API
```

## Common Commands

From the repo root:

```sh
bun run build
bun run test
bun run typecheck
bun run lint
```

Package-focused commands:

```sh
bun --cwd packages/metro test
bun --cwd packages/metro typecheck
bun --cwd packages/metro lint
bun --cwd apps/ui build
bun --cwd apps/app typecheck
bun --cwd apps/app lint
```

## Stage Core

Core source lives in `packages/metro/src`:

- `dispatcher/` — HTTP server, webhook receiver, event emission.
- `trains/` — supervisor and train protocol.
- `stations/` — first-party station sources (`xmtp/`, `discord/`, `telegram/`),
  each with `index`/`accounts`/`actions`/`format`/`wire`, plus the shared
  `messaging-normalize.ts` contract adapter.
- `broker/` — claims, history tailing, routing predicates.
- `cli/` — CLI commands (incl. `messaging.ts` for the standardized verbs).
- `codex-rc/` — Codex remote-control bridge.
- `messaging.ts` — the canonical messaging envelope + verb-contract.
- `history.ts`, `lines.ts`, `paths.ts` — state and URI helpers.

Tests live in `packages/metro/test`.

## Clients

The mobile and web clients should stay visually and behaviorally aligned:

- Put pure shared logic in `packages/client`.
- Put shared visual data in `packages/kit`.
- Keep framework rendering in `apps/app` or `apps/ui`.

Do not introduce a shared component abstraction across Vue and React Native.
Share data and contracts instead.

## Release Guardrails

- Do not bump `packages/metro/package.json` version unless explicitly approved.
- Do not publish or deploy from a cleanup branch without approval.
- Do not point the mobile bundler at code requiring new native modules unless the
  matching APK/dev client is installed.
- Verify deployed URLs with `curl` after Netlify or tunnel changes.

## Documentation Policy

Root docs in `/docs` are the entry point for people and agents. Package docs
remain close to their code when they describe implementation details.

When changing behavior:

- Update the relevant root doc.
- Update package docs if a command, API, or protocol changed.
- Update the agent skill only when the runtime workflow changed.
