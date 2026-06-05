# Per-PR JS-bundle previews (#236)

Tap a link on a PR → the installed **Metro dev-client** loads that PR's JS bundle.
One installed app can preview any PR, so multiple ready PRs can be reviewed in
parallel without each piling onto the served branch.

## How it works

```
PR (label `preview` or `/preview` comment)
  → .github/workflows/pr-preview.yml
    → eas update --branch pr-<n>     (expo export + upload + manifest, on Expo CDN)
    → comment deep link + QR on the PR
Less taps:  metro://expo-development-client/?url=https://u.expo.dev/<projectId>/group/<groupId>
  → dev-client (with expo-updates) fetches the manifest + JS bundle + assets
  → app reloads on this PR's JS
```

The deep link is the dev-launcher's standard "load from URL" form. The dev-client
reads the manifest (an [expo-updates v1](https://docs.expo.dev/technical-specs/expo-updates-1/)
object), then pulls the Hermes bundle + assets and swaps its JS.

## The one native unlock

The "load a published bundle from a URL" flow **requires the `expo-updates`
library on-device**. This is wired in this PR:

- `apps/app/package.json` → `expo-updates`
- `apps/app/app.config.js` → `updates` block + `runtimeVersion: '1.0.0'`

These are **native build-time** settings: a **new dev-client APK** must be built
and installed once. After that, every PR is tap-to-load with **no further native
work**. Until that APK is on the device, the deep link has no updates client to
honor it.

> Build it once: `cd apps/app && eas build --profile development --platform android`
> (or `--local`). Install, then previews work for all PRs.

## JS-only limitation (guarded)

A preview ships **JS only**. A PR that changes native code — new/updated native
modules, `android/`/`ios/`, `app.config.js`, `eas.json`, or any `package.json`
(native dep) — will run the **old** native code under the new JS and may crash.
The workflow detects native-touching diffs and posts a warning telling the
reviewer to build an **APK** for that PR instead.

The `runtimeVersion` is a fixed string. The installed APK only accepts manifests
whose `runtimeVersion` matches it, which is itself a guard: bump `runtimeVersion`
whenever you ship a native-incompatible change in a new APK, and stale previews
are automatically rejected rather than crashing.

## Triggers (opt-in, to spare CI/EAS quota)

- Add the **`preview`** label to a PR, or
- Comment **`/preview`** on a PR.

The job upserts a single preview comment (re-runs replace it, no stacking).

## Files

- `.github/workflows/pr-preview.yml` — the Action.
- `scripts/pr-preview/eas-deeplink.mjs` — `eas update --json` → deep link.
- `scripts/pr-preview/generate-manifest.mjs` — `expo export` dir → static
  expo-updates manifest (used by the self-hosted variant).
- `scripts/pr-preview/publish-selfhosted.sh` — alternative: host the bundle
  yourself (R2/S3) instead of Expo's CDN.

## Why EAS Update (and not the daemon's static host)

The default uses **EAS Update** because it reuses the existing `EXPO_TOKEN` repo
secret + the existing Expo project (`extra.eas.projectId`), needs **zero new
infra**, generates the manifest for us, and is free-tier friendly for this
volume. `eas update` runs the same `expo export` and serves the same artifact —
it's the export bundle on Expo's CDN with a spec-correct manifest.

The daemon's `apk.metro.box` (python `http.server` over `/private/tmp/apkserve`,
behind cloudflared) is **read-only from CI** — there's no upload endpoint, and
the 25 MB+ Hermes bundle exceeds the Discord/blob 25 MB caps anyway. The
self-hosted variant (`publish-selfhosted.sh`) therefore targets an
**S3-compatible bucket (Cloudflare R2** — same account as the `metro.box` zone)
and a `pr-preview.metro.box` public base. Use it only if avoiding Expo's CDN
matters; it needs new R2 credentials as GH secrets.
