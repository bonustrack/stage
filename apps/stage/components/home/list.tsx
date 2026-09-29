import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VirtualList } from '../layout';
import { CHANNELS_SCROLL_KEY, peekScrollOffset, saveScrollOffset } from '../../lib/scrollPos';
import { MessagingSetupBanner } from '../system/HistorySync';
import { LabelFilterBar } from './labelbar';
import { FilterSearch } from '../FilterSearch';
import { parseSearchFilter } from '../searchFilter.model';
import { HomeContactResults } from './contacts';
import { HomeTopnavRight } from './topnavRight';
import { Topnav } from '../Topnav';
import { usePublishTopnavSlot, type TopnavSlot } from '../tabs/topnavSlots';
import { SuggestedContacts } from '../SuggestedContacts';
import { usePalette } from '../../lib/theme';
import { homeRows, type ScrollRefs } from './state';
import type { Row } from './model';
import { attempt } from '../../lib/errorPolicy';
import { isSearchFocused, setSearchFocused } from '../../lib/searchState';

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

function ListFooter({ query, noChannels, knownPeers }: {
  query: string; noChannels: boolean; knownPeers: string[];
}): React.ReactElement | null {
  const text = parseSearchFilter(query).text;
  if (text !== '') return <HomeContactResults query={text} noChannels={noChannels}/>;
  return query.trim() === '' ? <SuggestedContacts known={knownPeers} /> : null;
}

interface SearchOpen {
  key: number;
  shown: boolean;
  open: () => void;
  close: () => void;
  onFocusChange: (focused: boolean) => void;
}

function useSearchOpen(query: string, setQuery: (query: string) => void): SearchOpen {
  const [key, setKey] = useState(0);
  const [held, setHeld] = useState(false);
  const reset = (): void => { setKey(0); setHeld(false); };
  useEffect(() => { if (query === '' && !isSearchFocused()) reset(); }, [query]);
  return {
    key,
    shown: held || query !== '',
    open: () => { setKey(k => k + 1); setHeld(true); },
    close: () => { reset(); setQuery(''); },
    onFocusChange: (focused) => { setSearchFocused(focused); if (focused) setHeld(true); },
  };
}

function useHomeTopnav(p: ChannelsListProps, search: SearchOpen): TopnavSlot {
  const { query, setQuery, onFilterMenu, pane } = p;
  const { text: sub, link: head, border } = usePalette();
  const right = useMemo(
    () => <HomeTopnavRight head={sub} onOpenSearch={search.open} view="chats" />,
    [sub, search.open],
  );
  const override = useMemo(
    () => (search.shown ? (
      <FilterSearch
        key={search.key} scope="chats" onMenu={onFilterMenu} onFocusChange={search.onFocusChange} autoFocus={search.key > 0}
        query={query} setQuery={setQuery} onClose={search.close}
        head={head} sub={sub} border={border} inline={pane} trailing={right}
      />
    ) : undefined),
    [search, query, setQuery, onFilterMenu, head, sub, border, pane, right],
  );
  usePublishTopnavSlot({ right, override }, !pane);
  return { right, override };
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
  const slot = useHomeTopnav(props, useSearchOpen(query, setQuery));
  const contentStyle = { paddingBottom: 24 };
  const knownPeers = useMemo(() => knownPeerAddresses(homeRows()), [sortedRows]);
  useScrollTopOnFilter(props);

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
            attempt(() => { listRef.current?.scrollToOffset({ offset, animated: false }); }, 'ui');
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
        ListFooterComponent={<ListFooter query={query} noChannels={sortedRows.length === 0} knownPeers={knownPeers}/>}
        renderItem={renderRow}
/>
    </>
  );
}
