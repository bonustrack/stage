
import type { MutableRefObject, RefObject } from 'react';
import { useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { VirtualList, type VirtualListHandle } from '../layout';
import { CHANNELS_SCROLL_KEY, saveScrollOffset } from '../../lib/scrollPos';
import { HistorySyncBanner, MessagingSetupBanner } from '../system/HistorySync';
import type { Row as RowT } from './helpers';
import { HomeEmpty } from './parts';
import { LabelFilterBar } from './labelbar';
import { SearchTopnavBar } from '../SearchTopnavBar';
import { HomeContactResults } from './contacts';
import { HomeOverflowMenu } from './overflow';
import { Topnav } from '../Topnav';
import { usePublishTopnavSlot, type TopnavSlot } from '../tabs/topnavSlots';
import { getActiveAccount } from '../../lib/accounts';
import { profileLinkOf } from '../../lib/links';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  sortedRows: RowT[];
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
  listRef: RefObject<VirtualListHandle | null>;
  savedOffsetRef: MutableRefObject<number | undefined>;
  didRestoreRef: MutableRefObject<boolean>;
  contentHeightRef: MutableRefObject<number>;
  renderRow: ({ item }: { item: RowT }) => React.ReactElement;
  pane: boolean;
}

function HomeTopnavRight({ head, router, onOpenSearch }: {
  head: string; router: ChannelsListProps['router']; onOpenSearch: () => void;
}): React.ReactElement {
  return (
    <>
      <Pressable onPress={onOpenSearch} hitSlop={8}>
        <Icon name="search" size={24} color={head}/>
      </Pressable>
      <HomeOverflowMenu
        color={head}
        onNewGroup={() => { router.push('/new-group'); }}
        onProfile={() => {
          void getActiveAccount().then(acct => {
            if (acct?.address) router.push(profileLinkOf(acct.address));
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
      <MessagingSetupBanner />
      <HistorySyncBanner />
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

function useHomeTopnav(p: ChannelsListProps, searchOpen: boolean, onOpenSearch: () => void, onCloseSearch: () => void): TopnavSlot {
  const { head, router, query, setQuery, sub, border, pane } = p;
  const right = useMemo(
    () => <HomeTopnavRight head={head} router={router} onOpenSearch={onOpenSearch} />,
    [head, router, onOpenSearch],
  );
  const override = useMemo(
    () => (searchOpen ? (
      <SearchTopnavBar
        query={query} setQuery={setQuery} onClose={onCloseSearch}
        head={head} sub={sub} border={border} inline={pane}
      />
    ) : undefined),
    [searchOpen, query, setQuery, onCloseSearch, head, sub, border, pane],
  );
  usePublishTopnavSlot({ right, override }, !pane);
  return { right, override };
}

export function ChannelsList(props: ChannelsListProps): React.ReactElement {
  const {
    panRef, sortedRows, query, fg, head, sub, border, setQuery, pane,
    listExtraData, listRef, savedOffsetRef, didRestoreRef, contentHeightRef,
    renderRow,
  } = props;
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = (): void => { setSearchOpen(true); };
  const closeSearch = (): void => { setSearchOpen(false); setQuery(''); };
  const slot = useHomeTopnav(props, searchOpen, openSearch, closeSearch);
  const contentStyle = { paddingTop: 12, paddingBottom: 24 };

  return (
    <>
      {pane ? slot.override ?? <Topnav inline right={slot.right}/> : null}
      <VirtualList
        ref={listRef}
        scroll={pane ? 'self' : 'window'}
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
