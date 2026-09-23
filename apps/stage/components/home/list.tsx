import { useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { VirtualList } from '../layout';
import { CHANNELS_SCROLL_KEY, saveScrollOffset } from '../../lib/scrollPos';
import { MessagingSetupBanner } from '../system/HistorySync';
import { LabelFilterBar } from './labelbar';
import { SearchTopnavBar } from '../SearchTopnavBar';
import { HomeContactResults } from './contacts';
import { HomeOverflowMenu } from './overflow';
import { Topnav } from '../Topnav';
import { usePublishTopnavSlot, type TopnavSlot } from '../tabs/topnavSlots';
import { getActiveAccount } from '../../lib/accounts';
import { profileLinkOf } from '../../lib/links';
import { SuggestedContacts } from '../SuggestedContacts';
import { usePalette } from '../../lib/theme';
import { homeRows, type ScrollRefs } from './state';
import type { Row } from './model';

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  router: { push: (to: string | { pathname: string; params: Record<string, string> }) => void };
  sortedRows: Row[];
  barLabels: string[];
  showFilterBar: boolean;
  enabledLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  unreadOnly: boolean;
  onToggleUnread: () => void;
  onClearAll: () => void;
  query: string;
  setQuery: (v: string) => void;
  listExtraData: readonly unknown[];
  scroll: ScrollRefs;
  renderRow: ({ item }: { item: Row }) => React.ReactElement;
  pane: boolean;
}

function knownPeerAddresses(rows: readonly Row[] | null): string[] {
  return (rows ?? []).flatMap(r => (r.peerAddress === null ? [] : [r.peerAddress]));
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
  const { router, query, setQuery, pane } = p;
  const { text: sub, link: head, border } = usePalette();
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
    panRef, sortedRows, query, setQuery, pane, listExtraData, renderRow,
  } = props;
  const { listRef, savedOffsetRef, didRestoreRef } = props.scroll;
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = (): void => { setSearchOpen(true); };
  const closeSearch = (): void => { setSearchOpen(false); setQuery(''); };
  const slot = useHomeTopnav(props, searchOpen, openSearch, closeSearch);
  const contentStyle = { paddingTop: 12, paddingBottom: 24 };
  const knownPeers = useMemo(() => knownPeerAddresses(homeRows()), [sortedRows]);

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
        ListFooterComponent={
          query.trim()
            ? <HomeContactResults query={query} noChannels={sortedRows.length === 0}/>
            : <SuggestedContacts known={knownPeers} />
        }
        renderItem={renderRow}
/>
    </>
  );
}
