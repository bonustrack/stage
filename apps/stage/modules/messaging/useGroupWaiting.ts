import { useEffect, useState } from 'react';
import { isGroupWaitingToJoin } from '../../lib/xmtp.conv';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { recover } from '../../lib/errorPolicy';

const RECHECK_MS = 10_000;

export function useGroupWaiting(convId: string | undefined, isGroup: boolean): boolean {
  const [waiting, setWaiting] = useState(false);
  const epoch = useAccountEpoch();
  useEffect(() => {
    setWaiting(false);
    if (!convId || !isGroup) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async (): Promise<void> => {
      const next = await isGroupWaitingToJoin(convId).catch(recover('conversation.groupWaiting', false));
      if (cancelled) return;
      setWaiting(next);
      if (next) timer = setTimeout(() => { void check(); }, RECHECK_MS);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [convId, isGroup, epoch]);
  return waiting;
}
