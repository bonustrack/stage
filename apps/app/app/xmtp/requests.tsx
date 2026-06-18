/** Message requests — pending XMTP conversations whose consent is 'unknown'
 *  (someone we never accepted started a DM / added us to a group). Each row
 *  shows the peer/group identity, a one-line preview, and Accept / Block.
 *
 *  - Accept → acceptRequestConv (updateConsent 'allowed') → moves to the inbox.
 *  - Block  → blockRequestConv  (updateConsent 'denied')  → drops everywhere.
 *  Both are cross-device via XMTP synced consent. The Channels list reconciles
 *  live (streamConvConsent) so accepted requests appear there without a reload. */

import { useCallback, useEffect, useState } from 'react';

import { FlatList } from '@metro-labs/kit/flat-list';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  listRequestConvs, acceptRequestConv, blockRequestConv,
  getCachedXmtpClient, summarizeConversationRequest,
  prefetchFeed, lineOfConv,
} from '../../modules/messaging';
import type { ConversationRequestView } from '../../modules/messaging';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { Icon } from '@metro-labs/kit/icon';
import { ChannelRow } from '../../components/ChannelRow';
import { Col, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';

/** Message-request row view-model. The shape lives on the facade's
 *  `ConversationRequestView` domain type (built by `summarizeConversationRequest`,
 *  which owns the SDK access + summarise logic, unchanged). */
type ReqRow = ConversationRequestView;

/** Screen listing pending conversation requests awaiting accept or decline. */
export default function Requests(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, danger } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ReqRow[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const convs = await listRequestConvs();
    const summarized = await Promise.all(convs.map(summarizeConversationRequest));
    setRows(summarized);
  }, []);

  useEffect(() => { void load(); }, [load]);
  usePeerProfiles((rows ?? []).map(r => r.peerAddress));

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
      /* Same channel card as the channels list, with an approve/reject cluster
         pinned on the right. ChannelRow flexes to fill; the actions sit beside
         it (paddingRight on the row keeps the buttons off the screen edge). */
      <Row padding={{ right: 12 }} align="center">
        <Col minWidth={0} flex={1}>
          <ChannelRow
            title={displayTitle}
            avatarAddress={item.avatarAddress}
            avatarUri={item.avatarUri}
            square={item.isGroup}
            lastPreview={item.preview || '(no messages yet)'}
            /** Warm the feed cache on touch-down so the request conversation
             *  opens from cache instead of waiting on the inbox-wide sync. */
            onPressIn={() => prefetchFeed(lineOfConv(item.convId))}
            onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
/>
        </Col>
        <Row gap={8} style={{ flexShrink: 0 }}>
          <Pressable
            onPress={() => act(item.convId, false)}
            hitSlop={6}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: border }}
>
            <Icon name="x" size={18} color={danger}/>
          </Pressable>
          <Pressable
            onPress={() => act(item.convId, true)}
            hitSlop={6}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#15321f' : '#dcf5e6' }}
>
            <Icon name="check" size={18} color={dark ? '#34d399' : '#15803d'}/>
          </Pressable>
        </Row>
      </Row>
    );
  }, [router, act, border, danger, dark]);

  return (
    <Col surface="surface" flex={1}>
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Title size="sm" color={head}>
          Message requests
        </Title>
      </Row>

      {!rows ? (
        <Col flex={1} align="center" justify="center">
          <Spinner size={28} color={head}/>
        </Col>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.convId}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
          ListEmptyComponent={
            <Col padding={32} align="center">
              <Text color={sub} style={{ textAlign: 'center' }}>
                No message requests.
              </Text>
            </Col>
          }
/>
      )}
    </Col>
  );
}
