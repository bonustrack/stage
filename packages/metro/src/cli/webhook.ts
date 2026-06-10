/** CLI subcommands: `metro call`, `metro trains list`, `metro webhook ...`, `metro tunnel ...`. */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ipcCall } from '../ipc.js';
import { loadMetroEnv } from '../paths.js';
import { TRAINS_DIR } from '../trains/supervisor.js';
import { addEndpoint, listEndpoints, removeEndpoint } from '../tunnel.js';
import { errMsg } from '../log.js';
import { emit, exitErr, flagOne, isJson, need, writeJson, type Flags } from './util.js';
import { enforceSendGuard } from './send-guard.js';
import { isKnownCtrlVerb, validateCtrl, SchemaError } from '../schema.js';
import { validateCallArgs, type VerbOwner } from '../registry.js';
import { cmdTunnel, urlFor } from './webhook-tunnel.js';

export { cmdTunnel };

// Wrap an IPC round-trip so daemon-down surfaces as exit code 4 (distinct from
// code-1 usage / code-2 config); ipcCall's message says how to start the daemon.
async function ipc(req: Parameters<typeof ipcCall>[0]): Promise<Awaited<ReturnType<typeof ipcCall>>> {
  try {
    return await ipcCall(req);
  } catch (err) {
    throw exitErr(errMsg(err), 4);
  }
}

export async function cmdWebhook(p: string[], f: Flags): Promise<void> {
  /** Load ~/.metro/.env first so webhookPort()/urlFor print the same port the daemon listens on. */
  loadMetroEnv();
  const sub = p[0];
  if (sub === 'add')    return cmdWebhookAdd(p.slice(1), f);
  if (sub === 'list' || sub === undefined) return cmdWebhookList(f);
  if (sub === 'remove' || sub === 'rm') return cmdWebhookRemove(p.slice(1), f);
  throw exitErr('usage: metro webhook [add <label> [--secret=…] | list | remove <id>]', 1);
}

async function cmdWebhookAdd(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro webhook add <label> [--secret=<shared-secret>] [--session=<id>]');
  const ep = addEndpoint(p[0], flagOne(f, 'secret'), flagOne(f, 'session'));
  const url = urlFor(ep.id);
  const sessionLine = ep.session ? `\nbound to session: ${ep.session}` : '';
  emit(f, `webhook ${ep.id} (${ep.label}) → ${url}${ep.secret ? `\nshared secret: ${ep.secret}` : ''}${sessionLine}`,
    { ok: true, endpoint: ep, url });
}

async function cmdWebhookList(f: Flags): Promise<void> {
  const eps = listEndpoints().map(ep => ({ ...ep, url: urlFor(ep.id) }));
  if (isJson(f)) return writeJson({ endpoints: eps });
  if (!eps.length) return void process.stdout.write('metro webhooks\n\n  (none — run `metro webhook add <label>`)\n\n');
  process.stdout.write('metro webhooks\n\n');
  for (const ep of eps) {
    const tags = `${ep.secret ? '  (signed)' : ''}${ep.session ? `  → session ${ep.session}` : ''}`;
    process.stdout.write(`  ${ep.id}  ${ep.label}${tags}\n        ${ep.url}\n`);
  }
  process.stdout.write('\n');
}

async function cmdWebhookRemove(p: string[], f: Flags): Promise<void> {
  need(p, 1, 'metro webhook remove <id>');
  const ok = removeEndpoint(p[0]);
  if (!ok) throw exitErr(`no webhook with id "${p[0]}"`, 1);
  emit(f, `removed webhook ${p[0]}`, { ok: true, id: p[0] });
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

const VERB_OWNERS: readonly VerbOwner[] = ['xmtp', 'discord', 'telegram', 'core'];
const isVerbOwner = (t: string): t is VerbOwner => (VERB_OWNERS as readonly string[]).includes(t);

export async function cmdCall(p: string[], f: Flags): Promise<void> {
  need(p, 2, 'metro call <train> <action> [args-json | @file | -]');
  loadMetroEnv();
  const [train, action, rawArgs] = p;
  const args = await readArgs(rawArgs);
  // Typed control-verb schema (#16): validate CLI-side so malformed args fail fast.
  if (isKnownCtrlVerb(action) && typeof args === 'object' && args !== null) {
    try { validateCtrl(action, args); }
    catch (err) { throw exitErr(err instanceof SchemaError ? `invalid ${action} args — ${err.message}` : errMsg(err), 1); }
  }
  // Registry-driven validation: when the verb declares an `inputSchema`, validate
  // object args against it so the registry IS the validation path. Only objects
  // are checked (bare-string args pass through to the train unchanged, as today).
  if (isVerbOwner(train) && typeof args === 'object' && args !== null) {
    try { validateCallArgs(train, action, args); }
    catch (err) { throw exitErr(err instanceof SchemaError ? `invalid ${action} args — ${err.message}` : errMsg(err), 1); }
  }
  /** Per-session identity guard: refuse to send XMTP on an account owned by a */
  /** different CLI (e.g. a codex session sending on tony's account). */
  enforceSendGuard(train, action, args);
  const resp = await ipc({ op: 'forward-call', train, action, args });
  /** `resp.error` here is the daemon rejecting the request (e.g. unknown train) — code 3 (upstream). */
  if (!resp.ok) throw exitErr(resp.error, 3);
  if (!('response' in resp)) throw exitErr('daemon returned malformed forward-call response', 3);
  if (resp.response.error) throw exitErr(`train '${train}': ${resp.response.error}`, 3);
  if (isJson(f)) writeJson(resp.response.result ?? null);
  else process.stdout.write(JSON.stringify(resp.response.result ?? null) + '\n');
}

export async function cmdTrains(p: string[], f: Flags): Promise<void> {
  const sub = p[0] ?? 'list';
  if (sub === 'restart') return cmdTrainsRestart(p.slice(1), f);
  if (sub === 'new') return cmdTrainsNew(p.slice(1), f);
  if (sub !== 'list') throw exitErr(`usage: metro trains <list|restart|new>   (got '${sub}')`, 1);
  loadMetroEnv();
  const resp = await ipc({ op: 'trains-list' });
  if (!resp.ok) throw exitErr(resp.error, 3);
  if (!('trains' in resp)) throw exitErr('daemon returned malformed trains-list response', 3);
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
  const resp = await ipc({ op: 'train-restart', name: p[0] });
  if (!resp.ok) throw exitErr(resp.error, 3);
  emit(f, `restarted train '${p[0]}'`, { ok: true, name: p[0] });
}

/** dist/cli/webhook.js → <package-root>/examples/echo.ts (minimal scaffold;
 *  the platform trains now live in src/trains/ and ship as canonical sources). */
const bundledExample = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples', 'echo.ts');

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
