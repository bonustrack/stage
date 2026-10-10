import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import type { FrameActionHandler } from '@stage-labs/kit/react-native/frame';
import { loadNode, sendNodeAction } from '@stage-labs/client/nodes/protocol';
import type { LiveSource } from '@stage-labs/client/xmtp/readState';
import {
  EMPTY_LIVE, LIVE_REFRESH_MS, liveProblemText, liveRefetchInterval, liveSnapshotJson, liveSnapshotOf, liveStateAfter,
  type LiveState,
} from '../components/dashboard/liveWidget.model';
import { appStorage } from '../platform/storage';
import { getAccountEpoch, useAccountEpoch } from './accountEpoch';
import { isAppInFront, subscribeAppInFront } from './appInFront';
import { capabilities } from './capabilities';
import { dashboardAccountId } from './dashboard';
import { ignore, recover } from './errorPolicy';
import { getQueryClient } from './queryClient';
import { useStoreValue } from './storeCore';

const LIVE_QUERY = 'liveWidget';
const SNAPSHOT_QUERY = 'liveSnapshot';
const SNAPSHOT_PREFIX = 'liveFrame.v1.';

function snapshotKey(widgetId: string): string | null {
  const account = dashboardAccountId();
  return account === null ? null : `${SNAPSHOT_PREFIX}${account}.${widgetId}`;
}

async function readSnapshot(widgetId: string): Promise<LiveState> {
  const key = snapshotKey(widgetId);
  return liveSnapshotOf(key === null ? null : await appStorage.get(key));
}

function saveSnapshot(widgetId: string, state: LiveState): void {
  const key = snapshotKey(widgetId);
  const json = liveSnapshotJson(state);
  if (key !== null && json !== null) ignore(appStorage.set(key, json), 'cache');
}

export function forgetLiveWidget(widgetId: string): void {
  const key = snapshotKey(widgetId);
  if (key !== null) ignore(appStorage.delete(key), 'cleanup');
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

export function useLiveWidget(widgetId: string, source: LiveSource): { state: LiveState | undefined; act: FrameActionHandler } {
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
    queryFn: async ({ signal }) => {
      const next = liveStateAfter(latestState(key, widgetId, epoch), await loadNode(source.url, source.key, signal), Date.now());
      if (next.problem === null) saveSnapshot(widgetId, next);
      return next;
    },
    enabled: active && snapshot.isFetched,
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: query => liveRefetchInterval(active, query.state.data),
    refetchIntervalInBackground: false,
    retry: false,
  });
  const act = useCallback<FrameActionHandler>(async (action) => {
    const next = liveStateAfter(latestState(key, widgetId, epoch), await sendNodeAction(source.url, source.key, action), Date.now());
    const problem = liveProblemText(next);
    if (problem !== null) {
      capabilities.toast(`Could not send: ${problem.toLowerCase()}`);
      return;
    }
    getQueryClient().setQueryData(key, next);
    saveSnapshot(widgetId, next);
  }, [key, source.url, source.key, widgetId, epoch]);
  return { state: live.data ?? snapshot.data, act };
}
