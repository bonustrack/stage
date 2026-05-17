/** The Client SDK — discovers stations, starts/stops them, dispatches generic actions. */

import { EventEmitter } from 'node:events';
import { errMsg, log } from './log.js';
import {
  discoverStationPackages, findWorkspaceRoot, loadStation, type DiscoveredStation,
} from './discovery.js';
import type { Envelope, Station } from './types.js';

export interface ClientOptions {
  /** Pre-supplied stations (skip workspace discovery). Strings are entry paths to import. */
  stations?: (Station | string)[];
  /** Override the workspace root used for discovery. */
  workspaceRoot?: string;
}

export interface StationInfo {
  name: string;
  configured: boolean;
  actions: string[];
}

export class Client extends EventEmitter {
  private opts: ClientOptions;
  private loaded = new Map<string, Station>();
  private started = false;

  constructor(opts: ClientOptions = {}) {
    super();
    this.opts = opts;
  }

  /** Discover (or accept) stations, start the configured ones, emit `ready`. */
  async start(): Promise<void> {
    if (this.started) return;
    const stations = await this.resolveStations();
    for (const s of stations) {
      if (this.loaded.has(s.name)) {
        log.warn({ name: s.name }, 'client: duplicate station name — keeping first');
        continue;
      }
      this.loaded.set(s.name, s);
    }
    for (const s of this.loaded.values()) {
      if (!s.configured()) { log.debug({ station: s.name }, 'client: station not configured — skipping start'); continue; }
      try { await s.start(e => this.dispatch(s, e)); log.info({ station: s.name }, 'client: station started'); }
      catch (err) {
        log.warn({ err: errMsg(err), station: s.name }, 'client: station start failed — skipping');
        this.emit('error', err instanceof Error ? err : new Error(String(err)), s.name);
      }
    }
    this.started = true;
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    for (const s of this.loaded.values()) {
      if (!s.configured()) continue;
      try { await s.stop(); }
      catch (err) { log.warn({ err: errMsg(err), station: s.name }, 'client: station stop failed'); }
    }
  }

  /** Invoke any `(station, action)` registered by a loaded station. Generic — no per-verb knowledge. */
  async call<T = unknown>(station: string, action: string, args?: unknown): Promise<T> {
    const s = this.loaded.get(station);
    if (!s) throw new Error(`unknown station '${station}' (loaded: ${[...this.loaded.keys()].join(', ') || 'none'})`);
    const fn = s.actions[action];
    if (typeof fn !== 'function') {
      throw new Error(`station '${station}' has no action '${action}' (actions: ${Object.keys(s.actions).join(', ') || 'none'})`);
    }
    return (await fn(args)) as T;
  }

  /** Snapshot of loaded stations + their actions. */
  stations(): StationInfo[] {
    return [...this.loaded.values()].map(s => ({
      name: s.name, configured: s.configured(), actions: Object.keys(s.actions),
    }));
  }

  /** Look up a loaded station by name. */
  station(name: string): Station | undefined { return this.loaded.get(name); }

  private dispatch(s: Station, e: Envelope): void {
    if (e.station !== s.name) log.debug({ station: s.name, eventStation: e.station }, 'client: station mismatch in envelope');
    this.emit('event', e);
  }

  private async resolveStations(): Promise<Station[]> {
    if (this.opts.stations?.length) {
      const out: Station[] = [];
      for (const s of this.opts.stations) {
        if (typeof s === 'string') { const loaded = await loadStation(s); if (loaded) out.push(loaded); }
        else out.push(s);
      }
      return out;
    }
    const root = this.opts.workspaceRoot ?? findWorkspaceRoot();
    if (!root) { log.warn('client: no workspace root found — no stations discovered'); return []; }
    return resolveFromDiscovery(discoverStationPackages(root));
  }
}

async function resolveFromDiscovery(found: DiscoveredStation[]): Promise<Station[]> {
  const out: Station[] = [];
  for (const d of found) {
    const s = await loadStation(d.entry);
    if (s) out.push(s);
  }
  return out;
}
