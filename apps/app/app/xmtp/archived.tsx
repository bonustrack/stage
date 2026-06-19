/**
 * @file Archived-conversations screen listing convs the user hid from the inbox
 * via the channel menu, using the device-local archive set (lib/archived.ts)
 * and reusing the channels-list cache and shared ChannelRow.
 */

import { useCallback, useEffect, useState } from 'react';

// FlatList from gesture-handler (not react-native): the plain RN list can be
// blocked from scrolling by the swipe-back pan handler at the screen root.
import { FlatList } from 'react-native-gesture-handler';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedRows, subscribeCachedRows } from '../../modules/messaging';
import type { Row as RowT } from '../../components/tabs/HomeScreen.helpers';
import { loadArchivedIds, subscribeArchived } from '../../lib/archived';
import { shortAddress } from '../../modules/messaging';
import { usePalette } from '../../lib/theme';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { ChannelRow } from '../../components/ChannelRow';
import { Col, Row } from '../../components/layout';

/** Screen listing the user's archived conversations. */
export default function Archived(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
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
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Title size="sm" color={head}>Archived</Title>
      </Row>
      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={r => r.convId}
        renderItem={renderRow}
        contentContainerStyle={data.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24 + insets.bottom }}
        ListEmptyComponent={
          <Col padding={32} align="center">
            <Text color={sub} style={{ textAlign: 'center' }}>No archived conversations.</Text>
          </Col>
        }
/>
    </Col>
  );
}
