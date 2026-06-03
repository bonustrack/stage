/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Tapping a row pushes into `/xmtp/[convId]` for the full chat view.
 *  Avatar = stamp.box `eth:<peer-address>` for DMs; stacked stamp avatars of
 *  the other members for groups (excluding the local user). Both are resolved
 *  once per conv during the initial list build and cached in component state. */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList } from 'react-native-gesture-handler';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { getCachedRows, setCachedRows, subscribeCachedRows } from '../../lib/channelsCache';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { getActiveAccount } from '../../lib/accounts';
import { useDraftsVersion } from '../../lib/drafts';
import { Col } from '../layout';
import { loadPinnedIds, subscribePins } from '../../lib/pins';
import { CHANNELS_SCROLL_KEY, getScrollOffset, flushScrollOffset } from '../../lib/scrollPos';
import { ChannelMenu } from '../ChannelMenu';
import type { Row as RowT } from './HomeScreen.helpers';
import { HomeError, HomeSpinner, useChannelRowRenderer } from './HomeScreen.parts';
import { ChannelsList, channelRowLayout } from './HomeScreen.list';
import { useChannelsSync } from './HomeScreen.sync';
import { LabelFilterSheet, UNLABELED, useIncomingLabelFilter } from './HomeScreen.filter';
import type { LabelFilterValue } from './HomeScreen.filter';

/** Re-exported so existing import paths (`./HomeScreen`) stay unchanged. */
export type { Row } from './HomeScreen.helpers';

/** Channels-list cache lives in lib/channelsCache so the conversation view
 *  can reach in to clear unread on mount without an import cycle. The Row[]
 *  shape is a superset of CachedRow — write through directly. */

export function HomeScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border } = usePalette();
  const [rows, setRowsState] = useState<RowT[] | null>(getCachedRows() as RowT[] | null);
  /** Wrap setRows so every state update also lands in the shared cache + fans
   *  out to subscribers (e.g. the conv view'​s markConvRead can mutate the
   *  cache and we'll re-render via the subscription below). */
  const setRows = (next: RowT[] | null | ((p: RowT[] | null) => RowT[] | null)): void => {
    if (typeof next === 'function') {
      setRowsState(prev => {
        const v = (next as (p: RowT[] | null) => RowT[] | null)(prev);
        setCachedRows(v);
        return v;
      });
    } else {
      setRowsState(next);
      setCachedRows(next);
    }
  };
  useEffect(() => subscribeCachedRows(r => setRowsState(r as RowT[] | null)), []);
  const [error, setError] = useState<string>('');
  /** Row long-pressed → opens the per-conversation action sheet (Mark as
   *  read/unread). Holds the convId + whether it currently reads as unread. */
  const [rowMenu, setRowMenu] = useState<{ convId: string; title: string; isUnread: boolean; isGroup: boolean; peerAddress: string | null } | null>(null);
  /** Held across effect re-runs so AppState + poll backstops can call refresh
   *  without re-binding to a stale client. */
  const refreshFromNetworkRef = useRef<(() => Promise<void>) | null>(null);
  /** Channels-list scroll persistence: the FlatList ref to restore onto, the
   *  saved offset (read once on mount), a one-shot flag so we only auto-restore
   *  the first time content lays out, and the latest measured content height so a
   *  saved offset can be clamped to it (never scroll past the end). */
  const listRef = useRef<FlatList<RowT>>(null);
  const savedOffsetRef = useRef<number | undefined>(undefined);
  const didRestoreRef = useRef(false);
  const contentHeightRef = useRef(0);
  /** Device-only pinned conv ids. Loaded once on mount; `subscribePins` bumps
   *  this on every toggle so the display sort below re-derives + re-renders. */
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  /** Active account's own address → topnav avatar. */
  const [myAddress, setMyAddress] = useState<string | null>(null);
  /** Count of pending message requests ('unknown' consent convs). Drives the
   *  "Requests (N)" entry at the top of the list; hidden when 0. */
  const [requestCount, setRequestCount] = useState<number>(0);
  /** Active label filter (null = show all). Drives both the topnav control's
   *  highlighted state and the sortedRows filter below. The picker sheet's
   *  open/closed state is local UI here. */
  const [labelFilter, setLabelFilter] = useState<LabelFilterValue>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState<boolean>(false);
  /** Apply cross-screen label-filter requests (a tapped channel-card label chip)
   *  to the filter state — pending-on-mount + live while mounted. */
  useIncomingLabelFilter(setLabelFilter);
  /** Load the saved channels-list offset once on mount. The actual scroll
   *  happens in onContentSizeChange (below) once rows have laid out — restoring
   *  before content exists would clamp to 0. */
  useEffect(() => {
    void getScrollOffset(CHANNELS_SCROLL_KEY).then(o => { savedOffsetRef.current = o; });
    return () => { flushScrollOffset(CHANNELS_SCROLL_KEY); };
  }, []);
  useEffect(() => {
    void loadPinnedIds().then(setPinned);
    /** On toggle the cache is already updated; re-read it (resolves instantly
     *  once loaded) into a fresh Set so React sees a new reference. */
    return subscribePins(() => { void loadPinnedIds().then(s => setPinned(new Set(s))); });
  }, []);

  /** Display ordering: pinned rows float to the top (keeping their own lastTs
   *  desc order), then the rest by lastTs desc. Derived for display only — the
   *  source `rows` state stays untouched so the stream-update logic (which
   *  prepends/reorders by recency) keeps working against the raw list. */
  const sortedRows = useMemo(() => {
    const all = rows ?? [];
    /** Label filter: null → no filter; UNLABELED → only channels with no
     *  labels[]; otherwise keep groups whose labels[] include the active label,
     *  case-insensitively. Reactive to `rows` so cache updates re-derive. */
    const list = labelFilter == null
      ? all
      : labelFilter === UNLABELED
        ? all.filter(r => (r.labels ?? []).length === 0)
        : all.filter(r => (r.labels ?? []).some(l => l.toLowerCase() === labelFilter.toLowerCase()));
    return [...list].sort((a, b) => {
      const ap = pinned.has(a.convId) ? 1 : 0;
      const bp = pinned.has(b.convId) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.lastTs ?? 0) - (a.lastTs ?? 0);
    });
  }, [rows, pinned, labelFilter]);

  /** Batch-resolve the displayed peers' profiles → avatar cache-busters. */
  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]),
  );
  const draftsVersion = useDraftsVersion();
  /** Re-runs the XMTP init below when the active account changes (in-place switch). */
  const accountEpoch = useAccountEpoch();
  /** Re-resolve the active account's address for the topnav avatar on switch. */
  useEffect(() => {
    let cancelled = false;
    void getActiveAccount().then(acct => {
      if (!cancelled) setMyAddress(acct?.address ?? null);
    });
    return () => { cancelled = true; };
  }, [accountEpoch]);

  useChannelsSync({
    accountEpoch, rows, setRowsState, setRows, setError, setRequestCount, refreshFromNetworkRef,
  });

/** #6: stable extraData (an array, identity changes only when one of these
   *  versions does) instead of a freshly-built string every render — so the
   *  FlatList doesn't treat every parent re-render as "data changed" and
   *  re-render the whole window on each stream tick. */
  const listExtraData = useMemo(
    () => [channelProfilesVersion, draftsVersion, pinned] as const,
    [channelProfilesVersion, draftsVersion, pinned],
  );

  const renderRow = useChannelRowRenderer(router, setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned,
  });

  if (error) return <HomeError error={error} dark={dark} fg={fg} bg={bg} />;
  if (!rows) return <HomeSpinner head={head} bg={bg} />;

  return (
    <Col flex={1} bg={bg}>
      <ChannelsList
        panRef={panRef}
        router={router}
        myAddress={myAddress}
        sortedRows={sortedRows}
        requestCount={requestCount}
        labelFilter={labelFilter}
        onOpenFilter={() => setFilterSheetOpen(true)}
        head={head}
        sub={sub}
        border={border}
        listExtraData={listExtraData}
        listRef={listRef}
        savedOffsetRef={savedOffsetRef}
        didRestoreRef={didRestoreRef}
        contentHeightRef={contentHeightRef}
        renderRow={renderRow}
        getRowLayout={channelRowLayout}
      />
      <ChannelMenu
        visible={!!rowMenu}
        convId={rowMenu?.convId ?? ''}
        title={rowMenu?.title}
        isGroup={rowMenu?.isGroup ?? false}
        peerAddress={rowMenu?.peerAddress ?? null}
        isUnread={rowMenu?.isUnread ?? false}
        isPinned={rowMenu ? pinned.has(rowMenu.convId) : false}
        onClose={() => setRowMenu(null)}
      />
      <LabelFilterSheet
        visible={filterSheetOpen}
        active={labelFilter}
        onClose={() => setFilterSheetOpen(false)}
        onSelect={setLabelFilter}
      />
    </Col>
  );
}
