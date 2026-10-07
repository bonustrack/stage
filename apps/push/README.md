# Stage push server

This is XMTP's reference notification server, built from a pinned upstream commit
(see `UPSTREAM_COMMIT` in the `Dockerfile`) and deployed to Fly as the app
`stage-push` in the `iad` region (Ashburn, Virginia, the same site as AWS us-east-1). It is the piece that turns an encrypted message on the XMTP network
into a contentless push on the user's devices.

## What it sees and what it cannot see

The server holds no XMTP identity and is not a member of any conversation. It
subscribes to the *topics* devices register, receives the MLS ciphertext
envelopes published on those topics, and forwards them as data-only pushes. It
cannot decrypt them. Each device registers the HMAC keys of its own
conversations, so the server can recognise and drop that device's own sends
without reading anything. The push payload carries the topic and the ciphertext;
the device decrypts locally. Android can display a generic background card
without decrypting, so own-message suppression must happen here, not only in
the foreground app.

### Account-wide sender filtering

A receiving installation's own HMAC registration can become stale when another
device rotates the inbox preference seed. Signed sender publications add current
keys to an account/inbox group, so an enrolled receiving phone can remain asleep
while a laptop with notifications disabled refreshes that group's filters.

- Clients locally derive a secret capability from their existing owner signer,
  account address and canonical XMTP inbox ID, using a separate signing domain.
  The server stores only the capability's SHA-256, not the account or inbox ID.
- Every publication is signed by the XMTP installation key. The Ed25519ph
  signature uses XMTP's public-signature context and covers a domain-separated
  SHA-256 of the exact JSON payload, including capability, installation ID,
  timestamp, topics and keys. No unverified client-claimed inbox membership or
  old unsigned `stage_device_groups` membership is accepted. This is proof of
  capability plus installation-key possession, not validation of the public
  XMTP identity-association chain.
- Binding an installation to a group is immutable. Keys are additive, including
  multiple seed-rotation variants of a topic/period. Reordered or duplicated
  requests cannot remove a newer key. Timestamps accept five minutes past and
  thirty seconds future; replay within that window is idempotent and cannot
  extend a key's period-based lifetime. There is no nonce database.
- These 42-byte HMAC authenticators derive from a separate random inbox
  preference seed, conversation ID and 30-day period. They match a sender's
  HMAC over encrypted MLS bytes. They are not MLS/content-decryption secrets.
  Neither the seed, plaintext messages, attachment-decryption keys nor MLS
  secrets are submitted. Request bodies, capabilities and keys are not logged;
  failures produce constant messages without database error details.
- This is not zero-metadata exposure. The relay sees topics, installation
  grouping, periods, and matching self-sender ciphertext traffic, and retains
  more rotated-key variants than the legacy single-key registration. A leaked
  authenticator enables sender-tag computation, not message decryption.
- Keys are accepted only for the signed timestamp's current/adjacent periods,
  including accepted clock skew at a period boundary. The request body has a
  five-second read deadline and freshness is checked after reading it. Keys
  older than the server's previous period are deleted on publication and hourly.
  A key lasts at most about 90 days plus clock skew and one cleanup interval.
- Empty groups idle for 24 hours are removed. Immutable installation bindings
  remain as bounded tombstones, so an old installation cannot change groups.
  Turning push off removes delivery registration, not these bindings. There are
  at most 50 active publishers per group in a rolling 24 hours, 16 key variants
  per topic/period and 50,000 keys per group. Historical installations stop
  consuming the active-publisher quota after 24 hours.
- Transactional global limits bound storage to 10,000 groups, 100,000 bindings
  and 500,000 keys. Admission allows 100 new groups and 500 new installations
  per hour; known installations can still refresh within storage limits.
  These limits bound generated-key abuse, not prove XMTP identity registration.
  Capacity exhaustion returns 429 and requires retry or operator intervention.
- Ingress budgets are separate per source address and claimed capability, with
  a verified per-group budget after signature checking. Limiter maps are bounded.
  A claimed capability in an ingress key is not authentication. Publications
  batch up to 256 topics and three periods using bulk SQL in one transaction.

Each receiving device must run the updated JS once to sign its own enrollment.
An unupgraded sleeping phone cannot be securely enrolled from a laptop. The
sender does not need push permission or a delivery token. Before a notifying
send, it syncs preferences and publishes dirty topic keys, with acknowledged
fingerprints cached for four minutes. The 30-second deadline includes queue
wait. Failed publication blocks that send rather than knowingly allowing a stale
own-message notification. Non-notifying call control bypasses publication while
retaining account checks. Receiving-token registration and subscription refresh
run independently, even if sender publication fails. Existing subscriptions,
muted state, delivery tokens and other accounts' filters are not replaced.

Single-conversation sends avoid scanning conversation names. The browser uses
that conversation's HMAC API. The pinned native SDK exposes only an all-key API,
so native still fetches all HMAC keys before selecting the requested topic.
Attachments retain their initiating account through upload and perform the
sender preflight immediately before sending. Supplemental filter-query failures
retry inside the existing listener worker, delaying delivery rather than
silently discarding the envelope or failing open. Cancellation still ends that
worker; this is not a durable queue across server shutdown.

The SDK does not expose atomic key-snapshot-and-send. A seed change between the
acknowledged preflight and SDK encryption remains a concurrency boundary; the
additive registry and preference refresh handle ordinary rotation and stale
writes, not a proof that every SDK-internal race is impossible.

## How the app talks to it

Devices call the server's Connect API over HTTPS with JSON bodies:

| Call | Purpose |
|---|---|
| `POST /notifications.v1.Notifications/RegisterInstallation` | installation id + FCM or APNs token |
| `POST /notifications.v1.Notifications/SubscribeWithMetadata` | topics with their HMAC keys |
| `POST /notifications.v1.Notifications/DeleteInstallation` | when the user turns push off |
| `POST /stage.v1.Push/JoinDeviceGroup` | installation id + the account's group key, once per installation |
| `POST /stage.v1.Push/ClearConversation` | installation id + group key + a conversation topic, when a chat is read |
| `POST /stage.v1.Push/PublishSenderFilters` | signed account/inbox-group enrollment and topic HMAC keys, no push token |
| `GET /stage.v1.Push/SenderFilterVersion` | public deployed Stage commit and sender-filter protocol version |

The app does not use the SDK's built-in push client on Android because that
client dials the server over plaintext gRPC; the JSON path above stays on TLS.

## Clearing a chat on the other devices

The Stage routes are added to the upstream server by
`stagepush/` (copied into `pkg/stagepush`) and `stagepush.patch` (mounts them
next to the XMTP API). The Docker build applies both and runs their tests.

- Each device derives a group key from a signature of its account owner. All
  devices of one account get the same key, nobody else can. The server keeps
  only its SHA-256 (`stage_device_groups`, created on start), and an
  installation joins one group for good.
- When a chat is read, the device sends the conversation topic with the key.
  The server sends a data-only push with the topic `/stage/clear/<conversation
  id>` to the other installations of that group that subscribe to that topic,
  and each removes its own cards for that chat. No content, nothing the server
  did not already know.
- Rate limits: 30 calls per group, refilled one every 2 seconds, and 100 calls
  for the whole server, refilled 50 a second.

## One-time setup

You need `flyctl` logged in to the bonustrack Fly organisation.

1. Create the app and point it at the database. The database is a managed
   Postgres outside Fly (PlanetScale today); the server only needs a
   connection string and runs its own migrations on first start:

   ```
   cd apps/push
   fly apps create stage-push --org stage-labs
   fly secrets set --app stage-push DATABASE_URL='postgres://user:password@host:5432/dbname?sslmode=require'
   ```

   The entrypoint maps `DATABASE_URL` to the variable the server reads. Keep
   `sslmode=require` (or `verify-full`) so the connection to the provider is
   encrypted.

2. Set the delivery credentials as Fly secrets:

   ```
   fly secrets set --app stage-push \
     FCM_CREDENTIALS_JSON="$(cat firebase-service-account.json)" \
     APNS_P8_CERTIFICATE="$(cat AuthKey_XXXXXXXXXX.p8)" \
     APNS_KEY_ID=XXXXXXXXXX \
     APNS_TEAM_ID=YYYYYYYYYY
   ```

   - The FCM file is a service account key for the Firebase project
     `metro-e47f6`, the one that owns the app's `google-services.json` files.
     Create it under Project settings, Service accounts, Generate new private key.
   - The APNs `.p8` key comes from the Apple Developer portal under Keys, with
     the Apple Push Notifications service enabled. The key id and team id are
     shown next to it. `APNS_TOPIC` is the iOS bundle id and is set in `fly.toml`.
   - Either backend switches on only when its credential is present, so Android
     can go live before the Apple key exists.
   - A secret saved in the Fly dashboard is only staged. `fly secrets deploy` did
     not reliably reach the machine either; run `fly deploy --ha=false` after
     changing secrets and confirm the process arguments include `--fcm-enabled`
     or `--apns-enabled` (`fly ssh console -C ps`).

3. Deploy once by hand to confirm it boots:

   ```
   fly deploy --ha=false --config fly.toml --dockerfile Dockerfile
   fly logs --app stage-push
   curl -s https://stage-push.fly.dev/readyz
   ```

4. Give CI a deploy token and add it as the `FLY_API_TOKEN` repository secret:

   ```
   fly tokens create deploy --app stage-push
   gh secret set FLY_API_TOKEN --repo bonustrack/stage
   ```

   After that, any change under `apps/push/` on main deploys itself
   through `.github/workflows/deploy-push-server.yml`.

   Always deploy with `--ha=false` and keep one machine (`fly scale count 1`).
   Each machine runs its own XMTP listener and would push every message again.

5. Point `push.stage.box` at the app and tell the app about it:

   ```
   fly certs add push.stage.box --app stage-push
   ```

   Add the A and AAAA records Fly prints to the stage.box zone in Cloudflare
   with the proxy turned off (grey cloud), so the TLS certificate is Fly's. The app reads
   `EXPO_PUBLIC_PUSH_SERVER_URL` and defaults to `https://push.stage.box`.

## Environment reference

| Variable | Default | Meaning |
|---|---|---|
| `DB_CONNECTION_STRING` or `DATABASE_URL` | required | Postgres connection string, a managed database outside Fly |
| `XMTP_GRPC_ADDRESS` | `production.xmtp.network:5556` | XMTP node the listener streams from |
| `XMTP_LISTENER_TLS` | `true` | TLS to the XMTP node |
| `LISTENER_TYPE` | `v3` | `v3` today; `v4` once the app moves to the decentralised network |
| `FCM_PROJECT_ID`, `FCM_CREDENTIALS_JSON` | project set, credential secret | Firebase Cloud Messaging |
| `APNS_TOPIC`, `APNS_MODE`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_P8_CERTIFICATE` | topic and mode set, rest secret | Apple Push Notification service |
| `LOG_ENCODING`, `LOG_LEVEL`, `NUM_WORKERS`, `API_PORT` | `json`, `info`, `50`, `8080` | Server tuning |

## Checking it works

- `curl -s https://push.stage.box/readyz` returns 200 once the listener is connected.
- `curl -s https://push.stage.box/stage.v1.Push/SenderFilterVersion` must show the
  exact deployed Stage SHA, supplied as Docker's `STAGE_COMMIT` build argument.
- Do not register fake tokens, send user messages, inspect user content or emit
  live test pushes as a deployment smoke test. Use the isolated tests below.
- With separately approved real-device testing, an enrolled sleeping phone must
  not show a card for its own account's message sent from another device. A
  message from another account must still notify when the topic is not muted.

## Synthetic tests

The deployment workflow starts disposable PostgreSQL 16 on localhost port 25432,
checks out the Dockerfile's pinned upstream SHA, applies the patch and copies
`stagepush/` and `xmtp_tests/` into its packages. It runs:

```
STAGE_PUSH_DATABASE_TESTS=1 go test -race ./pkg/stagepush ./pkg/xmtp
```

The upstream test helper creates and drops isolated databases. Never point it
at a production database. The tests cover signed authorization and privacy
boundaries, the shared TS/XMTP-WASM-compatible signature fixture, sleeping
siblings, no-token senders, DM/group topics, legacy migration, cross-account
isolation, concurrent/reordered rotations, preserved mute/active state, atomic
failure/capacity rollback, quota recovery, maximum-size batches, read retries,
period expiry, bounded ingress and clock-skew boundaries. Docker also runs the
non-DB tests. Client and proxy regressions run through the standard Bun pipeline.

## Deployment and rollback

Ship backend and proxy allowlist support in a separate source commit before
merging client activation. Keep automatic app publication disabled during this
sequence. Deploy and verify the backend version endpoint, then verify the
Cloudflare `/xmtp-push/PublishSenderFilters` relay before merging or publishing
clients that require it. A source push alone is not evidence of either service
or client delivery. Each receiving device must execute the new JS once.

The backend workflow gates deployment on the isolated database/race suite,
retains one Fly machine, passes its exact checkout SHA into the binary, then
verifies readiness and that SHA at the public version endpoint. Record the
previous successful push-server workflow SHA/image before upgrading. Existing
subscription tables and rows are not rewritten; the four new tables are additive.

Before any updated clients are delivered, rollback can redeploy the previous
known-good server source/image. After clients are delivered, an old server
without `PublishSenderFilters` makes new-client send preflights fail, so roll
back clients first or ship a compatible server repair. Do not delete the new
tables during rollback. Reverting the server restores the stale-filter bug;
rollback is recovery, not successful delivery of the fix. Native binaries and
store releases are separate approvals, not side effects of backend deployment.

## Upgrading the server

Bump `UPSTREAM_COMMIT` in the `Dockerfile` to a newer commit of
`xmtp/example-notification-server-go`, push to main, and the workflow deploys it.
