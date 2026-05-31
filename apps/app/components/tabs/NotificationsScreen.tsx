/** Notifications tab — empty placeholder for now. */

import { ScrollView } from 'react-native-gesture-handler';
import type { SimultaneousRefs } from '../SwipeTabs';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Col } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';

export function NotificationsScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { head, sub, bg } = usePalette();

  return (
    <ScrollView simultaneousHandlers={panRef} style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Col px={16} pt={16} pb={8}>
        <Title dark={dark} style={{ color: head, fontSize: 22 }}>Notifications</Title>
      </Col>
      <Col flex={1} px={16} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Nothing yet</Text>
      </Col>
    </ScrollView>
  );
}
