import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ensureMailKey, fetchMail, listMail, openMailSession, type MailListItem, type MailSession, type SignMessage } from '@stage-labs/client/mail/api';
import { deriveMailKey, isMailboxLabel, mailAddressOf, openMailIndex, openMailPart, type MailIndex, type MailKeyPair } from '@stage-labs/client/mail/mailbox';
import { parseMail, type ParsedMail } from '@stage-labs/client/mail/mime';
import { mailReadKey, parseReadKeys, withReadKey, type InboxEntry } from '../components/settings/Inbox.model';
import { loadAccounts } from './accounts';
import { useAccountEpoch } from './accountEpoch';
import { linkProxyBase } from './historyServer';
import { ownedStageLabel } from './mailKey';
import { createValueStore } from './persistedStore';
import { getQueryClient } from './queryClient';
import { report, reported } from './errorPolicy';
import { signingKeyForRecord } from './xmtp.signing.core';

export interface Mailbox {
  accountId: string;
  address: string;
  label: string;
  mailAddress: string;
}

export interface InboxState {
  entries: InboxEntry[];
  failed: string[];
}

const SESSION_MARGIN_MS = 30_000;
const NO_KEYS: readonly string[] = [];
const signerCache = new Map<string, Promise<SignMessage>>();
const keyCache = new Map<string, Promise<MailKeyPair>>();
const sessionCache = new Map<string, Promise<MailSession>>();
const activated = new Set<string>();

const readStore = createValueStore<readonly string[]>({
  key: 'mail.read', default: NO_KEYS, deserialize: parseReadKeys, serialize: (keys) => JSON.stringify(keys),
});

function boxKey(box: Mailbox): string {
  return `${box.address.toLowerCase()}/${box.label}`;
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const pending = make();
  cache.set(key, pending);
  pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
  return pending;
}

function signerFor(box: Mailbox): Promise<SignMessage> {
  return cached(signerCache, box.accountId, async () => {
    const rec = (await loadAccounts()).find((account) => account.id === box.accountId);
    if (rec === undefined) throw new Error('This account is no longer on this device.');
    return (await signingKeyForRecord(rec)).signMessage;
  });
}

function mailKeyFor(box: Mailbox): Promise<MailKeyPair> {
  return cached(keyCache, boxKey(box), async () => deriveMailKey(box.label, await signerFor(box)));
}

async function sessionFor(box: Mailbox): Promise<MailSession> {
  const key = boxKey(box);
  const open = async (): Promise<MailSession> => openMailSession(linkProxyBase(), box.label, await signerFor(box));
  const session = await cached(sessionCache, key, open);
  if (session.expiresAt - SESSION_MARGIN_MS > Date.now()) return session;
  if (sessionCache.get(key) !== undefined) sessionCache.delete(key);
  return cached(sessionCache, key, open);
}

async function withSession<T>(box: Mailbox, run: (session: MailSession) => Promise<T>): Promise<T> {
  try {
    return await run(await sessionFor(box));
  } catch (err) {
    report('mail.session', err);
    sessionCache.delete(boxKey(box));
    return run(await sessionFor(box));
  }
}

async function activate(box: Mailbox): Promise<void> {
  if (activated.has(boxKey(box))) return;
  await ensureMailKey(linkProxyBase(), box.label, box.address, await signerFor(box));
  activated.add(boxKey(box));
}

function openIndex(keys: MailKeyPair, box: Mailbox, item: MailListItem): MailIndex | null {
  try {
    return openMailIndex(keys.secretKey, box.label, item.id, item.index);
  } catch (err) {
    report('mail.index', err);
    return null;
  }
}

async function listBox(box: Mailbox): Promise<InboxEntry[]> {
  void activate(box).catch(reported('mail.activate'));
  const [keys, items] = await Promise.all([mailKeyFor(box), withSession(box, listMail)]);
  return items.map((item) => ({ label: box.label, id: item.id, ts: item.ts, size: item.size, index: openIndex(keys, box, item) }));
}

async function loadInbox(boxes: readonly Mailbox[]): Promise<InboxState> {
  const results = await Promise.allSettled(boxes.map(listBox));
  const state: InboxState = { entries: [], failed: [] };
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') state.entries.push(...result.value);
    else state.failed.push(boxes[i]?.mailAddress ?? '');
  });
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected !== undefined && state.failed.length === boxes.length) throw rejected.reason;
  return state;
}

async function loadMailboxes(): Promise<Mailbox[]> {
  const found = await Promise.all((await loadAccounts()).map(async (rec) => {
    const label = await ownedStageLabel(rec.address);
    if (label === null || !isMailboxLabel(label)) return null;
    return { accountId: rec.id, address: rec.address, label, mailAddress: mailAddressOf(label) };
  }));
  return found.filter((box): box is Mailbox => box !== null);
}

async function openMail(box: Mailbox, id: string): Promise<ParsedMail> {
  const [keys, sealed] = await Promise.all([mailKeyFor(box), withSession(box, (session) => fetchMail(session, id))]);
  return parseMail(openMailPart(keys.secretKey, box.label, id, 'body', sealed));
}

export function useMailboxes(): UseQueryResult<Mailbox[]> {
  const epoch = useAccountEpoch();
  return useQuery({ queryKey: ['mailboxes', epoch], queryFn: loadMailboxes, staleTime: 5 * 60_000 });
}

const INBOX_STALE_MS = 30_000;

function inboxKey(boxes: readonly Mailbox[]): string[] {
  return ['inbox', boxes.map(boxKey).join(',')];
}

export function useInbox(boxes: readonly Mailbox[] | undefined): UseQueryResult<InboxState> {
  const list = boxes ?? [];
  return useQuery({
    queryKey: inboxKey(list),
    queryFn: () => loadInbox(list),
    enabled: list.length > 0,
    staleTime: INBOX_STALE_MS,
    retry: false,
  });
}

export function prefetchInbox(boxes: readonly Mailbox[]): void {
  if (boxes.length === 0) return;
  void getQueryClient().prefetchQuery({ queryKey: inboxKey(boxes), queryFn: () => loadInbox(boxes), staleTime: INBOX_STALE_MS })
    .catch(reported('mail.prefetch'));
}

export function useMail(box: Mailbox | undefined, id: string): UseQueryResult<ParsedMail> {
  return useQuery({
    queryKey: ['mail', box === undefined ? '' : boxKey(box), id],
    queryFn: () => (box === undefined ? Promise.reject(new Error('No mailbox')) : openMail(box, id)),
    enabled: box !== undefined,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  });
}

export function useReadMail(): ReadonlySet<string> {
  const keys = readStore.use();
  return useMemo(() => new Set(keys), [keys]);
}

export function markMailRead(label: string, id: string): void {
  void readStore.update((keys) => withReadKey(keys, mailReadKey(label, id))).catch(reported('mail.read'));
}
