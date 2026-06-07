#!/usr/bin/env bash
#
# served-drift-check.sh - fail when served-main diverges from main beyond an allowlist.
#
# Compares two refs (default origin/main vs origin/served-main) and reports any
# files whose content differs. Files matching the allowlist below are expected to
# differ on the served branch (none by default - served-main should be a pure
# layer over main) and are reported but do not fail the check.
#
# Exit codes:
#   0  no non-allowlisted divergence
#   1  non-allowlisted files diverge (drift!)
#   2  usage / git error
#
# Usage:
#   scripts/served-drift-check.sh [BASE_REF] [SERVED_REF]
#   scripts/served-drift-check.sh origin/main origin/served-main
#
set -euo pipefail

BASE="${1:-origin/main}"
SERVED="${2:-origin/served-main}"

# Files allowed to differ on served-main without tripping the guard.
# Keep this EMPTY for a pure fresh-from-main model. Add globs here only if you
# intentionally carry a served-only override (and document why in the PR).
ALLOWLIST_GLOBS=(
  # e.g. "apps/app/app.config.served.ts"
)

for ref in "$BASE" "$SERVED"; do
  git rev-parse --verify --quiet "$ref^{commit}" >/dev/null || {
    echo "::error::ref not found: $ref" >&2
    exit 2
  }
done

DIFF_FILES=()
while IFS= read -r f; do
  [ -n "$f" ] && DIFF_FILES+=("$f")
done < <(git diff --name-only "$BASE" "$SERVED" || true)

if [ "${#DIFF_FILES[@]}" -eq 0 ]; then
  echo "OK: $SERVED is content-identical to $BASE. No drift."
  exit 0
fi

is_allowlisted() {
  local f="$1" g
  for g in "${ALLOWLIST_GLOBS[@]:-}"; do
    [ -n "$g" ] || continue
    # shellcheck disable=SC2053
    [[ "$f" == $g ]] && return 0
  done
  return 1
}

OFFENDERS=()
ALLOWED=()
for f in "${DIFF_FILES[@]}"; do
  if is_allowlisted "$f"; then
    ALLOWED+=("$f")
  else
    OFFENDERS+=("$f")
  fi
done

# Emit a GitHub-flavored step summary when available.
{
  echo "## served-drift-guard"
  echo
  echo "Comparing \`$SERVED\` against \`$BASE\`."
  echo
  if [ "${#ALLOWED[@]}" -gt 0 ]; then
    echo "Allowlisted diffs (ignored): ${#ALLOWED[@]}"
    printf '  - `%s`\n' "${ALLOWED[@]}"
    echo
  fi
  if [ "${#OFFENDERS[@]}" -gt 0 ]; then
    echo "**Drift detected in ${#OFFENDERS[@]} non-allowlisted file(s):**"
    printf '  - `%s`\n' "${OFFENDERS[@]}"
    echo
    echo "Run \`bun run served:reset\` (dry-run first) to rebase served-main onto main."
  fi
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/stdout}" >/dev/null

if [ "${#OFFENDERS[@]}" -gt 0 ]; then
  echo "::error::served-main has drifted from $BASE in ${#OFFENDERS[@]} file(s):" >&2
  printf '  %s\n' "${OFFENDERS[@]}" >&2
  exit 1
fi

echo "OK: only allowlisted files differ (${#ALLOWED[@]}). No unexpected drift."
exit 0
