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
import { rowHeight } from './HomeScreen.helpers';
import type { Row as RowT } from './HomeScreen.helpers';
import { HomeEmpty } from './HomeScreen.parts';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  myAddress: string | null;
  sortedRows: RowT[];
  requestCount: number;
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
  panRef, router, myAddress, sortedRows, requestCount, head, sub, border,
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
      {/* Home topnav: avatar left, "+" right → opens the create-group screen.
       *  (Search lives in its own tab now, so the old search icon here was
       *  redundant and has been replaced.) */}
      <Row align="center" justify="between" px={16} pt={12} pb={10} style={{
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        {/* Static avatar: the top-left no longer opens the account-switcher
         *  page (account switching lives in Settings). */}
        <Avatar address={myAddress} size={24} style={{ backgroundColor: border }} />
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
        renderItem={renderRow}
      />
    </>
  );
}

/** getItemLayout lets the list skip measuring + jump-scroll without rendering
 *  intermediate rows. Rows are mostly fixed-height, but a group row showing
 *  label chips is taller — so we sum per-row heights (rowHeight) up to `index`
 *  for the offset, keeping jump-scroll math correct with variable heights. */
export function channelRowLayout(d: ArrayLike<RowT> | null | undefined, index: number): { length: number; offset: number; index: number } {
  let offset = 0;
  for (let i = 0; i < index; i += 1) offset += rowHeight(d?.[i]);
  return { length: rowHeight(d?.[index]), offset, index };
}
