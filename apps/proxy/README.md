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
  labels are validated server-side with the client's `validateStageLabel`.
  Every claim runs inside one `NamesClaims` Durable Object,
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
  travels inside the MLS device-sync group. Uploads stream into storage and
  are rate limited per IP. One request carries at most 100 MB, because
  Cloudflare refuses a bigger body before the Worker runs (with no CORS
  headers, so a browser only sees a CORS error). A bigger archive comes in
  parts: the first part goes to `upload?size=<total bytes>` and gets the id,
  each next part goes to `upload/<id>`, and the archive is served once all
  its bytes are in. An archive is capped at 1 GB. The web app splits its
  uploads in the patched `@xmtp/browser-sdk` worker, in 50 MB parts.
- **Chat attachments:** `POST /attachments` stores one client-encrypted file
  in the `stage` R2 bucket as `attachments/<random 24-byte id>` and answers
  `{ id }`; `GET` and `HEAD /attachments/<id>` serve it back as
  `application/octet-stream` with immutable caching. The AES key travels inside
  the XMTP message, so the Worker only ever sees ciphertext and no filename.
  Uploads need a `Content-Length`, are capped at 100 MB and rate limited per
  IP (20 a minute through the `ATTACHMENT_UPLOADS` binding). Workers Logs are
  pinned off in `wrangler.toml`, so no request log of ids or IPs is kept beyond
  Cloudflare's defaults. Messages from before 2026-10-09 carry Swarm links
  (`/bzz/<ref>/`), which the app reads from the public Swarm gateway
  (`download.gateway.ethswarm.org`).
- **User nodes:** `PUT /nodes` puts a user's [node](../../NODES.md) online
  and `DELETE /nodes` takes it down. The body of a `PUT` is the node's code,
  one ES module of at most 64 KB. Requests are signed with the node's Ed25519
  key (`Stage-Key`, `Stage-Timestamp`, `Stage-Signature`, the scheme of
  `NODES.md`) and the node id is the first 16 bytes of the SHA-256 of that
  public key, so a key owns exactly one node and nobody else can change or
  remove it (small order keys are refused). The Worker checks the size, the
  signature over the raw bytes, and the rate limits (10 a minute per IP, an
  IPv6 address counted by its /64, through `NODE_PUBLISHES`, and 60 a minute
  in all through `NODE_PUBLISHES_ALL`), keeps the total at 1000 nodes, then
  uploads the code through the Cloudflare API into the Workers for Platforms
  dispatch namespace `stage-nodes` as the Worker `node-<id>`, with no
  bindings, secrets or logs and the `global_fetch_strictly_public` flag.
  `apps/dispatch` serves it on `https://nodes.stage.box/<id>`. The token and
  account id are the `NODES_CF_API_TOKEN` and `NODES_CF_ACCOUNT_ID` secrets;
  without them `/nodes` answers `503`.
- **XMTP push relay:** `/xmtp-push/*` forwards to the Stage push server
  (`apps/push`), so the web app talks to one origin with the right CORS
  headers.
- **st.box mail (receive only):** Email Routing on `st.box` sends every mail
  to this Worker's `email()` handler. `<label>+tag@st.box` maps to
  `<label>.stage.base.eth` (lowercase, `+tag` dropped, role names such as
  postmaster refused); unknown names get `No such mailbox`, names without a
  registered key get `Mailbox not activated`, mail over 25 MiB is refused. The
  mail is sealed at once with HPKE (DHKEM X25519, HKDF-SHA256, AES-128-GCM,
  the MLS suite XMTP uses) to the owner's public mail key, and only the
  ciphertext is stored: one `MailBoxes` Durable Object per mailbox, which also
  holds the key record, sign-in nonces and sessions (512 MiB per mailbox).
  The app derives the mail key from the recovery-phrase owner's signature of
  `st.box mail key v1 for <name>` and sends the public half with the name
  claim, inside the signed claim message; the claim stores it in the mailbox
  only after the name is issued. A name claimed without a key (older apps,
  Metro) stays inactive until its owner's app registers the key through
  `POST /mail/key` on start, which is also the path for a new owner; reading
  needs a session opened with a signature from the name's current onchain
  owner (EOA, ERC-1271 or ERC-6492), checked again on every request, so a
  sold name loses access at once. A new owner's key wipes the old mail. Client
  helpers: `@stage-labs/client/mail/mailbox` and `/mail/api`.

## Routes

Each route is one entry of the `ROUTES` table in `src/index.ts`: its path
(from `@stage-labs/client/endpoints`, which the app and the client helpers
use too), its preflight CORS, its rate limits and its handler. The handler
modules hold the request and reply shapes and their statuses; the node
publish statuses are `NODE_PUBLISH_STATUS` in
`@stage-labs/client/nodes/hosting`, documented for node authors in
[`NODES.md`](../../NODES.md).

## Security / SSRF

The Workers runtime **refuses to route `fetch()` to private / loopback /
link-local / RFC1918 destinations** by design, so DNS-rebinding to an internal
IP is neutralised at the platform layer (no DNS resolution is done in-Worker;
see `src/ssrf.ts`). On top of that:

- every target and every redirect hop goes through `src/ssrf.ts`: http(s)
  only, the shared host policy of `@stage-labs/client/net/publicHost` (the
  one the node client and the nodes outbound Worker use), plus Stage's own
  `stage.box` hosts and the cloud metadata name,
- per-route timeouts, body caps and redirect caps, a desktop User-Agent, and
  it never executes JS (regex head-parse).

## Caching

Successful results are stored in `caches.default` (the Cloudflare edge cache),
keyed by the normalised `/preview?url=...` request, TTL ~1 day. Cache hits add
`x-cache: HIT`.

## Rate limit

The route table declares each route's limits: a best-effort budget of 60 a
minute per IP within a single isolate (isolates are ephemeral, so this only
bounds bursts) and, where a route needs a hard limit, a Workers RateLimit
binding from `wrangler.toml`. Every limit keys on `cf-connecting-ip`
(`@stage-labs/client/net/clientIp`), never on the spoofable `x-forwarded-for`.

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
the `NAMES_CLAIMS` Durable Object (SQLite-backed, created by the `v1` migration)
and the `ATTACHMENTS` R2 bucket (`stage`, created once in the
dashboard; a deploy fails while it does not exist);
`NAMES_OPERATOR_KEY` (and the optional `NAMES_RPC_URL`) are Worker secrets set
with `wrangler secret put`, never committed. So are `NODES_CF_API_TOKEN` (an
account API token, owned by the account rather than a person so its API budget
is its own, with only Workers Scripts, Edit) and
`NODES_CF_ACCOUNT_ID`, set in the dashboard (Workers & Pages, proxy, Settings,
Variables and Secrets, type Secret) so a deploy keeps them. Both hostnames are proxied
(orange-cloud) DNS records, so the routes intercept at the edge before any
origin. Cloudflare Workers Builds deploys it on every push to `main` that touches `apps/proxy/`, `packages/client/`, `bun.lock` or the root `package.json`: it installs with `bun install --frozen-lockfile` (Bun 1.4.4 via the `BUN_VERSION` build variable), runs `bun check` and `bun run test` in `apps/proxy`, then `bunx wrangler deploy`. Builds and logs are in the Cloudflare dashboard under the `proxy` Worker.

```sh
curl https://proxy.stage.box/health            # -> ok, header x-served-by: worker
curl "https://proxy.stage.box/preview?url=https%3A%2F%2Fgithub.com%2Fbonustrack%2Fstage"
```

The app reads the base URL from `EXPO_PUBLIC_LINKPROXY_URL` (default
`https://proxy.stage.box`).
