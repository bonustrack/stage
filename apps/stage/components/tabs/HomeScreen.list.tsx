
import type { MutableRefObject, RefObject } from 'react';
import { useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { FlatList } from 'react-native-gesture-handler';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Box } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { CHANNELS_SCROLL_KEY, saveScrollOffset } from '../../lib/scrollPos';
import { WEB_EDGE_SCROLL, WEB_EDGE_CONTENT } from '../layout';
import { useWebTabsContentPad } from './webPad';
import { useEffectiveColorScheme } from '../../lib/theme';
import type { Row as RowT } from './HomeScreen.helpers';
import { HomeEmpty } from './HomeScreen.parts';
import { LabelFilterBar } from './HomeScreen.labelbar';
import { ChannelsSearchBar } from './HomeScreen.search';
import { HomeContactResults } from './HomeScreen.contacts';
import { HomeOverflowMenu } from './HomeScreen.overflow';
import { Topnav } from '../Topnav';
import { usePublishTopnavSlot } from './topnavSlots';
import { getActiveAccount } from '../../lib/accounts';
import { unreadBadgeLabel } from '../../lib/format';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  sortedRows: RowT[];
  requestCount: number;
  barLabels: string[];
  showFilterBar: boolean;
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
  pane?: boolean;
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
      <Pressable onPress={() => { router.push('/requests'); }} hitSlop={8} style={{ position: 'relative' }}>
        <Icon name="inbox" size={24} color={head}/>
        {requestCount > 0 ? (
          <Box minWidth={16} height={16} padding={{ x: 5 }} radius="full" background={badgeBg}
            align="center" justify="center" style={{ position: 'absolute', top: -6, right: -8 }}>
            <Text weight="semibold" size="3xs" color={badgeFg}>{unreadBadgeLabel(requestCount)}</Text>
          </Box>
        ) : null}
      </Pressable>
      <HomeOverflowMenu
        color={head}
        onNewGroup={() => { router.push('/new-group'); }}
        onProfile={() => {
          void getActiveAccount().then(acct => {
            if (acct?.address) router.push(`/profile/${acct.address}`);
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
      {p.showFilterBar ? (
        <LabelFilterBar
          labels={p.barLabels} enabled={p.enabledLabels} unreadOnly={p.unreadOnly}
          onToggle={p.onToggleLabel} onToggleUnread={p.onToggleUnread} onClearAll={p.onClearAll}
          panRef={p.panRef}
        />
      ) : null}
    </>
  );
}

function useHomeTopnav(p: ChannelsListProps, searchOpen: boolean, onOpenSearch: () => void, onCloseSearch: () => void): void {
  const { head, requestCount, router, query, setQuery, sub, border } = p;
  const publish = p.pane !== true;
  const right = useMemo(
    () => <HomeTopnavRight head={head} requestCount={requestCount} router={router} onOpenSearch={onOpenSearch} />,
    [head, requestCount, router, onOpenSearch],
  );
  const override = useMemo(
    () => (searchOpen ? (
      <ChannelsSearchBar
        query={query} setQuery={setQuery} onClose={onCloseSearch}
        head={head} sub={sub} border={border}
      />
    ) : undefined),
    [searchOpen, query, setQuery, onCloseSearch, head, sub, border],
  );
  usePublishTopnavSlot({ right, override }, publish);
}

export function ChannelsList(props: ChannelsListProps): React.ReactElement {
  const {
    panRef, sortedRows, query, fg, head, sub, border, setQuery,
    listExtraData, listRef, savedOffsetRef, didRestoreRef, contentHeightRef,
    renderRow,
  } = props;
  const webTabsPad = useWebTabsContentPad();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = (): void => { setSearchOpen(true); };
  const closeSearch = (): void => { setSearchOpen(false); setQuery(''); };
  useHomeTopnav(props, searchOpen, openSearch, closeSearch);
  const listStyle = props.pane === true ? { flex: 1 } : WEB_EDGE_SCROLL;
  const contentStyle = props.pane === true
    ? [{ paddingTop: 12, paddingBottom: 24 }]
    : [{ paddingBottom: 24 }, WEB_EDGE_CONTENT, webTabsPad];

  return (
    <>
      {props.pane === true ? (
        searchOpen ? (
          <ChannelsSearchBar
            query={query} setQuery={setQuery} onClose={closeSearch}
            head={head} sub={sub} border={border} inline
          />
        ) : (
          <Topnav
            inline
            right={<HomeTopnavRight head={head} requestCount={props.requestCount} router={props.router} onOpenSearch={openSearch} />}
          />
        )
      ) : null}
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
        windowSize={11}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        style={listStyle}
        contentContainerStyle={contentStyle}
        ListHeaderComponent={<ChannelsListHeader p={props} />}
        ListEmptyComponent={query.trim() ? null : <HomeEmpty />}
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
