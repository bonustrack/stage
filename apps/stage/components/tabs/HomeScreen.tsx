
import { useMemo, useState } from 'react';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useDraftsVersion } from '../../lib/drafts';
import { Col, Row } from '../layout';
import { useWebTabRail, WEB_TAB_RAIL_WIDTH } from './useWebTabRail';
import { usePaneWidth } from './paneWidth';
import { PaneResizeHandle } from './PaneResizeHandle';
import { ChannelMenu } from '../ChannelMenu';
import { HomeError, HomeSpinner, useChannelRowRenderer } from './HomeScreen.parts';
import { ChannelsList } from './HomeScreen.list';
import { useChannelsSync } from './HomeScreen.sync';
import { useIncomingLabelFilter } from './HomeScreen.filter';
import { deriveLabels, useHomeFilters } from './HomeScreen.labelbar';
import { filterRowsByQuery } from './HomeScreen.search';
import { channelsFilterBarVisible } from './HomeScreen.model';
import { useHomeState, type HomeState } from './HomeScreen.state';
import { deriveSortedRows } from './HomeScreen.derive';

function rowMenuProps(rowMenu: HomeState['rowMenu'], pinned: Set<string>) {
  if (!rowMenu) {
    return { visible: false, convId: '', title: undefined, isGroup: false, peerAddress: null, isUnread: false, isPinned: false };
  }
  return {
    visible: true,
    convId: rowMenu.convId,
    title: rowMenu.title,
    isGroup: rowMenu.isGroup,
    peerAddress: rowMenu.peerAddress,
    isUnread: rowMenu.isUnread,
    isPinned: pinned.has(rowMenu.convId),
  };
}

function HomeRowMenu({ st }: { st: HomeState }): React.ReactElement {
  const { rowMenu, pinned, setRowMenu } = st;
  return <ChannelMenu {...rowMenuProps(rowMenu, pinned)} onClose={() => { setRowMenu(null); }} />;
}

export function HomeScreen({ panRef, pane }: { panRef?: SimultaneousRefs; pane?: boolean } = {}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const splitHome = useWebTabRail() && pane !== true;
  const paneWidth = usePaneWidth();
  const st = useHomeState();
  const { rows, pinned } = st;
  const { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters } = useHomeFilters();
  const [query, setQuery] = useState<string>('');
  useIncomingLabelFilter(toggleLabel);

  const sortedRows = useMemo(
    () => deriveSortedRows({ rows, enabledLabels, unreadOnly, pinned }),
    [rows, pinned, enabledLabels, unreadOnly],
  );
  const barLabels = useMemo(() => deriveLabels(rows ?? []), [rows]);
  const showFilterBar = channelsFilterBarVisible({
    labelCount: barLabels.length,
    unreadOnly,
    enabledLabelsCount: enabledLabels.size,
  });
  const visibleRows = useMemo(() => filterRowsByQuery(sortedRows, query), [sortedRows, query]);

  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]),
  );
  const draftsVersion = useDraftsVersion();
  const accountEpoch = useActiveAccount();

  useChannelsSync({
    accountEpoch, rows, setRowsState: st.setRowsState, setRows: st.setRows,
    setError: st.setError, setRequestCount: st.setRequestCount,
    refreshFromNetworkRef: st.refreshFromNetworkRef,
  });

  const listExtraData = useMemo(
    () => [channelProfilesVersion, draftsVersion, pinned, query] as const,
    [channelProfilesVersion, draftsVersion, pinned, query],
  );
  const navRouter = useMemo(
    () => (pane === true
      ? { push: (to: Parameters<typeof router.replace>[0]) => { router.replace(to); } }
      : router),
    [pane, router],
  );
  const renderRow = useChannelRowRenderer(navRouter, st.setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query,
  });

  if (st.error) return <HomeError error={st.error} dark={dark} fg={fg} bg={bg} plain={pane} />;
  if (!rows) return <HomeSpinner head={head} bg={bg} plain={pane} />;

  const list = (
    <ChannelsList
      panRef={panRef} router={router} sortedRows={visibleRows} requestCount={st.requestCount}
      barLabels={barLabels} showFilterBar={showFilterBar}
      enabledLabels={enabledLabels} onToggleLabel={toggleLabel}
      unreadOnly={unreadOnly} onToggleUnread={toggleUnread} onClearAll={clearAllFilters}
      query={query} setQuery={setQuery} fg={fg} head={head} sub={sub} border={border}
      listExtraData={listExtraData}
      listRef={st.scroll.listRef} savedOffsetRef={st.scroll.savedOffsetRef}
      didRestoreRef={st.scroll.didRestoreRef} contentHeightRef={st.scroll.contentHeightRef}
      renderRow={renderRow}
      pane={pane === true || splitHome}
    />
  );

  if (splitHome) {
    return (
      <Row flex={1} surface="surface" padding={{ left: WEB_TAB_RAIL_WIDTH }}>
        <Col width={paneWidth} style={{ borderRightWidth: 1, borderRightColor: border }}>
          {list}
          <PaneResizeHandle/>
        </Col>
        <Col flex={1} align="center" justify="center">
          <Text size="md" role="secondary">Select a chat to start messaging</Text>
        </Col>
        <HomeRowMenu st={st} />
      </Row>
    );
  }

  return (
    <Col flex={1} surface="surface">
      {list}
      <HomeRowMenu st={st} />
    </Col>
  );
}
