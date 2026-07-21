import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface StoredPushToken {
  token: string;
  registeredAt: string;
  lastSeenAt?: string;
  account?: string;
  inboxId?: string;
  inboxIds?: string[];
  platform?: string;
}

export interface TokenStore {
  load: () => StoredPushToken[];
  save: (tokens: StoredPushToken[]) => void;
}

export function fileTokenStore(path: string): TokenStore {
  return {
    load: (): StoredPushToken[] => {
      if (!existsSync(path)) return [];
      try {
        return JSON.parse(readFileSync(path, 'utf8')) as StoredPushToken[];
      } catch {
        return [];
      }
    },
    save: (tokens: StoredPushToken[]): void => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(tokens, null, 2));
    },
  };
}

export function memoryTokenStore(seed: StoredPushToken[] = []): TokenStore {
  let state = [...seed];
  return {
    load: (): StoredPushToken[] => state.map((t) => ({ ...t })),
    save: (tokens: StoredPushToken[]): void => { state = tokens.map((t) => ({ ...t })); },
  };
}

export function upsertToken(
  store: TokenStore,
  entry: { token: string; account?: string; inboxId?: string; platform?: string },
): number {
  const now = new Date().toISOString();
  const all = store.load();
  const existing = all.find((t) => t.token === entry.token);
  const remaining = all.filter((t) => t.token !== entry.token);
  const inboxIds = new Set<string>(existing?.inboxIds ?? []);
  if (existing?.inboxId) inboxIds.add(existing.inboxId);
  if (entry.inboxId) inboxIds.add(entry.inboxId);
  const row: StoredPushToken = {
    token: entry.token,
    registeredAt: existing?.registeredAt ?? now,
    lastSeenAt: now,
  };
  if (entry.account) row.account = entry.account;
  if (entry.inboxId) row.inboxId = entry.inboxId;
  if (inboxIds.size) row.inboxIds = [...inboxIds];
  if (entry.platform) row.platform = entry.platform;
  remaining.push(row);
  store.save(remaining);
  return remaining.length;
}

export function removeToken(store: TokenStore, token: string): number {
  const all = store.load();
  const remaining = all.filter((t) => t.token !== token);
  if (remaining.length === all.length) return -1;
  store.save(remaining);
  return remaining.length;
}

export function freshestPerAccount(tokens: StoredPushToken[]): StoredPushToken[] {
  const freshness = (t: StoredPushToken): number =>
    new Date(t.lastSeenAt ?? t.registeredAt ?? 0).getTime();
  const byAccount = new Map<string, StoredPushToken>();
  const unscoped: StoredPushToken[] = [];
  for (const t of tokens) {
    if (!t.account) { unscoped.push(t); continue; }
    const cur = byAccount.get(t.account);
    if (!cur || freshness(t) >= freshness(cur)) byAccount.set(t.account, t);
  }
  return [...byAccount.values(), ...unscoped];
}

export function targetsForAccount(
  tokens: StoredPushToken[],
  accountId: string,
  excludeInboxId?: string,
): StoredPushToken[] {
  const scoped = tokens.filter((t) => {
    if (t.account && t.account !== accountId) return false;
    if (excludeInboxId && (t.inboxId === excludeInboxId || t.inboxIds?.includes(excludeInboxId))) {
      return false;
    }
    return true;
  });
  return freshestPerAccount(scoped);
}
