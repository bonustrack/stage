# dispatch

Two tiny **Cloudflare Workers** for the [nodes](../../NODES.md) that Stage
users put online through the proxy's `PUT /nodes`. They hold no node code:
each node is its own Worker, `node-<id>`, in the Workers for Platforms
dispatch namespace `stage-nodes`, isolated from the other nodes and from Stage,
with no bindings or secrets.

## dispatch (`wrangler.toml`, `src/index.ts`)

On `nodes.stage.box`, `GET` or `POST /<id>` (and any path below it) runs
`node-<id>`. The limits, the CORS preflight it answers, the headers it strips
and the replies it sends are the hosted node contract in
[`NODES.md`](../../NODES.md); the numbers live in
`@stage-labs/client/nodes/hosting` and `src/index.ts` enforces them. Requests
from other Workers (the `cf-worker` header) are refused, so nodes can not call
each other in a loop.

## nodes-outbound (`outbound.toml`, `src/outbound.ts`)

The namespace's Outbound Worker: every `fetch()` a node makes comes here
first. Only `https` on the default port to public host names goes out (the shared
`@stage-labs/client/net/publicHost` policy, plus no IP addresses and no
`*.stage.box`), redirects come back to the node
instead of being followed, and `global_fetch_strictly_public` sends each call
through Cloudflare's front door like any outside client. With an Outbound
Worker attached, nodes can not open raw TCP sockets either.

Workers Logs are off for both.

## Setup

Once, in the Cloudflare dashboard: Workers for Platforms enabled, with the
dispatch namespace `stage-nodes` (keep it untrusted, the default).

GitHub Actions deploys both Workers (`.github/workflows/deploy-nodes.yml`) on
every push to `main` that touches `apps/dispatch/`, `packages/client/`,
`bun.lock` or the root `package.json`, and on demand: `bun check` and tests,
then `nodes-outbound` (`bunx wrangler deploy -c outbound.toml`), then
`dispatch` (`bunx wrangler deploy`), which attaches the custom domain
`nodes.stage.box`. It needs two repository secrets, else it skips the deploy
with a notice:

- `CLOUDFLARE_API_TOKEN`: an API token from the "Edit Cloudflare Workers"
  template, limited to the zone `stage.box`. The deploy uses its Workers
  Scripts Edit (account) and Workers Routes Edit (`stage.box`) permissions.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

```sh
bun --cwd apps/dispatch dev    # wrangler dev (the namespace needs remote mode)
curl -i https://nodes.stage.box/<id>
```
