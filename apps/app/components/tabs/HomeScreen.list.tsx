/** HomeScreen list view - the topnav (avatar + "+") and the channels FlatList
 *  (scroll persistence, requests header, empty state), extracted from
 *  HomeScreen.tsx (phase-2 lint, rendering identical). */

import type { MutableRefObject, RefObject } from 'react';
import { useState } from 'react';
import { Pressable } from '@metro-labs/kit/pressable';
import { FlatList } from 'react-native-gesture-handler';
import { Icon } from '@metro-labs/kit/icon';
import { TopnavIdentity } from '../TopnavIdentity';
import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { CHANNELS_SCROLL_KEY, saveScrollOffset } from '../../lib/scrollPos';
import { useEffectiveColorScheme } from '../../lib/theme';
import { CHANNEL_ROW_HEIGHT } from './HomeScreen.helpers';
import type { Row as RowT } from './HomeScreen.helpers';
import { HomeEmpty } from './HomeScreen.parts';
import { LabelFilterBar } from './HomeScreen.labelbar';
import { ChannelsSearchBar } from './HomeScreen.search';
import { HomeContactResults } from './HomeScreen.contacts';
import { HomeOverflowMenu } from './HomeScreen.overflow';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  sortedRows: RowT[];
  requestCount: number;
  /** Unique labels across non-archived channels → the filter bar chips. */
  barLabels: string[];
  /** Enabled label keys (lowercased); empty = no filter. */
  enabledLabels: Set<string>;
  /** Toggle a label's enabled state. */
  onToggleLabel: (label: string) => void;
  /** Built-in "Unread" chip state + toggle (only-unread filter). */
  unreadOnly: boolean;
  onToggleUnread: () => void;
  /** Built-in "All" chip: clears every active filter. */
  onClearAll: () => void;
  /** Channels search query + setter (owned by HomeScreen) → search bar + filter. */
  query: string;
  setQuery: (v: string) => void;
  fg: string;
  head: string;
  sub: string;
  border: string;
  inputBg: string;
  toolbarBg: string;
  listExtraData: readonly unknown[];
  listRef: RefObject<FlatList<RowT> | null>;
  savedOffsetRef: MutableRefObject<number | undefined>;
  didRestoreRef: MutableRefObject<boolean>;
  contentHeightRef: MutableRefObject<number>;
  renderRow: ({ item }: { item: RowT }) => React.ReactElement;
  getRowLayout: (d: ArrayLike<RowT> | null | undefined, index: number) => { length: number; offset: number; index: number };
}

export function ChannelsList({
  panRef, router, sortedRows, requestCount, barLabels, enabledLabels, onToggleLabel,
  unreadOnly, onToggleUnread, onClearAll,
  query, setQuery,
  fg, head, sub, border, inputBg, toolbarBg,
  listExtraData, listRef, savedOffsetRef, didRestoreRef, contentHeightRef,
  renderRow, getRowLayout,
}: ChannelsListProps): React.ReactElement {
  // Request-count badge: white bg + black text in dark theme. In light theme a
  // white badge would vanish on the light topnav, so flip to a dark bg + white
  // text there to stay legible.
  const dark = useEffectiveColorScheme() === 'dark';
  const badgeBg = dark ? '#ffffff' : '#000000';
  const badgeFg = dark ? '#000000' : '#ffffff';
  // Search is collapsed by default: a search icon sits in the topnav, and
  // tapping it swaps the whole topnav for a full-width search field. Closing
  // clears the query so the list returns to its full state.
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = () => { setSearchOpen(false); setQuery(''); };
  return (
    <>
      {/* Home topnav: collapsed shows avatar + search/requests/overflow icons;
       *  expanded (search open) the whole bar becomes a full-width search field
       *  with a back chevron. A bottom border separates it from the feed. The
       *  label filter rides in a chip bar that scrolls with the feed. */}
      {searchOpen ? (
        <Box style={{ borderBottomWidth: 1, borderBottomColor: border }}>
          <ChannelsSearchBar
            query={query}
            setQuery={setQuery}
            onClose={closeSearch}
            head={head}
            sub={sub}
            inputBg={inputBg}
            toolbarBg={toolbarBg}
          />
        </Box>
      ) : (
        <Row
          align="center"
          justify="between"
          px={16}
          pt={12}
          pb={10}
          bg={toolbarBg}
          style={{ borderBottomWidth: 1, borderBottomColor: border }}
        >
          <Row align="center" gap={8}>
            {/* Avatar + name → Menu page; shared TopnavIdentity. */}
            <TopnavIdentity />
          </Row>
          <Row align="center" gap={18}>
            {/* Search sits just before the requests icon: opens the full-width
             *  search field over the topnav (tap-to-expand + back chevron
             *  behavior unchanged). */}
            <Pressable onPress={() => setSearchOpen(true)} hitSlop={8}>
              <Icon name="search" size={24} color={head} />
            </Pressable>
            {/* Message requests: inbox icon + count badge (pending 'unknown'
             *  consent convs). Badge hidden when 0; tap opens the requests list. */}
            <Pressable onPress={() => router.push('/xmtp/requests')} hitSlop={8} style={{ position: 'relative' }}>
              <Icon name="inbox" size={24} color={head} />
              {requestCount > 0 ? (
                <Box
                  px={5}
                  radius={999}
                  bg={badgeBg}
                  align="center"
                  justify="center"
                  style={{ position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16 }}
                >
                  <Text style={{ color: badgeFg, fontSize: 10, fontFamily: 'Calibre-Semibold' }}>
                    {requestCount > 99 ? '99+' : requestCount}
                  </Text>
                </Box>
              ) : null}
            </Pressable>
            {/* Overflow (3-dot) menu: folds the former Archived + New-group icons
             *  into a single kebab to declutter the topnav. */}
            <HomeOverflowMenu
              color={head}
              onArchived={() => router.push('/xmtp/archived')}
              onNewGroup={() => router.push('/xmtp/new-group')}
              onEditProfile={() => router.push('/profile')}
              onSettings={() => router.push('/settings')}
            />
          </Row>
        </Row>
      )}
      <FlatList
        ref={listRef}
        simultaneousHandlers={panRef}
        data={sortedRows}
        /** Persist the offset as the user scrolls (debounced inside the lib). */
        onScroll={(ev) => { saveScrollOffset(CHANNELS_SCROLL_KEY, ev.nativeEvent.contentOffset.y); }}
        scrollEventThrottle={16}
        /** Restore the saved offset once, after rows have laid out. Clamp to the
         *  measured content height so a stale offset (rows since removed) can't
         *  scroll past the end. */
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h;
          if (didRestoreRef.current) return;
          const want = savedOffsetRef.current;
          if (want == null || want <= 0) { didRestoreRef.current = true; return; }
          if (h <= 0) return; // not laid out yet - wait for the next size change
          didRestoreRef.current = true;
          const offset = Math.min(want, Math.max(0, h));
          requestAnimationFrame(() => {
            try { listRef.current?.scrollToOffset({ offset, animated: false }); } catch { /* best-effort */ }
          });
        }}
        extraData={listExtraData}
        keyExtractor={r => r.convId}
        getItemLayout={getRowLayout}
        windowSize={11}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 24 }}
        /* Label-filter bar rides as the list header so it scrolls away with the
         *  feed instead of staying pinned under the (fixed) search bar. One
         *  toggle chip per unique label across non-archived channels; hidden
         *  when there are no labels. */
        ListHeaderComponent={
          <LabelFilterBar
            labels={barLabels}
            enabled={enabledLabels}
            unreadOnly={unreadOnly}
            onToggle={onToggleLabel}
            onToggleUnread={onToggleUnread}
            onClearAll={onClearAll}
          />
        }
        ListEmptyComponent={query.trim() ? null : <HomeEmpty sub={sub} />}
        ListFooterComponent={
          query.trim()
            ? <HomeContactResults query={query} c={{ fg, head, sub, border }} noChannels={sortedRows.length === 0} />
            : null
        }
        renderItem={renderRow}
      />
    </>
  );
}

/** getItemLayout lets the list skip measuring + jump-scroll without rendering
 *  intermediate rows. Every row is uniform height (group label chips render
 *  inline on the name row, not a separate line), so offsets are a flat
 *  index × CHANNEL_ROW_HEIGHT. */
export function channelRowLayout(_d: ArrayLike<RowT> | null | undefined, index: number): { length: number; offset: number; index: number } {
  return { length: CHANNEL_ROW_HEIGHT, offset: CHANNEL_ROW_HEIGHT * index, index };
}
