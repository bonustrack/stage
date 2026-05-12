/** `metro lines` — list active lines from scopes.json, sorted by recency. */

import { listLines } from '../helpers/scope-cache.js';
import { loadMetroEnv } from '../paths.js';

type Row = { line: string; name: string | null; lastSeenAt: string | null; lastAgent: string | null; agents: string[] };

export async function cmdLines(json: boolean): Promise<void> {
  loadMetroEnv();
  const rows: Row[] = listLines()
    /** Drop pre-URI legacy keys (e.g. `discord:ID`) — they're not routable and just clutter the listing. */
    .filter(({ line }) => line.startsWith('metro://'))
    .map(({ line, entry }) => ({
      line, name: entry.name ?? null,
      lastSeenAt: entry.lastSeenAt ?? null,
      lastAgent: entry.lastAgent ?? null,
      agents: Object.keys(entry.agents ?? {}),
    }))
    .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));

  if (json) return void process.stdout.write(JSON.stringify({ lines: rows }) + '\n');
  if (!rows.length) return void process.stdout.write('metro lines\n\n  (none yet — start a conversation to populate)\n\n');

  const widest = Math.max(...rows.map(r => r.line.length));
  process.stdout.write('metro lines\n\n');
  for (const r of rows) {
    const when = r.lastSeenAt ? humanAgo(r.lastSeenAt) : '—';
    const agent = r.lastAgent ?? r.agents.join('+') ?? '—';
    const tag = r.name ? `  ${truncate(r.name, 40)}` : '';
    process.stdout.write(`  ${when.padEnd(10)} ${agent.padEnd(8)} ${r.line.padEnd(widest)}${tag}\n`);
  }
  process.stdout.write('\n');
}

const humanAgo = (iso: string): string => {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

const truncate = (s: string, n: number): string => s.length <= n ? s : s.slice(0, n - 1) + '…';
