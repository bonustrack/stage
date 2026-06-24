
import { useCallback, useEffect, useState } from 'react';

import { FlatList } from '@stage-labs/kit/react-native/flat-list';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
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
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ChannelRow } from '../../components/ChannelRow';
import { Col, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';

type ReqRow = ConversationRequestView;

export default function Requests(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, danger } = usePalette();
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
    setRows(prev => (prev ?? []).filter(r => r.convId !== convId));
    void (accept ? acceptRequestConv(convId) : blockRequestConv(convId))
      .then(() => {
        void (getCachedXmtpClient() as unknown as { preferences?: { syncConsent?: () => Promise<unknown> } })
          ?.preferences?.syncConsent?.();
      })
      .catch(() => { void load(); });
  }, [load]);

  const renderRow = useCallback(({ item }: { item: ReqRow }): React.ReactElement => {
    const displayTitle = item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title;
    return (
      <Row padding={{ right: 12 }} align="center">
        <Col minWidth={0} flex={1}>
          <ChannelRow
            title={displayTitle}
            avatarAddress={item.avatarAddress}
            avatarUri={item.avatarUri}
            square={item.isGroup}
            lastPreview={item.preview || '(no messages yet)'}
            onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
            onPress={() => { router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } }); }}
/>
        </Col>
        <Row gap={8} style={{ flexShrink: 0 }}>
          <Pressable
            onPress={() => { act(item.convId, false); }}
            hitSlop={6}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: border }}
>
            <Icon name="x" size={18} color={danger}/>
          </Pressable>
          <Pressable
            onPress={() => { act(item.convId, true); }}
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
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
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
              <Text role="secondary" style={{ textAlign: 'center' }}>
                No message requests.
              </Text>
            </Col>
          }
/>
      )}
    </Col>
  );
}
