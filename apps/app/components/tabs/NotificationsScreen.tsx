/** Notifications tab. Lists each pending message request as its own notification
 *  entry ("New message request from X"). Opening the page marks every visible
 *  notification read (lib/notifReadState), which clears the tab badge. Falls
 *  back to an empty state when there's nothing to show. No in-page title - the
 *  shared Topnav is the only header (matches the other root tabs). */

import { useCallback } from 'react';

import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Text } from '@metro-labs/kit/text';
import { Col } from '../layout';
import { usePalette } from '../../lib/theme';
import { NotificationsList } from './NotificationsList';
import { useRequestPreviews } from './useRequestPreviews';
import { markNotifsRead } from '../../lib/notifReadState';

export function NotificationsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const { text: sub, bg } = usePalette();
  const router = useRouter();
  const { previews } = useRequestPreviews();

  // Mark everything currently visible as read whenever the tab gains focus.
  useFocusEffect(
    useCallback(() => {
      if (previews.length> 0) void markNotifsRead(previews.map(p => p.convId));
    }, [previews]),
  );

  return (
    // The shared Topnav (identity → Menu, no right-slot for Notifications) is
    // hoisted ABOVE the pager in (tabs)/_layout.tsx, so it stays fixed on swipe
    // AND scroll. This body renders only the scrollable list.
    <Col surface="surface" flex={1}>
    <ScrollView simultaneousHandlers={panRef} style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Col padding={{ x: 16, top: 12 }} gap={12}>
        <NotificationsList previews={previews} onPress={() => router.push('/xmtp/requests')}/>
      </Col>
      {previews.length === 0 ? (
        <Col padding={{ x: 16 }} flex={1} align="center" justify="center">
          <Text size="md" color={sub}>Nothing yet</Text>
        </Col>
      ) : null}
    </ScrollView>
    </Col>
  );
}
