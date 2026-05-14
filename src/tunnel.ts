/** Cloudflared named-tunnel manager. Spawns `cloudflared tunnel run` from `tunnel.json` for stable webhook URLs. */

import { spawn, type ChildProcess } from 'node:child_process';
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

export class Tunnel {
  private child: ChildProcess | null = null;
  private closed = false;

  constructor(private cfg: TunnelConfig, private port: number) {}

  get hostname(): string { return this.cfg.hostname; }

  start(): void {
    if (this.closed) return;
    log.info({ name: this.cfg.name, hostname: this.cfg.hostname, port: this.port }, 'cloudflared tunnel starting');
    this.child = spawn('cloudflared', [
      'tunnel', 'run', '--no-autoupdate',
      '--url', `http://127.0.0.1:${this.port}`,
      this.cfg.name,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
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
