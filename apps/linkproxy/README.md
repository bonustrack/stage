# linkproxy

> **DEPRECATED** - superseded by `apps/workers/linkproxy`, a Cloudflare Worker
> port that serves the same `preview.metro.box` API at the edge with zero laptop
> dependency. This Node/Express service + its `cloudflared` tunnel remain only as
> the live backing for `preview.metro.box` until the Worker is deployed and
> verified (`x-served-by: worker`); remove this directory and decommission the
> `linkproxy` tunnel in the follow-up once cutover is confirmed.

Link-preview metadata proxy (iframely-style) for the Metro app. Given an
http(s) URL it fetches the page server-side, parses OpenGraph / Twitter-card /
`<title>` / meta description / favicon, and returns a compact JSON card.

## Run

```sh
cd apps/linkproxy
bun src/index.ts          # or: npm start
# listens on :8600 (override with LINKPROXY_PORT)
```

## Endpoint

```
GET /preview?url=<url-encoded link>
-> 200 { url, title, description, image, siteName, favicon }
-> 400 invalid/blocked url   422 no previewable content   429 rate limited   502 fetch failed
GET /health -> "ok"
```

## Security

- SSRF guard: rejects http(s)-only, resolves DNS and blocks any host resolving
  to a private / loopback / link-local / reserved range (RFC1918, 127/8,
  169.254/16, fc00::/7, ::1, CGNAT), re-checked on every redirect hop. Blocks
  `localhost`, `*.local`, `*.internal`, `*.metro.box`, `*.stage.box`, and cloud
  metadata hosts.
- Never executes JS (regex head-parse, no DOM/browser).
- Strips cookies/credentials (`credentials: 'omit'`), 5s timeout, 1.5 MB body
  cap, max 3 redirects, desktop User-Agent.
- Light per-IP rate limit (60 req/min).

## Caching

In-memory + disk at `~/.cache/metro/linkpreviews.json`, TTL ~1 day, pruned on
load and on each flush (cap 5000 entries).

## Tunnel (operator)

Front the service with a cloudflared named tunnel pointing at the local port.
Do NOT run this for the daemon automatically; the operator sets it up once:

```sh
# create the named tunnel + DNS once, then point it at :8600
cloudflared tunnel create linkproxy
cloudflared tunnel route dns linkproxy preview.metro.box
# ~/.cloudflared/<tunnel>.yml:
#   ingress:
#     - hostname: preview.metro.box
#       service: http://localhost:8600
#     - service: http_status:404
cloudflared tunnel run linkproxy
```

The app reads the base URL from `EXPO_PUBLIC_LINKPROXY_URL` (default
`https://preview.metro.box`) and gracefully renders no card when the proxy is
unreachable.
