#!/usr/bin/env bash
# publish-selfhosted.sh — SELF-HOSTED variant of the PR preview (#236).
#
# The default PR-preview path uses EAS Update (reuses EXPO_TOKEN, no new infra).
# This script is the alternative for when you'd rather host the bundle yourself
# (no Expo CDN dependency). It:
#   1. `expo export`s the JS bundle (android) into a dist dir,
#   2. generates a STATIC expo-updates manifest (scripts/pr-preview/generate-manifest.mjs),
#   3. uploads dist/ to a static host under a per-PR path,
#   4. prints the dev-client deep link.
#
# It needs a static host the CI runner can WRITE to. The daemon's apk.metro.box
# (python http.server over /private/tmp/apkserve via cloudflared) is read-only
# from CI's perspective — there is no upload endpoint — so this script targets an
# S3-compatible bucket (Cloudflare R2 recommended: same Cloudflare account as the
# metro.box zone). Set these env vars / GH secrets:
#   PR_PREVIEW_BUCKET    e.g. s3://metro-pr-preview
#   PR_PREVIEW_BASE_URL  public base, e.g. https://pr-preview.metro.box
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_ENDPOINT_URL_S3 (R2 endpoint)
#
# Usage: PR=236 ./scripts/pr-preview/publish-selfhosted.sh
set -euo pipefail

: "${PR:?set PR to the pull-request number}"
: "${PR_PREVIEW_BUCKET:?set PR_PREVIEW_BUCKET (s3://… R2 bucket)}"
: "${PR_PREVIEW_BASE_URL:?set PR_PREVIEW_BASE_URL (public https base)}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/apps/app"
DIST="$(mktemp -d)/pr-${PR}"
RUNTIME_VERSION="${RUNTIME_VERSION:-1.0.0}"   # MUST match app.config.js runtimeVersion
SCHEME="${SCHEME:-metro}"
BASE="${PR_PREVIEW_BASE_URL%/}/pr-${PR}/"

echo "→ expo export (android) for PR #${PR}"
( cd "$APP" && bunx expo export --platform android --output-dir "$DIST" )

echo "→ generate static manifest"
node "$ROOT/scripts/pr-preview/generate-manifest.mjs" \
  --dist "$DIST" --platform android \
  --base-url "$BASE" --runtime-version "$RUNTIME_VERSION"

echo "→ upload dist/ → ${PR_PREVIEW_BUCKET}/pr-${PR}/"
# --content-type is preserved per-file by aws s3 sync's mime guessing; force the
# manifest to application/json (the dev-client requires it).
aws s3 sync "$DIST" "${PR_PREVIEW_BUCKET}/pr-${PR}/" --delete ${AWS_ENDPOINT_URL_S3:+--endpoint-url "$AWS_ENDPOINT_URL_S3"}
aws s3 cp "$DIST/manifest.json" "${PR_PREVIEW_BUCKET}/pr-${PR}/manifest.json" \
  --content-type application/json ${AWS_ENDPOINT_URL_S3:+--endpoint-url "$AWS_ENDPOINT_URL_S3"}

MANIFEST_URL="${BASE}manifest.json"
DEEPLINK="${SCHEME}://expo-development-client/?url=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$MANIFEST_URL")"
echo "deeplink=${DEEPLINK}"
