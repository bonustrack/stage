# Example train

`telegram.ts` is a starting point, not runtime code. Copy to
`~/.metro/trains/<name>.ts`, edit, save, restart the daemon:

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

Metro scans `~/.metro/trains/*.{ts,js,mjs}` at boot — one subprocess per file. Crashed trains restart with backoff (1s → 5s → 30s, up to 5 consecutive failures). `metro trains list` shows state. Restart the daemon to pick up edits. `~/.metro/.env` is auto-loaded into each train's `process.env`.
