import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { nodeRequestOf, type FrameMessageHandler, type FrameOut } from '../components/frame/frame.model';
import { loadNode, sendNodeMessage } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import type { LiveSource } from '@stage-labs/client/xmtp/readState';
import {
  EMPTY_LIVE, LIVE_REFRESH_MS, liveProblemText, liveRefetchInterval, liveStateAfter, type LiveState,
} from '../components/dashboard/liveWidget.model';
import { getAccountEpoch, useAccountEpoch } from './accountEpoch';
import { isAppInFront, subscribeAppInFront } from './appInFront';
import { capabilities } from './capabilities';
import { dashboardAccountId } from './dashboard';
import { ignore, recover } from './errorPolicy';
import { endFrameLoad, frameSink, RENDERER_CAPABILITIES, startFrameLoad } from './frameSession';
import { readLiveSnapshot, saveLiveSnapshot } from './liveSnapshots';
import { getQueryClient } from './queryClient';
import { useStoreValue } from './storeCore';

const LIVE_QUERY = 'liveWidget';
const SNAPSHOT_QUERY = 'liveSnapshot';

export function liveWidgetKey(widgetId: string): string {
  return `live:${widgetId}`;
}

function readSnapshot(widgetId: string): Promise<LiveState> {
  const account = dashboardAccountId();
  return account === null ? Promise.resolve(EMPTY_LIVE) : readLiveSnapshot(account, widgetId);
}

function saveSnapshot(widgetId: string, state: LiveState): void {
  const account = dashboardAccountId();
  if (account !== null) saveLiveSnapshot(account, widgetId, state);
}

function liveKey(widgetId: string, epoch: number, url: string): readonly unknown[] {
  return [LIVE_QUERY, widgetId, epoch, url];
}

export function seedLiveWidget(widgetId: string, url: string, state: LiveState): void {
  getQueryClient().setQueryData(liveKey(widgetId, getAccountEpoch(), url), state);
  saveSnapshot(widgetId, state);
}

export function refreshLiveWidget(widgetId: string): void {
  ignore(getQueryClient().refetchQueries({ queryKey: [LIVE_QUERY, widgetId] }), 'ui');
}

function useLiveActive(): boolean {
  const focused = useIsFocused();
  const inFront = useStoreValue(subscribeAppInFront, isAppInFront);
  return focused && inFront;
}

function latestState(key: readonly unknown[], widgetId: string, epoch: number): LiveState {
  const client = getQueryClient();
  return client.getQueryData<LiveState>(key) ?? client.getQueryData<LiveState>([SNAPSHOT_QUERY, widgetId, epoch]) ?? EMPTY_LIVE;
}

function pushFrame(key: readonly unknown[], widgetId: string, epoch: number): (frame: FrameContent) => void {
  return (frame) => { getQueryClient().setQueryData(key, { ...latestState(key, widgetId, epoch), frame }); };
}

async function loadWidget(key: readonly unknown[], widgetId: string, epoch: number, source: LiveSource, signal: AbortSignal): Promise<LiveState> {
  const sessionKey = liveWidgetKey(widgetId);
  const token = startFrameLoad(sessionKey);
  const sink = frameSink(sessionKey, pushFrame(key, widgetId, epoch), token);
  try {
    const result = await loadNode(source.url, source.key, { capabilities: RENDERER_CAPABILITIES, signal, onMessage: sink.onMessage });
    const next = liveStateAfter(latestState(key, widgetId, epoch), result, Date.now(), () => sink.applied());
    if (next.problem === null) saveSnapshot(widgetId, next);
    return next;
  } finally {
    endFrameLoad(sessionKey, token);
  }
}

async function sendWidget(key: readonly unknown[], widgetId: string, epoch: number, source: LiveSource, out: FrameOut): Promise<void> {
  await getQueryClient().cancelQueries({ queryKey: key });
  const sink = frameSink(liveWidgetKey(widgetId), pushFrame(key, widgetId, epoch));
  const result = await sendNodeMessage(source.url, source.key, nodeRequestOf(out), { capabilities: RENDERER_CAPABILITIES, onMessage: sink.onMessage });
  const next = liveStateAfter(latestState(key, widgetId, epoch), result, Date.now(), () => sink.applied());
  const problem = liveProblemText(next);
  if (problem !== null) {
    capabilities.toast(`Could not send: ${problem.toLowerCase()}`);
    return;
  }
  getQueryClient().setQueryData(key, next);
  saveSnapshot(widgetId, next);
}

export function useLiveWidget(widgetId: string, source: LiveSource): { state: LiveState | undefined; act: FrameMessageHandler } {
  const epoch = useAccountEpoch();
  const active = useLiveActive();
  const key = useMemo(() => liveKey(widgetId, epoch, source.url), [widgetId, epoch, source.url]);
  const snapshot = useQuery({
    queryKey: [SNAPSHOT_QUERY, widgetId, epoch],
    queryFn: () => readSnapshot(widgetId).catch(recover('live.snapshot', EMPTY_LIVE)),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const live = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => loadWidget(key, widgetId, epoch, source, signal),
    enabled: active && snapshot.isFetched,
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: query => liveRefetchInterval(active, query.state.data),
    refetchIntervalInBackground: false,
    retry: false,
  });
  const act = useCallback<FrameMessageHandler>((out) => sendWidget(key, widgetId, epoch, source, out), [key, widgetId, epoch, source]);
  return { state: live.data ?? snapshot.data, act };
}
