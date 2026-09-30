import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, VirtualList } from '../layout';
import { CHANNELS_SCROLL_KEY, peekScrollOffset, saveScrollOffset } from '../../lib/scrollPos';
import { MessagingSetupBanner } from '../system/HistorySync';
import { LabelFilterBar } from './labelbar';
import { FilterSearch } from '../FilterSearch';
import { parseSearchFilter } from '../searchFilter.model';
import { HomeContactResults } from './contacts';
import { HomeTopnavRight } from './topnavRight';
import { TOPNAV_FADE, TOPNAV_HEIGHT, Topnav, TopnavFade } from '../Topnav';
import { usePublishTopnavSlot } from '../tabs/topnavSlots';
import { SuggestedContacts } from '../SuggestedContacts';
import { usePalette } from '../../lib/theme';
import { homeRows, type ScrollRefs } from './state';
import type { Row } from './model';
import { attempt } from '../../lib/errorPolicy';
import { setSearchFocused } from '../../lib/searchState';

const UNDER_TOPNAV = `calc(var(--stage-top-inset, 0px) + ${TOPNAV_HEIGHT}px)`;
const LIST_CONTENT = { paddingTop: TOPNAV_FADE, paddingBottom: 24 };

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
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
  onFilterMenu: (open: boolean) => void;
  listExtraData: readonly unknown[];
  scroll: ScrollRefs;
  renderRow: ({ item }: { item: Row }) => React.ReactElement;
  pane: boolean;
}

function knownPeerAddresses(rows: readonly Row[] | null): string[] {
  return (rows ?? []).flatMap(r => (r.peerAddress === null ? [] : [r.peerAddress]));
}

function ChannelsListHeader({ p, search }: { p: ChannelsListProps; search: SearchOpen }): React.ReactElement {
  const { text: sub, link: head, border } = usePalette();
  return (
    <>
      <FilterSearch
        key={search.key} scope="chats" onMenu={p.onFilterMenu} onFocusChange={setSearchFocused} autoFocus={search.key > 0}
        query={p.query} setQuery={p.setQuery} onClose={search.close} onOpen={search.open}
        head={head} sub={sub} border={border}
      />
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

function ListFooter({ query, noChannels, knownPeers }: {
  query: string; noChannels: boolean; knownPeers: string[];
}): React.ReactElement | null {
  const text = parseSearchFilter(query).text;
  if (text !== '') return <HomeContactResults query={text} noChannels={noChannels}/>;
  return query.trim() === '' ? <SuggestedContacts known={knownPeers} /> : null;
}

interface SearchOpen {
  key: number;
  open: () => void;
  close: () => void;
}

function useSearchOpen(setQuery: (query: string) => void): SearchOpen {
  const [key, setKey] = useState(0);
  return {
    key,
    open: () => { setKey(k => k + 1); },
    close: () => { setKey(0); setQuery(''); },
  };
}

function useHomeTopnav(pane: boolean): React.ReactElement {
  const { text: sub } = usePalette();
  const nav = useMemo(
    () => <Topnav inline={pane} right={<HomeTopnavRight head={sub} view="chats"/>} bordered={false}/>,
    [sub, pane],
  );
  usePublishTopnavSlot({ override: nav }, !pane);
  return nav;
}

function useScrollTopOnFilter({ enabledLabels, unreadOnly, scroll }: ChannelsListProps): void {
  const applied = useRef({ enabledLabels, unreadOnly });
  useLayoutEffect(() => {
    if (applied.current.enabledLabels === enabledLabels && applied.current.unreadOnly === unreadOnly) return;
    applied.current = { enabledLabels, unreadOnly };
    if ((peekScrollOffset(CHANNELS_SCROLL_KEY) ?? 0) <= 0) return;
    scroll.listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [enabledLabels, unreadOnly, scroll.listRef]);
}

export function ChannelsList(props: ChannelsListProps): React.ReactElement {
  const {
    panRef, sortedRows, query, setQuery, pane, listExtraData, renderRow,
  } = props;
  const { listRef, savedOffsetRef, didRestoreRef } = props.scroll;
  const search = useSearchOpen(setQuery);
  const nav = useHomeTopnav(pane);
  const knownPeers = useMemo(() => knownPeerAddresses(homeRows()), [sortedRows]);
  useScrollTopOnFilter(props);

  return (
    <>
      {pane ? nav : null}
      <Box flex={1}>
        <TopnavFade scroll={pane ? 'self' : 'window'} stickyTop={UNDER_TOPNAV}/>
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
              attempt(() => { listRef.current?.scrollToOffset({ offset, animated: false }); }, 'ui');
            });
          }}
          extraData={listExtraData}
          keyExtractor={r => r.convId}
          windowSize={11}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          contentContainerStyle={LIST_CONTENT}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponentStyle={{ zIndex: 1 }}
          ListHeaderComponent={<ChannelsListHeader p={props} search={search}/>}
          ListFooterComponent={<ListFooter query={query} noChannels={sortedRows.length === 0} knownPeers={knownPeers}/>}
          renderItem={renderRow}
        />
      </Box>
    </>
  );
}
