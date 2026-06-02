# Metro Docs

Metro is a local event wire for agents and companion apps. One daemon supervises
train scripts, records every event to an append-only log, exposes claim-aware
read APIs, and routes outbound action calls back to trains. Per-platform code
lives in trains under `~/.metro/trains/`, outside this repo, so stations can
be rewritten without touching core.

## Start Here

- [Architecture](./architecture.md) — daemon, trains, event flow, the broker, routing, monitor APIs.
- [CLI Reference](./cli.md) — every `metro` command, flags (incl. `--json`), exit codes, examples.
- [Multi-Agent Setup](./agents.md) — one daemon + many CLIs, per-CLI identity & feed isolation, multi-account XMTP, the send-guard, HANDOFF coordination.
- [Development](./development.md) — repo layout, scripts, tests, and release guardrails.
- [Operations](./operations.md) — daemon state, tunnels, activation, rollback, and debugging.
- [Clients](./clients.md) — the mobile app, web app, shared packages, and deploy notes.

## Reference (in `packages/metro`)

These live next to the code they describe:

- [Metro package README](../packages/metro/README.md) — install, train protocol, quickstart.
- [Broker semantics](../packages/metro/docs/broker.md) — claims, cursors, fan-out, concurrency.
- [Monitor endpoints](../packages/metro/docs/monitor.md) — `/api/state`, `/api/tail`, `/api/call`.
- [URI scheme](../packages/metro/docs/uri-scheme.md) — the `metro://` line/participant grammar.
- [Train examples](../packages/metro/examples/README.md) — the wire-format reference + a sample train.
- [Agent skill](../packages/metro/skills/metro/SKILL.md) — the runtime skill installed into `~/.claude` / `~/.codex`.

## Conventions

- Docs in `/docs` are the entry point for people and agents. Package docs stay
  close to their code when they describe implementation detail.
- Content here is derived from the actual source — keep it accurate, not
  aspirational. When behavior changes, update the relevant doc.
