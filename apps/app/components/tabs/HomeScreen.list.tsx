/** HomeScreen list view — the topnav (avatar + "+") and the channels FlatList
 *  (scroll persistence, requests header, empty state), extracted from
 *  HomeScreen.tsx (phase-2 lint, rendering identical). */

import type { MutableRefObject, RefObject } from 'react';
import { Pressable } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../Avatar';
import { Row } from '../layout';
import { CHANNELS_SCROLL_KEY, saveScrollOffset } from '../../lib/scrollPos';
import { CHANNEL_ROW_HEIGHT } from './HomeScreen.helpers';
import type { Row as RowT } from './HomeScreen.helpers';
import { HomeEmpty, RequestsHeader } from './HomeScreen.parts';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  myAddress: string | null;
  sortedRows: RowT[];
  requestCount: number;
  dark: boolean;
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
  panRef, router, myAddress, sortedRows, requestCount, dark, head, sub, border,
  listExtraData, listRef, savedOffsetRef, didRestoreRef, contentHeightRef,
  renderRow, getRowLayout,
}: ChannelsListProps): React.ReactElement {
  return (
    <>
      {/* Home topnav: avatar left, "+" right → opens the create-group screen.
       *  (Search lives in its own tab now, so the old search icon here was
       *  redundant and has been replaced.) */}
      <Row align="center" justify="between" px={16} pt={12} pb={10} style={{
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.push('/accounts')} hitSlop={8}>
          <Avatar address={myAddress} size={24} style={{ backgroundColor: border }} />
        </Pressable>
        <Pressable onPress={() => router.push('/xmtp/new-group')} hitSlop={8}>
          <Icon name="plus" size={26} color={head} />
        </Pressable>
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
        ListHeaderComponent={
          requestCount > 0 ? (
            <RequestsHeader
              requestCount={requestCount}
              dark={dark}
              head={head}
              sub={sub}
              border={border}
              onPress={() => router.push('/xmtp/requests')}
            />
          ) : null
        }
        extraData={[listExtraData, requestCount]}
        keyExtractor={r => r.convId}
        getItemLayout={getRowLayout}
        windowSize={11}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<HomeEmpty sub={sub} />}
        renderItem={renderRow}
      />
    </>
  );
}

/** ChannelRow is fixed-height (#5) → getItemLayout lets the list skip
 *  measuring + jump-scroll without rendering intermediate rows. Keep in sync
 *  with ChannelRow's layout (avatar 40 / 14px vertical padding / 1px border). */
export function channelRowLayout(_d: ArrayLike<RowT> | null | undefined, index: number): { length: number; offset: number; index: number } {
  return { length: CHANNEL_ROW_HEIGHT, offset: CHANNEL_ROW_HEIGHT * index, index };
}
