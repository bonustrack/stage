/** CLI: `metro agent <snapshot|docs-refresh>`. */

import { refreshDocsIndex } from '../agents/snapshot-docs.js';
import { runSnapshotAgent } from '../agents/snapshot-agent.js';
import { loadMetroEnv } from '../paths.js';
import { emit, exitErr, type Flags } from './util.js';

export async function cmdAgent(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const sub = p[0];
  if (sub === 'snapshot') return runSnapshotAgent();
  if (sub === 'docs-refresh') {
    const result = await refreshDocsIndex();
    return emit(f, `indexed ${result.pages} pages (${result.bytes} bytes)`, { ok: true, ...result });
  }
  throw exitErr('usage: metro agent <snapshot | docs-refresh>', 1);
}
