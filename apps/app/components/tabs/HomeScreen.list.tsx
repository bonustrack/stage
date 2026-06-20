
import type { MutableRefObject, RefObject } from 'react';
import { useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/pressable';
import { FlatList } from 'react-native-gesture-handler';
import { Icon } from '@stage-labs/kit/icon';
import { Box } from '../layout';
import { Text } from '@stage-labs/kit/text';
import { CHANNELS_SCROLL_KEY, saveScrollOffset } from '../../lib/scrollPos';
import { useEffectiveColorScheme } from '../../lib/theme';
import { CHANNEL_ROW_HEIGHT } from './HomeScreen.helpers';
import type { Row as RowT } from './HomeScreen.helpers';
import { HomeEmpty } from './HomeScreen.parts';
import { LabelFilterBar } from './HomeScreen.labelbar';
import { ProposalsBanner } from './Proposals.banner';
import { ChannelsSearchBar } from './HomeScreen.search';
import { HomeContactResults } from './HomeScreen.contacts';
import { HomeOverflowMenu } from './HomeScreen.overflow';
import { usePublishTopnavSlot } from './topnavSlots';
import { getActiveAccount } from '../../lib/accounts';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  sortedRows: RowT[];
  requestCount: number;
  barLabels: string[];
  enabledLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  unreadOnly: boolean;
  onToggleUnread: () => void;
  onClearAll: () => void;
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

function HomeTopnavRight({ head, requestCount, router, onOpenSearch }: {
  head: string; requestCount: number;
  router: ChannelsListProps['router']; onOpenSearch: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const badgeBg = dark ? '#ffffff' : '#000000';
  const badgeFg = dark ? '#000000' : '#ffffff';
  return (
    <>
      <Pressable onPress={onOpenSearch} hitSlop={8}>
        <Icon name="search" size={24} color={head}/>
      </Pressable>
      <Pressable onPress={() => { router.push('/xmtp/requests'); }} hitSlop={8} style={{ position: 'relative' }}>
        <Icon name="inbox" size={24} color={head}/>
        {requestCount > 0 ? (
          <Box minWidth={16} height={16} padding={{ x: 5 }} radius="full" background={badgeBg}
            align="center" justify="center" style={{ position: 'absolute', top: -6, right: -8 }}>
            <Text weight="semibold" size="3xs" color={badgeFg}>{requestCount > 99 ? '99+' : requestCount}</Text>
          </Box>
        ) : null}
      </Pressable>
      <HomeOverflowMenu
        color={head}
        onArchived={() => { router.push('/xmtp/archived'); }}
        onNewGroup={() => { router.push('/xmtp/new-group'); }}
        onProfile={() => {
          void getActiveAccount().then(acct => {
            if (acct?.address) router.push(`/user/${acct.address}`);
          });
        }}
        onSettings={() => { router.push('/settings'); }}
      />
    </>
  );
}

function ChannelsListHeader({ p }: { p: ChannelsListProps }): React.ReactElement {
  return (
    <>
      <ProposalsBanner/>
      <LabelFilterBar
        labels={p.barLabels} enabled={p.enabledLabels} unreadOnly={p.unreadOnly}
        onToggle={p.onToggleLabel} onToggleUnread={p.onToggleUnread} onClearAll={p.onClearAll}
        panRef={p.panRef}
      />
    </>
  );
}

function useHomeTopnav(p: ChannelsListProps, searchOpen: boolean, onOpenSearch: () => void, onCloseSearch: () => void): void {
  const { head, requestCount, router, query, setQuery, sub, border } = p;
  const right = useMemo(
    () => <HomeTopnavRight head={head} requestCount={requestCount} router={router} onOpenSearch={onOpenSearch} />,
    [head, requestCount, router, onOpenSearch],
  );
  const override = useMemo(
    () => (searchOpen ? (
      <ChannelsSearchBar query={query} setQuery={setQuery} onClose={onCloseSearch} head={head} sub={sub} border={border} />
    ) : undefined),
    [searchOpen, query, setQuery, onCloseSearch, head, sub, border],
  );
  usePublishTopnavSlot({ right, override });
}

export function ChannelsList(props: ChannelsListProps): React.ReactElement {
  const {
    panRef, sortedRows, query, fg, head, sub, border, setQuery,
    listExtraData, listRef, savedOffsetRef, didRestoreRef, contentHeightRef,
    renderRow, getRowLayout,
  } = props;
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = (): void => { setSearchOpen(true); };
  const closeSearch = (): void => { setSearchOpen(false); setQuery(''); };
  useHomeTopnav(props, searchOpen, openSearch, closeSearch);

  return (
    <>
      <FlatList
        ref={listRef}
        simultaneousHandlers={panRef}
        data={sortedRows}
        onScroll={(ev) => { saveScrollOffset(CHANNELS_SCROLL_KEY, ev.nativeEvent.contentOffset.y); }}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => {
          contentHeightRef.current = h;
          if (didRestoreRef.current) return;
          const want = savedOffsetRef.current;
          if (want == null || want <= 0) { didRestoreRef.current = true; return; }
          if (h <= 0) return;
          didRestoreRef.current = true;
          const offset = Math.min(want, Math.max(0, h));
          requestAnimationFrame(() => {
            try { listRef.current?.scrollToOffset({ offset, animated: false }); } catch { }
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
        ListHeaderComponent={<ChannelsListHeader p={props} />}
        ListEmptyComponent={query.trim() ? null : <HomeEmpty sub={sub} />}
        ListFooterComponent={
          query.trim()
            ? <HomeContactResults query={query} c={{ fg, head, sub, border }} noChannels={sortedRows.length === 0}/>
            : null
        }
        renderItem={renderRow}
/>
    </>
  );
}

export function channelRowLayout(_d: ArrayLike<RowT> | null | undefined, index: number): { length: number; offset: number; index: number } {
  return { length: CHANNEL_ROW_HEIGHT, offset: CHANNEL_ROW_HEIGHT * index, index };
}
