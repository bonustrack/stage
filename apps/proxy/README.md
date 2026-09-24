# proxy

Stage's edge services as one **Cloudflare Worker** on `proxy.stage.box`, plus
the `bundler.stage.box` per-branch manifest proxy. Runs entirely on the Workers
runtime - no Express, no origin, no laptop dependency.

- **Link previews:** given an http(s) URL it fetches the page at the edge,
  parses OpenGraph / Twitter-card / `<title>` / meta description / favicon, and
  returns a compact JSON card. When the URL answers HTTP 402 with an x402
  payment challenge it surfaces the normalised challenge instead, and
  `/x402-settle` settles one.
- **Image resize:** `/img` fetches and resizes remote images so avatars and
  previews load cross-origin under the app's COEP policy.
- **Stage names:** `/names/*` issues free `<label>.stage.base.eth` subnames on
  Base. The Worker holds the operator key (`NAMES_OPERATOR_KEY`) and a KV of
  issued labels (`NAMES_KV`); claims are signed by the wallet in the app and
  labels are validated server-side (`a-z0-9`, single hyphens, none at the
  ends, 6+ chars). Every claim runs inside one `NamesClaims` Durable Object,
  one at a time, whose storage is the source of truth for reservations (KV
  mirrors it for `status`, `check` and `resolve`), so a label or an address
  can never be claimed twice.
- **XMTP history-sync archives:** `/xmtp-history/{production|dev}/upload` and
  `/files/<id>` are the history server every Stage device hands to libxmtp
  (`sendSyncRequest` / `sendSyncArchive` carry this URL, and the answering
  device uploads to whatever URL the request names). XMTP's own
  message-history server no longer serves downloads (they answer
  `400 Missing X-HMAC header`) and upstream libxmtp removed the transfer
  path, so the Worker stores the archives itself: one `HistoryArchives`
  Durable Object per upload, chunked into its SQLite storage and deleted by an
  alarm three days later. Archives are AES-GCM ciphertext whose key only
  travels inside the MLS device-sync group. Uploads are capped at 50 MB and
  rate limited per IP.
- **History transfer codes:** `/xmtp-history/{production|dev}/transfer/<id>`
  carries a whole-history archive from one device to another when XMTP
  device sync cannot (web and native installations do not share a device-sync
  group). The sending app derives a 64-hex lookup id and the archive key from
  a 10-character transfer code with PBKDF2, so the Worker only ever sees the
  id and ciphertext, never the code or the key. One `HistoryTransfers`
  Durable Object per transfer: `PUT` once (409 if the id exists, 50 MB cap),
  `GET` at most three times, `DELETE` after a successful import, and an alarm
  deletes it 24 hours after upload. Lookups (`GET`/`DELETE`) are rate limited
  per IP by the `TRANSFER_LOOKUPS` rate-limit binding (10 a minute).
- **XMTP push relay:** `/xmtp-push/*` forwards to the Stage push server
  (`apps/push`), so the web app talks to one origin with the right CORS
  headers.

## API

```
GET  /health                     -> "ok"
GET  /preview?url=<encoded>      -> 200 { url, title, description, image, siteName, favicon }
                                    OR { kind:'x402', endpoint, accepts:[...], raw, ... }
    400 invalid/blocked url   422 no previewable content   429 rate limited   502 fetch failed
GET  /img?url=<encoded>&w=<px>   -> resized image
POST /x402-settle                -> settlement result
GET  /names/check?label=<label>  -> { valid, available, reason? }
GET  /names/status?address=<0x>  -> { name | null }
GET  /names/resolve?label=<l>    -> { address | null }   (registry owner, then the KV record)
POST /names/claim                -> { label, address, issuedAt, signature } -> the issued name
POST /xmtp-history/<env>/upload  -> archive id (text)       413 too large   429 rate limited
GET  /xmtp-history/<env>/files/<id> -> archive bytes       404 unknown or expired
PUT  /xmtp-history/<env>/transfer/<id> -> { expiresAt }     409 exists   413 too large   429 rate limited
GET  /xmtp-history/<env>/transfer/<id> -> transfer bytes    404 unknown, used or expired   429 rate limited
DELETE /xmtp-history/<env>/transfer/<id> -> 204             429 rate limited
*    /xmtp-push/*                -> relayed upstream
```

Every response carries `x-served-by: worker`.

## Security / SSRF

The Workers runtime **refuses to route `fetch()` to private / loopback /
link-local / RFC1918 destinations** by design, so DNS-rebinding to an internal
IP is neutralised at the platform layer (no DNS resolution is done in-Worker;
see `src/ssrf.ts`). On top of that we keep:

- a host allowlist block for our own internal surface (`*.stage.box`,
  `localhost`, `*.local`, `*.internal`, cloud metadata hosts),
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
#        stage.box zone, and Account: Workers Scripts)
bunx wrangler deploy
```

`wrangler.toml` binds the Worker to the routes `proxy.stage.box/*` and
`bundler.stage.box/*` on the `stage.box` zone, the `NAMES_KV` namespace and
the `NAMES_CLAIMS` Durable Object (SQLite-backed, created by the `v1` migration);
`NAMES_OPERATOR_KEY` (and the optional `NAMES_RPC_URL`) are Worker secrets set
with `wrangler secret put`, never committed. Both hostnames are proxied
(orange-cloud) DNS records, so the routes intercept at the edge before any
origin. CI deploys on every push to `main` (`deploy-proxy.yml`).

```sh
curl https://proxy.stage.box/health            # -> ok, header x-served-by: worker
curl "https://proxy.stage.box/preview?url=https%3A%2F%2Fgithub.com%2Fbonustrack%2Fstage"
```

The app reads the base URL from `EXPO_PUBLIC_LINKPROXY_URL` (default
`https://proxy.stage.box`).
