/** Message requests — pending XMTP conversations whose consent is 'unknown'
 *  (someone we never accepted started a DM / added us to a group). Each row
 *  shows the peer/group identity, a one-line preview, and Accept / Block.
 *
 *  - Accept → acceptRequestConv (updateConsent 'allowed') → moves to the inbox.
 *  - Block  → blockRequestConv  (updateConsent 'denied')  → drops everywhere.
 *  Both are cross-device via XMTP synced consent. The Channels list reconciles
 *  live (streamConvConsent) so accepted requests appear there without a reload. */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  listRequestConvs, acceptRequestConv, blockRequestConv,
  peerEthAddressOfDm, groupMemberEthAddresses, shortAddress,
  getCachedXmtpClient,
} from '../../lib/xmtp';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../../components/Avatar';
import { Box, Col, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';

interface ReqRow {
  convId: string;
  title: string;
  /** DM peer address (null for groups) → avatar + display-name resolution. */
  peerAddress: string | null;
  /** Avatar address: peer for DMs, first other member for groups. */
  avatarAddress: string | null;
  preview: string;
  isGroup: boolean;
}

async function summarizeRequest(conv: Conversation): Promise<ReqRow> {
  await conv.sync().catch(() => undefined);
  const peerAddress = await peerEthAddressOfDm(conv);
  const isGroup = !peerAddress;
  const memberAddresses = isGroup ? await groupMemberEthAddresses(conv) : [];
  const groupName = isGroup
    ? await (conv as unknown as { name?: () => Promise<string> }).name?.().catch(() => '') ?? ''
    : '';
  const recent: DecodedMessage[] = await conv.messages({ limit: 1 }).catch(() => []);
  const last = recent[0];
  let preview = '';
  if (last) {
    try { preview = previewOfXmtpContent(last.content(), last.contentTypeId); }
    catch { preview = `[${last.contentTypeId ?? 'unknown'}]`; }
  }
  const title = peerAddress
    ? shortAddress(peerAddress)
    : (groupName.trim() || `${memberAddresses.length + 1} members`);
  return {
    convId: conv.id,
    title,
    peerAddress,
    avatarAddress: peerAddress ?? memberAddresses[0] ?? null,
    preview: preview.slice(0, 80),
    isGroup,
  };
}

export default function Requests(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border } = usePalette();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ReqRow[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const convs = await listRequestConvs();
    const summarized = await Promise.all(convs.map(summarizeRequest));
    setRows(summarized);
  }, []);

  useEffect(() => { void load(); }, [load]);
  usePeerProfiles((rows ?? []).flatMap(r => [r.avatarAddress, r.peerAddress]));

  const act = useCallback((convId: string, accept: boolean): void => {
    /** Optimistic: drop the row immediately; the consent write + the channels
     *  list's streamConvConsent reconcile the rest. */
    setRows(prev => (prev ?? []).filter(r => r.convId !== convId));
    void (accept ? acceptRequestConv(convId) : blockRequestConv(convId))
      .then(() => {
        /** Force a synced-prefs refresh so other surfaces converge. */
        void (getCachedXmtpClient() as unknown as { preferences?: { syncConsent?: () => Promise<unknown> } })
          ?.preferences?.syncConsent?.();
      })
      .catch(() => { void load(); });
  }, [load]);

  const renderRow = useCallback(({ item }: { item: ReqRow }): React.ReactElement => {
    const displayTitle = item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title;
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: border,
        }}
      >
        <Avatar address={item.avatarAddress} size={44} square={item.isGroup} style={{ backgroundColor: border }} />
        <Col flex={1} gap={2}>
          <Text numberOfLines={1} style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
            {displayTitle}
          </Text>
          <Text numberOfLines={1} style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            {item.preview || '(no messages yet)'}
          </Text>
        </Col>
        <Row gap={8}>
          <Pressable
            onPress={() => act(item.convId, false)}
            hitSlop={6}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: border }}
          >
            <Icon name="x" size={18} color={dark ? '#ff6b80' : '#b91c1c'} />
          </Pressable>
          <Pressable
            onPress={() => act(item.convId, true)}
            hitSlop={6}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#15321f' : '#dcf5e6' }}
          >
            <Icon name="check" size={18} color={dark ? '#34d399' : '#15803d'} />
          </Pressable>
        </Row>
      </Pressable>
    );
  }, [router, act, head, sub, border, dark]);

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title dark={dark} style={{ color: head, fontSize: 20 }}>
          Message requests
        </Title>
      </Box>

      {!rows ? (
        <Col flex={1} align="center" justify="center">
          <Spinner size={28} color={head} />
        </Col>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.convId}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
          ListEmptyComponent={
            <Col p={32} align="center">
              <Text style={{ color: sub, textAlign: 'center' }}>
                No message requests.
              </Text>
            </Col>
          }
        />
      )}
    </Box>
  );
}
