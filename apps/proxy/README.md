# proxy

The link-preview / image / x402 proxy as a **Cloudflare Worker**
(`preview.metro.box`). Runs entirely on the Workers runtime - no Express, no
origin, no laptop dependency. Given an http(s) URL it fetches the page at the
edge, parses OpenGraph / Twitter-card / `<title>` / meta description / favicon,
and returns a compact JSON card. When the URL answers HTTP 402 with an x402
payment challenge it surfaces the normalised challenge instead.

This replaces the previous Node service + `cloudflared` named tunnel.

## API

```
GET /health                 -> "ok"
GET /preview?url=<encoded>  -> 200 { url, title, description, image, siteName, favicon }
                               OR { kind:'x402', endpoint, accepts:[...], raw, ... }
   400 invalid/blocked url   422 no previewable content   429 rate limited   502 fetch failed
```

Every response carries `x-served-by: worker` so callers can distinguish the
Worker from the legacy tunnel during the cutover.

## Security / SSRF

The Workers runtime **refuses to route `fetch()` to private / loopback /
link-local / RFC1918 destinations** by design, so DNS-rebinding to an internal
IP is neutralised at the platform layer (no DNS resolution is done in-Worker;
see `src/ssrf.ts`). On top of that we keep:

- a host allowlist block for our own internal surface (`*.metro.box`,
  `*.stage.box`, `localhost`, `*.local`, `*.internal`, cloud metadata hosts),
  re-checked on every redirect hop,
- a literal private-IP guard (cheap defence-in-depth),
- http(s)-only, credential stripping, 5s timeout, 1.5 MB body cap, 3-redirect
  cap, desktop User-Agent, never executes JS (regex head-parse).

## Caching

Successful results are stored in `caches.default` (the Cloudflare edge cache),
keyed by the normalised `/preview?url=...` request, TTL ~1 day. Cache hits add
`x-cache: HIT`.

## Rate limit

Best-effort per-IP 60/min within a single isolate (isolates are ephemeral, so
this only bounds bursts - use Cloudflare Rate Limiting Rules for a hard global
limit).

## Deploy

```sh
cd apps/proxy
# auth: either `wrangler login` (interactive) or export CLOUDFLARE_API_TOKEN
#       (token needs Workers Scripts:Edit + Workers Routes:Edit on the
#        metro.box zone, and Account: Workers Scripts)
bunx wrangler deploy
```

`wrangler.toml` binds the Worker to a route `preview.metro.box/*` on the
`metro.box` zone. The hostname is already proxied through Cloudflare, so the
route intercepts at the edge before any origin/tunnel - deploy the route first,
verify `x-served-by: worker`, THEN decommission the old tunnel:

```sh
curl https://preview.metro.box/health            # -> ok, header x-served-by: worker
curl "https://preview.metro.box/preview?url=https%3A%2F%2Fgithub.com%2Fbonustrack%2Fstage"

# once verified:
launchctl unload ~/Library/LaunchAgents/box.metro.tunnel-linkproxy.plist
rm ~/Library/LaunchAgents/box.metro.tunnel-linkproxy.plist
pkill -f linkproxy
cloudflared tunnel delete linkproxy
```

The app reads the base URL from `EXPO_PUBLIC_LINKPROXY_URL` (default
`https://preview.metro.box`); no app change is needed for the cutover.
