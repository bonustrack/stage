# notif-bridge

Stage-owned, **privacy-preserving XMTP → FCM push bridge**. It replaces the
retired Metro daemon's push pipeline: it holds its own XMTP inbox, receives
device push-token registrations over XMTP DMs, and fans out **contentless**
data-only pushes to FCM so a device can wake and decrypt locally.

## Privacy guarantee

The bridge **never handles plaintext**. For every inbound message it sends FCM a
data-only payload of routing metadata only:

```
{ channelId: "xmtp", account, line, convId, messageId, isGroup? }
```

No `notification` block, no title/body/preview, no sender name, avatar, or group
name. The device (which holds the XMTP key) decrypts locally and renders a
generic "New message" card; tapping deep-links into the conversation. The bridge
sees only ciphertext envelopes + topic metadata — same trust model as the old
daemon.

## Why this is a standalone Node service (not a Cloudflare Worker)

The approved design called this a Cloudflare Worker under `apps/proxy`. That is
**not technically possible**: an XMTP MLS client requires the native
`@xmtp/node-bindings` addon, a **persistent encrypted SQLite MLS store**, and a
**long-lived streaming connection**. Cloudflare Workers run in a V8 isolate with
no native addons, no persistent filesystem, and a request-scoped lifecycle — the
XMTP client cannot boot or hold a stream there. So the bridge is a long-running
Node/Bun service (exactly what the retired daemon was), deployed as a container
to any always-on host (Fly.io, Railway, Render, a VM).

It lives at the repo top level (not under `apps/`) and is **excluded from the
Stage monorepo workspaces + CI gates on purpose** — it carries the heavy native
`@xmtp/node-sdk` dependency in its own isolated lockfile so it can never
destabilize Stage's `--frozen-lockfile` build. It deploys independently.

## Architecture

```
Stage app (device)                         notif-bridge (this service)
──────────────────                         ───────────────────────────
registerPushWithBridge()  ── XMTP DM ──▶   onControl: parse METRO_CTRL,
  METRO_CTRL:register-push:{token,…}         store FCM token (scoped to inbox)

someone messages the bridge inbox ─────▶   streamAllMessages ▶ onInbound
                                             ▶ contentless FCM push (routing only)
FCM ── data-only push ──▶ MetroFcmService (native) ▶ wake ▶ local decrypt ▶ card
```

- `src/xmtp.ts` — boots the bridge's XMTP client (viem EOA signer from
  `BRIDGE_XMTP_PRIVATE_KEY`), `syncAll` + `streamAllMessages` with reconnect.
- `src/control.ts` — parses `METRO_CTRL:register-push` / `disable-push` DMs
  (same wire format as the client's `pushRegister.control.ts`).
- `src/tokens.ts` — device-token store (JSON file by default; dedupe by token,
  carry every registering inbox, one freshest token per account).
- `src/push.ts` — builds the contentless routing payload + fans out.
- `src/fcm.ts` — FCM HTTP v1: RS256 JWT → OAuth access token → `messages:send`,
  dead-token pruning. No Firebase SDK, hand-rolled with `node:crypto`.

### Self-message filtering

A user is never pushed for their own sends: the stream skips
`senderInboxId === client.inboxId`, and fan-out excludes any device token whose
registering `inboxId` matches the message sender. (The retired daemon used this
same inbox-id exclusion. XMTP also exposes per-conversation HMAC keys for a
topic-subscription push-server model — a more general "notify me of all my DMs"
design — which is a possible future evolution, not this bridge.)

## Configuration

See `.env.example`. **Secrets Less must provision** (do not invent these):

| Var | What |
|---|---|
| `BRIDGE_XMTP_PRIVATE_KEY` | The bridge's own XMTP inbox EOA key. Its public address is the value the app ships as `EXPO_PUBLIC_NOTIF_BRIDGE_INBOX`. |
| `FCM_SERVICE_ACCOUNT_JSON` or `_PATH` | Firebase service account (project must match the app's `google-services.json`, `box.metro.monitor`). |
| `BRIDGE_XMTP_ENV` | `production` \| `dev` \| `local`; must match the app's XMTP env. |
| `BRIDGE_XMTP_DB_PATH` | Persistent volume path for the MLS store. |
| `BRIDGE_XMTP_DB_KEY` | (optional) 32-byte hex to encrypt the MLS store at rest. |

## Run

```
cp .env.example .env      # fill in the secrets
bun install
bun run typecheck
bun test
bun run start             # or: docker build -t notif-bridge . && docker run --env-file .env -v $PWD/data:/app/data notif-bridge
```

## iOS

iOS is **contentless-only** for now: a data-only push does not display a card on
iOS. Enabling a rich on-device-decrypted card requires a Notification Service
Extension (NSE) in the app — tracked as the next PR. The bridge already sends
the same contentless payload to iOS tokens, so no bridge change is needed when
the NSE lands.
