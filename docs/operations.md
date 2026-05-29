# Operations

## State Locations

```text
~/.metro/trains/                train scripts
~/.metro/.env                   train credentials
~/.metro/xmtp-accounts.json     XMTP account config (read by the send-guard)
~/.cache/metro/history.jsonl    event log
~/.cache/metro/claims.json      line ownership
~/.cache/metro/cursors/         tail cursors
~/.cache/metro/.tail-lock       dispatcher lock
```

Secrets must stay local. Do not print or transmit private keys through chat,
tool output, docs, or logs.

## Health Checks

```sh
metro doctor
metro trains list
metro history --limit=20
metro tail --since=tail --follow --json
```

Use `metro doctor` first for daemon, train, tunnel, webhook, and skill status.

## Running the Shared Daemon

The target model is one daemon, plain:

```sh
metro
```

Account isolation is done by owner routing and tail filters, not by limiting
which accounts the xmtp train boots.

Do not set `METRO_CODEX_RC` on the shared daemon. Codex attaches its bridge
separately, against the already-running daemon (a bare `metro` with
`METRO_CODEX_RC` set attaches the bridge rather than starting a second daemon).

## Restarting the Daemon

Restarting the shared daemon briefly bounces every attached CLI (Claude Code and
Codex), so only do it after explicit approval. The safe sequence:

1. Build the intended branch.
2. Stop the current daemon once.
3. Start one daemon: `metro`.
4. Re-attach each CLI through its own filtered feed (bare `metro` per session).
5. Verify each account sees only its own XMTP events
   (`metro tail --as=<self> --strict --follow`).

## Rollback

Core changes should be rollback-safe:

- Restore the previous built package or revert the branch.
- Restart the daemon.
- No history or claims migration should be required unless a PR explicitly says so.

## Cloudflare Tunnel

The daemon listens on `127.0.0.1:8420`. Public hostnames such as
`webhook.metro.box`, `monitor.metro.box`, or `bundler.metro.box` are Cloudflare
tunnel routes to local services.

After tunnel or deploy changes, verify with `curl` from outside the app.

## Debugging Duplicates

If one CLI sees another's messages:

1. Check `~/.metro/xmtp-accounts.json` — each account needs the correct `owner` URI.
2. Check whether the daemon was started with stale env such as `METRO_CODEX_RC`.
3. Confirm each tail uses claim-aware filtering (`--strict` where appropriate),
   and that the line is actually claimed (`metro claims`).
4. Avoid cross-account sends while debugging — the XMTP send-guard should already
   refuse them (see [agents.md](./agents.md#send-guard)).
