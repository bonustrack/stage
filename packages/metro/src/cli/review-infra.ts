/** Infra helpers for `metro review`: state store, ports, cloudflared tunnel +
 *  DNS provisioning, git worktrees, and process teardown. Kept separate from the
 *  command dispatch (review.ts) to respect the package's per-file size cap. */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { STATE_DIR } from '../paths.js';
import { exitErr } from './util.js';

/** Repo root: this file lives at <repo>/packages/metro/src/cli; dist mirrors it. */
export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
export const WORKTREE_BASE = join(REPO_ROOT, '.claude', 'worktrees');
export const LOG_DIR = join(STATE_DIR, 'review-logs');
/** One-level host pr<n>-bundler.metro.box: the zone's Universal SSL cert covers
 *  *.metro.box but NOT *.bundler.metro.box (two levels → TLS handshake fails). */
export const HOST_SUFFIX = '-bundler.metro.box';
/** dev-client variant scheme (see apps/app/app.config.js — default variant). */
export const DEVCLIENT_SCHEME = 'metro';
const STATE_FILE = join(STATE_DIR, 'reviews.json');
const PORT_BASE = 8082; // 8081 is the served bundler — never reuse it.
const PORT_MAX = 8131;

export type Review = {
  issue: string;
  branch: string;
  worktree: string;
  port: number;
  hostname: string;
  url: string;
  deepLink: string;
  tunnelName: string;
  bundlerPid: number;
  tunnelPid: number;
  prUrl?: string;
  startedAt: string;
};
export type Store = { reviews: Review[] };

export function load(): Store {
  if (!existsSync(STATE_FILE)) return { reviews: [] };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Store; }
  catch { return { reviews: [] }; }
}
export function save(s: Store): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

export const isAlive = (pid: number): boolean => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

export function run(cmd: string, args: string[], cwd?: string): { ok: boolean; out: string; err: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

/** Normalize a stop/start arg to the stored issue key without a network call. */
export const issueKey = (arg: string): string =>
  /^\d+$/.test(arg) ? arg
    : arg.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 24);

/** Expo dev-client deep link that launches a given bundler URL. */
export const deepLink = (httpsUrl: string): string =>
  `${DEVCLIENT_SCHEME}://expo-development-client/?url=${encodeURIComponent(httpsUrl)}`;

export function freePort(store: Store): number {
  const used = new Set(store.reviews.map(r => r.port));
  for (let p = PORT_BASE; p <= PORT_MAX; p++) {
    if (used.has(p)) continue;
    const r = spawnSync('lsof', ['-iTCP:' + p, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    if (r.stdout && r.stdout.trim()) continue;
    return p;
  }
  throw exitErr(`no free port in ${PORT_BASE}-${PORT_MAX}`, 1);
}

export function waitForHttp(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  return new Promise(resolve => {
    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(url, { method: 'GET' });
        if (res.status >= 200 && res.status < 500) return resolve(true);
      } catch { /* not up yet */ }
      if (Date.now() > deadline) return resolve(false);
      setTimeout(tick, 1500);
    };
    void tick();
  });
}

/* ──────────── cloudflared: token + tunnel + DNS ──────────── */

function certJson(): { apiToken?: string; zoneID?: string } | null {
  const certPath = join(homedir(), '.cloudflared', 'cert.pem');
  if (!existsSync(certPath)) return null;
  try {
    const m = readFileSync(certPath, 'utf8').match(/TOKEN-----\s*([\s\S]*?)\s*-----END/);
    if (!m) return null;
    return JSON.parse(Buffer.from(m[1].replace(/\s+/g, ''), 'base64').toString('utf8'));
  } catch { return null; }
}

export const cfTunnelToken = (name: string): string | null => {
  const r = run('cloudflared', ['tunnel', 'token', name]);
  return r.ok && r.out ? r.out : null;
};

/** Create the named tunnel (idempotent) and CNAME pr<n>.bundler.metro.box → it. */
export function ensureTunnel(name: string, hostname: string): void {
  const create = run('cloudflared', ['tunnel', 'create', name]);
  if (!create.ok && !/already exists/i.test(create.err + create.out)) {
    const list = run('cloudflared', ['tunnel', 'list']);
    if (!list.out.includes(name)) throw exitErr(`tunnel create failed: ${create.err || create.out}`, 1);
  }
  const route = run('cloudflared', ['tunnel', 'route', 'dns', '--overwrite-dns', name, hostname]);
  if (!route.ok && !/already configured|record with that host/i.test(route.err + route.out)) {
    throw exitErr(`DNS route failed for ${hostname}: ${route.err || route.out}`, 1);
  }
}

/** Best-effort delete of the pr<n> CNAME via the cloudflared cert's API token. */
export function deleteDns(hostname: string): void {
  const cert = certJson();
  if (!cert?.apiToken || !cert.zoneID) return;
  const auth = ['-H', `Authorization: Bearer ${cert.apiToken}`];
  const base = `https://api.cloudflare.com/client/v4/zones/${cert.zoneID}/dns_records`;
  const lookup = run('curl', ['-s', `${base}?name=${hostname}`, ...auth]);
  try {
    const data = JSON.parse(lookup.out) as { result?: { id: string }[] };
    for (const rec of data.result ?? []) {
      run('curl', ['-s', '-X', 'DELETE', `${base}/${rec.id}`, ...auth]);
    }
  } catch { /* best-effort */ }
}

/* ──────────── git worktree + teardown ──────────── */

export function ensureWorktree(worktree: string, branch: string): void {
  run('git', ['-C', REPO_ROOT, 'fetch', 'origin', branch]);
  if (!existsSync(worktree)) {
    const add = run('git', ['-C', REPO_ROOT, 'worktree', 'add', worktree, branch]);
    if (!add.ok) {
      const add2 = run('git', ['-C', REPO_ROOT, 'worktree', 'add', '--track', '-b', branch, worktree, `origin/${branch}`]);
      if (!add2.ok) throw exitErr(`git worktree add failed: ${add.err || add2.err}`, 1);
    }
  } else {
    run('git', ['-C', worktree, 'checkout', branch]);
    run('git', ['-C', worktree, 'pull', '--ff-only']);
  }
  linkDeps(worktree);
}

/** Bun here is non-hoisted (node_modules live per-package), so a fresh worktree
 *  has none. Symlink each package's node_modules from a donor worktree that has
 *  them — instant vs a multi-minute `bun install` on every review spin. */
function linkDeps(worktree: string): void {
  const donor = findDepDonor(worktree);
  if (!donor) return; // no donor → leave it; `bun install` is the user's fallback
  for (const sub of depDirs()) {
    const dest = join(worktree, sub, 'node_modules');
    const src = join(donor, sub, 'node_modules');
    if (existsSync(dest) || !existsSync(src)) continue;
    mkdirSync(join(worktree, sub), { recursive: true });
    try { symlinkSync(src, dest, 'dir'); } catch { /* race / exists */ }
  }
}

const depDirs = (): string[] => {
  let pkgs: string[] = [];
  try { pkgs = readdirSync(join(REPO_ROOT, 'packages')).map(p => `packages/${p}`); } catch { /* none */ }
  return ['.', 'apps/app', ...pkgs];
};

/** Pick an existing worktree (not this one) whose apps/app deps are installed. */
function findDepDonor(exclude: string): string | null {
  const r = run('git', ['-C', REPO_ROOT, 'worktree', 'list', '--porcelain']);
  const paths = [...r.out.matchAll(/^worktree (.+)$/gm)].map(m => m[1]);
  for (const p of paths) {
    if (p === exclude) continue;
    if (existsSync(join(p, 'apps', 'app', 'node_modules'))) return p;
  }
  return existsSync(join(REPO_ROOT, 'apps', 'app', 'node_modules')) ? REPO_ROOT : null;
}

/** Kill bundler+tunnel groups, drop DNS, delete tunnel, remove the worktree. */
export function teardown(r: Review): void {
  for (const pid of [r.bundlerPid, r.tunnelPid]) {
    if (!pid) continue;
    try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } }
  }
  deleteDns(r.hostname);
  run('cloudflared', ['tunnel', 'cleanup', r.tunnelName]);
  run('cloudflared', ['tunnel', 'delete', '-f', r.tunnelName]);
  run('git', ['-C', REPO_ROOT, 'worktree', 'remove', '--force', r.worktree]);
}
