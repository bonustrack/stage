
import { useMemo, useState } from 'react';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { usePathname, useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { Col } from '../layout';
import { NewChatScreen } from './NewChatScreen';
import { useWebTabRail } from '../../lib/webLayout';
import { HomeError, HomeSpinner, RowChannelMenu, useChannelRowRenderer } from './parts';
import { ChannelsList } from './list';
import { useChannelsSync } from './sync';
import { deriveLabels, useHomeFilters } from './labelbar';
import { searchBarLabels } from './model';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { parseSearchFilter, searchRowMatcher } from '../searchFilter.model';
import { memberNamesOf } from '../FilterSearch';
import { useClearedChats } from '../../lib/clearedChats';
import { useBoardOrder } from '../../lib/boardOrder';
import { channelsFilterBarVisible, deriveSortedRows } from './model';
import { useHomeState } from './state';
import { usePinDrag } from './pinDrag';
import { useRowArrows } from './rowArrows';
import { channelsPaneWidth } from '../tabs/paneWidth';

export function HomeScreen({ panRef, pane }: { panRef?: SimultaneousRefs; pane?: boolean } = {}): React.ReactElement {
  const splitHome = useWebTabRail() && pane !== true;
  if (splitHome) return <NewChatScreen/>;
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
  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]),
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
    () => searchBarLabels(deriveLabels((rows ?? []).filter(matches)), enabledLabels, boardOrder),
    [rows, matches, enabledLabels, boardOrder],
  );
  const showFilterBar = channelsFilterBarVisible({
    labelCount: barLabels.length,
    unreadOnly,
    enabledLabelsCount: enabledLabels.size,
  });
  const cleared = useClearedChats();
  const visibleRows = useMemo(
    () => sortedRows.filter(r => matches(r) && !isRowCleared(cleared, r)),
    [sortedRows, matches, cleared],
  );
  const accountEpoch = useActiveAccount();
  const paneAtMin = channelsPaneWidth.useAtMin();
  const hideAvatar = pane && paneAtMin;

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
  const visiblePinned = useMemo(() => visibleRows.map(r => r.convId).filter(id => pinned.includes(id)), [visibleRows, pinned]);
  const pinDrag = usePinDrag(pinned, visiblePinned);
  useRowArrows({ rows: visibleRows, activePath, router: navRouter, listRef: st.scroll.listRef, paused: filtering });
  const renderRow = useChannelRowRenderer(navRouter, st.setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query: search.text, activePath, menuConvId, pinDrag, hideAvatar,
  });

  if (st.error) return <HomeError error={st.error} dark={dark} fg={fg} />;
  if (!rows) return <HomeSpinner head={head} />;

  return (
    <Col flex={1} surface="surface">
      <ChannelsList
        panRef={panRef} sortedRows={visibleRows}
        barLabels={barLabels} showFilterBar={showFilterBar}
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
