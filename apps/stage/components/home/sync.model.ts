export type ChannelsLoad = { kind: 'ready' } | { kind: 'loading' } | { kind: 'failed'; error: string };

export function channelsLoad(rows: readonly unknown[] | null, error: string): ChannelsLoad {
  if (rows !== null && rows.length > 0) return { kind: 'ready' };
  if (error !== '') return { kind: 'failed', error };
  return rows === null ? { kind: 'loading' } : { kind: 'ready' };
}
