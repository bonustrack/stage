# Stage BTC node

A tiny Cloudflare Worker that serves a live Stage widget: the Bitcoin price in USD with a Refresh button. It follows [NODES.md](../../NODES.md): it answers with OpenAI ChatKit widget JSON, checks the Stage signature on every request and answers a tap with a ChatKit sync action response.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/bonustrack/stage/tree/main/examples/btc-node)

## Deploy

1. Click the button and sign in to Cloudflare. It copies this folder to a new repository on your GitHub and deploys it as a Worker. The free plan is enough.
2. Copy the Worker URL, like `https://stage-btc-node.<your-subdomain>.workers.dev/`.
3. In Stage, open Settings, then Dashboard, then Add from URL. Paste the URL, tap Preview, then Add widget.

From a terminal in this folder, `bunx wrangler deploy` does the same.

## Run locally

`bunx wrangler dev` serves it on `http://localhost:8787`. Stage only loads https links on public hosts, so a local run is for testing the code with signed requests, not for adding it to Stage.

## What it does

- `GET /` returns the price card, a ChatKit `Card`.
- `POST /` with a ChatKit `threads.sync_custom_action` request whose action type is `refresh` returns `{"updated_item": {"type": "widget", "widget": ...}}` with a fresh price. Other action types return `{}`, which keeps the widget as it is.
- A request without a valid Stage signature gets `401`. `OPTIONS` answers CORS so the web app can call it.
- The price comes from the public Coinbase spot price API. No keys or storage are needed.
