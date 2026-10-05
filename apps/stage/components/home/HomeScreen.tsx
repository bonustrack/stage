
import { useMemo, useState } from 'react';
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
import { parseSearchFilter, searchRowMatcher } from '../searchFilter.model';
import { memberNamesOf } from '../FilterSearch';
import { useClearedChats } from '../../lib/clearedChats';
import { useBoardOrder } from '../../lib/boardOrder';
import { useHomeView } from '../../lib/homeView';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '@stage-labs/client/identity/format';
import { BoardScreen } from '../board/BoardScreen';
import { deriveSortedRows } from './model';
import { useGroupedRows, useHomeState } from './state';
import { useCategoryRowDrag, usePinDrag, useSectionDrag } from './listDrag';
import { useRowArrows } from './rowArrows';
import { useChannelAvatars } from '../../lib/channelRows';

const assigneeName = (address: string): string => getPeerName(address) ?? shortAddress(address);

export function HomeScreen({ panRef, pane }: { panRef?: SimultaneousRefs; pane?: boolean } = {}): React.ReactElement | null {
  const splitHome = useWebTabRail() && pane !== true;
  const accountEpoch = useAccountEpoch();
  const board = useHomeView().view === 'board';
  if (splitHome) return board ? null : <NewChatScreen key={accountEpoch}/>;
  if (board) return <BoardScreen pane={pane === true}/>;
  return <ChannelsHome panRef={panRef} pane={pane === true}/>;
}

function ChannelsHome({ panRef, pane }: { panRef?: SimultaneousRefs; pane: boolean }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const st = useHomeState();
  const { rows, pinned, rowMenu } = st;
  const { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters, query, setQuery } = useHomeFilters();
  const [filtering, setFiltering] = useState(false);
  const { groupBy } = useHomeView();
  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress, ...(groupBy === 'assignee' ? r.assigned : [])]),
  );
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
  const hideAvatar = !useChannelAvatars();

  useChannelsSync({ accountEpoch, setError: st.setError });

  const activePath = pane ? pathname : '';
  const menuConvId = rowMenu?.convId;
  const listExtraData = useMemo(
    () => [channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, hideAvatar] as const,
    [channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, hideAvatar],
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
  const pinDrag = usePinDrag(pinned, visiblePinned);
  const sectionDrag = useSectionDrag(list.items, list.grouped);
  const rowDrag = useCategoryRowDrag(list.items, groupBy === 'category');
  useRowArrows({ rows: list.rows, items: list.items, activePath, router: navRouter, listRef: st.scroll.listRef, paused: filtering });
  const renderRow = useChannelRowRenderer(navRouter, st.setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query: search.text, activePath, menuConvId, pinDrag, sectionDrag, rowDrag,
    hideAvatar,
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
        pane={pane}
      />
      <RowChannelMenu
        menu={rowMenu} isPinned={rowMenu !== null && pinned.includes(rowMenu.convId)}
        onClose={() => { st.setRowMenu(null); }}
      />
    </Col>
  );
}
