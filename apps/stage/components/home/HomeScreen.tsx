
import { useMemo, useState } from 'react';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { usePathname, useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useDraftsVersion } from '../../lib/drafts';
import { Col } from '../layout';
import { SplitPlaceholder } from './SplitPlaceholder';
import { useWebTabRail } from '../../lib/webLayout';
import { ChannelMenu } from '../ChannelMenu';
import { HomeError, HomeSpinner, useChannelRowRenderer } from './parts';
import { ChannelsList } from './list';
import { useChannelsSync } from './sync';
import { deriveLabels, useHomeFilters } from './labelbar';
import { filterChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { useClearedChats } from '../../lib/clearedChats';
import { channelsFilterBarVisible, deriveSortedRows } from './model';
import { useHomeState } from './state';
import { usePinDrag } from './pinDrag';

export function HomeScreen({ panRef, pane }: { panRef?: SimultaneousRefs; pane?: boolean } = {}): React.ReactElement {
  const splitHome = useWebTabRail() && pane !== true;
  if (splitHome) return <SplitPlaceholder/>;
  return <ChannelsHome panRef={panRef} pane={pane === true}/>;
}

function ChannelsHome({ panRef, pane }: { panRef?: SimultaneousRefs; pane: boolean }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const st = useHomeState();
  const { rows, pinned, rowMenu } = st;
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
  const cleared = useClearedChats();
  const visibleRows = useMemo(
    () => filterChannelRows(sortedRows, { query }).filter(r => !isRowCleared(cleared, r)),
    [sortedRows, query, cleared],
  );

  const channelProfilesVersion = usePeerProfiles(
    (rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress, r.lastSenderAddress]),
  );
  const draftsVersion = useDraftsVersion();
  const accountEpoch = useActiveAccount();

  useChannelsSync({ accountEpoch, setError: st.setError });

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
  const visiblePinned = useMemo(() => visibleRows.map(r => r.convId).filter(id => pinned.includes(id)), [visibleRows, pinned]);
  const pinDrag = usePinDrag(pinned, visiblePinned);
  const renderRow = useChannelRowRenderer(navRouter, st.setRowMenu, {
    channelProfilesVersion, draftsVersion, pinned, query, activePath, pinDrag,
  });

  if (st.error) return <HomeError error={st.error} dark={dark} fg={fg} />;
  if (!rows) return <HomeSpinner head={head} />;

  return (
    <Col flex={1} surface="surface">
      <ChannelsList
        panRef={panRef} router={router} sortedRows={visibleRows}
        barLabels={barLabels} showFilterBar={showFilterBar}
        enabledLabels={enabledLabels} onToggleLabel={toggleLabel}
        unreadOnly={unreadOnly} onToggleUnread={toggleUnread} onClearAll={clearAllFilters}
        query={query} setQuery={setQuery}
        listExtraData={listExtraData}
        scroll={st.scroll}
        renderRow={renderRow}
        pane={pane}
      />
      {rowMenu ? (
        <ChannelMenu
          visible convId={rowMenu.convId} isGroup={rowMenu.isGroup} peerAddress={rowMenu.peerAddress}
          isUnread={rowMenu.isUnread} isPinned={pinned.includes(rowMenu.convId)} anchor={rowMenu.anchor ?? null}
          onClose={() => { st.setRowMenu(null); }}
        />
      ) : null}
    </Col>
  );
}
