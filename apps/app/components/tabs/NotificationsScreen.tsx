/** Notifications tab. Currently surfaces pending message requests as a card
 *  (count + stacked requester avatars) at the top; falls back to an empty state
 *  when there's nothing to show. */

import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { RequestsCard } from './RequestsCard';
import { useRequestPreviews } from './useRequestPreviews';

export function NotificationsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link: head, text: sub, bg } = usePalette();
  const router = useRouter();
  const requests = useRequestPreviews();

  return (
    <ScrollView simultaneousHandlers={panRef} style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Col px={16} pt={16} pb={8}>
        <Title dark={dark} style={{ color: head, fontSize: 22 }}>Notifications</Title>
      </Col>
      <Col px={16} pt={8} gap={12}>
        <RequestsCard data={requests} onPress={() => router.push('/xmtp/requests')} />
      </Col>
      {requests.count === 0 ? (
        <Col flex={1} px={16} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Nothing yet</Text>
        </Col>
      ) : null}
    </ScrollView>
  );
}
