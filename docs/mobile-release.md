# Mobile release (EAS Build + EAS Submit)

`.github/workflows/release-mobile.yml` releases the Stage app for Android and iOS whenever the `version` value in `apps/stage/app.config.js` changes on `main`. A merge that does not change the version does nothing. `Actions -> Release Mobile -> Run workflow` releases the current `main` on demand, for one platform or both.

## What runs

| Job | What it does |
|---|---|
| `android-store` | EAS cloud build (`production-prod`, AAB) then `eas submit` to the Play `internal` and `closed` tracks. `production` is attempted but allowed to fail while the Play account gate is in place. |
| `android-apk` | EAS cloud build (`preview-prod`, APK) attached to the GitHub Release `v<version>`. |
| `testers` | Pushes that APK to the Firebase App Distribution `testers` group. |
| `ios` | EAS cloud build (`production-prod`) then `eas submit` to TestFlight. Skips with a warning until the Apple secrets exist. |

Version codes and build numbers are managed by EAS (`appVersionSource: remote`, `autoIncrement: true`), so nothing needs bumping besides `version`.

The public client ids the JavaScript bundle needs (`EXPO_PUBLIC_ZERODEV_PROJECT_ID`, `EXPO_PUBLIC_SWARMY_KEY`) live in the `base` profile of `apps/stage/eas.json`, because EAS cloud builds bundle on Expo's servers where repo secrets and the gitignored `.env` do not exist. They are inlined into every shipped bundle anyway, so they are not secret. Without them a store build has no wallet configuration and attachment uploads fail.

## Secrets

Repo `Settings -> Secrets and variables -> Actions`.

| Name | Used by | Where to get it |
|---|---|---|
| `EXPO_TOKEN` | all | expo.dev -> Account settings -> Access tokens. Already set. |
| `PLAY_SERVICE_ACCOUNT_JSON` | android-store | Google Cloud service account JSON with release rights in Play Console -> Users and permissions. Already set. |
| `FIREBASE_APP_DISTRIBUTION_SA_JSON` | testers | Firebase service account with the App Distribution Admin role. Optional. |
| `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_API_KEY_P8` | ios | App Store Connect API team key, see step 7 of the iOS checklist below. Paste the full `.p8` contents into `ASC_API_KEY_P8`. |
| `APPLE_TEAM_ID` | ios | developer.apple.com -> Account -> Membership details -> Team ID. |
| `ASC_APP_ID` | ios | App Store Connect -> the app -> App Information -> Apple ID (numeric). |

Variables (not secrets): `APPLE_TEAM_TYPE` = `COMPANY_OR_ORGANIZATION` (default, the account is enrolled as an organisation) or `INDIVIDUAL`.

None of these identifiers are committed. The `ios` job writes them into the `submit.production.ios` block of `eas.json` inside the runner and restores the file afterwards, and passes them to `eas build` as `EXPO_ASC_*` / `EXPO_APPLE_*` environment variables. No EAS environment variables are needed for iOS.

## iOS

### What the repo already configures

| Piece | Where | Value |
|---|---|---|
| Bundle id | `app.config.js` `variant.bundleId` | `box.stage` (prod, `APP_VARIANT=prod`), `box.metro.monitor` (dev) |
| Notification Service Extension | `plugins/withXmtpNotificationService.js` | target `StageNotificationService`, bundle id `<bundle id>.StageNotificationService` |
| App group | same plugin | `group.<bundle id>`, i.e. `group.box.stage` / `group.box.metro.monitor`, on the app and on the extension |
| `aps-environment` | `app.config.js` `ios.entitlements` | `production` for prod, `development` for dev. Xcode rewrites it to match the provisioning profile at export, so store, TestFlight and EAS internal builds all end up on production APNs |
| Associated domains | `app.config.js` | `applinks:` + `webcredentials:` for `stage.box` / `dev.stage.box` |
| Background modes | same plugin | `remote-notification`, so the silent welcome-topic pushes can wake the app |
| `ITSAppUsesNonExemptEncryption` | `app.config.js` `ios.config.usesNonExemptEncryption: false` | see below |
| Usage descriptions | plugins + `ios.infoPlist` | camera, photo library (read + add), microphone, location when in use, Face ID (the secure-store sentinel that gates revealing a recovery phrase or key) |
| EAS credentials for the extension | same plugin, written into `extra.eas.build.experimental.ios.appExtensions` | EAS creates and stores a second provisioning profile for the extension |

**Export compliance.** Stage uses encryption beyond HTTPS: MLS end-to-end encryption through XMTP, SQLCipher for the local store, secp256k1 and WebAuthn signatures for the wallet. All of it is standard, published cryptography in a mass-market consumer app, which falls under the EAR Category 5 Part 2 mass-market exemption (5D992.c; since the March 2021 BIS rule no annual self-classification report is required for it). That is the case Apple's questionnaire answers with "exempt", so the key is `false` and TestFlight builds do not stop on the export compliance question. Confirm this reading before the first public App Store release. Distribution in France is the one place that also expects an ANSSI encryption declaration for end-to-end messaging; App Store Connect asks for it under App Information -> Encryption only if you declare non-exempt encryption, so check with counsel whether to file it anyway.

### How push works on iOS

1. The app registers its APNs token (`getDevicePushTokenAsync`) and its conversation topics with `push.stage.box`, exactly like Android (`lib/pushRegister*.ts`).
2. The push server sends each envelope as an APNs alert with `mutable-content: 1` and the ciphertext in `encryptedMessage` (welcome topics go out as silent `content-available` pushes).
3. iOS hands the alert to `StageNotificationService` (Swift, `plugins/notificationService/NotificationService.swift`). It reads the account list from `stage-push-accounts.json` in the app group container, reads that account's XMTP database key from the shared keychain group, opens the account's XMTP database in the app group container with the XMTP iOS SDK (`Client.build(..., inboxId:)`, offline, device sync off), finds the conversation by topic and runs `processMessage`. A text message becomes the notification body; anything else, a failure or the 30 second budget running out falls back to "New message". The title is "Stage", the thread is the conversation, and `body.convId` makes a tap open the conversation through the existing `usePushDeepLinks` handler.
4. `processMessage` writes into the same database the app uses, so the MLS state advances once and the app does not reprocess the message.

What the app changes to make that possible (iOS only; Android and web are unchanged because they have no app group):

- The XMTP database directory moves from `Documents/<dbDir>` to `<app group container>/<dbDir>` (`lib/xmtp.dbkeyFs.ts` via `lib/xmtp.appGroup.ts`).
- The per-account XMTP database key (`xmtp.dbEncryptionKey.<accountId>`) is stored with `accessGroup: group.<bundle id>` and `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` instead of the app's private group and `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`lib/xmtp.dbkey.ts`). An app group identifier is a valid keychain access group, so no separate `keychain-access-groups` entitlement is needed. The item is still device-bound and never backed up. Only this key is shared: the keyring (recovery phrases, private keys, the Face ID sentinel) stays in the app's private group, so the extension cannot read wallet secrets. The trade-off is that the database key is readable while the phone is locked after the first unlock, which is what a notification extension needs and what every XMTP iOS client does.
- Each account that opens a client records `{ id, address, inboxId, dbDir, env }` in `stage-push-accounts.json`; deleting the account removes it (`lib/xmtp.client.ts`).
- When the app goes to the background it releases its database connection (`dropLocalDatabaseConnection`) and reconnects before the foreground resync (`lib/xmtp.dbConnection.ts`). iOS kills a suspended app that holds a SQLite lock in a shared container (`0xdead10cc`), and the extension needs the lock to write.

Migration impact: none for users, iOS has never shipped. A pre-release iOS dev build that already created a store under `Documents/` gets a fresh store and a new XMTP installation on first launch of the new build (the old key is not in the shared group, so the old database is not found); its history comes back through the history server like any new device. The orphaned `Documents/<dbDir>` folder is harmless.

### Sandbox vs production APNs

The reference server takes one `APNS_TOPIC` (bundle id) and one `APNS_MODE` per process (upstream `pkg/options/options.go`), so one instance serves exactly one bundle on one APNs environment. The `.p8` key itself works for every bundle id of the team and for both environments.

| Build | Bundle | APNs | Served by `stage-push` (`box.stage`, production) |
|---|---|---|---|
| App Store, TestFlight (`production-prod`) | `box.stage` | production | yes |
| EAS internal builds of the prod variant (`development-prod`, `preview-prod`, ad hoc) | `box.stage` | production | yes |
| EAS internal builds of the dev variant (`development`, `preview`) | `box.metro.monitor` | production | no, wrong topic |
| Local `expo run:ios` debug builds | either | sandbox | no |

The simplest way to test iOS push is a `development-prod` dev client: it is signed ad hoc, uses `box.stage`, and the existing instance serves it. For `box.metro.monitor` builds, run a second instance; nothing is deployed for it today:

```
fly apps create stage-push-dev --org stage-labs
fly secrets set --app stage-push-dev DATABASE_URL='postgres://...separate database...' \
  FCM_CREDENTIALS_JSON="$(cat firebase-service-account.json)" \
  APNS_P8_CERTIFICATE="$(cat AuthKey_KEYID.p8)" APNS_KEY_ID=KEYID APNS_TEAM_ID=TEAMID
cd apps/push
fly deploy --app stage-push-dev --ha=false --config fly.toml --dockerfile Dockerfile \
  --env APNS_TOPIC=box.metro.monitor --env APNS_MODE=production
fly certs add push-dev.stage.box --app stage-push-dev
```

It needs its own database (two listeners on one database would share installations), `APNS_MODE=development` only if it is meant for local Xcode builds, and the dev variant pointed at it with `EXPO_PUBLIC_PUSH_SERVER_URL=https://push-dev.stage.box` in the `development` and `preview` build profiles. Android dev builds would then register there too, which is why the FCM credential is included.

### Checklist: what you do in Apple's portals

Do these in order. EAS can create App IDs, capabilities and app groups itself through the API key (capability sync), but doing them by hand first makes the first build predictable and costs nothing.

1. **Team ID.** developer.apple.com -> Account -> Membership details. Save it as the `APPLE_TEAM_ID` secret.
2. **App group.** Certificates, Identifiers & Profiles -> Identifiers -> `+` -> App Groups -> description `Stage`, identifier `group.box.stage`. For dev builds also `group.box.metro.monitor`.
3. **App ID for the app.** Identifiers -> `+` -> App IDs -> App -> Explicit bundle id `box.stage`, description `Stage`. Enable **Push Notifications**, **App Groups** (Configure -> tick `group.box.stage`) and **Associated Domains**. Save.
4. **App ID for the extension.** Identifiers -> `+` -> App IDs -> App -> Explicit bundle id `box.stage.StageNotificationService`, description `Stage Notification Service`. Enable **App Groups** (Configure -> `group.box.stage`). It does not need Push Notifications. For dev builds repeat 3 and 4 with `box.metro.monitor` and `box.metro.monitor.StageNotificationService` and `group.box.metro.monitor`.
5. **APNs key.** Keys -> `+` -> name `Stage APNs`, tick **Apple Push Notifications service (APNs)**, Configure -> environment **Sandbox & Production**, key restriction **Team Scoped (All Topics)**. Continue, Register, Download `AuthKey_<KEYID>.p8` (downloadable once; keep it in a password manager, never in the repo). Note the Key ID.
6. **App Store Connect app record.** appstoreconnect.apple.com -> Apps -> `+` -> New App: platform iOS, name `Stage` (pick a variant if taken), primary language, bundle id `box.stage`, SKU `stage-ios`, user access Full. Then App Information -> Apple ID: save it as the `ASC_APP_ID` secret. Fill App Privacy before the first external TestFlight or App Store submission.
7. **App Store Connect API key for EAS.** Users and Access -> Integrations -> App Store Connect API -> Team Keys -> Generate API Key, name `EAS`, access **Admin** (EAS creates the distribution certificate, both provisioning profiles and syncs capabilities with it; App Manager is enough only for uploads). Download the `.p8` once. Save the Key ID as `ASC_API_KEY_ID`, the Issuer ID shown above the table as `ASC_API_KEY_ISSUER_ID`, and the full file contents as `ASC_API_KEY_P8`.
8. **TestFlight internal testers.** App Store Connect -> the app -> TestFlight -> Internal Testing -> `+` -> group `Internal`, enable automatic distribution, add testers. Internal testers must be users of the App Store Connect team (Users and Access -> `+`, any role). External testers need a Beta App Review and are optional.
9. **GitHub secrets.** Repo Settings -> Secrets and variables -> Actions: `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_API_KEY_P8`, `APPLE_TEAM_ID`, `ASC_APP_ID`. `APPLE_TEAM_TYPE` only if you want to override the `COMPANY_OR_ORGANIZATION` default. `EXPO_TOKEN` is already set. No EAS environment variables.
10. **Seed the signing credentials once.** From a terminal logged in to Expo: `cd apps/stage && APP_VARIANT=prod bunx eas-cli credentials -p ios`, pick the `production-prod` profile, and let EAS generate the distribution certificate and the provisioning profiles for `box.stage` and `box.stage.StageNotificationService` (sign in with the API key or your Apple ID). A non-interactive CI build can reuse stored credentials but may refuse to create them. If you would rather try CI first, run the workflow with `platform: ios`; if it fails on missing credentials, do this step and rerun.
11. **APNs on the push server.** With the key from step 5:
    ```
    fly secrets set --app stage-push \
      APNS_P8_CERTIFICATE="$(cat AuthKey_KEYID.p8)" APNS_KEY_ID=KEYID APNS_TEAM_ID=TEAMID
    cd apps/push && fly deploy --ha=false --config fly.toml --dockerfile Dockerfile
    fly ssh console --app stage-push -C ps
    ```
    The process arguments must include `--apns-enabled`. `APNS_TOPIC=box.stage` and `APNS_MODE=production` are already in `fly.toml`. See the sandbox section above for dev bundles.
12. **Team ID in the AASA file.** Replace both `TEAMID` placeholders in `apps/stage/public/.well-known/apple-app-site-association` with the Team ID and commit (it is public: it ships in every signed binary). Without it iOS passkeys (`webcredentials:stage.box`) and universal links do not work.
13. **Release.** Actions -> Release Mobile -> Run workflow -> `platform: ios`, or bump `version` in `app.config.js`.

### What CI does for iOS

The `ios` job in `release-mobile.yml`:

1. Checks the five Apple secrets and skips the whole job with a warning while any is missing, so Android releases keep working.
2. Writes the API key to `apps/stage/asc-api-key.p8` and merges the key id, issuer id, team id and app id into `submit.production.ios` of `eas.json` inside the runner.
3. `eas build -p ios --profile production-prod --non-interactive` on EAS: the build server runs prebuild (which adds the extension target, its Swift source, Info.plist, entitlements and the `XMTP` pod pinned to the version the React Native SDK uses), signs both targets with the stored credentials, and uploads the IPA. The build number is managed remotely by EAS.
4. `eas submit -p ios --profile production` uploads that build to App Store Connect, where it appears in TestFlight after processing and goes to the internal group automatically.
5. Deletes the key file and restores `eas.json`.

### Open risks

- **Extension memory.** Notification Service Extensions are limited to about 24 MB. Building an XMTP client and opening the SQLCipher store fits in XMTP's own iOS apps, but it has not been measured here. If the extension is killed, iOS shows the original "New message from XMTP" alert text from the server, so a message is never lost, only the preview.
- **Not compiled locally.** The Swift was type-checked against a stub of the XMTP API (from the XMTP iOS SDK source at `ios-4.10.0-rc2`) and the prebuild output was inspected, but no Xcode build or `pod install` has run. The first EAS iOS build is the real compile.
- **Extension version numbers.** The extension's Info.plist uses `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)`, set at prebuild from `version` and build number 1. EAS updates the version of every target it signs; if App Store Connect ever warns that the extension's `CFBundleVersion` differs from the app's, that is where to look.
- **Several accounts.** The extension tries each account in the manifest until one knows the topic. If two local accounts share a group, only the first one decrypts in the extension; the other catches up when the app opens.
- **Foreground suppression.** Android skips the card while the app is in the foreground or the conversation is open; iOS currently shows a banner through `setNotificationHandler` in both cases.

## Costs and limits

EAS cloud builds are metered per build; the free tier has a monthly cap and builds queue when it is exhausted. Each release uses two Android builds (AAB for Play, APK for sideload) and one iOS build.
