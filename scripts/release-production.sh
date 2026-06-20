#!/usr/bin/env bash
#
# release-production.sh — MANUAL FALLBACK: local Play release for the Stage app
# (applicationId box.stage), runnable on the Mac with ZERO CI infrastructure.
#
# The primary release path is the cloud GitHub Action
# (.github/workflows/play-release.yml): every merge to main triggers an EAS
# CLOUD build that auto-submits to Play. Use THIS script only when you need to
# release by hand (e.g. the cloud build is wedged) — it builds the signed AAB
# LOCALLY (eas build --local) and submits it via eas submit. See
# docs/play-release.md.
#
# WHAT IT DOES (end to end):
#   1. Writes the Play service-account JSON to apps/app/play-service-account.json
#      (from $PLAY_SERVICE_ACCOUNT_JSON, or you can drop the file there yourself).
#   2. Syncs the versionCode: reads the current Play/EAS counter
#      (`eas build:version:get`), increments it, and pushes it back
#      (`eas build:version:set`). appVersionSource is "local", so without this an
#      EAS-cloud-incremented or stale counter would bake a DUPLICATE versionCode
#      into the local build and Play would reject the upload.
#   3. Builds a signed AAB LOCALLY: `eas build --local -p android --profile
#      production` (APP_VARIANT=prod = the Stage variant).
#   4. Submits the AAB to the requested Play track (default: production) via
#      `eas submit`, picking the matching eas.json submit profile.
#   5. Scrubs the service-account key.
#
# USAGE:
#   PLAY_SERVICE_ACCOUNT_JSON="$(cat path/to/sa.json)" \
#   EXPO_TOKEN=... \
#   scripts/release-production.sh [track]
#
#   track: production (default) | internal | alpha | beta
#          production/internal map to the eas.json submit profiles of the same
#          name; alpha/beta reuse the production submit profile and override the
#          track on the command line.
#
# REQUIREMENTS (Mac, one-time):
#   - node 18 (the build pins node 18.20.4 via eas.json; nvm/asdf or system).
#   - JDK 17 + Android SDK; ANDROID_HOME / ANDROID_SDK_ROOT exported.
#   - eas-cli installed (npx eas-cli works too) and EXPO_TOKEN set (or `eas login`).
#   - bun deps installed at the repo root (this script does NOT run bun install —
#     see MEMORY: no bun install in worktrees).
#
set -euo pipefail

# ─── Locate repo + app dir (script lives in <repo>/scripts) ──────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/app"
SA_PATH="$APP_DIR/play-service-account.json"

TRACK="${1:-production}"

# eas submit reads track + serviceAccountKeyPath from a submit profile. We have
# two named profiles (production→track production, internal→track internal). For
# alpha/beta we reuse the production profile and override --track on the CLI.
case "$TRACK" in
  production) SUBMIT_PROFILE="production"; TRACK_OVERRIDE="" ;;
  internal)   SUBMIT_PROFILE="internal";  TRACK_OVERRIDE="" ;;
  alpha|beta) SUBMIT_PROFILE="production"; TRACK_OVERRIDE="--track $TRACK" ;;
  *) echo "ERROR: unknown track '$TRACK' (use production|internal|alpha|beta)" >&2; exit 1 ;;
esac

# eas-cli runner: prefer a globally-installed eas, else npx.
if command -v eas >/dev/null 2>&1; then
  EAS=(eas)
else
  EAS=(npx --yes eas-cli)
fi

echo "==> Stage Play release  (track=$TRACK, profile=$SUBMIT_PROFILE)"
echo "==> repo:   $REPO_ROOT"
echo "==> app:    $APP_DIR"

# ─── node 18 sanity (the build hard-requires it; node 20+ breaks gradle/expo) ─
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" != "18" ]; then
  echo "WARNING: node major is $NODE_MAJOR, expected 18. eas.json pins node 18.20.4"
  echo "         for the build; a mismatched host node can break the local build."
fi

# ─── Android SDK sanity ──────────────────────────────────────────────────────
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  DEFAULT_SDK="$HOME/Library/Android/sdk"
  if [ -d "$DEFAULT_SDK" ]; then
    export ANDROID_HOME="$DEFAULT_SDK"
    export ANDROID_SDK_ROOT="$DEFAULT_SDK"
    echo "==> ANDROID_HOME unset; defaulting to $DEFAULT_SDK"
  else
    echo "ERROR: ANDROID_HOME / ANDROID_SDK_ROOT not set and $DEFAULT_SDK missing." >&2
    exit 1
  fi
fi

# Keep the Gradle daemon from being killed mid-build under memory pressure and
# reuse it across this script's invocations (faster repeat builds).
export GRADLE_OPTS="${GRADLE_OPTS:-} -Dorg.gradle.daemon=true -Dorg.gradle.jvmargs=-Xmx4g"

# ─── 1. Service-account key ──────────────────────────────────────────────────
if [ -n "${PLAY_SERVICE_ACCOUNT_JSON:-}" ]; then
  printf '%s' "$PLAY_SERVICE_ACCOUNT_JSON" > "$SA_PATH"
  echo "==> Wrote service-account key from \$PLAY_SERVICE_ACCOUNT_JSON"
fi
if [ ! -f "$SA_PATH" ]; then
  echo "ERROR: $SA_PATH missing. Set \$PLAY_SERVICE_ACCOUNT_JSON or drop the file there." >&2
  exit 1
fi
# Validate JSON early — eas submit fails cryptically on a bad key.
node -e "JSON.parse(require('fs').readFileSync('$SA_PATH','utf8'))" \
  || { echo "ERROR: $SA_PATH is not valid JSON" >&2; exit 1; }

# Always scrub the key on exit (success or failure).
cleanup() { rm -f "$SA_PATH"; }
trap cleanup EXIT

cd "$APP_DIR"

# ─── 2. Sync versionCode (appVersionSource: local) ───────────────────────────
# Read the current remote counter, bump it, and push it back so the local build
# bakes a fresh, monotonic versionCode that Play has not seen before.
echo "==> Syncing versionCode"
CUR="$(APP_VARIANT=prod "${EAS[@]}" build:version:get -p android --profile production --non-interactive 2>/dev/null \
        | grep -oE '[0-9]+' | tail -1 || true)"
if [ -z "$CUR" ]; then
  echo "WARNING: could not read remote versionCode; falling back to app.config.js value."
  CUR="$(node -p "require('./app.config.js').expo.android.versionCode" 2>/dev/null || echo 0)"
fi
NEXT=$((CUR + 1))
echo "==> versionCode: $CUR -> $NEXT"
APP_VARIANT=prod "${EAS[@]}" build:version:set -p android --profile production \
  --non-interactive <<<"$NEXT" >/dev/null 2>&1 || \
  echo "WARNING: build:version:set non-interactive may need EXPO_TOKEN; continuing."

# ─── 3. Build the signed AAB LOCALLY ─────────────────────────────────────────
echo "==> Building signed AAB locally (this can take 20-40 min)"
AAB_OUT="$APP_DIR/metro-stage-production.aab"
rm -f "$AAB_OUT"
APP_VARIANT=prod "${EAS[@]}" build \
  --local \
  --platform android \
  --profile production \
  --non-interactive \
  --output "$AAB_OUT"

if [ ! -f "$AAB_OUT" ]; then
  echo "ERROR: local build produced no AAB at $AAB_OUT" >&2
  exit 1
fi
echo "==> Built: $AAB_OUT"

# ─── 4. Submit to Play ───────────────────────────────────────────────────────
echo "==> Submitting to Play track '$TRACK' (profile '$SUBMIT_PROFILE')"
# shellcheck disable=SC2086  # TRACK_OVERRIDE is intentionally word-split (empty or "--track x")
APP_VARIANT=prod "${EAS[@]}" submit \
  --platform android \
  --profile "$SUBMIT_PROFILE" \
  --path "$AAB_OUT" \
  $TRACK_OVERRIDE \
  --non-interactive

echo "==> Done. Released versionCode $NEXT to Play track '$TRACK'."
