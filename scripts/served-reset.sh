#!/usr/bin/env bash
#
# served-reset.sh - keep the served-main worktree a thin layer over origin/main.
#
# The bundler serves a long-lived `served-main` branch for hot-reload. Over time
# it merges main into itself and drifts. This script resets the served worktree
# to a pristine copy of origin/main, then (optionally) re-applies ONLY an explicit
# list of still-open topic commits/branches you want to keep on top.
#
# Defaults to a PURE reset to origin/main (no topic commits preserved).
#
# SAFETY: this is destructive (hard reset + force-push). Always run --dry-run
# first. It refuses to run unless you point it at a worktree explicitly and pass
# --yes for the live mutation.
#
# Usage:
#   scripts/served-reset.sh --dry-run
#   scripts/served-reset.sh --dry-run --keep <branch-or-sha> [--keep <branch-or-sha> ...]
#   scripts/served-reset.sh --yes [--keep <branch-or-sha> ...]
#
# Flags:
#   --dry-run            Print the plan, change nothing. (default if --yes absent)
#   --yes                Actually perform the reset (hard reset + cherry-pick).
#   --keep <ref>         Cherry-pick this branch/sha on top of main. Repeatable.
#                        A branch ref expands to its commits not already in main.
#   --worktree <path>    Path to the served worktree. Default: $SERVED_WORKTREE
#                        or the current git worktree.
#   --branch <name>      Served branch name. Default: served-main.
#   --remote <name>      Remote. Default: origin.
#   --push               After reset, force-push the branch to the remote.
#                        (Only with --yes. Off by default.)
#   -h, --help           Show this help.
#
set -euo pipefail

REMOTE="origin"
BRANCH="served-main"
WORKTREE="${SERVED_WORKTREE:-}"
DRY_RUN=1
CONFIRM=0
DO_PUSH=0
KEEPS=()

die() { echo "error: $*" >&2; exit 1; }
note() { echo "  $*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --yes) CONFIRM=1; DRY_RUN=0; shift ;;
    --keep) [ $# -ge 2 ] || die "--keep needs a ref"; KEEPS+=("$2"); shift 2 ;;
    --worktree) [ $# -ge 2 ] || die "--worktree needs a path"; WORKTREE="$2"; shift 2 ;;
    --branch) [ $# -ge 2 ] || die "--branch needs a name"; BRANCH="$2"; shift 2 ;;
    --remote) [ $# -ge 2 ] || die "--remote needs a name"; REMOTE="$2"; shift 2 ;;
    --push) DO_PUSH=1; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) die "unknown arg: $1" ;;
  esac
done

# Resolve worktree.
if [ -z "$WORKTREE" ]; then
  WORKTREE="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not in a git repo; pass --worktree"
fi
[ -d "$WORKTREE/.git" ] || [ -f "$WORKTREE/.git" ] || die "not a git worktree: $WORKTREE"

cd "$WORKTREE"

echo "served-reset plan"
echo "  worktree : $WORKTREE"
echo "  branch   : $BRANCH"
echo "  remote   : $REMOTE"
echo "  keep     : ${KEEPS[*]:-(none - pure reset to $REMOTE/main)}"
echo "  push     : $([ "$DO_PUSH" = 1 ] && echo yes || echo no)"
echo "  mode     : $([ "$DRY_RUN" = 1 ] && echo DRY-RUN || echo APPLY)"
echo

# Refuse to nuke uncommitted local changes silently.
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: worktree has uncommitted changes; a hard reset will DISCARD them:" >&2
  git status --short >&2
  [ "$DRY_RUN" = 1 ] || die "refusing to reset a dirty worktree without review; commit/stash first"
fi

echo "1. fetch $REMOTE"
[ "$DRY_RUN" = 1 ] || git fetch "$REMOTE" --prune

# Expand each --keep ref into its commits not already in origin/main.
declare -a PICK_SHAS=()
for ref in "${KEEPS[@]:-}"; do
  [ -n "$ref" ] || continue
  if ! git rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
    die "keep ref not found: $ref"
  fi
  # Commits on <ref> but not on origin/main, oldest first.
  while IFS= read -r sha; do
    [ -n "$sha" ] && PICK_SHAS+=("$sha")
  done < <(git rev-list --reverse "$REMOTE/main..$ref")
done

echo "2. checkout $BRANCH (create/track if needed)"
note "git checkout -B $BRANCH $REMOTE/main"

echo "3. hard reset $BRANCH -> $REMOTE/main"
note "git reset --hard $REMOTE/main"

if [ "${#PICK_SHAS[@]}" -gt 0 ]; then
  echo "4. cherry-pick ${#PICK_SHAS[@]} preserved commit(s):"
  for sha in "${PICK_SHAS[@]}"; do
    note "$(git log -1 --oneline "$sha")"
  done
else
  echo "4. no commits to cherry-pick (pure reset to $REMOTE/main)"
fi

if [ "$DO_PUSH" = 1 ]; then
  echo "5. force-push: git push --force-with-lease $REMOTE $BRANCH"
else
  echo "5. (push skipped; pass --push to publish)"
fi

if [ "$DRY_RUN" = 1 ]; then
  echo
  echo "DRY-RUN complete. Re-run with --yes to apply."
  exit 0
fi

[ "$CONFIRM" = 1 ] || die "internal: apply without --yes"

echo
echo "Applying..."
git checkout -B "$BRANCH" "$REMOTE/main"
git reset --hard "$REMOTE/main"

for sha in "${PICK_SHAS[@]:-}"; do
  [ -n "$sha" ] || continue
  echo "cherry-pick $(git log -1 --oneline "$sha")"
  if ! git cherry-pick "$sha"; then
    echo "cherry-pick failed for $sha; resolve conflicts then 'git cherry-pick --continue', or --abort." >&2
    exit 1
  fi
done

if [ "$DO_PUSH" = 1 ]; then
  git push --force-with-lease "$REMOTE" "$BRANCH"
fi

echo "done. $BRANCH is now $REMOTE/main$([ "${#PICK_SHAS[@]}" -gt 0 ] && echo " + ${#PICK_SHAS[@]} preserved commit(s)")."
