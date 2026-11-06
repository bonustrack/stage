import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MessagingSetupBanner } from './MessagingSetupBanner';
import { LabelFilterBar } from './labelbar';
import { FilterSearch } from './search/FilterSearch';
import { parseSearchFilter, setSearchQueryText, type FilterScope } from './search/searchFilter.model';
import { HomeContactResults } from './contacts';
import { HomeTopnavRight, type HomeMenuState } from './topnavRight';
import { TOPNAV_FADE, TOPNAV_HEIGHT, Topnav, TopnavFade } from '../Topnav';
import { usePublishTopnavSlot, type TopnavSlot } from '../tabs/topnavSlots';
import { useBoardHome } from '../tabs/boardHome';
import { SuggestedContacts } from '../contacts/SuggestedContacts';
import { usePalette } from '../../lib/theme';
import { homeRows } from './state';
import { listKeyOf, type HomeListItem } from './groups.model';
import type { Row } from './model';
import { useWebTabRail } from '../layout/webLayout';
import { HoverIconButton } from '../hover';
import { IconQrCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQrCode';
import { capabilities } from '../../lib/capabilities';
import { ROUTES } from '../tabs/pages';
import { useLastActivity } from '../../lib/lastActivity';
import { Column, VirtualList, type PersistedScroll } from '../layout';

const UNDER_TOPNAV = `calc(var(--stage-top-inset, 0px) + ${TOPNAV_HEIGHT}px)`;
const LIST_CONTENT = { paddingTop: TOPNAV_FADE, paddingBottom: 24 };
const WIDE_LIST_CONTENT = { paddingBottom: 24 };
const HEADER_LAYER = { zIndex: 1 };

interface ChannelsListProps {
  panRef?: import('../layout/simultaneousRefs').SimultaneousRefs;
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
  scroll: PersistedScroll;
  renderRow: ({ item }: { item: HomeListItem }) => React.ReactElement;
  wrapList?: (list: React.ReactElement) => React.ReactElement;
  pane: boolean;
  menu: HomeMenuState;
}

const same = (node: React.ReactElement): React.ReactElement => node;

function knownPeerAddresses(rows: readonly Row[] | null): string[] {
  return (rows ?? []).flatMap((r) => (r.peerAddress === null ? [] : [r.peerAddress]));
}

function ChannelsListHeader({ p, search }: { p: ChannelsListProps; search: SearchOpen }): React.ReactElement {
  const wide = useWebTabRail();
  const { text: sub, link: head, border } = usePalette();
  return (
    <>
      {wide ? null : (
        <FilterSearch
          key={search.key}
          autoFocus={search.key > 0}
          query={p.query}
          setQuery={p.setQuery}
          onClose={search.close}
          onOpen={search.open}
          head={head}
          sub={sub}
          border={border}
          fieldAction={
            <HoverIconButton
              icon={IconQrCode}
              size={20}
              color={sub}
              role="button"
              label="Scan contact QR code"
              onPress={() => {
                capabilities.navigate(ROUTES.scan);
              }}
            />
          }
        />
      )}
      <MessagingSetupBanner />
      <LabelFilterBar
        labels={p.barLabels}
        enabled={p.enabledLabels}
        unreadOnly={p.unreadOnly}
        onToggle={p.onToggleLabel}
        onToggleUnread={p.onToggleUnread}
        onClearAll={p.onClearAll}
      />
    </>
  );
}

function ListFooter({
  query,
  noChannels,
  knownPeers,
}: {
  query: string;
  noChannels: boolean;
  knownPeers: string[];
}): React.ReactElement | null {
  const text = parseSearchFilter(query).text;
  if (text !== '') return <HomeContactResults query={text} noChannels={noChannels} />;
  return query.trim() === '' ? <SuggestedContacts known={knownPeers} /> : null;
}

export interface SearchOpen {
  key: number;
  open: () => void;
  close: () => void;
}

export function useSearchOpen(query: string, setQuery: (query: string) => void): SearchOpen {
  const [key, setKey] = useState(0);
  const open = useCallback(() => {
    setKey((k) => k + 1);
  }, []);
  return {
    key,
    open,
    close: () => {
      setKey(0);
      setQuery(setSearchQueryText(query, ''));
    },
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
  const onPage = (scope === 'board') === useBoardHome();
  const right = useMemo(
    () => <HomeTopnavRight head={sub} menu={menu} scope={scope} query={query} setQuery={setQuery} onFilterMenu={onFilterMenu} />,
    [sub, menu, scope, query, setQuery, onFilterMenu],
  );
  const smallNav = useMemo(() => <Topnav inline={pane} right={right} bordered={false} />, [pane, right]);
  const override = !wide ? (
    smallNav
  ) : (
    <FilterSearch
      key={search.key}
      autoFocus={search.key > 0}
      query={query}
      setQuery={setQuery}
      onClose={search.close}
      onOpen={search.open}
      head={head}
      sub={sub}
      border={border}
      inline={pane}
      trailing={right}
    />
  );
  usePublishTopnavSlot({ right, override }, !pane && onPage);
  return { right, override };
}

function useScrollTopOnFilter({ enabledLabels, unreadOnly, scroll }: ChannelsListProps): void {
  const activity = useLastActivity('chats');
  const applied = useRef({ enabledLabels, unreadOnly, activity });
  useLayoutEffect(() => {
    if (
      applied.current.enabledLabels === enabledLabels &&
      applied.current.unreadOnly === unreadOnly &&
      applied.current.activity === activity
    )
      return;
    applied.current = { enabledLabels, unreadOnly, activity };
    scroll.resetToTop();
  }, [enabledLabels, unreadOnly, activity, scroll]);
}

export function ChannelsList(props: ChannelsListProps): React.ReactElement {
  const { panRef, items, query, setQuery, pane, listExtraData, renderRow } = props;
  const { scroll } = props;
  const wide = useWebTabRail();
  const search = useSearchOpen(query, setQuery);
  const slot = useHomeTopnav({ ...props, scope: 'chats' }, search, wide);
  const knownPeers = useMemo(() => knownPeerAddresses(homeRows()), [items]);
  useScrollTopOnFilter(props);

  return (
    <>
      {pane ? (slot.override ?? <Topnav inline right={slot.right} />) : null}
      <Column weight={1}>
        {wide ? null : <TopnavFade stickyTop={pane ? undefined : UNDER_TOPNAV} />}
        {props.placeholder ? (
          <>
            <ChannelsListHeader p={props} search={search} />
            {props.placeholder}
          </>
        ) : (
          (props.wrapList ?? same)(
            <VirtualList
              ref={scroll.listRef}
              persist={scroll}
              scroll={pane ? 'self' : 'window'}
              simultaneousHandlers={panRef}
              data={items}
              scrollEventThrottle={16}
              extraData={listExtraData}
              keyExtractor={listKeyOf}
              windowSize={11}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              removeClippedSubviews
              contentContainerStyle={wide ? WIDE_LIST_CONTENT : LIST_CONTENT}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponentStyle={wide ? undefined : HEADER_LAYER}
              ListHeaderComponent={<ChannelsListHeader p={props} search={search} />}
              ListFooterComponent={<ListFooter query={query} noChannels={items.length === 0} knownPeers={knownPeers} />}
              renderItem={renderRow}
            />,
          )
        )}
      </Column>
    </>
  );
}
