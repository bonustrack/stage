import { useEffect, useRef, useState } from 'react';
import { accountClient } from '../../lib/xmtp.account';
import { assertShareAccount } from '../../lib/shareDestination';
import { getCachedRows, hydrateCachedRows, subscribeCachedRows, type CachedRow } from '../../lib/channelsCache';
import { listVisibleConversations, syncConversationsFromNetwork } from '../../lib/xmtp.conv';
import { summarizeConversation } from '../../modules/messaging/conversation';
import { mergeShareRows } from './share.model';

async function fetchShareRows(accountId: string, epoch: number, network: boolean): Promise<{ rows: CachedRow[]; failed: boolean }> {
  const context = await accountClient(accountId);
  if (network) await syncConversationsFromNetwork();
  const convs = await listVisibleConversations();
  const rows: CachedRow[] = [];
  let failed = false;
  for (let index = 0; index < convs.length; index += 4) {
    context.assertCurrent();
    assertShareAccount(accountId, epoch);
    const batch = await Promise.allSettled(
      convs.slice(index, index + 4).map((conv) => summarizeConversation(conv, context.client.inboxId, true)),
    );
    for (const result of batch) {
      if (result.status === 'fulfilled') rows.push({ ...result.value });
      else failed = true;
    }
  }
  context.assertCurrent();
  assertShareAccount(accountId, epoch);
  return { rows, failed };
}

export function useShareRows(
  accountId: string | null,
  epoch: number,
): { rows: CachedRow[] | null; loading: boolean; error: string | null; refresh: () => void } {
  const [snapshot, setSnapshot] = useState<{ accountId: string; epoch: number; rows: CachedRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const publish = (rows: CachedRow[] | null): void => {
    if (accountId === null) return;
    setSnapshot((previous) => ({
      accountId,
      epoch,
      rows: mergeShareRows(previous?.accountId === accountId && previous.epoch === epoch ? previous.rows : null, rows),
    }));
  };
  const refresh = (network = true): void => {
    if (accountId === null) return;
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    void hydrateCachedRows()
      .then(async () => {
        if (generation.current === request) publish(getCachedRows());
        const result = await fetchShareRows(accountId, epoch, network);
        if (generation.current === request) {
          publish(result.rows);
          if (result.failed) setError('Some channels could not be loaded. You can choose another channel or refresh.');
        }
      })
      .catch(() => {
        if (generation.current === request) setError('Could not refresh channels. Try again when messaging is ready.');
      })
      .finally(() => {
        if (generation.current === request) setLoading(false);
      });
  };
  useEffect(() => {
    refresh(false);
    const unsubscribe = subscribeCachedRows(publish);
    return () => {
      generation.current += 1;
      unsubscribe();
    };
  }, [accountId, epoch]);
  return { rows: snapshot?.accountId === accountId && snapshot.epoch === epoch ? snapshot.rows : null, loading, error, refresh };
}
