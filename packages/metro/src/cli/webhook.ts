/** CLI subcommands: `metro call`, `metro trains list`, `metro webhook ...`, `metro tunnel ...`. */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ipcCall } from '../ipc.js';
import { loadMetroEnv } from '../paths.js';
import { TRAINS_DIR } from '../trains/supervisor.js';
import {
  addEndpoint, listEndpoints, loadTunnelConfig, removeEndpoint, saveTunnelConfig, webhookPort,
} from '../tunnel.js';
import { emit, exitErr, flagOne, isJson, need, writeJson, type Flags } from './util.js';
import { enforceSendGuard } from './send-guard.js';

function urlFor(endpointId: string): string {
  const t = loadTunnelConfig();
  return t ? `https://${t.hostname}/wh/${endpointId}` : `http://127.0.0.1:${webhookPort()}/wh/${endpointId}`;
}

export async function cmdWebhook(p: string[], f: Flags): Promise<void> {
  const sub = p[0];
  if (sub === 'add')    return cmdWebhookAdd(p.slice(1), f);
  if (sub === 'list' || sub === undefined) return cmdWebhookList(f);
  if (sub === 'remove' || sub === 'rm') return cmdWebhookRemove(p.slice(1), f);
  throw exitErr('usage: metro webhook [add <label> [--secret=…] | list | remove <id>]', 1);
}

async function cmdWebhookAdd(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro webhook add <label> [--secret=<shared-secret>]');
  const ep = addEndpoint(p[0], flagOne(f, 'secret'));
  const url = urlFor(ep.id);
  emit(f, `webhook ${ep.id} (${ep.label}) → ${url}${ep.secret ? `\nshared secret: ${ep.secret}` : ''}`,
    { ok: true, endpoint: ep, url });
}

async function cmdWebhookList(f: Flags): Promise<void> {
  const eps = listEndpoints().map(ep => ({ ...ep, url: urlFor(ep.id) }));
  if (isJson(f)) return writeJson({ endpoints: eps });
  if (!eps.length) return void process.stdout.write('metro webhooks\n\n  (none — run `metro webhook add <label>`)\n\n');
  process.stdout.write('metro webhooks\n\n');
  for (const ep of eps) {
    process.stdout.write(`  ${ep.id}  ${ep.label}${ep.secret ? '  (signed)' : ''}\n        ${ep.url}\n`);
  }
  process.stdout.write('\n');
}

async function cmdWebhookRemove(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro webhook remove <id>');
  const ok = removeEndpoint(p[0]);
  if (!ok) throw exitErr(`no webhook with id "${p[0]}"`, 1);
  emit(f, `removed webhook ${p[0]}`, { ok: true, id: p[0] });
}

export async function cmdTunnel(p: string[], f: Flags): Promise<void> {
  const sub = p[0];
  if (sub === 'setup') return cmdTunnelSetup(p.slice(1), f);
  if (sub === 'status' || sub === undefined) return cmdTunnelStatus(f);
  throw exitErr('usage: metro tunnel [setup <name> <hostname> | status]', 1);
}

async function cmdTunnelSetup(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro tunnel setup <tunnel-name> <hostname>     (e.g. `metro tunnel setup metro webhook.example.com`)');
  const [name, hostname] = p;
  if (!hasCloudflared()) {
    throw exitErr('cloudflared not on PATH — install with `brew install cloudflared` (or see https://developers.cloudflare.com/cloudflared/)', 2);
  }
  /** Idempotent: if tunnel exists, `tunnel create` errors with "already exists" — that's fine, continue. */
  run('cloudflared', ['tunnel', 'create', name], { allowFail: true });
  /** DNS route is also idempotent in newer cloudflared; older versions error if the CNAME exists. Same handling. */
  run('cloudflared', ['tunnel', 'route', 'dns', name, hostname], { allowFail: true });
  saveTunnelConfig({ name, hostname });
  emit(f,
    `tunnel saved: ${name} → ${hostname}\n` +
    'first run: `cloudflared tunnel login` if you haven\'t (browser OAuth).\n' +
    'then start metro — the daemon will spawn `cloudflared tunnel run` for you.',
    { ok: true, name, hostname });
}

async function cmdTunnelStatus(f: Flags): Promise<void> {
  const cfg = loadTunnelConfig();
  if (isJson(f)) return writeJson({ configured: !!cfg, tunnel: cfg });
  if (!cfg) return void process.stdout.write('metro tunnel\n\n  (not configured — run `metro tunnel setup <name> <hostname>`)\n\n');
  process.stdout.write(`metro tunnel\n\n  name:     ${cfg.name}\n  hostname: ${cfg.hostname}\n\n`);
}

const hasCloudflared = (): boolean => spawnSync('cloudflared', ['--version'], { stdio: 'ignore' }).status === 0;

function run(cmd: string, args: string[], opts: { allowFail?: boolean } = {}): void {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0 && !opts.allowFail) throw exitErr(`${cmd} ${args.join(' ')} exited ${r.status}`, 2);
}

/* ──────────── metro call <train> <action> [args]  +  metro trains list ──────────── */

async function readArgs(raw: string | undefined): Promise<unknown> {
  if (raw === undefined) return {};
  if (raw === '-') {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    const s = Buffer.concat(chunks).toString('utf8').trim();
    return s ? JSON.parse(s) : {};
  }
  if (raw.startsWith('@')) return JSON.parse(readFileSync(raw.slice(1), 'utf8'));
  /** Bare string allowed (handed to the train as-is). */
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function cmdCall(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro call <train> <action> [args-json | @file | -]');
  loadMetroEnv();
  const [train, action, rawArgs] = p;
  const args = await readArgs(rawArgs);
  /** Per-session identity guard: refuse to send XMTP on an account owned by a */
  /** different CLI (e.g. a codex session sending on tony's account). */
  enforceSendGuard(train, action, args);
  const resp = await ipcCall({ op: 'forward-call', train, action, args });
  if (!resp.ok) throw new Error(resp.error);
  if (!('response' in resp)) throw new Error('daemon returned malformed forward-call response');
  if (resp.response.error) throw new Error(`train '${train}': ${resp.response.error}`);
  if (isJson(f)) writeJson(resp.response.result ?? null);
  else process.stdout.write(JSON.stringify(resp.response.result ?? null) + '\n');
}

export async function cmdTrains(p: string[], f: Flags): Promise<void> {
  const sub = p[0] ?? 'list';
  if (sub === 'restart') return cmdTrainsRestart(p.slice(1), f);
  if (sub === 'new') return cmdTrainsNew(p.slice(1), f);
  if (sub !== 'list') throw new Error(`metro trains <list|restart|new>   (got '${sub}')`);
  loadMetroEnv();
  const resp = await ipcCall({ op: 'trains-list' });
  if (!resp.ok) throw new Error(resp.error);
  if (!('trains' in resp)) throw new Error('daemon returned malformed trains-list response');
  if (isJson(f)) return writeJson({ trains: resp.trains });
  if (!resp.trains.length) {
    process.stdout.write('metro trains\n\n  (no trains in ~/.metro/trains/)\n');
    return;
  }
  process.stdout.write('metro trains\n\n');
  for (const t of resp.trains) {
    const mark = t.running ? '●' : '○';
    const pid = t.pid ? ` pid ${t.pid}` : '';
    const started = t.startedAt ? ` since ${t.startedAt.slice(11, 19)}` : '';
    const fails = t.failCount ? ` · ${t.failCount} fail${t.failCount === 1 ? '' : 's'}` : '';
    process.stdout.write(`  ${mark} ${t.name.padEnd(16)}${pid}${started}${fails}\n        ${t.path}\n`);
  }
  process.stdout.write('\n');
}

async function cmdTrainsRestart(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro trains restart <name>');
  loadMetroEnv();
  const resp = await ipcCall({ op: 'train-restart', name: p[0] });
  if (!resp.ok) throw new Error(resp.error);
  emit(f, `restarted train '${p[0]}'`, { ok: true, name: p[0] });
}

/** dist/cli/webhook.js → <package-root>/examples/telegram.ts */
const bundledExample = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples', 'telegram.ts');

async function cmdTrainsNew(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro trains new <name>');
  const name = p[0];
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw exitErr(`bad train name '${name}' (use [A-Za-z0-9_-])`, 1);
  const src = bundledExample();
  if (!existsSync(src)) throw exitErr(`bundled example missing at ${src} (broken install?)`, 2);
  mkdirSync(TRAINS_DIR, { recursive: true });
  const dest = join(TRAINS_DIR, `${name}.ts`);
  if (existsSync(dest)) throw exitErr(`train already exists: ${dest}`, 1);
  copyFileSync(src, dest);
  const metroPkg = join(homedir(), '.metro', 'package.json');
  const pkgHint = existsSync(metroPkg) ? '' : '\n  (run `cd ~/.metro && bun init` first if your train needs deps)';
  emit(f,
    `created ${dest}${pkgHint}\n  next: edit the file, then \`metro trains restart ${name}\``,
    { ok: true, path: dest, pkgInitialized: existsSync(metroPkg) });
}
