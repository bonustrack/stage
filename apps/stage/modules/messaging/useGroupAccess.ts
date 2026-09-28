import { useEffect, useState } from 'react';
import { groupAccessOf, type GroupAccess } from '../../lib/xmtp.conv';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { recover } from '../../lib/errorPolicy';

const RECHECK_MS = 10_000;

export function useGroupAccess(convId: string | undefined, isGroup: boolean): GroupAccess {
  const [access, setAccess] = useState<GroupAccess>('member');
  const epoch = useAccountEpoch();
  useEffect(() => {
    setAccess('member');
    if (!convId || !isGroup) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async (): Promise<void> => {
      const next = await groupAccessOf(convId).catch(recover<GroupAccess>('conversation.groupAccess', 'member'));
      if (cancelled) return;
      setAccess(next);
      if (next !== 'member') timer = setTimeout(() => { void check(); }, RECHECK_MS);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [convId, isGroup, epoch]);
  return access;
}
