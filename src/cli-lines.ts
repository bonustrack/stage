/** `metro lines` — list active lines from scopes.json, sorted by recency. */

import { listLines } from './helpers/scope-cache.js';
import { loadMetroEnv } from './paths.js';

type Row = { line: string; lastSeenAt: string | null; lastAgent: string | null; agents: string[] };

export async function cmdLines(json: boolean): Promise<void> {
  loadMetroEnv();
  const rows: Row[] = listLines()
    /** Drop pre-URI legacy keys (e.g. `discord:ID`) — they're not routable and just clutter the listing. */
    .filter(({ line }) => line.startsWith('metro://'))
    .map(({ line, entry }) => ({
      line,
      lastSeenAt: entry.lastSeenAt ?? null,
      lastAgent: entry.lastAgent ?? null,
      agents: Object.keys(entry.agents ?? {}),
    }))
    .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));

  if (json) return void process.stdout.write(JSON.stringify({ lines: rows }) + '\n');
  if (!rows.length) return void process.stdout.write('metro lines\n\n  (none yet — start a conversation to populate)\n\n');

  process.stdout.write('metro lines\n\n');
  for (const r of rows) {
    const when = r.lastSeenAt ? humanAgo(r.lastSeenAt) : '—';
    const agent = r.lastAgent ?? r.agents.join('+') ?? '—';
    process.stdout.write(`  ${when.padEnd(12)} ${agent.padEnd(8)} ${r.line}\n`);
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
