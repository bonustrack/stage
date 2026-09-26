import { shouldApplyReadState, type ReadStateContent } from '@stage-labs/client/xmtp/readState';
import { parseReadStateFile, type SnapshotRead } from '@stage-labs/client/xmtp/syncSnapshot';

export type StoredRead = SnapshotRead;

export interface ReadStateStoreDeps {
  load: () => Promise<string | null>;
  save: (raw: string) => void;
  legacyRead: (convId: string) => Promise<StoredRead | null>;
  now: () => number;
}

export interface ReadStateStore {
  prime: (hasAccounts: boolean) => void;
  get: (convId: string) => Promise<StoredRead | null>;
  markRead: (convId: string) => Promise<StoredRead>;
  markUnread: (convId: string) => Promise<StoredRead>;
  applyRemote: (states: readonly ReadStateContent[]) => Promise<ReadStateContent[]>;
  entries: () => Promise<[string, StoredRead][]>;
}

interface LoadedFile {
  legacy: boolean;
  reads: Map<string, StoredRead>;
}

export function makeReadStateStore(deps: ReadStateStoreDeps): ReadStateStore {
  let file: LoadedFile | null = null;
  let loading: Promise<LoadedFile> | null = null;
  let hint: boolean | null = null;
  const lookups = new Map<string, Promise<StoredRead | null>>();

  function persist(f: LoadedFile): void {
    deps.save(JSON.stringify({ legacy: f.legacy, reads: Object.fromEntries(f.reads) }));
  }

  async function readFile(): Promise<LoadedFile> {
    const raw = await deps.load();
    const parsed = raw === null ? null : parseReadStateFile(raw);
    const next: LoadedFile = parsed === null
      ? { legacy: raw !== null || hint !== false, reads: new Map() }
      : { legacy: parsed.legacy, reads: new Map(Object.entries(parsed.reads)) };
    file = next;
    if (parsed === null) persist(next);
    return next;
  }

  function loaded(): Promise<LoadedFile> {
    if (file !== null) return Promise.resolve(file);
    loading ??= readFile().finally(() => { loading = null; });
    return loading;
  }

  async function lookupLegacy(f: LoadedFile, convId: string): Promise<StoredRead | null> {
    const found = await deps.legacyRead(convId);
    if (found === null) return null;
    const current = f.reads.get(convId);
    if (current !== undefined) return current;
    f.reads.set(convId, found);
    persist(f);
    return found;
  }

  function legacy(f: LoadedFile, convId: string): Promise<StoredRead | null> {
    let pending = lookups.get(convId);
    if (pending === undefined) {
      pending = lookupLegacy(f, convId).finally(() => { lookups.delete(convId); });
      lookups.set(convId, pending);
    }
    return pending;
  }

  async function get(convId: string): Promise<StoredRead | null> {
    const f = await loaded();
    const hit = f.reads.get(convId);
    if (hit !== undefined || !f.legacy) return hit ?? null;
    return legacy(f, convId);
  }

  async function put(convId: string, next: (prev: StoredRead | null, at: number) => StoredRead): Promise<StoredRead> {
    const prev = await get(convId);
    const f = await loaded();
    const at = Math.max(deps.now(), (prev?.at ?? 0) + 1);
    const read = next(prev, at);
    f.reads.set(convId, read);
    persist(f);
    return read;
  }

  async function applyRemote(states: readonly ReadStateContent[]): Promise<ReadStateContent[]> {
    const f = await loaded();
    const applied: ReadStateContent[] = [];
    for (const state of states) {
      if (!shouldApplyReadState(f.reads.get(state.convId)?.at, state.at)) continue;
      f.reads.set(state.convId, { lastReadNs: state.lastReadNs, markedUnread: state.markedUnread, at: state.at });
      applied.push(state);
    }
    if (applied.length > 0) persist(f);
    return applied;
  }

  return {
    prime: (hasAccounts) => { hint ??= hasAccounts; },
    get,
    markRead: (convId) => put(convId, (_prev, at) => ({ lastReadNs: at * 1_000_000, markedUnread: false, at })),
    markUnread: (convId) => put(convId, (prev, at) => ({ lastReadNs: prev?.lastReadNs ?? 0, markedUnread: true, at })),
    applyRemote,
    entries: async () => [...(await loaded()).reads],
  };
}
