import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, VirtualList } from '../layout';
import { CHANNELS_SCROLL_KEY, peekScrollOffset, saveScrollOffset } from '../../lib/scrollPos';
import { MessagingSetupBanner } from '../system/HistorySync';
import { LabelFilterBar } from './labelbar';
import { FilterSearch } from '../FilterSearch';
import { parseSearchFilter, setSearchQueryText, type FilterScope } from '../searchFilter.model';
import { HomeContactResults } from './contacts';
import { HomeTopnavRight, type HomeMenuState } from './topnavRight';
import { TOPNAV_FADE, TOPNAV_HEIGHT, Topnav, TopnavFade } from '../Topnav';
import { usePublishTopnavSlot, type TopnavSlot } from '../tabs/topnavSlots';
import { SuggestedContacts } from '../SuggestedContacts';
import { usePalette } from '../../lib/theme';
import { homeRows, type ScrollRefs } from './state';
import { listKeyOf, type HomeListItem } from './groups.model';
import type { Row } from './model';
import { attempt } from '../../lib/errorPolicy';
import { setSearchFocused } from '../../lib/searchState';
import { useWebTabRail } from '../../lib/webLayout';

const UNDER_TOPNAV = `calc(var(--stage-top-inset, 0px) + ${TOPNAV_HEIGHT}px)`;
const LIST_CONTENT = { paddingTop: TOPNAV_FADE, paddingBottom: 24 };
const WIDE_LIST_CONTENT = { paddingBottom: 24 };
const HEADER_LAYER = { zIndex: 1 };

interface ChannelsListProps {
  panRef?: import('../SwipeTabs.types').SimultaneousRefs;
  items: HomeListItem[];
  barLabels: string[];
  placeholder?: React.ReactElement | null;
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
  renderRow: ({ item }: { item: HomeListItem }) => React.ReactElement;
  pane: boolean;
  menu: HomeMenuState;
}

function knownPeerAddresses(rows: readonly Row[] | null): string[] {
  return (rows ?? []).flatMap(r => (r.peerAddress === null ? [] : [r.peerAddress]));
}

function ChannelsListHeader({ p, search }: { p: ChannelsListProps; search: SearchOpen }): React.ReactElement {
  const wide = useWebTabRail();
  const { text: sub, link: head, border } = usePalette();
  return (
    <>
      {wide ? null : <FilterSearch
        key={search.key} onFocusChange={setSearchFocused} autoFocus={search.key > 0}
        query={p.query} setQuery={p.setQuery} onClose={search.close} onOpen={search.open}
        head={head} sub={sub} border={border}
      />}
      <MessagingSetupBanner />
      <LabelFilterBar
        labels={p.barLabels} enabled={p.enabledLabels} unreadOnly={p.unreadOnly}
        onToggle={p.onToggleLabel} onToggleUnread={p.onToggleUnread} onClearAll={p.onClearAll}
      />
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

export interface SearchOpen {
  key: number;
  open: () => void;
  close: () => void;
}

export function useSearchOpen(query: string, setQuery: (query: string) => void): SearchOpen {
  const [key, setKey] = useState(0);
  const open = useCallback(() => { setKey(k => k + 1); }, []);
  return {
    key,
    open,
    close: () => { setKey(0); setSearchFocused(false); setQuery(setSearchQueryText(query, '')); },
  };
}

interface HomeTopnavProps {
  scope: FilterScope;
  pane: boolean;
  query: string;
  setQuery: (query: string) => void;
  onFilterMenu: (open: boolean) => void;
  menu: HomeMenuState;
}

export function useHomeTopnav(p: HomeTopnavProps, search: SearchOpen, wide: boolean): TopnavSlot {
  const { scope, query, setQuery, onFilterMenu, pane, menu } = p;
  const { text: sub, link: head, border } = usePalette();
  const right = useMemo(
    () => <HomeTopnavRight head={sub} menu={menu}
      scope={scope} query={query} setQuery={setQuery} onFilterMenu={onFilterMenu}/>,
    [sub, menu, scope, query, setQuery, onFilterMenu],
  );
  const smallNav = useMemo(() => <Topnav inline={pane} right={right} bordered={false}/>, [pane, right]);
  const override = !wide ? smallNav : (
    <FilterSearch
      key={search.key} onFocusChange={setSearchFocused} autoFocus={search.key > 0}
      query={query} setQuery={setQuery} onClose={search.close} onOpen={search.open}
      head={head} sub={sub} border={border} inline={pane} trailing={right}
    />
  );
  usePublishTopnavSlot({ right, override }, !pane);
  return { right, override };
}

function useScrollTopOnFilter({ enabledLabels, unreadOnly, scroll }: ChannelsListProps): void {
  const applied = useRef({ enabledLabels, unreadOnly });
  useLayoutEffect(() => {
    if (applied.current.enabledLabels === enabledLabels && applied.current.unreadOnly === unreadOnly) return;
    applied.current = { enabledLabels, unreadOnly };
    scroll.savedOffsetRef.current = 0;
    scroll.didRestoreRef.current = true;
    if ((peekScrollOffset(CHANNELS_SCROLL_KEY) ?? 0) <= 0) return;
    scroll.listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [enabledLabels, unreadOnly, scroll.listRef, scroll.savedOffsetRef, scroll.didRestoreRef]);
}

export function ChannelsList(props: ChannelsListProps): React.ReactElement {
  const {
    panRef, items, query, setQuery, pane, listExtraData, renderRow,
  } = props;
  const { listRef, savedOffsetRef, didRestoreRef } = props.scroll;
  const wide = useWebTabRail();
  const search = useSearchOpen(query, setQuery);
  const slot = useHomeTopnav({ ...props, scope: 'chats' }, search, wide);
  const knownPeers = useMemo(() => knownPeerAddresses(homeRows()), [items]);
  useScrollTopOnFilter(props);

  return (
    <>
      {pane ? slot.override ?? <Topnav inline right={slot.right}/> : null}
      <Box flex={1}>
        {wide ? null : <TopnavFade stickyTop={pane ? undefined : UNDER_TOPNAV}/>}
        {props.placeholder ? <>
          <ChannelsListHeader p={props} search={search}/>
          {props.placeholder}
        </> : <VirtualList
          ref={listRef}
          scroll={pane ? 'self' : 'window'}
          simultaneousHandlers={panRef}
          data={items}
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
          keyExtractor={listKeyOf}
          windowSize={11}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          contentContainerStyle={wide ? WIDE_LIST_CONTENT : LIST_CONTENT}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponentStyle={wide ? undefined : HEADER_LAYER}
          ListHeaderComponent={<ChannelsListHeader p={props} search={search}/>}
          ListFooterComponent={<ListFooter query={query} noChannels={items.length === 0} knownPeers={knownPeers}/>}
          renderItem={renderRow}
        />}
      </Box>
    </>
  );
}
