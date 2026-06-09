/** Notifications tab. Lists each pending message request as its own notification
 *  entry ("New message request from X") and shows a notification-specific unread
 *  count pill in the header. Opening the page marks every visible notification
 *  read (lib/notifReadState), which clears the unread count + tab badge. Falls
 *  back to an empty state when there's nothing to show. */

import { useCallback } from 'react';

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
      if (previews.length> 0) void markNotifsRead(previews.map(p => p.convId));
    }, [previews]),
  );

  return (
    <ScrollView simultaneousHandlers={panRef} style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Topnav identity (avatar + name → Menu), left-aligned to match Home. */}
      <Row padding={{ x: 16, top: 12, bottom: 4 }} align="center" background={toolbarBg}>
        <TopnavIdentity/>
      </Row>
      <Col padding={{ x: 16, top: 4, bottom: 8 }}>
        <Row align="center" gap={10}>
          <Title size="md" dark={dark} color={head}>Notifications</Title>
          {unread> 0 ? (
            <Box minWidth={22} height={22} radius="full" background={head} padding={{ x: 7 }} align="center" justify="center">
              <Text weight="semibold" size="xs" color={bg}>{unread}</Text>
            </Box>
          ) : null}
        </Row>
      </Col>
      <Col padding={{ x: 16, top: 8 }} gap={12}>
        <NotificationsList previews={previews} onPress={() => router.push('/xmtp/requests')}/>
      </Col>
      {previews.length === 0 ? (
        <Col padding={{ x: 16 }} flex={1} align="center" justify="center">
          <Text size="md" color={sub}>Nothing yet</Text>
        </Col>
      ) : null}
    </ScrollView>
  );
}
