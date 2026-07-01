
import { useCallback, useEffect, useState } from 'react';

import { FlatList } from 'react-native-gesture-handler';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { basicRoot, emptyState, screenHeader, SCREEN_BACK } from '@stage-labs/views';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedRows, subscribeCachedRows } from '../../modules/messaging';
import type { Row as RowT } from '../../components/tabs/HomeScreen.helpers';
import { loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { shortAddress } from '../../modules/messaging';
import { usePalette } from '../../lib/theme';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { ChannelRow } from '../../components/ChannelRow';
import { Col } from '../../components/layout';

const EMPTY_NODE = basicRoot(emptyState({ title: 'No archived conversations.' }));

export default function Archived(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();
  const headerNode = basicRoot(screenHeader({
    title: 'Archived',
    titleStyle: { kind: 'title', size: 'sm', color: head },
    backColor: fg,
    safeTop: insets.top,
    surface: toolbarBg,
    borderColor: border,
  }));
  const headerActions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
  };
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<RowT[]>((getCachedRows() as RowT[] | null) ?? []);

  useEffect(() => {
    void loadArchivedIds().then(setArchived);
    return subscribeArchived(() => { void loadArchivedIds().then(s => { setArchived(new Set(s)); }); });
  }, []);
  useEffect(() => subscribeCachedRows(r => { setRows((r as RowT[] | null) ?? []); }), []);

  const data = rows.filter(r => archived.has(r.convId));
  usePeerProfiles(data.map(r => r.peerAddress));

  const renderRow = useCallback(({ item }: { item: RowT }): React.ReactElement => {
    const displayTitle = item.peerAddress
      ? (getPeerName(item.peerAddress) ?? item.title)
      : item.title;
    const preview = item.peerAddress
      ? (getPeerName(item.peerAddress) ?? shortAddress(item.peerAddress))
      : '';
    return (
      <ChannelRow
        title={displayTitle}
        avatarAddress={item.avatarUri ? null : item.avatarAddress}
        avatarUri={item.avatarUri}
        square={!item.peerAddress}
        lastPreview={item.lastPreview || preview || '(no messages yet)'}
        onPress={() => { router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } }); }}
/>
    );
  }, [router]);

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={headerActions} />
      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={r => r.convId}
        renderItem={renderRow}
        contentContainerStyle={data.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24 + insets.bottom }}
        ListEmptyComponent={<ViewHost node={EMPTY_NODE} />}
/>
    </Col>
  );
}
