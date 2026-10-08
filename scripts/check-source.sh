#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

check() {
  printf '\n::group::%s\n' "$*"
  "$@"
  printf '::endgroup::\n'
}

check bun run lint
check bun run typecheck
check bun run knip
check bun run madge
check bun run build
check bun test scripts/test
check bun test apps/stage/scripts/test/typographyLint.test.mjs
check bun run test
