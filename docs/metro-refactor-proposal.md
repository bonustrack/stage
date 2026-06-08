# Metro Refactor: Sessions, Accounts, and a Clean CLI

## 1. Headline

Metro's daemon/protocol core is sound (a single Bun train-supervisor multiplexing newline-JSON over `metro://<station>/<path>` lines, with `history.jsonl` as the source of truth), but the multi-account/multi-session story is held together by convention, and the CLI leaks wire-format detail to agents. Concretely:

- **No first-class "session".** Identity is sniffed from env (`CLAUDECODE` vs `METRO_CODEX_RC`/`CODEX_HOME` in `send-guard.ts`/`tail.ts`), feed isolation rides a hand-pasted `owner` URI in three separate `*-accounts.json` files, and the `to===self` rule in `broker/history-stream.ts:passesMode` is the only thing keeping feeds apart. One typo in `owner` silently leaks or loses a whole feed.
- **No account lifecycle.** There is no `metro account` command. New XMTP accounts are provisioned by hand-editing `xmtp-accounts.json` (currently `0644`, leaking a raw `privateKey` on disk) and the mnemonic at `~/.metro/xmtp-mnemonic`. Derivation uses `mnemonicToAccount(..., {addressIndex:n})` (`stations/xmtp/accounts.ts`), the wrong BIP-44 axis for distinct identities. Accounts load once at train boot — adding one needs a full `trains restart`.
- **CLI footguns + a leaky two-tier surface.** The 7 standard verbs are good, but channel/group/account ops (`setGithub`, `setLabels`, `updateChannelMeta`, `newDm`, `accounts`) are reachable only via hand-built `metro call xmtp <action>` JSON. Bodies starting with `@` are read as files, args are JSON-guessed (`webhook.ts:readArgs`), unquoted backticks get shell-substituted, legacy `metro://xmtp/<conv>` silently misparses to a nonexistent `default` account, and human mode still dumps raw JSON (`messaging.ts:57`).

**Vision:** make **session** a first-class object that binds one account per station; turn account provisioning (generate-from-mnemonic / login-stored / attach) into clean `metro account` and `metro session` verbs; and give agents a uniform, gotcha-free `noun verb target --flags` grammar with a real `--json` envelope. Keep the train-supervisor architecture; this is additive plumbing + a CLI rewrite, not a daemon rewrite.

---

## 2. Architecture: Sessions ↔ Accounts ↔ Stations

Today the binding is one-directional and duplicated: each `*-accounts.json` entry carries its own `owner` URI, and isolation is `metro tail --as <owner> --strict`. We invert it: **the session owns the binding**, accounts stay pure credential stores.

```
~/.metro/sessions.json                 ~/.metro/<station>-accounts.json (credentials only)
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ session "tony"              │        │ xmtp:   tony {derive:1}      │
│  owner metro://session/tony │───┐    │ discord:tony {token}         │
│  accounts:                  │   │    │ telegram:tony {token}        │
│   xmtp=tony discord=tony    │   │    └──────────────────────────────┘
│   telegram=tony web=tony    │   │  owner is DERIVED from the session that
├─────────────────────────────┤   │  references the account (no hand-paste)
│ session "codex"            │   │
│  owner metro://session/codex│   │
│   xmtp=codex ...            │   │
└─────────────────────────────┘   │
                                   ▼
   inbound (xmtp/discord/telegram/webhook) stamps  to = <owning session's owner>
                                   │
                   broker/history-stream.ts passesMode():  to===self  ⇒ deliver
                                   │
        ┌──────────────────────────┴───────────────────────────┐
   session "tony" feed                              session "codex" feed
   metro tail --session tony --strict              metro tail --session codex --strict
   (cursor key = slug(metro://session/tony))       (own cursor file, no trampling)
```

Key points, grounded in current code:

- **One binding layer, two credential stores stay as-is.** New `src/stations/sessions.ts` loads `sessions.json`. `account-store.ts` (`makeAccountStore`) keeps reading per-station credential files unchanged. The session layer computes each account's effective `owner` (`metro://session/<id>`) instead of duplicating it across three files. Migration keeps reading the per-account `owner` if `sessions.json` is absent.
- **Feed isolation is unchanged at the core.** We reuse the exact `to===self` short-circuit (`history-stream.ts:passesMode` L110) and per-`(mode,self)` cursor files (`cursorKey`). A session is one `self` (`metro://session/<id>`). Parallel sessions = parallel `--strict` readers with independent cursors — already supported, just keyed off a stable session URI instead of an env-sniffed claude/codex URI.
- **Outbound `from` becomes per-account.** Today outbound stamps the global `METRO_SELF_URI` (`metro://user` on a neutral daemon). Change each station's `emitOutbound` (e.g. `xmtp/emit.ts`) to stamp `from = owner-of-sending-account`. Then a session's `--strict` tail naturally drops its own echoes (combine with default `excludeFrom=[self]` under `--strict`), fixing the manual `--exclude-from` requirement.
- **In-daemon fan-out generalizes the Codex bridge.** `dispatcher/server.ts:makeEmit` already pushes to the Codex RC bridge only events that `passesMode(...,'mine-only',codexSelf,...)`. Generalize to an N-session router: for each registered session sink, push events passing `passesMode(...,'mine-only',session.owner,...)`. Same proven predicate; lets the daemon drive many agent sessions without each spawning a `metro tail`.
- **Process model unchanged by default.** Still one train process per file in `~/.metro/trains/*`, each booting all its accounts. "Parallel sessions" stays *logical* isolation over one `history.jsonl`. Escape hatch for true process isolation: a per-session train file (`xmtp-<session>.ts`) setting `XMTP_ONLY_ACCOUNTS=<id>` + `METRO_SESSION=<id>` — the allowlist env already exists in `account-store.ts`.
- **Webhooks join the model.** Extend the endpoint config (`tunnel.ts`) with optional `session`/`owner`; in `dispatcher/server.ts:handleRequest` stamp `to=<owner>` instead of `to=line` when set. Then `/wh/tony-gh` lands in tony's `--strict` feed like a chat message.
- **`accountId` aliases `inboxId`, not the key** (XMTP/XIP-46 alignment). `bootAccount` already has `client.inboxId`; persist an `id→inboxId` map so rotating/adding a wallet to an inbox doesn't change the routing key. `derive` vs `privateKey` becomes a pure key-source detail.

---

## 3. Account & Agent Lifecycle

### Identity model: one derived key = one unified agent

The mnemonic is **the agent's wallet seed, not just an XMTP secret**. Deriving index `N` produces one ethereum key that *is* the agent's wallet; the XMTP account is created **from that same key** (the XMTP identity/inbox is signed into existence by the wallet). So there is no separate "XMTP key" vs "wallet key" — one derived key yields one unified agent identity: an ethereum wallet **plus** the XMTP account bound to it.

Consequences:
- **"Create an agent" = derive the next mnemonic index → that wallet → its bound XMTP account → attach to a session.** This is the high-level, everyday operation, surfaced as `metro agent new`.
- `metro account` stays as the **lower-level primitive**: it manages a single credential entry for a single station (derive/import/list/remove). `metro agent new` composes it (derive the wallet key, create the XMTP account from it, optionally other stations, create + bind a session) so callers never wire the pieces by hand.
- The derived ETH address is the agent's fundable/shareable wallet address **and** the address that owns its XMTP inbox — same address, one identity to fund, recover, and reason about.

### Storage & security
- `~/.metro/sessions.json` — binding (no secrets), `0600`.
- `~/.metro/<station>-accounts.json` — credentials. **Enforce `0600` on every write** (fixes the current `0644` on `xmtp-accounts.json` that exposes tony's raw key). `mkdir ~/.metro 0700`.
- `~/.metro/xmtp-mnemonic` — single BIP39 mnemonic; despite the name it is **the agent-wallet seed**, `0600`, never overwritten once present. Every derived agent's wallet (and the XMTP account created from that wallet) comes from it; it is the only on-disk secret for derived agents.
- **HD path fix:** new derived agents use the BIP-44 *account* level `m/44'/60'/<n>'/0/0` (the correct axis for independent wallet identities). The key at index `N` is the agent's wallet; its XMTP account is signed in from that key. Already-provisioned accounts keep `addressIndex` derivation behind a per-account `deriveLegacy:true` flag, because their MLS db3 + on-network XMTP associations are bound to the old key. Index 0 stays reserved for the daemon wallet. Record the `index→agent` assignment in `sessions.json` (wallet + XMTP recovery depends on it).

### The flows + exact commands

**Create an agent (the everyday verb — derive next index → wallet + bound XMTP account → session):**
```
metro agent new agent3 [--also-discord tony]
```
Picks the next free index = `max(existing derive)+1`, derives the wallet key at `m/44'/60'/<n>'/0/0`, creates the XMTP account **from that same key**, appends `{id:"agent3", derive:<n>}` to `xmtp-accounts.json` at `0600`, writes a `sessions.json` entry binding `xmtp=agent3` (plus any `--also-<station>`), and prints the agent's ETH wallet address (to fund/share — it owns both the wallet and the XMTP inbox). No raw key ever hits disk. Refuses to overwrite an existing id. Then triggers `trains restart xmtp` (or hot-attach, below). Internally this composes the `metro account new xmtp` + `metro session new` primitives below.

**Lower-level: provision a single XMTP credential (derive index N for one station only):**
```
metro account new xmtp --name agent3 [--session agent3 --create-session]
```
The primitive `metro agent new` builds on: reads `xmtp-accounts.json`, picks next free index, appends `{id:"agent3", derive:<n>}` at `0600`, prints the derived wallet/XMTP address. With `--create-session` it also writes a `sessions.json` entry and binds `xmtp=agent3`. Use `metro agent new` instead unless you specifically need to manage one station's credential in isolation.

**Login with a stored/existing account:**
```
metro account import xmtp --name tony --key -        # reads 0x key from stdin
metro account import discord --name tony --token -    # token station: import only
```
Stdin (`-`) keeps secrets out of shell history; writes `0600`. `discord`/`telegram` support only `import`/`list`/`remove` (derivation is meaningless for token stations).

**Attach an account to a session:**
```
metro session new agent3 --xmtp agent3 --discord tony
metro session bind agent3 --telegram tony
metro session owner agent3        # prints metro://session/agent3 for --as / tooling
```

**Inspect / manage:**
```
metro account list [--station xmtp] [--json]   # id, station, source(raw|derive:n|token), address; never secrets
metro account address agent3                    # replaces ad-hoc ~/.metro/codexkey.mjs
metro account remove agent3 [--purge-db]        # also deletes xmtp-<env>-agent3.db3
metro mnemonic init                             # generate BIP39 only if absent
```

**Hot-attach (stretch, avoids dropping XMTP streams):** add a train action `metro call xmtp account.add <json>` calling the existing `bootAccount(cfg)` at runtime (it already writes into the in-memory `accounts` Map) + persist to the registry, guarded against duplicate ids. Default path stays the simple `trains restart`.

---

## 4. New CLI API

**Grammar:** `metro <noun> <verb> <target> [--flags]`. Messaging stays sugared as top-level verbs (the hot path); everything accepts the same global flags: `--session/-s <id>`, `--account/-a <id>`, `--json`, `--quiet`, `--raw '{...}'`.

### Identity, agents & sessions
```
metro agent new agent3 [--also-discord tony]    # everyday verb: derive wallet + XMTP from one key, bind a session
metro agent list                                # agents = sessions with their wallet/XMTP address
metro whoami                 # session, owner URI, wallet+account-per-station, --strict cmd to use
metro session list
metro tail --session tony --strict --follow     # replaces --as metro://claude/user/<uuid>
```
`metro agent new` is the composed high-level verb (one derived key → wallet + bound XMTP account → session); `metro account`/`metro session` (below) are the primitives it builds on.
`whoami` kills the "which account am I / what's my `--as` URI" gap (today you read `xmtp-accounts.json` by hand).

### Messaging (sugared, account-aware)
```
metro send -a tony <conv> 'ship it'             # -a builds the account segment; no URL templating
metro reply <line> 'on it' --quiet              # prints only the message id
metro react <line> 👀 [--remove] [--ref <inboxId>]   # one verb; --remove replaces "unreact"
metro read <line> --full                        # no 60-char truncation
```

### Channel / group / dm promoted to real verbs (no more raw `metro call xmtp`)
```
metro channel set-github <line> https://github.com/snapshot-labs/sx#88
metro channel set-labels <line> --label in-review --label bug
metro channel meta <line> --name "fix: nav" --desc "..."
metro group new --request ... | metro group close <line>
metro dm xmtp 0x2539…79d5 'hi'
```
Thin generated wrappers over the existing `updateChannelMeta`/`setLabels`/`setGithub`/`newDm` actions (`stations/xmtp/actions*.ts`) — trains stay authoritative, agents stop hand-building JSON.

### Discovery + escape hatch
```
metro verbs xmtp [--json]        # dumps each train's actions + arg schema (via daemon, not error-string scraping)
metro call xmtp updateChannelMeta --args-json '{...}'   # strict: no bare-string guessing
metro call xmtp <bad> --json  →  {ok:false,error,valid_actions:[...]}   # self-correctable
```

### Output contract (uniform)
- Human mode: one-line summary for *every* command (`ok xmtp msg <id>`) — fixes `messaging.ts:57`/`webhook.ts:99` dumping JSON in human mode.
- `--json`: uniform envelope `{ok, command, result|error, code}` for all commands.
- `--quiet`: id only.
- `--dry-run --json`: returns the exact envelope+route that *would* forward (runs `enforceSendGuard` + line validation) so agents validate identity/account before sending.

### Gotcha fixes (all from MEMORY + audit)
- **`@`-path:** bare positional is **always a literal string**. Text from a file goes through `--body-file <path>` / `--body-stdin`. Remove the implicit `@`-read in `messaging.ts:resolveText` and `webhook.ts:readArgs`.
- **Backticks:** warn when a send body contains an unescaped backtick (likely shell-substituted) before sending; document `--body-stdin` as the safe path.
- **JSON-guess:** `metro call` takes only `--args-json`/`--args-file`/`--args-stdin`; drop the `try JSON.parse else string` heuristic.
- **Account-line confusion:** at the CLI boundary, reject legacy single-segment `metro://xmtp/<conv>` with an actionable error (`xmtp lines must be metro://xmtp/<account>/<conv> — try -a tony`) listing configured accounts, instead of forwarding a `default` that 500s.
- **Wrong-transport:** `metro call` rejects when an envelope `line`'s station != train.
- **Discord line-parse:** rename the discord train's stdin frame variable off `line` (`discord/index.ts:28` collides with the `metro://` line concept) and switch all three core stations to a tolerant NDJSON reader that returns a structured `op:response` error on a bad frame instead of dying to stderr.
- **`--since` triple meaning:** split into `metro tail --cursor <offset|tail|resume>`, `metro history --since <iso-date>`, and make SSE `/api/tail` match `--cursor` (it already emits SSE `id:`, so make it resumable via Last-Event-ID). Keep `--since` as a deprecated warning alias on tail.

### Send-guard generalization
`enforceSendGuard` (`cli/send-guard.ts`) currently is XMTP-only, knows only claude/codex, re-parses lines a third time, and fails open. Rework: resolve caller from `METRO_SESSION` (fallback to env sniffing), resolve target-account owner via `sessions.json`/per-station owners for **any** station, reject when caller session ≠ owning session. Import the single typed `Line` parser (below) instead of re-implementing.

---

## 5. Migration (small PRs, daemon stays up)

The trains are symlinks into the working tree, so every PR is live on the served branch — strict serialization, additive-only, one reconciliation pass (per MEMORY: no concurrent served-main writers).

1. **PR1 — typed `Line`.** One parser/serializer in `lines.ts` understanding the optional account segment; have `xmtp/accounts.ts:parseLine` and `send-guard.ts:targetAccount` import it. Pure refactor, no behavior change — kills the 3-way drift. Ship + verify served worktree.
2. **PR2 — file perms + `metro account list/address/import`.** Read-only + import over existing JSON; chmod everything `0600`; `metro doctor` flags non-`0600` files and raw-key-when-mnemonic-exists. No routing change. (Quietly fixes the live `0644` leak.)
3. **PR3 — `sessions.json` + `sessions.ts`, read path only.** Loader derives `owner` from sessions; if `sessions.json` absent, fall back to per-account `owner` (today's behavior). `metro whoami`/`metro session list`/`metro tail --session`. Nothing breaks because the fallback is the current code path.
4. **PR4 — `metro account new` (derive) + `metro agent new` (compose: wallet + XMTP from one derived key + session) + mnemonic init**, new agents use `m/44'/60'/<n>'/0/0` for the wallet key and create the XMTP account from it; existing accounts pinned `deriveLegacy:true` (no key change to live tony/codex). Triggers `trains restart`.
5. **PR5 — per-account outbound `from`** + default `excludeFrom=[self]` under `--strict`. Behind `METRO_PER_ACCOUNT_FROM=1` first, flip default after a day of dogfooding.
6. **PR6 — promote verbs** (`channel`/`group`/`dm`) + uniform output + `--json` envelope + arg-source flags (`--body-file`/`--args-json`) with the old `@`/JSON-guess behavior behind a deprecation warning for one release.
7. **PR7 — generalize send-guard** to all stations via sessions; **PR8 — webhook owner/session**; **PR9 — N-session in-daemon fan-out** (generalize Codex bridge); **PR10 — discord NDJSON reader rename**; **PR11 — `--since`/`--cursor` split**.
8. **Cleanup (separate, low-risk):** move ~30 `*.bak` snapshots out of `~/.metro/trains/`, add a `trains.json` manifest of active vs archived, and a `metro doctor` check that symlink targets match the expected worktree (catches the stale-served-worktree trap).

Time-box and delete `LEGACY_DEFAULT_LINES` only after a one-shot migration rewrites stored `metro://xmtp/<conv>` claims/lines to `metro://xmtp/default/<conv>` — not in the first wave.

---

## 6. Risks & Open Questions for Less

1. **HD path change is identity-bearing — and it's the agent's wallet.** Since the derived key is the agent's wallet (with its XMTP account created from it), switching to `m/44'/60'/<n>'/0/0` means *new* agents get different wallet addresses than the old `addressIndex` scheme would have. Live tony/codex stay legacy-pinned. OK to adopt the BIP-44-correct path for new agents going forward, or do you want everything on one scheme even if it means re-provisioning wallets + XMTP inboxes?
2. **Session = process or logical?** Default plan keeps logical isolation over one shared daemon (cheap, hot-reload-friendly). True per-session processes are an opt-in escape hatch. Is logical isolation enough for the parallel-agent use you have in mind, or do you want hard process boundaries by default?
3. **`owner` source of truth.** Moving `owner` derivation into `sessions.json` means the per-account `owner` fields become legacy/fallback. Fine to deprecate them, or keep both writable?
4. **Hot-attach vs restart.** `metro account new` via `trains restart xmtp` briefly drops all XMTP streams for that train. Worth building the `account.add` hot-boot action now, or is a ~few-second restart acceptable for provisioning?
5. **Breaking the `@`/JSON-guess behavior.** Any of your existing scripts/skills rely on `metro send <line> @file` reading a file, or on `metro call` JSON-guessing a bare arg? If so I keep the deprecation shim longer.
6. **`accountId → inboxId` aliasing** is the right long-term XMTP model but adds an indirection layer. Do it now while refactoring, or defer until XMTP multi-wallet (XIP-46) actually bites?
7. **Mnemonic on disk.** Should the daemon support `XMTP_MNEMONIC` from env / OS keychain so the mnemonic never sits on disk, or is `0600 ~/.metro/xmtp-mnemonic` acceptable for now?
8. **No version bumps:** none of this touches `packages/metro/package.json` (npm-publish trigger) — confirm you want it kept that way through the whole series.
