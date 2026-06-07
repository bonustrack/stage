/** HomeScreen list view - the topnav (avatar + "+") and the channels FlatList
 *  (scroll persistence, requests header, empty state), extracted from
 *  HomeScreen.tsx (phase-2 lint, rendering identical). */

import type { MutableRefObject, RefObject } from 'react';
import { Pressable } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../Avatar';
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
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../lib/xmtp';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  myAddress: string | null;
  sortedRows: RowT[];
  requestCount: number;
  /** Unique labels across non-archived channels → the filter bar chips. */
  barLabels: string[];
  /** Enabled label keys (lowercased); empty = no filter. */
  enabledLabels: Set<string>;
  /** Toggle a label's enabled state. */
  onToggleLabel: (label: string) => void;
  /** Channels search query + setter (owned by HomeScreen) → search bar + filter. */
  query: string;
  setQuery: (v: string) => void;
  fg: string;
  head: string;
  sub: string;
  border: string;
  listExtraData: readonly unknown[];
  listRef: RefObject<FlatList<RowT> | null>;
  savedOffsetRef: MutableRefObject<number | undefined>;
  didRestoreRef: MutableRefObject<boolean>;
  contentHeightRef: MutableRefObject<number>;
  renderRow: ({ item }: { item: RowT }) => React.ReactElement;
  getRowLayout: (d: ArrayLike<RowT> | null | undefined, index: number) => { length: number; offset: number; index: number };
}

export function ChannelsList({
  panRef, router, myAddress, sortedRows, requestCount, barLabels, enabledLabels, onToggleLabel,
  query, setQuery,
  fg, head, sub, border,
  listExtraData, listRef, savedOffsetRef, didRestoreRef, contentHeightRef,
  renderRow, getRowLayout,
}: ChannelsListProps): React.ReactElement {
  // Request-count badge: white bg + black text in dark theme. In light theme a
  // white badge would vanish on the light topnav, so flip to a dark bg + white
  // text there to stay legible.
  const dark = useEffectiveColorScheme() === 'dark';
  const badgeBg = dark ? '#ffffff' : '#000000';
  const badgeFg = dark ? '#000000' : '#ffffff';
  // Resolve the active account's display name (ENS / profile) the same way the
  // Menu account header does (getPeerName ?? shortAddress); usePeerProfiles
  // re-renders this row once the batch resolves.
  usePeerProfiles([myAddress]);
  const myName = myAddress ? (getPeerName(myAddress) ?? shortAddress(myAddress)) : '';
  return (
    <>
      {/* Home topnav: avatar on the left, requests + 3-dot overflow menu on the
       *  right (Archived + New group moved into the overflow). The label filter
       *  lives in a horizontal chip bar under the search bar (LabelFilterBar). */}
      <Row align="center" justify="between" px={16} pt={12} pb={10}>
        <Row align="center" gap={8}>
          {/* Avatar opens the Menu page (account switcher + Profile/Settings),
           *  replacing the former slide-out left sidebar. */}
          <Pressable onPress={() => router.push('/menu')} hitSlop={8}>
            <Row align="center" gap={8}>
              <Avatar address={myAddress} size={28} style={{ backgroundColor: border }} />
              {myName ? (
                <Text
                  numberOfLines={1}
                  style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', maxWidth: 200 }}
                >
                  {myName}
                </Text>
              ) : null}
            </Row>
          </Pressable>
        </Row>
        <Row align="center" gap={18}>
          {/* Message requests: person icon + count badge (pending 'unknown'
           *  consent convs). Badge hidden when 0; tap opens the requests list. */}
          <Pressable onPress={() => router.push('/xmtp/requests')} hitSlop={8} style={{ position: 'relative' }}>
            <Icon name="user" size={24} color={head} />
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
          />
        </Row>
      </Row>
      {/* Search bar directly under the topnav: filters the rendered channel
       *  list client-side (title / last message / DM address). */}
      <ChannelsSearchBar
        query={query}
        setQuery={setQuery}
        head={head}
        sub={sub}
        border={border}
        rowBg={border}
      />
      {/* Horizontal label-filter bar under the search bar: one toggle chip per
       *  unique label across non-archived channels. Hidden when no labels. */}
      <LabelFilterBar labels={barLabels} enabled={enabledLabels} onToggle={onToggleLabel} />
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
