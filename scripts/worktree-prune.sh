#!/usr/bin/env bash
#
# worktree-prune.sh - clean up stale agent worktrees under .claude/worktrees.
#
# Background agents create throwaway worktrees in .claude/worktrees/. They pile
# up (dozens-to-hundreds) and slow down git operations. This helper lists them,
# runs `git worktree prune` (drops registrations whose dir is already gone), and
# can remove worktrees that are clean and not currently checked out.
#
# Usage:
#   scripts/worktree-prune.sh             # list + prune dangling registrations (safe)
#   scripts/worktree-prune.sh --dry-run   # show what --remove would do, change nothing
#   scripts/worktree-prune.sh --remove    # also remove clean worktrees under .claude/worktrees
#
# --remove only deletes worktrees that:
#   - live under .claude/worktrees/
#   - have a clean working tree (no uncommitted changes)
#   - are not the current worktree
# Worktrees with uncommitted changes are kept and reported, never force-removed.
#
set -euo pipefail

MODE="prune"
case "${1:-}" in
  --dry-run) MODE="dry" ;;
  --remove)  MODE="remove" ;;
  "")        MODE="prune" ;;
  -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
  *) echo "unknown arg: $1" >&2; exit 1 ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "Registered worktrees:"
git worktree list

echo
echo "Pruning dangling registrations (git worktree prune)..."
[ "$MODE" = "dry" ] && git worktree prune --dry-run || git worktree prune

if [ "$MODE" = "prune" ]; then
  echo
  echo "Done. Pass --remove to also delete clean worktrees under .claude/worktrees."
  exit 0
fi

CUR="$(git rev-parse --show-toplevel)"
echo
echo "Scanning .claude/worktrees for removable (clean) worktrees..."

# Parse porcelain output into per-worktree paths.
git worktree list --porcelain | awk '/^worktree /{print $2}' | while IFS= read -r wt; do
  case "$wt" in
    *"/.claude/worktrees/"*) ;;
    *) continue ;;
  esac
  [ "$wt" = "$CUR" ] && { echo "skip (current): $wt"; continue; }
  if [ ! -d "$wt" ]; then
    echo "gone (will prune): $wt"
    continue
  fi
  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
    echo "KEEP (dirty): $wt"
    continue
  fi
  if [ "$MODE" = "dry" ]; then
    echo "would remove: $wt"
  else
    echo "removing: $wt"
    git worktree remove "$wt" || echo "  (remove failed; try: git worktree remove --force '$wt')"
  fi
done

echo
echo "Done."
