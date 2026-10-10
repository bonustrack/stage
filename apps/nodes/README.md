# nodes

Stage's own [nodes](../../NODES.md) as one **Cloudflare Worker**, `stage-nodes`,
on `nodes.stage.box`. A node answers OpenAI ChatKit widget JSON that the Stage
Dashboard shows as a live widget. It is a Worker of its own so the proxy Worker
only serves the app.

- `https://nodes.stage.box/eth-price`: the ETH price in USD
- `https://nodes.stage.box/btc-price`: the BTC price in USD

Each card shows the price and its 24h change from DefiLlama, cached 20 s at the
edge, and a Refresh button that gets a price at most 5 s old. The prices are
public, so the Worker checks no signature, has no bindings and keeps no logs
(Workers Logs are off in `wrangler.toml`).

## API

```
GET     /<eth|btc>-price -> ChatKit Card: price, 24h change, Refresh button
POST    /<eth|btc>-price -> threads.sync_custom_action with action type 'refresh' -> { updated_item: { type: 'widget', widget } }, other actions {}
OPTIONS /<eth|btc>-price -> 204 CORS preflight (allows content-type and the Stage-Key, Stage-Timestamp, Stage-Signature headers)
```

Other paths answer `404`.

## Deploy

Cloudflare Workers Builds deploys it on every push to `main` that touches
`apps/nodes/`, `packages/client/`, `bun.lock` or the root `package.json`: Worker
`stage-nodes`, root directory `apps/nodes`, build command
`bun install --frozen-lockfile && bun run typecheck && bun run test`, deploy
command `bunx wrangler deploy`, build variable `BUN_VERSION=1.4.0`.
`wrangler.toml` attaches the custom domain `nodes.stage.box` and turns the
`workers.dev` URL off.

```sh
bun --cwd apps/nodes dev    # wrangler dev on http://localhost:8787
curl https://nodes.stage.box/eth-price
```
