import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LiveSource } from '@stage-labs/client/xmtp/sync/dashboard';
import { getAccountEpoch, useAccountEpoch } from '../accountEpoch';
import { ignore, recover } from '../errorPolicy';
import { getQueryClient } from '../queryClient';
import { dashboardAccountId } from './dashboard';
import type { FrameMessageHandler, FrameOut } from './frame.model';
import { frameKeysOf, type FrameKeys } from './frameKeys';
import { EMPTY_LIVE, LIVE_REFRESH_MS, liveRefetchInterval, type LiveState } from './live.model';
import type { LiveSlot } from './liveEngine';
import { readLiveSnapshot, saveLiveSnapshot } from './liveSnapshots';
import { liveEngine } from './runtime';

const LIVE_QUERY = 'liveWidget';
const SNAPSHOT_QUERY = 'liveSnapshot';

type QueryKey = readonly unknown[];

function liveKey(widgetId: string, epoch: number, url: string): QueryKey {
  return [LIVE_QUERY, widgetId, epoch, url];
}

function snapshotKey(widgetId: string, epoch: number): QueryKey {
  return [SNAPSHOT_QUERY, widgetId, epoch];
}

function widgetKeys(widgetId: string): FrameKeys {
  return frameKeysOf({ kind: 'widget', widgetId });
}

function widgetSlot(key: QueryKey, widgetId: string, epoch: number, source: LiveSource): LiveSlot {
  const client = getQueryClient();
  const read = (): LiveState =>
    client.getQueryData<LiveState>(key) ?? client.getQueryData<LiveState>(snapshotKey(widgetId, epoch)) ?? EMPTY_LIVE;
  return {
    sessionKey: widgetKeys(widgetId).session,
    node: source,
    read,
    show: (frame) => {
      client.setQueryData(key, { ...read(), frame });
    },
  };
}

export function seedLiveWidget(widgetId: string, url: string, state: LiveState): void {
  getQueryClient().setQueryData(liveKey(widgetId, getAccountEpoch(), url), state);
  saveLiveSnapshot(dashboardAccountId(), widgetId, state);
}

export function refreshLiveWidget(widgetId: string): void {
  ignore(getQueryClient().refetchQueries({ queryKey: [LIVE_QUERY, widgetId] }), 'ui');
}

async function loadWidget(key: QueryKey, widgetId: string, epoch: number, source: LiveSource, signal: AbortSignal): Promise<LiveState> {
  const { next } = await liveEngine.run(widgetSlot(key, widgetId, epoch, source), { load: true, signal });
  if (next.problem === null) saveLiveSnapshot(dashboardAccountId(), widgetId, next);
  return next;
}

async function sendWidget(key: QueryKey, widgetId: string, epoch: number, source: LiveSource, out: FrameOut): Promise<void> {
  await getQueryClient().cancelQueries({ queryKey: key });
  const { next } = await liveEngine.run(widgetSlot(key, widgetId, epoch, source), { load: false, out });
  if (liveEngine.toastProblem(next, false)) return;
  getQueryClient().setQueryData(key, next);
  saveLiveSnapshot(dashboardAccountId(), widgetId, next);
}

export interface LiveWidgetHandle {
  keys: FrameKeys;
  state: LiveState | undefined;
  act: FrameMessageHandler;
}

export function useLiveWidget(widgetId: string, source: LiveSource, active: boolean): LiveWidgetHandle {
  const epoch = useAccountEpoch();
  const key = useMemo(() => liveKey(widgetId, epoch, source.url), [widgetId, epoch, source.url]);
  const keys = useMemo(() => widgetKeys(widgetId), [widgetId]);
  const snapshot = useQuery({
    queryKey: snapshotKey(widgetId, epoch),
    queryFn: () => readLiveSnapshot(dashboardAccountId(), widgetId).catch(recover('live.snapshot', EMPTY_LIVE)),
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
  return { keys, state: live.data ?? snapshot.data, act };
}
