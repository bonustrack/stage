# webhook-station

Receive-only HTTP station. One path `/wh/<id>` per registered endpoint; every
POST is rewrapped into a `kind: 'webhook'` envelope.

## Setup

Register an endpoint via `metro webhook add <label> [--secret=…]`. The CLI
prints the URL. Optionally expose it publicly via `metro tunnel setup`.

## Lines

`metro://webhook/<endpointId>` — one per registered endpoint.

## Actions

None — webhook-station is receive-only. There is nothing meaningful to "send to
a webhook endpoint" via metro; emit on the upstream provider instead.

## Signature verification

If an endpoint has a `secret`, the station checks `X-Hub-Signature-256: sha256=<hex>`
(GitHub / Intercom format) using HMAC-SHA256. Requests with a mismatch return
401 and emit nothing.

## Monitor

This station also serves the `/api/state` + `/api/tail` endpoints used by the
mobile app (gated by `METRO_MONITOR_TOKEN`). They share the same port as the
webhook listener (default 8420).
