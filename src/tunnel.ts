/** Cloudflared tunnel manager. Prefers token-from-env so a missing local credentials JSON does not block startup. */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR } from './paths.js';
import { errMsg, log } from './log.js';

const FILE = join(STATE_DIR, 'tunnel.json');
const RESTART_DELAY_MS = 2_000;

export type TunnelConfig = { name: string; hostname: string };

export const loadTunnelConfig = (): TunnelConfig | null => existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, 'utf8')) as TunnelConfig
  : null;

export function saveTunnelConfig(c: TunnelConfig): void { writeFileSync(FILE, JSON.stringify(c, null, 2)); }

/** Fetch the tunnel's auth token. Null when CLI is unavailable, not logged in, or no such tunnel. */
function fetchTunnelToken(name: string): string | null {
  const r = spawnSync('cloudflared', ['tunnel', 'token', name], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const token = r.stdout.trim();
  return token.length > 0 ? token : null;
}

export class Tunnel {
  private child: ChildProcess | null = null;
  private closed = false;
  /** `undefined` = unresolved; `null` = resolved but unavailable (CLI missing / not logged in / no tunnel). */
  private token: string | null | undefined = undefined;

  constructor(private cfg: TunnelConfig, private port: number) {}

  get hostname(): string { return this.cfg.hostname; }

  start(): void {
    if (this.closed) return;
    if (this.token === undefined) this.token = fetchTunnelToken(this.cfg.name);
    const mode = this.token ? 'token' : 'named';
    log.info({ name: this.cfg.name, hostname: this.cfg.hostname, port: this.port, mode }, 'cloudflared tunnel starting');
    /** `--no-autoupdate` is a global cloudflared flag — must come before the `tunnel` subcommand. */
    const args = ['--no-autoupdate', 'tunnel', 'run', '--url', `http://127.0.0.1:${this.port}`];
    /** Token form resolves the tunnel from TUNNEL_TOKEN so the trailing name arg must be omitted. */
    if (!this.token) args.push(this.cfg.name);
    const env = this.token
      ? { ...process.env, TUNNEL_TOKEN: this.token }
      : process.env;
    this.child = spawn('cloudflared', args, { stdio: ['ignore', 'pipe', 'pipe'], env });
    this.child.stderr?.on('data', d => log.debug({ cloudflared: d.toString().trim() }, 'cloudflared'));
    this.child.on('exit', code => {
      this.child = null;
      if (this.closed) return;
      log.warn({ code }, 'cloudflared exited; restarting');
      setTimeout(() => this.start(), RESTART_DELAY_MS);
    });
    this.child.on('error', err => log.warn({ err: errMsg(err) }, 'cloudflared spawn error'));
  }

  stop(): void {
    this.closed = true;
    this.child?.kill();
    this.child = null;
  }
}
