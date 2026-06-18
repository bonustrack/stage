/** Channels tab — XMTP conversations the local wallet is a member of. Tapping a
 *  row pushes into `/xmtp/[convId]`. Avatars (stamp.box) resolved once per conv
 *  on list build and cached in component state. */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList } from 'react-native-gesture-handler';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { getCachedRows, setCachedRows, subscribeCachedRows, useActiveAccount, ensureChannelsQueryBridge } from '../../modules/messaging';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useDraftsVersion } from '../../lib/drafts';
import { Col } from '../layout';
import { loadPinnedIds, subscribePins } from '../../lib/pins';
import { loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { CHANNELS_SCROLL_KEY, getScrollOffset, flushScrollOffset } from '../../lib/scrollPos';
import { ChannelMenu } from '../ChannelMenu';
import type { Row as RowT } from './HomeScreen.helpers';
import { HomeError, HomeSpinner, useChannelRowRenderer } from './HomeScreen.parts';
import { ChannelsList, channelRowLayout } from './HomeScreen.list';
import { useChannelsSync } from './HomeScreen.sync';
import { useIncomingLabelFilter } from './HomeScreen.filter';
import { deriveLabels, useHomeFilters } from './HomeScreen.labelbar';
import { filterRowsByQuery } from './HomeScreen.search';

/** Home tab screen showing the conversation list and primary navigation. */
export function HomeScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const [rows, setRowsState] = useState<RowT[] | null>(getCachedRows() as RowT[] | null);
  /** Wrap setRows so every state update also lands in the shared cache + fans
   *  out to subscribers (e.g. the conv view's markConvRead). */
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
  /** Mirror the channels cache into TanStack Query (stage-1 cache unification) so
   *  read-only consumers dedupe off one entry. The cache stays the writer; this
   *  screen's own state path above is unchanged. */
  useEffect(() => { ensureChannelsQueryBridge(); }, []);
  const [error, setError] = useState<string>('');
  /** Row long-pressed → per-conversation action sheet (mark read/unread). */
  const [rowMenu, setRowMenu] = useState<{ convId: string; title: string; isUnread: boolean; isGroup: boolean; peerAddress: string | null } | null>(null);
  /** Held across effect re-runs so AppState + poll backstops can refresh. */
  const refreshFromNetworkRef = useRef<(() => Promise<void>) | null>(null);
  /** Channels-list scroll persistence: ref, saved offset, one-shot restore flag,
   *  measured content height (clamp the saved offset to it). */
  const listRef = useRef<FlatList<RowT>>(null);
  const savedOffsetRef = useRef<number | undefined>(undefined);
  const didRestoreRef = useRef(false);
  const contentHeightRef = useRef(0);
  /** Device-only pinned conv ids; `subscribePins` re-derives the sort on toggle. */
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  /** Device-only archived conv ids; hidden from main list, shown in Archived. */
  const [archived, setArchived] = useState<Set<string>>(new Set());
  /** Pending message-request count ('unknown' consent); drives "Requests (N)". */
  const [requestCount, setRequestCount] = useState<number>(0);
  /** Filter chip state: enabled label set (OR-filter) + the built-in "Unread"
   *  toggle, with the "All" clear-all handler. unreadOnly AND-narrows to
   *  conversations with unread messages (unreadCount > 0 OR markedUnread). */
  const { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters } = useHomeFilters();
  /** Channels search query (client-side filter, empty = full list). */
  const [query, setQuery] = useState<string>('');
  /** Apply cross-screen label-filter requests (tapped label chip on a row). */
  useIncomingLabelFilter(toggleLabel);
  /** Load saved scroll offset once; actual scroll happens in onContentSizeChange. */
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
  useEffect(() => {
    void loadArchivedIds().then(setArchived);
    return subscribeArchived(() => { void loadArchivedIds().then(s => setArchived(new Set(s))); });
  }, []);

  /** Display ordering: pinned rows float to the top (keeping their own lastTs
   *  desc order), then the rest by lastTs desc. Derived for display only — the
   *  source `rows` state stays untouched so the stream-update logic (which
   *  prepends/reorders by recency) keeps working against the raw list. */
  const sortedRows = useMemo(() => {
    /** Archived convs are removed from the main list entirely (shown only in the
     *  Archived view). Filtered first so the label filter + sort operate on the
     *  visible set. */
    const all = (rows ?? []).filter(r => !archived.has(r.convId));
    /** Label filter (ANY/OR): no enabled labels → show all; otherwise keep
     *  channels carrying at least one enabled label (case-insensitive).
     *  Reactive to `rows` so cache updates re-derive. */
    const byLabel = enabledLabels.size === 0
      ? all
      : all.filter(r => (r.labels ?? []).some(l => enabledLabels.has(l.toLowerCase())));
    /** Unread chip: AND-narrow to conversations with unread messages. */
    const list = unreadOnly
      ? byLabel.filter(r => r.unreadCount > 0 || r.markedUnread)
      : byLabel;
    return [...list].sort((a, b) => {
      const ap = pinned.has(a.convId) ? 1 : 0;
      const bp = pinned.has(b.convId) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.lastTs ?? 0) - (a.lastTs ?? 0);
    });
  }, [rows, pinned, enabledLabels, unreadOnly, archived]);

  /** Unique label set across NON-ARCHIVED channels → drives the filter bar. */
  const barLabels = useMemo(() => deriveLabels((rows ?? []).filter(r => !archived.has(r.convId))), [rows, archived]);

  /** Search query applied on top of the sorted/archived/label-filtered list
   *  (so search never surfaces hidden channels). Empty query = full list. */
  const visibleRows = useMemo(() => filterRowsByQuery(sortedRows, query), [sortedRows, query]);

  /** Batch-resolve the displayed peers' profiles → avatar cache-busters. */
  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]),
  );
  const draftsVersion = useDraftsVersion();
  /** Re-runs the XMTP init below when the active account changes (in-place switch). */
  const accountEpoch = useActiveAccount();

  useChannelsSync({
    accountEpoch, rows, setRowsState, setRows, setError, setRequestCount, refreshFromNetworkRef,
  });

  /** Stable extraData array (identity only changes when a version does) so the
   *  FlatList doesn't re-render the whole window each stream tick. */
  const listExtraData = useMemo(
    () => [channelProfilesVersion, draftsVersion, pinned, query] as const,
    [channelProfilesVersion, draftsVersion, pinned, query],
  );
  const renderRow = useChannelRowRenderer(router, setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query,
  });

  if (error) return <HomeError error={error} dark={dark} fg={fg} bg={bg} />;
  if (!rows) return <HomeSpinner head={head} bg={bg} />;

  return (
    <Col flex={1} surface="surface">
      <ChannelsList
        panRef={panRef}
        router={router}
        sortedRows={visibleRows}
        requestCount={requestCount}
        barLabels={barLabels}
        enabledLabels={enabledLabels}
        onToggleLabel={toggleLabel}
        unreadOnly={unreadOnly}
        onToggleUnread={toggleUnread}
        onClearAll={clearAllFilters}
        query={query}
        setQuery={setQuery}
        fg={fg}
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
        isArchived={rowMenu ? archived.has(rowMenu.convId) : false}
        onClose={() => setRowMenu(null)}
/>
    </Col>
  );
}
