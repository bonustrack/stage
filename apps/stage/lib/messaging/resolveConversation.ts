import { useCallback, useEffect, useState } from 'react';
import { parseHandle } from '@stage-labs/client/routing/handles';
import { resolveDmConvId, type DmResolveError } from '../dmResolve';
import { getCachedRows } from '../channelsCache';
import { resolveHandleToAddress } from '../resolveHandle';

export type ResolveConvError = false | DmResolveError;

interface ResolvedConv {
  convId: string | null;
  resolving: boolean;
  error: ResolveConvError;
  detail?: string;
  pendingAddress: string | null;
  retry: () => void;
}

function isQueueable(error: DmResolveError): boolean {
  return error === 'unregistered' || error === 'stale-installations';
}

function cachedDmConvId(address: string): string | null {
  const addr = address.toLowerCase();
  const hit = getCachedRows()?.find((r) => typeof r.peerAddress === 'string' && r.peerAddress.toLowerCase() === addr);
  return hit ? hit.convId : null;
}

type ConvState = Omit<ResolvedConv, 'retry'>;

const RESOLVING: ConvState = { convId: null, resolving: true, error: false, pendingAddress: null };

const FAILED: ConvState = { convId: null, resolving: false, error: 'failed', pendingAddress: null };

function directState(param: string | undefined): ConvState {
  return { convId: param ?? null, resolving: false, error: false, pendingAddress: null };
}

function isPeerHandle(param: string | undefined): boolean {
  const kind = parseHandle(param).kind;
  return kind === 'address' || kind === 'stage' || kind === 'basename' || kind === 'ens';
}

async function resolvePeerConversation(param: string): Promise<ConvState> {
  const address = await resolveHandleToAddress(param);
  if (!address) return FAILED;
  const cached = cachedDmConvId(address);
  if (cached !== null) return directState(cached);
  const res = await resolveDmConvId(address);
  if ('convId' in res) return directState(res.convId);
  return { convId: null, resolving: false, error: res.error, detail: res.detail, pendingAddress: isQueueable(res.error) ? address : null };
}

function openingState(param: string | undefined, peerRoute: boolean): ConvState {
  if (!param || !peerRoute || !isPeerHandle(param)) return directState(param);
  const cached = parseHandle(param).kind === 'address' ? cachedDmConvId(param) : null;
  return cached ? directState(cached) : RESOLVING;
}

export function useResolvedConvId(param: string | undefined, peerRoute = true): ResolvedConv {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setAttempt((a) => a + 1);
  }, []);
  const [state, setState] = useState<ConvState>(() => openingState(param, peerRoute));
  useEffect(() => {
    setState(openingState(param, peerRoute));
    if (!param || !peerRoute || !isPeerHandle(param)) return;
    let cancelled = false;
    resolvePeerConversation(param)
      .then((next) => {
        if (!cancelled) setState((prev) => (prev.convId === next.convId && !prev.resolving ? prev : next));
      })
      .catch(() => {
        if (!cancelled) setState(FAILED);
      });
    return () => {
      cancelled = true;
    };
  }, [param, peerRoute, attempt]);
  return { ...state, retry };
}
