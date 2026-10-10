# dispatch

Two tiny **Cloudflare Workers** for the [nodes](../../NODES.md) that Stage
users put online through the proxy's `PUT /nodes`. They hold no node code:
each node is its own Worker, `node-<id>`, in the Workers for Platforms
dispatch namespace `stage-nodes`, isolated from the other nodes and from Stage,
with no bindings or secrets.

## dispatch (`wrangler.toml`, `src/index.ts`)

On `nodes.stage.box`:

- `GET` or `POST /<id>` (and any path below it) runs `node-<id>` with the
  request as it came, signature headers included, with at most 50 ms of CPU and
  5 subrequests (Workers for Platforms custom limits) and 10 seconds in all.
  Cookies and the caller's IP address and location headers are removed first.
- `OPTIONS` answers the CORS preflight itself (`Stage-Key`, `Stage-Timestamp`,
  `Stage-Signature`, `Content-Type`), so a node needs no CORS code.
- Every reply is JSON from this Worker: the node's status and body (128 KB at
  most) with fixed headers (`application/json`, `nosniff`, a sandbox CSP, no
  cache, no cookies, no other header). A redirect or an upgrade answers `502`,
  so a node can not serve a page, set a cookie on `stage.box` or redirect.
- Request bodies are 64 KB at most and need a length. Calls are rate limited
  to 120 a minute per IP, an IPv6 address counted by its /64 (`NODE_REQUESTS`),
  and 600 a minute per node (`NODE_CALLS`). Requests from other Workers (the
  `cf-worker` header) are refused, so nodes can not call each other in a loop.
- An unknown node answers `404`, a crash or a hit limit `502`, a timeout `504`,
  without details.

## nodes-outbound (`outbound.toml`, `src/outbound.ts`)

The namespace's Outbound Worker: every `fetch()` a node makes comes here
first. Only `https` on the default port to public host names goes out (no IP
addresses, local names or `*.stage.box`), redirects come back to the node
instead of being followed, and `global_fetch_strictly_public` sends each call
through Cloudflare's front door like any outside client. With an Outbound
Worker attached, nodes can not open raw TCP sockets either.

Workers Logs are off for both.

## Setup

Once, in the Cloudflare dashboard:

1. Workers for Platforms enabled, with the dispatch namespace `stage-nodes`
   (keep it untrusted, the default).
2. Workers & Pages, Create, Import a repository, `bonustrack/stage`, twice,
   both with root directory `apps/dispatch`, build command
   `bun install --frozen-lockfile && bun run typecheck && bun run test`, build
   variable `BUN_VERSION=1.4.0` and build watch paths `apps/dispatch/*`,
   `packages/client/*`, `bun.lock`, `package.json`:
   - first `nodes-outbound`, deploy command `bunx wrangler deploy -c outbound.toml`;
   - then `dispatch`, deploy command `bunx wrangler deploy`. The deploy adds
     the custom domain `nodes.stage.box`.

```sh
bun --cwd apps/dispatch dev    # wrangler dev (the namespace needs remote mode)
curl -i https://nodes.stage.box/<id>
```
