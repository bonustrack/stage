
import { useMemo, useState } from 'react';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { usePathname, useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useDraftsVersion } from '../../lib/drafts';
import { Col } from '../layout';
import { useWebTabRail } from './useWebTabRail';
import { ChannelMenu } from '../ChannelMenu';
import { HomeError, HomeSpinner, useChannelRowRenderer } from './HomeScreen.parts';
import { ChannelsList } from './HomeScreen.list';
import { useChannelsSync } from './HomeScreen.sync';
import { deriveLabels, useHomeFilters } from './HomeScreen.labelbar';
import { filterRowsByQuery } from './HomeScreen.search';
import { channelsFilterBarVisible } from './HomeScreen.model';
import { useHomeState, type HomeState } from './HomeScreen.state';
import { deriveSortedRows } from './HomeScreen.helpers';

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

function SplitPlaceholder(): React.ReactElement {
  return (
    <Col
      flex={1} align="center" justify="center" surface="surface"
      margin={{ left: 'var(--stage-pane-left, 0px)' }}
>
      <Text size="md" role="secondary">Select a chat to start messaging</Text>
    </Col>
  );
}

export function HomeScreen({ panRef, pane }: { panRef?: SimultaneousRefs; pane?: boolean } = {}): React.ReactElement {
  const splitHome = useWebTabRail() && pane !== true;
  if (splitHome) return <SplitPlaceholder/>;
  return <ChannelsHome panRef={panRef} pane={pane === true}/>;
}

function ChannelsHome({ panRef, pane }: { panRef?: SimultaneousRefs; pane: boolean }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const st = useHomeState();
  const { rows, pinned } = st;
  const { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters } = useHomeFilters();
  const [query, setQuery] = useState<string>('');

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

  const activePath = pane ? pathname : '';
  const listExtraData = useMemo(
    () => [channelProfilesVersion, draftsVersion, pinned, query, activePath] as const,
    [channelProfilesVersion, draftsVersion, pinned, query, activePath],
  );
  const navRouter = useMemo(
    () => (pane
      ? { push: (to: Parameters<typeof router.replace>[0]) => { router.replace(to); } }
      : router),
    [pane, router],
  );
  const renderRow = useChannelRowRenderer(navRouter, st.setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query, activePath,
  });

  if (st.error) return <HomeError error={st.error} dark={dark} fg={fg} plain={pane} />;
  if (!rows) return <HomeSpinner head={head} plain={pane} />;

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
      pane={pane}
    />
  );

  return (
    <Col flex={1} surface="surface">
      {list}
      <HomeRowMenu st={st} />
    </Col>
  );
}
