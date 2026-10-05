import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ParsedMail } from '@stage-labs/client/mail/mime';
import { mailReadKey, parseReadKeys, withReadKey } from '../components/settings/Inbox.model';
import { getSelectedAccount } from './accounts';
import { useAccountEpoch } from './accountEpoch';
import { getAccountSelection, subscribeAccountSelection, useAccountSelection } from './accountSelection';
import { linkProxyBase } from './historyServer';
import { ownedStageLabel } from './mailKey';
import { mailboxKey, makeMailAccess, type InboxState, type Mailbox } from './mail.core';
import { createValueStore } from './persistedStore';
import { getQueryClient } from './queryClient';
import { reported } from './errorPolicy';
import { signingKeyForRecord } from './xmtp.signing.core';

export type { InboxState, Mailbox } from './mail.core';

const NO_KEYS: readonly string[] = [];
const access = makeMailAccess({
  activeAccount: getSelectedAccount,
  ownedLabel: ownedStageLabel,
  signer: async (rec) => (await signingKeyForRecord(rec)).signMessage,
  selection: getAccountSelection,
  baseUrl: linkProxyBase,
});

subscribeAccountSelection(() => {
  access.clear();
  getQueryClient().removeQueries({ queryKey: ['mail'] });
});

const readStore = createValueStore<readonly string[]>({
  key: 'mail.read', default: NO_KEYS, deserialize: parseReadKeys, serialize: (keys) => JSON.stringify(keys),
});

export function useMailboxes(): UseQueryResult<Mailbox[]> {
  const epoch = useAccountEpoch();
  const selection = useAccountSelection();
  return useQuery({
    queryKey: ['mail', selection, 'boxes', epoch],
    queryFn: () => access.mailboxes(selection),
    staleTime: 5 * 60_000,
  });
}

const INBOX_STALE_MS = 30_000;

function inboxKey(boxes: readonly Mailbox[], selection: number): readonly unknown[] {
  return ['mail', selection, 'inbox', ...boxes.map(mailboxKey)];
}

export function useInbox(boxes: readonly Mailbox[] | undefined): UseQueryResult<InboxState> {
  const selection = useAccountSelection();
  const list = (boxes ?? []).filter((box) => box.selection === selection);
  return useQuery({
    queryKey: inboxKey(list, selection),
    queryFn: () => access.inbox(list, selection),
    enabled: list.length > 0,
    staleTime: INBOX_STALE_MS,
    retry: false,
  });
}

export function prefetchInbox(boxes: readonly Mailbox[]): void {
  const selection = getAccountSelection();
  if (boxes.length === 0 || boxes.some((box) => box.selection !== selection)) return;
  void getQueryClient().prefetchQuery({ queryKey: inboxKey(boxes, selection), queryFn: () => access.inbox(boxes, selection), staleTime: INBOX_STALE_MS })
    .catch(reported('mail.prefetch'));
}

export function useMail(box: Mailbox | undefined, id: string): UseQueryResult<ParsedMail> {
  const selection = useAccountSelection();
  const activeBox = box?.selection === selection ? box : undefined;
  return useQuery({
    queryKey: ['mail', selection, 'body', activeBox === undefined ? '' : mailboxKey(activeBox), id],
    queryFn: () => (activeBox === undefined ? Promise.reject(new Error('No mailbox')) : access.mail(activeBox, id)),
    enabled: activeBox !== undefined,
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
