# Metro CLI Command Reference

Companion to [metro-cli-architecture.md](./metro-cli-architecture.md). Themed
concept names map to the plain tokens below (see the naming table there).

## Grammar and Globals

GRAMMAR: `metro <noun> <verb> <target> [--flags]`. High-frequency messaging
verbs are ALSO top-level sugar AND exist under their noun. NO prefix-matching.
A bare positional is ALWAYS a literal string, never a path, never auto-JSON.

GLOBAL FLAGS (every command): `--json` | `-q/--quiet` | `--dry-run` |
`-a/--account <id>` | `--session <id>` | `--idempotency-key <k>` (a ride
ticket) | `--yes` | `--no-color` | `--no-input` | `-h/--help`.

ENV: `METRO_OUTPUT={json,quiet,human}`, `METRO_SESSION`, `NO_COLOR`.

PRECEDENCE: flag > `METRO_*` env > cwd/.env > `~/.metro/.env` > built-in
default (surfaced in `metro doctor`).

OUTPUT RESOLUTION: flag > `METRO_OUTPUT` env > TTY-detect (human default; never
auto-JSON on a pipe). `NO_COLOR`/non-TTY drop color + spinners only.

EXIT CODES: `0` ok / `1` usage-bad-args / `2` config-missing-creds / `3`
upstream-train-rejected / `4` daemon-not-running / `5` not-found
(line/msg/train) / `6` timeout / `7` rate-limited (script backs off to
Telegram fallback).

ENVELOPE:

- success: `{"ok":true,"command":"send","result":{...}}`
- error: `{"ok":false,"command":"send","error":{"code":"RATE_LIMITED",
  "message":"...","hint":"back off to telegram","retryable":true},
  "exitCode":7}`
- `error.code` stable enum: `UNKNOWN_VERB | BAD_ARGS | NOT_CONFIGURED |
  NOT_FOUND | RATE_LIMITED | UPSTREAM_TIMEOUT | DAEMON_DOWN | STATION_DOWN`.
  Human-mode errors route through the same struct (pretty-printed).

## Accounts (the pass; add-only; secrets never in argv)

```
metro account list [--station xmtp] [--json]
   # columns: id | address | source(derive:<i>|imported|env) | owner | active?
metro account new <id> [--station xmtp] [--restart]
   # derive next free HD index off ~/.metro/xmtp-mnemonic (MetaMask "Add account");
   # prints ETH ADDRESS, never the key; --new-mnemonic to generate a 0600 seed
metro account derive <id> --index <n> [--station xmtp] [--restart]
metro account import <id> [--station xmtp] --stdin
   # raw 0x64 key OR BIP-39 phrase via stdin/TTY ONLY; tagged "imported";
   # REFUSES a secret passed as a positional/flag value with a clear hint
metro account address <id>
metro account use <id> [--station xmtp]      # set persisted default identity
metro account remove <id> [--purge-db]       # never touches mnemonic
```

Examples:

```
echo '0xabc...' | metro account import hot --stdin     # raw key, tagged imported
metro account new researcher --restart                 # derive + boot in a few s
metro account list --json
```

## Agents (the rider; wallet + xmtp account + session in one shot)

```
metro agent new <id> [--owner <user-uri>] [--restart]
   # derive wallet key -> create xmtp account from same key -> write session
   #   binding (owner = metro://session/<id>) -> print ETH address
metro agent list [--json]
```

## Sessions (the trip; logical bindings, no processes)

```
metro session list [--json]              # id, owner, account-per-station
metro session new <id>
metro session bind <id> --station xmtp --account <acctId>
metro session owner <id>                  # prints metro://session/<id>
metro whoami [--json]
   # current session, owner URI, account-per-station, AND the exact
   #   `metro tail --strict --account <id>` command to subscribe
```

## Messaging (sugar; plumbing equivalent is `metro call`; idempotent on ticket)

```
metro send <line> --text "gm"             # bare positional also literal
metro send <line> -                        # body from stdin: URLs/tokens VERBATIM
metro send <line> --text "x" --idempotency-key <k> --dry-run
metro send <line> --text "x" --attach ./a.png --attach https://x/b.png
metro reply <line> <msgId> --text "on it"
metro react <line> <msgId> 👀   /   metro unreact <line> <msgId> 👀
metro edit  <line> <msgId> --text "fixed"   /   metro delete <line> <msgId>
```

Notes: `-q` prints only the new message id. `--dry-run --json` returns
`{ok,command:"send",dryRun:true,result:{line,station,resolvedText,attachments}}`
after running send-guard + line validation, mutating nothing. Body via
`--text`/stdin only fixes the `@`-path and backtick-substitution footguns.

## Channels / Groups / DMs (lines; promoted from hand-built JSON)

```
metro channel list [--json] [--account X]   /   metro channel get <line> [--json]
metro channel set-github <line> --repo org/name --pr 123
metro channel set-labels <line> --labels in-review,p1
metro channel meta <line> --title "..." --status "👀 In review"
metro group new --name "..." --member 0xabc --member 0xdef [--account X]
metro dm new --to 0xabc [--account X]
```

## Tail / History (the board; NDJSON; FULL untruncated text in --json)

```
metro tail [--follow] [--json] [--account X] [--station xmtp]
           [--strict|--unclaimed|--all] [--cursor tail|resume|<offset>]
metro history <line> [--json] [--limit 50] [--since <iso>] [--from <uri>] [--text <q>]
metro claim <line> --as <session>   /   metro release <line>   /   metro claims [--json]
```

Stable per-line event schema:

```
{"ts":<ms>,"station":"xmtp","line":"metro://...","from":"...","to":"...",
 "kind":"message|react|edit|delete|webhook","id":"...","text":"...","offset":<n>}
```

Truncation is human-view only; `--json` is never truncated. `--cursor resume`
gives deterministic restart after a daemon bounce. The overloaded `--since` is
split: `tail --cursor <offset|tail|resume>`, `history --since <iso>`; SSE
`/api/tail` resumable via `Last-Event-ID`. Optional alias: `metro board` ->
`metro tail`.

## Trains / Stations (infra; health-aware)

```
metro daemon status [--json]   /   metro daemon restart [<station>]
metro train list [--json]   /   metro train restart <name>   /   metro train new <name>
metro station status [<name>] [--json]
   # bundler/tunnel/daemon health + XMTP rate-limit budget (20k reads/3k
   #   writes per 5min); warns BEFORE an outage
metro webhook add <label> --secret-stdin / list / remove <id>
metro tunnel status / metro tunnel setup <name> <hostname>
```

## Discovery / Meta / Escape hatch

```
metro schema [<station>] [--json]   # the timetable: name, JSON-Schema input,
                                    #   read/mutate tag, example per verb
metro verbs <station> [--json]      # that train's per-verb arg schemas
metro doctor [--json]               # health + config precedence + 0600 perm
                                    #   check + stale-served-worktree symlink
                                    #   check + *.bak manifest
metro mcp serve                     # thin MCP adapter over the registry (later)
metro call <station> <verb> --args-json '{...}' | --args-file f.json | --args-stdin
   # clean plumbing only: NO bare-arg JSON-guess, NO @file path-reading
metro --version | metro --help | metro <noun> --help
```
