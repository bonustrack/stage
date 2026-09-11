
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Keyboard } from 'react-native';
import type { Input } from '@stage-labs/kit/react-native/input';
import { parseHandle } from '@stage-labs/client/routing/handles';
import { resolveDmConvId, type DmResolveError } from '../../lib/dmResolve';
import { getCachedRows } from '../../lib/channelsCache';
import { resolveHandleToAddress } from '../../lib/resolveHandle';

export type ResolveConvError = false | DmResolveError;

export interface ResolvedConv {
  convId: string | null;
  resolving: boolean;
  error: ResolveConvError;
  pendingAddress: string | null;
  retry: () => void;
}

function isQueueable(error: DmResolveError): boolean {
  return error === 'unregistered' || error === 'stale-installations';
}

function cachedDmConvId(address: string): string | null {
  const addr = address.toLowerCase();
  const hit = getCachedRows()?.find(
    r => typeof r.peerAddress === 'string' && r.peerAddress.toLowerCase() === addr,
  );
  return hit ? hit.convId : null;
}

type ConvState = Omit<ResolvedConv, 'retry'>;

const RESOLVING: ConvState = { convId: null, resolving: true, error: false, pendingAddress: null };

function directState(param: string | undefined): ConvState {
  return { convId: param ?? null, resolving: false, error: false, pendingAddress: null };
}

function isPeerHandle(param: string | undefined): boolean {
  const kind = parseHandle(param).kind;
  return kind === 'address' || kind === 'stage' || kind === 'basename' || kind === 'ens';
}

async function resolvePeerConversation(param: string): Promise<ConvState> {
  const address = await resolveHandleToAddress(param);
  if (!address) return { convId: null, resolving: false, error: 'failed', pendingAddress: null };
  const cached = cachedDmConvId(address);
  if (cached !== null) return { convId: cached, resolving: false, error: false, pendingAddress: null };
  const res = await resolveDmConvId(address);
  if ('convId' in res) return { convId: res.convId, resolving: false, error: false, pendingAddress: null };
  return { convId: null, resolving: false, error: res.error, pendingAddress: isQueueable(res.error) ? address : null };
}

export function useResolvedConvId(param: string | undefined): ResolvedConv {
  const peer = isPeerHandle(param);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setAttempt(a => a + 1); }, []);
  const [state, setState] = useState<ConvState>(() => {
    if (!peer) return directState(param);
    const cached = param && parseHandle(param).kind === 'address' ? cachedDmConvId(param) : null;
    return cached ? { convId: cached, resolving: false, error: false, pendingAddress: null } : RESOLVING;
  });
  useEffect(() => {
    if (!param || !isPeerHandle(param)) {
      setState(directState(param));
      return;
    }
    let cancelled = false;
    setState(RESOLVING);
    resolvePeerConversation(param)
      .then((next) => { if (!cancelled) setState(next); })
      .catch(() => { if (!cancelled) setState({ convId: null, resolving: false, error: 'failed', pendingAddress: null }); });
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
