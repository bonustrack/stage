
import { useMemo, useState } from 'react';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useDraftsVersion } from '../../lib/drafts';
import { Col } from '../layout';
import { ChannelMenu } from '../ChannelMenu';
import { HomeError, HomeSpinner, useChannelRowRenderer } from './HomeScreen.parts';
import { ChannelsList, channelRowLayout } from './HomeScreen.list';
import { useChannelsSync } from './HomeScreen.sync';
import { useIncomingLabelFilter } from './HomeScreen.filter';
import { deriveLabels, useHomeFilters } from './HomeScreen.labelbar';
import { filterRowsByQuery } from './HomeScreen.search';
import { useHomeState, type HomeState } from './HomeScreen.state';
import { deriveSortedRows } from './HomeScreen.derive';

function rowMenuProps(rowMenu: HomeState['rowMenu'], pinned: Set<string>, archived: Set<string>) {
  if (!rowMenu) {
    return { visible: false, convId: '', title: undefined, isGroup: false, peerAddress: null, isUnread: false, isPinned: false, isArchived: false };
  }
  return {
    visible: true,
    convId: rowMenu.convId,
    title: rowMenu.title,
    isGroup: rowMenu.isGroup,
    peerAddress: rowMenu.peerAddress,
    isUnread: rowMenu.isUnread,
    isPinned: pinned.has(rowMenu.convId),
    isArchived: archived.has(rowMenu.convId),
  };
}

function HomeRowMenu({ st }: { st: HomeState }): React.ReactElement {
  const { rowMenu, pinned, archived, setRowMenu } = st;
  return <ChannelMenu {...rowMenuProps(rowMenu, pinned, archived)} onClose={() => { setRowMenu(null); }} />;
}

export function HomeScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const st = useHomeState();
  const { rows, pinned, archived } = st;
  const { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters } = useHomeFilters();
  const [query, setQuery] = useState<string>('');
  useIncomingLabelFilter(toggleLabel);

  const sortedRows = useMemo(
    () => deriveSortedRows({ rows, archived, enabledLabels, unreadOnly, pinned }),
    [rows, pinned, enabledLabels, unreadOnly, archived],
  );
  const barLabels = useMemo(() => deriveLabels((rows ?? []).filter(r => !archived.has(r.convId))), [rows, archived]);
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
  const renderRow = useChannelRowRenderer(router, st.setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query,
  });

  if (st.error) return <HomeError error={st.error} dark={dark} fg={fg} bg={bg} />;
  if (!rows) return <HomeSpinner head={head} bg={bg} />;

  return (
    <Col flex={1} surface="surface">
      <ChannelsList
        panRef={panRef} router={router} sortedRows={visibleRows} requestCount={st.requestCount}
        barLabels={barLabels} enabledLabels={enabledLabels} onToggleLabel={toggleLabel}
        unreadOnly={unreadOnly} onToggleUnread={toggleUnread} onClearAll={clearAllFilters}
        query={query} setQuery={setQuery} fg={fg} head={head} sub={sub} border={border}
        listExtraData={listExtraData}
        listRef={st.scroll.listRef} savedOffsetRef={st.scroll.savedOffsetRef}
        didRestoreRef={st.scroll.didRestoreRef} contentHeightRef={st.scroll.contentHeightRef}
        renderRow={renderRow} getRowLayout={channelRowLayout}
      />
      <HomeRowMenu st={st} />
    </Col>
  );
}
