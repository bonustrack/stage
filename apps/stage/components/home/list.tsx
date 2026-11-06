import { useLayoutEffect, useMemo, useRef } from 'react';
import { MessagingSetupBanner } from './MessagingSetupBanner';
import { LabelFilterBar } from './labelbar';
import { parseSearchFilter } from './search/searchFilter.model';
import { HomeContactResults } from './contacts';
import { HomeSearch } from './HomeSearch';
import { HomeTopnav } from './HomeTopnav';
import { TOPNAV_FADE, TopnavFade, UNDER_TOPNAV } from '../Topnav';
import { SuggestedContacts } from '../contacts/SuggestedContacts';
import { usePalette } from '../../lib/theme';
import { listKeyOf, type HomeListItem } from './groups.model';
import type { Row } from './model';
import { useWebTabRail } from '../layout/webLayout';
import { HoverIconButton } from '../hover';
import { IconQrCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQrCode';
import { capabilities } from '../../lib/capabilities';
import { ROUTES } from '../tabs/pages';
import { useLastActivity } from '../../lib/lastActivity';
import { Column, VirtualList, type PersistedScroll } from '../layout';

const LIST_CONTENT = { paddingTop: TOPNAV_FADE, paddingBottom: 24 };
const WIDE_LIST_CONTENT = { paddingBottom: 24 };
const HEADER_LAYER = { zIndex: 1 };

interface ChannelsListProps {
  panRef?: import('../layout/simultaneousRefs').SimultaneousRefs;
  items: HomeListItem[];
  rows: readonly Row[] | null;
  barLabels: string[];
  placeholder?: React.ReactElement | null;
  enabledLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  unreadOnly: boolean;
  onToggleUnread: () => void;
  onClearAll: () => void;
  query: string;
  listExtraData: readonly unknown[];
  scroll: PersistedScroll;
  renderRow: ({ item }: { item: HomeListItem }) => React.ReactElement;
  wrapList?: (list: React.ReactElement) => React.ReactElement;
  pane: boolean;
}

const same = (node: React.ReactElement): React.ReactElement => node;

function knownPeerAddresses(rows: readonly Row[] | null): string[] {
  return (rows ?? []).flatMap((r) => (r.peerAddress === null ? [] : [r.peerAddress]));
}

function ChannelsListHeader({ p }: { p: ChannelsListProps }): React.ReactElement {
  const wide = useWebTabRail();
  const { text } = usePalette();
  return (
    <>
      {wide ? null : (
        <HomeSearch
          view="chats"
          fieldAction={
            <HoverIconButton
              icon={IconQrCode}
              size={20}
              color={text}
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
  rows,
  knownPeers,
}: {
  query: string;
  noChannels: boolean;
  rows: readonly Row[] | null;
  knownPeers: string[];
}): React.ReactElement | null {
  const text = parseSearchFilter(query).text;
  if (text !== '') return <HomeContactResults query={text} noChannels={noChannels} rows={rows} />;
  return query.trim() === '' ? <SuggestedContacts known={knownPeers} /> : null;
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
  const { panRef, items, query, pane, listExtraData, renderRow } = props;
  const { scroll } = props;
  const wide = useWebTabRail();
  const knownPeers = useMemo(() => knownPeerAddresses(props.rows), [props.rows]);
  useScrollTopOnFilter(props);

  return (
    <>
      {pane ? <HomeTopnav view="chats" pane /> : null}
      <Column weight={1}>
        {wide ? null : <TopnavFade stickyTop={pane ? undefined : UNDER_TOPNAV} />}
        {props.placeholder ? (
          <>
            <ChannelsListHeader p={props} />
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
              ListHeaderComponent={<ChannelsListHeader p={props} />}
              ListFooterComponent={<ListFooter query={query} noChannels={items.length === 0} rows={props.rows} knownPeers={knownPeers} />}
              renderItem={renderRow}
            />,
          )
        )}
      </Column>
    </>
  );
}
