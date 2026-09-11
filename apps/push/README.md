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
the device decrypts locally.

## How the app talks to it

Devices call the server's Connect API over HTTPS with JSON bodies:

| Call | Purpose |
|---|---|
| `POST /notifications.v1.Notifications/RegisterInstallation` | installation id + FCM or APNs token |
| `POST /notifications.v1.Notifications/SubscribeWithMetadata` | topics with their HMAC keys |
| `POST /notifications.v1.Notifications/DeleteInstallation` | when the user turns push off |

The app does not use the SDK's built-in push client on Android because that
client dials the server over plaintext gRPC; the JSON path above stays on TLS.

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
- Register a fake installation and expect an empty JSON object back:

  ```
  curl -s -X POST https://push.stage.box/notifications.v1.Notifications/RegisterInstallation \
    -H 'content-type: application/json' \
    -d '{"installationId":"smoke-test","deliveryMechanism":{"firebaseDeviceToken":"not-a-real-token"}}'
  ```

- On a phone with push enabled, message the account from another device and
  expect a "New message" card within a few seconds while the app is closed.

## Upgrading the server

Bump `UPSTREAM_COMMIT` in the `Dockerfile` to a newer commit of
`xmtp/example-notification-server-go`, push to main, and the workflow deploys it.
