#!/usr/bin/env node
/**
 * daemon-watcher.mjs — SINGLE-ROW PR preview, the Netlify way (#256).
 *
 * THE PROBLEM (#256)
 * ------------------
 * The PR preview used to run as a GitHub Actions workflow (pr-preview.yml).
 * GitHub ALWAYS renders an Actions JOB check row whose Details points at the
 * run logs — that target can't be customised. So even though we also published
 * a clickable "Preview" commit-status row, the PR showed TWO rows: the clean
 * clickable one AND the uncustomisable Actions job one. Netlify shows only ONE
 * row because its build runs on Netlify infra (NOT GitHub Actions) and reports
 * a single GitHub-App check.
 *
 * THE FIX (this file) — mirror Netlify: move the build OFF GitHub Actions onto
 * the metro daemon. The daemon already receives every GitHub webhook event on
 * the `github` webhook (metro://webhook/<id>). This watcher tails those events;
 * on a PR opened/synchronize/reopened for THIS repo it:
 *   1. runs `eas update --branch pr-<n>` (publishes the JS bundle),
 *   2. POSTs ONE commit status (context "Preview", target_url=launcher) to
 *      `/repos/<owner>/<repo>/statuses/<sha>`.
 * No GitHub Actions workflow is involved → only ONE row on the PR, exactly
 * like Netlify.
 *
 * RUN IT (persistent, on the daemon host):
 *   EXPO_TOKEN=… GITHUB_TOKEN=… node scripts/pr-preview/daemon-watcher.mjs
 * It loads ~/.config/metro/.env for EXPO_TOKEN automatically. Needs a GitHub
 * token with `repo:status` (the `repo` scope covers it) in GITHUB_TOKEN or via
 * `gh auth token`. Restartable — it streams live (tail --since tail), so it
 * only processes events that arrive while running (no backfill storm).
 *
 * WHY A STANDALONE WATCHER (not baked into the daemon core): the daemon core
 * runs from a symlinked NODE_PATH and needs a full restart to change; a
 * standalone tail-consumer is hot-swappable and self-contained. It uses the
 * public `metro tail` CLI as its event source — the same contract the monitor
 * uses — so it never reaches into daemon internals.
 */
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildPreviewLinks } from './deeplink.mjs';

const REPO = process.env.PR_PREVIEW_REPO ?? 'bonustrack/metro';
const WEBHOOK_LINE = process.env.PR_PREVIEW_WEBHOOK_LINE; // optional pin; else any webhook line
const APP_DIR = join(process.cwd(), 'apps', 'app');
const LAUNCHER = 'https://metro.box/preview-launcher.html';
const ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

/** Load EXPO_TOKEN (and any other secrets) from ~/.config/metro/.env if unset. */
function loadEnv() {
  const f = join(homedir(), '.config', 'metro', '.env');
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const log = (...a) => console.log(new Date().toISOString(), '[preview]', ...a);

async function postStatus(token, sha, state, target, description) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/statuses/${sha}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state, context: 'Preview', target_url: target, description }),
  });
  if (!res.ok) throw new Error(`status POST ${res.status}: ${await res.text()}`);
}

/** Run `eas update --branch pr-<n>` and return its parsed --json output. */
function easUpdate(pr, sha) {
  const branch = `pr-${pr}`;
  const out = execFileSync(
    'bunx',
    [
      'eas-cli@latest',
      'update',
      '--branch',
      branch,
      '--message',
      `PR #${pr} @ ${sha}`,
      '--non-interactive',
      '--json',
    ],
    { cwd: APP_DIR, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out);
}

/** Serialize per-PR so concurrent pushes to the same PR don't race eas. */
const inflight = new Map();

async function handlePR(token, pr, sha) {
  const prev = inflight.get(pr) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      log(`PR #${pr} @ ${sha.slice(0, 12)} → eas update`);
      try {
        await postStatus(token, sha, 'pending', undefined, 'Building preview…');
      } catch (e) {
        log('pending status failed (continuing):', e.message);
      }
      try {
        const raw = easUpdate(pr, sha);
        const { manifest } = buildPreviewLinks(raw);
        const target = `${LAUNCHER}?u=${encodeURIComponent(manifest)}`;
        await postStatus(token, sha, 'success', target, 'Open dev-client preview');
        log(`PR #${pr} → success: ${target}`);
      } catch (e) {
        log(`PR #${pr} FAILED:`, e.message);
        try {
          await postStatus(token, sha, 'error', undefined, 'Preview build failed');
        } catch {}
      }
    });
  inflight.set(pr, next);
  await next;
  if (inflight.get(pr) === next) inflight.delete(pr);
}

function main() {
  loadEnv();
  if (!process.env.EXPO_TOKEN) {
    console.error('FATAL: EXPO_TOKEN not set (and not in ~/.config/metro/.env)');
    process.exit(1);
  }
  const token = githubToken();
  if (!token) {
    console.error('FATAL: no GitHub token (set GITHUB_TOKEN or `gh auth login`)');
    process.exit(1);
  }
  log(`watching webhook events for ${REPO} (actions: ${[...ACTIONS].join(',')})`);

  const args = [
    'tail',
    '--station',
    'webhook',
    '--include-webhooks',
    '--follow',
    '--json',
    '--since',
    'tail',
  ];
  if (WEBHOOK_LINE) args.push('--chat', WEBHOOK_LINE);
  const child = spawn('metro', args, { stdio: ['ignore', 'pipe', 'inherit'] });

  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      const h = e?.payload?.headers ?? {};
      if (h['x-github-event'] !== 'pull_request') continue;
      const b = e?.payload?.body;
      if (!b || typeof b !== 'object') continue;
      if (b.repository?.full_name !== REPO) continue;
      if (!ACTIONS.has(b.action)) continue;
      // Skip fork PRs — they can't be previewed (EXPO_TOKEN not shared) and the
      // head sha is from an untrusted ref.
      if (b.pull_request?.head?.repo?.full_name !== REPO) {
        log(`PR #${b.number}: fork — skipping`);
        continue;
      }
      const pr = b.number;
      const sha = b.pull_request?.head?.sha;
      if (pr && sha) handlePR(token, pr, sha);
    }
  });

  child.on('exit', (code) => {
    console.error(`metro tail exited (${code}); restarting in 5s`);
    setTimeout(main, 5000);
  });
}

main();
