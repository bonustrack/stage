/** Archived conversations — convs the user hid from the main inbox via the
 *  channel menu's Archive action. Archive state is DEVICE-LOCAL (lib/archived.ts):
 *  XMTP consent only has allowed/denied/unknown, and `denied` already means
 *  "blocked" — reusing it for archive would conflate archive with block, so we
 *  keep a separate reversible local set. (Cross-device sync would need a
 *  dedicated archive flag later.)
 *
 *  Rows reuse the channels-list cache (channelsCache) filtered to the archived
 *  set, so titles/avatars/previews are already resolved. Each row has an inline
 *  Unarchive action that flips the local set; the list + the channels tab both
 *  reconcile live via subscribeArchived. */

import { useCallback, useEffect, useState } from 'react';
import { FlatList } from '@metro-labs/kit/flat-list';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedRows, subscribeCachedRows } from '../../modules/messaging';
import type { Row as RowT } from '../../components/tabs/HomeScreen.helpers';
import { loadArchivedIds, subscribeArchived, toggleArchived } from '../../lib/archived';
import { shortAddress } from '../../modules/messaging';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { usePeerProfiles, getPeerName, getPeerAvatarCb } from '../../lib/peerProfiles';
import { ChannelRow } from '../../components/ChannelRow';
import { Box, Col, Row } from '../../components/layout';

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
      <Row align="center" style={{ paddingRight: 12 }}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <ChannelRow
            title={displayTitle}
            avatarAddress={item.avatarUri ? null : item.avatarAddress}
            avatarUri={item.avatarUri}
            cacheBuster={item.avatarAddress ? getPeerAvatarCb(item.avatarAddress) : undefined}
            square={!item.peerAddress}
            lastPreview={item.lastPreview || preview || '(no messages yet)'}
            onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
          />
        </Box>
        <Pressable
          onPress={() => { void toggleArchived(item.convId); }}
          hitSlop={6}
          style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}
        >
          <Icon name="arrowUp" size={18} color={head} />
          <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Unarchive</Text>
        </Pressable>
      </Row>
    );
  }, [router, head]);

  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8 + insets.top, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
        backgroundColor: toolbarBg,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title dark={dark} style={{ color: head, fontSize: 20 }}>Archived</Title>
      </Box>
      <FlatList
        data={data}
        keyExtractor={r => r.convId}
        renderItem={renderRow}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        ListEmptyComponent={
          <Col p={32} align="center">
            <Text style={{ color: sub, textAlign: 'center' }}>No archived conversations.</Text>
          </Col>
        }
      />
    </Box>
  );
}
