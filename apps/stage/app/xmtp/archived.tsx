
import { useCallback, useEffect, useState } from 'react';

import { FlatList } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedRows, subscribeCachedRows } from '../../modules/messaging';
import type { Row as RowT } from '../../components/tabs/HomeScreen.helpers';
import { loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { shortAddress } from '../../modules/messaging';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { ChannelRow } from '../../components/ChannelRow';
import { EmptyState } from '../../components/chrome/EmptyState';
import { StackHeader } from '../../components/chrome/StackHeader';
import { Col } from '../../components/layout';

export default function Archived(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <StackHeader title="Archived" />
      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={r => r.convId}
        renderItem={renderRow}
        contentContainerStyle={data.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24 + insets.bottom }}
        ListEmptyComponent={<EmptyState title="No archived conversations." />}
/>
    </Col>
  );
}
