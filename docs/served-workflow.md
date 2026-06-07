# served-main workflow

`served-main` is the long-lived branch the dev bundler (bundler.metro.box -> :8081)
serves so Less's dev client hot-reloads. The intent is that **`served-main` is a
thin, disposable layer over `origin/main`**, not a parallel line of development.

## The model

- Real work lands on `main` via per-issue PRs (squash-merged by the maintainer).
- `served-main` should equal `origin/main` plus, at most, a small explicit set of
  still-open topic commits you are actively testing on device.
- It is **disposable**: you can reset it to `origin/main` at any time and lose
  nothing, because all merged work is already on `main`.

Drift happens when `served-main` instead keeps merging `main` into itself and
accumulates redundant history / orphan changes. That is what the tooling below
prevents and cleans up.

## Resetting served-main: `served:reset`

Hard-resets the served branch/worktree to `origin/main`, then optionally
cherry-picks an explicit list of topic commits to keep on top.

```bash
# Always dry-run first - prints the exact plan, changes nothing:
bun run served:reset -- --dry-run

# Pure reset to origin/main (drop all served-only history):
bun run served:reset -- --yes --push

# Reset but preserve a topic branch you are still testing on device:
bun run served:reset -- --dry-run --keep feat/some-topic
bun run served:reset -- --yes --keep feat/some-topic --push
```

Flags: `--keep <branch-or-sha>` (repeatable), `--worktree <path>`,
`--branch <name>` (default `served-main`), `--remote <name>` (default `origin`),
`--push` (force-push-with-lease after reset), `--yes` (actually apply).
See `scripts/served-reset.sh --help`.

> SAFETY: this is destructive (hard reset, force-push). It refuses to reset a
> dirty worktree without review and never pushes unless you pass `--push`. The
> live cutover (repointing the bundler at a fresh worktree) is a manual step done
> with the maintainer; this script does the branch surgery, not the bundler.

## Catching drift early: the CI guard

`.github/workflows/served-drift-guard.yml` runs daily (and on demand via
`workflow_dispatch`). It runs `scripts/served-drift-check.sh`, comparing the
pushed `origin/served-main` against `origin/main`, and **fails** if any
non-allowlisted file content differs. The job summary lists the diverging files.

If it fails: run `served:reset` to bring `served-main` back to `main`. If a file
is *intentionally* served-only, add its glob to `ALLOWLIST_GLOBS` in
`scripts/served-drift-check.sh` and explain why in the PR.

CI can only see the pushed branch, not the local served worktree. Keep the
worktree in sync by pushing it (or by using `served:reset --push`).

## Cleaning stale worktrees: `worktree:prune`

Background agents leave throwaway worktrees under `.claude/worktrees/`. They pile
up and slow git down.

```bash
bun run worktree:prune              # list + drop dangling registrations (safe)
bun run worktree:prune -- --dry-run # preview what --remove would delete
bun run worktree:prune -- --remove  # also remove clean worktrees under .claude/worktrees
```

`--remove` only deletes worktrees that are clean (no uncommitted changes) and not
the current one. Dirty worktrees are kept and reported. See
`scripts/worktree-prune.sh --help`.
