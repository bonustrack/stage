/** `metro review` — per-branch Expo dev bundlers for parallel PR review. Each
 *  issue/branch gets its own worktree + port + pr<n>-bundler.metro.box tunnel so
 *  one dev client switches branches via a deep link. Infra in review-infra.ts. */

import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg } from '../log.js';
import { emit, exitErr, isJson, writeJson, type Flags } from './util.js';
import {
  cfTunnelToken, deepLink, ensureTunnel, ensureWorktree, freePort, isAlive,
  issueKey, load, LOG_DIR, run, save, teardown, waitForHttp, WORKTREE_BASE, HOST_SUFFIX,
  type Review, type Store,
} from './review-infra.js';

/** Resolve the branch for an issue via its linked PR; else treat arg as a branch. */
function resolveBranch(arg: string): { branch: string; issue: string; prUrl?: string } {
  if (/^\d+$/.test(arg)) {
    const r = run('gh', ['pr', 'list', '--state', 'open', '--search', arg,
      '--json', 'number,headRefName,url', '--limit', '20']);
    if (r.ok && r.out) {
      try {
        const prs = JSON.parse(r.out) as { number: number; headRefName: string; url: string }[];
        const match = prs.find(p => String(p.number) !== arg) ?? prs[0];
        if (match) return { branch: match.headRefName, issue: arg, prUrl: match.url };
      } catch { /* fall through */ }
    }
    throw exitErr(`no open PR linked to issue #${arg}; pass the branch explicitly: metro review <branch>`, 1);
  }
  return { branch: arg, issue: issueKey(arg) };
}

async function start(arg: string, f: Flags): Promise<void> {
  const store = load();
  const { branch, issue, prUrl } = resolveBranch(arg);

  const existing = store.reviews.find(r => r.issue === issue);
  if (existing && isAlive(existing.bundlerPid)) {
    emit(f, summary(existing, 'already running'), { ok: true, reused: true, review: existing });
    return;
  }
  if (existing) prune(store, existing.issue);

  const hostname = `pr${issue}${HOST_SUFFIX}`;
  const url = `https://${hostname}`;
  const tunnelName = `metro-review-${issue}`;
  const worktree = join(WORKTREE_BASE, `review-${issue}`);
  const port = freePort(store);

  ensureWorktree(worktree, branch);
  ensureTunnel(tunnelName, hostname);

  mkdirSync(LOG_DIR, { recursive: true });
  const bundlerLog = join(LOG_DIR, `bundler-${issue}.log`);
  const tunnelLog = join(LOG_DIR, `tunnel-${issue}.log`);
  const bOut = openSync(bundlerLog, 'a');
  const tOut = openSync(tunnelLog, 'a');

  const token = cfTunnelToken(tunnelName);
  const tArgs = ['--no-autoupdate', 'tunnel', 'run', '--url', `http://127.0.0.1:${port}`];
  if (!token) tArgs.push(tunnelName);
  const tunnelChild = spawn('cloudflared', tArgs, {
    detached: true, stdio: ['ignore', tOut, tOut],
    env: token ? { ...process.env, TUNNEL_TOKEN: token } : process.env,
  });
  tunnelChild.unref();

  const bundlerChild = spawn('npx', ['expo', 'start', '--port', String(port)], {
    cwd: join(worktree, 'apps', 'app'),
    detached: true, stdio: ['ignore', bOut, bOut],
    env: { ...process.env, EXPO_PACKAGER_PROXY_URL: url, EXPO_NO_TELEMETRY: '1' },
  });
  bundlerChild.unref();

  const review: Review = {
    issue, branch, worktree, port, hostname, url, deepLink: deepLink(url), tunnelName,
    bundlerPid: bundlerChild.pid ?? 0, tunnelPid: tunnelChild.pid ?? 0,
    ...(prUrl ? { prUrl } : {}), startedAt: new Date().toISOString(),
  };
  store.reviews.push(review);
  save(store);

  const ready = await waitForHttp(`${url}/status`, 60_000);
  emit(f, summary(review, ready ? 'ready' : 'starting (tunnel not yet 200 — check logs)'),
    { ok: true, ready, review, logs: { bundler: bundlerLog, tunnel: tunnelLog } });
}

function list(f: Flags): void {
  const store = load();
  const rows = store.reviews.map(r => ({ ...r, alive: isAlive(r.bundlerPid), tunnelAlive: isAlive(r.tunnelPid) }));
  if (isJson(f)) return writeJson({ ok: true, reviews: rows });
  if (!rows.length) { process.stdout.write('metro review — no active review bundlers\n'); return; }
  process.stdout.write('metro review — active bundlers\n\n');
  for (const r of rows) {
    process.stdout.write(
      `  #${r.issue}  ${r.alive ? 'up' : 'DEAD'}  :${r.port}  ${r.branch}\n` +
      `      ${r.url}\n      ${r.deepLink}\n\n`);
  }
}

function stop(arg: string, f: Flags): void {
  const store = load();
  const targets = arg === 'all' ? store.reviews.map(r => r.issue) : [issueKey(arg)];
  const stopped: string[] = [];
  for (const issue of targets) {
    const r = store.reviews.find(x => x.issue === issue);
    if (!r) continue;
    teardown(r);
    stopped.push(issue);
  }
  store.reviews = store.reviews.filter(r => !stopped.includes(r.issue));
  save(store);
  emit(f, stopped.length ? `stopped: ${stopped.map(s => '#' + s).join(', ')}` : 'nothing to stop',
    { ok: true, stopped });
}

function prune(store: Store, issue: string): void {
  const r = store.reviews.find(x => x.issue === issue);
  if (r) teardown(r);
  store.reviews = store.reviews.filter(x => x.issue !== issue);
  save(store);
}

function summary(r: Review, status: string): string {
  return [
    `review #${r.issue} — ${status}`,
    `  branch:   ${r.branch}`,
    `  bundler:  http://127.0.0.1:${r.port}`,
    `  tunnel:   ${r.url}`,
    r.prUrl ? `  PR:       ${r.prUrl}` : '',
    `  launch:   ${r.deepLink}`,
  ].filter(Boolean).join('\n');
}

const USAGE = `metro review — dynamic per-branch Expo dev bundlers for parallel PR review.

Usage:
  metro review <issue#|branch>     Start (or reuse) a dedicated bundler + tunnel for that
                                   issue's PR branch; prints a dev-client launch link.
  metro review list                List running review bundlers.
  metro review stop <issue#|branch|all>
                                   Tear down a review's bundler, tunnel, DNS, and worktree.

Each review gets its own git worktree (.claude/worktrees/review-<n>), Expo port (8082+),
and tunnel (pr<n>-bundler.metro.box). The served bundler (bundler.metro.box:8081) is never
touched. Tap the launch link on the device with the installed dev client to load that branch.`;

export async function cmdReview(positional: string[], f: Flags): Promise<void> {
  const sub = positional[0];
  try {
    if (!sub || sub === '--help' || sub === 'help') return void process.stdout.write(USAGE + '\n');
    if (sub === 'list') return list(f);
    if (sub === 'stop') {
      if (!positional[1]) throw exitErr('usage: metro review stop <issue#|branch|all>', 1);
      return stop(positional[1], f);
    }
    return await start(sub, f);
  } catch (err) {
    if (isJson(f)) { writeJson({ ok: false, error: errMsg(err), code: (err as { code?: number }).code ?? 1 }); return; }
    throw err;
  }
}
