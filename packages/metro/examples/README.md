# Example trains

Two starting points, not runtime code:

- **`echo.ts`** — built on the `defineTrain` SDK (`@metro-labs/metro/define-train`).
  ~50 lines: the SDK owns the stdio op:call→op:response protocol, the
  inbound/outbound envelope shape, account boot, and self-echo, so you write only
  `parseLine` + `onInbound` + `actions`. Self-contained (no external service) so
  it runs as-is. **Prefer this shape for new trains.**
- **`telegram.ts`** — the hand-rolled equivalent (no SDK), kept as a from-scratch
  reference showing the raw protocol.

Copy either to `~/.metro/trains/<name>.ts`, edit, save (the daemon hot-reloads
the changed train automatically — see Lifecycle), or restart the daemon:

```
cp telegram.ts ~/.metro/trains/telegram.ts
echo 'TELEGRAM_BOT_TOKEN=…' >> ~/.metro/.env
metro
```

For a Discord port: swap the API base + auth header (`Bot $TOKEN`), install
`discord.js` for the gateway, and emit the same envelope shape — the
stdin/stdout protocol below is platform-independent. Action names and payload
shapes are entirely up to you.

## Protocol (JSON lines over stdio)

```
metro  ─── stdin (one JSON line per action call) ──>  train
       <── stdout (one JSON line per event OR response) ── train
```

- **Inbound event** (train → metro): `{ station?, line, line_name?, from?, from_name?, to?, message_id?, reply_to?, is_private?, text?, emoji?, payload?, ts?, id? }` — snake_case on the wire; `line` (string) is the only required field. There is no `kind` field — direction is derived from `from` (`Line.isLocal` ⇒ outbound). Metro mints `id` + `display` if absent and translates to camelCase for `history.jsonl` / the broker (`HistoryEntry` in `src/history.ts`).
- **Call** (metro → train): `{ "op": "call", "id": "req_abc", "action": "send", "args": {...} }`.
- **Response** (train → metro): `{ "op": "response", "id": "req_abc", "result": {...} }` or `{ ..., "error": "..." }`.

Anything on stdout without an `op` is treated as an inbound event.

## Lifecycle

Metro scans `~/.metro/trains/*.{ts,js,mjs}` at boot — one subprocess per file. Crashed trains restart with backoff (1s → 5s → 30s, up to 5 consecutive failures). `metro trains list` shows state. `~/.metro/.env` is auto-loaded into each train's `process.env`.

**Hot-reload:** the daemon watches the trains dir and reloads *only the changed train* (debounced ~300ms) on save — no full restart needed. A brand-new file spawns automatically; deleting a file leaves its running process untouched (delete + restart the daemon to fully drop a train).

## Migration / deploy follow-up

The live trains (`~/.metro/trains/{xmtp,telegram,discord}.ts`) still hand-roll the protocol. They can be migrated onto `defineTrain` once a metro build carrying the SDK is published/installed — until then `import '@metro-labs/metro/define-train'` resolves only against this repo's `dist/`. Migrate after the next deploy.
