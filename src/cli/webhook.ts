/** CLI subcommands: `metro webhook add|list|remove` + `metro tunnel setup`. */

import { spawnSync } from 'node:child_process';
import { addEndpoint, listEndpoints, removeEndpoint, webhookPort } from '../webhooks.js';
import { loadTunnelConfig, saveTunnelConfig } from '../tunnel.js';
import { emit, exitErr, flagOne, isJson, need, writeJson, type Flags } from './util.js';

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
