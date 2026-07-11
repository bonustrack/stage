
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Keyboard } from 'react-native';
import type { Input } from '@stage-labs/kit/react-native/input';
import { isArchived, loadArchivedIds, subscribeArchived } from '../../lib/archived';
import {
  dmUnreachableReason, findExistingDmWithAddress, openDmWithAddress, repairDmMembership,
} from '../../modules/messaging';

const DM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export type ResolveConvError = false | 'unregistered' | 'stale-installations' | 'failed';

export interface ResolvedConv {
  convId: string | null;
  resolving: boolean;
  error: ResolveConvError;
  retry: () => void;
}

type DmResolution = { convId: string } | { error: ResolveConvError };

async function classifyUnreachable(address: string): Promise<{ error: ResolveConvError }> {
  const reason = await dmUnreachableReason(address).catch(() => null);
  return { error: reason ?? 'failed' };
}

async function resolveStubDm(convId: string, address: string): Promise<DmResolution> {
  const repaired = await repairDmMembership(convId, address).catch(() => false);
  if (repaired) return { convId };
  return classifyUnreachable(address);
}

async function resolveDmConvId(address: string): Promise<DmResolution> {
  const existing = await findExistingDmWithAddress(address).catch(() => null);
  if (existing?.peerJoined) return { convId: existing.convId };
  if (existing) return resolveStubDm(existing.convId, address);
  const reason = await dmUnreachableReason(address).catch(() => null);
  if (reason) return { error: reason };
  try {
    return { convId: await openDmWithAddress(address) };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('openDmWithAddress failed', (err as Error).message);
    return classifyUnreachable(address);
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
      .then(res => {
        if (cancelled) return;
        if ('convId' in res) setState({ convId: res.convId, resolving: false, error: false });
        else setState({ convId: null, resolving: false, error: res.error });
      })
      .catch(() => { if (!cancelled) setState({ convId: null, resolving: false, error: 'failed' }); });
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
