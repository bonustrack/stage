/** Notifications tab. Lists each pending message request as its own notification
 *  entry ("New message request from X") and shows a notification-specific unread
 *  count pill in the header. Opening the page marks every visible notification
 *  read (lib/notifReadState), which clears the unread count + tab badge. Falls
 *  back to an empty state when there's nothing to show. */

import { useCallback } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Box, Col, Row } from '../layout';
import { TopnavIdentity } from '../TopnavIdentity';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { NotificationsList } from './NotificationsList';
import { useRequestPreviews } from './useRequestPreviews';
import { useNotifUnread } from './useNotifUnread';
import { markNotifsRead } from '../../lib/notifReadState';

export function NotificationsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link: head, text: sub, bg, toolbarBg } = usePalette();
  const router = useRouter();
  const { previews } = useRequestPreviews();
  const unread = useNotifUnread();

  // Mark everything currently visible as read whenever the tab gains focus.
  useFocusEffect(
    useCallback(() => {
      if (previews.length > 0) void markNotifsRead(previews.map(p => p.convId));
    }, [previews]),
  );

  return (
    <ScrollView simultaneousHandlers={panRef} style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Topnav identity (avatar + name → Menu), left-aligned to match Home. */}
      <Row align="center" px={16} pt={12} pb={4} bg={toolbarBg}>
        <TopnavIdentity />
      </Row>
      <Col px={16} pt={4} pb={8}>
        <Row align="center" gap={10}>
          <Title dark={dark} style={{ color: head, fontSize: fontSize('xxl') }}>Notifications</Title>
          {unread > 0 ? (
            <Box style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 999, backgroundColor: head, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: bg, fontSize: fontSize('sm'), fontFamily: 'Calibre-Semibold' }}>{unread}</Text>
            </Box>
          ) : null}
        </Row>
      </Col>
      <Col px={16} pt={8} gap={12}>
        <NotificationsList previews={previews} onPress={() => router.push('/xmtp/requests')} />
      </Col>
      {previews.length === 0 ? (
        <Col flex={1} px={16} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: sub, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium' }}>Nothing yet</Text>
        </Col>
      ) : null}
    </ScrollView>
  );
}
