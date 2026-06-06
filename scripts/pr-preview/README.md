# PR preview — single clickable row (#256)

The PR preview shows as **one** clickable `Preview` row in GitHub Checks (Details →
opens the dev-client launcher directly), exactly like Netlify — no second
"Actions job" row.

## Why this design

A GitHub Actions job **always** emits its own check row whose Details points at
the run logs; that target can't be customised. Only a *commit status*
(`target_url`) carries a custom link, and a Check Run made by `github-actions[bot]`
has its `details_url` overridden — so running the build on Actions forces a
second, uncustomisable row.

Netlify avoids this because its build runs on Netlify infra (not Actions) and
reports a single GitHub-App check. We mirror that: the build runs on the **metro
daemon**, triggered by the existing GitHub webhook, and POSTs a single `Preview`
commit status. No Actions workflow runs → only one row.

## Components

- **`daemon-watcher.mjs`** — long-running process. Tails the daemon's webhook
  events (`metro tail --station webhook --include-webhooks --follow`), and for a
  `pull_request` `opened`/`synchronize`/`reopened` on `bonustrack/metro`:
  1. `eas update --branch pr-<n>` (publishes the JS bundle),
  2. POSTs `Preview` commit status (`target_url=metro.box/preview-launcher.html?u=<manifest>`).
  Serializes per-PR; skips fork PRs; restarts itself if `metro tail` exits.
- **`deeplink.mjs`** — shared: `eas update --json` → manifest URL + deep link.
- **`eas-deeplink.mjs`** — thin CLI wrapper (used by the fallback workflow).
- **`com.metro.preview-watcher.plist`** — launchd unit to keep the watcher alive.
- **`generate-manifest.mjs` / `publish-selfhosted.sh`** — alternative self-hosted
  bundle path (R2), unused by default.
- **`.github/workflows/pr-preview.yml`** — now a **manual fallback only**
  (`workflow_dispatch` with a `pr` input). It no longer runs on `pull_request`,
  so it adds no extra row. Dispatch it if the daemon is down.

## Running the watcher

Requirements on the daemon host:
- `EXPO_TOKEN` (read automatically from `~/.config/metro/.env`).
- A GitHub token with `repo:status` scope in `GITHUB_TOKEN`/`GH_TOKEN`, else
  falls back to `gh auth token`.
- `node`, `metro`, `gh`, `bunx` on PATH.

```sh
# foreground (from the metro checkout root):
node scripts/pr-preview/daemon-watcher.mjs

# or as a launchd agent (edit WorkingDirectory in the plist first):
cp scripts/pr-preview/com.metro.preview-watcher.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.metro.preview-watcher.plist
# logs: /tmp/metro-preview-watcher.{out,err}.log
```

The watcher streams live (`--since tail`) — it only processes PR events that
arrive while it's running, so a restart never replays old PRs.
