/** HomeScreen list view — the topnav (avatar + "+") and the channels FlatList
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
import { LabelFilterControl } from './HomeScreen.filter';
import type { LabelFilterValue } from './HomeScreen.filter';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  myAddress: string | null;
  sortedRows: RowT[];
  requestCount: number;
  /** Count of archived convs → drives the "Archived (N)" footer row (hidden
   *  when 0). Tapping it opens the dedicated Archived view. */
  archivedCount: number;
  /** Active label filter (null = none) → drives the top-left control's state. */
  labelFilter: LabelFilterValue;
  /** Opens the label-picker sheet (owned by HomeScreen). */
  onOpenFilter: () => void;
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
  panRef, router, myAddress, sortedRows, requestCount, archivedCount, labelFilter, onOpenFilter,
  head, sub, border,
  listExtraData, listRef, savedOffsetRef, didRestoreRef, contentHeightRef,
  renderRow, getRowLayout,
}: ChannelsListProps): React.ReactElement {
  // Request-count badge: white bg + black text in dark theme. In light theme a
  // white badge would vanish on the light topnav, so flip to a dark bg + white
  // text there to stay legible.
  const dark = useEffectiveColorScheme() === 'dark';
  const badgeBg = dark ? '#ffffff' : '#000000';
  const badgeFg = dark ? '#000000' : '#ffffff';
  return (
    <>
      {/* Home topnav: avatar + label-filter control on the left, requests + "+"
       *  on the right. Tapping the filter control opens the label picker sheet;
       *  when a label is active the control highlights + shows the label text. */}
      <Row align="center" justify="between" px={16} pt={12} pb={10} style={{
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Row align="center" gap={8}>
          {/* Static avatar: the top-left no longer opens the account-switcher
           *  page (account switching lives in Settings). */}
          <Avatar address={myAddress} size={24} style={{ backgroundColor: border }} />
          <LabelFilterControl active={labelFilter} onPress={onOpenFilter} />
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
          <Pressable onPress={() => router.push('/xmtp/new-group')} hitSlop={8}>
            <Icon name="plus" size={26} color={head} />
          </Pressable>
        </Row>
      </Row>
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
          if (h <= 0) return; // not laid out yet — wait for the next size change
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
        ListEmptyComponent={<HomeEmpty sub={sub} />}
        ListFooterComponent={
          archivedCount > 0 ? (
            <Pressable
              onPress={() => router.push('/xmtp/archived')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 16, paddingVertical: 16,
                backgroundColor: pressed ? border : 'transparent',
              })}
            >
              <Icon name="archive" size={20} color={sub} />
              <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
                {`Archived (${archivedCount})`}
              </Text>
            </Pressable>
          ) : null
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
