# Multi-Agent Setup

Metro is designed to be driven by autonomous coding agents (Claude Code, Codex)
that watch the event stream and reply via `metro call`. One daemon can serve
several agents at once, each with its own routed feed and its own chat identity.

## One daemon, many readers

The dispatcher is single-instance (it holds a lockfile). A second `metro`
invocation does not start a competing daemon — it attaches to the running one:

- **Claude Code** — a bare `metro` (when a daemon is already up) drops into
  claim-aware tail mode (`--follow --json --since=tail`), so the session receives
  only its own routed feed.
- **Codex** — when `$METRO_CODEX_RC` is set, `metro` attaches the standalone Codex
  bridge to the existing daemon. Metro pushes each event to the Codex app-server
  over JSON-RPC (`turn/start`). The user must run a Codex daemon + TUI on the same
  WebSocket URL, e.g. `codex app-server --listen ws://127.0.0.1:8421` plus
  `codex --remote ws://127.0.0.1:8421`.

Subscribers never register with the daemon. The broker semantics emerge entirely
from each reader's tail filter plus the shared `claims.json`. See
[broker semantics](../packages/metro/docs/broker.md).

## Per-CLI identity

Each CLI session resolves a stable `self` identity, used as the `to` field on
inbound events and as `from` on outbound ones:

| Session      | Detected via                       | Identity URI                                  |
|--------------|------------------------------------|-----------------------------------------------|
| Claude Code  | `$CLAUDECODE`                      | `metro://claude/user/<orgId>`                 |
| Codex        | `$METRO_CODEX_RC` or `$CODEX_HOME` | `metro://codex/user/<accountId>`              |
| Neither      | —                                  | `metro://user` (generic)                      |

`<orgId>` is the Anthropic-account UUID (`claude auth status --json`); `<accountId>`
is the ChatGPT-account UUID (`tokens.account_id` in `$CODEX_HOME/auth.json`, requires
`auth_mode=chatgpt`). The same account on any machine yields the same URI. The
long-lived daemon re-resolves within ~5 s of an account switch (5 s TTL cache).
Override with `METRO_USER_ID` / `METRO_USER_SESSION_ID`, or `--from=<uri>` /
`$METRO_FROM` for writes. Full detail in the
[URI scheme](../packages/metro/docs/uri-scheme.md#participants).

## Per-CLI feed isolation

Routing is purely log-based — one append-only `history.jsonl`, a flat `claims.json`,
and a per-reader cursor. The delivery rule is:

> An event reaches a reader (in the default `mine-or-unclaimed` mode) when its
> `line` is **claimed by that reader** *or* **claimed by no one** — except
> webhooks, which are excluded from personal feeds unless `--include-webhooks` is set.

Direct messages (`event.to == reader's user line`) always pass, regardless of
claims. Claiming is explicit: `metro claim <line>` takes a line so it stops
fanning out to other personal feeds, and `metro release <line>` returns it to
broadcast. There is no auto-claim on outbound — an agent that wants exclusive
handling of a conversation claims it. See
[broker semantics](../packages/metro/docs/broker.md).

## Multi-account XMTP

The `xmtp` train can hold several accounts (e.g. one per agent), configured in
`~/.metro/xmtp-accounts.json`. Each account entry carries an `owner` URI:

```jsonc
[
  { "id": "tony",  "owner": "metro://claude/user/<orgId>" },
  { "id": "codex", "owner": "metro://codex/user/<accountId>" }
]
```

XMTP lines name the account: `metro://xmtp/<account>/<conversation>` (legacy
single-segment lines map to the `default` account). A send goes out under whatever
account the line names, which is why identity must be enforced.

### Send-guard

Because one daemon serves several CLIs, a `metro call xmtp send` could send under
the wrong identity. The send-guard ([`src/cli/send-guard.ts`](../packages/metro/src/cli/send-guard.ts))
prevents this. It applies only to the `xmtp` train and only to identity-bearing
actions (`send`, `reply`, `react`, `sendAttachment`, `newDm`, `newGroup`).

It **refuses** (exit code `4`) only when the caller's station and the target
account's owner are both known and they conflict. When ownership can't be
unambiguously attributed (human operator, account with no owner), it allows — a
false reject that blocks a legitimate send is considered worse than a rare bypass.
`METRO_ALLOW_CROSS_ACCOUNT=1` is the explicit escape hatch. Read-only XMTP actions
(`accounts`, `query`, `listConvs`, `groupInfo`, `*-push`) are never guarded.

## HANDOFF coordination

When multiple agents share one machine, coordinate through a shared local file
rather than sending from another agent's chat account. In the Metro project this is:

```text
/tmp/metro-agents/HANDOFF.md
```

Each agent should:

- Read it before starting shared Metro work.
- Add a claim describing what it is doing.
- Avoid touching another agent's claimed task.
- Record decisions that affect daemon state, releases, or user-facing behavior.

If a cross-agent handoff is needed, use the shared filesystem or ask the user to
route the message — do not send from another agent's account-scoped line.

## Operating rules for agents

- Reply on the exact inbound `line` unless the user asks for a different destination.
- Keep chat replies short; mobile is the primary reading surface.
- Acknowledge quickly before long work; silence reads as ignored.
- Send XMTP only from your own account; rely on the send-guard, don't fight it.
- Do not restart the shared daemon without explicit approval (it bounces every
  attached agent).
- Do not bump `packages/metro/package.json` (it triggers an npm publish) without
  explicit approval.
- Verify XMTP and deployment facts from source or logs before asserting them.

See [operations](./operations.md) for daemon lifecycle and
[development](./development.md) for repo conventions.
