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
| `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_API_KEY_P8` | ios | App Store Connect -> Users and Access -> Integrations -> App Store Connect API -> Team Keys -> Generate (role: App Manager). The `.p8` downloads once; paste its full contents into `ASC_API_KEY_P8`. |
| `APPLE_TEAM_ID` | ios | developer.apple.com -> Account -> Membership details -> Team ID. |
| `ASC_APP_ID` | ios | App Store Connect -> the app -> App Information -> Apple ID (numeric). |

Variables (not secrets): `APPLE_TEAM_TYPE` = `INDIVIDUAL` (default) or `COMPANY_OR_ORGANIZATION`.

## One-time Apple setup

1. Enrol in the Apple Developer Program. A wallet app needs an organisation account for App Store review (guideline 3.1.5), but TestFlight works with either.
2. In App Store Connect create the app record with bundle id `box.stage` and note its Apple ID for `ASC_APP_ID`.
3. Create the API key above and add the secrets. EAS uses the key to create and store the distribution certificate and provisioning profile on the first build; nothing is done on a Mac.
4. Run the workflow manually with `platform: ios` once to seed the credentials and confirm the TestFlight upload.

After the first upload, replace the `TEAMID` placeholder in `apps/stage/public/.well-known/apple-app-site-association` with the real Team ID so passkeys and universal links work on iOS.

## Costs and limits

EAS cloud builds are metered per build; the free tier has a monthly cap and builds queue when it is exhausted. Each release uses two Android builds (AAB for Play, APK for sideload) and one iOS build.
