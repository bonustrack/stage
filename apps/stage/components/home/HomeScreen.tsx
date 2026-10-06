
import { useEffect, useMemo, useState } from 'react';
import type { MenuPoint } from '../AnchoredMenu.model';
import type { HomeMenuState } from './topnavRight';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { usePathname, useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { Col } from '../layout';
import { NewChatScreen } from './NewChatScreen';
import { useWebTabRail } from '../../lib/webLayout';
import { HomeError, RowChannelMenu, useChannelRowRenderer } from './parts';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { ChannelsList } from './list';
import { useChannelsSync } from './sync';
import { deriveBarLabels } from '@stage-labs/client/xmtp/channelsFilter';
import { useHomeFilters } from './labelbar';
import { searchBarLabels } from './model';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { parseSearchFilter, searchFilterSources, searchFilterValues, searchRowMatcher } from '../searchFilter.model';
import { memberNamesOf } from '../FilterSearch';
import { useClearedChats } from '../../lib/clearedChats';
import { useBoardOrder } from '../../lib/boardOrder';
import { useHomeView } from '../../lib/homeView';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '@stage-labs/client/identity/format';
import { BoardScreen } from '../board/BoardScreen';
import { deriveSortedRows } from './model';
import { useGroupedRows, useHomeState } from './state';
import { useCategoryRowDrag, useListDragMeasurements, usePinDrag, useSectionDrag } from './listDrag';
import { useRowArrows } from './rowArrows';
import { useChannelFields } from '../../lib/channelFields';

const assigneeName = (address: string): string => getPeerName(address) ?? shortAddress(address);

export function HomeScreen({ panRef, pane }: { panRef?: SimultaneousRefs; pane?: boolean } = {}): React.ReactElement | null {
  const splitHome = useWebTabRail() && pane !== true;
  const accountEpoch = useAccountEpoch();
  const board = useHomeView().view === 'board';
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const menu = useMemo(() => ({ anchor, setAnchor }), [anchor]);
  useEffect(() => { setAnchor(null); }, [accountEpoch]);
  if (splitHome) return board ? null : <NewChatScreen key={accountEpoch}/>;
  if (board) return <BoardScreen pane={pane === true} menu={menu}/>;
  return <ChannelsHome panRef={panRef} pane={pane === true} menu={menu}/>;
}

function ChannelsHome({ panRef, pane, menu }: { panRef?: SimultaneousRefs; pane: boolean; menu: HomeMenuState }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const st = useHomeState();
  const { rows, pinned, rowMenu } = st;
  const { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters, query, setQuery } = useHomeFilters();
  const [filtering, setFiltering] = useState(false);
  const { groupBy } = useHomeView();
  const members = searchFilterValues(query, 'member').length > 0 ? searchFilterSources(rows ?? [], 'chats').members : [];
  const channelProfilesVersion = usePeerProfiles([
    ...members, ...(rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress, ...(groupBy === 'assignee' ? r.assigned : [])]),
  ]);
  const draftsVersion = useDraftsVersion();
  const search = useMemo(() => parseSearchFilter(query), [query]);
  const matches = useMemo(
    () => searchRowMatcher(search, memberNamesOf, getDraft),
    [search, channelProfilesVersion, draftsVersion],
  );

  const sortedRows = useMemo(
    () => deriveSortedRows({ rows, enabledLabels, unreadOnly, pinned }),
    [rows, pinned, enabledLabels, unreadOnly],
  );
  const boardOrder = useBoardOrder();
  const barLabels = useMemo(
    () => searchBarLabels(deriveBarLabels((rows ?? []).filter(matches)), enabledLabels, boardOrder),
    [rows, matches, enabledLabels, boardOrder],
  );
  const cleared = useClearedChats();
  const visibleRows = useMemo(
    () => sortedRows.filter(r => matches(r) && !isRowCleared(cleared, r)),
    [sortedRows, matches, cleared],
  );
  const list = useGroupedRows(visibleRows, search.text, groupBy, assigneeName, channelProfilesVersion);
  const accountEpoch = useAccountEpoch();
  const fields = useChannelFields('chats');
  const hideAvatar = !fields.avatar;
  const dragLayoutKey = useMemo(
    () => [accountEpoch, fields, hideAvatar, channelProfilesVersion, draftsVersion],
    [accountEpoch, fields, hideAvatar, channelProfilesVersion, draftsVersion],
  );
  const dragMeasurements = useListDragMeasurements(list.items, dragLayoutKey);

  useChannelsSync({ accountEpoch, setError: st.setError });

  const activePath = pane ? pathname : '';
  const menuConvId = rowMenu?.convId;
  const listExtraData = useMemo(
    () => [channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, hideAvatar, fields] as const,
    [channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, hideAvatar, fields],
  );
  const navRouter = useMemo(
    () => (pane
      ? { push: (to: Parameters<typeof router.replace>[0]) => { router.replace(to); } }
      : router),
    [pane, router],
  );
  const visiblePinned = useMemo(
    () => (list.grouped ? [] : visibleRows.map(r => r.convId).filter(id => pinned.includes(id))),
    [list.grouped, visibleRows, pinned],
  );
  const pinDrag = usePinDrag(pinned, visiblePinned, dragMeasurements.heights);
  const sectionDrag = useSectionDrag(list.items, list.grouped, dragMeasurements.heights);
  const rowDrag = useCategoryRowDrag(list.items, groupBy === 'category', dragMeasurements.heights);
  useRowArrows({ rows: list.rows, items: list.items, activePath, router: navRouter, listRef: st.scroll.listRef, paused: filtering });
  const renderRow = useChannelRowRenderer(navRouter, st.setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query: search.text, activePath, menuConvId, pinDrag, sectionDrag, rowDrag,
    hideAvatar, fields, dragMeasurements,
  });

  const placeholder = st.error ? <HomeError error={st.error} dark={dark} fg={fg}/> : (!rows ? (
    <Col flex={1} align="center" justify="center"><Spinner size={28} color={head}/></Col>
  ) : null);

  return (
    <Col flex={1} surface="surface">
      <ChannelsList
        panRef={panRef} items={list.items}
        barLabels={barLabels} placeholder={placeholder}
        enabledLabels={enabledLabels} onToggleLabel={toggleLabel}
        unreadOnly={unreadOnly} onToggleUnread={toggleUnread} onClearAll={clearAllFilters}
        query={query} setQuery={setQuery} onFilterMenu={setFiltering}
        listExtraData={listExtraData}
        scroll={st.scroll}
        renderRow={renderRow}
        pane={pane} menu={menu}
      />
      <RowChannelMenu
        menu={rowMenu} isPinned={rowMenu !== null && pinned.includes(rowMenu.convId)}
        onClose={() => { st.setRowMenu(null); }}
      />
    </Col>
  );
}
