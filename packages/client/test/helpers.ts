import type { HistoryEntry } from '../src/types';
import type { Group } from '../src/xmtp/labels';

export function entry(id: string, fields: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id, ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from: 'u', to: 'c', ...fields };
}

export function appDataGroup(initial = '{}'): { group: Group; raw: () => string; writes: () => number } {
  let raw = initial;
  let writes = 0;
  return {
    group: {
      appData: () => Promise.resolve(raw),
      updateAppData: value => { raw = value; writes += 1; return Promise.resolve(); },
    },
    raw: () => raw,
    writes: () => writes,
  };
}
