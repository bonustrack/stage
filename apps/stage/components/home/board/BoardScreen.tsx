import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { isRowCleared } from '@stage-labs/client/xmtp/sync/clear';
import { TOPNAV_FADE, TOPNAV_HEIGHT, TopnavFade, UNDER_TOPNAV } from '../../Topnav';
import { resetBoardQuery, useHomeListing } from '../listing';
import { HomeSearch } from '../HomeSearch';
import { HomeTopnav } from '../HomeTopnav';
import { HomeError, HomeSpinner } from '../parts';
import { useChannelsSyncError } from '../../../lib/messaging/channelsSync';
import { peerLabel } from '../../../lib/peerProfiles';
import { useEffectiveColorScheme, usePalette } from '../../../lib/theme';
import { reported } from '../../../lib/errorPolicy';
import { groupingOrderOf } from '../../../lib/grouping.model';
import { sortHomeRows } from '../sort.model';
import { useBottomChromeHeight } from '../../layout/bottomChrome';
import { useWebTabRail } from '../../layout/webLayout';
import { boardColumns, cardLanding, columnsEditable, orderedColumns, searchedColumns } from './BoardScreen.model';
import { addBoardColumn, deleteBoardColumn, dropCard, dropColumn, renameBoardColumn } from './boardActions';
import { BoardLanes, type ColumnActions } from './BoardLanes';
import { Column, ScreenScroll } from '../../layout';

function BoardBody(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head } = usePalette();
  const { rows, pinned, cleared, orders, view, sort, matches, profilesVersion } = useHomeListing('board');
  const { columnBy } = view;
  const order = groupingOrderOf(columnBy, orders);
  const statusOrder = groupingOrderOf('status', orders);
  const error = useChannelsSyncError();
  const columns = useMemo(
    () =>
      orderedColumns(
        boardColumns(rows ?? [], pinned, order, columnBy, peerLabel, (r) => isRowCleared(cleared, r), sort, statusOrder),
        order,
      ),
    [rows, cleared, pinned, order, columnBy, profilesVersion, sort, statusOrder],
  );
  const shown = useMemo(() => searchedColumns(columns, matches), [columns, matches]);
  if (error) return <HomeError error={error} dark={dark} fg={fg} />;
  if (!rows) return <HomeSpinner head={head} />;
  const actions: ColumnActions = {
    editable: columnsEditable(columnBy),
    dropCard: (convId, from, to) => {
      dropCard(columns, order, convId, from, to, columnBy);
    },
    dropColumn: (from, target) => {
      dropColumn(columns, order, from, target, columnBy);
    },
    placeCard: (move) => cardLanding(shown, move, (list) => sortHomeRows(list, pinned, sort, statusOrder)),
    rename: (from, to) => {
      if (columnsEditable(columnBy)) void renameBoardColumn(rows, columns, order, from, to, columnBy).catch(reported('board.rename'));
    },
    remove: (label) => {
      if (columnsEditable(columnBy)) void deleteBoardColumn(rows, columns, order, label, columnBy).catch(reported('board.delete'));
    },
    create: (name) => {
      if (columnsEditable(columnBy)) addBoardColumn(columns, order, name, columnBy);
    },
  };
  return <BoardLanes key={columnBy} columns={shown} pinned={pinned} actions={actions} />;
}
function BoardFrame({ pane, children }: { pane: boolean; children: React.ReactNode }): React.ReactElement {
  const wide = useWebTabRail();
  const [laneHeight, setLaneHeight] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScreenScroll>>(null);
  const topnav = pane ? <HomeTopnav view="board" pane /> : null;
  if (wide)
    return (
      <>
        {topnav}
        {children}
      </>
    );
  return (
    <>
      {topnav}
      <Column
        weight={1}
        onLayout={(event) => {
          setLaneHeight(event.nativeEvent.layout.height);
        }}
      >
        <TopnavFade stickyTop={UNDER_TOPNAV} />
        <ScreenScroll ref={scroll} contentContainerStyle={{ paddingTop: TOPNAV_FADE }} keyboardShouldPersistTaps="handled">
          <HomeSearch
            view="board"
            onOpen={() => {
              scroll.current?.scrollToOffset({ offset: 0, animated: false });
            }}
          />
          <Column height={laneHeight}>{children}</Column>
        </ScreenScroll>
      </Column>
    </>
  );
}
function useBoardHeight(): number | undefined {
  const { height } = useWindowDimensions();
  const chrome = useBottomChromeHeight();
  if (Platform.OS !== 'web') return undefined;
  return height - TOPNAV_HEIGHT - chrome;
}
export function BoardScreen({ pane }: { pane: boolean }): React.ReactElement {
  useEffect(() => resetBoardQuery, []);
  const height = useBoardHeight();
  const windowHeight = !pane && height !== undefined;
  return (
    <Column weight={windowHeight ? undefined : 1} height={windowHeight ? height : undefined} surface="surface">
      <BoardFrame pane={pane}>
        <BoardBody />
      </BoardFrame>
    </Column>
  );
}
