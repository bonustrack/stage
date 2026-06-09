/** Archived conversations - convs the user hid from the main inbox via the
 *  channel menu's Archive action. Archive state is DEVICE-LOCAL (lib/archived.ts):
 *  XMTP consent only has allowed/denied/unknown, and `denied` already means
 *  "blocked" - reusing it for archive would conflate archive with block, so we
 *  keep a separate reversible local set. (Cross-device sync would need a
 *  dedicated archive flag later.)
 *
 *  Rows reuse the channels-list cache (channelsCache) filtered to the archived
 *  set, so titles/avatars/previews are already resolved. Each row is the shared
 *  ChannelRow (identical to the inbox); tapping it opens the conversation, where
 *  the overflow menu offers Unarchive. The list + the channels tab reconcile
 *  live via subscribeArchived. */

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
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { usePeerProfiles, getPeerName, getPeerAvatarCb } from '../../lib/peerProfiles';
import { ChannelRow } from '../../components/ChannelRow';
import { Col, Row } from '../../components/layout';

export default function Archived(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border, toolbarBg } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<RowT[]>((getCachedRows() as RowT[] | null) ?? []);

  useEffect(() => {
    void loadArchivedIds().then(setArchived);
    return subscribeArchived(() => { void loadArchivedIds().then(s => setArchived(new Set(s))); });
  }, []);
  useEffect(() => subscribeCachedRows(r => setRows((r as RowT[] | null) ?? [])), []);

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
        cacheBuster={item.avatarAddress ? getPeerAvatarCb(item.avatarAddress) : undefined}
        square={!item.peerAddress}
        lastPreview={item.lastPreview || preview || '(no messages yet)'}
        onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
      />
    );
  }, [router]);

  return (
    <Col flex={1} style={{ backgroundColor: bg }}>
      <Row align="center" gap={8} px={12} pt={8 + insets.top} pb={10} style={{ borderBottomWidth: 1, borderBottomColor: border, backgroundColor: toolbarBg }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title size="sm" dark={dark} color={head}>Archived</Title>
      </Row>
      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={r => r.convId}
        renderItem={renderRow}
        contentContainerStyle={data.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24 + insets.bottom }}
        ListEmptyComponent={
          <Col p={32} align="center">
            <Text color={sub} style={{ textAlign: 'center' }}>No archived conversations.</Text>
          </Col>
        }
      />
    </Col>
  );
}
