# Play production release (fully automated)

Ships the **Stage** app (`applicationId box.stage`) to Google Play.

## Why it works the way it does

EAS **cloud** builds of the `production` profile are **broken** — the Railgun /
nodejs-mobile bundle-JS phase fails in the EAS cloud builder. So the signed AAB
must be built **locally on the Mac** (full native toolchain: node 18, JDK 17,
Android SDK). GitHub-hosted runners can't do that, so the automation runs on a
**self-hosted runner on the Mac**.

There is one piece of logic — `scripts/release-production.sh` — and two ways to
invoke it:

| Path | How | Infra needed |
|------|-----|--------------|
| **Primary: GitHub Actions** | `.github/workflows/play-release.yml`, `runs-on: self-hosted` | self-hosted runner on the Mac (one-time setup) |
| **Fallback: run by hand** | `scripts/release-production.sh [track]` on the Mac | none — works today |

Both produce the AAB with `eas build --local` and submit it with `eas submit`.

## What the script does

1. Writes the Play service-account JSON to `apps/app/play-service-account.json`
   (from `$PLAY_SERVICE_ACCOUNT_JSON`), validates it, and scrubs it on exit.
2. **Syncs the versionCode.** `eas.json` uses `appVersionSource: local`, so a
   stale counter would bake a duplicate versionCode and Play would reject it.
   The script reads the counter (`eas build:version:get`), increments it, and
   pushes it back (`eas build:version:set`).
3. Builds a signed AAB locally: `eas build --local -p android --profile production`
   with `APP_VARIANT=prod` (the Stage variant).
4. Submits to the chosen Play track via `eas submit`.

## eas.json submit profiles

`apps/app/eas.json` has two submit profiles, both keyed to `box.stage` +
`./play-service-account.json`:

- `production` → track `production`, `releaseStatus: completed`
- `internal` → track `internal`, `releaseStatus: completed`

The script maps `track` to a profile: `production`/`internal` use the matching
profile; `alpha`/`beta` reuse the `production` profile and override `--track`.

## Triggers (Actions)

- **Manual:** Actions → "Play production release" → Run workflow → pick a
  `track` (default `production`).
- **Tag:** `git tag v0.2.0 && git push origin v0.2.0` → releases to
  `production`.

## Secrets needed (repo Settings → Secrets → Actions)

- `PLAY_SERVICE_ACCOUNT_JSON` — full JSON of a Google Play service account with
  "Release to production / testing tracks" permission. **Not yet set.**
- `EXPO_TOKEN` — EAS access token. Already present in the repo.

## One-time self-hosted runner setup (on the Mac)

From repo Settings → Actions → Runners → New self-hosted runner (macOS), copy
the token, then run the three commands it shows — they look like:

```sh
# 1. Download + unpack the runner (into e.g. ~/actions-runner)
mkdir -p ~/actions-runner && cd ~/actions-runner && \
  curl -fsSL -o r.tar.gz <url-from-github> && tar xzf r.tar.gz

# 2. Configure against the repo (token is shown on the New-runner page)
./config.sh --url https://github.com/bonustrack/metro --token <RUNNER_TOKEN>

# 3. Run it (foreground; or `./svc.sh install && ./svc.sh start` for a service)
./run.sh
```

The runner inherits the Mac's environment, so make sure node 18, JDK 17, and
`ANDROID_HOME` (`~/Library/Android/sdk`) are available to its shell. The script
defaults `ANDROID_HOME` and warns on a non-18 node, but the toolchain itself
must already be installed.

## Run by hand (no Actions)

```sh
PLAY_SERVICE_ACCOUNT_JSON="$(cat ~/secrets/play-sa.json)" \
EXPO_TOKEN="$(grep EXPO_TOKEN ~/.config/metro/.env | cut -d= -f2)" \
scripts/release-production.sh production
```
