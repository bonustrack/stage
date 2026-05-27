# metro-api (api.metro.box)

Daemon-backed HTTP API. Currently powers the website's "Ask a question" button:
the **daemon** creates the XMTP group (daemon = super-admin/owner) and adds the
requesting user as a member, so the user doesn't own it.

## Endpoints
- `GET  /health` → `ok`
- `POST /ask-question { address }` → `{ conversationId, line }` — creates a
  daemon-owned group via `metro call xmtp newGroup`.

## Run (current setup, on the daemon's Mac)
The server file lives at `~/.metro/api-server.ts` (this is a backup copy).

```sh
# 1. API server on :8500
nohup bun ~/.metro/api-server.ts > /tmp/metro-api.log 2>&1 &

# 2. Cloudflare tunnel api.metro.box → :8500
#    (tunnel "metro-api", id 12772a09-df11-4e29-b880-1dc63a09bad1, DNS routed on the metro.box zone)
nohup cloudflared tunnel --no-autoupdate run --url http://127.0.0.1:8500 metro-api \
  > /tmp/metro-api-tunnel.log 2>&1 &
```

## TODO: durability
Both processes are `nohup`'d, so they survive the session but **not a reboot**.
For production, wrap each in a launchd LaunchAgent (or fold the server into a
supervised metro train once a daemon restart is convenient). CORS is `*`.
