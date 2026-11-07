import type { HistoryEntry } from '@stage-labs/client/types';

export const cachedFeed: (line: string) => Promise<HistoryEntry[] | null> = () => Promise.resolve(null);

export const cachedSelfInboxId: () => Promise<string | null> = () => Promise.resolve(null);

export const rememberFeed: (line: string, slice: readonly HistoryEntry[]) => void = () => undefined;

export const rememberSelfInboxId: (inboxId: string) => void = () => undefined;

export const forgetFeeds: (accountId: string) => Promise<void> = () => Promise.resolve();
