# Play release (automated)

Ships the **Stage** app (`applicationId box.stage`) to Google Play, paid and
automatic.

## Design

```
push to main  ->  GitHub Action  ->  EAS CLOUD build  ->  eas submit x3 tracks
(every merge)     (ubuntu-latest)    (production-prod)     internal / closed / production
```

`.github/workflows/play-release.yml` runs on a GitHub-hosted runner. It kicks
off an **EAS cloud build** of the `production-prod` profile (EAS does the heavy
native build in its cloud, ~$1-2 per build) and then `eas submit`s that **same
build id** to three Play tracks: `internal`, `closed` (alpha), `production`.

No self-hosted runner. The Mac is not involved.

### Triggers

| Trigger | Effect |
|---------|--------|
| **push to `main`** | primary path - every merge builds + submits to internal + closed (+ production if the gate allows). |
| **workflow_dispatch** | manual run; pick one track (`internal` / `closed` / `production`). |
| **push tag `v*`** | optional; same as a main push. |

### Concurrency

`group: play-release`, `cancel-in-progress: true` - **latest wins**. A newer
merge cancels a queued or in-flight release so a stale commit never ships behind
a fresher one.

### Production gate

The `Submit -> production` step is `continue-on-error: true`. While the Play
**production** track is account-gated (new app), that submit fails but the run
stays green: internal + closed still ship. The job Summary prints a note with
the build id and the exact `eas submit ... --profile production --id <id>`
command to re-run by hand once the gate lifts.

### versionCode

`apps/app/eas.json` uses `appVersionSource: remote` and the `production-prod`
profile sets `autoIncrement: true`, so **EAS bumps the versionCode in the cloud
on every build**. No local counter sync, no hand-edited `versionCode`.

## Secrets

Repo Settings -> Secrets and variables -> Actions:

| Secret | Status | Purpose |
|--------|--------|---------|
| `EXPO_TOKEN` | already set | authenticates the EAS CLI for build + submit. |
| `PLAY_SERVICE_ACCOUNT_JSON` | **needed from Less** | full JSON of a Google Play service account with "Release to testing/production tracks". Written to `apps/app/play-service-account.json` at runtime (referenced by `serviceAccountKeyPath` in `eas.json`) and scrubbed on exit. |

That is the only thing gating the automation: paste the service-account JSON
into `PLAY_SERVICE_ACCOUNT_JSON` once.

## eas.json submit profiles

`apps/app/eas.json` has three submit profiles, all keyed to `box.stage` +
`./play-service-account.json`:

- `internal`  -> track `internal`
- `closed`    -> track `alpha` (Google's API name for the closed track)
- `production`-> track `production`

## Watching a release

1. Actions tab -> **Play release** -> the run for your merge.
2. The `Cloud build` step prints the EAS build id and a build URL
   (`expo.dev/.../builds/<id>`) where you can watch the cloud build live.
3. The `Submit -> *` steps stream `eas submit` progress per track.
4. The run **Summary** lists the build id, the submitted tracks, and (if
   production was gated) the re-run command.

## Manual fallback

`scripts/release-production.sh [internal|closed|production|alpha|beta]` does a
**local** `eas build --local` + `eas submit` on the Mac (full native toolchain:
node 18, JDK 17, Android SDK). Use it only if the cloud build is wedged. It
writes the service-account key from `$PLAY_SERVICE_ACCOUNT_JSON`, syncs the
versionCode, builds the AAB locally, submits, and scrubs the key.
