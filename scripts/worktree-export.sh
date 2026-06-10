#!/usr/bin/env bash
#
# worktree-export.sh - isolated OTA-preview export from a git worktree.
#
# THE PROBLEM (DX audit P1)
# -------------------------
# A fresh `git worktree add` only checks out TRACKED files. node_modules is
# gitignored, so the worktree has no dependency tree at all. The two failure
# modes workers hit when they tried to share main's tree:
#
#   1. Workspace-package ESCAPE. apps/app/node_modules/@stage-labs/client is a
#      RELATIVE symlink `-> ../../../../packages/client`. If the whole
#      apps/app/node_modules is shared from main, that link resolves to MAIN's
#      packages/client, so a branch preview silently bundles main's client
#      source (the getCacheHash crash / "my edit isn't in the bundle" reports).
#
#   2. bun NON-HOISTED store. Every dep (react/jsx-runtime, @babel/runtime,
#      expo-router, ...) is a symlink into <root>/node_modules/.bun. A fresh
#      worktree has no .bun store, so `expo export` cannot resolve anything.
#
# THE FIX (what this script wires)
# --------------------------------
# We never run `bun install` in the worktree (the Railgun libnode.so blows the
#  disk). Instead we point the worktree at MAIN's already-installed store and
#  then override ONLY the workspace packages so they come from the WORKTREE:
#
#   * worktree/node_modules            -> symlink to MAIN/node_modules
#       (the full .bun store + every hoisted dep; babel/runtime, react, etc.)
#   * worktree/packages/<p>/node_modules -> symlink to MAIN/packages/<p>/node_modules
#       (each workspace pkg's transitive deps - viem/zod for client, the RN
#        peers for kit - resolved from main's store, the audit's helper-symlink.)
#   * worktree/apps/app/node_modules   -> a REAL directory whose every entry is
#       a symlink to the matching entry in MAIN/apps/app/node_modules, EXCEPT
#       the workspace scopes (@stage-labs/*, @metro-labs/*) which are rewritten
#       to ABSOLUTE symlinks into the WORKTREE's own packages/* (fixes #1), and
#       react/react-native/react-native-svg which stay pinned to main's single
#       copy (matches metro.config.js extraNodeModules - one React instance).
#
# Net effect: Metro resolves react/jsx-runtime + @babel/runtime + every node dep
# from main's store, but every `@stage-labs/*` / `@metro-labs/*` import resolves
# to the worktree's edited source. expo export runs from the worktree with no
# detached-checkout dance.
#
# USAGE
#   scripts/worktree-export.sh [WORKTREE_PATH] [--update "<message>"]
#     WORKTREE_PATH   defaults to the current git worktree (cwd).
#     --update MSG    after a clean export + parse-gate, run
#                     `eas update --branch <sanitised-branch>` with MSG.
#
set -euo pipefail

# ---- args -------------------------------------------------------------------
WORKTREE=""
UPDATE_MSG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --update)
      UPDATE_MSG="${2:?--update needs a message}"; shift 2 ;;
    --update=*)
      UPDATE_MSG="${1#--update=}"; shift ;;
    -h|--help)
      sed -n '2,40p' "$0"; exit 0 ;;
    *)
      WORKTREE="$1"; shift ;;
  esac
done

# ---- resolve worktree + main roots -----------------------------------------
if [ -z "$WORKTREE" ]; then
  WORKTREE="$(git rev-parse --show-toplevel)"
fi
WORKTREE="$(cd "$WORKTREE" && pwd -P)"

# The MAIN worktree is the one whose path has no linked-worktree gitdir, i.e. the
# `git worktree list` entry that the others were forked from. We take the first
# entry of `git worktree list` evaluated from inside the worktree - git always
# lists the main working tree first.
MAIN=""
while IFS= read -r _line; do
  case "$_line" in
    "worktree "*) MAIN="${_line#worktree }"; break ;;
  esac
done < <(git -C "$WORKTREE" worktree list --porcelain)
MAIN="$(cd "$MAIN" && pwd -P)"

if [ "$MAIN" = "$WORKTREE" ]; then
  echo "error: $WORKTREE is the MAIN worktree; run this from a linked worktree." >&2
  echo "       (export directly from main without this script.)" >&2
  exit 1
fi

echo "worktree: $WORKTREE"
echo "main:     $MAIN"

for must in "$MAIN/node_modules/.bun" "$MAIN/apps/app/node_modules"; do
  if [ ! -e "$must" ]; then
    echo "error: main store missing ($must). Run \`bun install\` in $MAIN first." >&2
    exit 1
  fi
done

# ---- link helper: force-replace dest with an absolute symlink to src --------
link() {
  local src="$1" dest="$2"
  rm -rf "$dest"
  mkdir -p "$(dirname "$dest")"
  ln -s "$src" "$dest"
}

# ---- 1. root + workspace-package stores point at main -----------------------
# Root store: the entire .bun + hoisted tree.
link "$MAIN/node_modules" "$WORKTREE/node_modules"

# Discover the workspace packages apps/app consumes (workspace:* deps), so we
# only wire what's actually imported and stay correct if packages are added.
# (bash 3.2 on macOS has no `mapfile`; read into an array via a while-loop.)
WS_PKGS=()
while IFS= read -r _pkg; do
  [ -n "$_pkg" ] && WS_PKGS+=("$_pkg")
done < <(
  node -e '
    const fs=require("fs");
    const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const deps={...p.dependencies,...p.devDependencies};
    for(const[k,v]of Object.entries(deps))
      if(typeof v==="string"&&v.startsWith("workspace:"))console.log(k);
  ' "$WORKTREE/apps/app/package.json"
)
echo "workspace deps of apps/app: ${WS_PKGS[*]:-<none>}"

# Resolve a workspace dep NAME to its packages/* dir by reading each pkg's
# `name` field. (bash 3.2 has no associative arrays, so this is a scan.)
pkg_dir_for() {
  local want="$1" pj name
  for pj in "$WORKTREE"/packages/*/package.json; do
    [ -e "$pj" ] || continue
    name="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).name||"")' "$pj")"
    if [ "$name" = "$want" ]; then
      dirname "$pj"
      return 0
    fi
  done
  return 1
}

# Each workspace pkg gets its transitive deps from main's per-package store
# (the audit's helper-symlink pattern: packages/<p>/node_modules -> main).
for name in "${WS_PKGS[@]+"${WS_PKGS[@]}"}"; do
  dir="$(pkg_dir_for "$name")" || continue
  rel="${dir#"$WORKTREE/"}"
  if [ -e "$MAIN/$rel/node_modules" ]; then
    link "$MAIN/$rel/node_modules" "$WORKTREE/$rel/node_modules"
  fi
done

# ---- 2. apps/app/node_modules: mirror main, override workspace + RN ----------
APP_NM="$WORKTREE/apps/app/node_modules"
MAIN_APP_NM="$MAIN/apps/app/node_modules"
rm -rf "$APP_NM"
mkdir -p "$APP_NM"

# 2a. Mirror every top-level entry (and scope dir) of main's app node_modules as
#     an absolute symlink. We descend one level into @scope dirs so we can later
#     replace individual workspace packages without clobbering the whole scope.
for entry in "$MAIN_APP_NM"/*; do
  [ -e "$entry" ] || continue
  base="$(basename "$entry")"
  case "$base" in
    @*)
      mkdir -p "$APP_NM/$base"
      for sub in "$entry"/*; do
        [ -e "$sub" ] || continue
        ln -s "$sub" "$APP_NM/$base/$(basename "$sub")"
      done
      ;;
    *)
      ln -s "$entry" "$APP_NM/$base"
      ;;
  esac
done

# 2b. Override the workspace packages to the WORKTREE's own source (fixes the
#     relative-symlink escape: absolute path, no ../.. hops out of the worktree).
for name in "${WS_PKGS[@]+"${WS_PKGS[@]}"}"; do
  dir="$(pkg_dir_for "$name")" || continue
  link "$dir" "$APP_NM/$name"
done

echo "resolution wired. workspace packages -> worktree source:"
for name in "${WS_PKGS[@]+"${WS_PKGS[@]}"}"; do
  printf '  %s -> %s\n' "$name" "$(readlink "$APP_NM/$name" 2>/dev/null || echo '?')"
done

# ---- 3. run the SAME export CI uses, then parse-gate the bundle -------------
cd "$WORKTREE/apps/app"
echo "running expo export (android, no-minify, no-bytecode) ..."
rm -rf dist
# expo-router (SDK 54+) hard-errors when @react-navigation/stack is imported
# unless this escape hatch is set. The app intentionally uses the stack
# navigator; a JS OTA preview never ships to users, so disable the gate (the
# documented env var) exactly as a preview build should.
export EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1
export EXPO_NO_TELEMETRY=1
bunx expo export \
  --platform android \
  --no-minify \
  --no-bytecode \
  --output-dir dist

# (no pipefail here: `head` closing the pipe early would SIGPIPE-kill `find`.)
set +o pipefail
BUNDLE="$(find dist -name '*.hbc' -o -name '*.js' | grep -E '/(_expo/static/js/android|bundles)/' | head -n1)"
set -o pipefail
if [ -z "$BUNDLE" ]; then
  echo "::error::expo export produced no Android JS bundle" >&2
  exit 1
fi
echo "parse-gating bundle: $BUNDLE"
node --check "$BUNDLE"
echo "export OK: $WORKTREE/apps/app/$BUNDLE"

# ---- 4. optional eas update -------------------------------------------------
if [ -n "$UPDATE_MSG" ]; then
  RAW_BRANCH="$(git -C "$WORKTREE" rev-parse --abbrev-ref HEAD)"
  BRANCH="$(echo "$RAW_BRANCH" | tr '/' '-' | tr -cd 'a-zA-Z0-9._-')"
  SHORT_SHA="$(git -C "$WORKTREE" rev-parse --short HEAD)"
  echo "publishing eas update to branch '$BRANCH' ..."
  bunx eas-cli@20.1.0 update \
    --branch "$BRANCH" \
    --platform android \
    --skip-bundler \
    --input-dir dist \
    --message "${RAW_BRANCH}@${SHORT_SHA} ${UPDATE_MSG}" \
    --non-interactive
fi

echo "done."
