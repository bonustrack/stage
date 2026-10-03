import type { HistoryEntry } from '@stage-labs/client/types';

export function entry(id: string, fields: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id, ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from: 'u', to: 'c', ...fields };
}
