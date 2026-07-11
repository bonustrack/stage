
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Keyboard } from 'react-native';
import type { Input } from '@stage-labs/kit/react-native/input';
import { isArchived, loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { dmUnreachableReason, findExistingDmWithAddress, openDmWithAddress } from '../../modules/messaging';

const DM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const CREATE_RETRY_DELAY_MS = 1500;

export type ResolveConvError = false | 'unregistered' | 'stale-installations' | 'failed';

export interface ResolvedConv {
  convId: string | null;
  resolving: boolean;
  error: ResolveConvError;
  retry: () => void;
}

async function resolveDmConvId(address: string): Promise<string> {
  try {
    return await openDmWithAddress(address);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('openDmWithAddress failed', (err as Error).message);
    const existing = await findExistingDmWithAddress(address).catch(() => null);
    if (existing) return existing;
    await new Promise(resolve => setTimeout(resolve, CREATE_RETRY_DELAY_MS));
    return openDmWithAddress(address);
  }
}

export function useResolvedConvId(param: string | undefined): ResolvedConv {
  const isAddress = !!param && DM_ADDRESS_RE.test(param);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setAttempt(a => a + 1); }, []);
  const [state, setState] = useState<Omit<ResolvedConv, 'retry'>>(() =>
    isAddress
      ? { convId: null, resolving: true, error: false }
      : { convId: param ?? null, resolving: false, error: false });
  useEffect(() => {
    if (!param || !DM_ADDRESS_RE.test(param)) {
      setState({ convId: param ?? null, resolving: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ convId: null, resolving: true, error: false });
    void resolveDmConvId(param)
      .then(id => { if (!cancelled) setState({ convId: id, resolving: false, error: false }); })
      .catch(async () => {
        const error = (await dmUnreachableReason(param).catch(() => null)) ?? 'failed';
        if (!cancelled) setState({ convId: null, resolving: false, error });
      });
    return () => { cancelled = true; };
  }, [param, attempt]);
  return { ...state, retry };
}

type InputRef = React.RefObject<React.ComponentRef<typeof Input> | null>;

export function useSearchKeyboardFocus(searchOpen: boolean): InputRef {
  const searchInputRef = useRef<React.ComponentRef<typeof Input>>(null);
  useEffect(() => {
    if (!searchOpen) return;
    let shown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const sub = Keyboard.addListener('keyboardDidShow', () => { shown = true; });
    const poke = (): void => {
      if (shown || attempts >= 8) return;
      attempts += 1;
      const input = searchInputRef.current;
      input?.blur();
      requestAnimationFrame(() => { searchInputRef.current?.focus(); });
      timer = setTimeout(poke, 150);
    };
    const task = InteractionManager.runAfterInteractions(poke);
    return () => {
      sub.remove();
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [searchOpen]);
  return searchInputRef;
}

export function useArchivedFlag(convId: string | undefined): boolean {
  const [archived, setArchived] = useState(convId ? isArchived(convId) : false);
  useEffect(() => {
    const sync = (): void => { setArchived(convId ? isArchived(convId) : false); };
    void loadArchivedIds().then(sync);
    return subscribeArchived(sync);
  }, [convId]);
  return archived;
}
