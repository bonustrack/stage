import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { nodeRequestOf, type FrameMessageHandler, type FrameOut } from '../components/frame/frame.model';
import { loadNode, sendNodeMessage, type NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameMessage } from '@stage-labs/client/xmtp/frame';
import type { LiveSource } from '@stage-labs/client/xmtp/readState';
import { FRAME_ADD_TOASTS } from '../components/dashboard/dashboard.model';
import {
  EMPTY_LIVE,
  LIVE_REFRESH_MS,
  liveProblemText,
  liveRefetchInterval,
  liveStateAfter,
  type LivePreview,
  type LiveState,
} from '../components/dashboard/liveWidget.model';
import { getAccountEpoch, useAccountEpoch } from './accountEpoch';
import { isAppInFront, subscribeAppInFront } from './appInFront';
import { capabilities } from './capabilities';
import { addLiveToDashboard, dashboardAccountId } from './dashboard';
import { ignore, recover, report } from './errorPolicy';
import { RENDERER_CAPABILITIES, streamInto } from './frameSession';
import { readLiveSnapshot, saveLiveSnapshot } from './liveSnapshots';
import { getQueryClient } from './queryClient';
import { useStoreValue } from './storeCore';

const LIVE_QUERY = 'liveWidget';
const SNAPSHOT_QUERY = 'liveSnapshot';

type Run = (onMessage: (message: FrameMessage) => void) => Promise<NodeResult>;

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

export async function addLivePreview(preview: LivePreview, key: string, where: string, onAdded?: () => void): Promise<boolean> {
  try {
    const { outcome, id } = await addLiveToDashboard({ url: preview.url, key }, 'half');
    if (outcome === 'added') {
      onAdded?.();
      getQueryClient().setQueryData(liveKey(id, getAccountEpoch(), preview.url), preview.state);
      saveSnapshot(id, preview.state);
    }
    capabilities.toast(FRAME_ADD_TOASTS[outcome]);
    return true;
  } catch (err) {
    report(where, err);
    capabilities.toast('Could not add it to your dashboard');
    return false;
  }
}

export function refreshLiveWidget(widgetId: string): void {
  ignore(getQueryClient().refetchQueries({ queryKey: [LIVE_QUERY, widgetId] }), 'ui');
}

function useLiveActive(): boolean {
  const focused = useIsFocused();
  const inFront = useStoreValue(subscribeAppInFront, isAppInFront);
  return focused && inFront;
}

async function streamWidget(key: readonly unknown[], widgetId: string, epoch: number, load: boolean, run: Run): Promise<LiveState> {
  const client = getQueryClient();
  const latest = (): LiveState =>
    client.getQueryData<LiveState>(key) ?? client.getQueryData<LiveState>([SNAPSHOT_QUERY, widgetId, epoch]) ?? EMPTY_LIVE;
  const { result, applied } = await streamInto(
    liveWidgetKey(widgetId),
    load,
    (frame) => {
      client.setQueryData(key, { ...latest(), frame });
    },
    run,
  );
  return liveStateAfter(latest(), result, Date.now(), applied);
}

async function loadWidget(
  key: readonly unknown[],
  widgetId: string,
  epoch: number,
  source: LiveSource,
  signal: AbortSignal,
): Promise<LiveState> {
  const next = await streamWidget(key, widgetId, epoch, true, (onMessage) =>
    loadNode(source.url, source.key, { capabilities: RENDERER_CAPABILITIES, signal, onMessage }),
  );
  if (next.problem === null) saveSnapshot(widgetId, next);
  return next;
}

async function sendWidget(key: readonly unknown[], widgetId: string, epoch: number, source: LiveSource, out: FrameOut): Promise<void> {
  await getQueryClient().cancelQueries({ queryKey: key });
  const next = await streamWidget(key, widgetId, epoch, false, (onMessage) =>
    sendNodeMessage(source.url, source.key, nodeRequestOf(out), { capabilities: RENDERER_CAPABILITIES, onMessage }),
  );
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
    refetchInterval: (query) => liveRefetchInterval(active, query.state.data),
    refetchIntervalInBackground: false,
    retry: false,
  });
  const act = useCallback<FrameMessageHandler>((out) => sendWidget(key, widgetId, epoch, source, out), [key, widgetId, epoch, source]);
  return { state: live.data ?? snapshot.data, act };
}
